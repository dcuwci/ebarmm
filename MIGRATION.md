# Migration Strategy: Legacy to Target System

## 1. MIGRATION OVERVIEW

### 1.1 Scope

**Source System:**
- MySQL database (`earmm2019`)
- PHP web application
- Filesystem-based GIS (shapefiles, KML)
- Filesystem-based media storage

**Target System:**
- PostgreSQL + PostGIS database
- FastAPI backend
- React frontend
- Android mobile app
- S3-compatible object storage

**Data Volume (Estimates):**
- ~50,000 projects
- ~500,000 progress/activity records
- ~200,000 photos
- ~10,000 documents
- ~5,000 video files
- ~50,000 GIS features (from shapefiles/KML)

---

### 1.2 Migration Phases

```
Phase 1: Infrastructure Setup (Week 1)
  ├── PostgreSQL + PostGIS installation
  ├── Object storage configuration
  └── Network/security setup

Phase 2: Schema Creation & Testing (Week 1-2)
  ├── Create target database schema
  ├── Create indexes and constraints
  └── Test database triggers

Phase 3: Data Migration (Week 2-3)
  ├── DEO table migration
  ├── User bootstrap
  ├── Projects migration (INT → UUID)
  ├── Progress logs migration + hash chain
  ├── Media file transfer to object storage
  ├── Media metadata migration
  └── GIS conversion (shapefile → PostGIS)

Phase 4: Application Deployment (Week 3)
  ├── Deploy FastAPI backend
  ├── Deploy React frontend
  └── Configure mobile app

Phase 5: Validation & Testing (Week 4)
  ├── Data integrity verification
  ├── Hash chain validation
  ├── User acceptance testing
  └── Performance testing

Phase 6: Cutover & Monitoring (Week 5)
  ├── Final sync
  ├── Switch DNS/traffic
  ├── Decommission legacy
  └── Post-migration monitoring
```

---

## 2. PRE-MIGRATION PREPARATION

### 2.1 Legacy System Backup

**Full Backup:**
```bash
#!/bin/bash
# backup_legacy.sh

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/legacy_$BACKUP_DATE"

mkdir -p $BACKUP_DIR

# 1. MySQL dump
echo "Backing up MySQL database..."
mysqldump -u root -p earmm2019 \
  --single-transaction \
  --routines \
  --triggers \
  > $BACKUP_DIR/earmm2019_$BACKUP_DATE.sql

# 2. Filesystem backup
echo "Backing up project files..."
tar -czf $BACKUP_DIR/project_files_$BACKUP_DATE.tar.gz \
  /data/projects/

# 3. Application code
echo "Backing up application code..."
tar -czf $BACKUP_DIR/php_app_$BACKUP_DATE.tar.gz \
  /var/www/ebarmm/

# 4. Configuration files
echo "Backing up configuration..."
cp /etc/mysql/my.cnf $BACKUP_DIR/
cp /etc/apache2/sites-available/ebarmm.conf $BACKUP_DIR/

# 5. Create checksums
cd $BACKUP_DIR
md5sum * > checksums.md5

echo "Backup completed: $BACKUP_DIR"
```

**Verify Backup:**
```bash
# Verify MySQL dump
mysql -u root -p -e "CREATE DATABASE test_restore"
mysql -u root -p test_restore < $BACKUP_DIR/earmm2019_$BACKUP_DATE.sql
mysql -u root -p -e "DROP DATABASE test_restore"

# Verify tar archives
tar -tzf $BACKUP_DIR/project_files_$BACKUP_DATE.tar.gz | head -20

# Verify checksums
cd $BACKUP_DIR
md5sum -c checksums.md5
```

---

### 2.2 Infrastructure Setup (Target)

**PostgreSQL + PostGIS Installation:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y postgresql-15 postgresql-15-postgis-3

# Initialize database
sudo -u postgres psql -c "CREATE DATABASE ebarmm;"
sudo -u postgres psql -d ebarmm -c "CREATE EXTENSION postgis;"
sudo -u postgres psql -d ebarmm -c "CREATE EXTENSION postgis_topology;"

