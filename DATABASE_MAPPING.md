# Database Migration Mapping: Legacy MySQL → Target PostgreSQL

## 1. OVERVIEW

This document maps each legacy MySQL table to the target PostgreSQL schema, explaining field transformations, data migrations, and architectural changes.

**Migration Complexity:** Medium-High
- **Data Volume:** ~50K projects, ~500K progress entries (estimated)
- **GIS Conversion:** Shapefile/KML → PostGIS geometries
- **Schema Changes:** Normalization, immutability, UUID migration

---

## 2. TABLE-BY-TABLE MAPPING

### 2.1 Legacy `deo` → Target `deo`

**Status:** Direct migration with minor cleanup

#### Legacy Schema (MySQL)
```sql
deo (
  deo_id INT PRIMARY KEY,
  deo_name VARCHAR(100),
  province VARCHAR(100),
  region VARCHAR(50)
);
```

#### Target Schema (PostgreSQL)
```sql
deo (
  deo_id INT PRIMARY KEY,
  deo_name VARCHAR(100),
  province VARCHAR(100),
  region VARCHAR(50)
);
```

#### Migration Strategy
```sql
-- Direct copy, no transformation needed
INSERT INTO target.deo (deo_id, deo_name, province, region)
SELECT deo_id, deo_name, province, region
FROM legacy.deo;
```

#### Data Validation
- Verify no duplicate `deo_id`
- Check for NULL `deo_name` (make NOT NULL in target)
- Standardize province names (e.g., "Maguindanao" vs "MAGUINDANAO")

**Changes:**
- None (1:1 mapping)

---

### 2.2 Legacy `projects` → Target `projects`

**Status:** Significant transformation required

#### Legacy Schema (MySQL)
```sql
projects (
  project_id INT PRIMARY KEY,           -- INT
  deo_id INT,
  project_title TEXT,
  location TEXT,
  fund_source VARCHAR(50),
  mode_of_implementation VARCHAR(50),
  project_cost DECIMAL(18,2),
  project_scale VARCHAR(50),
  fund_year INT,
  percent_completion DECIMAL(5,2),      -- REMOVED (moved to logs)
  project_status VARCHAR(50),
  created_at DATETIME,
  updated_at DATETIME                    -- REMOVED (immutable design)
);
```

#### Target Schema (PostgreSQL)
```sql
projects (
  project_id UUID PRIMARY KEY,          -- UUID (migration: INT → UUID)
  deo_id INT REFERENCES deo(deo_id),
  project_title TEXT,
  location TEXT,
  fund_source VARCHAR(50),
  mode_of_implementation VARCHAR(50),
  project_cost NUMERIC(18,2),
  project_scale VARCHAR(50),
  fund_year INT,
  status VARCHAR(50),                    -- Renamed from project_status
  created_at TIMESTAMP,
  created_by UUID REFERENCES users(user_id) -- NEW FIELD
);
```

#### Migration Strategy

**Step 1: Create ID mapping table**
```sql
CREATE TABLE migration.project_id_map (
  legacy_id INT PRIMARY KEY,
  new_uuid UUID NOT NULL
);

INSERT INTO migration.project_id_map (legacy_id, new_uuid)
SELECT project_id, gen_random_uuid()
FROM legacy.projects;
```

**Step 2: Migrate project data**
```sql
INSERT INTO target.projects (
  project_id,
  deo_id,
  project_title,
  location,
  fund_source,
  mode_of_implementation,
  project_cost,
  project_scale,
  fund_year,
  status,
  created_at,
  created_by  -- Set to system user UUID
)
SELECT
  m.new_uuid,
  p.deo_id,
  p.project_title,
  p.location,
  p.fund_source,
  p.mode_of_implementation,
  p.project_cost,
  p.project_scale,
  p.fund_year,
  p.project_status,
  p.created_at,
  '00000000-0000-0000-0000-000000000001'::UUID  -- System migration user
FROM legacy.projects p
JOIN migration.project_id_map m ON p.project_id = m.legacy_id;
```

