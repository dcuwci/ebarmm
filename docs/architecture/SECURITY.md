# Security & Integrity Controls

## 1. SECURITY OVERVIEW

### 1.1 Threat Model

**Primary Threats:**
1. **Data Tampering:** Backdating progress, inflating completion percentages
2. **Unauthorized Access:** DEO users accessing other DEOs' projects
3. **Privilege Escalation:** Users gaining admin access
4. **Data Breach:** Exposure of sensitive project data
5. **API Abuse:** Automated attacks, data scraping
6. **Insider Threats:** System admins modifying audit logs

**Attack Vectors:**
- Direct database manipulation
- SQL injection
- JWT token theft
- Man-in-the-middle attacks
- Compromised user credentials

---

## 2. AUTHENTICATION & AUTHORIZATION

### 2.1 JWT Implementation

**Token Structure:**
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid",
    "role": "deo_user",
    "deo_id": 5,
    "iat": 1704151200,
    "exp": 1704154800
  },
  "signature": "..."
}
```

**Token Generation (FastAPI):**
```python
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("JWT_SECRET_KEY")  # 256-bit secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)
```

**Token Validation:**
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        # Verify token not blacklisted
        if await is_token_blacklisted(token):
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = await get_user_by_id(user_id)
    if user is None:
        raise credentials_exception

    return user
```

**Token Blacklist (Redis):**
```python
import redis
from datetime import timedelta

redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

async def blacklist_token(token: str, expiry_seconds: int):
    """Add token to blacklist until it would naturally expire"""
    redis_client.setex(f"blacklist:{token}", expiry_seconds, "1")

async def is_token_blacklisted(token: str) -> bool:
    return redis_client.exists(f"blacklist:{token}") > 0
```

---

### 2.2 Role-Based Access Control (RBAC)

**Permission Matrix:**

| Role | Projects | Progress | GIS Features | Media | Users | Audit Logs |
|------|----------|----------|--------------|-------|-------|------------|
| **public** | Read (published) | Read (published) | Read | Read | - | - |
| **deo_user** | CRUD (own DEO) | Create (own) | CRUD (own) | CRUD (own) | - | - |
| **regional_admin** | CRUD (region) | Read (region) | CRUD (region) | CRUD (region) | Manage (DEO users) | Read (region) |
| **super_admin** | CRUD (all) | Read (all) | CRUD (all) | CRUD (all) | Manage (all) | Read (all) |

**RBAC Dependency:**
```python
from enum import Enum

class Role(str, Enum):
    PUBLIC = "public"
    DEO_USER = "deo_user"
    REGIONAL_ADMIN = "regional_admin"
    SUPER_ADMIN = "super_admin"

def require_role(allowed_roles: list[Role]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {allowed_roles}"
            )
        return current_user
    return role_checker

# Usage
@router.post("/projects")
async def create_project(
    project: ProjectCreate,
    current_user: User = Depends(require_role([Role.DEO_USER, Role.REGIONAL_ADMIN, Role.SUPER_ADMIN]))
):
    ...
```

**Row-Level Security (PostgreSQL):**
```sql
-- Enable RLS on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy for deo_user: Can only see their DEO's projects
CREATE POLICY deo_user_projects_policy ON projects
FOR SELECT
USING (
  current_setting('app.user_role') = 'super_admin' OR
  (
    current_setting('app.user_role') = 'deo_user' AND
    deo_id = current_setting('app.user_deo_id')::int
  )
);

-- Policy for INSERT: deo_user can only create for their DEO
CREATE POLICY deo_user_insert_policy ON projects
FOR INSERT
WITH CHECK (
  current_setting('app.user_role') = 'super_admin' OR
  (
    current_setting('app.user_role') = 'deo_user' AND
    deo_id = current_setting('app.user_deo_id')::int
  )
);

-- Set session variables from JWT
CREATE OR REPLACE FUNCTION set_session_user(
  user_id UUID,
  user_role TEXT,
  user_deo_id INT
) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.user_id', user_id::text, false);
  PERFORM set_config('app.user_role', user_role, false);
  PERFORM set_config('app.user_deo_id', COALESCE(user_deo_id, '0')::text, false);
END;
$$ LANGUAGE plpgsql;
```

