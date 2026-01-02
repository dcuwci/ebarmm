"""
Projects API Endpoints
CRUD operations for infrastructure projects
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional
from uuid import UUID
from datetime import datetime

from ..core.database import get_db
from ..models import Project, DEO, ProjectProgressLog, User, AuditLog
from ..schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse
from ..api.auth import get_current_user, require_role
import uuid

router = APIRouter()


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    deo_id: Optional[int] = None,
    fund_year: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all projects (with RBAC filtering).

    Query parameters:
    - deo_id: Filter by DEO
    - fund_year: Filter by year
    - status: Filter by status
    - search: Search in title and location
    - limit: Max results (default 50, max 500)
    - offset: Pagination offset
    """
    query = db.query(Project).join(DEO)

    # RBAC filtering is handled by Row Level Security (RLS)
    # But we add additional filters here for convenience

    if current_user.role == "deo_user":
        query = query.filter(Project.deo_id == current_user.deo_id)
    elif current_user.role == "regional_admin":
        query = query.filter(DEO.region == current_user.region)
    elif current_user.role == "public":
        query = query.filter(Project.status.not_in(['deleted', 'cancelled']))

    # Apply user filters
    if deo_id is not None:
        query = query.filter(Project.deo_id == deo_id)

    if fund_year is not None:
        query = query.filter(Project.fund_year == fund_year)

    if status is not None:
        query = query.filter(Project.status == status)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Project.project_title.ilike(search_pattern),
                Project.location.ilike(search_pattern)
            )
        )

    # Get total count
    total = query.count()

    # Get paginated results
    projects = query.offset(offset).limit(limit).all()

    # Enrich with current progress and DEO name
    items = []
    for project in projects:
        # Get latest progress
        latest_progress = db.query(ProjectProgressLog).filter(
            ProjectProgressLog.project_id == project.project_id
        ).order_by(ProjectProgressLog.created_at.desc()).first()

        project_dict = {
            "project_id": project.project_id,
            "deo_id": project.deo_id,
            "deo_name": project.deo.deo_name,
            "project_title": project.project_title,
            "location": project.location,
            "fund_source": project.fund_source,
            "mode_of_implementation": project.mode_of_implementation,
            "project_cost": float(project.project_cost) if project.project_cost else 0.0,
            "project_scale": project.project_scale,
            "fund_year": project.fund_year,
            "status": project.status,
            "created_at": project.created_at,
            "created_by": project.created_by,
            "updated_at": project.updated_at,
            "current_progress": float(latest_progress.reported_percent) if latest_progress else 0.0
        }

        items.append(ProjectResponse(**project_dict))

    return {"total": total, "items": items}


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get project by ID"""
    project = db.query(Project).filter(Project.project_id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # RBAC check (in addition to RLS)
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this project"
        )

    # Get current progress
    latest_progress = db.query(ProjectProgressLog).filter(
        ProjectProgressLog.project_id == project_id
    ).order_by(ProjectProgressLog.created_at.desc()).first()

    project_dict = {
        "project_id": project.project_id,
        "deo_id": project.deo_id,
        "deo_name": project.deo.deo_name,
        "project_title": project.project_title,
        "location": project.location,
        "fund_source": project.fund_source,
        "mode_of_implementation": project.mode_of_implementation,
        "project_cost": float(project.project_cost) if project.project_cost else 0.0,
        "project_scale": project.project_scale,
        "fund_year": project.fund_year,
        "status": project.status,
        "created_at": project.created_at,
        "created_by": project.created_by,
        "updated_at": project.updated_at,
        "current_progress": float(latest_progress.reported_percent) if latest_progress else 0.0
    }

    return ProjectResponse(**project_dict)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Create new project.

    RBAC:
    - deo_user: Can only create for their own DEO
    - regional_admin: Can create for any DEO in their region
    - super_admin: Can create for any DEO
    """
    # Set DEO ID based on role
    if current_user.role == "deo_user":
        deo_id = current_user.deo_id
    else:
        # Regional admin or super admin can specify DEO
        if project.deo_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="deo_id is required for this role"
            )
        deo_id = project.deo_id

    # Verify DEO exists
    deo = db.query(DEO).filter(DEO.deo_id == deo_id).first()
    if not deo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DEO with ID {deo_id} not found"
        )

    # Regional admin can only create for DEOs in their region
    if current_user.role == "regional_admin" and deo.region != current_user.region:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create project for DEO outside your region"
        )

    # Create project
    new_project = Project(
        project_id=uuid.uuid4(),
        deo_id=deo_id,
        project_title=project.project_title,
        location=project.location,
        fund_source=project.fund_source,
        mode_of_implementation=project.mode_of_implementation,
        project_cost=project.project_cost,
        project_scale=project.project_scale,
        fund_year=project.fund_year,
        status=project.status,
        created_by=current_user.user_id,
        created_at=datetime.utcnow()
    )

    db.add(new_project)

    # Create audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="CREATE_PROJECT",
        entity_type="project",
        entity_id=new_project.project_id,
        payload=project.dict(),
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(new_project)

    return ProjectResponse(
        project_id=new_project.project_id,
        deo_id=new_project.deo_id,
        deo_name=deo.deo_name,
        project_title=new_project.project_title,
        location=new_project.location,
        fund_source=new_project.fund_source,
        mode_of_implementation=new_project.mode_of_implementation,
        project_cost=float(new_project.project_cost) if new_project.project_cost else 0.0,
        project_scale=new_project.project_scale,
        fund_year=new_project.fund_year,
        status=new_project.status,
        created_at=new_project.created_at,
        created_by=new_project.created_by,
        updated_at=new_project.updated_at,
        current_progress=0.0
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_update: ProjectUpdate,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Update project (limited fields).

    Only certain fields can be updated:
    - project_title
    - location
    - status
    - project_cost
    """
    project = db.query(Project).filter(Project.project_id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # RBAC check
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update project from another DEO"
        )

    # Update only provided fields
    update_data = project_update.dict(exclude_unset=True)

    for field, value in update_data.items():
        setattr(project, field, value)

    project.updated_at = datetime.utcnow()

    # Audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="UPDATE_PROJECT",
        entity_type="project",
        entity_id=project_id,
        payload=update_data,
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(project)

    # Get current progress
    latest_progress = db.query(ProjectProgressLog).filter(
        ProjectProgressLog.project_id == project_id
    ).order_by(ProjectProgressLog.created_at.desc()).first()

    return ProjectResponse(
        project_id=project.project_id,
        deo_id=project.deo_id,
        deo_name=project.deo.deo_name,
        project_title=project.project_title,
        location=project.location,
        fund_source=project.fund_source,
        mode_of_implementation=project.mode_of_implementation,
        project_cost=float(project.project_cost) if project.project_cost else 0.0,
        project_scale=project.project_scale,
        fund_year=project.fund_year,
        status=project.status,
        created_at=project.created_at,
        created_by=project.created_by,
        updated_at=project.updated_at,
        current_progress=float(latest_progress.reported_percent) if latest_progress else 0.0
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(require_role(['super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Soft delete project (set status to 'deleted').

    Only super_admin can delete projects.
    """
    project = db.query(Project).filter(Project.project_id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Soft delete
    project.status = 'deleted'
    project.updated_at = datetime.utcnow()

    # Audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="DELETE_PROJECT",
        entity_type="project",
        entity_id=project_id,
        payload={"soft_delete": True},
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()

    return None
