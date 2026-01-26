"""
Public API Endpoints
Read-only public access for transparency portal (no authentication)
"""

import io
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case
from typing import List, Optional, Dict
from uuid import UUID
from datetime import date
from collections import defaultdict
import threading
import json

from ..core.database import get_db
from ..models import Project, DEO, GISFeature, ProjectProgressLog, MediaAsset
from ..schemas import PublicProjectResponse, PublicStatsResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# =============================================================================
# IP-Based Download Quota System for Public Endpoints
# Prevents abuse from unauthenticated users
# =============================================================================

# Configuration - stricter limits for public/anonymous access
PUBLIC_DAILY_VIDEO_LIMIT = 10  # Max videos per IP per day
PUBLIC_DAILY_PHOTO_LIMIT = 100  # Max photos per IP per day
PUBLIC_DAILY_BYTES_LIMIT = 200 * 1024 * 1024  # 200MB per IP per day
PUBLIC_HOURLY_REQUEST_LIMIT = 300  # Max requests per IP per hour (spam prevention)

# In-memory storage keyed by IP
# Structure: {ip: {"date": date, "video_count": int, "photo_count": int, "bytes": int, "hourly_requests": int, "hour": int}}
_public_quota: Dict[str, dict] = defaultdict(lambda: {
    "date": None, "video_count": 0, "photo_count": 0, "bytes": 0,
    "hour": None, "hourly_requests": 0
})
_public_quota_lock = threading.Lock()


def get_client_ip(request: Request) -> str:
    """Extract real client IP, handling proxies."""
    # Check X-Forwarded-For header (set by reverse proxies)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # First IP in the list is the original client
        return forwarded.split(",")[0].strip()
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    # Fallback to direct client IP
    return request.client.host if request.client else "unknown"


def check_public_quota(request: Request, media_type: str, file_size: int) -> tuple[bool, str]:
    """
    Check if IP has remaining quota for public downloads.
    Also enforces hourly request limit to prevent spam.

    Returns: (allowed: bool, reason: str)
    """
    ip = get_client_ip(request)

    with _public_quota_lock:
        today = date.today()
        current_hour = date.today().toordinal() * 24 + __import__('datetime').datetime.now().hour
        quota = _public_quota[ip]

        # Reset daily quota if new day
        if quota["date"] != today:
            quota["date"] = today
            quota["video_count"] = 0
            quota["photo_count"] = 0
            quota["bytes"] = 0

        # Reset hourly counter if new hour
        if quota["hour"] != current_hour:
            quota["hour"] = current_hour
            quota["hourly_requests"] = 0

        # Check hourly spam limit FIRST
        if quota["hourly_requests"] >= PUBLIC_HOURLY_REQUEST_LIMIT:
            return False, f"Too many requests. Please wait until the next hour. (Limit: {PUBLIC_HOURLY_REQUEST_LIMIT}/hour)"

        # Check byte limit
        if quota["bytes"] + file_size > PUBLIC_DAILY_BYTES_LIMIT:
            remaining_mb = (PUBLIC_DAILY_BYTES_LIMIT - quota["bytes"]) / (1024 * 1024)
            return False, f"Daily download limit reached (200MB for public access). Remaining: {remaining_mb:.1f}MB."

        # Check count limit based on media type
        if media_type == "video":
            if quota["video_count"] >= PUBLIC_DAILY_VIDEO_LIMIT:
                return False, f"Daily video limit reached ({PUBLIC_DAILY_VIDEO_LIMIT} videos for public access)."
            quota["video_count"] += 1
        else:
            if quota["photo_count"] >= PUBLIC_DAILY_PHOTO_LIMIT:
                return False, f"Daily photo limit reached ({PUBLIC_DAILY_PHOTO_LIMIT} photos for public access)."
            quota["photo_count"] += 1

        # Update counters
        quota["bytes"] += file_size
        quota["hourly_requests"] += 1

        return True, "OK"


def increment_hourly_request(request: Request):
    """Increment hourly request counter without checking quota (for non-download requests)."""
    ip = get_client_ip(request)

    with _public_quota_lock:
        current_hour = date.today().toordinal() * 24 + __import__('datetime').datetime.now().hour
        quota = _public_quota[ip]

        if quota["hour"] != current_hour:
            quota["hour"] = current_hour
            quota["hourly_requests"] = 0

        quota["hourly_requests"] += 1


