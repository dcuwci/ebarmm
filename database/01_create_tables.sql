-- E-BARMM Database Schema
-- PostgreSQL 15+ with PostGIS 3.4+
-- Generated: 2026-01-02

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "postgis_topology";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- USERS & AUTHENTICATION
-- =============================================================================

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('public', 'deo_user', 'regional_admin', 'super_admin')),
    deo_id INT,
    region VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,

    -- Profile fields
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone_number VARCHAR(20),

    -- Email verification
    is_verified BOOLEAN DEFAULT TRUE,
    verification_token VARCHAR(255) UNIQUE,
    token_expires_at TIMESTAMP,

    -- MFA fields
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    backup_codes TEXT,

    -- Password reset tracking
    last_password_reset TIMESTAMP,
    password_reset_count INT DEFAULT 0,

    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    CONSTRAINT chk_deo_user_has_deo CHECK (
        (role = 'deo_user' AND deo_id IS NOT NULL) OR
        (role != 'deo_user')
    )
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_deo_id ON users(deo_id);
CREATE INDEX idx_users_is_deleted ON users(is_deleted);

-- =============================================================================
-- ORGANIZATIONAL STRUCTURE
-- =============================================================================

CREATE TABLE deo (
    deo_id INT PRIMARY KEY,
    deo_name VARCHAR(100) NOT NULL,
    province VARCHAR(100) NOT NULL,
    region VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deo_province ON deo(province);
CREATE INDEX idx_deo_region ON deo(region);

-- Add foreign key constraint to users
ALTER TABLE users
ADD CONSTRAINT fk_users_deo
FOREIGN KEY (deo_id) REFERENCES deo(deo_id);

-- =============================================================================
-- PROJECTS
-- =============================================================================

CREATE TABLE projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deo_id INT NOT NULL REFERENCES deo(deo_id),
    project_title TEXT NOT NULL,
    location TEXT,
    fund_source VARCHAR(50),
    mode_of_implementation VARCHAR(50),
    project_cost NUMERIC(18,2) CHECK (project_cost >= 0),
    project_scale VARCHAR(50),
    fund_year INT CHECK (fund_year >= 2010 AND fund_year <= 2050),
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'ongoing', 'completed', 'suspended', 'cancelled', 'deleted')),
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_project_title_length CHECK (char_length(project_title) > 0)
);

CREATE INDEX idx_projects_deo_id ON projects(deo_id);
CREATE INDEX idx_projects_fund_year ON projects(fund_year);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);
CREATE INDEX idx_projects_created_by ON projects(created_by);

-- =============================================================================
-- PROGRESS LOGS (IMMUTABLE - APPEND ONLY)
-- =============================================================================

CREATE TABLE project_progress_logs (
    progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    reported_percent NUMERIC(5,2) NOT NULL CHECK (reported_percent >= 0 AND reported_percent <= 100),
    report_date DATE NOT NULL,
    remarks TEXT,
    reported_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW(),
    prev_hash TEXT,
    record_hash TEXT NOT NULL,
    CONSTRAINT uq_project_progress_date UNIQUE(project_id, report_date)
);

CREATE INDEX idx_progress_project_id ON project_progress_logs(project_id);
CREATE INDEX idx_progress_created_at ON project_progress_logs(created_at);
CREATE INDEX idx_progress_report_date ON project_progress_logs(report_date);
CREATE INDEX idx_progress_reported_by ON project_progress_logs(reported_by);

-- =============================================================================
-- GIS FEATURES
-- =============================================================================

CREATE TABLE gis_features (
    feature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    feature_type VARCHAR(30) NOT NULL CHECK (feature_type IN ('road', 'bridge', 'drainage', 'facility', 'building', 'other')),
    geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
    attributes JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_valid_geometry CHECK (ST_IsValid(geometry))
);

-- Spatial index (GIST)
CREATE INDEX idx_gis_features_geometry ON gis_features USING GIST(geometry);
CREATE INDEX idx_gis_features_project_id ON gis_features(project_id);
CREATE INDEX idx_gis_features_type ON gis_features(feature_type);
CREATE INDEX idx_gis_features_created_by ON gis_features(created_by);

-- =============================================================================
-- MEDIA ASSETS
-- =============================================================================

CREATE TABLE media_assets (
    media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('photo', 'video', 'document')),
    storage_key TEXT NOT NULL,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    captured_at TIMESTAMP,
    uploaded_by UUID NOT NULL REFERENCES users(user_id),
    uploaded_at TIMESTAMP DEFAULT NOW(),
    attributes JSONB DEFAULT '{}',
    file_size BIGINT,
    mime_type VARCHAR(100),
    CONSTRAINT chk_valid_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    )
);

