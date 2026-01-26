"""
Media API Endpoints
S3 pre-signed URLs for file upload, storage metadata
"""

import io
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import and_
from typing import List, Optional, Dict
from uuid import UUID
from datetime import datetime, timedelta, date
import uuid
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from collections import defaultdict
import threading

from ..core.database import get_db
from ..core.config import settings
from ..models import Project, MediaAsset, User, AuditLog
from ..schemas import (
    MediaUploadUrlRequest,
    MediaUploadUrlResponse,
    MediaAssetResponse,
    GeotaggedMediaResponse
)
from ..api.auth import get_current_user, require_role
from ..services.thumbnail_service import (
    generate_and_store_thumbnail,
    get_thumbnail,
    get_cached_image,
    get_thumbnail_key
)
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# =============================================================================
# Download Quota System
# Prevents abuse by limiting downloads per user per day
# =============================================================================

# Configuration
DAILY_VIDEO_DOWNLOAD_LIMIT = 20  # Max video downloads per user per day
DAILY_PHOTO_DOWNLOAD_LIMIT = 200  # Max photo downloads per user per day
DAILY_TOTAL_BYTES_LIMIT = 500 * 1024 * 1024  # 500MB per user per day

# In-memory storage (use Redis in production for persistence across restarts)
# Structure: {user_id: {"date": date, "video_count": int, "photo_count": int, "bytes": int}}
_download_quota: Dict[str, dict] = defaultdict(lambda: {"date": None, "video_count": 0, "photo_count": 0, "bytes": 0})
_quota_lock = threading.Lock()


def check_and_update_quota(user_id: str, media_type: str, file_size: int) -> tuple[bool, str]:
    """
    Check if user has remaining quota and update if allowed.

    Returns: (allowed: bool, reason: str)
    """
    with _quota_lock:
        today = date.today()
        user_quota = _download_quota[str(user_id)]

        # Reset quota if new day
        if user_quota["date"] != today:
            user_quota["date"] = today
            user_quota["video_count"] = 0
            user_quota["photo_count"] = 0
            user_quota["bytes"] = 0

        # Check byte limit
        if user_quota["bytes"] + file_size > DAILY_TOTAL_BYTES_LIMIT:
            remaining_mb = (DAILY_TOTAL_BYTES_LIMIT - user_quota["bytes"]) / (1024 * 1024)
            return False, f"Daily download limit reached (500MB). Remaining: {remaining_mb:.1f}MB. Resets at midnight UTC."

        # Check count limit based on media type
        if media_type == "video":
            if user_quota["video_count"] >= DAILY_VIDEO_DOWNLOAD_LIMIT:
                return False, f"Daily video download limit reached ({DAILY_VIDEO_DOWNLOAD_LIMIT} videos). Resets at midnight UTC."
            user_quota["video_count"] += 1
        else:  # photo or other
            if user_quota["photo_count"] >= DAILY_PHOTO_DOWNLOAD_LIMIT:
                return False, f"Daily photo download limit reached ({DAILY_PHOTO_DOWNLOAD_LIMIT} photos). Resets at midnight UTC."
            user_quota["photo_count"] += 1

        # Update bytes
        user_quota["bytes"] += file_size

        return True, "OK"


def get_user_quota_status(user_id: str) -> dict:
    """Get current quota status for a user."""
    with _quota_lock:
        today = date.today()
        user_quota = _download_quota[str(user_id)]

        if user_quota["date"] != today:
            return {
                "video_remaining": DAILY_VIDEO_DOWNLOAD_LIMIT,
                "photo_remaining": DAILY_PHOTO_DOWNLOAD_LIMIT,
                "bytes_remaining": DAILY_TOTAL_BYTES_LIMIT,
                "resets_at": "midnight UTC"
            }

        return {
            "video_remaining": DAILY_VIDEO_DOWNLOAD_LIMIT - user_quota["video_count"],
            "photo_remaining": DAILY_PHOTO_DOWNLOAD_LIMIT - user_quota["photo_count"],
            "bytes_remaining": DAILY_TOTAL_BYTES_LIMIT - user_quota["bytes"],
            "resets_at": "midnight UTC"
        }

# Initialize S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    region_name=settings.S3_REGION,
    config=Config(signature_version='s3v4'),
    use_ssl=settings.S3_USE_SSL
)


