# E-BARMM Setup Guide

Complete setup instructions for development and production.

---

## Quick Start (5 Minutes)

Get the system running locally for development.

### Prerequisites

- **Docker Desktop** (for PostgreSQL, Redis, MinIO)
- **Python 3.11+** (for backend)
- **Node.js 18+** (for frontend)

### Step 1: Start Infrastructure

```bash
cd docker
docker-compose -f docker-compose.infrastructure.yml up -d

# Wait ~30 seconds, then verify
docker-compose -f docker-compose.infrastructure.yml ps
```

This starts:
- PostgreSQL + PostGIS (port 5432)
- Redis (port 6379)
- MinIO (ports 9000, 9001)

### Step 2: Start Backend

```bash
# Activate virtual environment
source .venv/Scripts/activate  # Windows Git Bash
# .venv\Scripts\Activate.ps1   # PowerShell
# .venv\Scripts\activate.bat   # CMD

cd backend
pip install -r requirements.txt  # First time only
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3: Start Frontend

```bash
cd frontend
npm install  # First time only
npm run dev
```

### Access

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | - |
| Backend API | http://localhost:8000/docs | - |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |

### Default Users

| Username | Password | Role |
|----------|----------|------|
| admin | Admin@2026 | super_admin |
| deo_user_1 | Deo@2026 | deo_user |
| regional_admin | Regional@2026 | regional_admin |

---

## Full Docker Deployment

Run everything in Docker (no local Python/Node required).

```bash
cd docker
cp .env.example .env
# Edit .env with your secrets

docker-compose up -d
```

Access:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000/docs
- MinIO: http://localhost:9001

---

## Manual Setup (Without Docker)

### Database

```bash
# Install PostgreSQL 15+ with PostGIS
sudo apt install postgresql-15 postgresql-15-postgis-3

# Create database
sudo -u postgres psql
CREATE DATABASE ebarmm;
\c ebarmm
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;
CREATE EXTENSION pgcrypto;
CREATE USER ebarmm_app WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ebarmm TO ebarmm_app;
\q

# Run schema
psql -U ebarmm_app -d ebarmm -f database/01_create_tables.sql
psql -U ebarmm_app -d ebarmm -f database/02_create_triggers.sql
psql -U ebarmm_app -d ebarmm -f database/03_seed_data.sql
psql -U ebarmm_app -d ebarmm -f database/04_user_management.sql
```

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with database credentials
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env.local
npm run dev
```

### MinIO

```bash
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio && sudo mv minio /usr/local/bin/
mkdir -p ~/minio-data
minio server ~/minio-data --console-address ":9001"

# Create bucket (new terminal)
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/ebarmm-media
mc anonymous set download local/ebarmm-media
```

### Redis

```bash
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

---

## Production Deployment

### Docker Compose (Recommended)

```bash
cd docker
cp .env.example .env
# Set strong JWT_SECRET_KEY, DB_PASSWORD, CORS_ORIGINS

docker-compose --profile production up -d
```

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name ebarmm.gov.ph;

    ssl_certificate /etc/letsencrypt/live/ebarmm.gov.ph/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ebarmm.gov.ph/privkey.pem;

    location / {
        root /var/www/ebarmm/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name ebarmm.gov.ph;
    return 301 https://$server_name$request_uri;
}
```

### Systemd Service

```ini
# /etc/systemd/system/ebarmm-backend.service
[Unit]
Description=E-BARMM Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=ebarmm
WorkingDirectory=/opt/ebarmm/backend
Environment="PATH=/opt/ebarmm/backend/venv/bin"
ExecStart=/opt/ebarmm/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable ebarmm-backend
sudo systemctl start ebarmm-backend
```

---

## Development Workflow

### Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload  # Auto-reloads on save

# Linting
black app/
flake8 app/

# Tests
pytest
```

### Frontend

```bash
cd frontend
npm run dev      # Hot reload
npm run lint     # ESLint
npm run format   # Prettier
npm run build    # Production build
```

### Database

```bash
# Connect
docker exec -it ebarmm-postgres psql -U ebarmm_app -d ebarmm

# Backup
docker exec ebarmm-postgres pg_dump -U ebarmm_app ebarmm > backup.sql

# Restore
docker exec -i ebarmm-postgres psql -U ebarmm_app -d ebarmm < backup.sql
```

---

## Troubleshooting

### Database Connection Error

```bash
# Check PostgreSQL running
docker ps | grep ebarmm-postgres
docker logs ebarmm-postgres

# Test connection
docker exec ebarmm-postgres psql -U ebarmm_app -d ebarmm -c "SELECT version();"
```

### Frontend Network Error

1. Check backend: `curl http://localhost:8000/health`
2. Verify `frontend/.env.local`: `VITE_API_BASE_URL=http://localhost:8000/api/v1`
3. Check browser console for CORS errors

### Port Already in Use

```bash
# Find process using port
netstat -ano | findstr :8000  # Windows
lsof -i :8000                 # Linux/Mac

# Stop Docker services
docker-compose -f docker-compose.infrastructure.yml down
```

### Database Tables Missing

```bash
cd docker
docker-compose -f docker-compose.infrastructure.yml down -v
docker volume rm docker_postgres-data
docker-compose -f docker-compose.infrastructure.yml up -d
```

### MinIO Access Denied

```bash
mc policy get local/ebarmm-media
mc anonymous set download local/ebarmm-media
```

---

## Health Checks

```bash
# Backend
curl http://localhost:8000/health

# Database
docker exec ebarmm-postgres psql -U ebarmm_app -d ebarmm -c "SELECT COUNT(*) FROM projects;"

# Redis
docker exec ebarmm-redis redis-cli ping

# MinIO
curl http://localhost:9000/minio/health/live
```

---

## Security Checklist (Production)

- [ ] Change all default passwords
- [ ] Set strong JWT_SECRET_KEY (min 32 chars)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure CORS to your domain only
- [ ] Set up firewall (allow only 80, 443)
- [ ] Disable DEBUG mode
- [ ] Set up automated backups
- [ ] Enable audit logging
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting

---

## Stopping Services

```bash
# Stop backend/frontend: Ctrl+C

# Stop infrastructure
cd docker && docker-compose -f docker-compose.infrastructure.yml down

# Stop and remove data
cd docker && docker-compose -f docker-compose.infrastructure.yml down -v
```

---

## Documentation

- `README.md` - Project overview
- `CLAUDE.md` - AI assistant guidance
- `SYSTEM_REFERENCE.md` - Database schema & file structure
- `ARCHITECTURE.md` - System design
- `API_DESIGN.md` - API specifications
- `SECURITY.md` - Authentication & RBAC