@router.get("/quota/status")
async def get_public_quota_status(request: Request):
    """
    Get current IP's download quota status (no authentication).

    Returns remaining downloads for today. Quotas reset at midnight UTC.
    """
    ip = get_client_ip(request)

    with _public_quota_lock:
        today = date.today()
        current_hour = date.today().toordinal() * 24 + __import__('datetime').datetime.now().hour
        quota = _public_quota[ip]

        # Calculate remaining based on current state
        if quota["date"] != today:
            video_remaining = PUBLIC_DAILY_VIDEO_LIMIT
            photo_remaining = PUBLIC_DAILY_PHOTO_LIMIT
            bytes_remaining = PUBLIC_DAILY_BYTES_LIMIT
        else:
            video_remaining = PUBLIC_DAILY_VIDEO_LIMIT - quota["video_count"]
            photo_remaining = PUBLIC_DAILY_PHOTO_LIMIT - quota["photo_count"]
            bytes_remaining = PUBLIC_DAILY_BYTES_LIMIT - quota["bytes"]

        if quota["hour"] != current_hour:
            hourly_remaining = PUBLIC_HOURLY_REQUEST_LIMIT
        else:
            hourly_remaining = PUBLIC_HOURLY_REQUEST_LIMIT - quota["hourly_requests"]

    return {
        "ip": ip[:10] + "..." if len(ip) > 10 else ip,  # Partially mask IP
        "limits": {
            "daily_video_downloads": PUBLIC_DAILY_VIDEO_LIMIT,
            "daily_photo_downloads": PUBLIC_DAILY_PHOTO_LIMIT,
            "daily_bytes": PUBLIC_DAILY_BYTES_LIMIT,
            "hourly_requests": PUBLIC_HOURLY_REQUEST_LIMIT
        },
        "remaining": {
            "video_remaining": max(0, video_remaining),
            "photo_remaining": max(0, photo_remaining),
            "bytes_remaining": max(0, bytes_remaining),
            "hourly_requests_remaining": max(0, hourly_remaining)
        },
        "resets_at": "midnight UTC (daily) / top of hour (hourly)"
    }


