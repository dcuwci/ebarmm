# E-BARMM System Reference

## Database Schema

PostgreSQL 15+ with PostGIS 3.4+

### Extensions Required
- `uuid-ossp` - UUID generation
- `postgis` - Spatial data types
- `postgis_topology` - Topology support
- `pgcrypto` - Cryptographic functions

---

### Core Tables

#### `users`
User accounts with role-based access control.

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | UUID | PK, DEFAULT gen_random_uuid() |
| username | VARCHAR(100) | UNIQUE, NOT NULL |
| email | VARCHAR(255) | UNIQUE |
| password_hash | TEXT | NOT NULL |
| role | VARCHAR(30) | NOT NULL, CHECK (public/deo_user/regional_admin/super_admin) |
| deo_id | INT | FK → deo.deo_id |
| region | VARCHAR(50) | |
| is_active | BOOLEAN | DEFAULT TRUE |
| first_name | VARCHAR(50) | |
| last_name | VARCHAR(50) | |
| phone_number | VARCHAR(20) | |
| is_verified | BOOLEAN | DEFAULT TRUE |
| verification_token | VARCHAR(255) | UNIQUE |
| token_expires_at | TIMESTAMP | |
| mfa_enabled | BOOLEAN | DEFAULT FALSE |
| mfa_secret | VARCHAR(255) | |
| backup_codes | TEXT | |
| last_password_reset | TIMESTAMP | |
| password_reset_count | INT | DEFAULT 0 |
| is_deleted | BOOLEAN | DEFAULT FALSE |
| deleted_at | TIMESTAMP | |
| deleted_by | UUID | |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |
| last_login | TIMESTAMP | |

---

#### `deo`
District Engineering Offices.

| Column | Type | Constraints |
|--------|------|-------------|
| deo_id | INT | PK |
| deo_name | VARCHAR(100) | NOT NULL |
| province | VARCHAR(100) | NOT NULL |
| region | VARCHAR(50) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

#### `projects`
Infrastructure projects managed by DEOs.

| Column | Type | Constraints |
|--------|------|-------------|
| project_id | UUID | PK, DEFAULT gen_random_uuid() |
| deo_id | INT | FK → deo.deo_id, NOT NULL |
| project_title | TEXT | NOT NULL |
| location | TEXT | |
| fund_source | VARCHAR(50) | |
| mode_of_implementation | VARCHAR(50) | |
| project_cost | NUMERIC(18,2) | CHECK >= 0 |
| project_scale | VARCHAR(50) | |
| fund_year | INT | CHECK 2010-2050 |
| status | VARCHAR(50) | DEFAULT 'planning', CHECK (planning/ongoing/completed/suspended/cancelled/deleted) |
| created_by | UUID | FK → users.user_id |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

---

#### `project_progress_logs`
Immutable progress history with hash chaining (append-only).

| Column | Type | Constraints |
|--------|------|-------------|
| progress_id | UUID | PK, DEFAULT gen_random_uuid() |
| project_id | UUID | FK → projects.project_id, NOT NULL |
| reported_percent | NUMERIC(5,2) | NOT NULL, CHECK 0-100 |
| report_date | DATE | NOT NULL |
| remarks | TEXT | |
| reported_by | UUID | FK → users.user_id, NOT NULL |
| prev_hash | TEXT | Hash of previous entry |
| record_hash | TEXT | NOT NULL, SHA-256 hash |
| created_at | TIMESTAMP | DEFAULT NOW() |

**Constraint:** UNIQUE(project_id, report_date)

---

#### `gis_features`
Spatial features stored in PostGIS.

| Column | Type | Constraints |
|--------|------|-------------|
| feature_id | UUID | PK, DEFAULT gen_random_uuid() |
| project_id | UUID | FK → projects.project_id, NOT NULL |
| feature_type | VARCHAR(30) | NOT NULL, CHECK (road/bridge/drainage/facility/building/other) |
| geometry | GEOMETRY(GEOMETRY, 4326) | NOT NULL, CHECK ST_IsValid |
| attributes | JSONB | DEFAULT '{}' |
| created_by | UUID | FK → users.user_id, NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

**Index:** GIST on geometry column

---

#### `media_assets`
Photos, videos, and documents linked to projects.

