"""
Authentication API Endpoints
Login, logout, token management, MFA
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
import hashlib
import secrets

from ..core.database import get_db, set_rls_context
from ..core.security import verify_password, create_access_token, decode_access_token
from ..core.config import settings
from ..models import User, TokenBlacklist, RefreshToken
from ..schemas import (
    Token, LoginRequest, UserResponse, LoginResponse,
    MFASetupResponse, MFAVerifyRequest, MFAVerifySetupRequest,
    MFADisableRequest, MFAStatusResponse, TokenRefreshRequest
)
from ..services.mfa_service import MFAService

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")


def authenticate_user(db: Session, username: str, password: str) -> User:
    """
    Authenticate user by username and password.

    Args:
        db: Database session
        username: Username (can also be email)
        password: Plain text password

    Returns:
        User object if authenticated, None otherwise
    """
    # Try username first, then email
    user = db.query(User).filter(
        User.username == username,
        User.is_deleted == False
    ).first()

    if not user:
        # Try email
        user = db.query(User).filter(
            User.email == username,
            User.is_deleted == False
        ).first()

    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


def create_refresh_token(user: User, db: Session) -> str:
    """Create a new refresh token for the user"""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    refresh_token = RefreshToken(
        token=token,
        user_id=user.user_id,
        expires_at=expires_at
    )
    db.add(refresh_token)
    db.commit()

    return token


def verify_refresh_token(token: str, db: Session) -> User:
    """Verify a refresh token and return the associated user"""
    refresh_token = db.query(RefreshToken).filter(
        RefreshToken.token == token,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()

    if not refresh_token:
        return None

    user = db.query(User).filter(
        User.user_id == refresh_token.user_id,
        User.is_active == True,
        User.is_deleted == False
    ).first()

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

    # Get user (excluding soft-deleted)
    user = db.query(User).filter(
        User.user_id == user_id,
        User.is_deleted == False
    ).first()
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


def _generate_tokens(user: User, db: Session) -> dict:
    """Generate access token and optionally refresh token"""
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

    result = {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user
    }

    # Add refresh token if enabled
    if settings.REFRESH_TOKEN_ENABLED:
        result["refresh_token"] = create_refresh_token(user, db)

    return result


@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return JWT token.

    OAuth2 compatible endpoint (username/password form).
    If MFA is enabled for the user, returns mfa_required=true with a session token.
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

    # Check if MFA is required
    if MFAService.is_mfa_enabled() and user.mfa_enabled:
        # User has MFA enabled - create MFA session and require verification
        mfa_session_token = MFAService.create_mfa_session(user, db)
        return LoginResponse(
            mfa_required=True,
            mfa_session_token=mfa_session_token
        )

    # No MFA required - generate tokens directly
    tokens = _generate_tokens(user, db)

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    return LoginResponse(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        refresh_token=tokens.get("refresh_token"),
        user=user,
        mfa_required=False
    )


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
async def refresh_token_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Refresh access token using current valid token.

    Returns new token with extended expiration.
    """
    tokens = _generate_tokens(current_user, db)
    return Token(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        refresh_token=tokens.get("refresh_token"),
        user=current_user
    )


@router.post("/token/refresh", response_model=Token)
async def refresh_with_token(
    request: TokenRefreshRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token.

    Use this when the access token has expired but you have a valid refresh token.
    """
    if not settings.REFRESH_TOKEN_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refresh tokens are not enabled"
        )

    user = verify_refresh_token(request.refresh_token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    # Revoke the old refresh token
    old_token = db.query(RefreshToken).filter(
        RefreshToken.token == request.refresh_token
    ).first()
    if old_token:
        old_token.is_revoked = True
        db.commit()

    tokens = _generate_tokens(user, db)
    return Token(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        refresh_token=tokens.get("refresh_token"),
        user=user
    )


# =============================================================================
# MFA ENDPOINTS
# =============================================================================

@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initialize MFA setup for the current user.

    Returns QR code and backup codes. User must verify with /mfa/verify-setup.
    """
    if not MFAService.is_mfa_enabled():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled on this server"
        )

    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled. Disable it first to reconfigure."
        )

    secret, qr_code, backup_codes = MFAService.setup_mfa(current_user, db)

    return MFASetupResponse(
        secret=secret,
        qr_code=qr_code,
        backup_codes=backup_codes,
        issuer=settings.MFA_ISSUER
    )


@router.post("/mfa/verify-setup", response_model=MFAStatusResponse)
async def verify_mfa_setup(
    request: MFAVerifySetupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Complete MFA setup by verifying the first TOTP code.
    """
    if not MFAService.is_mfa_enabled():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled on this server"
        )

    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled"
        )

    if not current_user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA setup not initiated. Call /mfa/setup first."
        )

    if not MFAService.complete_mfa_setup(current_user, request.code, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA code"
        )

    return MFAStatusResponse(
        mfa_enabled=True,
        backup_codes_remaining=MFAService.get_remaining_backup_codes(current_user)
    )


@router.post("/mfa/verify", response_model=LoginResponse)
async def verify_mfa(
    request: MFAVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Verify MFA code during login flow.

    Requires the mfa_session_token from the login response.
    """
    if not request.mfa_session_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA session token is required"
        )

    # Verify MFA session and get user
    user = MFAService.verify_mfa_session(request.mfa_session_token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired MFA session"
        )

    # Verify the TOTP code or backup code
    code = request.code.replace(" ", "").replace("-", "")

    if len(code) == 6:
        # TOTP code
        if not MFAService.verify_code(user.mfa_secret, code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid MFA code"
            )
    else:
        # Backup code
        if not MFAService.verify_backup_code(user, code, db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid backup code"
            )

    # Generate tokens
    tokens = _generate_tokens(user, db)

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    return LoginResponse(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        refresh_token=tokens.get("refresh_token"),
        user=user,
        mfa_required=False
    )


@router.post("/mfa/disable", response_model=MFAStatusResponse)
async def disable_mfa(
    request: MFADisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disable MFA for the current user.

    Requires a valid MFA code to confirm.
    """
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled"
        )

    code = request.code.replace(" ", "").replace("-", "")

    # Verify with TOTP or backup code
    if len(code) == 6:
        if not MFAService.verify_code(current_user.mfa_secret, code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid MFA code"
            )
    else:
        if not MFAService.verify_backup_code(current_user, code, db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid backup code"
            )

    MFAService.disable_mfa(current_user, db)

    return MFAStatusResponse(
        mfa_enabled=False,
        backup_codes_remaining=0
    )


@router.get("/mfa/status", response_model=MFAStatusResponse)
async def get_mfa_status(
    current_user: User = Depends(get_current_user)
):
    """Get MFA status for the current user."""
    return MFAStatusResponse(
        mfa_enabled=current_user.mfa_enabled,
        backup_codes_remaining=MFAService.get_remaining_backup_codes(current_user)
    )


@router.post("/mfa/backup-codes/regenerate", response_model=MFASetupResponse)
async def regenerate_backup_codes(
    request: MFAVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regenerate backup codes.

    Requires a valid MFA code to confirm.
    """
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled"
        )

    code = request.code.replace(" ", "").replace("-", "")

    # Verify with TOTP code only (not backup code for this operation)
    if not MFAService.verify_code(current_user.mfa_secret, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA code"
        )

    backup_codes = MFAService.regenerate_backup_codes(current_user, db)

    return MFASetupResponse(
        secret="",  # Don't expose secret again
        qr_code="",  # No QR code needed
        backup_codes=backup_codes,
        issuer=settings.MFA_ISSUER
    )
