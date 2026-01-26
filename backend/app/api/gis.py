"""
GIS API Endpoints
PostGIS spatial operations, vector tiles
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import uuid
import json

from ..core.database import get_db
from ..models import Project, GISFeature, User, AuditLog, GeofencingRule, Alert
from ..schemas import (
    GISFeatureCreate,
    GISFeatureUpdate,
    GISFeatureResponse
)
from ..api.auth import get_current_user, require_role
from geoalchemy2.functions import ST_GeomFromGeoJSON, ST_AsGeoJSON, ST_IsValid, ST_Within, ST_AsMVT, ST_AsMVTGeom, ST_TileEnvelope

router = APIRouter()


@router.post("/features", response_model=GISFeatureResponse, status_code=status.HTTP_201_CREATED)
async def create_gis_feature(
    feature: GISFeatureCreate,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Create GIS feature with PostGIS geometry.

    Accepts GeoJSON geometry and stores in PostGIS.
    Validates geometry and checks geofencing rules.

    RBAC:
    - deo_user: Can only create for their own DEO's projects
    - regional_admin: Can create for projects in their region
    - super_admin: Can create for any project
    """
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.project_id == feature.project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # RBAC check
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create GIS features for projects from another DEO"
        )

    # Convert GeoJSON to PostGIS geometry
    geom_geojson = json.dumps(feature.geometry)

    # Validate geometry
    is_valid = db.query(func.ST_IsValid(func.ST_GeomFromGeoJSON(geom_geojson))).scalar()

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid geometry. GeoJSON geometry is malformed."
        )

    # Check geofencing rules
    boundary = db.query(GeofencingRule).filter(
        GeofencingRule.rule_type == 'region_boundary',
        GeofencingRule.is_active == True,
        GeofencingRule.project_id.is_(None)
    ).first()

    if boundary:
        within_bounds = db.query(
            func.ST_Within(
                func.ST_GeomFromGeoJSON(geom_geojson),
                boundary.geometry
            )
        ).scalar()

        if not within_bounds:
            # Create alert but don't block
            alert = Alert(
                alert_id=uuid.uuid4(),
                project_id=feature.project_id,
                alert_type='geofence_violation',
                severity='warning',
                message='GIS feature is outside BARMM region boundary',
                alert_metadata={
                    'feature_type': feature.feature_type,
                    'created_by': str(current_user.user_id)
                },
                triggered_at=datetime.utcnow()
            )
            db.add(alert)

    # Create feature
    feature_id = uuid.uuid4()
    new_feature = GISFeature(
        feature_id=feature_id,
        project_id=feature.project_id,
        feature_type=feature.feature_type,
        geometry=geom_geojson,  # GeoAlchemy2 handles conversion
        attributes=feature.attributes or {},
        created_by=current_user.user_id,
        created_at=datetime.utcnow()
    )

    db.add(new_feature)

    # Audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="CREATE_GIS_FEATURE",
        entity_type="gis_feature",
        entity_id=feature_id,
        payload={
            "project_id": str(feature.project_id),
            "feature_type": feature.feature_type,
            "geometry_type": feature.geometry.get('type')
        },
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(new_feature)

    # Return with GeoJSON geometry
    return GISFeatureResponse(
        feature_id=new_feature.feature_id,
        project_id=new_feature.project_id,
        feature_type=new_feature.feature_type,
        geometry=feature.geometry,
        attributes=new_feature.attributes,
        created_by=new_feature.created_by,
        created_at=new_feature.created_at,
        updated_at=new_feature.updated_at
    )