@router.get("/projects", response_model=dict)
@limiter.limit("60/minute")
async def get_public_projects(
    request: Request,
    deo_id: Optional[int] = None,
    fund_year: Optional[int] = None,
    status: Optional[str] = Query(None, regex=r'^(planning|ongoing|completed|suspended)$'),
    search: Optional[str] = None,
    province: Optional[str] = None,
    fund_source: Optional[str] = None,
    mode_of_implementation: Optional[str] = None,
    project_scale: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get public project list (no authentication).

    Returns sanitized project information for transparency portal.
    Excludes soft-deleted projects.

    Query parameters:
    - deo_id: Filter by DEO
    - fund_year: Filter by funding year
    - status: Filter by status (excludes 'deleted')
    - search: Text search in project title or location
    - province: Filter by province (via DEO)
    - fund_source: Filter by fund source
    - mode_of_implementation: Filter by mode of implementation
    - project_scale: Filter by project scale
    - limit: Max results (default 50, max 200)
    - offset: Pagination offset
    """
    # Simple base query - just projects with DEO join
    query = db.query(Project, DEO.deo_name).join(
        DEO, Project.deo_id == DEO.deo_id
    ).filter(
        Project.status != 'deleted'
    )

    # Filters
    if deo_id:
        query = query.filter(Project.deo_id == deo_id)

    if fund_year:
        query = query.filter(Project.fund_year == fund_year)

    if status:
        query = query.filter(Project.status == status)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Project.project_title.ilike(search_term)) |
            (Project.location.ilike(search_term))
        )

    if province:
        query = query.filter(DEO.province == province)

    if fund_source:
        query = query.filter(Project.fund_source == fund_source)

    if mode_of_implementation:
        query = query.filter(Project.mode_of_implementation == mode_of_implementation)

    if project_scale:
        query = query.filter(Project.project_scale == project_scale)

    # Get total count (simpler query without complex subquery)
    total = query.count()

    # Get paginated results
    results = query.order_by(Project.created_at.desc()).offset(offset).limit(limit).all()

    # Format response
    projects = []
    for project, deo_name in results:
        # Get latest progress log
        latest_log = db.query(ProjectProgressLog).filter(
            ProjectProgressLog.project_id == project.project_id
        ).order_by(ProjectProgressLog.report_date.desc()).first()

        current_progress = float(latest_log.reported_percent) if latest_log else 0.0

        # Get all GIS feature geometries combined as WKT
        geometry_wkt = None
        try:
            # Use ST_Collect to combine all geometries for this project
            wkt_result = db.query(
                func.ST_AsText(func.ST_Collect(GISFeature.geometry))
            ).filter(
                GISFeature.project_id == project.project_id
            ).scalar()
            if wkt_result:
                geometry_wkt = wkt_result
        except Exception:
            # Geometry query failed, leave as None
            pass

        projects.append({
            "project_id": str(project.project_id),
            "project_title": project.project_title,
            "location": project.location,
            "fund_source": project.fund_source,
            "project_cost": float(project.project_cost) if project.project_cost else 0.0,
            "fund_year": project.fund_year,
            "status": project.status,
            "deo_id": project.deo_id,
            "deo_name": deo_name,
            "current_progress": current_progress,
            "last_updated": latest_log.report_date if latest_log else None,
            "geometry_wkt": geometry_wkt
        })

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": projects
    }


@router.get("/projects/{project_id}")
@limiter.limit("120/minute")
async def get_public_project(
    request: Request,
    project_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get public project details.

    Returns full project information with progress history and media count.

    Rate limited: 120 requests per minute per IP.
    """
    project = db.query(Project).filter(
        Project.project_id == project_id,
        Project.status != 'deleted'
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    # Get DEO name
    deo = db.query(DEO).filter(DEO.deo_id == project.deo_id).first()

    # Get progress history
    progress_logs = db.query(ProjectProgressLog).filter(
        ProjectProgressLog.project_id == project_id
    ).order_by(ProjectProgressLog.report_date.asc()).all()

    progress_history = [{
        "report_date": log.report_date,
        "reported_percent": float(log.reported_percent),
        "remarks": log.remarks
    } for log in progress_logs]

    # Get media counts
    media_counts = db.query(
        MediaAsset.media_type,
        func.count(MediaAsset.media_id).label('count')
    ).filter(
        MediaAsset.project_id == project_id,
        MediaAsset.attributes['status'].astext == 'confirmed'
    ).group_by(MediaAsset.media_type).all()

    media_summary = {media_type: count for media_type, count in media_counts}

    # Get GIS feature count
    gis_count = db.query(func.count(GISFeature.feature_id)).filter(
        GISFeature.project_id == project_id
    ).scalar()

    # Get current progress
    latest_log = progress_logs[-1] if progress_logs else None

    return {
        "project_id": str(project.project_id),
        "project_title": project.project_title,
        "location": project.location,
        "fund_source": project.fund_source,
        "mode_of_implementation": project.mode_of_implementation,
        "project_cost": float(project.project_cost) if project.project_cost else 0.0,
        "project_scale": project.project_scale,
        "fund_year": project.fund_year,
        "status": project.status,
        "deo_name": deo.deo_name if deo else None,
        "current_progress": float(latest_log.reported_percent) if latest_log else 0.0,
        "last_updated": latest_log.report_date if latest_log else None,
        "progress_history": progress_history,
        "media_counts": media_summary,
        "gis_feature_count": gis_count,
        "created_at": project.created_at
    }


@router.get("/map")
@limiter.limit("60/minute")
async def get_public_map_features(
    request: Request,
    project_id: Optional[UUID] = None,
    deo_id: Optional[int] = None,
    feature_type: Optional[str] = None,
    bbox: Optional[str] = Query(None, description="Bounding box: minLon,minLat,maxLon,maxLat"),
    limit: int = Query(default=500, le=2000),
    db: Session = Depends(get_db)
):
    """
    Get GIS features for public map (no authentication).

    Returns GeoJSON FeatureCollection with project info in properties.

    Rate limited: 60 requests per minute per IP.

    Query parameters:
    - project_id: Filter by specific project
    - deo_id: Filter by DEO
    - feature_type: Filter by type (road, bridge, etc.)
    - bbox: Bounding box filter
    - limit: Max features (default 500, max 2000)
    """
    # Join GIS features with projects to filter by DEO and exclude deleted
    query = db.query(GISFeature).join(
        Project, GISFeature.project_id == Project.project_id
    ).filter(
        Project.status != 'deleted'
    )

    # Filters
    if project_id:
        query = query.filter(GISFeature.project_id == project_id)

    if deo_id:
        query = query.filter(Project.deo_id == deo_id)

    if feature_type:
        query = query.filter(GISFeature.feature_type == feature_type)

    # Bounding box filter
    if bbox:
        try:
            coords = [float(x) for x in bbox.split(',')]
            if len(coords) != 4:
                raise ValueError()

            min_lon, min_lat, max_lon, max_lat = coords
            bbox_polygon = f'POLYGON(({min_lon} {min_lat},{max_lon} {min_lat},{max_lon} {max_lat},{min_lon} {max_lat},{min_lon} {min_lat}))'

            query = query.filter(
                func.ST_Intersects(
                    GISFeature.geometry,
                    func.ST_GeomFromText(bbox_polygon, 4326)
                )
            )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid bbox format. Use: minLon,minLat,maxLon,maxLat"
            )

    # Get features
    features = query.limit(limit).all()

    # Convert to GeoJSON FeatureCollection
    geojson_features = []

    for feature in features:
        # Get project info
        project = db.query(Project).filter(Project.project_id == feature.project_id).first()

        # Get geometry as GeoJSON
        geom_json = db.query(
            func.ST_AsGeoJSON(GISFeature.geometry)
        ).filter(GISFeature.feature_id == feature.feature_id).scalar()

        geojson_features.append({
            "type": "Feature",
            "id": str(feature.feature_id),
            "geometry": json.loads(geom_json) if geom_json else None,
            "properties": {
                "feature_type": feature.feature_type,
                "project_id": str(feature.project_id),
                "project_title": project.project_title if project else None,
                "location": project.location if project else None,
                "attributes": feature.attributes,
                "created_at": feature.created_at.isoformat()
            }
        })

    return {
        "type": "FeatureCollection",
        "features": geojson_features,
        "count": len(geojson_features)
    }


@router.get("/stats", response_model=PublicStatsResponse)
async def get_public_statistics(
    db: Session = Depends(get_db)
):
    """
    Get public statistics for dashboard.

    Returns aggregated statistics:
    - Total projects (excluding deleted)
    - Total project cost
    - Projects by province/DEO
    - Projects by status
    - Average completion percentage
    """
    # Total projects (excluding deleted)
    total_projects = db.query(func.count(Project.project_id)).filter(
        Project.status != 'deleted'
    ).scalar()

    # Total cost
    total_cost = db.query(func.sum(Project.project_cost)).filter(
        Project.status != 'deleted'
    ).scalar() or 0.0

    # Projects by DEO/province
    by_province = {}
    deo_stats = db.query(
        DEO.deo_name,
        func.count(Project.project_id).label('count')
    ).join(
        Project, DEO.deo_id == Project.deo_id
    ).filter(
        Project.status != 'deleted'
    ).group_by(DEO.deo_name).all()

    for deo_name, count in deo_stats:
        by_province[deo_name] = count

    # Projects by status
    by_status = {}
    status_stats = db.query(
        Project.status,
        func.count(Project.project_id).label('count')
    ).filter(
        Project.status != 'deleted'
    ).group_by(Project.status).all()

    for status, count in status_stats:
        by_status[status] = count

    # Average completion (from latest progress logs)
    avg_completion_query = db.query(
        func.avg(
            db.query(ProjectProgressLog.reported_percent)
            .filter(ProjectProgressLog.project_id == Project.project_id)
            .order_by(ProjectProgressLog.created_at.desc())
            .limit(1)
            .correlate(Project)
            .scalar_subquery()
        )
    ).filter(
        Project.status != 'deleted'
    ).scalar()

    avg_completion = float(avg_completion_query) if avg_completion_query else 0.0

    return PublicStatsResponse(
        total_projects=total_projects,
        total_cost=float(total_cost),
        by_province=by_province,
        by_status=by_status,
        avg_completion=avg_completion
    )


@router.get("/filter-options")
async def get_filter_options(
    db: Session = Depends(get_db)
):
    """
    Get all filter options for dashboard.

    Returns available values for:
    - deos: List of DEOs with project counts
    - provinces: List of unique provinces
    - statuses: List of valid project statuses
    - fund_years: List of years with projects
    - fund_sources: List of unique fund sources
    - modes_of_implementation: List of unique implementation modes
    - project_scales: List of unique project scales
    """
    # Get DEOs with project counts
    deos = db.query(
        DEO.deo_id,
        DEO.deo_name,
        DEO.province,
        func.count(Project.project_id).label('project_count')
    ).outerjoin(
        Project,
        and_(
            DEO.deo_id == Project.deo_id,
            Project.status != 'deleted'
        )
    ).group_by(
        DEO.deo_id,
        DEO.deo_name,
        DEO.province
    ).all()

    deos_list = [{
        "deo_id": deo_id,
        "deo_name": deo_name,
        "province": province,
        "project_count": project_count
    } for deo_id, deo_name, province, project_count in deos]

    # Get unique provinces
    provinces = db.query(DEO.province).distinct().order_by(DEO.province).all()
    provinces_list = [p[0] for p in provinces if p[0]]

    # Valid statuses (excluding deleted and cancelled for public)
    statuses = ['planning', 'ongoing', 'completed', 'suspended']

    # Get unique fund years from projects
    fund_years = db.query(Project.fund_year).filter(
        Project.status != 'deleted',
        Project.fund_year.isnot(None)
    ).distinct().order_by(Project.fund_year.desc()).all()
    fund_years_list = [y[0] for y in fund_years if y[0]]

    # Get unique fund sources
    fund_sources = db.query(Project.fund_source).filter(
        Project.status != 'deleted',
        Project.fund_source.isnot(None),
        Project.fund_source != ''
    ).distinct().order_by(Project.fund_source).all()
    fund_sources_list = [f[0] for f in fund_sources if f[0]]

    # Get unique modes of implementation
    modes = db.query(Project.mode_of_implementation).filter(
        Project.status != 'deleted',
        Project.mode_of_implementation.isnot(None),
        Project.mode_of_implementation != ''
    ).distinct().order_by(Project.mode_of_implementation).all()
    modes_list = [m[0] for m in modes if m[0]]

    # Get unique project scales
    scales = db.query(Project.project_scale).filter(
        Project.status != 'deleted',
        Project.project_scale.isnot(None),
        Project.project_scale != ''
    ).distinct().order_by(Project.project_scale).all()
    scales_list = [s[0] for s in scales if s[0]]

    return {
        "deos": deos_list,
        "provinces": provinces_list,
        "statuses": statuses,
        "fund_years": fund_years_list,
        "fund_sources": fund_sources_list,
        "modes_of_implementation": modes_list,
        "project_scales": scales_list
    }


@router.get("/deos")
async def get_public_deos(
    db: Session = Depends(get_db)
):
    """
    Get list of DEOs with project counts.

    Returns all DEOs with their project counts (excluding deleted projects).
    """
    deos = db.query(
        DEO.deo_id,
        DEO.deo_name,
        DEO.province,
        func.count(Project.project_id).label('project_count')
    ).outerjoin(
        Project,
        and_(
            DEO.deo_id == Project.deo_id,
            Project.status != 'deleted'
        )
    ).group_by(
        DEO.deo_id,
        DEO.deo_name,
        DEO.province
    ).all()

    return {
        "deos": [{
            "deo_id": deo_id,
            "deo_name": deo_name,
            "province": province,
            "project_count": project_count
        } for deo_id, deo_name, province, project_count in deos]
    }


@router.get("/geotagged-media")
async def get_public_geotagged_media(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db)
):
    """
    Get all geotagged photos for public map display (no authentication).

    Returns photos that have GPS coordinates (latitude/longitude).
    Only returns confirmed uploads from non-deleted projects.
    """
    from ..api.media import s3_client
    from ..core.config import settings
    from botocore.exceptions import ClientError

    # Base query for confirmed photos with GPS coordinates
    query = db.query(MediaAsset).join(
        Project, MediaAsset.project_id == Project.project_id
    ).filter(
        and_(
            MediaAsset.media_type == 'photo',
            MediaAsset.latitude.isnot(None),
            MediaAsset.longitude.isnot(None),
            MediaAsset.attributes['status'].astext == 'confirmed',
            Project.status != 'deleted'
        )
    )

    # Filter by project if specified
    if project_id:
        query = query.filter(MediaAsset.project_id == project_id)

    media_assets = query.order_by(MediaAsset.uploaded_at.desc()).limit(limit).all()

    # Build response with project titles
    results = []
    for media in media_assets:
        # Get project title
        project = db.query(Project).filter(Project.project_id == media.project_id).first()
        project_title = project.project_title if project else "Unknown Project"

        # Get filename from attributes
        filename = media.attributes.get('filename') if media.attributes else None

        # Generate thumbnail URL using public endpoint
        thumbnail_url = f"/api/v1/public/media/{media.media_id}/file"

        results.append({
            "media_id": str(media.media_id),
            "project_id": str(media.project_id),
            "project_title": project_title,
            "latitude": media.latitude,
            "longitude": media.longitude,
            "thumbnail_url": thumbnail_url,
            "filename": filename
        })

    return results


