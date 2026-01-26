#!/bin/bash
# =============================================================================
# E-BARMM Staging Environment Setup Script
# Run this on a fresh Ubuntu 22.04/24.04 LTS EC2 instance
# =============================================================================

set -e  # Exit on error

echo "=============================================="
echo "E-BARMM Staging Environment Setup"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Detect the current user (ubuntu on Ubuntu EC2)
CURRENT_USER=$(whoami)

# =============================================================================
# 1. System Update
# =============================================================================
echo ""
echo "Step 1: Updating system packages..."
sudo apt update && sudo apt upgrade -y
print_status "System updated"

# =============================================================================
# 2. Install PostgreSQL 15 + PostGIS
# =============================================================================
echo ""
echo "Step 2: Installing PostgreSQL 15 + PostGIS..."

# Add PostgreSQL official apt repository (Ubuntu default repos may not have PG 15)
sudo apt install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update

# Install PostgreSQL and PostGIS
sudo apt install -y postgresql-15 postgresql-15-postgis-3 postgresql-contrib-15

# PostgreSQL should auto-start on Ubuntu, but ensure it's running
sudo systemctl start postgresql
sudo systemctl enable postgresql

print_status "PostgreSQL 15 + PostGIS installed and running"

# =============================================================================
# 3. Configure PostgreSQL
# =============================================================================
echo ""
echo "Step 3: Configuring PostgreSQL..."

# Check if database already exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw ebarmm; then
    print_warning "Database 'ebarmm' already exists, skipping creation"
    # Still need to get password from user or generate new one
    echo ""
    echo "Since the database already exists, please enter the existing DB_PASSWORD"
    echo "or press Enter to generate a new one (will update the user password):"
    read -r EXISTING_PASSWORD
    if [ -n "$EXISTING_PASSWORD" ]; then
        DB_PASSWORD="$EXISTING_PASSWORD"
    else
        DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
        # Update password for existing user
        sudo -u postgres psql -c "ALTER USER ebarmm_app WITH PASSWORD '${DB_PASSWORD}';"
        print_status "Generated new password and updated user"
    fi
else
    # Generate random password for database
    DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

    # Create database and user
    sudo -u postgres psql <<EOF
-- Create application user
CREATE USER ebarmm_app WITH PASSWORD '${DB_PASSWORD}';

-- Create database
CREATE DATABASE ebarmm OWNER ebarmm_app;

-- Connect to database and setup extensions
\c ebarmm

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "postgis_topology";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ebarmm TO ebarmm_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ebarmm_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ebarmm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ebarmm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ebarmm_app;
EOF
    print_status "Database and user created"
fi

# Configure pg_hba.conf to allow Docker connections
PG_HBA="/etc/postgresql/15/main/pg_hba.conf"
sudo cp $PG_HBA ${PG_HBA}.backup

# Add Docker network access (both default bridge and compose networks)
echo "# Docker network access" | sudo tee -a $PG_HBA
echo "host    all    ebarmm_app    172.17.0.0/16    scram-sha-256" | sudo tee -a $PG_HBA
echo "host    all    ebarmm_app    172.18.0.0/16    scram-sha-256" | sudo tee -a $PG_HBA
echo "host    all    ebarmm_app    172.19.0.0/16    scram-sha-256" | sudo tee -a $PG_HBA

# Configure postgresql.conf to listen on Docker interface
PG_CONF="/etc/postgresql/15/main/postgresql.conf"
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost,172.17.0.1'/" $PG_CONF

# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql

print_status "PostgreSQL configured"
print_status "Database password: ${DB_PASSWORD} (save this!)"

# =============================================================================
# 4. Install Docker
# =============================================================================
echo ""
echo "Step 4: Installing Docker..."

# Install Docker using official method
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $CURRENT_USER

# Create service to restart PostgreSQL after Docker (so it binds to docker0 interface)
# The docker0 interface (172.17.0.1) doesn't exist until Docker starts,
# so PostgreSQL needs to restart after Docker to bind to it.
cat <<EOF | sudo tee /etc/systemd/system/postgresql-docker-fix.service
[Unit]
Description=Restart PostgreSQL after Docker network is ready
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStartPre=/bin/sleep 5
ExecStart=/bin/systemctl restart postgresql
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable postgresql-docker-fix.service

print_status "Docker installed (PostgreSQL will restart after Docker on reboot)"

# =============================================================================
# 5. Install Git (usually pre-installed on Ubuntu)
# =============================================================================
echo ""
echo "Step 5: Installing Git..."

sudo apt install -y git

print_status "Git installed"

# =============================================================================
# 6. Create backup directory and script
# =============================================================================
echo ""
echo "Step 6: Setting up backup system..."

# cron is usually pre-installed on Ubuntu, but ensure it's running
sudo apt install -y cron
sudo systemctl enable cron
sudo systemctl start cron

sudo mkdir -p /backups
sudo chown $CURRENT_USER:$CURRENT_USER /backups

# Create backup script
cat > /home/$CURRENT_USER/backup-postgres.sh << 'BACKUP_SCRIPT'
#!/bin/bash
# PostgreSQL Backup Script

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="ebarmm_${DATE}.sql.gz"

# Create backup
sudo -u postgres pg_dump ebarmm | gzip > ${BACKUP_DIR}/${FILENAME}

# Optional: Upload to S3 (uncomment and configure)
# aws s3 cp ${BACKUP_DIR}/${FILENAME} s3://your-backup-bucket/postgres/

# Keep only last 7 days of local backups
find ${BACKUP_DIR} -name "ebarmm_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${FILENAME}"
BACKUP_SCRIPT

chmod +x /home/$CURRENT_USER/backup-postgres.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/$CURRENT_USER/backup-postgres.sh >> /var/log/backup.log 2>&1") | crontab -

print_status "Backup system configured"

# =============================================================================
# 7. Generate JWT Secret
# =============================================================================
JWT_SECRET=$(openssl rand -hex 32)

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=============================================="
echo "Setup Complete!"
echo "=============================================="
echo ""
echo "Save these credentials securely:"
echo "----------------------------------------"
echo "Database User:     ebarmm_app"
echo "Database Password: ${DB_PASSWORD}"
echo "Database Name:     ebarmm"
echo "JWT Secret:        ${JWT_SECRET}"
echo "----------------------------------------"
echo ""
echo "Next steps:"
echo "1. Log out and back in (for Docker group)"
echo "2. Clone your repository (if not already done)"
echo "3. Create .env.staging from .env.staging.example"
echo "4. Run database init scripts:"
echo "   sudo -u postgres psql ebarmm < database/01_create_tables.sql"
echo "   sudo -u postgres psql ebarmm < database/02_create_triggers.sql"
echo "   sudo -u postgres psql ebarmm < database/03_seed_data.sql"
echo "   sudo -u postgres psql ebarmm < database/04_user_management.sql"
echo "   sudo -u postgres psql ebarmm < database/05_demo_data.sql  # Optional"
echo "5. Grant permissions to app user (REQUIRED after running SQL scripts):"
echo "   sudo -u postgres psql ebarmm -c \"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ebarmm_app;\""
echo "   sudo -u postgres psql ebarmm -c \"GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ebarmm_app;\""
echo "6. Start services:"
echo "   cd docker"
echo "   docker compose -f docker-compose.staging.yml --env-file .env.staging up -d"
echo ""
print_warning "IMPORTANT: Log out and back in for Docker permissions to take effect!"
