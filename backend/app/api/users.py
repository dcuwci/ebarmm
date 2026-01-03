"""
User Management API Endpoints
CRUD operations for users with permission checking
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_password_hash, verify_password
from ..models import User, Group, UserGroup
from ..schemas import (
    UserResponse, UserAdminCreate, UserAdminUpdate, UserListResponse,
    PasswordChangeRequest, UserPermissionsResponse, GroupResponse
)
from ..services.permissions import PermissionService, require_permission
from ..services.mfa_service import MFAService
from .auth import get_current_user

router = APIRouter()


@router.get("", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    include_deleted: bool = False,
    current_user: User = Depends(require_permission("users", "read")),
    db: Session = Depends(get_db)
):
    """List users with filtering and pagination."""
    query = db.query(User)

    # Exclude soft-deleted unless explicitly requested
    if not include_deleted:
        query = query.filter(User.is_deleted == False)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                User.username.ilike(search_filter),
                User.email.ilike(search_filter),
                User.first_name.ilike(search_filter),
                User.last_name.ilike(search_filter)
            )
        )

    if role:
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    return UserListResponse(total=total, items=users)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserAdminCreate,
    current_user: User = Depends(require_permission("users", "create")),
    db: Session = Depends(get_db)
):
    """Create a new user."""
    # Check for existing username
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    # Check for existing email
    if user_data.email:
        existing = db.query(User).filter(User.email == user_data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )

    # Create user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        deo_id=user_data.deo_id,
        region=user_data.region,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone_number=user_data.phone_number,
        is_active=True,
        is_verified=True  # Skip email verification
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Add to groups if specified
    if user_data.group_ids:
        for group_id in user_data.group_ids:
            group = db.query(Group).filter(Group.id == group_id).first()
            if group:
                user_group = UserGroup(user_id=new_user.user_id, group_id=group_id)
                db.add(user_group)
        db.commit()

    return new_user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(require_permission("users", "read")),
    db: Session = Depends(get_db)
):
    """Get a specific user by ID."""
    user = db.query(User).filter(
        User.user_id == user_id,
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserAdminUpdate,
    current_user: User = Depends(require_permission("users", "update")),
    db: Session = Depends(get_db)
):
    """Update a user."""
    user = db.query(User).filter(
        User.user_id == user_id,
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check email uniqueness if changing
    if user_data.email and user_data.email != user.email:
        existing = db.query(User).filter(
            User.email == user_data.email,
            User.user_id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )

    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_permission("users", "delete")),
    db: Session = Depends(get_db)
):
    """Soft delete a user."""
    user = db.query(User).filter(
        User.user_id == user_id,
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent self-deletion
    if user.user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    # Soft delete
    user.is_deleted = True
    user.deleted_at = datetime.utcnow()
    user.deleted_by = current_user.user_id
    user.is_active = False
    db.commit()

    return None


@router.post("/{user_id}/restore", response_model=UserResponse)
async def restore_user(
    user_id: UUID,
    current_user: User = Depends(require_permission("users", "delete")),
    db: Session = Depends(get_db)
):
    """Restore a soft-deleted user."""
    user = db.query(User).filter(
        User.user_id == user_id,
        User.is_deleted == True
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted user not found"
        )

    user.is_deleted = False
    user.deleted_at = None
    user.deleted_by = None
    user.is_active = True
    db.commit()
    db.refresh(user)

    return user


@router.get("/{user_id}/permissions", response_model=UserPermissionsResponse)
async def get_user_permissions(
    user_id: UUID,
    current_user: User = Depends(require_permission("users", "read")),
    db: Session = Depends(get_db)
):
    """Get all permissions for a user."""
    user = db.query(User).filter(
        User.user_id == user_id,
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    permissions = PermissionService.get_user_permissions(user, db)
    groups_data = PermissionService.get_user_groups(user, db)

    # Convert group dicts to GroupResponse
    groups = []
    for g in groups_data:
        group = db.query(Group).filter(Group.id == g["id"]).first()
        if group:
            groups.append(GroupResponse(
                id=group.id,
                name=group.name,
                description=group.description,
                is_active=group.is_active,
                created_at=group.created_at,
                updated_at=group.updated_at,
                member_count=len(group.members)
            ))

    return UserPermissionsResponse(
        user_id=user.user_id,
        permissions=permissions,
        groups=groups
    )


@router.post("/{user_id}/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    user_id: UUID,
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password."""
    # Users can change their own password, admins can change any password
    is_self = user_id == current_user.user_id
    is_admin = PermissionService.has_permission(current_user, "users", "update", db)

    if not is_self and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )

    user = db.query(User).filter(
        User.user_id == user_id,
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Self-change requires current password
    if is_self and not is_admin:
        if not request.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required"
            )
        if not verify_password(request.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )

    user.password_hash = get_password_hash(request.new_password)
    user.last_password_reset = datetime.utcnow()
    user.password_reset_count = (user.password_reset_count or 0) + 1
    db.commit()

    return None


@router.post("/{user_id}/reset-mfa", status_code=status.HTTP_204_NO_CONTENT)
async def reset_user_mfa(
    user_id: UUID,
    current_user: User = Depends(require_permission("users", "update")),
    db: Session = Depends(get_db)
):
    """Reset MFA for a user (admin only)."""
    user = db.query(User).filter(
        User.user_id == user_id,
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    MFAService.disable_mfa(user, db)

    return None


@router.get("/{user_id}/groups", response_model=List[GroupResponse])
async def get_user_groups(
    user_id: UUID,
    current_user: User = Depends(require_permission("users", "read")),
    db: Session = Depends(get_db)
):
    """Get all groups a user belongs to."""
    user = db.query(User).filter(
        User.user_id == user_id,
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    groups = []
    for ug in user.groups:
        group = ug.group
        groups.append(GroupResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            is_active=group.is_active,
            created_at=group.created_at,
            updated_at=group.updated_at,
            member_count=len(group.members)
        ))

    return groups