| Column | Type | Constraints |
|--------|------|-------------|
| media_id | UUID | PK, DEFAULT gen_random_uuid() |
| project_id | UUID | FK → projects.project_id, NOT NULL |
| media_type | VARCHAR(20) | NOT NULL, CHECK (photo/video/document) |
| storage_key | TEXT | NOT NULL (S3 object key) |
| latitude | NUMERIC(10,7) | CHECK -90 to 90 |
| longitude | NUMERIC(10,7) | CHECK -180 to 180 |
| captured_at | TIMESTAMP | |
| uploaded_by | UUID | FK → users.user_id, NOT NULL |
| uploaded_at | TIMESTAMP | DEFAULT NOW() |
| attributes | JSONB | DEFAULT '{}' |
| file_size | BIGINT | |
| mime_type | VARCHAR(100) | |

---

#### `audit_logs`
System-wide audit trail (immutable).

| Column | Type | Constraints |
|--------|------|-------------|
| audit_id | UUID | PK, DEFAULT gen_random_uuid() |
| actor_id | UUID | FK → users.user_id |
| action | VARCHAR(100) | NOT NULL |
| entity_type | VARCHAR(50) | NOT NULL |
| entity_id | UUID | |
| payload | JSONB | DEFAULT '{}' |
| ip_address | INET | |
| user_agent | TEXT | |
| prev_hash | TEXT | |
| record_hash | TEXT | |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

#### `geofencing_rules`
Spatial validation rules for projects.

| Column | Type | Constraints |
|--------|------|-------------|
| rule_id | UUID | PK, DEFAULT gen_random_uuid() |
| project_id | UUID | FK → projects.project_id |
| geometry | GEOMETRY(POLYGON, 4326) | NOT NULL, CHECK ST_IsValid |
| rule_type | VARCHAR(50) | NOT NULL, CHECK (region_boundary/project_area/restricted_zone) |
| attributes | JSONB | DEFAULT '{}' |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_by | UUID | FK → users.user_id |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

#### `alerts`
Automated notifications for anomalies.

| Column | Type | Constraints |
|--------|------|-------------|
| alert_id | UUID | PK, DEFAULT gen_random_uuid() |
| project_id | UUID | FK → projects.project_id |
| alert_type | VARCHAR(50) | NOT NULL, CHECK (progress_delay/geofence_violation/budget_overrun/system_error) |
| severity | VARCHAR(20) | DEFAULT 'info', CHECK (info/warning/error/critical) |
| message | TEXT | NOT NULL |
| alert_metadata | JSONB | DEFAULT '{}' |
| triggered_at | TIMESTAMP | DEFAULT NOW() |
| acknowledged | BOOLEAN | DEFAULT FALSE |
| acknowledged_by | UUID | FK → users.user_id |
| acknowledged_at | TIMESTAMP | |
| resolved | BOOLEAN | DEFAULT FALSE |
| resolved_by | UUID | FK → users.user_id |
| resolved_at | TIMESTAMP | |

---

### User Management Tables

#### `groups`
User groups for RBAC.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| name | VARCHAR(100) | UNIQUE, NOT NULL |
| description | TEXT | |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

**Default Groups:** Administrators, Regional Admins, DEO Users, Viewers

---

#### `user_groups`
Many-to-many: users ↔ groups.

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | UUID | PK, FK → users.user_id |
| group_id | UUID | PK, FK → groups.id |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

#### `access_rights`
Resource permissions assigned to groups.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| resource | VARCHAR(50) | NOT NULL |
| permissions | JSONB | NOT NULL (create/read/update/delete) |
| group_id | UUID | FK → groups.id, NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

**Constraint:** UNIQUE(group_id, resource)

---

#### `refresh_tokens`
JWT refresh tokens for extended sessions.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| token | VARCHAR(255) | UNIQUE, NOT NULL |
| user_id | UUID | FK → users.user_id, NOT NULL |
| expires_at | TIMESTAMP | NOT NULL |
| is_revoked | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

#### `mfa_sessions`
Temporary sessions during MFA login flow.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| session_token | VARCHAR(255) | UNIQUE, NOT NULL |
| user_id | UUID | FK → users.user_id, NOT NULL |
| expires_at | TIMESTAMP | NOT NULL |
| is_used | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

#### `password_reset_tokens`
Password reset tokens for account recovery.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| user_id | UUID | FK → users.user_id, NOT NULL |
| email | VARCHAR(255) | NOT NULL |
| token | VARCHAR(255) | UNIQUE, NOT NULL |
| expires_at | TIMESTAMP | NOT NULL |
| used | BOOLEAN | DEFAULT FALSE |
| used_at | TIMESTAMP | |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

#### `token_blacklist`
Blacklisted JWT tokens (for logout).

| Column | Type | Constraints |
|--------|------|-------------|
| token_hash | VARCHAR(64) | PK |
| user_id | UUID | FK → users.user_id |
| expires_at | TIMESTAMP | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

