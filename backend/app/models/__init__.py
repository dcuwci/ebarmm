"""
SQLAlchemy Models
Database table representations
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, Date, BigInteger, ForeignKey, CheckConstraint, UniqueConstraint, TIMESTAMP, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from datetime import datetime
import uuid

from ..core.database import Base


class User(Base):
    """System users with RBAC"""
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(30), nullable=False, index=True)
    deo_id = Column(Integer, ForeignKey("deo.deo_id"))
    region = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)

    # Relationships
    deo = relationship("DEO", back_populates="users")
    projects_created = relationship("Project", back_populates="creator", foreign_keys="Project.created_by")
    progress_logs = relationship("ProjectProgressLog", back_populates="reporter")
    gis_features = relationship("GISFeature", back_populates="creator")
    media_assets = relationship("MediaAsset", back_populates="uploader")

    __table_args__ = (
        CheckConstraint(
            "role IN ('public', 'deo_user', 'regional_admin', 'super_admin')",
            name="chk_valid_role"
        ),
    )


class DEO(Base):
    """District Engineering Offices"""
    __tablename__ = "deo"

    deo_id = Column(Integer, primary_key=True)
    deo_name = Column(String(100), nullable=False)
    province = Column(String(100), nullable=False, index=True)
    region = Column(String(50), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="deo")
    projects = relationship("Project", back_populates="deo")


class Project(Base):
    """Infrastructure projects"""
    __tablename__ = "projects"

    project_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deo_id = Column(Integer, ForeignKey("deo.deo_id"), nullable=False, index=True)
    project_title = Column(Text, nullable=False)
    location = Column(Text)
    fund_source = Column(String(50))
    mode_of_implementation = Column(String(50))
    project_cost = Column(Numeric(18, 2))
    project_scale = Column(String(50))
    fund_year = Column(Integer, index=True)
    status = Column(String(50), default='planning', index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    deo = relationship("DEO", back_populates="projects")
    creator = relationship("User", back_populates="projects_created", foreign_keys=[created_by])
    progress_logs = relationship("ProjectProgressLog", back_populates="project", cascade="all, delete-orphan")
    gis_features = relationship("GISFeature", back_populates="project", cascade="all, delete-orphan")
    media_assets = relationship("MediaAsset", back_populates="project", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="project")

    __table_args__ = (
        CheckConstraint("project_cost >= 0", name="chk_positive_cost"),
        CheckConstraint("fund_year >= 2010 AND fund_year <= 2050", name="chk_valid_fund_year"),
        CheckConstraint(
            "status IN ('planning', 'ongoing', 'completed', 'suspended', 'cancelled', 'deleted')",
            name="chk_valid_status"
        ),
    )


class ProjectProgressLog(Base):
    """Immutable progress history with hash chaining"""
    __tablename__ = "project_progress_logs"

    progress_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    reported_percent = Column(Numeric(5, 2), nullable=False)
    report_date = Column(Date, nullable=False, index=True)
    remarks = Column(Text)
    reported_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    prev_hash = Column(Text)
    record_hash = Column(Text, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="progress_logs")
    reporter = relationship("User", back_populates="progress_logs")

    __table_args__ = (
        CheckConstraint("reported_percent >= 0 AND reported_percent <= 100", name="chk_valid_percent"),
        UniqueConstraint("project_id", "report_date", name="uq_project_progress_date"),
    )


class GISFeature(Base):
    """Spatial features (PostGIS)"""
    __tablename__ = "gis_features"

    feature_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    feature_type = Column(String(30), nullable=False, index=True)
    geometry = Column(Geometry(geometry_type='GEOMETRY', srid=4326), nullable=False)
    attributes = Column(JSONB, default={})
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="gis_features")
    creator = relationship("User", back_populates="gis_features")

    __table_args__ = (
        CheckConstraint(
            "feature_type IN ('road', 'bridge', 'drainage', 'facility', 'building', 'other')",
            name="chk_valid_feature_type"
        ),
        Index('idx_gis_features_geometry', 'geometry', postgresql_using='gist'),
    )


class MediaAsset(Base):
    """Photos, videos, documents"""
    __tablename__ = "media_assets"

    media_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    media_type = Column(String(20), nullable=False, index=True)
    storage_key = Column(Text, nullable=False)
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))
    captured_at = Column(DateTime)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, index=True)
    attributes = Column(JSONB, default={})
    file_size = Column(BigInteger)
    mime_type = Column(String(100))

    # Relationships
    project = relationship("Project", back_populates="media_assets")
    uploader = relationship("User", back_populates="media_assets")

    __table_args__ = (
        CheckConstraint(
            "media_type IN ('photo', 'video', 'document')",
            name="chk_valid_media_type"
        ),
    )


class AuditLog(Base):
    """Immutable audit trail"""
    __tablename__ = "audit_logs"

    audit_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), index=True)
    payload = Column(JSONB, default={})
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    prev_hash = Column(Text)
    record_hash = Column(Text)


class GeofencingRule(Base):
    """Spatial validation rules"""
    __tablename__ = "geofencing_rules"

    rule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id"))
    geometry = Column(Geometry(geometry_type='POLYGON', srid=4326), nullable=False)
    rule_type = Column(String(50), nullable=False, index=True)
    attributes = Column(JSONB, default={})
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))

    __table_args__ = (
        CheckConstraint(
            "rule_type IN ('region_boundary', 'project_area', 'restricted_zone')",
            name="chk_valid_rule_type"
        ),
        Index('idx_geofencing_geometry', 'geometry', postgresql_using='gist'),
    )


class Alert(Base):
    """System alerts and notifications"""
    __tablename__ = "alerts"

    alert_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id"), index=True)
    alert_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), default='info', index=True)
    message = Column(Text, nullable=False)
    alert_metadata = Column(JSONB, default={})
    triggered_at = Column(DateTime, default=datetime.utcnow, index=True)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    acknowledged_at = Column(DateTime)
    resolved = Column(Boolean, default=False, index=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    resolved_at = Column(DateTime)

    # Relationships
    project = relationship("Project", back_populates="alerts")

    __table_args__ = (
        CheckConstraint(
            "alert_type IN ('progress_delay', 'geofence_violation', 'budget_overrun', 'system_error')",
            name="chk_valid_alert_type"
        ),
        CheckConstraint(
            "severity IN ('info', 'warning', 'error', 'critical')",
            name="chk_valid_severity"
        ),
    )


class TokenBlacklist(Base):
    """JWT token blacklist for logout"""
    __tablename__ = "token_blacklist"

    token_hash = Column(String(64), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