**FastAPI Integration:**
```python
async def set_rls_context(user: User, db: Session):
    """Set PostgreSQL session variables for RLS"""
    db.execute(
        text("""
            SELECT set_session_user(:user_id, :user_role, :user_deo_id)
        """),
        {
            "user_id": str(user.user_id),
            "user_role": user.role,
            "user_deo_id": user.deo_id
        }
    )
```

---

## 3. TAMPER-PROOF PROGRESS LOGGING

### 3.1 Hash Chain Algorithm

**Concept:**
Each progress log entry contains a hash of its own data plus the hash of the previous entry, forming an immutable chain. Any modification breaks the chain.

**Hash Calculation (Python):**
```python
import hashlib
import json
from datetime import date
from uuid import UUID

def calculate_progress_hash(
    project_id: UUID,
    reported_percent: float,
    report_date: date,
    reported_by: UUID,
    prev_hash: str | None
) -> str:
    """
    Calculate SHA-256 hash for progress log entry.

    The hash is calculated from a canonical JSON representation
    to ensure consistency across implementations (Python, Kotlin, TypeScript).
    """
    payload = {
        "project_id": str(project_id),
        "reported_percent": float(reported_percent),
        "report_date": str(report_date),  # ISO format: YYYY-MM-DD
        "reported_by": str(reported_by),
        "prev_hash": prev_hash or ""
    }

    # Canonical JSON (sorted keys, no whitespace)
    canonical_json = json.dumps(payload, sort_keys=True, separators=(',', ':'))

    # SHA-256 hash
    hash_bytes = hashlib.sha256(canonical_json.encode('utf-8')).digest()

    # Hex representation
    return hash_bytes.hex()
```

**Database Trigger (Prevent Tampering):**
```sql
-- Function to reject any UPDATE or DELETE on progress logs
CREATE OR REPLACE FUNCTION reject_progress_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Progress logs are immutable. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

-- Trigger on UPDATE
CREATE TRIGGER prevent_progress_update
BEFORE UPDATE ON project_progress_logs
FOR EACH ROW
EXECUTE FUNCTION reject_progress_mutation();

-- Trigger on DELETE
CREATE TRIGGER prevent_progress_delete
BEFORE DELETE ON project_progress_logs
FOR EACH ROW
EXECUTE FUNCTION reject_progress_mutation();
```

**API Endpoint (Insert-Only):**
```python
@router.post("/projects/{project_id}/progress", status_code=201)
async def log_progress(
    project_id: UUID,
    progress: ProgressLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(403, "Access denied")

    # Get latest progress log for hash chain
    latest_log = db.query(ProjectProgressLog)\
        .filter(ProjectProgressLog.project_id == project_id)\
        .order_by(ProjectProgressLog.created_at.desc())\
        .first()

    prev_hash = latest_log.record_hash if latest_log else None

    # Calculate hash
    record_hash = calculate_progress_hash(
        project_id=project_id,
        reported_percent=progress.reported_percent,
        report_date=progress.report_date,
        reported_by=current_user.user_id,
        prev_hash=prev_hash
    )

    # Insert new log
    new_log = ProjectProgressLog(
        progress_id=uuid4(),
        project_id=project_id,
        reported_percent=progress.reported_percent,
        report_date=progress.report_date,
        remarks=progress.remarks,
        reported_by=current_user.user_id,
        created_at=datetime.utcnow(),
        prev_hash=prev_hash,
        record_hash=record_hash
    )

    db.add(new_log)

    # Audit log
    audit_entry = AuditLog(
        audit_id=uuid4(),
        actor_id=current_user.user_id,
        action="LOG_PROGRESS",
        entity_type="progress_log",
        entity_id=new_log.progress_id,
        payload={
            "project_id": str(project_id),
            "reported_percent": progress.reported_percent,
            "record_hash": record_hash
        },
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()

    return {
        "progress_id": str(new_log.progress_id),
        "record_hash": record_hash,
        "prev_hash": prev_hash
    }
```

