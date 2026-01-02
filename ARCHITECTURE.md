# E-BARMM System Architecture

## 1. SYSTEM ARCHITECTURE OVERVIEW

### 1.1 Architecture Pattern

**Type**: Three-tier API-first architecture with offline-capable mobile clients

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │  React Web App   │  │  Public Portal   │  │  Android   │ │
│  │  (TypeScript)    │  │  (TypeScript)    │  │   Mobile   │ │
│  │                  │  │                  │  │            │ │
│  │  - Admin UI      │  │  - Read-only     │  │  - Offline │ │
│  │  - GIS Editor    │  │  - Map viewer    │  │  - GPS     │ │
│  │  - RBAC views    │  │  - Search        │  │  - Camera  │ │
│  └──────────────────┘  └──────────────────┘  └────────────┘ │
│           │                     │                    │       │
└───────────┼─────────────────────┼────────────────────┼───────┘
            │                     │                    │
            └─────────────────────┴────────────────────┘
                                  │
                            HTTPS/JSON
                                  │
┌─────────────────────────────────┼───────────────────────────┐
│                    API LAYER    │                            │
├─────────────────────────────────┼───────────────────────────┤
│                                                               │
│                    ┌────────────────────┐                    │
│                    │   FastAPI Server   │                    │
│                    │   (Python 3.11+)   │                    │
│                    └────────────────────┘                    │
│                             │                                 │
│  ┌──────────────────────────┼──────────────────────────┐    │
│  │                          │                           │    │
│  ▼                          ▼                           ▼    │
│ ┌──────────┐      ┌──────────────┐          ┌──────────┐   │
│ │   Auth   │      │   Business   │          │  Public  │   │
│ │  Module  │      │    Logic     │          │   API    │   │
│ │          │      │              │          │          │   │
│ │ - JWT    │      │ - Project    │          │ - Maps   │   │
│ │ - RBAC   │      │ - GIS ops    │          │ - Search │   │
│ │ - Login  │      │ - Progress   │          │ - Stats  │   │
│ └──────────┘      │ - Media      │          └──────────┘   │
│                    │ - Audit      │                          │
│                    └──────────────┘                          │
│                             │                                 │
└─────────────────────────────┼─────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────┐      ┌────────────────────────┐ │
│  │  PostgreSQL + PostGIS  │      │   Object Storage       │ │
│  │                        │      │   (S3 / Local FS)      │ │
│  │  - Structured data     │      │                        │ │
│  │  - GIS geometries      │      │  - Photos              │ │
│  │  - Audit logs          │      │  - Videos              │ │
│  │  - Immutable progress  │      │  - Documents           │ │
│  │  - Hash chains         │      │  - GIS exports         │ │
│  └────────────────────────┘      └────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 1.2 Core Architectural Principles

**AP-1: API-First Design**
- All functionality exposed through REST API
- Mobile and web clients are equivalent consumers
- No direct database access from clients
- Public API subset requires no authentication

**AP-2: Immutable Audit Trail**
- Progress logs are append-only
- Hash chaining prevents tampering
- All mutations logged to audit_logs
- Database-level triggers prevent updates/deletes on critical tables

**AP-3: GIS-Native Storage**
- Geometries stored in PostGIS (not files)
- Spatial indexes on all geometry columns
- Vector tiles served for web mapping
- Export to Shapefile/KML on-demand

**AP-4: Role-Based Security**
- JWT-based authentication
- Four roles: public, deo_user, regional_admin, super_admin
- Row-level security policies in PostgreSQL
- API endpoints filtered by role and DEO affiliation

**AP-5: Offline-First Mobile**
- Mobile app syncs data when online
- Local SQLite cache for offline work
- Conflict resolution favors server state
- GPS and photos captured without connectivity

---

## 2. DATA FLOW DIAGRAMS

### 2.1 Project Creation Flow

```
┌──────────────┐
│  DEO User    │
│  (Web/Mobile)│
└──────┬───────┘
       │
       │ POST /api/projects
       │ {title, location, cost, ...}
       │ + JWT token
       │
       ▼
┌─────────────────────────────────────┐
│  FastAPI: POST /api/projects        │
│                                     │
│  1. Verify JWT & extract user_id   │
│  2. Check role == deo_user          │
│  3. Validate user.deo_id matches    │
│  4. Generate project_id (UUID)      │
│  5. Insert into projects table      │
│  6. Insert audit_log entry          │
│  7. Return project object           │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  PostgreSQL Transaction             │
│                                     │
│  BEGIN;                             │
│  INSERT INTO projects               │
│    VALUES (uuid, deo_id, ...)       │
│  INSERT INTO audit_logs             │
│    VALUES (actor=user_id, ...)      │
│  COMMIT;                            │
└─────────────────────────────────────┘
```

