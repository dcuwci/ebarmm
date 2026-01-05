You are a senior full-stack systems architect, GIS engineer, and
government transparency platform designer.

Your task is to DESIGN and SCAFFOLD an upgraded version of the
E-BARMM (Enhanced BARMM Transparency System), replacing a legacy
PHP/MySQL/GIS-file-based system with a modern, secure, scalable architecture.

====================================================================
TARGET TECHNOLOGY STACK
====================================================================

BACKEND
- FastAPI (Python)
- PostgreSQL + PostGIS
- SQLAlchemy + Alembic
- JWT authentication
- Role-Based Access Control (RBAC)
- Object storage abstraction for media (S3-compatible OR filesystem)

FRONTEND
- React (TypeScript)
- MapLibre or Leaflet for GIS visualization/editing
- Role-based UI (Public / DEO / Regional Admin / Super Admin)

MOBILE
- Android (API-first, offline-first sync)
- No direct database access

====================================================================
OFFICIAL PROJECT BASIS (DO NOT IGNORE)
====================================================================

This upgrade MUST comply with the Inception Report:
"Updating of the Comprehensive Transparency System of MPW-BARMM
through the E-BARMM System" (October 2025)

OBJECTIVES THAT MUST BE TRACEABLE IN YOUR DESIGN:

A. Integrated GIS Mapping  
B. Web-based GIS Data Editing  
C. GIS-Aided Progress Monitoring  
D. Tamper-Proof Progress Reporting  
E. Mobile Application Support  
F. Web Application Enhancements  
G. Server Migration & Optimization  

====================================================================
LEGACY SYSTEM — SOURCE OF TRUTH
====================================================================

DATABASE
- MySQL
- Common DB name: earmm2019

STORAGE MODEL
- Structured data in MySQL
- Media, GIS, and documents stored on filesystem
- GIS geometries NOT stored in DB (only shapefile/KML paths)
- Progress data is MUTABLE (tampering risk)
- No audit trail

--------------------------------------------------------------------
LEGACY DATABASE SCHEMA (EXTRACTED)
--------------------------------------------------------------------

TABLE: deo
deo (
  deo_id INT PRIMARY KEY,
  deo_name VARCHAR(100),
  province VARCHAR(100),
  region VARCHAR(50)
);

TABLE: projects
projects (
  project_id INT PRIMARY KEY,
  deo_id INT,
  project_title TEXT,
  location TEXT,
  fund_source VARCHAR(50),
  mode_of_implementation VARCHAR(50),
  project_cost DECIMAL(18,2),
  project_scale VARCHAR(50),
  fund_year INT,
  percent_completion DECIMAL(5,2),
  project_status VARCHAR(50),
  created_at DATETIME,
  updated_at DATETIME
);

TABLE: project_activity
project_activity (
  activity_id INT PRIMARY KEY,
  project_id INT,
  activity_description TEXT,
  percent_completion DECIMAL(5,2),
  activity_date DATE,
  updated_by VARCHAR(100)
);

TABLE: project_photos
project_photos (
  photo_id INT PRIMARY KEY,
  project_id INT,
  file_path TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  capture_date DATETIME,
  uploaded_by VARCHAR(100)
);

TABLE: project_documents
project_documents (
  document_id INT PRIMARY KEY,
  project_id INT,
  document_title VARCHAR(255),
  file_path TEXT,
  file_type VARCHAR(20),
  upload_date DATETIME,
  uploaded_by VARCHAR(100)
);

TABLE: routeshoot
routeshoot (
  routeshoot_id INT PRIMARY KEY,
  project_id INT,
  video_path TEXT,
  kml_path TEXT,
  upload_date DATETIME
);

TABLE: drone_videos
drone_videos (
  drone_id INT PRIMARY KEY,
  project_id INT,
  video_path TEXT,
  kml_path TEXT,
  upload_date DATETIME
);

TABLE: gis_layers
gis_layers (
  layer_id INT PRIMARY KEY,
  project_id INT,
  shapefile_path TEXT,
  layer_type VARCHAR(50),
  upload_date DATETIME
);

Legacy file paths follow patterns like:
- /data/projects/photos/{project_id}/
- /data/projects/routeshoot/{project_id}/
- /data/projects/gis/{project_id}/

====================================================================
TARGET SYSTEM — REQUIRED NEW DESIGN
====================================================================

You MUST design and work from the following TARGET SCHEMA.
You may extend it if justified, but do NOT remove core concepts.

--------------------------------------------------------------------
TARGET DATABASE SCHEMA (PostgreSQL + PostGIS)
--------------------------------------------------------------------

