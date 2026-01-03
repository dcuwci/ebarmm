# E-BARMM Quick Start Guide

**Updated:** 2026-01-03

This guide will get you up and running in ~5 minutes!

---

## 📋 Prerequisites

- **Docker Desktop** (for PostgreSQL, Redis, MinIO)
- **Python 3.11+** (for backend)
- **Node.js 18+** (for frontend)
- **Git Bash or PowerShell** (Windows)

---

## 🚀 Step-by-Step Setup

### Step 1: Start Infrastructure (PostgreSQL, Redis, MinIO)

Open **Git Bash** or **PowerShell** in the project root:

```bash
# Navigate to docker directory
cd docker

# Start infrastructure services
docker-compose -f docker-compose.infrastructure.yml up -d

# Wait for services to be ready (~30 seconds)
# Check status:
docker-compose -f docker-compose.infrastructure.yml ps
```

**What this does:**
- ✅ Starts PostgreSQL with PostGIS on port 5432
- ✅ Automatically creates database and runs migrations
- ✅ Starts Redis on port 6379
- ✅ Starts MinIO on ports 9000 (API) and 9001 (Console)
- ✅ Creates and configures the `ebarmm-media` bucket

**Verify it's working:**
```bash
# Check PostgreSQL
docker exec ebarmm-postgres psql -U ebarmm_app -d ebarmm -c "SELECT COUNT(*) FROM users;"

# Check MinIO
curl http://localhost:9000/minio/health/live

# Check Redis
docker exec ebarmm-redis redis-cli ping
```

---

### Step 2: Start Backend API

Open a **NEW terminal** in the project root:

```bash
# Activate virtual environment (venv is in project root)
source .venv/Scripts/activate
# Or on Windows CMD: .venv\Scripts\activate.bat
# Or on PowerShell: .venv\Scripts\Activate.ps1

# Navigate to backend
cd backend

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Backend will start at:** http://localhost:8000

**Verify it's working:**
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

**Default Login Credentials:**
- Username: `admin`
- Password: `Admin@2026`

---

### Step 3: Start Frontend

Open **ANOTHER new terminal** in the project root:

```bash
# Navigate to frontend
cd frontend

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

**Frontend will start at:** http://localhost:5173

**Open in browser:** http://localhost:5173

---

## 🎯 Quick Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | - |
| **Backend API** | http://localhost:8000 | - |
| **API Documentation** | http://localhost:8000/docs | - |
| **MinIO Console** | http://localhost:9001 | minioadmin / minioadmin |
| **PostgreSQL** | localhost:5432 | ebarmm_app / DevPassword123 |

---

## 🔍 Troubleshooting

### Backend won't start - "Database connection error"

**Problem:** PostgreSQL not ready yet

**Solution:**
```bash
# Check if PostgreSQL is running
docker ps | grep ebarmm-postgres

# View PostgreSQL logs
docker logs ebarmm-postgres

# Wait for initialization
docker exec ebarmm-postgres psql -U ebarmm_app -d ebarmm -c "SELECT version();"
```

### Frontend shows "Network Error"

**Problem:** Backend not running or wrong API URL

**Solution:**
1. Check backend is running: `curl http://localhost:8000/health`
2. Verify `frontend/.env.local` has: `VITE_API_BASE_URL=http://localhost:8000/api/v1`
3. Restart frontend: `npm run dev`

### Port already in use

**Problem:** Port 5432, 8000, 5173, 9000, or 6379 already used

**Solution:**
```bash
# Check what's using the port (PowerShell)
netstat -ano | findstr :8000

# Or stop the conflicting service
# For Docker services:
docker-compose -f docker-compose.infrastructure.yml down
```

### Cannot activate virtual environment

**Problem:** Wrong activation command

**Solution:**
```bash
# Git Bash
source .venv/Scripts/activate

# PowerShell
.venv\Scripts\Activate.ps1

# CMD
.venv\Scripts\activate.bat
```

### Database tables not created

**Problem:** Initialization scripts didn't run

**Solution:**
```bash
# Stop containers
cd docker
docker-compose -f docker-compose.infrastructure.yml down -v

# Remove volumes (WARNING: deletes all data)
docker volume rm docker_postgres-data

# Start again (will re-initialize)
docker-compose -f docker-compose.infrastructure.yml up -d

# Wait and check
docker exec ebarmm-postgres psql -U ebarmm_app -d ebarmm -c "\dt"
```