---

### 3.2 Hash Chain Verification

**Verify Endpoint:**
```python
@router.get("/projects/{project_id}/progress/verify")
async def verify_progress_chain(
    project_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Verify integrity of progress log hash chain.
    Returns broken links if tampering detected.
    """
    logs = db.query(ProjectProgressLog)\
        .filter(ProjectProgressLog.project_id == project_id)\
        .order_by(ProjectProgressLog.created_at)\
        .all()

    if not logs:
        return {
            "project_id": str(project_id),
            "total_logs": 0,
            "chain_valid": True,
            "broken_links": []
        }

    broken_links = []
    prev_hash = None

    for log in logs:
        # Recalculate expected hash
        expected_hash = calculate_progress_hash(
            project_id=log.project_id,
            reported_percent=log.reported_percent,
            report_date=log.report_date,
            reported_by=log.reported_by,
            prev_hash=prev_hash
        )

        # Check if stored hash matches
        if expected_hash != log.record_hash:
            broken_links.append({
                "progress_id": str(log.progress_id),
                "report_date": str(log.report_date),
                "expected_hash": expected_hash,
                "actual_hash": log.record_hash,
                "tampered_at": log.created_at.isoformat()
            })

        # Check if prev_hash matches previous record_hash
        if prev_hash is not None and log.prev_hash != prev_hash:
            broken_links.append({
                "progress_id": str(log.progress_id),
                "report_date": str(log.report_date),
                "error": "prev_hash mismatch",
                "expected_prev_hash": prev_hash,
                "actual_prev_hash": log.prev_hash
            })

        prev_hash = log.record_hash

    return {
        "project_id": str(project_id),
        "total_logs": len(logs),
        "chain_valid": len(broken_links) == 0,
        "broken_links": broken_links
    }
```

**Scheduled Verification Task:**
```python
# Background task to verify all projects daily
from celery import Celery

celery_app = Celery('ebarmm', broker='redis://localhost:6379/0')

@celery_app.task
def verify_all_progress_chains():
    """
    Run nightly verification of all progress chains.
    Alert admins if tampering detected.
    """
    db = SessionLocal()

    projects = db.query(Project).all()
    tampered_projects = []

    for project in projects:
        result = verify_progress_chain_internal(project.project_id, db)

        if not result["chain_valid"]:
            tampered_projects.append({
                "project_id": str(project.project_id),
                "project_title": project.project_title,
                "broken_links": result["broken_links"]
            })

    if tampered_projects:
        # Send alert to super admins
        send_tampering_alert(tampered_projects)

    db.close()
```

---

## 4. AUDIT LOGGING

### 4.1 Audit Log Implementation

**Audit Log Table:**
```sql
CREATE TABLE audit_logs (
  audit_id UUID PRIMARY KEY,
  actor_id UUID REFERENCES users(user_id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMP NOT NULL,
  prev_hash TEXT,
  record_hash TEXT
);

-- Same immutability pattern as progress logs
CREATE TRIGGER prevent_audit_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION reject_progress_mutation();

CREATE TRIGGER prevent_audit_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION reject_progress_mutation();
```

**FastAPI Middleware (Auto-Logging):**
```python
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip for GET requests and public endpoints
        if request.method == "GET" or request.url.path.startswith("/public"):
            return await call_next(request)

        # Capture request
        body = await request.body()
        user = request.state.user if hasattr(request.state, "user") else None

        # Process request
        response = await call_next(request)

        # Log mutation
        if user and response.status_code < 400:
            await log_audit_entry(
                actor_id=user.user_id,
                action=f"{request.method} {request.url.path}",
                entity_type=extract_entity_type(request.url.path),
                entity_id=extract_entity_id(request.url.path),
                payload=json.loads(body) if body else {}
            )

        return response

app.add_middleware(AuditMiddleware)
```