**Step 3: Migrate percent_completion to progress logs**
```sql
-- Create initial progress log entry for each project
INSERT INTO target.project_progress_logs (
  progress_id,
  project_id,
  reported_percent,
  report_date,
  remarks,
  reported_by,
  created_at,
  prev_hash,
  record_hash
)
SELECT
  gen_random_uuid(),
  m.new_uuid,
  p.percent_completion,
  COALESCE(p.updated_at, p.created_at),
  'Migrated from legacy system',
  '00000000-0000-0000-0000-000000000001'::UUID,
  COALESCE(p.updated_at, p.created_at),
  NULL,  -- First entry has no prev_hash
  encode(
    digest(
      m.new_uuid::TEXT || p.percent_completion::TEXT || COALESCE(p.updated_at, p.created_at)::TEXT,
      'sha256'
    ),
    'hex'
  )
FROM legacy.projects p
JOIN migration.project_id_map m ON p.project_id = m.legacy_id
WHERE p.percent_completion IS NOT NULL;
```

#### Field Transformations

| Legacy Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `project_id` (INT) | `project_id` (UUID) | Generate new UUID, maintain mapping |
| `percent_completion` | ⚠️ REMOVED | Migrated to `project_progress_logs` |
| `updated_at` | ⚠️ REMOVED | Used for initial progress log timestamp |
| `project_status` | `status` | Renamed for consistency |
| N/A | `created_by` (NEW) | Default to migration system user |

#### Data Quality Checks
- Verify all legacy projects have corresponding UUID
- Check for NULL `project_title` (should not exist)
- Validate `project_cost` >= 0
- Ensure `fund_year` is reasonable (e.g., 2010-2026)

---

### 2.3 Legacy `project_activity` → Target `project_progress_logs`

**Status:** Merged into immutable progress logs

#### Legacy Schema (MySQL)
```sql
project_activity (
  activity_id INT PRIMARY KEY,
  project_id INT,
  activity_description TEXT,
  percent_completion DECIMAL(5,2),
  activity_date DATE,
  updated_by VARCHAR(100)  -- String, not FK
);
```

#### Target Schema (PostgreSQL)
```sql
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
```

#### Migration Strategy

```sql
-- Migrate activity logs to progress logs (AFTER initial project migration)
INSERT INTO target.project_progress_logs (
  progress_id,
  project_id,
  reported_percent,
  report_date,
  remarks,
  reported_by,
  created_at,
  prev_hash,
  record_hash
)
SELECT
  gen_random_uuid(),
  m.new_uuid,
  pa.percent_completion,
  pa.activity_date,
  pa.activity_description,
  '00000000-0000-0000-0000-000000000001'::UUID,  -- System user (updated_by is not FK)
  pa.activity_date::TIMESTAMP,
  -- Calculate prev_hash based on chronological order
  LAG(
    encode(digest(m.new_uuid::TEXT || pa.percent_completion::TEXT, 'sha256'), 'hex')
  ) OVER (PARTITION BY pa.project_id ORDER BY pa.activity_date),
  encode(digest(m.new_uuid::TEXT || pa.percent_completion::TEXT, 'sha256'), 'hex')
FROM legacy.project_activity pa
JOIN migration.project_id_map m ON pa.project_id = m.legacy_id
ORDER BY pa.project_id, pa.activity_date;
```

#### Hash Chain Reconstruction

Since legacy data has no hash chain, we reconstruct it during migration:

```sql
-- Post-migration: Recalculate hash chain properly
WITH RECURSIVE hash_chain AS (
  -- Base case: First entry per project
  SELECT
    progress_id,
    project_id,
    reported_percent,
    report_date,
    reported_by,
    NULL::TEXT AS prev_hash,
    encode(
      digest(
        project_id::TEXT || reported_percent::TEXT || report_date::TEXT || '00000000-0000-0000-0000-000000000001',
        'sha256'
      ),
      'hex'
    ) AS record_hash,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS rn
  FROM target.project_progress_logs
  WHERE created_at = (
    SELECT MIN(created_at)
    FROM target.project_progress_logs ppl2
    WHERE ppl2.project_id = project_progress_logs.project_id
  )

  UNION ALL

  -- Recursive case: Chain subsequent entries
  SELECT
    ppl.progress_id,
    ppl.project_id,
    ppl.reported_percent,
    ppl.report_date,
    ppl.reported_by,
    hc.record_hash AS prev_hash,
    encode(
      digest(
        ppl.project_id::TEXT || ppl.reported_percent::TEXT || ppl.report_date::TEXT || hc.record_hash,
        'sha256'
      ),
      'hex'
    ) AS record_hash,
    hc.rn + 1
  FROM target.project_progress_logs ppl
  JOIN hash_chain hc ON ppl.project_id = hc.project_id
  WHERE ppl.created_at = (
    SELECT MIN(created_at)
    FROM target.project_progress_logs ppl2
    WHERE ppl2.project_id = hc.project_id
      AND ppl2.created_at > (
        SELECT created_at FROM target.project_progress_logs WHERE progress_id = hc.progress_id
      )
  )
)
UPDATE target.project_progress_logs ppl
SET
  prev_hash = hc.prev_hash,
  record_hash = hc.record_hash
FROM hash_chain hc
WHERE ppl.progress_id = hc.progress_id;
```