---

## 🛑 Stopping Services

### Stop Backend & Frontend
Just press `Ctrl+C` in each terminal

### Stop Infrastructure
```bash
cd docker
docker-compose -f docker-compose.infrastructure.yml down
```

### Stop Everything and Remove Data
```bash
cd docker
docker-compose -f docker-compose.infrastructure.yml down -v
```

---

## 📊 Next Steps

1. **Explore the API:** http://localhost:8000/docs
2. **Login to Frontend:** Use `admin` / `Admin@2026`
3. **Create a Project:** Navigate to Projects → New Project
4. **Upload Media:** Add photos with GPS tags
5. **Edit GIS Features:** Use the map editor
6. **View Progress Timeline:** Add progress logs

---

## 🎨 Development Workflow

### Making Backend Changes

Backend auto-reloads when you save files (thanks to `--reload` flag)

```bash
# Edit files in backend/app/
# Save
# Backend automatically restarts
```

### Making Frontend Changes

Frontend hot-reloads automatically

```bash
# Edit files in frontend/src/
# Save
# Browser automatically updates
```

### Database Changes

```bash
# Connect to database
docker exec -it ebarmm-postgres psql -U ebarmm_app -d ebarmm

# Run SQL
SELECT * FROM projects;

# Exit
\q
```

---

## 📦 Installing New Dependencies

### Backend (Python)
```bash
# Activate venv
source .venv/Scripts/activate

# Install package
pip install package-name

# Update requirements
pip freeze > backend/requirements.txt
```

### Frontend (Node.js)
```bash
cd frontend
npm install package-name
```

---

## 🔐 Default User Accounts

From seed data (`database/03_seed_data.sql`):

| Username | Password | Role | Access |
|----------|----------|------|--------|
| admin | Admin@2026 | super_admin | Full system access |
| deo_user_1 | Deo@2026 | deo_user | DEO 1 projects only |
| deo_user_2 | Deo@2026 | deo_user | DEO 2 projects only |
| regional_admin | Regional@2026 | regional_admin | Regional oversight |

**⚠️ IMPORTANT:** Change these passwords before deploying to production!

---

## 📝 Common Commands Cheat Sheet

```bash
# === Infrastructure ===
# Start
cd docker && docker-compose -f docker-compose.infrastructure.yml up -d

# Stop
cd docker && docker-compose -f docker-compose.infrastructure.yml down

# View logs
docker-compose -f docker-compose.infrastructure.yml logs -f postgres

# === Backend ===
# Activate venv
source .venv/Scripts/activate

# Start backend
cd backend && uvicorn app.main:app --reload

# === Frontend ===
# Start frontend
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# === Database ===
# Connect to DB
docker exec -it ebarmm-postgres psql -U ebarmm_app -d ebarmm

# Backup database
docker exec ebarmm-postgres pg_dump -U ebarmm_app ebarmm > backup.sql

# Restore database
docker exec -i ebarmm-postgres psql -U ebarmm_app -d ebarmm < backup.sql

# === MinIO ===
# Access console
# Open http://localhost:9001
# Login: minioadmin / minioadmin
```

---

## ✅ Verification Checklist

After starting everything, verify:

- [ ] PostgreSQL running: `docker ps | grep ebarmm-postgres`
- [ ] Database has tables: `docker exec ebarmm-postgres psql -U ebarmm_app -d ebarmm -c "\dt"`
- [ ] MinIO running: `curl http://localhost:9000/minio/health/live`
- [ ] Redis running: `docker exec ebarmm-redis redis-cli ping`
- [ ] Backend health: `curl http://localhost:8000/health`
- [ ] Backend API docs: Open http://localhost:8000/docs
- [ ] Frontend loads: Open http://localhost:5173
- [ ] Can login: Try `admin` / `Admin@2026`

---

## 🎉 You're Ready!

The E-BARMM Transparency Portal is now running!

- **Public Portal:** http://localhost:5173
- **Admin Dashboard:** http://localhost:5173 (login first)
- **API Documentation:** http://localhost:8000/docs

For more information, see:
- `README.md` - Project overview
- `SETUP.md` - Detailed setup instructions
- `ARCHITECTURE.md` - System architecture
- `API_DESIGN.md` - API specifications
