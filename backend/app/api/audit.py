"""
Audit API Endpoints
Query audit logs (super_admin only)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
import json

from ..core.database import get_db
from ..models import AuditLog, User
from ..api.auth import require_role

router = APIRouter()


@router.get("/logs")
async def get_audit_logs(
    actor_id: Optional[UUID] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_role(['super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Query audit logs (super_admin only).

    Returns paginated audit log entries with optional filters.

    Query parameters:
    - actor_id: Filter by user who performed the action
    - action: Filter by action type (e.g., "CREATE_PROJECT", "UPDATE_GIS_FEATURE")
    - entity_type: Filter by entity type (e.g., "project", "gis_feature")
    - entity_id: Filter by specific entity UUID
    - start_date: Filter logs from this date onwards
    - end_date: Filter logs up to this date
    - search: Text search in action or entity_type
    - limit: Max results (default 100, max 1000)
    - offset: Pagination offset

    RBAC: super_admin only
    """
    # Base query
    query = db.query(AuditLog, User.username).outerjoin(
        User, AuditLog.actor_id == User.user_id
    )

    # Apply filters
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)

    if action:
        query = query.filter(AuditLog.action == action)

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)

    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        query = query.filter(AuditLog.created_at >= start_datetime)

    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        query = query.filter(AuditLog.created_at <= end_datetime)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                AuditLog.action.ilike(search_term),
                AuditLog.entity_type.ilike(search_term)
            )
        )

    # Get total count
    total = query.count()

    # Get paginated results
    results = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    # Format response
    logs = []
    for audit_log, username in results:
        logs.append({
            "audit_id": str(audit_log.audit_id),
            "actor_id": str(audit_log.actor_id) if audit_log.actor_id else None,
            "actor_username": username,
            "action": audit_log.action,
            "entity_type": audit_log.entity_type,
            "entity_id": str(audit_log.entity_id) if audit_log.entity_id else None,
            "payload": audit_log.payload,
            "created_at": audit_log.created_at.isoformat(),
            "ip_address": audit_log.ip_address,
            "user_agent": audit_log.user_agent
        })

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": logs
    }


