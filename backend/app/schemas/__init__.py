"""
Pydantic Schemas
Request/Response models for API validation
"""

from __future__ import annotations

from pydantic import BaseModel, Field, constr, confloat, validator
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID
import json


# =============================================================================
# AUTHENTICATION
# =============================================================================

class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserResponse


class LoginRequest(BaseModel):
    """Login credentials"""
    username: str
    password: str


# =============================================================================
# USER
# =============================================================================

class UserBase(BaseModel):
    """Base user fields"""
    username: constr(min_length=3, max_length=100)
    role: str = Field(..., pattern=r'^(public|deo_user|regional_admin|super_admin)$')
    deo_id: Optional[int] = None
    region: Optional[str] = None


class UserCreate(UserBase):
    """User creation request"""
    password: constr(min_length=8)

    @validator('deo_id')
    def deo_user_must_have_deo(cls, v, values):
        if values.get('role') == 'deo_user' and v is None:
            raise ValueError('deo_user role requires deo_id')
        return v


class UserUpdate(BaseModel):
    """User update request"""
    is_active: Optional[bool] = None
    password: Optional[constr(min_length=8)] = None


class UserResponse(BaseModel):
    """User response"""
    user_id: UUID
    username: str
    role: str
    deo_id: Optional[int]
    region: Optional[str]
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


# =============================================================================
# PROJECT
# =============================================================================

class ProjectBase(BaseModel):
    """Base project fields"""
    project_title: constr(min_length=1, max_length=500)
    location: Optional[str] = None
    fund_source: Optional[str] = None
    mode_of_implementation: Optional[str] = None
    project_cost: confloat(ge=0) = Field(..., description="Must be >= 0")
    project_scale: Optional[str] = None
    fund_year: int = Field(..., ge=2010, le=2050)
    status: str = Field(
        default='planning',
        pattern=r'^(planning|ongoing|completed|suspended|cancelled|deleted)$'
    )


class ProjectCreate(ProjectBase):
    """Project creation request"""
    deo_id: Optional[int] = None  # Will be set from user's DEO if deo_user


class ProjectUpdate(BaseModel):
    """Project update request (limited fields)"""
    project_title: Optional[constr(min_length=1, max_length=500)] = None
    location: Optional[str] = None
    status: Optional[str] = Field(
        None,
        pattern=r'^(planning|ongoing|completed|suspended|cancelled|deleted)$'
    )
    project_cost: Optional[confloat(ge=0)] = None


class ProjectResponse(ProjectBase):
    """Project response"""
    project_id: UUID
    deo_id: int
    deo_name: Optional[str] = None
    created_at: datetime
    created_by: UUID
    updated_at: datetime
    current_progress: Optional[float] = None

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    """Paginated project list"""
    total: int
    items: List[ProjectResponse]


# =============================================================================
# PROGRESS LOG
# =============================================================================

class ProgressLogBase(BaseModel):
    """Base progress log fields"""
    reported_percent: confloat(ge=0, le=100)
    report_date: date
    remarks: Optional[str] = None

    @validator('report_date')
    def no_future_dates(cls, v):
        if v > date.today():
            raise ValueError('report_date cannot be in the future')
        return v


class ProgressLogCreate(ProgressLogBase):
    """Progress log creation request"""
    pass


class ProgressLogResponse(ProgressLogBase):
    """Progress log response"""
    progress_id: UUID
    project_id: UUID
    reported_by: UUID
    reporter_name: Optional[str] = None
    created_at: datetime
    prev_hash: Optional[str]
    record_hash: str
    hash_valid: Optional[bool] = None

    class Config:
        from_attributes = True


class ProgressVerificationResponse(BaseModel):
    """Hash chain verification result"""
    project_id: UUID
    total_logs: int
    chain_valid: bool
    broken_links: List[Dict[str, Any]]


# =============================================================================
# GIS FEATURE
# =============================================================================