#### Field Transformations

| Legacy Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `activity_id` (INT) | `progress_id` (UUID) | Generate new UUID |
| `project_id` (INT) | `project_id` (UUID) | Use mapping table |
| `activity_description` | `remarks` | Direct copy |
| `percent_completion` | `reported_percent` | Direct copy |
| `updated_by` (VARCHAR) | `reported_by` (UUID) | Map to system user (no FK in legacy) |
| N/A | `prev_hash` (NEW) | Calculated during migration |
| N/A | `record_hash` (NEW) | Calculated during migration |

---

### 2.4 Legacy `project_photos` → Target `media_assets`

**Status:** Consolidated into unified media table

#### Legacy Schema (MySQL)
```sql
project_photos (
  photo_id INT PRIMARY KEY,
  project_id INT,
  file_path TEXT,              -- Filesystem path
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  capture_date DATETIME,
  uploaded_by VARCHAR(100)
);
```

#### Target Schema (PostgreSQL)
```sql
media_assets (
  media_id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(project_id),
  media_type VARCHAR(20),      -- 'photo'
  storage_key TEXT,            -- Object storage key
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  captured_at TIMESTAMP,
  uploaded_by UUID REFERENCES users(user_id),
  uploaded_at TIMESTAMP
);
```

#### Migration Strategy

**Step 1: Copy files to object storage**
```python
# Python migration script
import os
import boto3
from pathlib import Path

s3 = boto3.client('s3')
BUCKET = 'ebarmm-media'

for row in legacy_photos:
    legacy_path = row['file_path']  # e.g., /data/projects/photos/123/img001.jpg

    # Generate new storage key
    project_uuid = project_id_map[row['project_id']]
    filename = Path(legacy_path).name
    storage_key = f"photos/{project_uuid}/{uuid4()}/{filename}"

    # Upload to S3
    s3.upload_file(
        Filename=legacy_path,
        Bucket=BUCKET,
        Key=storage_key
    )

    # Record in database
    insert_media_asset(
        project_id=project_uuid,
        media_type='photo',
        storage_key=storage_key,
        latitude=row['latitude'],
        longitude=row['longitude'],
        captured_at=row['capture_date']
    )
```

**Step 2: Insert metadata into PostgreSQL**
```sql
INSERT INTO target.media_assets (
  media_id,
  project_id,
  media_type,
  storage_key,
  latitude,
  longitude,
  captured_at,
  uploaded_by,
  uploaded_at
)
SELECT
  gen_random_uuid(),
  m.new_uuid,
  'photo',
  -- Storage key generated by Python script (stored in temp table)
  migration.photo_storage_keys.storage_key,
  pp.latitude,
  pp.longitude,
  pp.capture_date,
  '00000000-0000-0000-0000-000000000001'::UUID,
  pp.capture_date
FROM legacy.project_photos pp
JOIN migration.project_id_map m ON pp.project_id = m.legacy_id
JOIN migration.photo_storage_keys psk ON pp.photo_id = psk.legacy_photo_id;
```

#### Field Transformations

| Legacy Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `photo_id` (INT) | `media_id` (UUID) | Generate new UUID |
| `project_id` (INT) | `project_id` (UUID) | Use mapping table |
| `file_path` | `storage_key` | Copy file to object storage, generate new key |
| N/A | `media_type` (NEW) | Hardcoded to 'photo' |
| `capture_date` | `captured_at` + `uploaded_at` | Assume same timestamp |
| `uploaded_by` (VARCHAR) | `uploaded_by` (UUID) | Map to system user |

---

### 2.5 Legacy `project_documents` → Target `media_assets`

**Status:** Merged into media_assets

#### Legacy Schema (MySQL)
```sql
project_documents (
  document_id INT PRIMARY KEY,
  project_id INT,
  document_title VARCHAR(255),
  file_path TEXT,
  file_type VARCHAR(20),
  upload_date DATETIME,
  uploaded_by VARCHAR(100)
);
```

#### Migration Strategy

