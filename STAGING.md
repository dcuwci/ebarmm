# Staging Environment Setup Guide

This guide walks you through deploying E-BARMM to AWS for staging. Instructions are provided for both **AWS Console (GUI)** and **AWS CLI** methods.

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

- AWS Account with admin access
- SSH key pair for EC2 (will create if needed)
- Basic familiarity with AWS Console OR AWS CLI installed

---

## Step 1: Create EC2 Instance

### Option A: AWS Console (GUI)

#### 1.1 Navigate to EC2

1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. In the search bar at the top, type **EC2** and click on it
3. Make sure you're in your desired region (top-right dropdown, e.g., **Asia Pacific (Singapore) ap-southeast-1**)

#### 1.2 Create Key Pair (if needed)

1. In the left sidebar, click **Key Pairs** under "Network & Security"
2. Click **Create key pair** button (top-right)
3. Enter:
   - **Name:** `ebarmm-staging-key`
   - **Key pair type:** RSA
   - **Private key file format:** `.pem` (for Mac/Linux) or `.ppk` (for Windows PuTTY)
4. Click **Create key pair**
5. **Important:** Save the downloaded file securely - you cannot download it again!

#### 1.3 Launch Instance

1. In the left sidebar, click **Instances**
2. Click **Launch instances** button (top-right)
3. Configure the instance:

   **Name and tags:**
   - **Name:** `ebarmm-staging`

   **Application and OS Images (AMI):**
   - Click **Ubuntu** in the Quick Start tabs
   - Select **Ubuntu Server 22.04 LTS** or **Ubuntu Server 24.04 LTS** (Free tier eligible)

   **Instance type:**
   - Select **t3.medium** (2 vCPU, 4 GB RAM)
   - Or **t3.small** for lower cost (2 vCPU, 2 GB RAM)

   **Key pair (login):**
   - Select the key pair you created (`ebarmm-staging-key`)

   **Network settings:**
   - Click **Edit** button
   - **Auto-assign public IP:** Enable
   - **Firewall (security groups):** Create security group
   - **Security group name:** `ebarmm-staging-sg`
   - **Description:** `Security group for E-BARMM staging`

   **Inbound Security Group Rules:**
   - **Rule 1:** SSH, Port 22, Source: My IP
   - Click **Add security group rule**
   - **Rule 2:** HTTP, Port 80, Source: Anywhere (0.0.0.0/0)
   - Click **Add security group rule**
   - **Rule 3:** HTTPS, Port 443, Source: Anywhere (0.0.0.0/0)

   **Configure storage:**
   - Change **8 GiB** to **30 GiB**
   - Keep **gp3** as volume type

4. Review the **Summary** panel on the right
5. Click **Launch instance**
6. Click **View all instances** to see your new instance

#### 1.4 Allocate Elastic IP

1. In the left sidebar, click **Elastic IPs** under "Network & Security"
2. Click **Allocate Elastic IP address**
3. Keep defaults and click **Allocate**
4. Select the new Elastic IP (checkbox)
5. Click **Actions** → **Associate Elastic IP address**
6. **Instance:** Select your `ebarmm-staging` instance
7. Click **Associate**
8. **Note this IP address** - this is your staging server address!

#### 1.5 Enable Termination Protection

1. Go to **Instances** in the left sidebar
2. Select your `ebarmm-staging` instance (checkbox)
3. Click **Actions** → **Instance settings** → **Change termination protection**
4. Check **Enable** and click **Save**

### Option B: AWS CLI

```bash
# Set your region
export AWS_REGION=ap-southeast-1

# Create key pair
aws ec2 create-key-pair \
  --key-name ebarmm-staging-key \
  --query 'KeyMaterial' \
  --output text > ebarmm-staging-key.pem
chmod 400 ebarmm-staging-key.pem

# Create security group
SG_ID=$(aws ec2 create-security-group \
  --group-name ebarmm-staging-sg \
  --description "Security group for E-BARMM staging" \
  --query 'GroupId' --output text)

# Add inbound rules
aws ec2 authorize-security-group-ingress --group-id $SG_ID \
  --protocol tcp --port 22 --cidr $(curl -s https://checkip.amazonaws.com)/32
aws ec2 authorize-security-group-ingress --group-id $SG_ID \
  --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID \
  --protocol tcp --port 443 --cidr 0.0.0.0/0

# Get latest Ubuntu 22.04 LTS AMI
AMI_ID=$(aws ec2 describe-images \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.medium \
  --key-name ebarmm-staging-key \
  --security-group-ids $SG_ID \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ebarmm-staging}]' \
  --query 'Instances[0].InstanceId' --output text)

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Allocate and associate Elastic IP
ALLOC_ID=$(aws ec2 allocate-address --query 'AllocationId' --output text)
aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOC_ID

# Get the Elastic IP
ELASTIC_IP=$(aws ec2 describe-addresses --allocation-ids $ALLOC_ID \
  --query 'Addresses[0].PublicIp' --output text)
echo "Your staging server IP: $ELASTIC_IP"

# Enable termination protection
aws ec2 modify-instance-attribute --instance-id $INSTANCE_ID --disable-api-termination
```