**Key Changes from Legacy:**
- Legacy: Direct MySQL INSERT, no audit trail, mutable status
- Target: Transactional, immutable core, audited, UUID-based

---

### 2.2 GIS Feature Editing Flow

```
┌──────────────┐
│  DEO User    │
│  (Web GIS    │
│   Editor)    │
└──────┬───────┘
       │
       │ Draw/Edit geometry in MapLibre
       │ {"type": "LineString", "coordinates": [...]}
       │
       ▼
┌─────────────────────────────────────┐
│  React: GIS Editor Component        │
│                                     │
│  1. Capture GeoJSON from map        │
│  2. POST /api/gis/features          │
│     {                               │
│       project_id: uuid,             │
│       feature_type: "road",         │
│       geometry: {...},              │
│       attributes: {length_km: 5.2}  │
│     }                               │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  FastAPI: POST /api/gis/features    │
│                                     │
│  1. Verify JWT & permissions        │
│  2. Validate GeoJSON format         │
│  3. Convert to PostGIS geometry     │
│  4. Check geofencing_rules          │
│  5. Insert into gis_features        │
│  6. Audit log the operation         │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  PostgreSQL                         │
│                                     │
│  INSERT INTO gis_features (         │
│    feature_id,                      │
│    project_id,                      │
│    feature_type,                    │
│    geometry,  -- ST_GeomFromGeoJSON │
│    attributes,                      │
│    created_by,                      │
│    created_at                       │
│  ) VALUES (...)                     │
└─────────────────────────────────────┘
```

**Key Changes from Legacy:**
- Legacy: Upload Shapefile/KML, store file path, no validation
- Target: Native PostGIS geometry, instant indexing, spatial queries

---

### 2.3 Progress Reporting Flow (Tamper-Proof)

```
┌──────────────┐
│  DEO User    │
└──────┬───────┘
       │
       │ Report 45% completion
       │
       ▼
┌─────────────────────────────────────┐
│  POST /api/progress                 │
│  {                                  │
│    project_id: uuid,                │
│    reported_percent: 45.0,          │
│    report_date: "2026-01-02",       │
│    remarks: "Foundation complete"   │
│  }                                  │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  FastAPI: Progress Service          │
│                                     │
│  1. Verify JWT & user owns project  │
│  2. Get latest progress_log entry   │
│  3. Calculate hash chain:           │
│     prev_hash = latest.record_hash  │
│     record_hash = SHA256(           │
│       project_id +                  │
│       reported_percent +            │
│       report_date +                 │
│       prev_hash                     │
│     )                               │
│  4. Insert append-only log          │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  PostgreSQL                         │
│                                     │
│  INSERT INTO project_progress_logs  │
│    (progress_id, project_id,        │
│     reported_percent, report_date,  │
│     remarks, reported_by,           │
│     prev_hash, record_hash)         │
│  VALUES (...)                       │
│                                     │
│  -- Trigger prevents UPDATE/DELETE  │
└─────────────────────────────────────┘
```

**Hash Chaining Algorithm:**
```python
import hashlib
import json

def calculate_progress_hash(
    project_id: str,
    reported_percent: float,
    report_date: str,
    reported_by: str,
    prev_hash: str
) -> str:
    payload = {
        "project_id": project_id,
        "reported_percent": reported_percent,
        "report_date": report_date,
        "reported_by": reported_by,
        "prev_hash": prev_hash
    }
    canonical = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()
```

**Key Changes from Legacy:**
- Legacy: UPDATE projects SET percent_completion = 45 (mutable, no history)
- Target: Append-only log, hash chain prevents backdating/tampering

---

### 2.4 Public Access Flow

```
┌──────────────┐
│  Public User │
│  (No login)  │
└──────┬───────┘
       │
       │ Browse transparency portal
       │
       ▼
┌─────────────────────────────────────┐
│  React: Public Portal               │
│                                     │
│  GET /api/public/projects           │
│  GET /api/public/map                │
│  GET /api/public/stats              │
│                                     │
│  No JWT required                    │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  FastAPI: Public API Endpoints      │
│                                     │
│  - No authentication required       │
│  - Read-only operations             │
│  - Rate-limited per IP              │
│  - Returns sanitized data:          │
│    * Project summaries              │
│    * GIS features (read-only)       │
│    * Latest progress (computed)     │
│    * Public media assets            │
│  - Excludes sensitive fields:       │
│    * Internal remarks               │
│    * User identities (anonymized)   │
│    * Draft/unpublished projects     │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  PostgreSQL: Read-only queries      │
│                                     │
│  SELECT p.*, d.deo_name,            │
│    (SELECT reported_percent         │
│     FROM project_progress_logs      │
│     WHERE project_id = p.project_id │
│     ORDER BY created_at DESC        │
│     LIMIT 1) AS current_progress    │
│  FROM projects p                    │
│  JOIN deo d USING (deo_id)          │
│  WHERE p.status = 'published'       │
└─────────────────────────────────────┘
```