**Audit Query Endpoint:**
```python
@router.get("/audit/logs")
async def get_audit_logs(
    actor_id: UUID | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(require_role([Role.SUPER_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Query audit logs (super admin only).
    """
    query = db.query(AuditLog)

    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)

    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc())\
        .offset(offset)\
        .limit(limit)\
        .all()

    return {
        "total": total,
        "logs": [serialize_audit_log(log) for log in logs]
    }
```

---

## 5. DATA ENCRYPTION

### 5.1 Encryption at Rest

**PostgreSQL Transparent Data Encryption (TDE):**
```bash
# Enable encryption for PostgreSQL data directory
# Using pgcrypto extension

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive fields
ALTER TABLE users
ALTER COLUMN password_hash TYPE TEXT
USING pgp_sym_encrypt(password_hash, 'encryption-key-from-env');

-- Example: Encrypted JSONB field
CREATE TABLE encrypted_documents (
  id UUID PRIMARY KEY,
  encrypted_data BYTEA  -- pgp_sym_encrypt result
);
```

**Filesystem Encryption:**
```bash
# Use LUKS for encrypting disk volumes
cryptsetup luksFormat /dev/sdb
cryptsetup luksOpen /dev/sdb encrypted_volume
mkfs.ext4 /dev/mapper/encrypted_volume
mount /dev/mapper/encrypted_volume /var/lib/postgresql
```

---

### 5.2 Encryption in Transit

**HTTPS/TLS Configuration (Nginx):**
```nginx
server {
    listen 443 ssl http2;
    server_name api.ebarmm.gov.ph;

    ssl_certificate /etc/letsencrypt/live/ebarmm.gov.ph/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ebarmm.gov.ph/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.ebarmm.gov.ph;
    return 301 https://$server_name$request_uri;
}
```

**PostgreSQL SSL:**
```postgresql
# postgresql.conf
ssl = on
ssl_cert_file = '/var/lib/postgresql/server.crt'
ssl_key_file = '/var/lib/postgresql/server.key'
ssl_ca_file = '/var/lib/postgresql/root.crt'

# pg_hba.conf
hostssl all all 0.0.0.0/0 md5
```

---

## 6. INPUT VALIDATION & SQL INJECTION PREVENTION

### 6.1 Pydantic Validation

```python
from pydantic import BaseModel, validator, constr, confloat
from datetime import date

class ProjectCreate(BaseModel):
    project_title: constr(min_length=1, max_length=500)
    location: constr(min_length=1, max_length=255)
    fund_source: constr(min_length=1, max_length=50)
    mode_of_implementation: constr(min_length=1, max_length=50)
    project_cost: confloat(ge=0.0)  # >= 0
    project_scale: constr(min_length=1, max_length=50)
    fund_year: int
    status: constr(regex=r'^(planning|ongoing|completed|suspended)$')

    @validator('fund_year')
    def validate_fund_year(cls, v):
        current_year = datetime.now().year
        if v < 2010 or v > current_year + 2:
            raise ValueError('fund_year must be between 2010 and current year + 2')
        return v

class ProgressLogCreate(BaseModel):
    reported_percent: confloat(ge=0.0, le=100.0)
    report_date: date
    remarks: constr(max_length=1000)

    @validator('report_date')
    def no_future_dates(cls, v):
        if v > date.today():
            raise ValueError('report_date cannot be in the future')
        return v
```

### 6.2 SQLAlchemy Parameterized Queries

**Safe (Parameterized):**
```python
# SQLAlchemy ORM (always safe)
projects = db.query(Project).filter(Project.deo_id == user_deo_id).all()

# Raw SQL with parameters
db.execute(
    text("SELECT * FROM projects WHERE deo_id = :deo_id"),
    {"deo_id": user_deo_id}
)
```