Similar to photos, but:
- `media_type = 'document'`
- Store `document_title` in JSONB `attributes` column (requires schema addition)

```sql
-- Add attributes column to media_assets if needed
ALTER TABLE target.media_assets ADD COLUMN attributes JSONB;

INSERT INTO target.media_assets (
  media_id,
  project_id,
  media_type,
  storage_key,
  attributes,
  uploaded_by,
  uploaded_at
)
SELECT
  gen_random_uuid(),
  m.new_uuid,
  'document',
  migration.document_storage_keys.storage_key,
  jsonb_build_object(
    'title', pd.document_title,
    'file_type', pd.file_type
  ),
  '00000000-0000-0000-0000-000000000001'::UUID,
  pd.upload_date
FROM legacy.project_documents pd
JOIN migration.project_id_map m ON pd.project_id = m.legacy_id
JOIN migration.document_storage_keys dsk ON pd.document_id = dsk.legacy_document_id;
```

---

### 2.6 Legacy `routeshoot` + `drone_videos` → Target `media_assets`

**Status:** Merged into media_assets

#### Legacy Schema (MySQL)
```sql
routeshoot (
  routeshoot_id INT PRIMARY KEY,
  project_id INT,
  video_path TEXT,
  kml_path TEXT,
  upload_date DATETIME
);

drone_videos (
  drone_id INT PRIMARY KEY,
  project_id INT,
  video_path TEXT,
  kml_path TEXT,
  upload_date DATETIME
);
```

#### Migration Strategy

**Videos:**
```sql
-- Routeshoot videos
INSERT INTO target.media_assets (
  media_id,
  project_id,
  media_type,
  storage_key,
  attributes,
  uploaded_at
)
SELECT
  gen_random_uuid(),
  m.new_uuid,
  'video',
  migration.routeshoot_storage_keys.video_storage_key,
  jsonb_build_object('source', 'routeshoot'),
  rs.upload_date
FROM legacy.routeshoot rs
JOIN migration.project_id_map m ON rs.project_id = m.legacy_id;

-- Drone videos (same pattern)
INSERT INTO target.media_assets (...)
SELECT ... FROM legacy.drone_videos;
```

**KML Files → PostGIS Geometries:**
```python
# Python migration script
from fastkml import kml
import psycopg2
from shapely.geometry import mapping

for row in legacy_routeshoot:
    kml_path = row['kml_path']

    # Parse KML
    with open(kml_path, 'r') as f:
        k = kml.KML()
        k.from_string(f.read())

    # Extract geometries
    for feature in k.features():
        for placemark in feature.features():
            geom = placemark.geometry

            # Insert into gis_features
            cursor.execute("""
                INSERT INTO target.gis_features (
                    feature_id,
                    project_id,
                    feature_type,
                    geometry,
                    attributes
                ) VALUES (
                    gen_random_uuid(),
                    %s,
                    'route',
                    ST_GeomFromGeoJSON(%s),
                    %s
                )
            """, (
                project_uuid,
                json.dumps(mapping(geom)),
                json.dumps({'source': 'routeshoot', 'name': placemark.name})
            ))
```

---

### 2.7 Legacy `gis_layers` → Target `gis_features`

**Status:** Major transformation (files → native geometries)

#### Legacy Schema (MySQL)
```sql
gis_layers (
  layer_id INT PRIMARY KEY,
  project_id INT,
  shapefile_path TEXT,
  layer_type VARCHAR(50),
  upload_date DATETIME
);
```

#### Target Schema (PostgreSQL)
```sql
gis_features (
  feature_id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(project_id),
  feature_type VARCHAR(30),
  geometry GEOMETRY(GEOMETRY, 4326),
  attributes JSONB,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP
);
```

#### Migration Strategy

**Convert Shapefiles to PostGIS:**
```python
import geopandas as gpd
import psycopg2
from sqlalchemy import create_engine

engine = create_engine('postgresql://user:pass@localhost/ebarmm')

for row in legacy_gis_layers:
    shapefile_path = row['shapefile_path']

    # Read shapefile
    gdf = gpd.read_file(shapefile_path)

    # Reproject to WGS84 if needed
    if gdf.crs != 'EPSG:4326':
        gdf = gdf.to_crs('EPSG:4326')

    # Insert each feature
    for idx, feature in gdf.iterrows():
        cursor.execute("""
            INSERT INTO target.gis_features (
                feature_id,
                project_id,
                feature_type,
                geometry,
                attributes,
                created_by,
                created_at
            ) VALUES (
                gen_random_uuid(),
                %s,
                %s,
                ST_GeomFromText(%s, 4326),
                %s,
                '00000000-0000-0000-0000-000000000001'::UUID,
                %s
            )
        """, (
            project_uuid,
            row['layer_type'],
            feature.geometry.wkt,
            json.dumps(feature.drop('geometry').to_dict()),
            row['upload_date']
        ))
```

