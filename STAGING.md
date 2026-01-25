# Staging Environment Setup Guide

This guide walks you through deploying E-BARMM to AWS for staging.

## Architecture

```
EC2 Instance (t3.medium)
├── PostgreSQL 15 + PostGIS (native)
├── Docker
│   ├── Backend (FastAPI)
│   ├── Frontend (Nginx)
│   └── Redis
└── AWS S3 (media storage)
```

**Estimated Cost:** ~$35/month

---

## Prerequisites

- AWS Account
- SSH key pair for EC2
- Basic familiarity with AWS Console

---

## Step 1: Create EC2 Instance

### 1.1 Launch Instance

**AWS Console → EC2 → Launch instances**

| Setting | Value |
|---------|-------|
| Name | `ebarmm-staging` |
| AMI | Amazon Linux 2023 |
| Instance type | `t3.medium` (or `t3.small` for lower cost) |
| Key pair | Create new or select existing |
| Storage | 30 GB gp3 |

### 1.2 Configure Security Group

Create a new security group `ebarmm-staging-sg` with these inbound rules:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | My IP | SSH access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Secure web traffic |

### 1.3 Allocate Elastic IP

**EC2 → Elastic IPs → Allocate → Associate** with your instance.

Note this IP - this is your staging server address.

### 1.4 Protect Instance

**EC2 → Select instance → Actions → Instance Settings → Change Termination Protection → Enable**

---

## Step 2: Create S3 Bucket

### 2.1 Create Bucket

**AWS Console → S3 → Create bucket**

| Setting | Value |
|---------|-------|
| Bucket name | `ebarmm-staging-media` |
| Region | Same as EC2 (e.g., `ap-southeast-1`) |
| Object Ownership | ACLs disabled |
| Block Public Access | **Uncheck all** (media needs public read) |

### 2.2 Add Bucket Policy

