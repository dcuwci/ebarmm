-- E-BARMM Database Triggers
-- Immutability enforcement and audit automation

-- =============================================================================
-- IMMUTABILITY FUNCTIONS
-- =============================================================================

-- Function to reject mutations on immutable tables
CREATE OR REPLACE FUNCTION reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Table % is immutable. % operations are not allowed.',
        TG_TABLE_NAME, TG_OP
    USING ERRCODE = '23514';  -- check_violation
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PROGRESS LOGS - IMMUTABILITY
-- =============================================================================

CREATE TRIGGER prevent_progress_update
BEFORE UPDATE ON project_progress_logs
FOR EACH ROW
EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER prevent_progress_delete
BEFORE DELETE ON project_progress_logs
FOR EACH ROW
EXECUTE FUNCTION reject_mutation();

-- =============================================================================
-- AUDIT LOGS - IMMUTABILITY
-- =============================================================================

CREATE TRIGGER prevent_audit_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER prevent_audit_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION reject_mutation();

-- =============================================================================
-- AUTO-UPDATE TIMESTAMPS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gis_features_timestamp
BEFORE UPDATE ON gis_features
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- =============================================================================

-- Function to set session variables from JWT claims
CREATE OR REPLACE FUNCTION set_session_user(
    p_user_id UUID,
    p_user_role TEXT,
    p_user_deo_id INT DEFAULT NULL,
    p_user_region TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.user_id', p_user_id::text, false);
    PERFORM set_config('app.user_role', p_user_role, false);
    PERFORM set_config('app.user_deo_id', COALESCE(p_user_deo_id, 0)::text, false);
    PERFORM set_config('app.user_region', COALESCE(p_user_region, ''), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.user_role', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'public';
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get current user's DEO ID
CREATE OR REPLACE FUNCTION current_user_deo_id()
RETURNS INT AS $$
BEGIN
    RETURN current_setting('app.user_deo_id', true)::int;
EXCEPTION
    WHEN OTHERS THEN
        RETURN 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get current user's region
CREATE OR REPLACE FUNCTION current_user_region()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.user_region', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN '';
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gis_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Projects RLS Policies
CREATE POLICY projects_select_policy ON projects
FOR SELECT
USING (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'regional_admin' AND deo_id IN (
        SELECT deo_id FROM deo WHERE region = current_user_region()
    )) OR
    (current_user_role() = 'deo_user' AND deo_id = current_user_deo_id()) OR
    (current_user_role() = 'public' AND status NOT IN ('deleted', 'cancelled'))
);

CREATE POLICY projects_insert_policy ON projects
FOR INSERT
WITH CHECK (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'regional_admin' AND deo_id IN (
        SELECT deo_id FROM deo WHERE region = current_user_region()
    )) OR
    (current_user_role() = 'deo_user' AND deo_id = current_user_deo_id())
);

CREATE POLICY projects_update_policy ON projects
FOR UPDATE
USING (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'regional_admin' AND deo_id IN (
        SELECT deo_id FROM deo WHERE region = current_user_region()
    )) OR
    (current_user_role() = 'deo_user' AND deo_id = current_user_deo_id())
);

CREATE POLICY projects_delete_policy ON projects
FOR DELETE
USING (current_user_role() = 'super_admin');

-- Progress Logs RLS Policies
CREATE POLICY progress_select_policy ON project_progress_logs
FOR SELECT
USING (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'regional_admin' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id IN (
            SELECT deo_id FROM deo WHERE region = current_user_region()
        )
    )) OR
    (current_user_role() = 'deo_user' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id = current_user_deo_id()
    )) OR
    current_user_role() = 'public'
);

CREATE POLICY progress_insert_policy ON project_progress_logs
FOR INSERT
WITH CHECK (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'regional_admin' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id IN (
            SELECT deo_id FROM deo WHERE region = current_user_region()
        )
    )) OR
    (current_user_role() = 'deo_user' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id = current_user_deo_id()
    ))
);

-- GIS Features RLS Policies
CREATE POLICY gis_select_policy ON gis_features
FOR SELECT
USING (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'regional_admin' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id IN (
            SELECT deo_id FROM deo WHERE region = current_user_region()
        )
    )) OR
    (current_user_role() = 'deo_user' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id = current_user_deo_id()
    )) OR
    current_user_role() = 'public'
);

