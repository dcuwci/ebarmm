"""
Authentication API Endpoints
Login, logout, token management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
import hashlib

from ..core.database import get_db, set_rls_context
from ..core.security import verify_password, create_access_token, decode_access_token
from ..core.config import settings
from ..models import User, TokenBlacklist
from ..schemas import Token, LoginRequest, UserResponse

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")


def authenticate_user(db: Session, username: str, password: str) -> User:
    """
    Authenticate user by username and password.

    Args:
        db: Database session
        username: Username
        password: Plain text password

    Returns:
        User object if authenticated, None otherwise
    """
    user = db.query(User).filter(User.username == username).first()

    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current user from JWT token.

    Dependency for protected endpoints.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Decode token
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    # Check if token is blacklisted
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    blacklisted = db.query(TokenBlacklist).filter(
        TokenBlacklist.token_hash == token_hash
    ).first()

    if blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked"
        )

    # Get user
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    # Set RLS context for this request
    set_rls_context(
        db=db,
        user_id=str(user.user_id),
        user_role=user.role,
        deo_id=user.deo_id,
        region=user.region
    )

    return user


def require_role(allowed_roles: list[str]):
    """
    Dependency factory for role-based access control.

    Usage:
        @router.get("/endpoint")
        def endpoint(current_user = Depends(require_role(['super_admin']))):
            ...
    """
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {allowed_roles}"
            )
        return current_user

    return role_checker


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return JWT token.

    OAuth2 compatible endpoint (username/password form).
    """
    user = authenticate_user(db, form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": str(user.user_id),
            "role": user.role,
            "deo_id": user.deo_id,
            "region": user.region
        },
        expires_delta=access_token_expires
    )

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout user by blacklisting their token.
    """
    # Hash token for storage
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Decode to get expiration
    payload = decode_access_token(token)
    if payload and "exp" in payload:
        expires_at = datetime.fromtimestamp(payload["exp"])
    else:
        # Default to 1 hour from now
        expires_at = datetime.utcnow() + timedelta(hours=1)

    # Add to blacklist
    blacklist_entry = TokenBlacklist(
        token_hash=token_hash,
        user_id=current_user.user_id,
        expires_at=expires_at
    )
    db.add(blacklist_entry)
    db.commit()

    return None


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    return current_user


@router.post("/refresh", response_model=Token)
async def refresh_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Refresh access token.

    Returns new token with extended expiration.
    """
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": str(current_user.user_id),
            "role": current_user.role,
            "deo_id": current_user.deo_id,
            "region": current_user.region
        },
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": current_user
    }
