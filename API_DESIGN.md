# FastAPI Endpoint Specifications

## 1. API OVERVIEW

**Base URL:** `https://api.ebarmm.gov.ph/v1`

**Authentication:** JWT Bearer tokens (except public endpoints)

**Response Format:** JSON

**Error Handling:** RFC 7807 Problem Details

---

## 2. AUTHENTICATION & AUTHORIZATION

### 2.1 POST `/auth/login`

**Purpose:** Authenticate user and issue JWT token

**Access:** Public

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "user_id": "uuid",
    "username": "string",
    "role": "deo_user|regional_admin|super_admin",
    "deo_id": 123
  }
}
```

**Errors:**
- `401 Unauthorized`: Invalid credentials
- `403 Forbidden`: Account disabled

**Implementation:**
```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from app.auth import authenticate_user, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    access_token = create_access_token(
        data={"sub": str(user.user_id), "role": user.role, "deo_id": user.deo_id},
        expires_delta=timedelta(hours=1)
    )

    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 3600,
        "user": {
            "user_id": str(user.user_id),
            "username": user.username,
            "role": user.role,
            "deo_id": user.deo_id
        }
    }
```

---

### 2.2 POST `/auth/refresh`

**Purpose:** Refresh access token

**Access:** Authenticated

**Request:**
```json
{
  "refresh_token": "string"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "string",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

### 2.3 POST `/auth/logout`

**Purpose:** Invalidate token (add to blacklist)

**Access:** Authenticated

**Response:** `204 No Content`

---

## 3. PROJECT MANAGEMENT

### 3.1 GET `/projects`

**Purpose:** List all projects (filtered by role)

**Access:** Authenticated

**Query Parameters:**
- `deo_id` (int, optional): Filter by DEO
- `fund_year` (int, optional): Filter by year
- `status` (string, optional): Filter by status
- `limit` (int, default=50, max=500): Pagination
- `offset` (int, default=0): Pagination

**Response:** `200 OK`
```json
{
  "total": 1234,
  "items": [
    {
      "project_id": "uuid",
      "deo_id": 5,
      "deo_name": "Maguindanao DEO",
      "project_title": "Road Construction - Cotabato City",
      "location": "Cotabato City",
      "fund_source": "GAA",
      "mode_of_implementation": "Contract",
      "project_cost": 15000000.00,
      "project_scale": "Provincial",
      "fund_year": 2025,
      "status": "ongoing",
      "created_at": "2025-06-15T08:30:00Z",
      "current_progress": 45.5
    }
  ]
}
```

**RBAC Logic:**
- `super_admin`: See all projects
- `regional_admin`: See projects in their region
- `deo_user`: See only their DEO's projects

**Implementation:**
```python
from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("")
async def list_projects(
    deo_id: int | None = None,
    fund_year: int | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Project)

    # RBAC filtering
    if current_user.role == "deo_user":
        query = query.filter(Project.deo_id == current_user.deo_id)
    elif current_user.role == "regional_admin":
        # Filter by region (requires join with deo table)
        query = query.join(DEO).filter(DEO.region == current_user.region)

    # Apply user filters
    if deo_id:
        query = query.filter(Project.deo_id == deo_id)
    if fund_year:
        query = query.filter(Project.fund_year == fund_year)
    if status:
        query = query.filter(Project.status == status)

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    # Compute current_progress from latest log
    for item in items:
        latest_log = db.query(ProjectProgressLog)\
            .filter(ProjectProgressLog.project_id == item.project_id)\
            .order_by(ProjectProgressLog.created_at.desc())\
            .first()
        item.current_progress = latest_log.reported_percent if latest_log else 0.0

    return {
        "total": total,
        "items": [serialize_project(item) for item in items]
    }
```

---

### 3.2 GET `/projects/{project_id}`

**Purpose:** Get single project details

**Access:** Authenticated (RBAC applies)

**Response:** `200 OK`
```json
{
  "project_id": "uuid",
  "deo_id": 5,
  "deo_name": "Maguindanao DEO",
  "project_title": "Road Construction - Cotabato City",
  "location": "Cotabato City",
  "fund_source": "GAA",
  "mode_of_implementation": "Contract",
  "project_cost": 15000000.00,
  "project_scale": "Provincial",
  "fund_year": 2025,
  "status": "ongoing",
  "created_at": "2025-06-15T08:30:00Z",
  "created_by": "uuid",
  "current_progress": 45.5,
  "progress_history": [
    {
      "progress_id": "uuid",
      "reported_percent": 45.5,
      "report_date": "2025-12-01",
      "remarks": "Foundation completed",
      "reported_by": "uuid",
      "created_at": "2025-12-01T14:30:00Z"
    }
  ],
  "gis_features": [
    {
      "feature_id": "uuid",
      "feature_type": "road",
      "geometry": {
        "type": "LineString",
        "coordinates": [[124.123, 7.456], [124.125, 7.458]]
      },
      "attributes": {"length_km": 5.2}
    }
  ],
  "media_count": {
    "photos": 12,
    "videos": 2,
    "documents": 5
  }
}
```

**Errors:**
- `404 Not Found`: Project doesn't exist
- `403 Forbidden`: User doesn't have access to this project

---

### 3.3 POST `/projects`

**Purpose:** Create new project

**Access:** `deo_user`, `regional_admin`, `super_admin`

**Request:**
```json
{
  "project_title": "Road Construction - Cotabato City",
  "location": "Cotabato City",
  "fund_source": "GAA",
  "mode_of_implementation": "Contract",
  "project_cost": 15000000.00,
  "project_scale": "Provincial",
  "fund_year": 2025,
  "status": "planning"
}
```

**Response:** `201 Created`
```json
{
  "project_id": "uuid",
  "message": "Project created successfully"
}
```

**Validation:**
- `project_title`: Required, max 500 chars
- `project_cost`: >= 0
- `fund_year`: >= 2010, <= current_year + 2
- `status`: Enum ['planning', 'ongoing', 'completed', 'suspended']

**RBAC:**
- `deo_user`: Can only create for their own DEO (deo_id auto-set)
- `regional_admin`: Can create for any DEO in their region
- `super_admin`: Can create for any DEO

**Implementation:**
```python
from pydantic import BaseModel, validator
from uuid import uuid4

class ProjectCreate(BaseModel):
    project_title: str
    location: str
    fund_source: str
    mode_of_implementation: str
    project_cost: float
    project_scale: str
    fund_year: int
    status: str

    @validator('project_cost')
    def cost_must_be_positive(cls, v):
        if v < 0:
            raise ValueError('project_cost must be >= 0')
        return v

@router.post("", status_code=201)
async def create_project(
    project: ProjectCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # RBAC: DEO users can only create for their own DEO
    if current_user.role == "deo_user":
        deo_id = current_user.deo_id
    else:
        # Admin can specify deo_id (would be in request body)
        deo_id = project.deo_id

    new_project = Project(
        project_id=uuid4(),
        deo_id=deo_id,
        **project.dict(),
        created_by=current_user.user_id,
        created_at=datetime.utcnow()
    )

    db.add(new_project)

    # Audit log
    audit_log = AuditLog(
        audit_id=uuid4(),
        actor_id=current_user.user_id,
        action="CREATE_PROJECT",
        entity_type="project",
        entity_id=new_project.project_id,
        payload=project.dict(),
        created_at=datetime.utcnow()
    )
    db.add(audit_log)

    db.commit()

    return {"project_id": str(new_project.project_id), "message": "Project created successfully"}
```

---

### 3.4 PATCH `/projects/{project_id}`

**Purpose:** Update project (limited fields only)

**Access:** `deo_user` (own projects), `regional_admin`, `super_admin`

**Allowed Fields:**
- `project_title`
- `location`
- `status`
- `project_cost` (with justification in audit log)

**Prohibited Updates:**
- `deo_id` (immutable)
- `fund_year` (immutable)
- `created_at` (immutable)
- Progress percentage (use progress API)

**Request:**
```json
{
  "status": "completed"
}
```

**Response:** `200 OK`

---

### 3.5 DELETE `/projects/{project_id}`

**Purpose:** Soft-delete project (set status = 'deleted')

**Access:** `super_admin` only

**Response:** `204 No Content`

**Note:** Hard deletes prohibited (audit trail requirement)

---

## 4. PROGRESS REPORTING (APPEND-ONLY)

### 4.1 POST `/projects/{project_id}/progress`

**Purpose:** Report project progress (immutable log entry)

**Access:** `deo_user` (own projects), `regional_admin`, `super_admin`

**Request:**
```json
{
  "reported_percent": 45.5,
  "report_date": "2025-12-01",
  "remarks": "Foundation completed, starting steel works"
}
```

**Response:** `201 Created`
```json
{
  "progress_id": "uuid",
  "record_hash": "abc123...",
  "prev_hash": "def456...",
  "message": "Progress logged successfully"
}
```

**Validation:**
- `reported_percent`: 0.0 - 100.0
- `report_date`: Cannot be future date
- Cannot report same date twice (unique constraint)

**Implementation:**
```python
@router.post("/{project_id}/progress", status_code=201)
async def log_progress(
    project_id: str,
    progress: ProgressLogCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    # RBAC check
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(403, "Access denied")

    # Get latest progress log for hash chain
    latest_log = db.query(ProjectProgressLog)\
        .filter(ProjectProgressLog.project_id == project_id)\
        .order_by(ProjectProgressLog.created_at.desc())\
        .first()

    prev_hash = latest_log.record_hash if latest_log else None

    # Calculate new hash
    record_hash = calculate_progress_hash(
        project_id=project_id,
        reported_percent=progress.reported_percent,
        report_date=str(progress.report_date),
        reported_by=str(current_user.user_id),
        prev_hash=prev_hash or ""
    )

    # Insert progress log
    new_log = ProjectProgressLog(
        progress_id=uuid4(),
        project_id=project_id,
        reported_percent=progress.reported_percent,
        report_date=progress.report_date,
        remarks=progress.remarks,
        reported_by=current_user.user_id,
        created_at=datetime.utcnow(),
        prev_hash=prev_hash,
        record_hash=record_hash
    )

    db.add(new_log)
    db.commit()

    return {
        "progress_id": str(new_log.progress_id),
        "record_hash": record_hash,
        "prev_hash": prev_hash,
        "message": "Progress logged successfully"
    }
```

---

### 4.2 GET `/projects/{project_id}/progress`

**Purpose:** Get progress history

**Access:** Authenticated

**Response:** `200 OK`
```json
{
  "project_id": "uuid",
  "total_logs": 15,
  "logs": [
    {
      "progress_id": "uuid",
      "reported_percent": 45.5,
      "report_date": "2025-12-01",
      "remarks": "Foundation completed",
      "reported_by": "uuid",
      "reporter_name": "Juan Dela Cruz",
      "created_at": "2025-12-01T14:30:00Z",
      "hash_valid": true
    }
  ]
}
```

**Features:**
- Ordered chronologically
- Includes hash validation status
- Shows reporter name (joined from users table)

---

### 4.3 GET `/projects/{project_id}/progress/verify`

**Purpose:** Verify hash chain integrity

**Access:** Authenticated

**Response:** `200 OK`
```json
{
  "project_id": "uuid",
  "total_logs": 15,
  "chain_valid": true,
  "broken_links": []
}
```

**If chain is broken:**
```json
{
  "project_id": "uuid",
  "total_logs": 15,
  "chain_valid": false,
  "broken_links": [
    {
      "progress_id": "uuid",
      "expected_hash": "abc123...",
      "actual_hash": "def456...",
      "tampered_at": "2025-12-05T10:15:00Z"
    }
  ]
}
```

**Implementation:**
```python
@router.get("/{project_id}/progress/verify")
async def verify_progress_chain(
    project_id: str,
    db: Session = Depends(get_db)
):
    logs = db.query(ProjectProgressLog)\
        .filter(ProjectProgressLog.project_id == project_id)\
        .order_by(ProjectProgressLog.created_at)\
        .all()

    broken_links = []
    prev_hash = None

    for log in logs:
        # Recalculate expected hash
        expected_hash = calculate_progress_hash(
            project_id=str(log.project_id),
            reported_percent=float(log.reported_percent),
            report_date=str(log.report_date),
            reported_by=str(log.reported_by),
            prev_hash=prev_hash or ""
        )

        if expected_hash != log.record_hash:
            broken_links.append({
                "progress_id": str(log.progress_id),
                "expected_hash": expected_hash,
                "actual_hash": log.record_hash,
                "tampered_at": log.created_at.isoformat()
            })

        prev_hash = log.record_hash

    return {
        "project_id": project_id,
        "total_logs": len(logs),
        "chain_valid": len(broken_links) == 0,
        "broken_links": broken_links
    }
```

---

## 5. GIS FEATURE MANAGEMENT

### 5.1 POST `/gis/features`

**Purpose:** Create GIS feature

**Access:** `deo_user` (own projects), `regional_admin`, `super_admin`

**Request:**
```json
{
  "project_id": "uuid",
  "feature_type": "road",
  "geometry": {
    "type": "LineString",
    "coordinates": [[124.123, 7.456], [124.125, 7.458]]
  },
  "attributes": {
    "length_km": 5.2,
    "surface_type": "asphalt"
  }
}
```

**Response:** `201 Created`
```json
{
  "feature_id": "uuid",
  "message": "GIS feature created"
}
```

**Validation:**
- GeoJSON geometry format
- Valid coordinates (within BARMM bounds)
- Check against geofencing_rules

**Implementation:**
```python
from geoalchemy2.functions import ST_GeomFromGeoJSON, ST_IsValid, ST_Within

@router.post("/features", status_code=201)
async def create_gis_feature(
    feature: GISFeatureCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify project access
    project = db.query(Project).filter(Project.project_id == feature.project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    # RBAC check
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(403, "Access denied")

    # Convert GeoJSON to PostGIS geometry
    geom_geojson = json.dumps(feature.geometry)

    # Validate geometry
    is_valid = db.query(ST_IsValid(ST_GeomFromGeoJSON(geom_geojson))).scalar()
    if not is_valid:
        raise HTTPException(400, "Invalid geometry")

    # Check geofencing (if global boundary exists)
    boundary = db.query(GeofencingRule).filter(
        GeofencingRule.project_id.is_(None),
        GeofencingRule.rule_type == 'region_boundary'
    ).first()

    if boundary:
        within_bounds = db.query(
            ST_Within(ST_GeomFromGeoJSON(geom_geojson), boundary.geometry)
        ).scalar()

        if not within_bounds:
            raise HTTPException(400, "Geometry outside BARMM boundary")

    # Insert feature
    new_feature = GISFeature(
        feature_id=uuid4(),
        project_id=feature.project_id,
        feature_type=feature.feature_type,
        geometry=geom_geojson,  # GeoAlchemy2 handles conversion
        attributes=feature.attributes,
        created_by=current_user.user_id,
        created_at=datetime.utcnow()
    )

    db.add(new_feature)
    db.commit()

    return {"feature_id": str(new_feature.feature_id), "message": "GIS feature created"}
```

---

### 5.2 GET `/gis/features`

**Purpose:** Query GIS features (spatial and attribute filters)

**Access:** Authenticated

**Query Parameters:**
- `project_id` (uuid): Filter by project
- `feature_type` (string): Filter by type
- `bbox` (string): Bounding box filter (minLon,minLat,maxLon,maxLat)
- `limit` (int, default=100)

**Response:** `200 OK` (GeoJSON FeatureCollection)
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "uuid",
      "geometry": {
        "type": "LineString",
        "coordinates": [[124.123, 7.456], [124.125, 7.458]]
      },
      "properties": {
        "feature_type": "road",
        "project_id": "uuid",
        "project_title": "Road Construction",
        "attributes": {
          "length_km": 5.2
        },
        "created_at": "2025-06-15T08:30:00Z"
      }
    }
  ]
}
```

---

### 5.3 GET `/gis/tiles/{z}/{x}/{y}.mvt`

**Purpose:** Serve Mapbox Vector Tiles for web mapping

**Access:** Public (read-only)

**Response:** `application/vnd.mapbox-vector-tile`

**Implementation:**
```python
from geoalchemy2.functions import ST_AsMVT, ST_AsMVTGeom, ST_TileEnvelope

