"""
Reports API Endpoints
PDF report generation with QR code authentication and watermarking
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from datetime import datetime
import uuid

from ..core.database import get_db
from ..models import User, AuditLog
from ..schemas import ReportResponse
from ..api.auth import get_current_user
from ..services.report_service import ReportService

router = APIRouter()


def _log_report_generation(
    db: Session,
    user: User,
    report_type: str,
    document_hash: str,
    project_id: Optional[UUID] = None,
    filters: Optional[dict] = None
):
    """Create audit log entry for report generation."""
    audit_entry = AuditLog(
        audit_id=uuid.uuid4(),
        actor_id=user.user_id,
        action="GENERATE_REPORT",
        entity_type="report",
        entity_id=None,
        payload={
            "report_type": report_type,
            "document_hash": document_hash,
            "project_id": str(project_id) if project_id else None,
            "filters": filters
        },
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()


@router.get("/project/{project_id}/summary")
async def generate_project_summary_report(
    project_id: UUID,
    format: str = Query(default="stream", pattern="^(stream|json)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate project summary PDF report.

    Returns PDF with:
    - Project details (title, location, cost, fund source, DEO)
    - Current status and progress percentage
    - Progress bar visualization
    - Last 5 progress log entries
    - QR code verification section

    RBAC:
    - public: Public projects only, no hash details in table
    - deo_user: Own DEO's projects only
    - regional_admin: Projects in their region
    - super_admin: All projects

    Query Parameters:
    - format: Response format
        - stream: Returns PDF file directly (default)
        - json: Returns metadata with document hash
    """
    try:
        # Determine if hash details should be included
        include_hash_details = current_user.role != "public"

        # Generate report
        pdf_buffer, document_hash, metadata = ReportService.generate_project_summary_report(
            db=db,
            project_id=project_id,
            user=current_user,
            include_hash_details=include_hash_details
        )

        # Log report generation
        _log_report_generation(
            db=db,
            user=current_user,
            report_type="project_summary",
            document_hash=document_hash,
            project_id=project_id
        )

        if format == "json":
            return ReportResponse(
                report_id=metadata["report_id"],
                report_type=metadata["report_type"],
                document_hash=metadata["document_hash"],
                generated_at=datetime.fromisoformat(metadata["generated_at"]),
                verification_url=metadata["verification_url"]
            )

        # Return PDF stream
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=project_summary_{project_id}_{document_hash[:8]}.pdf",
                "X-Document-Hash": document_hash,
                "X-Verification-URL": metadata["verification_url"]
            }
        )

    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg
            )
        elif "access denied" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )


@router.get("/project/{project_id}/progress")
async def generate_progress_history_report(
    project_id: UUID,
    format: str = Query(default="stream", pattern="^(stream|json)$"),
    include_verification: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate progress history PDF report with hash chain verification.

    Returns PDF with:
    - Project header info
    - Hash chain verification status (if include_verification=true)
    - Complete progress timeline table (date, %, reporter, hash, remarks)
    - Progress over time summary
    - QR code verification section

    RBAC:
    - public: Public projects only, no hash/verification details
    - deo_user: Own DEO's projects only
    - regional_admin: Projects in their region
    - super_admin: All projects

    Query Parameters:
    - format: Response format (stream|json)
    - include_verification: Include hash chain verification (default: true)
    """
    try:
        # Public users cannot see verification details
        if current_user.role == "public":
            include_verification = False

        # Generate report
        pdf_buffer, document_hash, metadata = ReportService.generate_progress_history_report(
            db=db,
            project_id=project_id,
            user=current_user,
            include_verification=include_verification
        )

        # Log report generation
        _log_report_generation(
            db=db,
            user=current_user,
            report_type="progress_history",
            document_hash=document_hash,
            project_id=project_id,
            filters={"include_verification": include_verification}
        )

        if format == "json":
            return ReportResponse(
                report_id=metadata["report_id"],
                report_type=metadata["report_type"],
                document_hash=metadata["document_hash"],
                generated_at=datetime.fromisoformat(metadata["generated_at"]),
                verification_url=metadata["verification_url"]
            )

        # Return PDF stream
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=progress_history_{project_id}_{document_hash[:8]}.pdf",
                "X-Document-Hash": document_hash,
                "X-Verification-URL": metadata["verification_url"],
                "X-Chain-Valid": str(metadata.get("chain_valid", True)).lower()
            }
        )

    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg
            )
        elif "access denied" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )


@router.get("/projects")
async def generate_project_list_report(
    format: str = Query(default="stream", pattern="^(stream|json)$"),
    deo_id: Optional[int] = Query(default=None),
    fund_year: Optional[int] = Query(default=None, ge=2010, le=2050),
    status: Optional[str] = Query(
        default=None,
        pattern="^(planning|ongoing|completed|suspended|cancelled)$"
    ),
    limit: int = Query(default=100, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate project list PDF report with filters.

    Returns PDF with:
    - Filter criteria display
    - Summary statistics (total projects, total cost, avg progress)
    - Project table (title, DEO, cost, progress, status)
    - Status breakdown
    - QR code verification section

    RBAC:
    - public: Public projects only
    - deo_user: Own DEO's projects only
    - regional_admin: Projects in their region
    - super_admin: All projects

    Query Parameters:
    - format: Response format (stream|json)
    - deo_id: Filter by DEO ID
    - fund_year: Filter by fund year (2010-2050)
    - status: Filter by status
    - limit: Maximum projects to include (default 100, max 500)
    """
    try:
        # Generate report
        pdf_buffer, document_hash, metadata = ReportService.generate_project_list_report(
            db=db,
            user=current_user,
            deo_id=deo_id,
            fund_year=fund_year,
            status=status,
            limit=limit
        )

        # Log report generation
        _log_report_generation(
            db=db,
            user=current_user,
            report_type="project_list",
            document_hash=document_hash,
            filters={
                "deo_id": deo_id,
                "fund_year": fund_year,
                "status": status,
                "limit": limit
            }
        )

        if format == "json":
            return ReportResponse(
                report_id=metadata["report_id"],
                report_type=metadata["report_type"],
                document_hash=metadata["document_hash"],
                generated_at=datetime.fromisoformat(metadata["generated_at"]),
                verification_url=metadata["verification_url"]
            )

        # Build filename
        filename_parts = ["project_list"]
        if deo_id:
            filename_parts.append(f"deo{deo_id}")
        if fund_year:
            filename_parts.append(str(fund_year))
        if status:
            filename_parts.append(status)
        filename_parts.append(document_hash[:8])
        filename = "_".join(filename_parts) + ".pdf"

        # Return PDF stream
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Document-Hash": document_hash,
                "X-Verification-URL": metadata["verification_url"],
                "X-Total-Projects": str(metadata.get("total_projects", 0)),
                "X-Projects-In-Report": str(metadata.get("projects_in_report", 0))
            }
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
