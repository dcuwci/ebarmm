"""
Security and Authentication Utilities
JWT token generation, password hashing, hash chaining
"""

from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from passlib.context import CryptContext
from .config import settings
import hashlib
import json

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> bool:
    """Generate bcrypt hash of password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token.

    Args:
        data: Payload data (should include 'sub' for user_id)
        expires_delta: Token expiration time

    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )

    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict]:
    """
    Decode and verify JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded payload or None if invalid
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def calculate_progress_hash(
    project_id: str,
    reported_percent: float,
    report_date: str,
    reported_by: str,
    prev_hash: Optional[str]
) -> str:
    """
    Calculate SHA-256 hash for progress log entry (hash chaining).

    This must match the algorithm in:
    - Mobile app (Kotlin)
    - Frontend verification (TypeScript)

    Args:
        project_id: UUID of project
        reported_percent: Progress percentage (0-100)
        report_date: Date in ISO format (YYYY-MM-DD)
        reported_by: UUID of user
        prev_hash: Hash of previous entry (None for first entry)

    Returns:
        Hex-encoded SHA-256 hash
    """
    payload = {
        "project_id": str(project_id),
        "reported_percent": float(reported_percent),
        "report_date": str(report_date),
        "reported_by": str(reported_by),
        "prev_hash": prev_hash or ""
    }

    # Canonical JSON (sorted keys, no whitespace)
    canonical_json = json.dumps(payload, sort_keys=True, separators=(',', ':'))

    # SHA-256 hash
    hash_bytes = hashlib.sha256(canonical_json.encode('utf-8')).digest()

    # Return hex representation
    return hash_bytes.hex()


def calculate_audit_hash(
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    payload: dict,
    created_at: str,
    prev_hash: Optional[str]
) -> str:
    """
    Calculate SHA-256 hash for audit log entry.

    Args:
        actor_id: UUID of user performing action
        action: Action name (e.g., 'CREATE_PROJECT')
        entity_type: Type of entity (e.g., 'project')
        entity_id: UUID of entity
        payload: Full payload data
        created_at: ISO timestamp
        prev_hash: Hash of previous audit entry

    Returns:
        Hex-encoded SHA-256 hash
    """
    hash_payload = {
        "actor_id": str(actor_id),
        "action": action,
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "payload": payload,
        "created_at": str(created_at),
        "prev_hash": prev_hash or ""
    }

    canonical_json = json.dumps(hash_payload, sort_keys=True, separators=(',', ':'))
    hash_bytes = hashlib.sha256(canonical_json.encode('utf-8')).digest()

    return hash_bytes.hex()


def verify_progress_chain(logs: list) -> tuple[bool, list]:
    """
    Verify integrity of progress log hash chain.

    Args:
        logs: List of progress log entries (ordered chronologically)

    Returns:
        Tuple of (is_valid, broken_links)
        broken_links contains entries where hash doesn't match
    """
    broken_links = []
    prev_hash = None

    for log in logs:
        # Recalculate expected hash
        expected_hash = calculate_progress_hash(
            project_id=log.project_id,
            reported_percent=float(log.reported_percent),
            report_date=str(log.report_date),
            reported_by=str(log.reported_by),
            prev_hash=prev_hash
        )

        # Check if stored hash matches
        if expected_hash != log.record_hash:
            broken_links.append({
                "progress_id": str(log.progress_id),
                "expected_hash": expected_hash,
                "actual_hash": log.record_hash,
                "report_date": str(log.report_date)
            })

        # Check if prev_hash matches
        if prev_hash is not None and log.prev_hash != prev_hash:
            broken_links.append({
                "progress_id": str(log.progress_id),
                "error": "prev_hash mismatch",
                "expected_prev_hash": prev_hash,
                "actual_prev_hash": log.prev_hash
            })

        prev_hash = log.record_hash

    return (len(broken_links) == 0, broken_links)