### Migration Support Tables

#### `migration_project_id_map`
Legacy ID to new UUID mapping.

| Column | Type | Constraints |
|--------|------|-------------|
| legacy_id | INT | PK |
| new_uuid | UUID | UNIQUE, NOT NULL |

#### `migration_log`
Migration execution history.

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| migration_name | VARCHAR(100) | NOT NULL |
| started_at | TIMESTAMP | DEFAULT NOW() |
| completed_at | TIMESTAMP | |
| status | VARCHAR(20) | CHECK (running/completed/failed) |
| records_processed | INT | DEFAULT 0 |
| error_message | TEXT | |

---

## Entity Relationship Diagram

```
users ─────────────┬──────────────────────────────────────────────────┐
  │                │                                                  │
  │ user_id        │ user_id                                         │ user_id
  ▼                ▼                                                  ▼
user_groups    project_progress_logs                              audit_logs
  │                │
  │ group_id       │ project_id
  ▼                ▼
groups ◄───── access_rights
                   │
                   │ project_id
                   ▼
               projects ◄──────┬──────────┬──────────┬──────────┐
                   │           │          │          │          │
                   │           │          │          │          │
                   ▼           ▼          ▼          ▼          ▼
                 deo     gis_features  media    alerts   geofencing
                              assets            rules
```

---

## File System Structure

