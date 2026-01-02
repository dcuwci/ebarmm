# E-BARMM Setup Instructions

## Quick Start with Docker

The fastest way to get the E-BARMM system running is with Docker Compose.

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker + Docker Compose (Linux)
- Git
- 8GB RAM minimum
- 20GB disk space

### Steps

1. **Clone the repository:**
   ```bash
   cd D:\OneDrive\Work\OneDrive - Woodfields Consultants, Inc\code\2026\ebarmm
   ```

2. **Create environment file:**
   ```bash
   cd docker
   cp .env.example .env
   # Edit .env and set your secrets (especially JWT_SECRET_KEY, DB_PASSWORD)
   ```

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

4. **Initialize database:**
   ```bash
   # Database tables are created automatically from /database/*.sql
   # Seed data is also loaded automatically
   ```

5. **Access the application:**
   - **Frontend:** http://localhost:3000
   - **Backend API:** http://localhost:8000
   - **API Docs:** http://localhost:8000/api/docs
   - **MinIO Console:** http://localhost:9001

6. **Default credentials:**
   - **Super Admin:** `admin` / `Admin@2026`
   - **DEO User:** `deo_user_1` / `Deo@2026`

   **⚠️ CHANGE THESE PASSWORDS IMMEDIATELY IN PRODUCTION!**

---

## Manual Setup (Without Docker)

### 1. Database Setup

**Install PostgreSQL 15+ with PostGIS:**
```bash
# Ubuntu/Debian
sudo apt install postgresql-15 postgresql-15-postgis-3

# Create database
sudo -u postgres psql
CREATE DATABASE ebarmm;
\c ebarmm
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;
CREATE USER ebarmm_app WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ebarmm TO ebarmm_app;
\q

# Run schema creation
psql -U ebarmm_app -d ebarmm -f database/01_create_tables.sql
psql -U ebarmm_app -d ebarmm -f database/02_create_triggers.sql
psql -U ebarmm_app -d ebarmm -f database/03_seed_data.sql
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations (if using Alembic)
alembic upgrade head

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Backend will be available at:** http://localhost:8000

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env.local

# Start development server
npm run dev
```

**Frontend will be available at:** http://localhost:3000

### 4. Object Storage (MinIO)

```bash
# Download MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# Start MinIO
mkdir -p ~/minio-data
minio server ~/minio-data --console-address ":9001"

# Create bucket (in another terminal)
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/ebarmm-media
mc policy set download local/ebarmm-media
```

### 5. Redis (for token blacklist)

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

---

## Data Migration from Legacy System

See `MIGRATION.md` for complete migration instructions.

**Quick migration:**
```bash
cd migration

# Configure legacy database connection
cp config.example.py config.py
# Edit config.py with legacy database credentials

# Run migration
python run_migration.py --step all
```

---

## Development Workflow

### Backend Development

```bash
cd backend

# Activate virtual environment
source venv/bin/activate

# Run with auto-reload
uvicorn app.main:app --reload

# Run tests
pytest

# Format code
black app/
flake8 app/

# Create new migration
alembic revision -m "description"
alembic upgrade head
```

### Frontend Development

```bash
cd frontend

# Start dev server
npm run dev

# Run linter
npm run lint

# Format code
npm run format

# Build for production
npm run build
npm run preview
```

---

## Production Deployment

### 1. Use Docker Compose (Recommended)

```bash
cd docker

# Set production environment variables
cp .env.example .env
# Edit .env:
# - Set strong JWT_SECRET_KEY (min 32 chars)
# - Set secure DB_PASSWORD
# - Set CORS_ORIGINS to your domain
# - Set S3 credentials

# Build and start with production profile
docker-compose --profile production up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 2. Nginx Configuration (Production)

```nginx
# /etc/nginx/sites-available/ebarmm
server {
    listen 443 ssl http2;
    server_name ebarmm.gov.ph;

    ssl_certificate /etc/letsencrypt/live/ebarmm.gov.ph/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ebarmm.gov.ph/privkey.pem;

    # Frontend
    location / {
        root /var/www/ebarmm/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name ebarmm.gov.ph;
    return 301 https://$server_name$request_uri;
}
```

### 3. Systemd Services (Alternative to Docker)

**Backend service:**
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

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ebarmm-backend
sudo systemctl start ebarmm-backend
sudo systemctl status ebarmm-backend
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Database connection
psql -U ebarmm_app -d ebarmm -c "SELECT COUNT(*) FROM projects;"

# Redis
redis-cli ping

# MinIO
curl http://localhost:9000/minio/health/live
```

### Logs

```bash
# Docker logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs postgres

# Systemd logs
sudo journalctl -u ebarmm-backend -f
```

### Backups

```bash
# Database backup
pg_dump -U ebarmm_app ebarmm > backup_$(date +%Y%m%d).sql

# Object storage backup (MinIO)
mc mirror local/ebarmm-media /backup/minio/

# Automated daily backup (crontab)
0 2 * * * /opt/ebarmm/scripts/backup.sh
```

### Performance Monitoring

- **Database:** Enable pg_stat_statements extension
- **API:** Prometheus metrics at http://localhost:8000/metrics
- **Frontend:** Browser DevTools Performance tab

---

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
psql -U postgres -l | grep ebarmm

# Test connection
psql -U ebarmm_app -d ebarmm -c "SELECT version();"
```

### Backend Won't Start

```bash
# Check logs
docker-compose logs backend

# Verify environment variables
docker-compose exec backend env | grep DATABASE_URL

# Test database connection
docker-compose exec backend python -c "from app.core.database import engine; print(engine.url)"
```

### Frontend Can't Connect to API

1. Check CORS settings in backend `.env`
2. Verify API URL in frontend `.env.local`
3. Check browser console for errors
4. Verify backend is running: `curl http://localhost:8000/health`

### MinIO Access Denied

```bash
# Check bucket policy
mc policy get local/ebarmm-media

# Set public read
mc policy set download local/ebarmm-media
```

---

## Security Checklist

Before deploying to production:

- [ ] Change all default passwords (admin, deo_user, database)
- [ ] Set strong JWT_SECRET_KEY (minimum 32 random characters)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure CORS to only allow your domain
- [ ] Set up firewall rules (allow only 80, 443)
- [ ] Enable database SSL connections
- [ ] Disable DEBUG mode in backend
- [ ] Set up regular automated backups
- [ ] Enable audit logging
- [ ] Configure rate limiting
- [ ] Review and restrict database user permissions
- [ ] Set up monitoring and alerting

---

## Support & Documentation

- **Full Architecture:** See `ARCHITECTURE.md`
- **API Documentation:** http://localhost:8000/api/docs (when running)
- **Database Schema:** See `database/` directory
- **Migration Guide:** See `MIGRATION.md`
- **Security:** See `SECURITY.md`

For issues and questions, contact the development team.