**Bucket → Permissions → Bucket Policy → Edit**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::ebarmm-staging-media/*"
        }
    ]
}
```

---

## Step 3: Create IAM User for S3 Access

### 3.1 Create Policy

**AWS Console → IAM → Policies → Create policy → JSON**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::ebarmm-staging-media",
                "arn:aws:s3:::ebarmm-staging-media/*"
            ]
        }
    ]
}
```

Name: `ebarmm-s3-access`

### 3.2 Create User

**IAM → Users → Create user**

| Setting | Value |
|---------|-------|
| User name | `ebarmm-staging-s3` |
| Permissions | Attach `ebarmm-s3-access` policy |

### 3.3 Create Access Key

**Select user → Security credentials → Create access key**

- Select "Application running outside AWS"
- **Save both keys** - you'll need them for `.env.staging`

| Key | Use For |
|-----|---------|
| Access Key ID | `S3_ACCESS_KEY` in .env.staging |
| Secret Access Key | `S3_SECRET_KEY` in .env.staging |

---

## Step 4: Setup EC2 Instance

### 4.1 Connect to EC2

```bash
ssh -i "your-key.pem" ec2-user@YOUR_ELASTIC_IP
```

### 4.2 Clone Repository

```bash
cd ~
git clone https://github.com/YOUR_ORG/ebarmm.git
cd ebarmm
```

### 4.3 Run Setup Script

```bash
chmod +x scripts/setup-staging-ec2.sh
./scripts/setup-staging-ec2.sh
```

**Save the output!** It contains:
- Database password (`DB_PASSWORD`)
- JWT secret (`JWT_SECRET_KEY`)

### 4.4 Log Out and Back In

Required for Docker group permissions:

```bash
exit
ssh -i "your-key.pem" ec2-user@YOUR_ELASTIC_IP
```

---

## Step 5: Initialize Database

```bash
cd ~/ebarmm

# Run initialization scripts
sudo -u postgres psql ebarmm < database/01_create_tables.sql
sudo -u postgres psql ebarmm < database/02_create_triggers.sql
sudo -u postgres psql ebarmm < database/03_seed_data.sql
sudo -u postgres psql ebarmm < database/04_user_management.sql
```

---

## Step 6: Configure Environment

### 6.1 Create Environment File

```bash
cd ~/ebarmm/docker
cp .env.staging.example .env.staging
nano .env.staging
```

### 6.2 Fill In Values

```bash
# DATABASE (from setup script output)
DB_USER=ebarmm_app
DB_PASSWORD=<password from setup script>
DB_NAME=ebarmm

# AWS S3 (from IAM user creation)
AWS_REGION=ap-southeast-1
S3_ACCESS_KEY=<your IAM access key>
S3_SECRET_KEY=<your IAM secret key>
S3_BUCKET=ebarmm-staging-media

# SECURITY (from setup script output)
JWT_SECRET_KEY=<JWT secret from setup script>

# CORS (your Elastic IP)
CORS_ORIGINS=["http://YOUR_ELASTIC_IP"]
```

### 6.3 Quick Reference: Where to Get Each Value

| Value | Source |
|-------|--------|
| `DB_PASSWORD` | Setup script output |
| `S3_ACCESS_KEY` | IAM user → Security credentials |
| `S3_SECRET_KEY` | IAM user → Security credentials |
| `S3_BUCKET` | S3 bucket name you created |
| `AWS_REGION` | Your EC2 region (e.g., `ap-southeast-1`) |
| `JWT_SECRET_KEY` | Setup script output |
| `CORS_ORIGINS` | Your Elastic IP |

---

## Step 7: Start Services

```bash
cd ~/ebarmm/docker
docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d
```

Verify services are running:

```bash
docker-compose -f docker-compose.staging.yml ps
```

---

## Step 8: Verify Deployment

### 8.1 Check Services

| URL | Expected |
|-----|----------|
| `http://YOUR_ELASTIC_IP` | Frontend loads |
| `http://YOUR_ELASTIC_IP:8000/docs` | API docs load |
| `http://YOUR_ELASTIC_IP:8000/api/v1/health` | Health check passes |

### 8.2 Test Login

Default admin credentials:
- Username: `admin`
- Password: `admin123`

**Change this password immediately after first login!**

---

## Common Commands

### View Logs

```bash
cd ~/ebarmm/docker

# All services
docker-compose -f docker-compose.staging.yml logs -f

# Specific service
docker-compose -f docker-compose.staging.yml logs -f backend
```

### Restart Services

```bash
# Restart all
docker-compose -f docker-compose.staging.yml restart

# Restart specific service
docker-compose -f docker-compose.staging.yml restart backend
```

### Stop Services

```bash
docker-compose -f docker-compose.staging.yml down
```

### Update Deployment

```bash
cd ~/ebarmm
git pull origin main

cd docker
docker-compose -f docker-compose.staging.yml build
docker-compose -f docker-compose.staging.yml up -d
```

---

## Backup & Recovery

### Database Backup

Automated daily backups run at 2 AM (configured by setup script).

Manual backup:
```bash
~/backup-postgres.sh
```

Backups stored in `/backups/`.

### Restore Database

```bash
gunzip -c /backups/ebarmm_YYYYMMDD_HHMMSS.sql.gz | sudo -u postgres psql ebarmm
```

### Upload Backups to S3 (Optional)

Edit `/home/ec2-user/backup-postgres.sh` and uncomment the S3 upload line:

```bash
aws s3 cp ${BACKUP_DIR}/${FILENAME} s3://your-backup-bucket/postgres/
```

---

## SSL/HTTPS (Optional)

### Using Let's Encrypt

```bash
# Install certbot
sudo dnf install -y certbot

# Get certificate (stop frontend first)
docker-compose -f docker-compose.staging.yml stop frontend
sudo certbot certonly --standalone -d staging.yourdomain.com

# Update nginx config to use certificates
# Certificates are in /etc/letsencrypt/live/staging.yourdomain.com/
```

---

## Troubleshooting

### Backend can't connect to database

Check PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

Check pg_hba.conf allows Docker connections:
```bash
sudo cat /var/lib/pgsql/data/pg_hba.conf | grep 172.17
```

Should show:
```
host    all    ebarmm_app    172.17.0.0/16    scram-sha-256
```

### Backend can't connect to S3

Verify credentials:
```bash
# Test S3 access
aws s3 ls s3://ebarmm-staging-media/ --region ap-southeast-1
```

Check environment variables:
```bash
docker-compose -f docker-compose.staging.yml exec backend env | grep S3
```

### Services won't start

Check Docker logs:
```bash
docker-compose -f docker-compose.staging.yml logs backend
```

Check disk space:
```bash
df -h
```

### Permission denied errors

Re-login for Docker group:
```bash
exit
ssh -i "your-key.pem" ec2-user@YOUR_ELASTIC_IP
```

---

## Cost Breakdown

| Resource | Monthly Cost |
|----------|-------------|
| EC2 t3.medium | ~$30 |
| Elastic IP (attached) | Free |
| S3 (~10GB) | ~$0.25 |
| Data transfer | ~$1-5 |
| **Total** | **~$32-36** |

To reduce costs:
- Use `t3.small` (~$15/month) for light usage
- Enable EC2 auto-stop during off-hours

---

## Security Checklist

- [ ] Change default admin password
- [ ] Restrict SSH to your IP only
- [ ] Enable EC2 termination protection
- [ ] Set strong `DB_PASSWORD`
- [ ] Set strong `JWT_SECRET_KEY` (32+ characters)
- [ ] Enable EBS snapshots for backup
- [ ] Consider enabling SSL/HTTPS