CREATE INDEX idx_media_project_id ON media_assets(project_id);
CREATE INDEX idx_media_type ON media_assets(media_type);
CREATE INDEX idx_media_uploaded_by ON media_assets(uploaded_by);
CREATE INDEX idx_media_uploaded_at ON media_assets(uploaded_at);
CREATE INDEX idx_media_attributes ON media_assets USING GIN(attributes);

-- =============================================================================
-- AUDIT LOGS (IMMUTABLE)
-- =============================================================================

CREATE TABLE audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    payload JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    prev_hash TEXT,
    record_hash TEXT
);

CREATE INDEX idx_audit_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_payload ON audit_logs USING GIN(payload);

-- =============================================================================
-- GEOFENCING RULES
-- =============================================================================

CREATE TABLE geofencing_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id),
    geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('region_boundary', 'project_area', 'restricted_zone')),
    attributes JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    CONSTRAINT chk_valid_fence_geometry CHECK (ST_IsValid(geometry))
);

CREATE INDEX idx_geofencing_geometry ON geofencing_rules USING GIST(geometry);
CREATE INDEX idx_geofencing_project_id ON geofencing_rules(project_id);
CREATE INDEX idx_geofencing_rule_type ON geofencing_rules(rule_type);

-- =============================================================================
-- ALERTS
-- =============================================================================

CREATE TABLE alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('progress_delay', 'geofence_violation', 'budget_overrun', 'system_error')),
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    message TEXT NOT NULL,
    alert_metadata JSONB DEFAULT '{}',
    triggered_at TIMESTAMP DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(user_id),
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(user_id),
    resolved_at TIMESTAMP
);

CREATE INDEX idx_alerts_project_id ON alerts(project_id);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);

-- =============================================================================
-- TOKEN BLACKLIST (for logout)
-- =============================================================================

CREATE TABLE token_blacklist (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_blacklist_expires ON token_blacklist(expires_at);
CREATE INDEX idx_token_blacklist_user_id ON token_blacklist(user_id);

-- =============================================================================
-- MIGRATION SUPPORT TABLES
-- =============================================================================

CREATE TABLE migration_project_id_map (
    legacy_id INT PRIMARY KEY,
    new_uuid UUID NOT NULL UNIQUE
);

CREATE TABLE migration_log (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(20) CHECK (status IN ('running', 'completed', 'failed')),
    records_processed INT DEFAULT 0,
    error_message TEXT
);

-- =============================================================================
-- GPS TRACKS (RouteShoot)
-- =============================================================================

CREATE TABLE gps_tracks (
    track_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    media_id UUID REFERENCES media_assets(media_id) ON DELETE SET NULL,
    track_name VARCHAR(255) NOT NULL,
    waypoints JSONB NOT NULL,
    waypoint_count INTEGER NOT NULL,
    total_distance_meters NUMERIC(12, 2),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    kml_storage_key TEXT,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gps_tracks_project_id ON gps_tracks(project_id);
CREATE INDEX idx_gps_tracks_media_id ON gps_tracks(media_id);
CREATE INDEX idx_gps_tracks_created_at ON gps_tracks(created_at);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE users IS 'System users with role-based access control';
COMMENT ON TABLE deo IS 'District Engineering Offices';
COMMENT ON TABLE projects IS 'Infrastructure projects managed by DEOs';
COMMENT ON TABLE project_progress_logs IS 'Immutable progress history with hash chaining';
COMMENT ON TABLE gis_features IS 'Spatial features (roads, bridges, etc.) stored in PostGIS';
COMMENT ON TABLE media_assets IS 'Photos, videos, and documents linked to projects';
COMMENT ON TABLE audit_logs IS 'System-wide audit trail (immutable)';
COMMENT ON TABLE geofencing_rules IS 'Spatial validation rules for projects';
COMMENT ON TABLE alerts IS 'Automated notifications for anomalies';
COMMENT ON TABLE gps_tracks IS 'GPS tracks from RouteShoot recordings with video synchronization';

COMMENT ON COLUMN project_progress_logs.prev_hash IS 'Hash of previous log entry (blockchain-style chaining)';
COMMENT ON COLUMN project_progress_logs.record_hash IS 'SHA-256 hash of this entry for tamper detection';
COMMENT ON COLUMN gis_features.geometry IS 'PostGIS geometry (SRID 4326 - WGS84)';
COMMENT ON COLUMN media_assets.storage_key IS 'S3 object key or filesystem path';
