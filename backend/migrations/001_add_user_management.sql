-- Migration: Add User Management, Groups, Access Rights, MFA
-- Created: 2026-01-03
-- Description: Adds missing columns to users table and creates new tables for RBAC

-- ============================================================================
-- USERS TABLE: Add missing columns
-- ============================================================================

-- Profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Email verification
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP;

-- MFA fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT;

-- Password reset tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_reset TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_count INTEGER DEFAULT 0;

-- Soft delete
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);

-- ============================================================================
-- TOKEN BLACKLIST TABLE (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_blacklist (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- ============================================================================
-- GROUPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_groups_is_active ON groups(is_active);

-- ============================================================================
-- USER_GROUPS TABLE (Many-to-many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_groups (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);

-- ============================================================================
-- ACCESS_RIGHTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS access_rights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(50) NOT NULL,
    permissions JSONB NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_group_resource UNIQUE (group_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_access_rights_resource ON access_rights(resource);
CREATE INDEX IF NOT EXISTS idx_access_rights_group_id ON access_rights(group_id);

-- ============================================================================
-- REFRESH_TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- ============================================================================
-- MFA_SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mfa_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mfa_sessions_session_token ON mfa_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_user_id ON mfa_sessions(user_id);

-- ============================================================================
-- PASSWORD_RESET_TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- ============================================================================
-- AUDIT_LOGS TABLE (if not exists with all columns)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    payload JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    prev_hash TEXT,
    record_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- DEFAULT GROUPS
-- ============================================================================

INSERT INTO groups (name, description, is_active)
VALUES
    ('Administrators', 'Full system access', TRUE),
    ('Regional Admins', 'Regional administration access', TRUE),
    ('DEO Users', 'District Engineering Office users', TRUE),
    ('Viewers', 'Read-only access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- DEFAULT ACCESS RIGHTS FOR ADMINISTRATORS
-- ============================================================================

INSERT INTO access_rights (resource, permissions, group_id)
SELECT 'projects', '{"create": true, "read": true, "update": true, "delete": true}'::jsonb, id
FROM groups WHERE name = 'Administrators'
ON CONFLICT (group_id, resource) DO NOTHING;

INSERT INTO access_rights (resource, permissions, group_id)
SELECT 'users', '{"create": true, "read": true, "update": true, "delete": true}'::jsonb, id
FROM groups WHERE name = 'Administrators'
ON CONFLICT (group_id, resource) DO NOTHING;

INSERT INTO access_rights (resource, permissions, group_id)
SELECT 'groups', '{"create": true, "read": true, "update": true, "delete": true}'::jsonb, id
FROM groups WHERE name = 'Administrators'
ON CONFLICT (group_id, resource) DO NOTHING;

INSERT INTO access_rights (resource, permissions, group_id)
SELECT 'access_rights', '{"create": true, "read": true, "update": true, "delete": true}'::jsonb, id
FROM groups WHERE name = 'Administrators'
ON CONFLICT (group_id, resource) DO NOTHING;

INSERT INTO access_rights (resource, permissions, group_id)
SELECT 'audit_logs', '{"create": false, "read": true, "update": false, "delete": false}'::jsonb, id
FROM groups WHERE name = 'Administrators'
ON CONFLICT (group_id, resource) DO NOTHING;

-- ============================================================================
-- ADD ADMIN USER TO ADMINISTRATORS GROUP
-- ============================================================================

INSERT INTO user_groups (user_id, group_id)
SELECT u.user_id, g.id
FROM users u, groups g
WHERE u.username = 'admin' AND g.name = 'Administrators'
ON CONFLICT (user_id, group_id) DO NOTHING;

-- Done!
SELECT 'Migration completed successfully!' as status;