@router.post("/presign-upload")
async def presign_upload_simple(
    request: Request,
    body: dict,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Simple presigned URL endpoint for mobile app.

    Returns just a presigned URL and media key without creating a database record.
    The mobile app will register the media separately after upload.
    """
    file_name = body.get("file_name", "upload")
    content_type = body.get("content_type", "application/octet-stream")

    # Generate unique storage key
    media_id = uuid.uuid4()
    file_extension = file_name.split('.')[-1] if '.' in file_name else ''

    # Determine media type from content type
    if content_type.startswith("image/"):
        media_type = "photo"
    elif content_type.startswith("video/"):
        media_type = "video"
    else:
        media_type = "document"

    storage_key = f"mobile/{media_type}s/{media_id}.{file_extension}"

    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.S3_BUCKET,
                'Key': storage_key,
                'ContentType': content_type
            },
            ExpiresIn=3600  # 1 hour for mobile uploads
        )
    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}"
        )

    return {
        "upload_url": presigned_url,
        "media_key": storage_key,
        "expires_in": 3600
    }


@router.post("/upload-url", response_model=MediaUploadUrlResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def request_upload_url(
    request: Request,
    upload_request: MediaUploadUrlRequest,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Generate pre-signed S3 upload URL.

    Creates a media_assets record with 'pending' status and returns
    a pre-signed URL for direct browser-to-S3 upload.

    RBAC:
    - deo_user: Can only upload for their own DEO's projects
    - regional_admin: Can upload for projects in their region
    - super_admin: Can upload for any project

    Rate limited: 30 requests per minute per IP.
    """
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.project_id == upload_request.project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # RBAC check
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot upload media for projects from another DEO"
        )

    # Validate file type
    allowed_types = []
    if upload_request.media_type == 'photo':
        allowed_types = settings.ALLOWED_IMAGE_TYPES
    elif upload_request.media_type == 'video':
        allowed_types = settings.ALLOWED_VIDEO_TYPES
    elif upload_request.media_type == 'document':
        allowed_types = settings.ALLOWED_DOCUMENT_TYPES

    if upload_request.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content type {upload_request.content_type} not allowed for {upload_request.media_type}. Allowed: {allowed_types}"
        )

    # Generate unique storage key
    media_id = uuid.uuid4()
    file_extension = upload_request.filename.split('.')[-1] if '.' in upload_request.filename else ''
    storage_key = f"{upload_request.media_type}s/{upload_request.project_id}/{media_id}.{file_extension}"

    # Generate pre-signed upload URL (expires in 15 minutes)
    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.S3_BUCKET,
                'Key': storage_key,
                'ContentType': upload_request.content_type
            },
            ExpiresIn=900  # 15 minutes
        )
    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}"
        )

    # Create pending media asset record
    new_media = MediaAsset(
        media_id=media_id,
        project_id=upload_request.project_id,
        media_type=upload_request.media_type,
        storage_key=storage_key,
        latitude=upload_request.latitude,
        longitude=upload_request.longitude,
        uploaded_by=current_user.user_id,
        uploaded_at=datetime.utcnow(),
        attributes={
            'filename': upload_request.filename,
            'status': 'pending',
            'content_type': upload_request.content_type
        },
        mime_type=upload_request.content_type
    )

    db.add(new_media)

    # Audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="REQUEST_MEDIA_UPLOAD",
        entity_type="media_asset",
        entity_id=media_id,
        payload={
            "project_id": str(request.project_id),
            "media_type": request.media_type,
            "storage_key": storage_key
        },
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()

    return MediaUploadUrlResponse(
        upload_url=presigned_url,
        storage_key=storage_key,
        media_id=media_id,
        expires_in=900
    )


