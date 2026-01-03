"""
Public API Endpoints
Read-only public access for transparency portal (no authentication)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case
from typing import List, Optional
from uuid import UUID
from datetime import date
import json

from ..core.database import get_db
from ..models import Project, DEO, GISFeature, ProjectProgressLog, MediaAsset
from ..schemas import PublicProjectResponse, PublicStatsResponse

router = APIRouter()


@router.get("/projects", response_model=dict)
async def get_public_projects(
    deo_id: Optional[int] = None,
    fund_year: Optional[int] = None,
    status: Optional[str] = Query(None, regex=r'^(planning|ongoing|completed|suspended)$'),
    search: Optional[str] = None,
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
    - limit: Max results (default 50, max 200)
    - offset: Pagination offset
    """
    # Base query - exclude deleted projects
    query = db.query(
        Project,
        DEO.deo_name,
        ProjectProgressLog.reported_percent
    ).join(
        DEO, Project.deo_id == DEO.deo_id
    ).outerjoin(
        ProjectProgressLog,
        and_(
            ProjectProgressLog.project_id == Project.project_id,
            ProjectProgressLog.progress_id.in_(
                db.query(func.max(ProjectProgressLog.progress_id))
                .filter(ProjectProgressLog.project_id == Project.project_id)
                .group_by(ProjectProgressLog.project_id)
            )
        )
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

    # Get total count
    total = query.count()

    # Get paginated results
    results = query.order_by(Project.created_at.desc()).offset(offset).limit(limit).all()

    # Format response
    projects = []
    for project, deo_name, current_progress in results:
        # Get latest progress log date
        latest_log = db.query(ProjectProgressLog).filter(
            ProjectProgressLog.project_id == project.project_id
        ).order_by(ProjectProgressLog.report_date.desc()).first()

        # Get primary GIS feature geometry as WKT
        geometry_wkt = None
        try:
            wkt_result = db.query(func.ST_AsText(GISFeature.geometry)).filter(
                GISFeature.project_id == project.project_id
            ).limit(1).scalar()
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
            "deo_name": deo_name,
            "current_progress": float(current_progress) if current_progress else 0.0,
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
async def get_public_project(
    project_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get public project details.

    Returns full project information with progress history and media count.
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
async def get_public_map_features(
    deo_id: Optional[int] = None,
    feature_type: Optional[str] = None,
    bbox: Optional[str] = Query(None, description="Bounding box: minLon,minLat,maxLon,maxLat"),
    limit: int = Query(default=500, le=2000),
    db: Session = Depends(get_db)
):
    """
    Get GIS features for public map (no authentication).

    Returns GeoJSON FeatureCollection with project info in properties.

    Query parameters:
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


@router.get("/media/{media_id}/thumbnail")
async def get_public_media_thumbnail(
    media_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get media thumbnail URL (for public gallery).

    Returns pre-signed URL for media asset if it belongs to a non-deleted project.
    Only returns confirmed uploads.
    """
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
