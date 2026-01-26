"""
GPS Tracks API Endpoints
RouteShoot track management with video synchronization
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import uuid
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from ..core.database import get_db
from ..core.config import settings
from ..models import GpsTrack, MediaAsset, Project, User
from ..schemas import (
    GpsTrackCreate,
    GpsTrackResponse,
    GpsTrackListResponse
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


def generate_video_url(media: MediaAsset) -> Optional[str]:
    """
    Generate URL for video file through backend proxy.

    Uses the backend's /media/{id}/file endpoint instead of direct S3 URL.
    This provides:
    - Rate limiting (60 downloads/hour per IP)
    - Authentication via JWT
    - Caching
    """
    if not media or not media.media_id:
        return None
    # Return backend proxy URL instead of direct S3 URL
    # This goes through rate limiting and authentication
    return f"{settings.API_BASE_URL}/api/v1/media/{media.media_id}/file"


@router.post("", response_model=GpsTrackResponse, status_code=status.HTTP_201_CREATED)
async def create_gps_track(
    track_data: GpsTrackCreate,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Create a new GPS track.

    RBAC:
    - deo_user: Can only create for their own DEO's projects
    - regional_admin/super_admin: Can create for any project
    """
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.project_id == track_data.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # RBAC check
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create GPS tracks for projects from another DEO"
        )

    # Verify media exists if provided
    if track_data.media_id:
        media = db.query(MediaAsset).filter(MediaAsset.media_id == track_data.media_id).first()
        if not media:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated media not found"
            )
        if media.project_id != track_data.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Media does not belong to the specified project"
            )

    # Convert waypoints to dict format
    waypoints_data = [wp.model_dump() for wp in track_data.waypoints]

    # Create GPS track
    new_track = GpsTrack(
        track_id=uuid.uuid4(),
        project_id=track_data.project_id,
        media_id=track_data.media_id,
        track_name=track_data.track_name,
        waypoints=waypoints_data,
        waypoint_count=len(track_data.waypoints),
        total_distance_meters=track_data.total_distance_meters,
        start_time=track_data.start_time,
        end_time=track_data.end_time,
        kml_storage_key=track_data.kml_storage_key,
        created_by=current_user.user_id,
        created_at=datetime.utcnow()
    )

    db.add(new_track)
    db.commit()
    db.refresh(new_track)

    # Get video URL if media associated
    video_url = None
    if new_track.media_id:
        media = db.query(MediaAsset).filter(MediaAsset.media_id == new_track.media_id).first()
        video_url = generate_video_url(media)

    return GpsTrackResponse(
        track_id=new_track.track_id,
        project_id=new_track.project_id,
        media_id=new_track.media_id,
        track_name=new_track.track_name,
        waypoints=new_track.waypoints,
        waypoint_count=new_track.waypoint_count,
        total_distance_meters=float(new_track.total_distance_meters) if new_track.total_distance_meters else None,
        start_time=new_track.start_time,
        end_time=new_track.end_time,
        kml_storage_key=new_track.kml_storage_key,
        video_url=video_url,
        created_by=new_track.created_by,
        created_at=new_track.created_at
    )


@router.get("/project/{project_id}", response_model=List[GpsTrackResponse])
async def get_project_gps_tracks(
    project_id: UUID,
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all GPS tracks for a project.

    Returns tracks with presigned video URLs if associated.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Query tracks
    tracks = db.query(GpsTrack).filter(
        GpsTrack.project_id == project_id
    ).order_by(GpsTrack.created_at.desc()).limit(limit).all()

    # Build response with video URLs
    results = []
    for track in tracks:
        video_url = None
        if track.media_id:
            media = db.query(MediaAsset).filter(MediaAsset.media_id == track.media_id).first()
            video_url = generate_video_url(media)

        results.append(GpsTrackResponse(
            track_id=track.track_id,
            project_id=track.project_id,
            media_id=track.media_id,
            track_name=track.track_name,
            waypoints=track.waypoints,
            waypoint_count=track.waypoint_count,
            total_distance_meters=float(track.total_distance_meters) if track.total_distance_meters else None,
            start_time=track.start_time,
            end_time=track.end_time,
            kml_storage_key=track.kml_storage_key,
            video_url=video_url,
            created_by=track.created_by,
            created_at=track.created_at
        ))

    return results


@router.get("/{track_id}", response_model=GpsTrackResponse)
async def get_gps_track(
    track_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a single GPS track by ID.

    Returns track with presigned video URL if associated.
    """
    track = db.query(GpsTrack).filter(GpsTrack.track_id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GPS track not found"
        )

    # Get video URL if media associated
    video_url = None
    if track.media_id:
        media = db.query(MediaAsset).filter(MediaAsset.media_id == track.media_id).first()
        video_url = generate_video_url(media)

    return GpsTrackResponse(
        track_id=track.track_id,
        project_id=track.project_id,
        media_id=track.media_id,
        track_name=track.track_name,
        waypoints=track.waypoints,
        waypoint_count=track.waypoint_count,
        total_distance_meters=float(track.total_distance_meters) if track.total_distance_meters else None,
        start_time=track.start_time,
        end_time=track.end_time,
        kml_storage_key=track.kml_storage_key,
        video_url=video_url,
        created_by=track.created_by,
        created_at=track.created_at
    )


@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gps_track(
    track_id: UUID,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Delete a GPS track.

    RBAC: Only creator, DEO admins, or super admins can delete.
    """
    track = db.query(GpsTrack).filter(GpsTrack.track_id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GPS track not found"
        )

    # RBAC check
    project = db.query(Project).filter(Project.project_id == track.project_id).first()
    can_delete = (
        track.created_by == current_user.user_id or
        current_user.role == 'super_admin' or
        current_user.role == 'regional_admin' or
        (current_user.role == 'deo_user' and project and project.deo_id == current_user.deo_id)
    )

    if not can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete this GPS track"
        )

    # Delete KML from S3 if exists
    if track.kml_storage_key:
        try:
            s3_client.delete_object(
                Bucket=settings.S3_BUCKET,
                Key=track.kml_storage_key
            )
        except ClientError:
            pass  # Log but don't fail

    db.delete(track)
    db.commit()

    return None
