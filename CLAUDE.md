# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture

### Backend (FastAPI)
```
backend/app/
├── main.py              # App setup, middleware, router registration
├── core/
│   ├── config.py        # Settings via pydantic-settings
│   ├── database.py      # SQLAlchemy async engine
│   └── security.py      # JWT + password hashing
├── api/                 # Route handlers (auth, users, projects, progress, gis, media)
├── models/              # SQLAlchemy ORM models
├── schemas/             # Pydantic request/response schemas
└── services/            # Business logic (permissions, audit, mfa)
```

### Frontend (React + TypeScript)
```
frontend/src/
├── App.tsx              # Router setup (public/admin/auth routes)
├── api/                 # Axios client + endpoint wrappers
├── stores/              # Zustand stores (authStore, permissionStore)
├── routes/              # Page components (public/, admin/, auth/)
└── components/          # Reusable UI (layout/, map/, media/, common/)
```

### Key Patterns

**State Management**: Zustand for auth/permissions, TanStack Query for API data

**Authentication**: JWT Bearer tokens (60-min), optional refresh tokens, TOTP MFA support

**RBAC Roles**: `public` → `deo_user` → `regional_admin` → `super_admin`

**Immutable Progress Logs**: Append-only with SHA-256 hash chaining; database triggers prevent UPDATE/DELETE

**File Storage**: MinIO (S3-compatible) on port 9000, bucket `ebarmm-media`

**GIS**: PostGIS for spatial data, Leaflet + react-leaflet for rendering

### API Communication
- Base URL: `VITE_API_BASE_URL` (default: `http://localhost:8000/api/v1`)
- Axios interceptor adds `Authorization: Bearer <token>`
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
