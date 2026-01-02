-- E-BARMM Seed Data
-- Initial data for system bootstrap

-- =============================================================================
-- DEO (District Engineering Offices)
-- =============================================================================

INSERT INTO deo (deo_id, deo_name, province, region) VALUES
(1, 'Cotabato City DEO', 'Cotabato City', 'BARMM'),
(2, 'Maguindanao DEO', 'Maguindanao', 'BARMM'),
(3, 'Lanao del Sur DEO', 'Lanao del Sur', 'BARMM'),
(4, 'Basilan DEO', 'Basilan', 'BARMM'),
(5, 'Sulu DEO', 'Sulu', 'BARMM'),
(6, 'Tawi-Tawi DEO', 'Tawi-Tawi', 'BARMM')
ON CONFLICT (deo_id) DO NOTHING;

-- =============================================================================
-- SYSTEM USERS
-- =============================================================================

-- System migration user (UUID: 00000000-0000-0000-0000-000000000001)
INSERT INTO users (user_id, username, password_hash, role, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'system_migration', '', 'super_admin', false)
ON CONFLICT (user_id) DO NOTHING;

-- Super Admin (default password: Admin@2026 - CHANGE THIS IN PRODUCTION!)
-- Password hash: bcrypt('Admin@2026')
INSERT INTO users (username, password_hash, role, is_active) VALUES
('admin', '$2b$12$PEoFlGjgqgJHqCjqDYzYceUE.Rm6P9PvFhxI4A6lH/N7Wz5Q1W70O', 'super_admin', true)
ON CONFLICT (username) DO NOTHING;

-- DEO Users (default password: Deo@2026 - CHANGE IN PRODUCTION!)
-- Password hash: bcrypt('Deo@2026')
INSERT INTO users (username, password_hash, role, deo_id, is_active) VALUES
('deo_user_1', '$2b$12$QRh.vx8Y6dDhKTj5kyljKequ9.JnO11eZmyQJKaggi0qY6aZCUxxm', 'deo_user', 1, true),
('deo_user_2', '$2b$12$QRh.vx8Y6dDhKTj5kyljKequ9.JnO11eZmyQJKaggi0qY6aZCUxxm', 'deo_user', 2, true),
('deo_user_3', '$2b$12$QRh.vx8Y6dDhKTj5kyljKequ9.JnO11eZmyQJKaggi0qY6aZCUxxm', 'deo_user', 3, true),
('deo_user_4', '$2b$12$QRh.vx8Y6dDhKTj5kyljKequ9.JnO11eZmyQJKaggi0qY6aZCUxxm', 'deo_user', 4, true),
('deo_user_5', '$2b$12$QRh.vx8Y6dDhKTj5kyljKequ9.JnO11eZmyQJKaggi0qY6aZCUxxm', 'deo_user', 5, true),
('deo_user_6', '$2b$12$QRh.vx8Y6dDhKTj5kyljKequ9.JnO11eZmyQJKaggi0qY6aZCUxxm', 'deo_user', 6, true)
ON CONFLICT (username) DO NOTHING;

-- Regional Admin (default password: Regional@2026)
INSERT INTO users (username, password_hash, role, region, is_active) VALUES
('regional_admin', '$2b$12$sojN3I6dtbRDUSGdlLlANut8yD6Y2WcUfpzSdK0VCvyMdosMCAk8y', 'regional_admin', 'BARMM', true)
ON CONFLICT (username) DO NOTHING;

-- =============================================================================
-- GEOFENCING RULES - BARMM BOUNDARY
-- =============================================================================

-- Simplified BARMM boundary (polygon covering general area)
-- In production, use actual BARMM boundary shapefile
INSERT INTO geofencing_rules (
    rule_type,
    geometry,
    attributes,
    is_active,
    created_by
) VALUES (
    'region_boundary',
    ST_GeomFromText('POLYGON((
        124.0 5.5,
        125.5 5.5,
        125.5 7.5,
        124.0 7.5,
        124.0 5.5
    ))', 4326),
    jsonb_build_object(
        'name', 'BARMM Region Boundary',
        'description', 'Approximate boundary for geofencing validation'
    ),
    true,
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SAMPLE PROJECT (for testing)
-- =============================================================================

DO $$
DECLARE
    v_project_id UUID;
    v_deo_user_id UUID;
    v_progress_id UUID;
    v_record_hash TEXT;