# Create database user
sudo -u postgres psql -c "CREATE USER ebarmm_app WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ebarmm TO ebarmm_app;"
```

**Object Storage Setup (MinIO):**
```bash
# Install MinIO (S3-compatible)
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# Create storage directory
sudo mkdir -p /mnt/minio-data

# Start MinIO
minio server /mnt/minio-data --console-address ":9001"

# Create bucket
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/ebarmm-media
mc policy set download local/ebarmm-media  # Public read
```

**Network Configuration:**
```
Legacy System:      192.168.1.10 (ebarmm.local)
Target Database:    192.168.1.20 (db.ebarmm.local)
Target API:         192.168.1.21 (api.ebarmm.local)
Target Frontend:    192.168.1.22 (ebarmm.gov.ph)
Object Storage:     192.168.1.23 (s3.ebarmm.local)
```

---

## 3. SCHEMA CREATION

### 3.1 Target Schema Deployment

**Run DDL Scripts:**
```bash
# Create all tables
psql -h 192.168.1.20 -U ebarmm_app -d ebarmm -f schema/01_create_tables.sql

# Create indexes
psql -h 192.168.1.20 -U ebarmm_app -d ebarmm -f schema/02_create_indexes.sql

# Create triggers
psql -h 192.168.1.20 -U ebarmm_app -d ebarmm -f schema/03_create_triggers.sql

# Create RLS policies
psql -h 192.168.1.20 -U ebarmm_app -d ebarmm -f schema/04_create_rls.sql
```

**Schema Files:**

`schema/01_create_tables.sql`:
```sql
-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL,
  deo_id INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- DEO table
CREATE TABLE deo (
  deo_id INT PRIMARY KEY,
  deo_name VARCHAR(100),
  province VARCHAR(100),
  region VARCHAR(50)
);

-- Projects table
CREATE TABLE projects (
  project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deo_id INT REFERENCES deo(deo_id),
  project_title TEXT NOT NULL,
  location TEXT,
  fund_source VARCHAR(50),
  mode_of_implementation VARCHAR(50),
  project_cost NUMERIC(18,2),
  project_scale VARCHAR(50),
  fund_year INT,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(user_id)
);

-- Progress logs (immutable)
CREATE TABLE project_progress_logs (
  progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
  reported_percent NUMERIC(5,2) CHECK (reported_percent >= 0 AND reported_percent <= 100),
  report_date DATE NOT NULL,
  remarks TEXT,
  reported_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  prev_hash TEXT,
  record_hash TEXT NOT NULL
);

