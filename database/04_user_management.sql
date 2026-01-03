-- E-BARMM User Management Schema
-- Groups, Access Rights, MFA Sessions, Refresh Tokens
-- Generated: 2026-01-03

-- =============================================================================
-- GROUPS (for RBAC)
-- =============================================================================

CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_groups_is_active ON groups(is_active);

-- =============================================================================
-- USER_GROUPS (Many-to-many)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_groups (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);

-- =============================================================================
-- ACCESS_RIGHTS (Resource permissions for groups)
-- =============================================================================

CREATE TABLE IF NOT EXISTS access_rights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(50) NOT NULL,
    permissions JSONB NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_group_resource UNIQUE (group_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_access_rights_resource ON access_rights(resource);
CREATE INDEX IF NOT EXISTS idx_access_rights_group_id ON access_rights(group_id);

-- =============================================================================
-- REFRESH_TOKENS
-- =============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- =============================================================================
-- MFA_SESSIONS (Temporary sessions during login)
-- =============================================================================

CREATE TABLE IF NOT EXISTS mfa_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_sessions_session_token ON mfa_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_user_id ON mfa_sessions(user_id);

-- =============================================================================
-- PASSWORD_RESET_TOKENS
-- =============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- =============================================================================
-- DEFAULT GROUPS
-- =============================================================================

INSERT INTO groups (name, description, is_active)
VALUES
    ('Administrators', 'Full system access', TRUE),
    ('Regional Admins', 'Regional administration access', TRUE),
    ('DEO Users', 'District Engineering Office users', TRUE),
    ('Viewers', 'Read-only access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- DEFAULT ACCESS RIGHTS FOR ADMINISTRATORS
-- =============================================================================

DO $$
DECLARE
    admin_group_id UUID;
BEGIN
    SELECT id INTO admin_group_id FROM groups WHERE name = 'Administrators';

    IF admin_group_id IS NOT NULL THEN
        INSERT INTO access_rights (resource, permissions, group_id)
        VALUES
            ('projects', '{"create": true, "read": true, "update": true, "delete": true}'::jsonb, admin_group_id),
            ('users', '{"create": true, "read": true, "update": true, "delete": true}'::jsonb, admin_group_id),
            ('groups', '{"create": true, "read": true, "update": true, "delete": true}'::jsonb, admin_group_id),
            ('access_rights', '{"create": true, "read": true, "update": true, "delete": true}'::jsonb, admin_group_id),
            ('audit_logs', '{"create": false, "read": true, "update": false, "delete": false}'::jsonb, admin_group_id),
            ('gis_features', '{"create": true, "read": true, "update": true, "delete": true}'::jsonb, admin_group_id),
            ('media', '{"create": true, "read": true, "update": true, "delete": true}'::jsonb, admin_group_id)
        ON CONFLICT (group_id, resource) DO NOTHING;
    END IF;
END $$;

-- =============================================================================
-- ADD ADMIN USER TO ADMINISTRATORS GROUP
-- =============================================================================

INSERT INTO user_groups (user_id, group_id)
SELECT u.user_id, g.id
FROM users u, groups g
WHERE u.username = 'admin' AND g.name = 'Administrators'
ON CONFLICT (user_id, group_id) DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE groups IS 'User groups for role-based access control';
COMMENT ON TABLE user_groups IS 'Many-to-many relationship between users and groups';
COMMENT ON TABLE access_rights IS 'Resource permissions assigned to groups';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for extended sessions';
COMMENT ON TABLE mfa_sessions IS 'Temporary sessions during MFA login flow';
COMMENT ON TABLE password_reset_tokens IS 'Password reset tokens for account recovery';