@router.get("/tiles/{z}/{x}/{y}.mvt")
async def get_vector_tile(
    z: int,
    x: int,
    y: int,
    db: Session = Depends(get_db)
):
    tile_envelope = ST_TileEnvelope(z, x, y)

    query = db.query(
        ST_AsMVT(
            db.query(
                GISFeature.feature_id,
                GISFeature.feature_type,
                ST_AsMVTGeom(
                    GISFeature.geometry,
                    tile_envelope,
                    4096  # Tile extent
                ).label('geom'),
                GISFeature.attributes
            ).filter(
                ST_Intersects(GISFeature.geometry, tile_envelope)
            ).subquery(),
            'gis_features',
            4096,
            'geom'
        )
    ).scalar()

    return Response(content=query, media_type="application/vnd.mapbox-vector-tile")
```

---

## 6. MEDIA MANAGEMENT

### 6.1 POST `/media/upload-url`

**Purpose:** Get pre-signed URL for direct S3 upload

**Access:** `deo_user` (own projects), `regional_admin`, `super_admin`

**Request:**
```json
{
  "project_id": "uuid",
  "media_type": "photo",
  "filename": "construction_001.jpg",
  "content_type": "image/jpeg",
  "latitude": 7.1234,
  "longitude": 124.5678
}
```

**Response:** `200 OK`
```json
{
  "upload_url": "https://s3.amazonaws.com/ebarmm-media/...",
  "storage_key": "photos/{project_id}/{media_id}/construction_001.jpg",
  "media_id": "uuid",
  "expires_in": 3600
}
```

**Client Workflow:**
1. Call `/media/upload-url`
2. Upload file to `upload_url` using PUT request
3. Call `/media/{media_id}/confirm` when upload completes

---

### 6.2 POST `/media/{media_id}/confirm`

**Purpose:** Confirm upload completion

**Access:** Authenticated

**Response:** `200 OK`

---

### 6.3 GET `/media/{media_id}`

**Purpose:** Get media metadata

**Access:** Authenticated

**Response:** `200 OK`
```json
{
  "media_id": "uuid",
  "project_id": "uuid",
  "media_type": "photo",
  "storage_key": "photos/...",
  "download_url": "https://...",
  "latitude": 7.1234,
  "longitude": 124.5678,
  "captured_at": "2025-12-01T10:30:00Z",
  "uploaded_by": "uuid",
  "uploaded_at": "2025-12-01T11:00:00Z"
}
```

---

## 7. PUBLIC API (NO AUTHENTICATION)

### 7.1 GET `/public/projects`

**Purpose:** Public transparency portal data

**Access:** Public (rate-limited)

**Query Parameters:**
- `province` (string)
- `fund_year` (int)
- `limit` (int, max=100)

**Response:** `200 OK`
```json
{
  "total": 500,
  "items": [
    {
      "project_id": "uuid",
      "project_title": "Road Construction",
      "location": "Cotabato City",
      "fund_source": "GAA",
      "project_cost": 15000000.00,
      "fund_year": 2025,
      "current_progress": 45.5,
      "last_updated": "2025-12-01"
    }
  ]
}
```

**Excluded fields:**
- `created_by` (privacy)
- Internal remarks
- User identities

---

### 7.2 GET `/public/map`

**Purpose:** Public map view with GIS features

**Access:** Public

**Response:** GeoJSON FeatureCollection (same as `/gis/features`)

---

### 7.3 GET `/public/stats`

**Purpose:** Dashboard statistics

**Access:** Public

**Response:** `200 OK`
```json
{
  "total_projects": 500,
  "total_cost": 7500000000.00,
  "by_province": {
    "Maguindanao": 150,
    "Lanao del Sur": 120
  },
  "by_status": {
    "ongoing": 300,
    "completed": 180,
    "planning": 20
  },
  "avg_completion": 52.3
}
```

---

## 8. REPORTING ENDPOINTS

### 8.1 GET `/reports/project-summary`

**Purpose:** Generate project summary report

**Access:** `regional_admin`, `super_admin`

**Query Parameters:**
- `deo_id` (int)
- `fund_year` (int)
- `format` (string: json|csv|pdf)

**Response:** `200 OK` (format depends on `format` param)

---

### 8.2 GET `/reports/progress-timeline/{project_id}`

**Purpose:** Export progress timeline

**Access:** Authenticated

**Response:** CSV
```csv
report_date,reported_percent,remarks,reported_by
2025-06-15,10.0,Foundation started,Juan Dela Cruz
2025-07-15,25.0,Foundation 50% complete,Juan Dela Cruz
```

---

## 9. AUDIT LOGS

### 9.1 GET `/audit/logs`

**Purpose:** Query audit trail

**Access:** `super_admin` only

**Query Parameters:**
- `actor_id` (uuid)
- `action` (string)
- `entity_type` (string)
- `start_date` (date)
- `end_date` (date)

**Response:** `200 OK`
```json
{
  "total": 1000,
  "logs": [
    {
      "audit_id": "uuid",
      "actor_id": "uuid",
      "actor_name": "Juan Dela Cruz",
      "action": "CREATE_PROJECT",
      "entity_type": "project",
      "entity_id": "uuid",
      "payload": {...},
      "created_at": "2025-12-01T10:00:00Z"
    }
  ]
}
```

---

## 10. ERROR RESPONSE FORMAT

All errors follow RFC 7807:
```json
{
  "type": "https://api.ebarmm.gov.ph/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "project_cost must be >= 0",
  "instance": "/api/projects",
  "errors": [
    {
      "field": "project_cost",
      "message": "must be >= 0"
    }
  ]
}
```

---

## 11. RATE LIMITING

**Public endpoints:**
- 100 requests/minute per IP

**Authenticated endpoints:**
- 1000 requests/minute per user

**Upload endpoints:**
- 50 uploads/hour per user

---

## 12. API VERSIONING

**Current:** v1

**Future versions:** `/v2/...`

**Deprecation policy:** 6 months notice before removing endpoints

---

This API design provides complete functionality for the E-BARMM system with security, auditability, and scalability built-in.