**Create Spatial Index:**
```sql
CREATE INDEX idx_gis_features_geometry
ON gis_features
USING GIST (geometry);
```

#### Field Transformations

| Legacy Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `layer_id` (INT) | Multiple `feature_id` (UUID) | 1 layer → N features |
| `shapefile_path` | `geometry` | Parse shapefile, extract geometries |
| `layer_type` | `feature_type` | Direct copy |
| N/A | `attributes` (NEW) | Shapefile attribute table → JSONB |

---

### 2.8 New Target Tables (No Legacy Equivalent)

#### 2.8.1 `users` Table

**Purpose:** Authentication and RBAC (legacy had no user table)

**Bootstrap Data:**
```sql
-- Create system migration user
INSERT INTO users (user_id, username, password_hash, role, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system_migration',
  '',  -- No password (cannot login)
  'super_admin',
  false
);

-- Create default super admin
INSERT INTO users (user_id, username, password_hash, role, is_active)
VALUES (
  gen_random_uuid(),
  'admin',
  '$2b$12$...', -- bcrypt hash of default password
  'super_admin',
  true
);

-- Create DEO users (one per DEO)
INSERT INTO users (user_id, username, password_hash, role, deo_id, is_active)
SELECT
  gen_random_uuid(),
  'deo_' || deo_id,
  '$2b$12$...', -- Default password, must change on first login
  'deo_user',
  deo_id,
  true
FROM deo;
```

#### 2.8.2 `audit_logs` Table

**No legacy data to migrate** (new feature)

Initial audit log entries for migration:
```sql
INSERT INTO audit_logs (
  audit_id,
  actor_id,
  action,
  entity_type,
  entity_id,
  payload,
  created_at
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'MIGRATE',
  'project',
  project_id,
  jsonb_build_object('legacy_id', legacy_id),
  NOW()
FROM migration.project_id_map;
```

#### 2.8.3 `geofencing_rules` Table

**No legacy data** (new feature for GIS validation)

Example initial rule:
```sql
-- Restrict projects to BARMM region boundary
INSERT INTO geofencing_rules (
  rule_id,
  project_id,
  geometry,
  rule_type
)
SELECT
  gen_random_uuid(),
  NULL,  -- Global rule
  ST_GeomFromGeoJSON('...'),  -- BARMM boundary polygon
  'region_boundary'
FROM (VALUES (1)) AS dummy;
```

#### 2.8.4 `alerts` Table

**No legacy data** (new feature for automated monitoring)

---

## 3. MIGRATION VERIFICATION QUERIES

### 3.1 Record Count Validation
```sql
-- Verify project count
SELECT 'legacy' AS source, COUNT(*) FROM legacy.projects
UNION ALL
SELECT 'target', COUNT(*) FROM target.projects;

-- Verify progress log count
SELECT 'legacy (projects + activities)' AS source,
  (SELECT COUNT(*) FROM legacy.projects WHERE percent_completion IS NOT NULL) +
  (SELECT COUNT(*) FROM legacy.project_activity)
UNION ALL
SELECT 'target', COUNT(*) FROM target.project_progress_logs;

-- Verify media count
SELECT 'legacy (photos + docs + videos)' AS source,
  (SELECT COUNT(*) FROM legacy.project_photos) +
  (SELECT COUNT(*) FROM legacy.project_documents) +
  (SELECT COUNT(*) FROM legacy.routeshoot) +
  (SELECT COUNT(*) FROM legacy.drone_videos)
UNION ALL
SELECT 'target', COUNT(*) FROM target.media_assets;
```

