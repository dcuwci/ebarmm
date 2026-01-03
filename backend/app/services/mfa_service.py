"""
MFA Service
TOTP-based Multi-Factor Authentication
"""

import pyotp
import qrcode
import qrcode.image.svg
import secrets
import json
import io
import base64
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from ..models import User, MFASession
from ..core.config import settings


class MFAService:
    """Service for Multi-Factor Authentication operations"""

    @staticmethod
    def is_mfa_enabled() -> bool:
        """Check if MFA feature is enabled globally"""
        return settings.MFA_ENABLED

    @staticmethod
    def is_mfa_required() -> bool:
        """Check if MFA is required for all users"""
        return settings.MFA_ENABLED and settings.MFA_REQUIRED

    @staticmethod
    def generate_secret() -> str:
        """Generate a new TOTP secret"""
        return pyotp.random_base32()

    @staticmethod
    def generate_qr_code(email: str, secret: str) -> str:
        """
        Generate a QR code for authenticator app setup.

        Args:
            email: User's email or username for the TOTP URI
            secret: The TOTP secret

        Returns:
            Base64-encoded PNG image of the QR code
        """
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=email,
            issuer_name=settings.MFA_ISSUER
        )

        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(provisioning_uri)
        qr.make(fit=True)

        # Create image
        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return f"data:image/png;base64,{img_base64}"

    @staticmethod
    def verify_code(secret: str, code: str) -> bool:
        """
        Verify a TOTP code.

        Args:
            secret: The user's TOTP secret
            code: The 6-digit code from the authenticator app

        Returns:
            True if the code is valid
        """
        if not secret or not code:
            return False

        totp = pyotp.TOTP(secret)
        # valid_window=1 allows 30 seconds before/after for clock drift
        return totp.verify(code, valid_window=1)

    @staticmethod
    def generate_backup_codes(count: int = 10) -> List[str]:
        """
        Generate one-time backup codes.

        Args:
            count: Number of backup codes to generate

        Returns:
            List of backup codes (8-character hex strings)
        """
        return [secrets.token_hex(4).upper() for _ in range(count)]

    @staticmethod
    def verify_backup_code(user: User, code: str, db: Session) -> bool:
        """
        Verify and consume a backup code.

        Args:
            user: The user
            code: The backup code to verify
            db: Database session

        Returns:
            True if the code is valid and was consumed
        """
        if not user.backup_codes:
            return False

        try:
            backup_codes = json.loads(user.backup_codes)
        except json.JSONDecodeError:
            return False

        code_upper = code.upper().replace("-", "").replace(" ", "")

        if code_upper in backup_codes:
            # Remove the used code (one-time use)
            backup_codes.remove(code_upper)
            user.backup_codes = json.dumps(backup_codes)
            db.commit()
            return True

        return False

    @staticmethod
    def setup_mfa(user: User, db: Session) -> Tuple[str, str, List[str]]:
        """
        Initialize MFA setup for a user.

        Args:
            user: The user to setup MFA for
            db: Database session

        Returns:
            Tuple of (secret, qr_code_data_uri, backup_codes)
        """
        secret = MFAService.generate_secret()
        email_or_username = user.email or user.username
        qr_code = MFAService.generate_qr_code(email_or_username, secret)
        backup_codes = MFAService.generate_backup_codes()

        # Store the secret temporarily (not enabled yet)
        user.mfa_secret = secret
        user.backup_codes = json.dumps(backup_codes)
        db.commit()

        return secret, qr_code, backup_codes

    @staticmethod
    def complete_mfa_setup(user: User, code: str, db: Session) -> bool:
        """
        Complete MFA setup by verifying the first code.

        Args:
            user: The user
            code: The TOTP code to verify
            db: Database session

        Returns:
            True if MFA was successfully enabled
        """
        if not user.mfa_secret:
            return False

        if MFAService.verify_code(user.mfa_secret, code):
            user.mfa_enabled = True
            db.commit()
            return True

        return False

    @staticmethod
    def disable_mfa(user: User, db: Session) -> None:
        """
        Disable MFA for a user.

        Args:
            user: The user
            db: Database session
        """
        user.mfa_enabled = False
        user.mfa_secret = None
        user.backup_codes = None
        db.commit()

    @staticmethod
    def regenerate_backup_codes(user: User, db: Session) -> List[str]:
        """
        Generate new backup codes for a user.

        Args:
            user: The user
            db: Database session

        Returns:
            New list of backup codes
        """
        backup_codes = MFAService.generate_backup_codes()
        user.backup_codes = json.dumps(backup_codes)
        db.commit()
        return backup_codes

    @staticmethod
    def create_mfa_session(user: User, db: Session) -> str:
        """
        Create a temporary MFA session token for the login flow.

        Args:
            user: The user attempting to login
            db: Database session

        Returns:
            The MFA session token
        """
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=5)

        mfa_session = MFASession(
            session_token=session_token,
            user_id=user.user_id,
            expires_at=expires_at
        )
        db.add(mfa_session)
        db.commit()

        return session_token

    @staticmethod
    def verify_mfa_session(session_token: str, db: Session) -> Optional[User]:
        """
        Verify an MFA session token and return the associated user.

        Args:
            session_token: The MFA session token
            db: Database session

        Returns:
            The user if session is valid, None otherwise
        """
        mfa_session = (
            db.query(MFASession)
            .filter(
                MFASession.session_token == session_token,
                MFASession.is_used == False,
                MFASession.expires_at > datetime.utcnow()
            )
            .first()
        )

        if not mfa_session:
            return None

        # Mark session as used
        mfa_session.is_used = True
        db.commit()

        # Get the user
        user = db.query(User).filter(User.user_id == mfa_session.user_id).first()
        return user

    @staticmethod
    def cleanup_expired_sessions(db: Session) -> int:
        """
        Clean up expired MFA sessions.

        Args:
            db: Database session

        Returns:
            Number of sessions deleted
        """
        result = (
            db.query(MFASession)
            .filter(MFASession.expires_at < datetime.utcnow())
            .delete()
        )
        db.commit()
        return result

    @staticmethod
    def get_remaining_backup_codes(user: User) -> int:
        """
        Get the count of remaining backup codes.

        Args:
            user: The user

        Returns:
            Number of remaining backup codes
        """
        if not user.backup_codes:
            return 0

        try:
            backup_codes = json.loads(user.backup_codes)
            return len(backup_codes)
        except json.JSONDecodeError:
            return 0