**Key Changes from Legacy:**
- Legacy: Separate public PHP pages, mutable data shown
- Target: Same API, filtered views, progress computed from immutable logs

---

## 3. HOW LEGACY FLAWS ARE FIXED

### 3.1 Tamper-Proof Progress Reporting

**Legacy Flaw:**
```sql
-- Anyone with DB access could backdate or erase history
UPDATE projects
SET percent_completion = 100, updated_at = '2024-01-01'
WHERE project_id = 123;
```

**Target Solution:**
- Append-only `project_progress_logs` table
- Database trigger prevents UPDATE/DELETE:
```sql
CREATE TRIGGER prevent_progress_mutation
BEFORE UPDATE OR DELETE ON project_progress_logs
FOR EACH ROW EXECUTE FUNCTION reject_mutation();
```
- Hash chaining makes tampering detectable
- Audit logs capture all API mutations

### 3.2 GIS Data Integrity

**Legacy Flaw:**
- Shapefiles stored on disk
- No version control
- File path can be changed without validation
- Geometries not queryable

**Target Solution:**
- Native PostGIS geometries with spatial indexes
- Geometry updates create new feature versions (optional versioning)
- Spatial queries: "Find all projects within 5km of point X"
- Export to Shapefile/KML generated on-demand from single source of truth

### 3.3 Access Control

**Legacy Flaw:**
- No RBAC in database
- PHP session-based auth (weak)
- DEO users could see other DEOs' data

**Target Solution:**
- JWT-based stateless authentication
- Row-level security in PostgreSQL:
```sql
CREATE POLICY deo_user_policy ON projects
FOR SELECT USING (
  current_user_role() = 'super_admin' OR
  (current_user_role() = 'deo_user' AND deo_id = current_user_deo_id())
);
```
- API layer enforces RBAC before DB queries

### 3.4 Audit Trail

**Legacy Flaw:**
- No audit logs
- `updated_at` timestamp insufficient
- Cannot answer "Who changed what and when?"

**Target Solution:**
- `audit_logs` table captures all mutations
- Immutable (same trigger pattern)
- Hash-chained for integrity
- Includes full payload (JSONB)

### 3.5 Media Management

**Legacy Flaw:**
- Direct filesystem paths in database
- No access control on files
- Broken links if files moved
- No metadata validation

**Target Solution:**
- `media_assets` table with object storage abstraction
- Pre-signed URLs for upload/download (S3-compatible)
- GPS coordinates stored with photos
- Media linked to projects, not filesystem paths

---

## 4. TECHNOLOGY STACK JUSTIFICATION

### 4.1 FastAPI (Backend)

**Why FastAPI over Django/Flask:**
- Native async support (handles concurrent GIS operations)
- Auto-generated OpenAPI docs (critical for mobile team)
- Pydantic validation (type-safe API contracts)
- Performance: 3x faster than Flask in GIS-heavy workloads

**Key Libraries:**
- `sqlalchemy` + `alembic`: ORM and migrations
- `geoalchemy2`: PostGIS support in SQLAlchemy
- `pyjwt`: JWT token handling
- `python-multipart`: File uploads
- `httpx`: External API calls (if needed)

### 4.2 PostgreSQL + PostGIS

**Why PostgreSQL over MySQL:**
- Native JSON/JSONB support (`attributes` column)
- PostGIS extension (industry standard for GIS)
- Row-level security policies
- Better transaction isolation
- Trigger functions (prevent mutations)

**PostGIS Capabilities:**
- `ST_GeomFromGeoJSON`: Import GeoJSON geometries
- `ST_AsGeoJSON`: Export for web mapping
- `ST_DWithin`: Geofencing and proximity queries
- `ST_Intersects`: Spatial joins
- GIST indexes: Fast spatial queries

### 4.3 React + TypeScript (Frontend)

**Why React:**
- Component reusability (map, forms, tables)
- Large ecosystem for GIS (MapLibre, Leaflet)
- TypeScript ensures type safety with API contracts

**Key Libraries:**
- `maplibre-gl`: Vector tile rendering, WebGL-accelerated
- `react-query`: API state management and caching
- `react-hook-form`: Form validation
- `zod`: Runtime type validation matching backend Pydantic schemas

### 4.4 Android (Mobile)

**Offline-First Architecture:**
- Local SQLite database
- Room persistence library
- WorkManager for background sync
- Retrofit for API calls

