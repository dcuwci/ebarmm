"""
Report Service
Business logic for generating PDF reports
"""

from io import BytesIO
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from uuid import UUID
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import Project, DEO, ProjectProgressLog, User
from ..core.security import verify_progress_chain
from .pdf_generator import (
    PDFReportBuilder,
    calculate_document_hash,
    get_verification_url,
    get_styles,
    build_progress_bar
)
from reportlab.lib.units import inch


class ReportService:
    """Service for generating PDF reports."""

    @staticmethod
    def _check_project_access(
        project: Project,
        user: User,
        db: Session
    ) -> bool:
        """
        Check if user has access to the project.

        Args:
            project: Project to check access for
            user: Current user
            db: Database session

        Returns:
            True if user has access, False otherwise
        """
        if user.role == "super_admin":
            return True

        if user.role == "regional_admin":
            deo = db.query(DEO).filter(DEO.deo_id == project.deo_id).first()
            return deo and deo.region == user.region

        if user.role == "deo_user":
            return project.deo_id == user.deo_id

        # Public users can only access non-deleted/cancelled projects
        if user.role == "public":
            return project.status not in ['deleted', 'cancelled']

        return False

    @staticmethod
    def _format_currency(amount: Optional[Decimal]) -> str:
        """Format decimal as Philippine Peso currency."""
        if amount is None:
            return "-"
        return f"PHP {float(amount):,.2f}"

    @staticmethod
    def _get_project_with_progress(
        db: Session,
        project_id: UUID
    ) -> Tuple[Optional[Project], Optional[float], Optional[ProjectProgressLog]]:
        """
        Get project with current progress info.

        Returns:
            Tuple of (project, current_progress, latest_log)
        """
        project = db.query(Project).filter(Project.project_id == project_id).first()
        if not project:
            return None, None, None

        latest_log = db.query(ProjectProgressLog).filter(
            ProjectProgressLog.project_id == project_id
        ).order_by(ProjectProgressLog.created_at.desc()).first()

        current_progress = float(latest_log.reported_percent) if latest_log else 0.0

        return project, current_progress, latest_log

    @staticmethod
    def generate_project_summary_report(
        db: Session,
        project_id: UUID,
        user: User,
        include_hash_details: bool = True
    ) -> Tuple[BytesIO, str, Dict[str, Any]]:
        """
        Generate project summary PDF report.

        Args:
            db: Database session
            project_id: Project UUID
            user: Current user (for RBAC and hash details)
            include_hash_details: Whether to include hash chain details

        Returns:
            Tuple of (PDF buffer, document_hash, report_metadata)

        Raises:
            ValueError: If project not found or access denied
        """
        # Get project data
        project, current_progress, latest_log = ReportService._get_project_with_progress(
            db, project_id
        )

        if not project:
            raise ValueError("Project not found")

        if not ReportService._check_project_access(project, user, db):
            raise ValueError("Access denied to this project")

        # Get DEO info
        deo = db.query(DEO).filter(DEO.deo_id == project.deo_id).first()

        # Get last 5 progress entries
        recent_logs = db.query(ProjectProgressLog).filter(
            ProjectProgressLog.project_id == project_id
        ).order_by(ProjectProgressLog.created_at.desc()).limit(5).all()

        # Get reporter names
        log_reporters = {}
        for log in recent_logs:
            if log.reported_by not in log_reporters:
                reporter = db.query(User).filter(User.user_id == log.reported_by).first()
                log_reporters[log.reported_by] = reporter.username if reporter else "Unknown"

        # Generate timestamp
        generated_at = datetime.utcnow()

        # Create data snapshot for hash
        data_snapshot = {
            "project_id": str(project_id),
            "project_title": project.project_title,
            "current_progress": current_progress,
            "status": project.status,
            "log_count": len(recent_logs)
        }

        # Calculate document hash
        document_hash = calculate_document_hash(
            report_type="project_summary",
            project_id=str(project_id),
            data_snapshot=data_snapshot,
            generated_at=generated_at
        )

        verification_url = get_verification_url(
            document_hash=document_hash,
            report_type="project_summary",
            project_id=str(project_id)
        )

        # Build PDF
        buffer = BytesIO()
        builder = PDFReportBuilder(buffer)

        # Header
        builder.add_header(
            title="Project Summary Report",
            subtitle=project.project_title,
            generated_at=generated_at
        )

        # Project Details Section
        builder.add_section("Project Details")
        project_info = {
            "Project ID": str(project.project_id)[:8] + "...",
            "Project Title": project.project_title,
            "Location": project.location or "-",
            "DEO": deo.deo_name if deo else "-",
            "Province": deo.province if deo else "-",
            "Region": deo.region if deo else "-",
            "Fund Source": project.fund_source or "-",
            "Fund Year": str(project.fund_year),
            "Project Cost": ReportService._format_currency(project.project_cost),
            "Implementation Mode": project.mode_of_implementation or "-",
            "Project Scale": project.project_scale or "-",
            "Status": project.status.title()
        }
        builder.add_key_value_table(project_info)

        # Current Progress Section
        builder.add_section("Current Progress")
        builder.add_progress_bar(current_progress, f"Overall Completion: {current_progress:.1f}%")

        if latest_log:
            builder.add_paragraph(
                f"Last updated: {latest_log.report_date.strftime('%B %d, %Y')} "
                f"by {log_reporters.get(latest_log.reported_by, 'Unknown')}"
            )
            if latest_log.remarks:
                builder.add_paragraph(f"Latest remarks: {latest_log.remarks}")

        # Recent Progress Entries
        if recent_logs:
            builder.add_section("Recent Progress Entries")

            headers = ["Date", "Progress", "Reporter", "Remarks"]
            data = []

            for log in recent_logs:
                row = [
                    log.report_date.strftime("%Y-%m-%d"),
                    f"{float(log.reported_percent):.1f}%",
                    log_reporters.get(log.reported_by, "Unknown"),
                    (log.remarks[:50] + "..." if log.remarks and len(log.remarks) > 50 else log.remarks) or "-"
                ]

                # Include hash if authorized
                if include_hash_details and user.role != "public":
                    if "Hash" not in headers:
                        headers.append("Hash")
                    row.append(log.record_hash[:12] + "...")

                data.append(row)

            col_widths = [1*inch, 0.8*inch, 1.2*inch, 2*inch]
            if include_hash_details and user.role != "public":
                col_widths.append(1*inch)

            builder.add_table(headers, data, col_widths)

        # QR Verification Section
        builder.add_qr_section(document_hash, verification_url)

        # Build final PDF
        pdf_buffer = builder.build(document_hash)

        # Report metadata
        metadata = {
            "report_id": document_hash[:16],
            "report_type": "project_summary",
            "project_id": str(project_id),
            "document_hash": document_hash,
            "generated_at": generated_at.isoformat(),
            "verification_url": verification_url
        }

        return pdf_buffer, document_hash, metadata

    @staticmethod
    def generate_progress_history_report(
        db: Session,
        project_id: UUID,
        user: User,
        include_verification: bool = True
    ) -> Tuple[BytesIO, str, Dict[str, Any]]:
        """
        Generate progress history PDF report with hash chain verification.

        Args:
            db: Database session
            project_id: Project UUID
            user: Current user
            include_verification: Whether to include hash verification details

        Returns:
            Tuple of (PDF buffer, document_hash, report_metadata)
        """
        # Get project data
        project, current_progress, _ = ReportService._get_project_with_progress(
            db, project_id
        )

        if not project:
            raise ValueError("Project not found")

        if not ReportService._check_project_access(project, user, db):
            raise ValueError("Access denied to this project")

        # Get DEO info
        deo = db.query(DEO).filter(DEO.deo_id == project.deo_id).first()

        # Get all progress logs
        all_logs = db.query(ProjectProgressLog).filter(
            ProjectProgressLog.project_id == project_id
        ).order_by(ProjectProgressLog.created_at.asc()).all()

        # Verify hash chain
        chain_valid = True
        broken_links = []
        if all_logs and include_verification:
            chain_valid, broken_links = verify_progress_chain(all_logs)

        # Get reporter names
        log_reporters = {}
        for log in all_logs:
            if log.reported_by not in log_reporters:
                reporter = db.query(User).filter(User.user_id == log.reported_by).first()
                log_reporters[log.reported_by] = reporter.username if reporter else "Unknown"

        # Generate timestamp
        generated_at = datetime.utcnow()

        # Create data snapshot for hash
        data_snapshot = {
            "project_id": str(project_id),
            "total_logs": len(all_logs),
            "chain_valid": chain_valid,
            "current_progress": current_progress
        }

        # Calculate document hash
        document_hash = calculate_document_hash(
            report_type="progress_history",
            project_id=str(project_id),
            data_snapshot=data_snapshot,
            generated_at=generated_at
        )

        verification_url = get_verification_url(
            document_hash=document_hash,
            report_type="progress_history",
            project_id=str(project_id)
        )

        # Build PDF
        buffer = BytesIO()
        builder = PDFReportBuilder(buffer)

        # Header
        builder.add_header(
            title="Progress History Report",
            subtitle=project.project_title,
            generated_at=generated_at
        )

        # Project Info
        builder.add_section("Project Information")
        project_info = {
            "Project Title": project.project_title,
            "DEO": deo.deo_name if deo else "-",
            "Fund Year": str(project.fund_year),
            "Project Cost": ReportService._format_currency(project.project_cost),
            "Current Progress": f"{current_progress:.1f}%",
            "Status": project.status.title()
        }
        builder.add_key_value_table(project_info)

        # Hash Chain Verification Status
        if include_verification and user.role != "public":
            builder.add_section("Hash Chain Verification")

            if chain_valid:
                builder.add_paragraph(
                    "<font color='green'><b>VERIFIED:</b></font> "
                    f"All {len(all_logs)} progress entries have valid hash chain integrity.",
                    "Normal"
                )
            else:
                builder.add_paragraph(
                    "<font color='red'><b>WARNING:</b></font> "
                    f"Hash chain integrity issues detected. {len(broken_links)} broken link(s) found.",
                    "Normal"
                )

                if broken_links:
                    builder.add_paragraph("Broken links:", "Small")
                    for link in broken_links[:5]:  # Show first 5
                        builder.add_paragraph(
                            f"- Entry {link.get('progress_id', 'N/A')[:8]}... "
                            f"on {link.get('report_date', 'N/A')}",
                            "Small"
                        )

        # Progress Timeline
        builder.add_section("Progress Timeline")

        if all_logs:
            show_hash = include_verification and user.role != "public"
            headers = ["Date", "Progress", "Reporter", "Remarks"]
            if show_hash:
                headers.extend(["Hash", "Valid"])

            data = []
            prev_hash = None

            for log in all_logs:
                # Verify individual hash
                from ..core.security import calculate_progress_hash
                expected_hash = calculate_progress_hash(
                    project_id=str(log.project_id),
                    reported_percent=float(log.reported_percent),
                    report_date=str(log.report_date),
                    reported_by=str(log.reported_by),
                    prev_hash=prev_hash
                )
                hash_valid = (expected_hash == log.record_hash and
                            (prev_hash is None or log.prev_hash == prev_hash))

                row = [
                    log.report_date.strftime("%Y-%m-%d"),
                    f"{float(log.reported_percent):.1f}%",
                    log_reporters.get(log.reported_by, "Unknown"),
                    (log.remarks[:40] + "..." if log.remarks and len(log.remarks) > 40 else log.remarks) or "-"
                ]

                if show_hash:
                    row.append(log.record_hash[:10] + "...")
                    row.append("Yes" if hash_valid else "NO")

                data.append(row)
                prev_hash = log.record_hash

            col_widths = [0.9*inch, 0.7*inch, 1*inch, 2.2*inch]
            if show_hash:
                col_widths.extend([0.9*inch, 0.4*inch])

            builder.add_table(headers, data, col_widths)
        else:
            builder.add_paragraph("No progress entries recorded yet.")

        # Simple progress chart (text-based representation)
        if len(all_logs) >= 2:
            builder.add_section("Progress Over Time")
            builder.add_paragraph(
                f"From {all_logs[0].report_date.strftime('%Y-%m-%d')} "
                f"({float(all_logs[0].reported_percent):.1f}%) to "
                f"{all_logs[-1].report_date.strftime('%Y-%m-%d')} "
                f"({float(all_logs[-1].reported_percent):.1f}%)"
            )

        # QR Verification Section
        builder.add_qr_section(document_hash, verification_url)

        # Build final PDF
        pdf_buffer = builder.build(document_hash)

        # Report metadata
        metadata = {
            "report_id": document_hash[:16],
            "report_type": "progress_history",
            "project_id": str(project_id),
            "document_hash": document_hash,
            "generated_at": generated_at.isoformat(),
            "verification_url": verification_url,
            "total_logs": len(all_logs),
            "chain_valid": chain_valid
        }

        return pdf_buffer, document_hash, metadata

    @staticmethod
    def generate_project_list_report(
        db: Session,
        user: User,
        deo_id: Optional[int] = None,
        fund_year: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 100
    ) -> Tuple[BytesIO, str, Dict[str, Any]]:
        """
        Generate project list PDF report with filters.

        Args:
            db: Database session
            user: Current user
            deo_id: Filter by DEO ID
            fund_year: Filter by fund year
            status: Filter by status
            limit: Maximum number of projects to include

        Returns:
            Tuple of (PDF buffer, document_hash, report_metadata)
        """
        # Build query with RBAC filtering
        query = db.query(Project).join(DEO)

        if user.role == "deo_user":
            query = query.filter(Project.deo_id == user.deo_id)
        elif user.role == "regional_admin":
            query = query.filter(DEO.region == user.region)
        elif user.role == "public":
            query = query.filter(Project.status.not_in(['deleted', 'cancelled']))

        # Apply filters
        if deo_id is not None:
            query = query.filter(Project.deo_id == deo_id)
        if fund_year is not None:
            query = query.filter(Project.fund_year == fund_year)
        if status is not None:
            query = query.filter(Project.status == status)

        # Get total count and projects
        total_count = query.count()
        projects = query.order_by(Project.fund_year.desc(), Project.created_at.desc()).limit(limit).all()

        # Calculate statistics
        total_cost = sum(float(p.project_cost or 0) for p in projects)

        # Get progress for each project
        project_progress = {}
        for project in projects:
            latest_log = db.query(ProjectProgressLog).filter(
                ProjectProgressLog.project_id == project.project_id
            ).order_by(ProjectProgressLog.created_at.desc()).first()
            project_progress[project.project_id] = float(latest_log.reported_percent) if latest_log else 0.0

        avg_progress = sum(project_progress.values()) / len(project_progress) if project_progress else 0.0

        # Generate timestamp
        generated_at = datetime.utcnow()

        # Build filter description
        filters_applied = []
        if deo_id:
            deo = db.query(DEO).filter(DEO.deo_id == deo_id).first()
            if deo:
                filters_applied.append(f"DEO: {deo.deo_name}")
        if fund_year:
            filters_applied.append(f"Year: {fund_year}")
        if status:
            filters_applied.append(f"Status: {status}")

        # Create data snapshot for hash
        data_snapshot = {
            "total_projects": total_count,
            "displayed_projects": len(projects),
            "total_cost": total_cost,
            "avg_progress": avg_progress,
            "filters": filters_applied
        }

        # Calculate document hash
        document_hash = calculate_document_hash(
            report_type="project_list",
            project_id=None,
            data_snapshot=data_snapshot,
            generated_at=generated_at
        )

        verification_url = get_verification_url(
            document_hash=document_hash,
            report_type="project_list"
        )

        # Build PDF
        buffer = BytesIO()
        builder = PDFReportBuilder(buffer)

        # Header
        builder.add_header(
            title="Project List Report",
            subtitle="E-BARMM Infrastructure Projects",
            generated_at=generated_at
        )

        # Filters Applied
        if filters_applied:
            builder.add_section("Filters Applied")
            builder.add_paragraph(" | ".join(filters_applied))

        # Summary Statistics
        builder.add_section("Summary Statistics")
        summary_info = {
            "Total Projects": str(total_count),
            "Projects in Report": str(len(projects)),
            "Total Project Cost": ReportService._format_currency(Decimal(str(total_cost))),
            "Average Progress": f"{avg_progress:.1f}%"
        }
        builder.add_key_value_table(summary_info)

        # Project List Table
        builder.add_section("Project List")

        if projects:
            headers = ["Title", "DEO", "Year", "Cost", "Progress", "Status"]
            data = []

            for project in projects:
                progress = project_progress.get(project.project_id, 0.0)
                row = [
                    (project.project_title[:35] + "..."
                     if len(project.project_title) > 35 else project.project_title),
                    project.deo.deo_name if project.deo else "-",
                    str(project.fund_year),
                    ReportService._format_currency(project.project_cost),
                    f"{progress:.0f}%",
                    project.status.title()
                ]
                data.append(row)

            col_widths = [2.2*inch, 1*inch, 0.5*inch, 1*inch, 0.6*inch, 0.7*inch]
            builder.add_table(headers, data, col_widths)
        else:
            builder.add_paragraph("No projects found matching the specified criteria.")

        # Status breakdown
        status_counts = {}
        for project in projects:
            status_counts[project.status] = status_counts.get(project.status, 0) + 1

        if status_counts:
            builder.add_section("Status Breakdown")
            status_info = {s.title(): str(c) for s, c in status_counts.items()}
            builder.add_key_value_table(status_info, [1.5*inch, 1*inch])

        # QR Verification Section
        builder.add_qr_section(document_hash, verification_url)

        # Build final PDF
        pdf_buffer = builder.build(document_hash)

        # Report metadata
        metadata = {
            "report_id": document_hash[:16],
            "report_type": "project_list",
            "document_hash": document_hash,
            "generated_at": generated_at.isoformat(),
            "verification_url": verification_url,
            "total_projects": total_count,
            "projects_in_report": len(projects),
            "filters": filters_applied
        }

        return pdf_buffer, document_hash, metadata
