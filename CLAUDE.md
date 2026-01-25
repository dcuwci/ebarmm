# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- Last reviewed: 2026-01-25 -->
<!-- Last updated: 2026-01-25 -->

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
# On EC2 instance
cd ~/ebarmm/docker
docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d    # Start staging
docker-compose -f docker-compose.staging.yml logs -f backend                   # View logs
docker-compose -f docker-compose.staging.yml down                              # Stop all
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

## Related Documentation

| File | Description |
|------|-------------|
| `README.md` | Project overview and setup |
| `QUICKSTART.md` | Quick start guide |
| `ARCHITECTURE.md` | System architecture details |
| `API_DESIGN.md` | API endpoint specifications |
| `FRONTEND_DESIGN.md` | Frontend design patterns |
| `MOBILE_STRATEGY.md` | Mobile app strategy |
| `DATABASE_MAPPING.md` | Database schema reference |
| `SECURITY.md` | Security implementation details |
| `MIGRATION.md` | Database migration instructions |
| `STAGING.md` | AWS staging environment setup guide |