TABLE: users
Purpose: Authentication & RBAC

users (
  user_id UUID PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL, -- super_admin, regional_admin, deo_user
  deo_id INT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  last_login TIMESTAMP
);

--------------------------------------------------------------------

TABLE: deo
deo (
  deo_id INT PRIMARY KEY,
  deo_name VARCHAR(100),
  province VARCHAR(100),
  region VARCHAR(50)
);

--------------------------------------------------------------------

TABLE: projects
Purpose: Core project registry (NO mutable progress fields)

projects (
  project_id UUID PRIMARY KEY,
  deo_id INT REFERENCES deo(deo_id),
  project_title TEXT,
  location TEXT,
  fund_source VARCHAR(50),
  mode_of_implementation VARCHAR(50),
  project_cost NUMERIC(18,2),
  project_scale VARCHAR(50),
  fund_year INT,
  status VARCHAR(50),
  created_at TIMESTAMP,
  created_by UUID REFERENCES users(user_id)
);

--------------------------------------------------------------------

TABLE: project_progress_logs
Purpose: IMMUTABLE progress history (append-only)

project_progress_logs (
  progress_id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(project_id),
  reported_percent NUMERIC(5,2),
  report_date DATE,
  remarks TEXT,
  reported_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP,
  prev_hash TEXT,
  record_hash TEXT
);

-- NO UPDATES OR DELETES ALLOWED

--------------------------------------------------------------------

TABLE: gis_features
Purpose: Native GIS storage (replaces shapefiles/KML)

gis_features (
  feature_id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(project_id),
  feature_type VARCHAR(30), -- road, bridge, drainage, facility
  geometry GEOMETRY(GEOMETRY, 4326),
  attributes JSONB,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP
);

-- GIST index required on geometry

--------------------------------------------------------------------

TABLE: media_assets
Purpose: Unified media metadata (photos, videos, documents)

media_assets (
  media_id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(project_id),
  media_type VARCHAR(20), -- photo, video, document
  storage_key TEXT, -- object storage path/key
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  captured_at TIMESTAMP,
  uploaded_by UUID REFERENCES users(user_id),
  uploaded_at TIMESTAMP
);

--------------------------------------------------------------------

TABLE: audit_logs
Purpose: Tamper-proof system-wide audit trail

audit_logs (
  audit_id UUID PRIMARY KEY,
  actor_id UUID REFERENCES users(user_id),
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMP,
  prev_hash TEXT,
  record_hash TEXT
);

--------------------------------------------------------------------

TABLE: geofencing_rules
Purpose: GIS-based validation & alerts

geofencing_rules (
  rule_id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(project_id),
  geometry GEOMETRY(POLYGON, 4326),
  rule_type VARCHAR(50),
  created_at TIMESTAMP
);

--------------------------------------------------------------------

TABLE: alerts
Purpose: Automated system notifications

alerts (
  alert_id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(project_id),
  alert_type VARCHAR(50),
  message TEXT,
  triggered_at TIMESTAMP,
  resolved BOOLEAN DEFAULT false
);

====================================================================
YOUR MANDATORY OUTPUTS
====================================================================

1) SYSTEM ARCHITECTURE
- Describe FastAPI + React + PostGIS architecture
- Show data flows for:
  - Project creation
  - GIS editing
  - Progress reporting
  - Public access
- Explicitly show how legacy flaws are fixed

2) DATABASE MAPPING
- Map EACH legacy table to target tables
- Explain dropped, merged, or derived fields

3) API DESIGN (FastAPI)
- Authentication & RBAC
- Project CRUD
- GIS feature CRUD
- Append-only progress reporting
- Media uploads (pre-signed URLs or streaming)
- Public read-only endpoints
- Automated reporting endpoints

4) FRONTEND DESIGN (React)
- Public portal
- Admin dashboard
- GIS editor
- Progress timeline UI
- Map interaction patterns

5) MOBILE STRATEGY
- Offline-first capture
- GPS/photo submission
- Sync + conflict resolution
- Anti-tampering checks

6) SECURITY & INTEGRITY
- Append-only enforcement
- Hash chaining strategy
- Audit log guarantees
- Role-based permissions

7) MIGRATION STRATEGY
- MySQL → PostgreSQL
- Shapefile/KML → PostGIS
- Filesystem → object storage
- Data validation & rollback plan

====================================================================
DELIVERY RULES
====================================================================

- Be technical and implementation-oriented
- No marketing language
- No vague statements
- Clearly distinguish LEGACY vs TARGET
- Assume developers will implement directly from your output

BEGIN WITH THE SYSTEM ARCHITECTURE OVERVIEW.
