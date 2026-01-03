"""
Access Rights Management API Endpoints
CRUD operations for group-based permissions
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID

from ..core.database import get_db
from ..models import User, Group, AccessRight
from ..schemas import (
    AccessRightResponse, AccessRightCreate, AccessRightUpdate,
    AccessRightListResponse
)
from ..services.permissions import PermissionService, require_permission, RESOURCES
from .auth import get_current_user

router = APIRouter()


@router.get("", response_model=AccessRightListResponse)
async def list_access_rights(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    resource: Optional[str] = None,
    group_id: Optional[UUID] = None,
    current_user: User = Depends(require_permission("access_rights", "read")),
    db: Session = Depends(get_db)
):
    """List access rights with filtering and pagination."""
    query = db.query(AccessRight)

    if resource:
        query = query.filter(AccessRight.resource == resource)

    if group_id:
        query = query.filter(AccessRight.group_id == group_id)

    total = query.count()
    access_rights = query.order_by(AccessRight.resource).offset(skip).limit(limit).all()

    # Add group names
    items = []
    for ar in access_rights:
        group = db.query(Group).filter(Group.id == ar.group_id).first()
        items.append(AccessRightResponse(
            id=ar.id,
            resource=ar.resource,
            permissions=ar.permissions,
            group_id=ar.group_id,
            group_name=group.name if group else None,
            created_at=ar.created_at,
            updated_at=ar.updated_at
        ))

    return AccessRightListResponse(total=total, items=items)


@router.get("/resources", response_model=List[str])
async def list_resources(
    current_user: User = Depends(require_permission("access_rights", "read"))
):
    """List all available resources that can have permissions."""
    return RESOURCES


@router.post("", response_model=AccessRightResponse, status_code=status.HTTP_201_CREATED)
async def create_access_right(
    ar_data: AccessRightCreate,
    current_user: User = Depends(require_permission("access_rights", "create")),
    db: Session = Depends(get_db)
):
    """Create a new access right."""
    # Validate resource
    if ar_data.resource not in RESOURCES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid resource. Valid resources: {RESOURCES}"
        )

    # Validate permissions structure
    is_valid, errors = PermissionService.validate_permission_structure(ar_data.permissions)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permissions: {errors}"
        )

    # Check group exists
    group = db.query(Group).filter(Group.id == ar_data.group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Check for existing access right for this group/resource
    existing = db.query(AccessRight).filter(
        AccessRight.group_id == ar_data.group_id,
        AccessRight.resource == ar_data.resource
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access right already exists for this group and resource. Update it instead."
        )

    new_ar = AccessRight(
        resource=ar_data.resource,
        permissions=ar_data.permissions,
        group_id=ar_data.group_id
    )
    db.add(new_ar)
    db.commit()
    db.refresh(new_ar)

    return AccessRightResponse(
        id=new_ar.id,
        resource=new_ar.resource,
        permissions=new_ar.permissions,
        group_id=new_ar.group_id,
        group_name=group.name,
        created_at=new_ar.created_at,
        updated_at=new_ar.updated_at
    )


@router.get("/{access_right_id}", response_model=AccessRightResponse)
async def get_access_right(
    access_right_id: UUID,
    current_user: User = Depends(require_permission("access_rights", "read")),
    db: Session = Depends(get_db)
):
    """Get a specific access right by ID."""
    ar = db.query(AccessRight).filter(AccessRight.id == access_right_id).first()

    if not ar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access right not found"
        )

    group = db.query(Group).filter(Group.id == ar.group_id).first()

    return AccessRightResponse(
        id=ar.id,
        resource=ar.resource,
        permissions=ar.permissions,
        group_id=ar.group_id,
        group_name=group.name if group else None,
        created_at=ar.created_at,
        updated_at=ar.updated_at
    )


@router.put("/{access_right_id}", response_model=AccessRightResponse)
async def update_access_right(
    access_right_id: UUID,
    ar_data: AccessRightUpdate,
    current_user: User = Depends(require_permission("access_rights", "update")),
    db: Session = Depends(get_db)
):
    """Update an access right's permissions."""
    ar = db.query(AccessRight).filter(AccessRight.id == access_right_id).first()

    if not ar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access right not found"
        )

    # Validate permissions structure
    is_valid, errors = PermissionService.validate_permission_structure(ar_data.permissions)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permissions: {errors}"
        )

    ar.permissions = ar_data.permissions
    db.commit()
    db.refresh(ar)

    group = db.query(Group).filter(Group.id == ar.group_id).first()

    return AccessRightResponse(
        id=ar.id,
        resource=ar.resource,
        permissions=ar.permissions,
        group_id=ar.group_id,
        group_name=group.name if group else None,
        created_at=ar.created_at,
        updated_at=ar.updated_at
    )


@router.delete("/{access_right_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_access_right(
    access_right_id: UUID,
    current_user: User = Depends(require_permission("access_rights", "delete")),
    db: Session = Depends(get_db)
):
    """Delete an access right."""
    ar = db.query(AccessRight).filter(AccessRight.id == access_right_id).first()

    if not ar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access right not found"
        )

    db.delete(ar)
    db.commit()

    return None


@router.get("/check/{resource}/{action}")
async def check_permission(
    resource: str,
    action: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if the current user has a specific permission."""
    has_permission = PermissionService.has_permission(current_user, resource, action, db)

    return {
        "resource": resource,
        "action": action,
        "allowed": has_permission
    }