---

## Step 2: Create S3 Bucket

### Option A: AWS Console (GUI)

#### 2.1 Navigate to S3

1. In the AWS Console search bar, type **S3** and click on it
2. Click **Create bucket** button

#### 2.2 Configure Bucket

1. **General configuration:**
   - **Bucket name:** `ebarmm-staging-media` (must be globally unique - add random suffix if taken)
   - **AWS Region:** Same as your EC2 (e.g., `Asia Pacific (Singapore) ap-southeast-1`)

2. **Object Ownership:**
   - Keep **ACLs disabled (recommended)**

3. **Block Public Access settings for this bucket:**
   - **Uncheck** "Block all public access"
   - A warning will appear - check the acknowledgment box
   - (We need public read access for media files)

4. **Bucket Versioning:**
   - Keep **Disabled** (optional: enable for backup purposes)

5. **Default encryption:**
   - Keep defaults (Server-side encryption with Amazon S3 managed keys)

6. Click **Create bucket**

#### 2.3 Add Bucket Policy

1. Click on your new bucket name to open it
2. Click the **Permissions** tab
3. Scroll down to **Bucket policy** and click **Edit**
4. Copy and paste **only the JSON below** (not the ` ```json ` markers):

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

5. If you used a different bucket name, replace `ebarmm-staging-media` with your bucket name
6. Click **Save changes**

#### 2.4 Configure CORS (Required for uploads)

1. Stay in the **Permissions** tab
2. Scroll down to **Cross-origin resource sharing (CORS)** and click **Edit**
3. Paste the following JSON:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

4. Click **Save changes**

### Option B: AWS CLI

```bash
# Set bucket name (change if needed)
BUCKET_NAME=ebarmm-staging-media

# Create bucket (for regions other than us-east-1, specify LocationConstraint)
aws s3api create-bucket \
  --bucket $BUCKET_NAME \
  --region $AWS_REGION \
  --create-bucket-configuration LocationConstraint=$AWS_REGION

# Disable block public access
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Add bucket policy for public read
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*"
        }
    ]
}'

# Add CORS configuration for uploads
aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}'

echo "S3 bucket created: $BUCKET_NAME"
```

---

## Step 3: Create IAM User for S3 Access

### Option A: AWS Console (GUI)

#### 3.1 Navigate to IAM

1. In the AWS Console search bar, type **IAM** and click on it
2. You'll see the IAM Dashboard

#### 3.2 Create Policy

1. In the left sidebar, click **Policies**
2. Click **Create policy** button
3. Click the **JSON** tab (instead of Visual editor)
4. Delete the existing content and paste **only the JSON below** (not the ` ```json ` markers):

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

5. If you used a different bucket name, replace `ebarmm-staging-media` with your bucket name
6. Click **Next**
6. **Policy name:** `ebarmm-s3-access`
7. **Description:** `Allows E-BARMM backend to access S3 bucket for media storage`
8. Click **Create policy**

#### 3.3 Create User

1. In the left sidebar, click **Users**
2. Click **Create user** button
3. **User name:** `ebarmm-staging-s3`
4. Click **Next**
5. **Permissions options:** Select **Attach policies directly**
6. In the search box, type `ebarmm-s3-access`
7. Check the checkbox next to your policy
8. Click **Next**
9. Review and click **Create user**

#### 3.4 Create Access Key

1. Click on the user name `ebarmm-staging-s3` to open user details
2. Click the **Security credentials** tab
3. Scroll down to **Access keys** section
4. Click **Create access key**
5. **Use case:** Select **Application running outside AWS**
6. Check the confirmation checkbox and click **Next**
7. **Description tag (optional):** `E-BARMM staging backend`
8. Click **Create access key**
9. **IMPORTANT:** Copy both keys now or click **Download .csv file**
   - **Access key ID** → use as `S3_ACCESS_KEY`
   - **Secret access key** → use as `S3_SECRET_KEY`
10. Click **Done**

> ⚠️ **Warning:** You can only view the secret access key once! Save it securely.

### Option B: AWS CLI

```bash
# Create the IAM policy
POLICY_ARN=$(aws iam create-policy \
  --policy-name ebarmm-s3-access \
  --policy-document '{
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
}' --query 'Policy.Arn' --output text)

# Create IAM user
aws iam create-user --user-name ebarmm-staging-s3

# Attach policy to user
aws iam attach-user-policy \
  --user-name ebarmm-staging-s3 \
  --policy-arn $POLICY_ARN

# Create access key
aws iam create-access-key --user-name ebarmm-staging-s3

# Output will show AccessKeyId and SecretAccessKey - SAVE THESE!
```

### Quick Reference: Credentials to Save

| Key | Where to Find | Use In |
|-----|---------------|--------|
| Access Key ID | IAM → Users → Security credentials | `S3_ACCESS_KEY` in .env.staging |
| Secret Access Key | Shown once at creation | `S3_SECRET_KEY` in .env.staging |