BEGIN
    -- Get DEO user ID
    SELECT user_id INTO v_deo_user_id
    FROM users
    WHERE username = 'deo_user_1'
    LIMIT 1;

    -- Create sample project
    INSERT INTO projects (
        project_id,
        deo_id,
        project_title,
        location,
        fund_source,
        mode_of_implementation,
        project_cost,
        project_scale,
        fund_year,
        status,
        created_by
    ) VALUES (
        gen_random_uuid(),
        1,
        'Sample Road Construction - Cotabato City',
        'Barangay Rosary Heights, Cotabato City',
        'GAA',
        'Contract',
        5000000.00,
        'Municipal',
        2026,
        'ongoing',
        v_deo_user_id
    )
    RETURNING project_id INTO v_project_id;

    -- Add initial progress log
    v_record_hash := encode(
        digest(
            v_project_id::text || '25.5' || CURRENT_DATE::text || v_deo_user_id::text || '',
            'sha256'
        ),
        'hex'
    );

    INSERT INTO project_progress_logs (
        progress_id,
        project_id,
        reported_percent,
        report_date,
        remarks,
        reported_by,
        prev_hash,
        record_hash
    ) VALUES (
        gen_random_uuid(),
        v_project_id,
        25.5,
        CURRENT_DATE,
        'Foundation work completed, ready for steel reinforcement',
        v_deo_user_id,
        NULL,
        v_record_hash
    );

    -- Add sample GIS feature (road segment)
    INSERT INTO gis_features (
        project_id,
        feature_type,
        geometry,
        attributes,
        created_by
    ) VALUES (
        v_project_id,
        'road',
        ST_GeomFromText('LINESTRING(124.25 7.22, 124.26 7.23, 124.27 7.24)', 4326),
        jsonb_build_object(
            'road_name', 'Rosary Heights Road',
            'length_km', 2.5,
            'surface_type', 'asphalt',
            'lanes', 2
        ),
        v_deo_user_id
    );

    RAISE NOTICE 'Sample project created with ID: %', v_project_id;
END $$;

-- =============================================================================
-- HELPER VIEWS
-- =============================================================================

-- View: Current project progress (latest from logs)
CREATE OR REPLACE VIEW v_project_current_progress AS
SELECT DISTINCT ON (p.project_id)
    p.project_id,
    p.project_title,
    p.deo_id,
    d.deo_name,
    p.status,
    p.fund_year,
    p.project_cost,
    ppl.reported_percent AS current_progress,
    ppl.report_date AS last_updated,
    ppl.remarks AS latest_remarks
FROM projects p
LEFT JOIN deo d ON p.deo_id = d.deo_id
LEFT JOIN project_progress_logs ppl ON p.project_id = ppl.project_id
ORDER BY p.project_id, ppl.created_at DESC;

-- View: Project statistics by DEO
CREATE OR REPLACE VIEW v_deo_statistics AS
SELECT
    d.deo_id,
    d.deo_name,
    d.province,
    COUNT(p.project_id) AS total_projects,
    COUNT(CASE WHEN p.status = 'ongoing' THEN 1 END) AS ongoing_projects,
    COUNT(CASE WHEN p.status = 'completed' THEN 1 END) AS completed_projects,
    COALESCE(SUM(p.project_cost), 0) AS total_cost,
    COALESCE(AVG(pcp.current_progress), 0) AS avg_progress
FROM deo d
LEFT JOIN projects p ON d.deo_id = p.deo_id
LEFT JOIN v_project_current_progress pcp ON p.project_id = pcp.project_id
GROUP BY d.deo_id, d.deo_name, d.province;

-- View: Media count by project
CREATE OR REPLACE VIEW v_project_media_count AS
SELECT
    p.project_id,
    p.project_title,
    COUNT(CASE WHEN m.media_type = 'photo' THEN 1 END) AS photo_count,
    COUNT(CASE WHEN m.media_type = 'video' THEN 1 END) AS video_count,
    COUNT(CASE WHEN m.media_type = 'document' THEN 1 END) AS document_count,
    COUNT(m.media_id) AS total_media
FROM projects p
LEFT JOIN media_assets m ON p.project_id = m.project_id
GROUP BY p.project_id, p.project_title;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant necessary permissions to application user
-- (Run this after creating the database user: ebarmm_app)

-- GRANT USAGE ON SCHEMA public TO ebarmm_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ebarmm_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ebarmm_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ebarmm_app;

-- =============================================================================
-- NOTES
-- =============================================================================

COMMENT ON VIEW v_project_current_progress IS 'Materialized view of current project progress from latest log entry';
COMMENT ON VIEW v_deo_statistics IS 'Aggregated statistics per DEO';
COMMENT ON VIEW v_project_media_count IS 'Media asset counts per project';

-- WARNING: Default passwords in this seed file are for development only!
-- ALWAYS change passwords in production environments!
