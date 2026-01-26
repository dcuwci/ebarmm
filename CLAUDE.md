# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- Last reviewed: 2026-01-27 -->
<!-- Last updated: 2026-01-27 -->

## Important Reminders (Read First!)

### Documentation Updates
- **When fixing staging/deployment issues**, always update `STAGING.md`, `CLAUDE.md`, and `.env.staging.example`
- This ensures fixes are not lost and can be replicated on fresh installs

### Development Workflow Preference
- **Develop against staging server** instead of running local backend
- Mobile: Use Android Studio with **staging** build variant (Build → Select Build Variant → staging)
- Frontend: Update `VITE_API_BASE_URL` to point to staging if needed
- Backend changes: Push to git → pull on EC2 → `docker compose ... up -d --build backend`
- No need to run local Docker infrastructure unless testing locally

### Staging Environment
- **PostgreSQL runs NATIVELY on EC2**, not in Docker. Only backend, frontend, and Redis run in Docker.
- **Use `docker compose` (V2)** not `docker-compose` (V1) on staging
- **Always include `--env-file .env.staging`** with docker compose commands, or variables won't load
- Correct command: `docker compose -f docker-compose.staging.yml --env-file .env.staging up -d`
- To check PostgreSQL: `sudo systemctl status postgresql` and `sudo -u postgres psql ebarmm`
- To check Docker→PostgreSQL connectivity: `sudo cat /etc/postgresql/15/main/pg_hba.conf | grep 172.17`

### Deploying Changes to Staging
```bash
# On EC2:
cd ~/ebarmm && git pull
cd docker
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build frontend  # Frontend only
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build backend   # Backend only
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build           # Both
```

### Staging Memory Issues
- **Frontend builds can run out of memory** on small EC2 instances, causing the instance to become unresponsive
- If the instance freezes during build, you may need to force stop/start from AWS Console
- To reduce memory usage, build one service at a time with `--no-deps`:
  ```bash
  docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build frontend --no-deps
  ```
- Check memory before building: `free -m`

### Mobile Staging Build
- In `build.gradle.kts`, **`initWith(getByName("debug"))` must come BEFORE `buildConfigField`** or the URL gets overwritten
- Build staging APK: `./gradlew.bat clean assembleStaging` (Windows) or `./gradlew clean assembleStaging` (Mac/Linux)
- APK location: `mobile/app/build/outputs/apk/staging/app-staging.apk`
- Phone must be able to reach EC2 IP on port 8000

### Known Issues Fixed in Code
- **alerts.metadata vs alert_metadata**: The database column is `alert_metadata`, not `metadata`. Fixed in `backend/app/api/gis.py`.
- **GPS track date parsing on mobile**: Server returns ISO dates without timezone (e.g., `"2026-01-26T14:13:32"`) but `Instant.parse()` requires timezone. Fixed with fallback to `LocalDateTime.parse()` in `ProjectDetailViewModel.kt`.
- **Map max zoom**: Web maps use `maxZoom={22}` on MapContainer and `maxNativeZoom={19}` on TileLayer to allow overzooming beyond tile provider limits.
- **GPS tracks from server need nullable mediaLocalId**: Server-synced GPS tracks don't have local video files, so `mediaLocalId` must be nullable. Fixed in database version 4.

