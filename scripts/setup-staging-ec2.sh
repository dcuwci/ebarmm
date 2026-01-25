#!/bin/bash
# =============================================================================
# E-BARMM Staging Environment Setup Script
# Run this on a fresh Amazon Linux 2023 EC2 instance
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

# =============================================================================
# 1. System Update
# =============================================================================
echo ""
echo "Step 1: Updating system packages..."
sudo dnf update -y
print_status "System updated"

# =============================================================================
# 2. Install PostgreSQL 15 + PostGIS
# =============================================================================
echo ""
echo "Step 2: Installing PostgreSQL 15 + PostGIS..."

# Install PostgreSQL
sudo dnf install -y postgresql15-server postgresql15-contrib

# Check if PostGIS is available, install if possible
if sudo dnf list available | grep -q postgis; then
    sudo dnf install -y postgis34_15 || print_warning "PostGIS package not found, will install extensions manually"
fi

# Initialize PostgreSQL (skip if already initialized)
if [ ! -f /var/lib/pgsql/data/PG_VERSION ]; then
    sudo postgresql-setup --initdb
    print_status "PostgreSQL initialized"
else
    print_warning "PostgreSQL already initialized, skipping initdb"
fi

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

print_status "PostgreSQL 15 installed and running"

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

-- PostGIS (if available)
CREATE EXTENSION IF NOT EXISTS "postgis";

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
PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
sudo cp $PG_HBA ${PG_HBA}.backup

# Add Docker network access
echo "# Docker network access" | sudo tee -a $PG_HBA
echo "host    all    ebarmm_app    172.17.0.0/16    scram-sha-256" | sudo tee -a $PG_HBA

# Configure postgresql.conf to listen on Docker interface
PG_CONF="/var/lib/pgsql/data/postgresql.conf"
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

sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

print_status "Docker installed"

# =============================================================================
# 5. Install Docker Compose
# =============================================================================
echo ""
echo "Step 5: Installing Docker Compose..."

sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

print_status "Docker Compose installed"

# =============================================================================
# 6. Install Git
# =============================================================================
echo ""
echo "Step 6: Installing Git..."

sudo dnf install -y git

print_status "Git installed"

# =============================================================================
# 7. Create backup directory and script
# =============================================================================
echo ""
echo "Step 7: Setting up backup system..."

# Install cronie for crontab (not installed by default on Amazon Linux 2023)
sudo dnf install -y cronie
sudo systemctl enable crond
sudo systemctl start crond

sudo mkdir -p /backups
sudo chown ec2-user:ec2-user /backups

# Create backup script
cat > /home/ec2-user/backup-postgres.sh << 'BACKUP_SCRIPT'
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

chmod +x /home/ec2-user/backup-postgres.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ec2-user/backup-postgres.sh >> /var/log/backup.log 2>&1") | crontab -

print_status "Backup system configured"

# =============================================================================
# 8. Generate JWT Secret
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
echo "2. Clone your repository"
echo "3. Create .env.staging from .env.staging.example"
echo "4. Run database init scripts:"
echo "   sudo -u postgres psql ebarmm < database/01_create_tables.sql"
echo "   sudo -u postgres psql ebarmm < database/02_create_triggers.sql"
echo "   sudo -u postgres psql ebarmm < database/03_seed_data.sql"
echo "5. Start services:"
echo "   cd docker"
echo "   docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d"
echo ""
print_warning "IMPORTANT: Log out and back in for Docker permissions to take effect!"