```
ebarmm/
├── backend/                          # FastAPI Backend Application
│   ├── app/
│   │   ├── main.py                   # App entry, middleware, router setup
│   │   ├── core/
│   │   │   ├── config.py             # Settings via pydantic-settings
│   │   │   ├── database.py           # SQLAlchemy async engine
│   │   │   └── security.py           # JWT + password hashing
│   │   ├── api/                      # Route handlers
│   │   │   ├── __init__.py
│   │   │   ├── access_rights.py      # Access rights CRUD
│   │   │   ├── audit.py              # Audit log viewer
│   │   │   ├── auth.py               # Login, logout, MFA
│   │   │   ├── gis.py                # GIS feature operations
│   │   │   ├── groups.py             # User group management
│   │   │   ├── media.py              # File upload/download (S3)
│   │   │   ├── progress.py           # Progress log submission
│   │   │   ├── projects.py           # Project CRUD
│   │   │   ├── public.py             # Public read-only endpoints
│   │   │   └── users.py              # User management
│   │   ├── models/
│   │   │   └── __init__.py           # SQLAlchemy ORM models
│   │   ├── schemas/
│   │   │   └── __init__.py           # Pydantic request/response schemas
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── audit_service.py      # Audit log creation
│   │       ├── mfa_service.py        # Multi-Factor Authentication
│   │       └── permissions.py        # RBAC enforcement
│   ├── migrations/
│   │   ├── 001_add_user_management.sql
│   │   └── 002_fix_missing_columns.sql
│   ├── requirements.txt              # Python dependencies
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                         # React Frontend Application
│   ├── src/
│   │   ├── main.tsx                  # React entry with providers
│   │   ├── App.tsx                   # Router setup
│   │   ├── api/                      # API client wrappers
│   │   │   ├── accessRights.ts
│   │   │   ├── audit.ts
│   │   │   ├── auth.ts
│   │   │   ├── client.ts             # Axios instance + interceptors
│   │   │   ├── gis.ts
│   │   │   ├── groups.ts
│   │   │   ├── media.ts
│   │   │   ├── progress.ts
│   │   │   ├── projects.ts
│   │   │   └── users.ts
│   │   ├── components/
│   │   │   ├── audit/
│   │   │   │   └── ProjectAuditLog.tsx
│   │   │   ├── auth/
│   │   │   │   ├── MFASetupWizard.tsx
│   │   │   │   └── MFAVerifyDialog.tsx
│   │   │   ├── common/               # Reusable UI components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Loading.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Table.tsx
│   │   │   │   ├── Toaster.tsx
│   │   │   │   └── index.ts
│   │   │   ├── layout/
│   │   │   │   ├── AdminLayout.tsx   # Admin dashboard wrapper
│   │   │   │   ├── ProtectedRoute.tsx # Role-based route guard
│   │   │   │   └── PublicLayout.tsx  # Public pages wrapper
│   │   │   ├── map/
│   │   │   │   ├── GISEditor.tsx
│   │   │   │   ├── LeafletGISEditor.tsx
│   │   │   │   ├── LeafletMap.tsx
│   │   │   │   └── ProjectGISView.tsx
│   │   │   ├── media/
│   │   │   │   ├── MediaGallery.tsx
│   │   │   │   └── MediaUpload.tsx
│   │   │   ├── mui/                  # Material-UI wrappers
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── DashboardFilter.tsx
│   │   │   │   ├── FilterButton.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Loading.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Table.tsx
│   │   │   │   └── index.ts
│   │   │   ├── permissions/
│   │   │   │   └── PermissionGate.tsx
│   │   │   └── progress/
│   │   │       └── ProgressTimeline.tsx
│   │   ├── routes/
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── GISEditor.tsx
│   │   │   │   ├── Profile.tsx
│   │   │   │   ├── ProgressReport.tsx
│   │   │   │   ├── ProjectDetail.tsx
│   │   │   │   ├── ProjectForm.tsx
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   └── settings/
│   │   │   │       ├── AccessRightsSettings.tsx
│   │   │   │       ├── AuditLogs.tsx
│   │   │   │       ├── GroupsSettings.tsx
│   │   │   │       └── UsersSettings.tsx
│   │   │   ├── auth/
│   │   │   │   └── Login.tsx
│   │   │   └── public/
│   │   │       ├── Landing.tsx
│   │   │       ├── ProjectDetails.tsx
│   │   │       ├── PublicMap.tsx
│   │   │       └── PublicPortal.tsx
│   │   ├── stores/                   # Zustand state management
│   │   │   ├── authStore.ts
│   │   │   └── permissionStore.ts
│   │   ├── theme/
│   │   │   └── ThemeContext.tsx
│   │   ├── types/                    # TypeScript definitions
│   │   │   ├── audit.ts
│   │   │   ├── gis.ts
│   │   │   ├── media.ts
│   │   │   ├── progress.ts
│   │   │   ├── project.ts
│   │   │   └── validation.ts
│   │   ├── utils/
│   │   │   └── geometry.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── nginx.conf                    # Production nginx config
│   └── Dockerfile
│
├── database/                         # SQL Schema & Migrations
│   ├── 01_create_tables.sql          # Core schema with PostGIS
│   ├── 02_create_triggers.sql        # Immutability triggers, RLS
│   ├── 03_seed_data.sql              # Default data, sample projects
│   └── 04_user_management.sql        # Groups, access rights, tokens
│
├── docker/                           # Docker Configuration
│   ├── docker-compose.yml            # Full stack deployment
│   ├── docker-compose.infrastructure.yml  # Dev: Postgres, Redis, MinIO only
│   ├── nginx.conf                    # Production reverse proxy
│   └── README.md
│
├── migration/                        # Legacy Data Migration
│   ├── run_migration.py              # Migration orchestrator
│   └── scripts/
│       ├── __init__.py
│       ├── bootstrap_users.py
│       ├── migrate_deo.py
│       ├── migrate_gis.py
│       ├── migrate_media.py
│       ├── migrate_progress.py
│       └── migrate_projects.py
│
├── mobile/                           # Mobile App (Future)
│
├── .gitignore
├── CLAUDE.md                         # Claude Code guidance
├── README.md                         # Project overview
├── QUICKSTART.md                     # 5-minute setup guide
├── ARCHITECTURE.md                   # System design
├── API_DESIGN.md                     # API specifications
├── DATABASE_MAPPING.md               # Legacy schema mapping
├── FRONTEND_DESIGN.md                # Component architecture
├── SECURITY.md                       # Auth, RBAC, hash chaining
├── MIGRATION.md                      # Data migration guide
├── MOBILE_STRATEGY.md                # Mobile app strategy
├── PROGRESS_REPORT.md                # Implementation status
└── SYSTEM_REFERENCE.md               # This file
```

---

## Infrastructure Services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| PostgreSQL + PostGIS | ebarmm-postgres | 5432 | Primary database |
| Redis | ebarmm-redis | 6379 | Token blacklist, caching |
| MinIO | ebarmm-minio | 9000/9001 | S3-compatible object storage |
| Backend | ebarmm-backend | 8000 | FastAPI REST API |
| Frontend | ebarmm-frontend | 3000 | React SPA (nginx) |

---

## Key Relationships

1. **Users → DEO**: DEO users must belong to a DEO (enforced by constraint)
2. **Projects → DEO**: Each project belongs to one DEO
3. **Progress Logs → Projects**: Append-only with hash chaining
4. **GIS Features → Projects**: Spatial data per project
5. **Media Assets → Projects**: Files stored in MinIO, metadata in DB
6. **Audit Logs**: Immutable record of all mutations
7. **Groups → Access Rights**: RBAC permissions per resource
8. **Users ↔ Groups**: Many-to-many via user_groups