class GISFeatureBase(BaseModel):
    """Base GIS feature fields"""
    feature_type: str = Field(
        ...,
        pattern=r'^(road|bridge|drainage|facility|building|other)$'
    )
    geometry: Dict[str, Any]  # GeoJSON geometry
    attributes: Optional[Dict[str, Any]] = {}

    @validator('geometry')
    def validate_geojson(cls, v):
        # Basic GeoJSON validation
        if not isinstance(v, dict):
            raise ValueError('geometry must be a GeoJSON object')
        if 'type' not in v or 'coordinates' not in v:
            raise ValueError('geometry must have "type" and "coordinates"')
        return v


class GISFeatureCreate(GISFeatureBase):
    """GIS feature creation request"""
    project_id: UUID


class GISFeatureUpdate(BaseModel):
    """GIS feature update request"""
    feature_type: Optional[str] = Field(
        None,
        pattern=r'^(road|bridge|drainage|facility|building|other)$'
    )
    geometry: Optional[Dict[str, Any]] = None
    attributes: Optional[Dict[str, Any]] = None


class GISFeatureResponse(GISFeatureBase):
    """GIS feature response"""
    feature_id: UUID
    project_id: UUID
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# MEDIA ASSET
# =============================================================================

class MediaUploadUrlRequest(BaseModel):
    """Request for pre-signed upload URL"""
    project_id: UUID
    media_type: str = Field(..., pattern=r'^(photo|video|document)$')
    filename: str
    content_type: str
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class MediaUploadUrlResponse(BaseModel):
    """Pre-signed upload URL response"""
    upload_url: str
    storage_key: str
    media_id: UUID
    expires_in: int


class MediaAssetResponse(BaseModel):
    """Media asset response"""
    media_id: UUID
    project_id: UUID
    media_type: str
    storage_key: str
    download_url: Optional[str] = None
    latitude: Optional[float]
    longitude: Optional[float]
    captured_at: Optional[datetime]
    uploaded_by: UUID
    uploaded_at: datetime
    attributes: Optional[Dict[str, Any]]
    file_size: Optional[int]
    mime_type: Optional[str]

    class Config:
        from_attributes = True


# =============================================================================
# PUBLIC API
# =============================================================================

class PublicProjectResponse(BaseModel):
    """Public project response (sanitized)"""
    project_id: UUID
    project_title: str
    location: Optional[str]
    fund_source: Optional[str]
    project_cost: float
    fund_year: int
    current_progress: Optional[float]
    last_updated: Optional[date]

    class Config:
        from_attributes = True


class PublicStatsResponse(BaseModel):
    """Public statistics response"""
    total_projects: int
    total_cost: float
    by_province: Dict[str, int]
    by_status: Dict[str, int]
    avg_completion: float


# =============================================================================
# ALERT
# =============================================================================

class AlertResponse(BaseModel):
    """Alert response"""
    alert_id: UUID
    project_id: Optional[UUID]
    alert_type: str
    severity: str
    message: str
    metadata: Optional[Dict[str, Any]]
    triggered_at: datetime
    acknowledged: bool
    resolved: bool

    class Config:
        from_attributes = True


# =============================================================================
# AUDIT LOG
# =============================================================================

class AuditLogResponse(BaseModel):
    """Audit log response"""
    audit_id: UUID
    actor_id: Optional[UUID]
    actor_name: Optional[str]
    action: str
    entity_type: str
    entity_id: Optional[UUID]
    payload: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# ERROR RESPONSE
# =============================================================================

class ErrorResponse(BaseModel):
    """RFC 7807 Problem Details"""
    type: str
    title: str
    status: int
    detail: str
    instance: str
    errors: Optional[List[Dict[str, str]]] = None


# =============================================================================
# MODEL REBUILDS (for forward references in Pydantic v2)
# =============================================================================

# Rebuild Token model after UserResponse is defined
Token.model_rebuild()