**Unsafe (Never Do This):**
```python
# NEVER concatenate user input into SQL
# This is vulnerable to SQL injection
db.execute(f"SELECT * FROM projects WHERE deo_id = {user_deo_id}")
```

---

## 7. RATE LIMITING

### 7.1 API Rate Limiting (FastAPI)

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply rate limits
@router.get("/public/projects")
@limiter.limit("100/minute")  # Public endpoints: 100 req/min
async def get_public_projects(request: Request):
    ...

@router.post("/auth/login")
@limiter.limit("5/minute")  # Login: 5 attempts/min
async def login(request: Request):
    ...

@router.post("/projects")
@limiter.limit("1000/hour")  # Authenticated: 1000 req/hour
async def create_project(request: Request, current_user: User = Depends(get_current_user)):
    ...
```

### 7.2 Nginx Rate Limiting

```nginx
# Limit requests per IP
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://localhost:8000;
    }
}
```

---

## 8. SECURITY CHECKLIST

### 8.1 Pre-Deployment Security Audit

- [ ] All passwords hashed with bcrypt (cost factor >= 12)
- [ ] JWT secret key is 256-bit, stored in environment variable
- [ ] Database has RLS policies enabled on all sensitive tables
- [ ] Progress logs and audit logs have mutation-prevention triggers
- [ ] All API endpoints have authentication (except public)
- [ ] RBAC enforced at both API and database layers
- [ ] HTTPS/TLS enabled with valid certificate
- [ ] PostgreSQL SSL enabled
- [ ] Input validation on all endpoints (Pydantic)
- [ ] SQL injection prevention (parameterized queries only)
- [ ] Rate limiting configured (public and authenticated)
- [ ] CORS configured to allow only trusted origins
- [ ] Sensitive data encrypted at rest
- [ ] Backup encryption enabled
- [ ] Audit logs capturing all mutations
- [ ] Hash chain verification scheduled daily
- [ ] File uploads scanned for malware
- [ ] Environment variables not committed to git
- [ ] Database credentials rotated
- [ ] No debug mode in production
- [ ] Security headers configured (HSTS, CSP, X-Frame-Options)

---

### 8.2 Ongoing Security Monitoring

**Automated Alerts:**
- Hash chain verification failures
- Multiple failed login attempts
- Unusual API activity (spike in requests)
- Unauthorized access attempts (403 errors)
- Database connection anomalies

**Quarterly Reviews:**
- User access audit (remove inactive users)
- Rotate JWT secret key
- Update SSL certificates
- Review audit logs for suspicious patterns
- Penetration testing

---

## 9. INCIDENT RESPONSE PLAN

### 9.1 Suspected Data Tampering

**Detection:**
- Daily hash chain verification alerts
- User reports of incorrect progress data

**Response:**
1. Lock affected project (prevent further updates)
2. Retrieve audit logs for project
3. Compare local hash chain with backup
4. Identify tampered entries
5. Restore from last known good backup
6. Investigate actor (from audit logs)
7. Revoke access if insider threat
8. Document incident
9. Notify stakeholders

### 9.2 Compromised User Account

**Detection:**
- Login from unusual IP/location
- Multiple failed login attempts followed by success
- Unusual API activity pattern

**Response:**
1. Immediately revoke user's JWT token (blacklist)
2. Force password reset
3. Review audit logs for unauthorized actions
4. Rollback unauthorized changes (if any)
5. Contact user to verify account security
6. Enable MFA for affected account
7. Document incident

### 9.3 Database Breach

**Detection:**
- Unauthorized database connection
- Bulk data export detected
- Alert from database monitoring tools

**Response:**
1. Immediately disconnect database from network
2. Rotate all database credentials
3. Review PostgreSQL logs for unauthorized queries
4. Identify compromised data (audit logs)
5. Restore from backup if data modified
6. Patch security vulnerability
7. Notify affected users (if PII exposed)
8. Engage security consultant
9. File incident report with authorities (if required)

---

This security framework ensures the E-BARMM system meets government transparency requirements while protecting against tampering, unauthorized access, and data breaches.
