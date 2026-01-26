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
from ..core.config import settings
from ..models import Project, DEO, ProjectProgressLog, User, AuditLog, MediaAsset
from ..schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse
from ..api.auth import get_current_user, require_role
import uuid
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

# Initialize S3 client for media registration
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    region_name=settings.S3_REGION,
    config=Config(signature_version='s3v4'),
    use_ssl=settings.S3_USE_SSL
)

router = APIRouter()


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    deo_id: Optional[int] = None,
    fund_year: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    province: Optional[str] = None,
    fund_source: Optional[str] = None,
    mode_of_implementation: Optional[str] = None,
    project_scale: Optional[str] = None,
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
    - province: Filter by province (via DEO)
    - fund_source: Filter by fund source
    - mode_of_implementation: Filter by implementation mode
    - project_scale: Filter by project scale
    - limit: Max results (default 50, max 500)
    - offset: Pagination offset
    """
    query = db.query(Project).join(DEO)

    # RBAC filtering is handled by Row Level Security (RLS)
    # But we add additional filters here for convenience
    # Note: DEO users can view ALL projects for transparency, but can only EDIT their own DEO's projects

    if current_user.role == "regional_admin":
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

    if province is not None:
        query = query.filter(DEO.province == province)

    if fund_source is not None:
        query = query.filter(Project.fund_source == fund_source)

    if mode_of_implementation is not None:
        query = query.filter(Project.mode_of_implementation == mode_of_implementation)

    if project_scale is not None:
        query = query.filter(Project.project_scale == project_scale)

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

    # Note: DEO users can VIEW any project for transparency
    # Edit restrictions are enforced in the update endpoint

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


@router.post("/{project_id}/media")
async def register_project_media(
    project_id: UUID,
    body: dict,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Register media uploaded from mobile app.

    This endpoint is called after the mobile app uploads a file to S3 using a presigned URL.
    It creates a media_asset record linking the uploaded file to the project.

    Body fields:
    - media_key: S3 storage key (required)
    - file_name: Original filename (required)
    - file_size: File size in bytes (required)
    - mime_type: MIME type of the file (required)
    - latitude: GPS latitude (optional)
    - longitude: GPS longitude (optional)
    - progress_id: Link to progress report (optional)
    """
    # Verify project exists and user has access
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
            detail="Cannot register media for projects from another DEO"
        )

    media_key = body.get("media_key")
    file_name = body.get("file_name")
    file_size = body.get("file_size")
    mime_type = body.get("mime_type")
    latitude = body.get("latitude")
    longitude = body.get("longitude")

    if not media_key or not file_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="media_key and file_name are required"
        )

    # Determine media type from mime type
    if mime_type and mime_type.startswith("image/"):
        media_type = "photo"
    elif mime_type and mime_type.startswith("video/"):
        media_type = "video"
    else:
        media_type = "document"

    # Verify file exists in S3
    try:
        s3_response = s3_client.head_object(
            Bucket=settings.S3_BUCKET,
            Key=media_key
        )
        # Use S3 file size if not provided
        if not file_size:
            file_size = s3_response.get('ContentLength')
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found in storage: {media_key}"
            )
        # Log but continue if we can't verify
        pass

    # Create media asset record
    media_id = uuid.uuid4()
    new_media = MediaAsset(
        media_id=media_id,
        project_id=project_id,
        media_type=media_type,
        storage_key=media_key,
        latitude=latitude,
        longitude=longitude,
        uploaded_by=current_user.user_id,
        uploaded_at=datetime.utcnow(),
        file_size=file_size,
        mime_type=mime_type,
        attributes={
            'filename': file_name,
            'status': 'confirmed',
            'source': 'mobile'
        }
    )

    db.add(new_media)

    # Audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="REGISTER_MOBILE_MEDIA",
        entity_type="media_asset",
        entity_id=media_id,
        payload={
            "project_id": str(project_id),
            "media_type": media_type,
            "storage_key": media_key
        },
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(new_media)

    # Generate download URL
    try:
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.S3_BUCKET,
                'Key': media_key
            },
            ExpiresIn=3600
        )
    except ClientError:
        download_url = None

    return {
        "media_id": str(media_id),
        "id": str(media_id),  # Alias for mobile compatibility
        "project_id": str(project_id),
        "media_type": media_type,
        "storage_key": media_key,
        "url": download_url,
        "file_size": file_size,
        "mime_type": mime_type,
        "latitude": latitude,
        "longitude": longitude,
        "uploaded_at": new_media.uploaded_at.isoformat()
    }