@router.get("/media/{media_id}/thumbnail")
@limiter.limit("60/minute")  # Rate limit URL generation
async def get_public_media_thumbnail(
    request: Request,
    media_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get media thumbnail URL (for public gallery).

    Returns pre-signed URL for media asset if it belongs to a non-deleted project.
    Only returns confirmed uploads.

    Note: This returns a presigned S3 URL. The actual download from S3 is not
    quota-controlled. Use /media/{id}/file endpoint for quota-controlled access.
    """
    # Increment hourly request counter for spam prevention
    increment_hourly_request(request)
    # Import boto3 client from media API
    from ..api.media import s3_client
    from ..core.config import settings
    from botocore.exceptions import ClientError

    media = db.query(MediaAsset).filter(MediaAsset.media_id == media_id).first()

    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    # Check if project is public (not deleted)
    project = db.query(Project).filter(Project.project_id == media.project_id).first()
    if not project or project.status == 'deleted':
        raise HTTPException(status_code=404, detail="Media not found")

    # Check if upload is confirmed
    if media.attributes.get('status') != 'confirmed':
        raise HTTPException(status_code=404, detail="Media not available")

    # Generate pre-signed URL
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
            status_code=500,
            detail=f"Failed to generate download URL: {str(e)}"
        )

    return {
        "media_id": str(media.media_id),
        "media_type": media.media_type,
        "download_url": download_url,
        "project_id": str(media.project_id)
    }


@router.get("/media/{media_id}/file")
@limiter.limit("30/minute")  # Stricter rate limit for file downloads
async def get_public_media_file(
    request: Request,
    media_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Stream media file publicly (no authentication).

    Returns the actual file content for confirmed uploads from non-deleted projects.
    Used by the public transparency portal to display images.

    Rate limited: 30 requests per minute per IP.
    Daily quota: 10 videos, 100 photos, 200MB total per IP.
    Hourly spam limit: 300 requests per IP.
    """
    from ..api.media import s3_client
    from ..core.config import settings
    from ..services.thumbnail_service import get_cached_image
    from botocore.exceptions import ClientError

    media = db.query(MediaAsset).filter(MediaAsset.media_id == media_id).first()

    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    # Check if project is public (not deleted)
    project = db.query(Project).filter(Project.project_id == media.project_id).first()
    if not project or project.status == 'deleted':
        raise HTTPException(status_code=404, detail="Media not found")

    # Check if upload is confirmed
    if not media.attributes or media.attributes.get('status') != 'confirmed':
        raise HTTPException(status_code=404, detail="Media not available")

    # Check IP-based quota BEFORE fetching from S3
    file_size = media.file_size or 0
    allowed, reason = check_public_quota(
        request=request,
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
                status_code=404,
                detail="File not found in storage"
            )

        image_data, content_type = result
        content_type = media.mime_type or content_type

        return StreamingResponse(
            io.BytesIO(image_data),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename=\"{media.attributes.get('filename', 'file') if media.attributes else 'file'}\"",
                "Cache-Control": "public, max-age=3600"  # Cache for 1 hour
            }
        )
    except HTTPException:
        raise
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            raise HTTPException(
                status_code=404,
                detail="File not found in storage"
            )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve file: {str(e)}"
        )


@router.get("/projects/{project_id}/media")
async def get_public_project_media(
    project_id: UUID,
    media_type: Optional[str] = Query(None, regex=r'^(photo|video|document)$'),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db)
):
    """
    Get all media assets for a project (public, no authentication).

    Returns list of media assets with download URLs for confirmed uploads.
    """
    from ..api.media import s3_client
    from ..core.config import settings
    from botocore.exceptions import ClientError

    # Verify project exists and is not deleted
    project = db.query(Project).filter(
        Project.project_id == project_id,
        Project.status != 'deleted'
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
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

        results.append({
            "media_id": str(media.media_id),
            "project_id": str(media.project_id),
            "media_type": media.media_type,
            "download_url": download_url,
            "latitude": media.latitude,
            "longitude": media.longitude,
            "uploaded_at": media.uploaded_at,
            "filename": media.attributes.get('filename') if media.attributes else None,
            "file_size": media.file_size,
            "mime_type": media.mime_type
        })

    return {
        "items": results,
        "total": len(results)
    }