@router.get("/geotagged", response_model=List[GeotaggedMediaResponse])
async def get_geotagged_media(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    limit: int = Query(default=100, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all geotagged photos for display on map.

    Returns photos that have GPS coordinates (latitude/longitude).
    Applies RBAC filtering based on user role.
    """
    # Base query for confirmed photos with GPS coordinates
    query = db.query(MediaAsset).filter(
        and_(
            MediaAsset.media_type == 'photo',
            MediaAsset.latitude.isnot(None),
            MediaAsset.longitude.isnot(None),
            MediaAsset.attributes['status'].astext == 'confirmed'
        )
    )

    # Filter by project if specified
    if project_id:
        query = query.filter(MediaAsset.project_id == project_id)

    # Note: DEO users can VIEW geotagged media from any project for transparency

    media_assets = query.order_by(MediaAsset.uploaded_at.desc()).limit(limit).all()

    # Build response with project titles and thumbnail URLs
    results = []
    for media in media_assets:
        # Get project title
        project = db.query(Project).filter(Project.project_id == media.project_id).first()
        project_title = project.project_title if project else "Unknown Project"

        # Get filename from attributes
        filename = media.attributes.get('filename') if media.attributes else None

        # Generate thumbnail URL (same as download URL for now)
        try:
            thumbnail_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.S3_BUCKET,
                    'Key': media.storage_key
                },
                ExpiresIn=3600
            )
        except ClientError:
            thumbnail_url = None

        results.append(GeotaggedMediaResponse(
            media_id=media.media_id,
            project_id=media.project_id,
            project_title=project_title,
            latitude=media.latitude,
            longitude=media.longitude,
            thumbnail_url=thumbnail_url,
            filename=filename
        ))

    return results


@router.post("/{media_id}/confirm", response_model=MediaAssetResponse)
async def confirm_upload(
    media_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Confirm that file was successfully uploaded to S3.

    Verifies the file exists in S3 and updates media_assets status to 'confirmed'.
    This endpoint should be called by the client after successful S3 upload.
    """
    media = db.query(MediaAsset).filter(MediaAsset.media_id == media_id).first()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media asset not found"
        )

    # Only uploader or admin can confirm
    if media.uploaded_by != current_user.user_id and current_user.role not in ['regional_admin', 'super_admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the uploader or admins can confirm uploads"
        )

    # Verify file exists in S3
    try:
        s3_response = s3_client.head_object(
            Bucket=settings.S3_BUCKET,
            Key=media.storage_key
        )

        # Update media record with file metadata
        media.file_size = s3_response.get('ContentLength')
        media.attributes['status'] = 'confirmed'
        media.attributes['confirmed_at'] = datetime.utcnow().isoformat()
        # Flag JSONB column as modified so SQLAlchemy detects the change
        flag_modified(media, 'attributes')

        # Generate thumbnail for photos (async in background would be better for production)
        if media.media_type == 'photo':
            try:
                thumbnail_key = generate_and_store_thumbnail(media.storage_key, size=300)
                if thumbnail_key:
                    media.attributes['thumbnail_key'] = thumbnail_key
                    flag_modified(media, 'attributes')
            except Exception as e:
                # Don't fail the confirm if thumbnail generation fails
                print(f"Warning: Thumbnail generation failed: {e}")

    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found in storage: {media.storage_key}"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify upload: {str(e)}"
        )

    # Audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="CONFIRM_MEDIA_UPLOAD",
        entity_type="media_asset",
        entity_id=media_id,
        payload={
            "storage_key": media.storage_key,
            "file_size": media.file_size
        },
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(media)

    # Generate download URL
    download_url = s3_client.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': settings.S3_BUCKET,
            'Key': media.storage_key
        },
        ExpiresIn=3600  # 1 hour
    )

    return MediaAssetResponse(
        media_id=media.media_id,
        project_id=media.project_id,
        media_type=media.media_type,
        storage_key=media.storage_key,
        download_url=download_url,
        latitude=media.latitude,
        longitude=media.longitude,
        captured_at=media.captured_at,
        uploaded_by=media.uploaded_by,
        uploaded_at=media.uploaded_at,
        attributes=media.attributes,
        file_size=media.file_size,
        mime_type=media.mime_type
    )