### 3.2 Data Integrity Checks
```sql
-- Check for orphaned records
SELECT COUNT(*) AS orphaned_progress_logs
FROM target.project_progress_logs ppl
LEFT JOIN target.projects p ON ppl.project_id = p.project_id
WHERE p.project_id IS NULL;

-- Verify hash chain integrity
SELECT
  project_id,
  COUNT(*) AS log_count,
  COUNT(*) FILTER (WHERE prev_hash IS NULL) AS chain_starts,
  COUNT(*) FILTER (WHERE record_hash IS NULL) AS broken_hashes
FROM target.project_progress_logs
GROUP BY project_id
HAVING COUNT(*) FILTER (WHERE prev_hash IS NULL) != 1  -- Should be exactly 1
    OR COUNT(*) FILTER (WHERE record_hash IS NULL) > 0;  -- Should be 0

-- Check GIS feature validity
SELECT COUNT(*) AS invalid_geometries
FROM target.gis_features
WHERE NOT ST_IsValid(geometry);
```

### 3.3 Business Logic Validation
```sql
-- Verify current progress matches latest log entry
SELECT
  p.project_id,
  p.project_title,
  (SELECT reported_percent
   FROM target.project_progress_logs
   WHERE project_id = p.project_id
   ORDER BY created_at DESC
   LIMIT 1) AS current_progress_from_logs,
  lp.percent_completion AS legacy_progress
FROM target.projects p
JOIN migration.project_id_map m ON p.project_id = m.new_uuid
JOIN legacy.projects lp ON lp.project_id = m.legacy_id
WHERE (
  SELECT reported_percent
  FROM target.project_progress_logs
  WHERE project_id = p.project_id
  ORDER BY created_at DESC
  LIMIT 1
) != lp.percent_completion;
```

---

## 4. ROLLBACK STRATEGY

### 4.1 Pre-Migration Backup
```bash
# Full MySQL dump
mysqldump -u root -p earmm2019 > legacy_backup_$(date +%Y%m%d).sql

# Filesystem backup
tar -czf legacy_files_$(date +%Y%m%d).tar.gz /data/projects/

# PostgreSQL baseline (empty target schema)
pg_dump -U postgres ebarmm --schema-only > target_schema_baseline.sql
```

### 4.2 Rollback Procedure
If migration fails:
```sql
-- Drop all target tables
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore baseline schema
\i target_schema_baseline.sql

-- Re-run migration from step 1
```

### 4.3 Partial Rollback (Table-Level)
```sql
-- Rollback specific table
TRUNCATE target.project_progress_logs CASCADE;

-- Re-run migration for that table only
```

---

## 5. MIGRATION TIMELINE ESTIMATE

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Schema creation | 1 day | None |
| DEO table migration | 1 hour | Schema |
| User bootstrap | 2 hours | DEO migration |
| Project migration + UUID mapping | 1 day | User bootstrap |
| Progress log migration + hash chain | 2 days | Project migration |
| Media file copy to object storage | 3 days | Infrastructure setup |
| Media metadata migration | 1 day | File copy complete |
| GIS shapefile/KML conversion | 4 days | Project migration |
| Audit log initialization | 4 hours | All migrations |
| Data validation | 2 days | All migrations |
| **TOTAL** | **~2 weeks** | |

---

## 6. POST-MIGRATION CLEANUP

### 6.1 Drop Migration Tables
```sql
DROP TABLE migration.project_id_map;
DROP TABLE migration.photo_storage_keys;
DROP TABLE migration.document_storage_keys;
DROP TABLE migration.routeshoot_storage_keys;
```

### 6.2 Legacy System Decommission
- Set legacy MySQL to READ-ONLY mode
- Maintain for 90 days as backup
- Archive to cold storage after validation period

### 6.3 Legacy File Archive
- Keep original files in /data/projects_archive/
- Do NOT delete until after 6 months of production use

---

## 7. SUMMARY OF CHANGES

### Dropped Fields (Intentional)
- `projects.updated_at` → Immutability principle (use audit_logs instead)
- `projects.percent_completion` → Moved to append-only progress_logs

### New Fields (Enhancements)
- All tables: UUID primary keys (better distribution, no collision)
- `projects.created_by` → Audit trail
- `project_progress_logs.prev_hash` + `record_hash` → Tamper-proof
- `media_assets.attributes` → Flexible metadata (JSONB)
- `gis_features.geometry` → Native spatial data (vs. file paths)

### Architectural Shifts
1. **INT → UUID**: Better for distributed systems, no auto-increment collisions
2. **File paths → Object storage**: Scalable, S3-compatible
3. **Shapefiles → PostGIS**: Queryable, indexed, version-controlled
4. **Mutable progress → Immutable logs**: Tamper-proof, full history
5. **No RBAC → Full RBAC**: Users table with roles

This mapping ensures full traceability from legacy to target system while fixing critical design flaws.
