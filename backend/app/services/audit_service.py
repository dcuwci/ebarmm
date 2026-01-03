"""
Audit Service
Enhanced audit logging with query capabilities
"""

from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from datetime import datetime, timedelta
from contextlib import contextmanager

from ..models import AuditLog, User


class AuditService:
    """Service for audit logging and querying"""

    @staticmethod
    @contextmanager
    def set_audit_user(db: Session, username: str):
        """
        Context manager to set the current user for audit logging.
        This sets a PostgreSQL session variable that can be used by triggers.

        Usage:
            with AuditService.set_audit_user(db, "user@example.com"):
                db.add(some_record)
                db.commit()
        """
        try:
            db.execute(
                text("SELECT set_config('app.current_user', :username, true)"),
                {"username": username}
            )
            yield
        finally:
            # Reset the context
            db.execute(
                text("SELECT set_config('app.current_user', '', true)")
            )

    @staticmethod
    def log_action(
        db: Session,
        actor: User,
        action: str,
        entity_type: str,
        entity_id: str,
        payload: Optional[Dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """
        Create an audit log entry.

        Args:
            db: Database session
            actor: The user performing the action
            action: Action name (e.g., 'CREATE', 'UPDATE', 'DELETE')
            entity_type: Type of entity (e.g., 'project', 'user')
            entity_id: ID of the entity
            payload: Additional data about the action
            ip_address: Client IP address
            user_agent: Client user agent

        Returns:
            The created AuditLog entry
        """
        from ..core.security import calculate_audit_hash

        # Get the previous audit log for hash chaining
        prev_log = (
            db.query(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        prev_hash = prev_log.record_hash if prev_log else None

        now = datetime.utcnow()
        record_hash = calculate_audit_hash(
            actor_id=str(actor.user_id),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload or {},
            created_at=now.isoformat(),
            prev_hash=prev_hash
        )

        audit_log = AuditLog(
            actor_id=actor.user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload or {},
            ip_address=ip_address,
            user_agent=user_agent,
            prev_hash=prev_hash,
            record_hash=record_hash
        )

        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)

        return audit_log

    @staticmethod
    def get_audit_logs(
        db: Session,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        action: Optional[str] = None,
        actor_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> tuple[List[Dict[str, Any]], int]:
        """
        Query audit logs with filters.

        Returns:
            Tuple of (logs, total_count)
        """
        query = db.query(AuditLog)

        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if entity_id:
            query = query.filter(AuditLog.entity_id == entity_id)
        if action:
            query = query.filter(AuditLog.action == action)
        if actor_id:
            query = query.filter(AuditLog.actor_id == actor_id)
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)

        total_count = query.count()

        logs = (
            query
            .order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        # Enrich with actor information
        result = []
        for log in logs:
            actor = db.query(User).filter(User.user_id == log.actor_id).first() if log.actor_id else None

            result.append({
                "audit_id": str(log.audit_id),
                "actor_id": str(log.actor_id) if log.actor_id else None,
                "actor_username": actor.username if actor else None,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": str(log.entity_id) if log.entity_id else None,
                "payload": log.payload,
                "ip_address": str(log.ip_address) if log.ip_address else None,
                "user_agent": log.user_agent,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "record_hash": log.record_hash,
            })

        return result, total_count

    @staticmethod
    def get_entity_history(
        db: Session,
        entity_type: str,
        entity_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get complete audit history for a specific entity.
        """
        logs, _ = AuditService.get_audit_logs(
            db=db,
            entity_type=entity_type,
            entity_id=entity_id,
            limit=1000
        )
        return logs

    @staticmethod
    def get_user_activity(
        db: Session,
        user_id: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get activity for a specific user over the past N days.
        """
        start_date = datetime.utcnow() - timedelta(days=days)
        logs, _ = AuditService.get_audit_logs(
            db=db,
            actor_id=user_id,
            start_date=start_date,
            limit=1000
        )
        return logs

    @staticmethod
    def get_summary(db: Session, days: int = 7) -> Dict[str, Any]:
        """
        Get audit log summary statistics.

        Returns:
            Summary with total changes, by action type, by entity type, etc.
        """
        start_date = datetime.utcnow() - timedelta(days=days)

        # Total count
        total = (
            db.query(func.count(AuditLog.audit_id))
            .filter(AuditLog.created_at >= start_date)
            .scalar()
        )

        # Count by action
        by_action = (
            db.query(
                AuditLog.action,
                func.count(AuditLog.audit_id).label("count")
            )
            .filter(AuditLog.created_at >= start_date)
            .group_by(AuditLog.action)
            .all()
        )

        # Count by entity type
        by_entity = (
            db.query(
                AuditLog.entity_type,
                func.count(AuditLog.audit_id).label("count")
            )
            .filter(AuditLog.created_at >= start_date)
            .group_by(AuditLog.entity_type)
            .all()
        )

        # Most active users
        active_users = (
            db.query(
                AuditLog.actor_id,
                func.count(AuditLog.audit_id).label("count")
            )
            .filter(
                AuditLog.created_at >= start_date,
                AuditLog.actor_id.isnot(None)
            )
            .group_by(AuditLog.actor_id)
            .order_by(func.count(AuditLog.audit_id).desc())
            .limit(10)
            .all()
        )

        # Enrich active users with usernames
        enriched_users = []
        for user_id, count in active_users:
            user = db.query(User).filter(User.user_id == user_id).first()
            enriched_users.append({
                "user_id": str(user_id),
                "username": user.username if user else "Unknown",
                "count": count
            })

        return {
            "period_days": days,
            "total_actions": total or 0,
            "by_action": {action: count for action, count in by_action},
            "by_entity_type": {entity: count for entity, count in by_entity},
            "most_active_users": enriched_users
        }

    @staticmethod
    def cleanup_old_logs(db: Session, days_to_keep: int = 90) -> int:
        """
        Delete audit logs older than specified days.

        Args:
            db: Database session
            days_to_keep: Number of days of logs to retain

        Returns:
            Number of logs deleted
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        result = (
            db.query(AuditLog)
            .filter(AuditLog.created_at < cutoff_date)
            .delete()
        )
        db.commit()
        return result

    @staticmethod
    def verify_chain_integrity(db: Session, limit: int = 1000) -> Dict[str, Any]:
        """
        Verify the integrity of the audit log hash chain.

        Returns:
            Dict with verification result and any broken links
        """
        from ..core.security import calculate_audit_hash

        logs = (
            db.query(AuditLog)
            .order_by(AuditLog.created_at.asc())
            .limit(limit)
            .all()
        )

        broken_links = []
        prev_hash = None

        for log in logs:
            expected_hash = calculate_audit_hash(
                actor_id=str(log.actor_id) if log.actor_id else "",
                action=log.action,
                entity_type=log.entity_type,
                entity_id=str(log.entity_id) if log.entity_id else "",
                payload=log.payload or {},
                created_at=log.created_at.isoformat() if log.created_at else "",
                prev_hash=prev_hash
            )

            if log.record_hash != expected_hash:
                broken_links.append({
                    "audit_id": str(log.audit_id),
                    "expected_hash": expected_hash,
                    "actual_hash": log.record_hash,
                    "created_at": log.created_at.isoformat() if log.created_at else None
                })

            if prev_hash is not None and log.prev_hash != prev_hash:
                broken_links.append({
                    "audit_id": str(log.audit_id),
                    "error": "prev_hash mismatch",
                    "expected_prev_hash": prev_hash,
                    "actual_prev_hash": log.prev_hash
                })

            prev_hash = log.record_hash

        return {
            "is_valid": len(broken_links) == 0,
            "logs_checked": len(logs),
            "broken_links": broken_links
        }