---

## Step 4: Setup EC2 Instance

### 4.1 Connect to EC2

```bash
ssh -i "your-key.pem" ubuntu@YOUR_ELASTIC_IP
```

### 4.2 Install Git (if needed)

Git is typically pre-installed on Ubuntu. If not:

```bash
sudo apt install -y git
```

### 4.3 Clone Repository

```bash
cd ~
git clone https://github.com/YOUR_ORG/ebarmm.git
cd ebarmm
```

### 4.4 Run Setup Script

```bash
chmod +x scripts/setup-staging-ec2.sh
./scripts/setup-staging-ec2.sh
```

**Save the output!** It contains:
- Database password (`DB_PASSWORD`)
- JWT secret (`JWT_SECRET_KEY`)

### 4.5 Log Out and Back In

Required for Docker group permissions:

```bash
exit
ssh -i "your-key.pem" ubuntu@YOUR_ELASTIC_IP
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

### 5.1 Load Demo Data (Optional)

To load sample projects with GIS features for testing:

```bash
sudo -u postgres psql ebarmm < database/05_demo_data.sql
```

This includes:
- 4 sample projects (Cotabato City, Lanao, Maguindanao, Parang)
- 12 GIS road features with real BARMM coordinates
- Sample progress log entries

### 5.2 Grant Permissions (Required)

After running the SQL scripts, grant permissions to the app user:

```bash
sudo -u postgres psql ebarmm -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ebarmm_app;"
sudo -u postgres psql ebarmm -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ebarmm_app;"
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
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d
```

Verify services are running:

```bash
docker compose -f docker-compose.staging.yml ps
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
docker compose -f docker-compose.staging.yml logs -f

# Specific service
docker compose -f docker-compose.staging.yml logs -f backend
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.staging.yml restart

# Restart specific service
docker compose -f docker-compose.staging.yml restart backend
```

### Stop Services

```bash
docker compose -f docker-compose.staging.yml down
```

### Update Deployment

```bash
cd ~/ebarmm
git pull origin main

cd docker
docker compose -f docker-compose.staging.yml build
docker compose -f docker-compose.staging.yml up -d
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

Edit `/home/ubuntu/backup-postgres.sh` and uncomment the S3 upload line:

```bash
aws s3 cp ${BACKUP_DIR}/${FILENAME} s3://your-backup-bucket/postgres/
```

---

## SSL/HTTPS (Optional)

### Using Let's Encrypt

```bash
# Install certbot
sudo apt install -y certbot

# Get certificate (stop frontend first)
docker compose -f docker-compose.staging.yml stop frontend
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
sudo cat /etc/postgresql/15/main/pg_hba.conf | grep 172.17
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
docker compose -f docker-compose.staging.yml exec backend env | grep S3
```

### Services won't start

Check Docker logs:
```bash
docker compose -f docker-compose.staging.yml logs backend
```

Check disk space:
```bash
df -h
```

### Permission denied errors

Re-login for Docker group:
```bash
exit
ssh -i "your-key.pem" ubuntu@YOUR_ELASTIC_IP
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

## Mobile App Testing

The mobile app has build variants for different environments.

### Configure Staging URL

Edit `mobile/app/build.gradle.kts` and update the staging server IP:

```kotlin
create("staging") {
    // IMPORTANT: initWith must come BEFORE buildConfigField or URL gets overwritten
    initWith(getByName("debug"))
    buildConfigField("String", "API_BASE_URL", "\"http://YOUR_ELASTIC_IP:8000\"")
    isDebuggable = true
    applicationIdSuffix = ".staging"
    versionNameSuffix = "-staging"
}
```

### Build Variants

| Variant | Command | API Target |
|---------|---------|------------|
| Debug | `./gradlew assembleDebug` | Local (`10.0.2.2:8000`) |
| Staging | `./gradlew assembleStaging` | Staging server |
| Release | `./gradlew assembleRelease` | Production |

### Build Staging APK

```bash
cd mobile

# Update staging IP in build.gradle.kts first, then:
./gradlew clean assembleStaging

# APK location:
# mobile/app/build/outputs/apk/staging/app-staging.apk
```

### Install on Device/Emulator

```bash
# Via ADB
adb install app/build/outputs/apk/staging/app-staging.apk

# Or open in Android Studio and select "staging" build variant
```

### Testing Checklist

- [ ] Login works with staging credentials
- [ ] Projects list loads
- [ ] Map displays correctly
- [ ] Photo upload works (saved to S3)
- [ ] Offline mode queues data correctly
- [ ] Sync works when back online

---

## Security Checklist

- [ ] Change default admin password
- [ ] Restrict SSH to your IP only
- [ ] Enable EC2 termination protection
- [ ] Set strong `DB_PASSWORD`
- [ ] Set strong `JWT_SECRET_KEY` (32+ characters)
- [ ] Enable EBS snapshots for backup
- [ ] Consider enabling SSL/HTTPS