@router.get("/{media_id}", response_model=MediaAssetResponse)
async def get_media_asset(
    media_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get media asset metadata and download URL.

    Returns media metadata with a pre-signed download URL (valid for 1 hour).
    """
    media = db.query(MediaAsset).filter(MediaAsset.media_id == media_id).first()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media asset not found"
        )

    # RBAC check
    project = db.query(Project).filter(Project.project_id == media.project_id).first()
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this media asset"
        )

    # Generate pre-signed download URL
    try:
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.S3_BUCKET,
                'Key': media.storage_key
            },
            ExpiresIn=3600  # 1 hour
        )
    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {str(e)}"
        )

    return MediaAssetResponse(
        media_id=media.media_id,
        project_id=media.project_id,
        media_type=media.media_type,
        storage_key=media.storage_key,
        download_url=download_url,
        latitude=media.latitude,
        longitude=media.longitude,
        captured_at=media.captured_at,
        uploaded_by=media.uploaded_by,
        uploaded_at=media.uploaded_at,
        attributes=media.attributes,
        file_size=media.file_size,
        mime_type=media.mime_type
    )


@router.get("/projects/{project_id}/media", response_model=List[MediaAssetResponse])
async def get_project_media(
    project_id: UUID,
    media_type: Optional[str] = Query(None, regex=r'^(photo|video|document)$'),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all media assets for a project.

    Returns list of media assets with download URLs.
    Optionally filter by media_type.
    """
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.project_id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Note: DEO users can VIEW media from any project for transparency
    # Edit/delete restrictions are enforced in other endpoints

    # Query media assets
    query = db.query(MediaAsset).filter(MediaAsset.project_id == project_id)

    if media_type:
        query = query.filter(MediaAsset.media_type == media_type)

    # Only return confirmed uploads
    query = query.filter(MediaAsset.attributes['status'].astext == 'confirmed')

    media_assets = query.order_by(MediaAsset.uploaded_at.desc()).limit(limit).all()

    # Generate download URLs for each asset
    results = []
    for media in media_assets:
        try:
            download_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.S3_BUCKET,
                    'Key': media.storage_key
                },
                ExpiresIn=3600
            )
        except ClientError:
            download_url = None

        results.append(MediaAssetResponse(
            media_id=media.media_id,
            project_id=media.project_id,
            media_type=media.media_type,
            storage_key=media.storage_key,
            download_url=download_url,
            latitude=media.latitude,
            longitude=media.longitude,
            captured_at=media.captured_at,
            uploaded_by=media.uploaded_by,
            uploaded_at=media.uploaded_at,
            attributes=media.attributes,
            file_size=media.file_size,
            mime_type=media.mime_type
        ))

    return results


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media_asset(
    media_id: UUID,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Delete media asset from database and S3.

    RBAC: Only uploader or admins can delete.
    """
    media = db.query(MediaAsset).filter(MediaAsset.media_id == media_id).first()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media asset not found"
        )

    # RBAC check
    project = db.query(Project).filter(Project.project_id == media.project_id).first()

    # Only uploader, their DEO admin, regional admin, or super admin can delete
    can_delete = (
        media.uploaded_by == current_user.user_id or
        current_user.role == 'super_admin' or
        (current_user.role == 'regional_admin') or
        (current_user.role == 'deo_user' and project.deo_id == current_user.deo_id)
    )

    if not can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete this media asset"
        )

    # Delete from S3
    try:
        s3_client.delete_object(
            Bucket=settings.S3_BUCKET,
            Key=media.storage_key
        )
    except ClientError as e:
        # Log error but continue with database deletion
        print(f"Warning: Failed to delete from S3: {e}")

    # Audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="DELETE_MEDIA_ASSET",
        entity_type="media_asset",
        entity_id=media_id,
        payload={
            "project_id": str(media.project_id),
            "storage_key": media.storage_key,
            "media_type": media.media_type
        },
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    # Delete from database
    db.delete(media)
    db.commit()

    return None


@router.get("/{media_id}/thumbnail")
async def get_media_thumbnail(
    media_id: UUID,
    size: int = Query(default=300, le=600, ge=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get thumbnail version of a media file.

    Returns a smaller, cached version of the image for efficient loading.
    Thumbnails are generated on-demand and cached.

    Args:
        media_id: Media asset ID
        size: Maximum dimension (50-600, default 300)
    """
    media = db.query(MediaAsset).filter(MediaAsset.media_id == media_id).first()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media asset not found"
        )

    # RBAC check
    project = db.query(Project).filter(Project.project_id == media.project_id).first()
    if current_user.role == "deo_user" and project and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this media asset"
        )

    # Only photos have thumbnails
    if media.media_type != 'photo':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thumbnails are only available for photos"
        )

    try:
        # Get thumbnail (uses cache, generates if needed)
        result = get_thumbnail(media.storage_key, size=size)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to get or generate thumbnail"
            )

        thumbnail_data, content_type = result

        return StreamingResponse(
            io.BytesIO(thumbnail_data),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename=\"thumb_{media.attributes.get('filename', 'file') if media.attributes else 'file'}\"",
                "Cache-Control": "public, max-age=86400"  # Cache for 24 hours
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve thumbnail: {str(e)}"
        )