@router.get("/logs/{audit_id}")
async def get_audit_log(
    audit_id: UUID,
    current_user: User = Depends(require_role(['super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Get single audit log entry by ID.

    Returns detailed audit log entry with actor information.

    RBAC: super_admin only
    """
    # Query with user join
    result = db.query(AuditLog, User.username, User.role).outerjoin(
        User, AuditLog.actor_id == User.user_id
    ).filter(AuditLog.audit_id == audit_id).first()

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log entry not found"
        )

    audit_log, username, role = result

    return {
        "audit_id": str(audit_log.audit_id),
        "actor_id": str(audit_log.actor_id) if audit_log.actor_id else None,
        "actor_username": username,
        "actor_role": role,
        "action": audit_log.action,
        "entity_type": audit_log.entity_type,
        "entity_id": str(audit_log.entity_id) if audit_log.entity_id else None,
        "payload": audit_log.payload,
        "created_at": audit_log.created_at.isoformat(),
        "ip_address": audit_log.ip_address,
        "user_agent": audit_log.user_agent
    }


@router.get("/stats/actions")
async def get_action_statistics(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(require_role(['super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Get action statistics (super_admin only).

    Returns count of audit logs grouped by action type.

    Query parameters:
    - start_date: Count logs from this date onwards
    - end_date: Count logs up to this date

    RBAC: super_admin only
    """
    # Base query
    query = db.query(
        AuditLog.action,
        func.count(AuditLog.audit_id).label('count')
    )

    # Apply date filters
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        query = query.filter(AuditLog.created_at >= start_datetime)

    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        query = query.filter(AuditLog.created_at <= end_datetime)

    # Group by action
    results = query.group_by(AuditLog.action).order_by(func.count(AuditLog.audit_id).desc()).all()

    # Format response
    action_stats = {action: count for action, count in results}

    return {
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None,
        "total_logs": sum(action_stats.values()),
        "by_action": action_stats
    }


@router.get("/stats/users")
async def get_user_activity_statistics(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(require_role(['super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Get user activity statistics (super_admin only).

    Returns count of actions performed by each user.

    Query parameters:
    - start_date: Count logs from this date onwards
    - end_date: Count logs up to this date
    - limit: Max users to return (default 50, max 200)

    RBAC: super_admin only
    """
    # Base query with user join
    query = db.query(
        User.user_id,
        User.username,
        User.role,
        func.count(AuditLog.audit_id).label('action_count')
    ).join(
        AuditLog, User.user_id == AuditLog.actor_id
    )

    # Apply date filters
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        query = query.filter(AuditLog.created_at >= start_datetime)

    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        query = query.filter(AuditLog.created_at <= end_datetime)

    # Group by user and order by activity
    results = query.group_by(
        User.user_id, User.username, User.role
    ).order_by(
        func.count(AuditLog.audit_id).desc()
    ).limit(limit).all()

    # Format response
    user_stats = [{
        "user_id": str(user_id),
        "username": username,
        "role": role,
        "action_count": action_count
    } for user_id, username, role, action_count in results]

    return {
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None,
        "users": user_stats
    }


@router.get("/stats/timeline")
async def get_timeline_statistics(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    granularity: str = Query(default="day", regex=r'^(hour|day|week|month)$'),
    current_user: User = Depends(require_role(['super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Get audit log timeline statistics (super_admin only).

    Returns count of actions over time with specified granularity.

    Query parameters:
    - start_date: Start date for timeline
    - end_date: End date for timeline
    - granularity: Time bucket size (hour, day, week, month)

    RBAC: super_admin only
    """
    # Determine date truncation based on granularity
    if granularity == "hour":
        date_trunc_expr = func.date_trunc('hour', AuditLog.created_at)
    elif granularity == "day":
        date_trunc_expr = func.date_trunc('day', AuditLog.created_at)
    elif granularity == "week":
        date_trunc_expr = func.date_trunc('week', AuditLog.created_at)
    else:  # month
        date_trunc_expr = func.date_trunc('month', AuditLog.created_at)

    # Base query
    query = db.query(
        date_trunc_expr.label('time_bucket'),
        func.count(AuditLog.audit_id).label('count')
    )

    # Apply date filters
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        query = query.filter(AuditLog.created_at >= start_datetime)

    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        query = query.filter(AuditLog.created_at <= end_datetime)

    # Group by time bucket
    results = query.group_by('time_bucket').order_by('time_bucket').all()

    # Format response
    timeline = [{
        "timestamp": time_bucket.isoformat() if time_bucket else None,
        "count": count
    } for time_bucket, count in results]

    return {
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None,
        "granularity": granularity,
        "timeline": timeline
    }


@router.get("/entity/{entity_type}/{entity_id}/history")
async def get_entity_audit_history(
    entity_type: str,
    entity_id: UUID,
    current_user: User = Depends(require_role(['super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Get complete audit history for a specific entity.

    Returns all audit log entries for the specified entity,
    showing the complete change history.

    RBAC: super_admin only
    """
    # Query audit logs for this entity
    results = db.query(AuditLog, User.username).outerjoin(
        User, AuditLog.actor_id == User.user_id
    ).filter(
        AuditLog.entity_type == entity_type,
        AuditLog.entity_id == entity_id
    ).order_by(AuditLog.created_at.asc()).all()

    if not results:
        return {
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "total_changes": 0,
            "history": []
        }

    # Format response
    history = []
    for audit_log, username in results:
        history.append({
            "audit_id": str(audit_log.audit_id),
            "action": audit_log.action,
            "actor_username": username,
            "payload": audit_log.payload,
            "created_at": audit_log.created_at.isoformat()
        })

    return {
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "total_changes": len(history),
        "history": history
    }


@router.get("/export")
async def export_audit_logs(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    format: str = Query(default="json", regex=r'^(json|csv)$'),
    current_user: User = Depends(require_role(['super_admin'])),
    db: Session = Depends(get_db)
):
    """
    Export audit logs (super_admin only).

    Returns audit logs in JSON or CSV format for offline analysis.

    Query parameters:
    - start_date: Export logs from this date onwards
    - end_date: Export logs up to this date
    - format: Export format (json or csv)

    RBAC: super_admin only
    """
    from fastapi.responses import Response
    import csv
    from io import StringIO

    # Base query
    query = db.query(AuditLog, User.username).outerjoin(
        User, AuditLog.actor_id == User.user_id
    )

    # Apply date filters
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time())
        query = query.filter(AuditLog.created_at >= start_datetime)

    if end_date:
        end_datetime = datetime.combine(end_date, datetime.max.time())
        query = query.filter(AuditLog.created_at <= end_datetime)

    # Get all results (limited to 10000 for safety)
    results = query.order_by(AuditLog.created_at.desc()).limit(10000).all()

    if format == "csv":
        # Create CSV
        output = StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow([
            'audit_id', 'actor_id', 'actor_username', 'action',
            'entity_type', 'entity_id', 'payload', 'created_at',
            'ip_address', 'user_agent'
        ])

        # Write rows
        for audit_log, username in results:
            writer.writerow([
                str(audit_log.audit_id),
                str(audit_log.actor_id) if audit_log.actor_id else '',
                username or '',
                audit_log.action,
                audit_log.entity_type,
                str(audit_log.entity_id) if audit_log.entity_id else '',
                json.dumps(audit_log.payload) if audit_log.payload else '',
                audit_log.created_at.isoformat(),
                audit_log.ip_address or '',
                audit_log.user_agent or ''
            ])

        csv_content = output.getvalue()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    else:
        # Return JSON
        logs = []
        for audit_log, username in results:
            logs.append({
                "audit_id": str(audit_log.audit_id),
                "actor_id": str(audit_log.actor_id) if audit_log.actor_id else None,
                "actor_username": username,
                "action": audit_log.action,
                "entity_type": audit_log.entity_type,
                "entity_id": str(audit_log.entity_id) if audit_log.entity_id else None,
                "payload": audit_log.payload,
                "created_at": audit_log.created_at.isoformat(),
                "ip_address": audit_log.ip_address,
                "user_agent": audit_log.user_agent
            })

        return {
            "total": len(logs),
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "logs": logs
        }