-- GIS features
CREATE TABLE gis_features (
  feature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
  feature_type VARCHAR(30),
  geometry GEOMETRY(GEOMETRY, 4326),
  attributes JSONB,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Media assets
CREATE TABLE media_assets (
  media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
  media_type VARCHAR(20),
  storage_key TEXT NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  captured_at TIMESTAMP,
  uploaded_by UUID REFERENCES users(user_id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  attributes JSONB
);

-- Audit logs (immutable)
CREATE TABLE audit_logs (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(user_id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  prev_hash TEXT,
  record_hash TEXT
);

-- Geofencing rules
CREATE TABLE geofencing_rules (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(project_id),
  geometry GEOMETRY(POLYGON, 4326),
  rule_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alerts
CREATE TABLE alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(project_id),
  alert_type VARCHAR(50),
  message TEXT,
  triggered_at TIMESTAMP DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false
);
```

`schema/02_create_indexes.sql`:
```sql
-- Projects indexes
CREATE INDEX idx_projects_deo_id ON projects(deo_id);
CREATE INDEX idx_projects_fund_year ON projects(fund_year);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- Progress logs indexes
CREATE INDEX idx_progress_logs_project_id ON project_progress_logs(project_id);
CREATE INDEX idx_progress_logs_created_at ON project_progress_logs(created_at);

-- GIS features spatial index
CREATE INDEX idx_gis_features_geometry ON gis_features USING GIST(geometry);
CREATE INDEX idx_gis_features_project_id ON gis_features(project_id);

-- Media assets indexes
CREATE INDEX idx_media_assets_project_id ON media_assets(project_id);
CREATE INDEX idx_media_assets_media_type ON media_assets(media_type);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
```

`schema/03_create_triggers.sql`:
```sql
-- Function to prevent mutations
CREATE OR REPLACE FUNCTION reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'This table is immutable. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

-- Prevent progress log mutations
CREATE TRIGGER prevent_progress_update
BEFORE UPDATE ON project_progress_logs
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER prevent_progress_delete
BEFORE DELETE ON project_progress_logs
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Prevent audit log mutations
CREATE TRIGGER prevent_audit_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER prevent_audit_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_mutation();
```

---

## 4. DATA MIGRATION SCRIPTS

### 4.1 Migration Framework (Python)

**Project Structure:**
```
migration/
├── requirements.txt
├── config.py
├── run_migration.py
├── scripts/
│   ├── 01_migrate_deo.py
│   ├── 02_bootstrap_users.py
│   ├── 03_migrate_projects.py
│   ├── 04_migrate_progress.py
│   ├── 05_migrate_media.py
│   └── 06_migrate_gis.py
└── utils/
    ├── database.py
    ├── hash_calculator.py
    └── s3_uploader.py
```

**config.py:**
```python
import os
from dataclasses import dataclass

@dataclass
class LegacyConfig:
    host: str = "192.168.1.10"
    user: str = "root"
    password: str = os.getenv("LEGACY_DB_PASSWORD")
    database: str = "earmm2019"

@dataclass
class TargetConfig:
    host: str = "192.168.1.20"
    user: str = "ebarmm_app"
    password: str = os.getenv("TARGET_DB_PASSWORD")
    database: str = "ebarmm"

@dataclass
class S3Config:
    endpoint: str = "http://192.168.1.23:9000"
    access_key: str = os.getenv("S3_ACCESS_KEY")
    secret_key: str = os.getenv("S3_SECRET_KEY")
    bucket: str = "ebarmm-media"

legacy_config = LegacyConfig()
target_config = TargetConfig()
s3_config = S3Config()
```

**utils/database.py:**
```python
import mysql.connector
import psycopg2
from psycopg2.extras import execute_batch
from contextlib import contextmanager

@contextmanager
def get_legacy_connection():
    conn = mysql.connector.connect(
        host=legacy_config.host,
        user=legacy_config.user,
        password=legacy_config.password,
        database=legacy_config.database
    )
    try:
        yield conn
    finally:
        conn.close()

@contextmanager
def get_target_connection():
    conn = psycopg2.connect(
        host=target_config.host,
        user=target_config.user,
        password=target_config.password,
        database=target_config.database
    )
    try:
        yield conn
    finally:
        conn.close()
```

---

### 4.2 DEO Migration Script

**scripts/01_migrate_deo.py:**
```python
import logging
from utils.database import get_legacy_connection, get_target_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_deo():
    logger.info("Starting DEO migration...")

    with get_legacy_connection() as legacy_conn:
        legacy_cursor = legacy_conn.cursor(dictionary=True)
        legacy_cursor.execute("SELECT * FROM deo")
        deo_records = legacy_cursor.fetchall()

    logger.info(f"Found {len(deo_records)} DEO records")

    with get_target_connection() as target_conn:
        target_cursor = target_conn.cursor()

        for deo in deo_records:
            target_cursor.execute("""
                INSERT INTO deo (deo_id, deo_name, province, region)
                VALUES (%(deo_id)s, %(deo_name)s, %(province)s, %(region)s)
                ON CONFLICT (deo_id) DO NOTHING
            """, deo)

        target_conn.commit()

    logger.info("DEO migration completed")

if __name__ == "__main__":
    migrate_deo()
```

---

### 4.3 User Bootstrap Script

**scripts/02_bootstrap_users.py:**
```python
import logging
from uuid import uuid4
from passlib.hash import bcrypt
from utils.database import get_target_connection

logger = logging.getLogger(__name__)

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"

def bootstrap_users():
    logger.info("Bootstrapping users...")

    with get_target_connection() as conn:
        cursor = conn.cursor()

        # 1. Create system migration user
        cursor.execute("""
            INSERT INTO users (user_id, username, password_hash, role, is_active)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO NOTHING
        """, (SYSTEM_USER_ID, "system_migration", "", "super_admin", False))

        # 2. Create default super admin
        admin_password = bcrypt.hash("ChangeMe123!")
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (username) DO NOTHING
            RETURNING user_id
        """, ("admin", admin_password, "super_admin", True))

        # 3. Create DEO users
        cursor.execute("SELECT deo_id, deo_name FROM deo")
        deo_records = cursor.fetchall()

        for deo_id, deo_name in deo_records:
            username = f"deo_{deo_id}"
            default_password = bcrypt.hash("Deo@2026")

            cursor.execute("""
                INSERT INTO users (username, password_hash, role, deo_id, is_active)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (username) DO NOTHING
            """, (username, default_password, "deo_user", deo_id, True))

        conn.commit()

    logger.info("User bootstrap completed")

if __name__ == "__main__":
    bootstrap_users()
```

---

### 4.4 Projects Migration Script

**scripts/03_migrate_projects.py:**
```python
import logging
from uuid import uuid4
from utils.database import get_legacy_connection, get_target_connection

logger = logging.getLogger(__name__)
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"

def migrate_projects():
    logger.info("Starting projects migration...")

    # Create mapping table in target DB
    with get_target_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TEMP TABLE project_id_map (
                legacy_id INT PRIMARY KEY,
                new_uuid UUID NOT NULL
            )
        """)
        conn.commit()

    # Fetch legacy projects
    with get_legacy_connection() as legacy_conn:
        legacy_cursor = legacy_conn.cursor(dictionary=True)
        legacy_cursor.execute("SELECT * FROM projects")
        legacy_projects = legacy_cursor.fetchall()

    logger.info(f"Found {len(legacy_projects)} projects to migrate")

    # Migrate projects
    with get_target_connection() as target_conn:
        target_cursor = target_conn.cursor()

        for project in legacy_projects:
            new_uuid = str(uuid4())

            # Insert into projects table
            target_cursor.execute("""
                INSERT INTO projects (
                    project_id, deo_id, project_title, location,
                    fund_source, mode_of_implementation, project_cost,
                    project_scale, fund_year, status,
                    created_at, created_by
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """, (
                new_uuid,
                project['deo_id'],
                project['project_title'],
                project['location'],
                project['fund_source'],
                project['mode_of_implementation'],
                project['project_cost'],
                project['project_scale'],
                project['fund_year'],
                project['project_status'],  # Maps to status
                project['created_at'],
                SYSTEM_USER_ID
            ))

            # Store mapping
            target_cursor.execute("""
                INSERT INTO project_id_map (legacy_id, new_uuid)
                VALUES (%s, %s)
            """, (project['project_id'], new_uuid))

            # Migrate initial progress log (from percent_completion)
            if project['percent_completion'] is not None:
                from utils.hash_calculator import calculate_progress_hash

                progress_id = str(uuid4())
                report_date = project.get('updated_at') or project['created_at']

                record_hash = calculate_progress_hash(
                    project_id=new_uuid,
                    reported_percent=float(project['percent_completion']),
                    report_date=str(report_date.date()),
                    reported_by=SYSTEM_USER_ID,
                    prev_hash=None
                )

                target_cursor.execute("""
                    INSERT INTO project_progress_logs (
                        progress_id, project_id, reported_percent,
                        report_date, remarks, reported_by,
                        created_at, prev_hash, record_hash
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    progress_id,
                    new_uuid,
                    project['percent_completion'],
                    report_date.date(),
                    "Migrated from legacy system",
                    SYSTEM_USER_ID,
                    report_date,
                    None,
                    record_hash
                ))

        target_conn.commit()

    # Export mapping to persistent table
    with get_target_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS migration_project_id_map (
                legacy_id INT PRIMARY KEY,
                new_uuid UUID NOT NULL
            )
        """)
        cursor.execute("""
            INSERT INTO migration_project_id_map
            SELECT * FROM project_id_map
        """)
        conn.commit()

    logger.info("Projects migration completed")

if __name__ == "__main__":
    migrate_projects()
```

---

### 4.5 Progress Activity Migration

**scripts/04_migrate_progress.py:**
```python
import logging
from uuid import uuid4
from utils.database import get_legacy_connection, get_target_connection
from utils.hash_calculator import calculate_progress_hash

logger = logging.getLogger(__name__)
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"

def migrate_progress_activity():
    logger.info("Starting progress activity migration...")

    # Fetch legacy activity records
    with get_legacy_connection() as legacy_conn:
        cursor = legacy_conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT * FROM project_activity
            ORDER BY project_id, activity_date
        """)
        activities = cursor.fetchall()

    logger.info(f"Found {len(activities)} activity records")

    # Fetch project ID mapping
    with get_target_connection() as target_conn:
        cursor = target_conn.cursor()
        cursor.execute("SELECT legacy_id, new_uuid FROM migration_project_id_map")
        id_map = {legacy_id: new_uuid for legacy_id, new_uuid in cursor.fetchall()}

    # Migrate activities
    with get_target_connection() as target_conn:
        cursor = target_conn.cursor()

        for activity in activities:
            legacy_project_id = activity['project_id']
            new_project_id = id_map.get(legacy_project_id)

            if not new_project_id:
                logger.warning(f"No mapping for project {legacy_project_id}, skipping")
                continue

            # Get previous hash for this project
            cursor.execute("""
                SELECT record_hash FROM project_progress_logs
                WHERE project_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (new_project_id,))

            result = cursor.fetchone()
            prev_hash = result[0] if result else None

            # Calculate hash
            progress_id = str(uuid4())
            report_date = str(activity['activity_date'])

            record_hash = calculate_progress_hash(
                project_id=str(new_project_id),
                reported_percent=float(activity['percent_completion']),
                report_date=report_date,
                reported_by=SYSTEM_USER_ID,
                prev_hash=prev_hash
            )

            # Insert progress log
            cursor.execute("""
                INSERT INTO project_progress_logs (
                    progress_id, project_id, reported_percent,
                    report_date, remarks, reported_by,
                    created_at, prev_hash, record_hash
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                progress_id,
                new_project_id,
                activity['percent_completion'],
                activity['activity_date'],
                activity['activity_description'],
                SYSTEM_USER_ID,
                activity['activity_date'],
                prev_hash,
                record_hash
            ))

        target_conn.commit()

    logger.info("Progress activity migration completed")

if __name__ == "__main__":
    migrate_progress_activity()
```

---

### 4.6 Media Migration Script

**scripts/05_migrate_media.py:**
```python
import logging
import os
from uuid import uuid4
from pathlib import Path
import boto3
from utils.database import get_legacy_connection, get_target_connection
from config import s3_config

logger = logging.getLogger(__name__)
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"

# Initialize S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=s3_config.endpoint,
    aws_access_key_id=s3_config.access_key,
    aws_secret_access_key=s3_config.secret_key
)

def migrate_media():
    logger.info("Starting media migration...")

    # Fetch project ID mapping
    with get_target_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT legacy_id, new_uuid FROM migration_project_id_map")
        id_map = {legacy_id: new_uuid for legacy_id, new_uuid in cursor.fetchall()}

    # Migrate photos
    with get_legacy_connection() as legacy_conn:
        cursor = legacy_conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM project_photos")
        photos = cursor.fetchall()

    logger.info(f"Migrating {len(photos)} photos...")

    for photo in photos:
        new_project_id = id_map.get(photo['project_id'])
        if not new_project_id:
            continue

        legacy_path = photo['file_path']
        if not os.path.exists(legacy_path):
            logger.warning(f"File not found: {legacy_path}")
            continue

        # Generate storage key
        media_id = str(uuid4())
        filename = Path(legacy_path).name
        storage_key = f"photos/{new_project_id}/{media_id}/{filename}"

        # Upload to S3
        try:
            s3_client.upload_file(
                Filename=legacy_path,
                Bucket=s3_config.bucket,
                Key=storage_key
            )
        except Exception as e:
            logger.error(f"S3 upload failed for {legacy_path}: {e}")
            continue

        # Insert metadata
        with get_target_connection() as target_conn:
            cursor = target_conn.cursor()
            cursor.execute("""
                INSERT INTO media_assets (
                    media_id, project_id, media_type, storage_key,
                    latitude, longitude, captured_at,
                    uploaded_by, uploaded_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                media_id,
                new_project_id,
                'photo',
                storage_key,
                photo.get('latitude'),
                photo.get('longitude'),
                photo.get('capture_date'),
                SYSTEM_USER_ID,
                photo.get('capture_date')
            ))
            target_conn.commit()

    logger.info("Media migration completed")

if __name__ == "__main__":
    migrate_media()
```

---

### 4.7 GIS Migration Script

**scripts/06_migrate_gis.py:**
```python
import logging
import os
from uuid import uuid4
import geopandas as gpd
from utils.database import get_legacy_connection, get_target_connection

logger = logging.getLogger(__name__)
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"

def migrate_gis():
    logger.info("Starting GIS migration...")

    # Fetch project ID mapping
    with get_target_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT legacy_id, new_uuid FROM migration_project_id_map")
        id_map = {legacy_id: new_uuid for legacy_id, new_uuid in cursor.fetchall()}

    # Fetch GIS layer records
    with get_legacy_connection() as legacy_conn:
        cursor = legacy_conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM gis_layers")
        gis_layers = cursor.fetchall()

    logger.info(f"Found {len(gis_layers)} GIS layers")

    for layer in gis_layers:
        new_project_id = id_map.get(layer['project_id'])
        if not new_project_id:
            continue

        shapefile_path = layer['shapefile_path']
        if not os.path.exists(shapefile_path):
            logger.warning(f"Shapefile not found: {shapefile_path}")
            continue

        # Read shapefile
        try:
            gdf = gpd.read_file(shapefile_path)

            # Reproject to WGS84 if needed
            if gdf.crs and gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')

        except Exception as e:
            logger.error(f"Failed to read shapefile {shapefile_path}: {e}")
            continue

        # Insert each feature
        with get_target_connection() as target_conn:
            cursor = target_conn.cursor()

            for idx, row in gdf.iterrows():
                feature_id = str(uuid4())
                geometry_wkt = row.geometry.wkt

                # Extract attributes (all columns except geometry)
                attributes = row.drop('geometry').to_dict()

                cursor.execute("""
                    INSERT INTO gis_features (
                        feature_id, project_id, feature_type,
                        geometry, attributes,
                        created_by, created_at
                    ) VALUES (
                        %s, %s, %s,
                        ST_GeomFromText(%s, 4326), %s,
                        %s, %s
                    )
                """, (
                    feature_id,
                    new_project_id,
                    layer['layer_type'],
                    geometry_wkt,
                    json.dumps(attributes),
                    SYSTEM_USER_ID,
                    layer['upload_date']
                ))

            target_conn.commit()

        logger.info(f"Migrated {len(gdf)} features from {shapefile_path}")

    logger.info("GIS migration completed")

if __name__ == "__main__":
    migrate_gis()
```

---

## 5. VALIDATION & TESTING

### 5.1 Data Validation Script

**validate_migration.py:**
```python
import logging
from utils.database import get_legacy_connection, get_target_connection

logger = logging.getLogger(__name__)

def validate_migration():
    logger.info("Starting migration validation...")

    # 1. Record count validation
    with get_legacy_connection() as legacy_conn:
        legacy_cursor = legacy_conn.cursor()
        legacy_cursor.execute("SELECT COUNT(*) FROM projects")
        legacy_project_count = legacy_cursor.fetchone()[0]

        legacy_cursor.execute("SELECT COUNT(*) FROM project_photos")
        legacy_photo_count = legacy_cursor.fetchone()[0]

    with get_target_connection() as target_conn:
        target_cursor = target_conn.cursor()
        target_cursor.execute("SELECT COUNT(*) FROM projects")
        target_project_count = target_cursor.fetchone()[0]

        target_cursor.execute("SELECT COUNT(*) FROM media_assets WHERE media_type = 'photo'")
        target_photo_count = target_cursor.fetchone()[0]

    logger.info(f"Projects: Legacy={legacy_project_count}, Target={target_project_count}")
    logger.info(f"Photos: Legacy={legacy_photo_count}, Target={target_photo_count}")

    assert legacy_project_count == target_project_count, "Project count mismatch!"
    assert legacy_photo_count == target_photo_count, "Photo count mismatch!"

    # 2. Hash chain validation
    target_cursor.execute("SELECT DISTINCT project_id FROM project_progress_logs")
    project_ids = [row[0] for row in target_cursor.fetchall()]

    broken_chains = []
    for project_id in project_ids:
        target_cursor.execute("""
            SELECT progress_id, record_hash, prev_hash
            FROM project_progress_logs
            WHERE project_id = %s
            ORDER BY created_at
        """, (project_id,))

        logs = target_cursor.fetchall()
        prev_hash = None

        for progress_id, record_hash, stored_prev_hash in logs:
            if stored_prev_hash != prev_hash:
                broken_chains.append(project_id)
                break
            prev_hash = record_hash

    if broken_chains:
        logger.error(f"Broken hash chains in {len(broken_chains)} projects")
        raise Exception("Hash chain validation failed!")

    logger.info("All validations passed!")

if __name__ == "__main__":
    validate_migration()
```

---

## 6. CUTOVER PLAN

### 6.1 Final Cutover Steps

**Day Before Cutover:**
1. Announce maintenance window (e.g., Saturday 2 AM - 6 AM)
2. Set legacy system to READ-ONLY mode
3. Run final incremental migration
4. Validate all data
5. Test target system (smoke tests)

**Cutover Day:**
```
02:00 - Set legacy system to maintenance mode
02:10 - Run final sync (new records since last migration)
02:30 - Validate data
03:00 - Start FastAPI backend
03:10 - Start React frontend
03:20 - Update DNS records (ebarmm.gov.ph → 192.168.1.22)
03:30 - Monitor logs for errors
04:00 - User acceptance testing
05:00 - Go/No-Go decision
05:30 - Public announcement (if Go)
06:00 - End maintenance window
```

**Rollback Trigger:**
- Data integrity issues
- Critical bugs discovered
- Performance degradation
- Hash chain failures

**Rollback Procedure:**
```
1. Revert DNS to legacy system
2. Re-enable legacy PHP application
3. Notify users of rollback
4. Investigate and fix issues
5. Schedule new cutover date
```

---

## 7. POST-MIGRATION MONITORING

### 7.1 Monitoring Checklist (First 30 Days)

**Daily:**
- [ ] Verify hash chain integrity (all projects)
- [ ] Check API error rates
- [ ] Monitor database performance
- [ ] Review audit logs for anomalies
- [ ] Check object storage usage

**Weekly:**
- [ ] User feedback review
- [ ] Performance optimization
- [ ] Backup verification
- [ ] Security audit

**Monthly:**
- [ ] Archive legacy system
- [ ] Decommission legacy infrastructure
- [ ] Final migration report

---

This migration strategy ensures a safe, validated transition from the legacy system to the modern E-BARMM platform with full data integrity and minimal downtime.
