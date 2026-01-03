"""
Group Management API Endpoints
CRUD operations for groups and group membership
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from uuid import UUID

from ..core.database import get_db
from ..models import User, Group, UserGroup
from ..schemas import (
    GroupResponse, GroupCreate, GroupUpdate, GroupListResponse,
    GroupMemberResponse, GroupMemberAdd
)
from ..services.permissions import require_permission
from .auth import get_current_user

router = APIRouter()


@router.get("", response_model=GroupListResponse)
async def list_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_permission("groups", "read")),
    db: Session = Depends(get_db)
):
    """List groups with filtering and pagination."""
    query = db.query(Group)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(Group.name.ilike(search_filter))

    if is_active is not None:
        query = query.filter(Group.is_active == is_active)

    total = query.count()
    groups = query.order_by(Group.name).offset(skip).limit(limit).all()

    # Add member counts
    items = []
    for group in groups:
        items.append(GroupResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            is_active=group.is_active,
            created_at=group.created_at,
            updated_at=group.updated_at,
            member_count=len(group.members)
        ))

    return GroupListResponse(total=total, items=items)


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupCreate,
    current_user: User = Depends(require_permission("groups", "create")),
    db: Session = Depends(get_db)
):
    """Create a new group."""
    # Check for existing name
    existing = db.query(Group).filter(Group.name == group_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group name already exists"
        )

    new_group = Group(
        name=group_data.name,
        description=group_data.description,
        is_active=group_data.is_active
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    return GroupResponse(
        id=new_group.id,
        name=new_group.name,
        description=new_group.description,
        is_active=new_group.is_active,
        created_at=new_group.created_at,
        updated_at=new_group.updated_at,
        member_count=0
    )


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: UUID,
    current_user: User = Depends(require_permission("groups", "read")),
    db: Session = Depends(get_db)
):
    """Get a specific group by ID."""
    group = db.query(Group).filter(Group.id == group_id).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
        member_count=len(group.members)
    )


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: UUID,
    group_data: GroupUpdate,
    current_user: User = Depends(require_permission("groups", "update")),
    db: Session = Depends(get_db)
):
    """Update a group."""
    group = db.query(Group).filter(Group.id == group_id).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Check name uniqueness if changing
    if group_data.name and group_data.name != group.name:
        existing = db.query(Group).filter(
            Group.name == group_data.name,
            Group.id != group_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group name already exists"
            )

    # Update fields
    update_data = group_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    db.commit()
    db.refresh(group)

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
        member_count=len(group.members)
    )


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: UUID,
    current_user: User = Depends(require_permission("groups", "delete")),
    db: Session = Depends(get_db)
):
    """Delete a group."""
    group = db.query(Group).filter(Group.id == group_id).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Check if group has members
    if len(group.members) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete group with members. Remove all members first."
        )

    db.delete(group)
    db.commit()

    return None


# =============================================================================
# GROUP MEMBERS
# =============================================================================

@router.get("/{group_id}/members", response_model=List[GroupMemberResponse])
async def list_group_members(
    group_id: UUID,
    current_user: User = Depends(require_permission("groups", "read")),
    db: Session = Depends(get_db)
):
    """List all members of a group."""
    group = db.query(Group).filter(Group.id == group_id).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    members = []
    for ug in group.members:
        user = ug.user
        if not user.is_deleted:
            members.append(GroupMemberResponse(
                user_id=user.user_id,
                username=user.username,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                role=user.role,
                joined_at=ug.created_at
            ))

    return members


@router.post("/{group_id}/members", response_model=GroupMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_group_member(
    group_id: UUID,
    member_data: GroupMemberAdd,
    current_user: User = Depends(require_permission("groups", "update")),
    db: Session = Depends(get_db)
):
    """Add a user to a group."""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    user = db.query(User).filter(
        User.user_id == member_data.user_id,
        User.is_deleted == False
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if already a member
    existing = db.query(UserGroup).filter(
        UserGroup.user_id == member_data.user_id,
        UserGroup.group_id == group_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this group"
        )

    user_group = UserGroup(user_id=user.user_id, group_id=group_id)
    db.add(user_group)
    db.commit()
    db.refresh(user_group)

    return GroupMemberResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        joined_at=user_group.created_at
    )


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_group_member(
    group_id: UUID,
    user_id: UUID,
    current_user: User = Depends(require_permission("groups", "update")),
    db: Session = Depends(get_db)
):
    """Remove a user from a group."""
    user_group = db.query(UserGroup).filter(
        UserGroup.user_id == user_id,
        UserGroup.group_id == group_id
    ).first()

    if not user_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this group"
        )

    db.delete(user_group)
    db.commit()

    return None