### Media Download & Quota System
- **Mobile**: GPS track videos can be downloaded on-demand and cached locally
- **Web**: RouteShoot viewer fetches video with auth token and creates blob URL (HTML video elements don't send auth headers)
- **Quota limits (per user per day)**: 20 videos, 200 photos, 500MB total
- **Public endpoint limits (per IP per day)**: 10 videos, 100 photos, 200MB total, 300 requests/hour
- **Rate limiting**: Additional 60 requests/hour via slowapi on `/media/{id}/file`
- Requires `API_BASE_URL` in `.env.staging` and docker-compose.staging.yml (e.g., `http://YOUR_EC2_IP:8000`)
- Check quota status: `GET /api/v1/media/quota/status` (authenticated) or `GET /api/v1/public/quota/status`

### Security
- Never commit real secrets - only dev defaults (admin123, DevPassword123, minioadmin) are OK
- Real staging credentials go in `.env.staging` on EC2 only (gitignored)
- AWS region for staging is `ap-northeast-1`

## Quick Commands

### Development (run from project root)
```bash
# Start infrastructure (Postgres, Redis, MinIO)
cd docker && docker-compose -f docker-compose.infrastructure.yml up -d

# Backend (in separate terminal)
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (in separate terminal)
cd frontend && npm run dev
```

### Frontend
```bash
npm run dev          # Dev server (port 5173)
npm run build        # Production build
npm run lint         # ESLint check
npm run format       # Prettier format
```

### Backend
```bash
uvicorn app.main:app --reload   # Dev server with auto-reload
pip install -r requirements.txt # Install dependencies
alembic upgrade head            # Run migrations
```

### Docker (full stack)
```bash
cd docker && docker-compose up -d       # Start all services
docker-compose logs -f backend          # View service logs
docker-compose down                     # Stop all
```

### Staging (AWS EC2)
```bash
# On EC2 instance (note: uses "docker compose" not "docker-compose")
cd ~/ebarmm/docker
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d    # Start staging
docker compose -f docker-compose.staging.yml logs -f backend                   # View logs
docker compose -f docker-compose.staging.yml down                              # Stop all
```
See `STAGING.md` for full AWS setup guide.

### Mobile (Android)
```bash
cd mobile
./gradlew.bat clean assembleDebug       # Build debug APK (Windows)
./gradlew.bat clean assembleStaging     # Build staging APK (Windows)
./gradlew clean assembleDebug           # Build debug APK (Linux/Mac)
./gradlew clean assembleStaging         # Build staging APK (Linux/Mac)
```
Build variants: `debug` (local), `staging` (AWS), `release` (production).
Or open `mobile/` folder in Android Studio and select build variant.

## Architecture

### Backend (FastAPI)
```
backend/app/
├── main.py              # App setup, middleware, router registration
├── core/
│   ├── config.py        # Settings via pydantic-settings
│   ├── database.py      # SQLAlchemy async engine
│   └── security.py      # JWT + password hashing
├── api/                 # Route handlers
│   ├── auth.py          # Authentication endpoints
│   ├── users.py         # User management
│   ├── projects.py      # Project CRUD
│   ├── progress.py      # Progress reports
│   ├── gis.py           # GIS/spatial endpoints
│   ├── media.py         # Media upload/download
│   ├── public.py        # Public endpoints
│   ├── access_rights.py # Group-based access control
│   ├── audit.py         # Audit trail endpoints
│   ├── groups.py        # User group management
│   └── reports.py       # Report generation
├── models/              # SQLAlchemy ORM models (defined in __init__.py)
├── schemas/             # Pydantic request/response schemas (defined in __init__.py)
└── services/
    ├── permissions.py   # Permission checks
    ├── audit_service.py # Audit logging
    ├── mfa_service.py   # Multi-factor auth
    ├── pdf_generator.py # PDF report generation
    ├── report_service.py    # Report business logic
    └── thumbnail_service.py # Image thumbnail generation
```

### Frontend (React + TypeScript)
```
frontend/src/
├── App.tsx              # Router setup (public/admin/auth routes)
├── main.tsx             # Entry point (React 18)
├── api/                 # Axios client + endpoint wrappers
├── stores/              # Zustand stores (authStore, permissionStore)
├── routes/
│   ├── public/          # Public-facing pages
│   ├── auth/            # Login, registration
│   └── admin/           # Admin dashboard
│       └── settings/    # Admin settings pages
│           ├── AccessRightsSettings.tsx
│           ├── AuditLogs.tsx
│           ├── GroupsSettings.tsx
│           └── UsersSettings.tsx
├── components/
│   ├── layout/          # Layout components
│   ├── map/             # Map/GIS components
│   ├── media/           # Media upload/display
│   ├── common/          # Shared components
│   ├── auth/            # Auth-related components
│   ├── progress/        # Progress report components
│   ├── audit/           # Audit log UI
│   └── permissions/     # Permission management UI
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── styles/              # Global styles
└── theme/               # MUI theme configuration
```

### Mobile (Kotlin + Jetpack Compose)
```
mobile/app/src/main/java/com/barmm/ebarmm/
├── MainActivity.kt              # Entry point
├── EBarmmApplication.kt         # Application class (Hilt)
├── navigation/NavGraph.kt       # Navigation with bottom nav (Dashboard, Projects, Map)
├── presentation/
│   ├── dashboard/               # Stats cards + recent projects
│   ├── map/                     # OpenStreetMap view with project geometries
│   ├── project/                 # Project list + detail
│   ├── progress/                # Progress report form
│   ├── auth/                    # Login screen
│   └── routeshoot/              # Route shooting feature (GPS track recording)
├── data/
│   ├── local/database/
│   │   ├── AppDatabase.kt       # Room database
│   │   ├── dao/                 # Data Access Objects
│   │   │   ├── ProjectDao.kt
│   │   │   ├── MediaDao.kt
│   │   │   ├── ProgressDao.kt
│   │   │   ├── GpsTrackDao.kt   # GPS track persistence
│   │   │   ├── UserDao.kt
│   │   │   └── SyncQueueDao.kt  # Offline sync queue
│   │   └── entity/              # Room entities
│   │       ├── ProjectEntity.kt
│   │       ├── GpsTrackEntity.kt
│   │       ├── GpsWaypoint.kt
│   │       ├── SyncQueueEntity.kt
│   │       └── UserEntity.kt
│   ├── remote/api/
│   │   ├── ApiService.kt        # Retrofit API interface
│   │   ├── dto/                 # Data Transfer Objects
│   │   └── interceptor/         # Auth interceptor, token refresh
│   ├── repository/              # Repository implementations
│   ├── mapper/                  # Entity <-> DTO mappers
│   └── sync/
│       ├── queue/SyncQueueManager.kt  # Offline queue management
│       └── worker/              # WorkManager sync workers
├── domain/                      # Repository interfaces
│   ├── ProjectRepository.kt
│   ├── GpsTrackRepository.kt
│   └── StatsRepository.kt
├── core/
│   ├── security/                # Token management, hash calculation
│   └── util/
│       ├── LocationHelper.kt    # GPS utilities
│       ├── GpsTrackRecorder.kt  # Track recording
│       ├── GpxKmlGenerator.kt   # Export to GPX/KML
│       ├── KmlParser.kt         # KML import
│       └── NetworkMonitor.kt    # Connectivity monitoring
├── service/
│   └── RouteShootService.kt     # Foreground service for GPS tracking
├── di/                          # Hilt DI modules
└── ui/theme/                    # Compose theme (Color, Type, Theme)
```

### Key Patterns

**State Management**: Zustand for auth/permissions, TanStack Query for API data

**Authentication**: JWT Bearer tokens (60-min), optional refresh tokens, TOTP MFA support

**RBAC Roles**: `public` → `deo_user` → `regional_admin` → `super_admin`

**Immutable Progress Logs**: Append-only with SHA-256 hash chaining; database triggers prevent UPDATE/DELETE

**File Storage**: MinIO (S3-compatible) on port 9000, bucket `ebarmm-media`; AWS S3 for staging/production

**GIS**: PostGIS for spatial data, Leaflet + react-leaflet for rendering

**Mobile Offline Sync**: Room database with sync queue; WorkManager handles background sync when connectivity restored

**GPS Tracking (Mobile)**: Foreground service records GPS tracks; exports to GPX/KML formats

### API Communication
- Base URL (Frontend): `VITE_API_BASE_URL` (default: `http://localhost:8000/api/v1`)
- Base URL (Mobile): `API_BASE_URL` in `mobile/app/build.gradle.kts` (default: `http://10.0.2.2:8000` for emulator)
- Axios/Retrofit interceptor adds `Authorization: Bearer <token>`
- 401 responses trigger logout + redirect to /login

### Database
- PostgreSQL 15 + PostGIS 3.4
- UUID primary keys
- Row-level security policies
- Init scripts in `database/` folder run automatically via Docker

## Default Credentials (Development)

| Service | User | Password |
|---------|------|----------|
| Database | ebarmm_app | DevPassword123 |
| MinIO | minioadmin | minioadmin |
| Admin User | admin | admin123 |

## Ports

| Service | Port |
|---------|------|
| Frontend (dev) | 5173 |
| Frontend (Docker) | 3000 |
| Backend API | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

## Future Work / TODOs

### Mobile App
- **Photo/Video Compression**: Add compression before upload to save storage space and bandwidth
  - Photos: Compress to ~80% quality JPEG, resize if over 2048px
  - Videos: Consider using MediaCodec for H.264 compression with configurable quality

### Backend
- **Redis for Rate Limiting**: Currently using in-memory dictionaries for quota tracking; migrate to Redis for persistence across restarts
- **Presigned URL Quota Bypass**: The `/media/presign-upload` and `/media/presign-download` endpoints bypass quota system; consider adding tracking

## Related Documentation

All documentation is organized under `docs/`:

| Folder | Contents |
|--------|----------|
| `docs/architecture/` | ARCHITECTURE.md, API_DESIGN.md, DATABASE_MAPPING.md, FRONTEND_DESIGN.md, SECURITY.md |
| `docs/guides/` | QUICKSTART.md, STAGING.md, MIGRATION.md |
| `docs/mobile/` | MOBILE_STRATEGY.md |
| `docs/reports/` | PROGRESS_REPORT.md, E-BARMM-Inception-Report.md |
| `docs/archive/` | Historical docs (OG_PROMPT.md, SYSTEM_REFERENCE.md, IMPLEMENTATION_SUMMARY.md) |
| `mobile/README.md` | Android app setup and build instructions |
| `docker/README.md` | Docker deployment instructions |
