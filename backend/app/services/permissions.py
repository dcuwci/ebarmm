"""
Permission Service
Group-based access control with dual role/permission checking
"""

from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status

from ..models import User, Group, UserGroup, AccessRight
from ..core.database import get_db


# Standard permission templates
STANDARD_PERMISSIONS = {
    "admin": {"create": True, "read": True, "update": True, "delete": True},
    "editor": {"create": True, "read": True, "update": True, "delete": False},
    "viewer": {"create": False, "read": True, "update": False, "delete": False},
    "none": {"create": False, "read": False, "update": False, "delete": False},
}

# Resources that can have permissions
RESOURCES = [
    "projects",
    "users",
    "groups",
    "access_rights",
    "audit_logs",
    "municipalities",
    "provinces",
    "deos",
    "categories",
    "contractors",
    "fund_sources",
    "implementation_modes",
    "gis_features",
    "media",
    "progress",
    "alerts",
    "settings",
]


class PermissionService:
    """Service for checking user permissions"""

    @staticmethod
    def has_permission(user: User, resource: str, action: str, db: Session) -> bool:
        """
        Check if user has permission for a specific resource and action.
        Uses dual checking: role-based OR group-based permissions.

        Args:
            user: The user to check
            resource: The resource name (e.g., 'projects', 'users')
            action: The action (e.g., 'read', 'create', 'update', 'delete')
            db: Database session

        Returns:
            True if user has permission, False otherwise
        """
        # Super admin role always has full access
        if user.role == "super_admin":
            return True

        # Check role-based permissions (legacy support)
        role_permission = PermissionService._check_role_permission(user, resource, action)
        if role_permission:
            return True

        # Check group-based permissions
        return PermissionService._check_group_permission(user, resource, action, db)

    @staticmethod
    def _check_role_permission(user: User, resource: str, action: str) -> bool:
        """Check permissions based on legacy role system"""
        role_permissions = {
            "super_admin": {"*": {"create": True, "read": True, "update": True, "delete": True}},
            "regional_admin": {
                "projects": {"create": True, "read": True, "update": True, "delete": True},
                "progress": {"create": True, "read": True, "update": True, "delete": False},
                "gis_features": {"create": True, "read": True, "update": True, "delete": True},
                "media": {"create": True, "read": True, "update": True, "delete": True},
                "users": {"create": False, "read": True, "update": False, "delete": False},
                "audit_logs": {"create": False, "read": True, "update": False, "delete": False},
            },
            "deo_user": {
                "projects": {"create": True, "read": True, "update": True, "delete": False},
                "progress": {"create": True, "read": True, "update": False, "delete": False},
                "gis_features": {"create": True, "read": True, "update": True, "delete": False},
                "media": {"create": True, "read": True, "update": False, "delete": False},
            },
            "public": {
                "projects": {"create": False, "read": True, "update": False, "delete": False},
            },
        }

        user_perms = role_permissions.get(user.role, {})

        # Check wildcard permissions first
        if "*" in user_perms:
            return user_perms["*"].get(action, False)

        # Check specific resource permissions
        resource_perms = user_perms.get(resource, {})
        return resource_perms.get(action, False)

    @staticmethod
    def _check_group_permission(user: User, resource: str, action: str, db: Session) -> bool:
        """Check permissions based on group membership"""
        # Get all active groups for the user
        user_groups = (
            db.query(UserGroup)
            .join(Group)
            .filter(
                UserGroup.user_id == user.user_id,
                Group.is_active == True
            )
            .all()
        )

        if not user_groups:
            return False

        group_ids = [ug.group_id for ug in user_groups]

        # Check if any group grants the permission
        access_rights = (
            db.query(AccessRight)
            .filter(
                AccessRight.group_id.in_(group_ids),
                AccessRight.resource == resource
            )
            .all()
        )

        # OR logic: if any group grants permission, allow
        for ar in access_rights:
            if ar.permissions.get(action, False):
                return True

        return False

    @staticmethod
    def get_user_permissions(user: User, db: Session) -> Dict[str, Dict[str, bool]]:
        """
        Get all permissions for a user (aggregated from role + groups).

        Returns:
            Dict mapping resource -> {action: bool}
        """
        permissions = {}

        # Start with role-based permissions
        if user.role == "super_admin":
            # Super admin has all permissions
            for resource in RESOURCES:
                permissions[resource] = {"create": True, "read": True, "update": True, "delete": True}
            return permissions

        # Initialize all resources with no permissions
        for resource in RESOURCES:
            permissions[resource] = {"create": False, "read": False, "update": False, "delete": False}

        # Apply role-based permissions
        for resource in RESOURCES:
            for action in ["create", "read", "update", "delete"]:
                if PermissionService._check_role_permission(user, resource, action):
                    permissions[resource][action] = True

        # Apply group-based permissions (OR with role permissions)
        user_groups = (
            db.query(UserGroup)
            .join(Group)
            .filter(
                UserGroup.user_id == user.user_id,
                Group.is_active == True
            )
            .all()
        )

        if user_groups:
            group_ids = [ug.group_id for ug in user_groups]
            access_rights = (
                db.query(AccessRight)
                .filter(AccessRight.group_id.in_(group_ids))
                .all()
            )

            for ar in access_rights:
                if ar.resource not in permissions:
                    permissions[ar.resource] = {"create": False, "read": False, "update": False, "delete": False}

                for action, allowed in ar.permissions.items():
                    if allowed:
                        permissions[ar.resource][action] = True

        return permissions

    @staticmethod
    def get_user_groups(user: User, db: Session) -> List[Dict]:
        """Get all groups a user belongs to"""
        user_groups = (
            db.query(UserGroup)
            .join(Group)
            .filter(
                UserGroup.user_id == user.user_id,
                Group.is_active == True
            )
            .all()
        )

        return [
            {
                "id": str(ug.group.id),
                "name": ug.group.name,
                "description": ug.group.description,
                "joined_at": ug.created_at.isoformat() if ug.created_at else None,
            }
            for ug in user_groups
        ]

    @staticmethod
    def is_admin_user(user: User, db: Session) -> bool:
        """Check if user has admin-level privileges"""
        if user.role == "super_admin":
            return True

        # Check for admin-level permissions in groups
        admin_actions = [
            ("users", "create"),
            ("users", "delete"),
            ("groups", "create"),
            ("groups", "delete"),
            ("access_rights", "create"),
        ]

        for resource, action in admin_actions:
            if PermissionService._check_group_permission(user, resource, action, db):
                return True

        return False

    @staticmethod
    def validate_permission_structure(permissions: Dict) -> tuple[bool, List[str]]:
        """Validate that a permissions dict has the correct structure"""
        errors = []
        valid_actions = {"create", "read", "update", "delete"}

        if not isinstance(permissions, dict):
            return False, ["Permissions must be a dictionary"]

        for action, value in permissions.items():
            if action not in valid_actions:
                errors.append(f"Invalid action: {action}. Valid actions: {valid_actions}")
            if not isinstance(value, bool):
                errors.append(f"Permission value for '{action}' must be boolean, got {type(value).__name__}")

        return len(errors) == 0, errors


def require_permission(resource: str, action: str):
    """
    FastAPI dependency factory for requiring specific permission.

    Usage:
        @router.get("/items")
        def list_items(user: User = Depends(require_permission("items", "read"))):
            ...
    """
    from ..api.auth import get_current_user

    def permission_dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        if not PermissionService.has_permission(current_user, resource, action, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {resource}:{action}"
            )
        return current_user

    return permission_dependency


def require_admin():
    """
    FastAPI dependency for requiring admin-level access.

    Usage:
        @router.post("/admin/settings")
        def update_settings(user: User = Depends(require_admin())):
            ...
    """
    from ..api.auth import get_current_user

    def admin_dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        if not PermissionService.is_admin_user(current_user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        return current_user

    return admin_dependency