**Sync Strategy:**
```
1. Capture data offline (photos, GPS, progress)
2. Store in local SQLite with sync_status = 'pending'
3. When online, POST to API
4. On success, mark sync_status = 'synced'
5. On conflict, server state wins (alert user)
```

---

## 5. DEPLOYMENT ARCHITECTURE

### 5.1 Production Environment

```
┌─────────────────────────────────────────────────────┐
│                  LOAD BALANCER                      │
│                  (Nginx/HAProxy)                    │
└──────────────────┬──────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       ▼                       ▼
┌─────────────┐         ┌─────────────┐
│  FastAPI    │         │  FastAPI    │
│  Instance 1 │         │  Instance 2 │
│  (Docker)   │         │  (Docker)   │
└─────────────┘         └─────────────┘
       │                       │
       └───────────┬───────────┘
                   │
                   ▼
       ┌─────────────────────┐
       │  PostgreSQL 15+     │
       │  + PostGIS 3.4+     │
       │  (Primary-Replica)  │
       └─────────────────────┘
                   │
                   ▼
       ┌─────────────────────┐
       │  Object Storage     │
       │  (MinIO / S3)       │
       └─────────────────────┘
```

### 5.2 Infrastructure Requirements

**Compute:**
- 2x FastAPI instances (4 vCPU, 8GB RAM each)
- 1x PostgreSQL primary (8 vCPU, 16GB RAM, SSD)
- 1x PostgreSQL replica (read-only, public queries)

**Storage:**
- 500GB PostgreSQL (data + indexes)
- 2TB object storage (media assets)

**Network:**
- 100 Mbps minimum (video uploads)
- CDN for public map tiles (optional)

---

## 6. SCALABILITY CONSIDERATIONS

### 6.1 Database Partitioning

**Progress logs table** (high write volume):
```sql
-- Partition by year
CREATE TABLE project_progress_logs_2026
PARTITION OF project_progress_logs
FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

### 6.2 Caching Strategy

**Redis/Memcached for:**
- Public API responses (5 min TTL)
- User session data
- GIS tile cache

**PostgreSQL Materialized Views:**
```sql
CREATE MATERIALIZED VIEW project_current_status AS
SELECT
  p.project_id,
  p.project_title,
  LAST_VALUE(ppl.reported_percent) AS current_progress,
  LAST_VALUE(ppl.report_date) AS last_updated
FROM projects p
LEFT JOIN project_progress_logs ppl USING (project_id)
GROUP BY p.project_id;

REFRESH MATERIALIZED VIEW project_current_status;
```

### 6.3 Vector Tile Generation

Serve map tiles from PostGIS:
```sql
-- Using ST_AsMVT for Mapbox Vector Tiles
SELECT ST_AsMVT(tile, 'gis_features', 4096, 'geom')
FROM (
  SELECT
    feature_id,
    feature_type,
    ST_AsMVTGeom(geometry, ST_TileEnvelope(14, x, y), 4096) AS geom
  FROM gis_features
  WHERE ST_Intersects(geometry, ST_TileEnvelope(14, x, y))
) AS tile;
```

---

## 7. DISASTER RECOVERY

### 7.1 Backup Strategy

**PostgreSQL:**
- Daily full backup (pg_dump)
- Continuous WAL archiving (Point-in-Time Recovery)
- Retention: 30 days

**Object Storage:**
- Versioning enabled
- Cross-region replication (if using S3)

**Audit Logs:**
- Append-only, never purged
- Quarterly archive to cold storage

### 7.2 Recovery Procedures

**Database Corruption:**
1. Restore from latest backup
2. Replay WAL to last transaction
3. Verify hash chains in progress_logs and audit_logs

**Data Integrity Verification:**
```sql
-- Verify progress log hash chain
WITH RECURSIVE chain AS (
  SELECT progress_id, record_hash, prev_hash, 1 AS depth
  FROM project_progress_logs
  WHERE prev_hash IS NULL
  UNION ALL
  SELECT p.progress_id, p.record_hash, p.prev_hash, c.depth + 1
  FROM project_progress_logs p
  JOIN chain c ON p.prev_hash = c.record_hash
)
SELECT COUNT(*) AS valid_chain_length FROM chain;
```

---

## Next Steps

This architecture document establishes the foundation. The following documents will detail:

1. **DATABASE_MAPPING.md** - Legacy to target schema mapping
2. **API_DESIGN.md** - Complete FastAPI endpoint specifications
3. **FRONTEND_DESIGN.md** - React component architecture
4. **MOBILE_STRATEGY.md** - Android offline-first implementation
5. **SECURITY.md** - Security controls and hash chaining details
6. **MIGRATION.md** - Step-by-step migration from legacy system