CREATE POLICY gis_insert_policy ON gis_features
FOR INSERT
WITH CHECK (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'regional_admin' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id IN (
            SELECT deo_id FROM deo WHERE region = current_user_region()
        )
    )) OR
    (current_user_role() = 'deo_user' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id = current_user_deo_id()
    ))
);

CREATE POLICY gis_update_policy ON gis_features
FOR UPDATE
USING (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'regional_admin' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id IN (
            SELECT deo_id FROM deo WHERE region = current_user_region()
        )
    )) OR
    (current_user_role() = 'deo_user' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id = current_user_deo_id()
    ))
);

CREATE POLICY gis_delete_policy ON gis_features
FOR DELETE
USING (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'deo_user' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id = current_user_deo_id()
    ))
);

-- Media Assets RLS Policies (similar to GIS features)
CREATE POLICY media_select_policy ON media_assets
FOR SELECT
USING (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'regional_admin' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id IN (
            SELECT deo_id FROM deo WHERE region = current_user_region()
        )
    )) OR
    (current_user_role() = 'deo_user' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id = current_user_deo_id()
    )) OR
    current_user_role() = 'public'
);

CREATE POLICY media_insert_policy ON media_assets
FOR INSERT
WITH CHECK (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'deo_user' AND project_id IN (
        SELECT project_id FROM projects WHERE deo_id = current_user_deo_id()
    ))
);

CREATE POLICY media_delete_policy ON media_assets
FOR DELETE
USING (
    current_user_role() = 'super_admin' OR
    (current_user_role() = 'deo_user' AND uploaded_by = current_setting('app.user_id', true)::uuid)
);

-- Audit Logs RLS Policy (super_admin only)
CREATE POLICY audit_select_policy ON audit_logs
FOR SELECT
USING (current_user_role() = 'super_admin');

CREATE POLICY audit_insert_policy ON audit_logs
FOR INSERT
WITH CHECK (true);  -- Anyone can insert audit logs (API handles this)

-- =============================================================================
-- DATA VALIDATION TRIGGERS
-- =============================================================================

-- Validate project dates
CREATE OR REPLACE FUNCTION validate_project_dates()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.fund_year < 2010 OR NEW.fund_year > EXTRACT(YEAR FROM NOW()) + 2 THEN
        RAISE EXCEPTION 'Invalid fund_year: %. Must be between 2010 and current year + 2.', NEW.fund_year;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_project_dates
BEFORE INSERT OR UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION validate_project_dates();

-- Validate progress report dates
CREATE OR REPLACE FUNCTION validate_progress_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.report_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'report_date cannot be in the future: %', NEW.report_date;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_progress_date
BEFORE INSERT ON project_progress_logs
FOR EACH ROW
EXECUTE FUNCTION validate_progress_date();

-- =============================================================================
-- GEOFENCING VALIDATION
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_geofencing()
RETURNS TRIGGER AS $$
DECLARE
    v_boundary GEOMETRY;
    v_is_within BOOLEAN;
BEGIN
    -- Check if geometry is within BARMM region boundary (if exists)
    SELECT geometry INTO v_boundary
    FROM geofencing_rules
    WHERE rule_type = 'region_boundary'
      AND is_active = TRUE
      AND project_id IS NULL
    LIMIT 1;

    IF v_boundary IS NOT NULL THEN
        SELECT ST_Within(NEW.geometry, v_boundary) INTO v_is_within;

        IF NOT v_is_within THEN
            -- Create alert instead of blocking
            INSERT INTO alerts (
                project_id,
                alert_type,
                severity,
                message,
                metadata
            ) VALUES (
                NEW.project_id,
                'geofence_violation',
                'warning',
                'GIS feature is outside BARMM region boundary',
                jsonb_build_object(
                    'feature_id', NEW.feature_id,
                    'feature_type', NEW.feature_type
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_geofencing
AFTER INSERT OR UPDATE ON gis_features
FOR EACH ROW
EXECUTE FUNCTION validate_geofencing();

-- =============================================================================
-- CLEANUP FUNCTIONS
-- =============================================================================

-- Function to clean up expired blacklisted tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM token_blacklist
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old migration logs (keep last 100)
CREATE OR REPLACE FUNCTION cleanup_migration_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM migration_log
    WHERE id NOT IN (
        SELECT id FROM migration_log
        ORDER BY started_at DESC
        LIMIT 100
    );
END;
$$ LANGUAGE plpgsql;
