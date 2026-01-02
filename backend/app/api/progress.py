"""
Progress API Endpoints
Append-only progress reporting with hash chaining
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from uuid import UUID
from datetime import datetime
import uuid

from ..core.database import get_db
from ..models import Project, ProjectProgressLog, User, AuditLog
from ..schemas import (
    ProgressLogCreate,
    ProgressLogResponse,
    ProgressVerificationResponse
)
from ..api.auth import get_current_user, require_role
from ..core.security import calculate_progress_hash, verify_progress_chain

router = APIRouter()


@router.post("/projects/{project_id}/progress", response_model=ProgressLogResponse, status_code=status.HTTP_201_CREATED)
async def log_progress(
    project_id: UUID,
    progress: ProgressLogCreate,
    current_user: User = Depends(require_role(['deo_user', 'regional_admin', 'super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Log project progress (append-only with hash chaining).

    Creates an immutable progress log entry with SHA-256 hash chaining
    to prevent tampering or backdating.

    RBAC:
    - deo_user: Can only report for their own DEO's projects
    - regional_admin: Can report for projects in their region
    - super_admin: Can report for any project
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
            detail="Cannot report progress for projects from another DEO"
        )

    # Check for duplicate report on same date
    existing = db.query(ProjectProgressLog).filter(
        and_(
            ProjectProgressLog.project_id == project_id,
            ProjectProgressLog.report_date == progress.report_date
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Progress already reported for date {progress.report_date}. Cannot report twice on the same date."
        )

    # Get latest progress log for hash chain
    latest_log = db.query(ProjectProgressLog).filter(
        ProjectProgressLog.project_id == project_id
    ).order_by(ProjectProgressLog.created_at.desc()).first()

    prev_hash = latest_log.record_hash if latest_log else None

    # Calculate hash for this entry
    record_hash = calculate_progress_hash(
        project_id=str(project_id),
        reported_percent=float(progress.reported_percent),
        report_date=str(progress.report_date),
        reported_by=str(current_user.user_id),
        prev_hash=prev_hash
    )

    # Create progress log entry
    progress_id = uuid.uuid4()
    new_log = ProjectProgressLog(
        progress_id=progress_id,
        project_id=project_id,
        reported_percent=progress.reported_percent,
        report_date=progress.report_date,
        remarks=progress.remarks,
        reported_by=current_user.user_id,
        created_at=datetime.utcnow(),
        prev_hash=prev_hash,
        record_hash=record_hash
    )

    db.add(new_log)

    # Create audit log
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=current_user.user_id,
        action="LOG_PROGRESS",
        entity_type="progress_log",
        entity_id=progress_id,
        payload={
            "project_id": str(project_id),
            "reported_percent": float(progress.reported_percent),
            "report_date": str(progress.report_date),
            "prev_hash": prev_hash,
            "record_hash": record_hash
        },
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(new_log)

    return ProgressLogResponse(
        progress_id=new_log.progress_id,
        project_id=new_log.project_id,
        reported_percent=float(new_log.reported_percent),
        report_date=new_log.report_date,
        remarks=new_log.remarks,
        reported_by=new_log.reported_by,
        reporter_name=current_user.username,
        created_at=new_log.created_at,
        prev_hash=new_log.prev_hash,
        record_hash=new_log.record_hash,
        hash_valid=True
    )


@router.get("/projects/{project_id}/progress", response_model=List[ProgressLogResponse])
async def get_progress_history(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get progress history for a project.

    Returns all progress log entries ordered chronologically.
    Includes hash validation status for each entry.
    """
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.project_id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # RBAC check (public can view)
    if current_user.role == "deo_user" and project.deo_id != current_user.deo_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this project"
        )

    # Get all progress logs
    logs = db.query(ProjectProgressLog).filter(
        ProjectProgressLog.project_id == project_id
    ).order_by(ProjectProgressLog.created_at.asc()).all()

    # Verify hash chain and enrich with reporter names
    prev_hash = None
    results = []

    for log in logs:
        # Recalculate expected hash
        expected_hash = calculate_progress_hash(
            project_id=str(log.project_id),
            reported_percent=float(log.reported_percent),
            report_date=str(log.report_date),
            reported_by=str(log.reported_by),
            prev_hash=prev_hash
        )

        # Check if hash is valid
        hash_valid = (expected_hash == log.record_hash and log.prev_hash == prev_hash)

        # Get reporter name
        reporter = db.query(User).filter(User.user_id == log.reported_by).first()
        reporter_name = reporter.username if reporter else "Unknown"

        results.append(ProgressLogResponse(
            progress_id=log.progress_id,
            project_id=log.project_id,
            reported_percent=float(log.reported_percent),
            report_date=log.report_date,
            remarks=log.remarks,
            reported_by=log.reported_by,
            reporter_name=reporter_name,
            created_at=log.created_at,
            prev_hash=log.prev_hash,
            record_hash=log.record_hash,
            hash_valid=hash_valid
        ))

        prev_hash = log.record_hash

    return results


@router.get("/projects/{project_id}/progress/verify", response_model=ProgressVerificationResponse)
async def verify_chain(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verify integrity of progress log hash chain.

    Recalculates all hashes and checks for tampering.
    Returns list of broken links if chain is invalid.

    This endpoint is critical for audit purposes.
    """
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.project_id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Get all progress logs
    logs = db.query(ProjectProgressLog).filter(
        ProjectProgressLog.project_id == project_id
    ).order_by(ProjectProgressLog.created_at.asc()).all()

    if not logs:
        return ProgressVerificationResponse(
            project_id=project_id,
            total_logs=0,
            chain_valid=True,
            broken_links=[]
        )

    # Verify hash chain
    chain_valid, broken_links = verify_progress_chain(logs)

    return ProgressVerificationResponse(
        project_id=project_id,
        total_logs=len(logs),
        chain_valid=chain_valid,
        broken_links=broken_links
    )


@router.get("/projects/{project_id}/progress/latest")
async def get_latest_progress(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get only the latest progress report.

    Useful for dashboard displays.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.project_id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Get latest log
    latest_log = db.query(ProjectProgressLog).filter(
        ProjectProgressLog.project_id == project_id
    ).order_by(ProjectProgressLog.created_at.desc()).first()

    if not latest_log:
        return {
            "project_id": str(project_id),
            "current_progress": 0.0,
            "last_updated": None,
            "remarks": None
        }

    # Get reporter name
    reporter = db.query(User).filter(User.user_id == latest_log.reported_by).first()

    return {
        "project_id": str(project_id),
        "current_progress": float(latest_log.reported_percent),
        "last_updated": latest_log.report_date,
        "remarks": latest_log.remarks,
        "reported_by": reporter.username if reporter else "Unknown"
    }