@router.get("/{media_id}/file")
@limiter.limit("60/hour")
async def get_media_file(
    request: Request,
    media_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Proxy endpoint to stream media file from S3 with caching.

    This endpoint is useful for mobile apps that can't access MinIO directly.
    Returns the actual file content with proper content-type.
    Includes in-memory caching for frequently accessed files.

    Rate limited: 60 requests per hour per IP to control AWS data transfer costs.
    Daily quota: 20 videos, 200 photos, or 500MB total per user per day.
    """
    media = db.query(MediaAsset).filter(MediaAsset.media_id == media_id).first()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media asset not found"
        )

    # RBAC check
    project = db.query(Project).filter(Project.project_id == media.project_id).first()
    if current_user.role == "deo_user" and project and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this media asset"
        )

    # Check daily quota BEFORE downloading from S3
    file_size = media.file_size or 0
    allowed, reason = check_and_update_quota(
        user_id=str(current_user.user_id),
        media_type=media.media_type or "photo",
        file_size=file_size
    )

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=reason
        )

    try:
        # Use cached image retrieval
        result = get_cached_image(media.storage_key)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found in storage"
            )

        image_data, content_type = result
        content_type = media.mime_type or content_type

        return StreamingResponse(
            io.BytesIO(image_data),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename=\"{media.attributes.get('filename', 'file') if media.attributes else 'file'}\"",
                "Cache-Control": "public, max-age=86400"  # Cache for 24 hours
            }
        )
    except HTTPException:
        raise
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found in storage"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve file: {str(e)}"
        )


@router.get("/quota/status")
async def get_quota_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's download quota status.

    Returns remaining downloads and bytes for today.
    Quotas reset at midnight UTC.
    """
    status = get_user_quota_status(str(current_user.user_id))
    return {
        "user_id": str(current_user.user_id),
        "limits": {
            "daily_video_downloads": DAILY_VIDEO_DOWNLOAD_LIMIT,
            "daily_photo_downloads": DAILY_PHOTO_DOWNLOAD_LIMIT,
            "daily_bytes": DAILY_TOTAL_BYTES_LIMIT
        },
        "remaining": status,
        "message": f"You can download {status['video_remaining']} more videos and {status['photo_remaining']} more photos today."
    }


@router.post("/admin/generate-thumbnails")
async def generate_all_thumbnails(
    current_user: User = Depends(require_role(['super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Generate thumbnails for all existing photos that don't have them.

    Admin-only endpoint to backfill thumbnails for photos uploaded before
    thumbnail generation was implemented.
    """
    # Get all confirmed photos
    photos = db.query(MediaAsset).filter(
        and_(
            MediaAsset.media_type == 'photo',
            MediaAsset.attributes['status'].astext == 'confirmed'
        )
    ).all()

    results = {
        "total": len(photos),
        "generated": 0,
        "skipped": 0,
        "failed": 0,
        "errors": []
    }

    for photo in photos:
        # Check if thumbnail already exists
        thumbnail_key = get_thumbnail_key(photo.storage_key, 300)

        try:
            # Check if thumbnail exists in S3
            s3_client.head_object(
                Bucket=settings.S3_BUCKET,
                Key=thumbnail_key
            )
            results["skipped"] += 1
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                # Thumbnail doesn't exist, generate it
                try:
                    generated_key = generate_and_store_thumbnail(photo.storage_key, size=300)
                    if generated_key:
                        # Update media record with thumbnail key
                        if photo.attributes is None:
                            photo.attributes = {}
                        photo.attributes['thumbnail_key'] = generated_key
                        flag_modified(photo, 'attributes')
                        results["generated"] += 1
                    else:
                        results["failed"] += 1
                        results["errors"].append(f"Failed to generate: {photo.storage_key}")
                except Exception as gen_error:
                    results["failed"] += 1
                    results["errors"].append(f"{photo.storage_key}: {str(gen_error)}")
            else:
                results["failed"] += 1
                results["errors"].append(f"S3 error for {photo.storage_key}: {str(e)}")

    db.commit()

    return results