@router.get("/features", response_model=dict)
async def get_gis_features(
    project_id: Optional[UUID] = None,
    feature_type: Optional[str] = None,
    bbox: Optional[str] = Query(None, description="Bounding box: minLon,minLat,maxLon,maxLat"),
    limit: int = Query(default=100, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Query GIS features with spatial filters.

    Returns GeoJSON FeatureCollection.

    Query parameters:
    - project_id: Filter by project
    - feature_type: Filter by type (road, bridge, etc.)
    - bbox: Bounding box filter (minLon,minLat,maxLon,maxLat)
    - limit: Max results (default 100, max 1000)
    """
    query = db.query(GISFeature)

    # Filter by project
    if project_id:
        query = query.filter(GISFeature.project_id == project_id)

    # Filter by feature type
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
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid bbox format. Use: minLon,minLat,maxLon,maxLat"
            )

    # Get features
    features = query.limit(limit).all()

    # Convert to GeoJSON FeatureCollection
    geojson_features = []

    for feature in features:
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
                "attributes": feature.attributes,
                "created_at": feature.created_at.isoformat()
            }
        })

    return {
        "type": "FeatureCollection",
        "features": geojson_features
    }


@router.get("/features/{feature_id}", response_model=GISFeatureResponse)
async def get_gis_feature(
    feature_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get GIS feature by ID"""
    feature = db.query(GISFeature).filter(GISFeature.feature_id == feature_id).first()

    if not feature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GIS feature not found"
        )

    # Get geometry as GeoJSON
    geom_json = db.query(
        func.ST_AsGeoJSON(GISFeature.geometry)
    ).filter(GISFeature.feature_id == feature_id).scalar()

    return GISFeatureResponse(
        feature_id=feature.feature_id,
        project_id=feature.project_id,
        feature_type=feature.feature_type,
        geometry=json.loads(geom_json) if geom_json else {},
        attributes=feature.attributes,
        created_by=feature.created_by,
        created_at=feature.created_at,
        updated_at=feature.updated_at
    )


@router.patch("/features/{feature_id}", response_model=GISFeatureResponse)
async def update_gis_feature(
    feature_id: UUID,
    feature_update: GISFeatureUpdate,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """Update GIS feature"""
    feature = db.query(GISFeature).filter(GISFeature.feature_id == feature_id).first()

    if not feature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GIS feature not found"
        )

    # RBAC check
    project = db.query(Project).filter(Project.project_id == feature.project_id).first()
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update GIS features from another DEO"
        )

    # Update fields
    update_data = feature_update.dict(exclude_unset=True)

    if 'geometry' in update_data:
        geom_geojson = json.dumps(update_data['geometry'])
        is_valid = db.query(func.ST_IsValid(func.ST_GeomFromGeoJSON(geom_geojson))).scalar()

        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid geometry"
            )

        feature.geometry = geom_geojson

    if 'feature_type' in update_data:
        feature.feature_type = update_data['feature_type']

    if 'attributes' in update_data:
        feature.attributes = update_data['attributes']

    feature.updated_at = datetime.utcnow()

    # Audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="UPDATE_GIS_FEATURE",
        entity_type="gis_feature",
        entity_id=feature_id,
        payload=update_data,
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(feature)

    # Get geometry as GeoJSON
    geom_json = db.query(
        func.ST_AsGeoJSON(GISFeature.geometry)
    ).filter(GISFeature.feature_id == feature_id).scalar()

    return GISFeatureResponse(
        feature_id=feature.feature_id,
        project_id=feature.project_id,
        feature_type=feature.feature_type,
        geometry=json.loads(geom_json),
        attributes=feature.attributes,
        created_by=feature.created_by,
        created_at=feature.created_at,
        updated_at=feature.updated_at
    )


@router.delete("/features/{feature_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gis_feature(
    feature_id: UUID,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """Delete GIS feature"""
    feature = db.query(GISFeature).filter(GISFeature.feature_id == feature_id).first()

    if not feature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GIS feature not found"
        )

    # RBAC check
    project = db.query(Project).filter(Project.project_id == feature.project_id).first()
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete GIS features from another DEO"
        )

    # Audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="DELETE_GIS_FEATURE",
        entity_type="gis_feature",
        entity_id=feature_id,
        payload={"feature_type": feature.feature_type},
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.delete(feature)
    db.commit()

    return None


@router.get("/tiles/{z}/{x}/{y}.mvt")
async def get_vector_tile(
    z: int,
    x: int,
    y: int,
    db: Session = Depends(get_db)
):
    """
    Serve Mapbox Vector Tiles for web mapping.

    No authentication required (public map data).
    """
    # Validate tile coordinates
    if z < 0 or z > 20:
        raise HTTPException(status_code=400, detail="Invalid zoom level")

    max_xy = 2 ** z
    if x < 0 or x >= max_xy or y < 0 or y >= max_xy:
        raise HTTPException(status_code=400, detail="Invalid tile coordinates")

    # Generate MVT
    query = text("""
        SELECT ST_AsMVT(tile, 'gis_features', 4096, 'geom') as mvt
        FROM (
            SELECT
                feature_id::text,
                feature_type,
                project_id::text,
                attributes,
                ST_AsMVTGeom(
                    geometry,
                    ST_TileEnvelope(:z, :x, :y),
                    4096,
                    256,
                    true
                ) AS geom
            FROM gis_features
            WHERE ST_Intersects(
                geometry,
                ST_TileEnvelope(:z, :x, :y)
            )
        ) AS tile
        WHERE tile.geom IS NOT NULL
    """)

    result = db.execute(query, {"z": z, "x": x, "y": y}).fetchone()

    if result and result.mvt:
        return Response(
            content=bytes(result.mvt),
            media_type="application/vnd.mapbox-vector-tile"
        )
    else:
        # Return empty tile
        return Response(content=b'', media_type="application/vnd.mapbox-vector-tile")
