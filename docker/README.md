# E-BARMM Docker Deployment

## Local Development

Use infrastructure-only compose (runs Postgres, Redis, MinIO):

```bash
cd docker
docker-compose -f docker-compose.infrastructure.yml up -d
```

Then run backend and frontend manually:
```bash
# Terminal 1 - Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## EC2 Deployment

### 1. Launch EC2 Instance
- **AMI:** Amazon Linux 2023
- **Instance type:** t3.small (2 vCPU, 2GB RAM)
- **Storage:** 20GB
- **Security Group ports:** 22, 3000, 8000

### 2. SSH into EC2
```bash
ssh -i "your-key.pem" ec2-user@<EC2-IP>
```

### 3. Install Docker
```bash
sudo yum update -y
sudo yum install -y docker git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
```

### 4. Log out and back in
```bash
exit
# SSH back in
```

### 5. Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 6. Install Docker Buildx (required for Compose V2)
```bash
mkdir -p ~/.docker/cli-plugins
curl -L "https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64" -o ~/.docker/cli-plugins/docker-buildx
chmod +x ~/.docker/cli-plugins/docker-buildx

# Verify
docker buildx version
```

### 7. Clone and Run
```bash
git clone https://github.com/dcuwci/ebarmm.git
cd ebarmm/docker
docker-compose up -d
```

### 8. Access
- Frontend: `http://<EC2-IP>:3000`
- API docs: `http://<EC2-IP>:8000/docs`
- MinIO console: `http://<EC2-IP>:9001` (admin: minioadmin/minioadmin)

## Useful Commands

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend

# Restart services
docker-compose restart

# Stop all
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```
