"""
Media API Endpoints
S3 pre-signed URLs for file upload, storage metadata
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
import uuid
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from ..core.database import get_db
from ..core.config import settings
from ..models import Project, MediaAsset, User, AuditLog
from ..schemas import (
    MediaUploadUrlRequest,
    MediaUploadUrlResponse,
    MediaAssetResponse
)
from ..api.auth import get_current_user, require_role

router = APIRouter()

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


@router.post("/upload-url", response_model=MediaUploadUrlResponse, status_code=status.HTTP_201_CREATED)
async def request_upload_url(
    request: MediaUploadUrlRequest,
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
    """
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.project_id == request.project_id).first()

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
    if request.media_type == 'photo':
        allowed_types = settings.ALLOWED_IMAGE_TYPES
    elif request.media_type == 'video':
        allowed_types = settings.ALLOWED_VIDEO_TYPES
    elif request.media_type == 'document':
        allowed_types = settings.ALLOWED_DOCUMENT_TYPES

    if request.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content type {request.content_type} not allowed for {request.media_type}. Allowed: {allowed_types}"
        )

    # Generate unique storage key
    media_id = uuid.uuid4()
    file_extension = request.filename.split('.')[-1] if '.' in request.filename else ''
    storage_key = f"{request.media_type}s/{request.project_id}/{media_id}.{file_extension}"

    # Generate pre-signed upload URL (expires in 15 minutes)
    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.S3_BUCKET,
                'Key': storage_key,
                'ContentType': request.content_type
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
        project_id=request.project_id,
        media_type=request.media_type,
        storage_key=storage_key,
        latitude=request.latitude,
        longitude=request.longitude,
        uploaded_by=current_user.user_id,
        uploaded_at=datetime.utcnow(),
        attributes={
            'filename': request.filename,
            'status': 'pending',
            'content_type': request.content_type
        },
        mime_type=request.content_type
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

    # RBAC check
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this project"
        )

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
