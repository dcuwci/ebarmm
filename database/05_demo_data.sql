-- E-BARMM Demo/Test Data
-- Generated from development database on 2026-01-25
-- This file contains sample projects, GIS features, and media assets for testing

-- =============================================================================
-- DISABLE TRIGGERS DURING IMPORT
-- =============================================================================
SET session_replication_role = replica;

-- =============================================================================
-- PROJECTS
-- =============================================================================

INSERT INTO projects (project_id, deo_id, project_title, location, fund_source, mode_of_implementation, project_cost, project_scale, fund_year, status, created_at, created_by, updated_at) VALUES
('6a1b64fc-4e18-4c48-9d45-d56cc0586e09', 1, 'Sample Road Construction - Cotabato City', 'Barangay Rosary Heights, Cotabato City', 'GAA', 'Contract', 5000000.00, 'Municipal', 2026, 'ongoing', '2026-01-05 03:33:25.490005', '473708ff-b560-4f13-a091-f3998ddfd1a2', '2026-01-05 03:33:25.490005'),
('ef4746e0-af00-4d29-8cb0-628070f3f109', 1, 'Road Improvement Project - Lanao', 'Lanao', 'BTA', 'Contract', 1000000.00, 'Small', 2024, 'planning', '2026-01-23 01:26:53.03306', '473708ff-b560-4f13-a091-f3998ddfd1a2', '2026-01-24 17:23:48.662628'),
('f918a7a0-e736-46ee-966f-30a6a235016b', 2, 'Infrastructure Development - Maguindanao', 'Maguindanao', 'LGU', 'Negotiated', 1000000.00, 'Large', 2023, 'planning', '2026-01-24 17:24:42.826142', '593e33f6-60a1-4480-9451-c62d92b7cecb', '2026-01-24 17:24:42.83461'),
('d4c41dae-4ec1-46de-999a-5c085f734d6d', 6, 'Road Network - Parang', 'Parang', 'PPP', 'Contract', 2000000.00, 'Medium', 2022, 'planning', '2026-01-24 18:24:20.462378', 'f10855fc-66e2-46be-8443-5ba7cfe3b676', '2026-01-24 18:24:20.469882')
ON CONFLICT (project_id) DO NOTHING;

-- =============================================================================
-- GIS FEATURES (with readable WKT geometry)
-- =============================================================================

-- Project: Sample Road Construction - Cotabato City
INSERT INTO gis_features (feature_id, project_id, feature_type, geometry, attributes, created_by, created_at, updated_at) VALUES
('a4d7613f-16f3-493f-9679-cb51385476ff', '6a1b64fc-4e18-4c48-9d45-d56cc0586e09', 'road',
  ST_GeomFromText('LINESTRING(124.251766204834 7.221437855502078, 124.25640106201173 7.229313567589832, 124.26176548004152 7.230847216226001, 124.26434040069581 7.238340669621676)', 4326),
  '{"lanes": 2, "length_km": 2.5, "road_name": "Rosary Heights Road", "surface_type": "asphalt"}'::jsonb,
  '473708ff-b560-4f13-a091-f3998ddfd1a2', '2026-01-05 03:33:25.490005', '2026-01-23 01:25:34.625669')
ON CONFLICT (feature_id) DO NOTHING;

-- Project: Road Improvement Project - Lanao (multiple road segments)
INSERT INTO gis_features (feature_id, project_id, feature_type, geometry, attributes, created_by, created_at, updated_at) VALUES
('06743fd2-13d9-4579-adbb-2df9fc81758d', 'ef4746e0-af00-4d29-8cb0-628070f3f109', 'road',
  ST_GeomFromText('LINESTRING(120.94679588544182 6.007332481048342, 120.94555084514006 6.005561536745026, 120.94280343473066 6.002062451485825, 120.93896462014146 5.997781199586218, 120.93497195593078 5.99436813483084)', 4326),
  '{}'::jsonb, '473708ff-b560-4f13-a091-f3998ddfd1a2', '2026-01-23 08:49:34.481987', '2026-01-23 08:49:34.496062'),
('99b04ca8-046d-4c1e-8bad-b2499ae3c6ab', 'ef4746e0-af00-4d29-8cb0-628070f3f109', 'road',
  ST_GeomFromText('LINESTRING(120.94789787788746 6.009686684633441, 120.94884239121981 6.012972503625368, 120.9514783207932 6.015013771863074, 120.95310552562239 6.016764949231428, 120.95412239619793 6.0180946900748)', 4326),
  '{}'::jsonb, '473708ff-b560-4f13-a091-f3998ddfd1a2', '2026-01-23 08:59:03.532391', '2026-01-23 08:59:03.538058'),
('7252c1be-a553-4321-b4a7-4dffdbca5e65', 'ef4746e0-af00-4d29-8cb0-628070f3f109', 'road',
  ST_GeomFromText('LINESTRING(120.93742052174692 6.010712492552032, 120.93888022416974 6.009261607858921, 120.9414991020459 6.01002972376651, 120.94428970961889 6.007938739032665)', 4326),
  '{}'::jsonb, '473708ff-b560-4f13-a091-f3998ddfd1a2', '2026-01-23 09:04:17.151274', '2026-01-23 09:04:17.158528'),
('560cbbc7-dfbf-4450-b6fa-1f8e42b09467', 'ef4746e0-af00-4d29-8cb0-628070f3f109', 'road',
  ST_GeomFromText('LINESTRING(120.94351692598326 6.019076340619359, 120.94351692598326 6.016601337757467, 120.94351692598326 6.01284613948464, 120.94433264204304 6.010968530625721, 120.94566354719326 6.009859031436294)', 4326),
  '{}'::jsonb, '473708ff-b560-4f13-a091-f3998ddfd1a2', '2026-01-23 09:13:23.830273', '2026-01-23 09:13:23.836845'),
('5b534699-1fdd-4e9c-8f43-6b1598ea2538', 'ef4746e0-af00-4d29-8cb0-628070f3f109', 'road',
  ST_GeomFromText('LINESTRING(120.94845415476621 6.005421082329249, 120.950557843552 6.004012857084598, 120.95343431597338 6.004012857084598, 120.95665424778834 6.004012857084598, 120.95914432839193 6.004012857084598, 120.96081869293569 6.004012857084598, 120.96253598990367 6.004012857084598, 120.96412448959906 6.004866327364468)', 4326),
  '{}'::jsonb, '473708ff-b560-4f13-a091-f3998ddfd1a2', '2026-01-23 09:24:00.392206', '2026-01-23 09:24:00.408404')
ON CONFLICT (feature_id) DO NOTHING;

-- Project: Infrastructure Development - Maguindanao
INSERT INTO gis_features (feature_id, project_id, feature_type, geometry, attributes, created_by, created_at, updated_at) VALUES
('e4972a2c-9041-491b-8a66-a7fa529df48c', 'f918a7a0-e736-46ee-966f-30a6a235016b', 'road',
  ST_GeomFromText('LINESTRING(124.1847324371338 7.102415594064001, 124.18460369110109 7.099776366358102, 124.18468952178956 7.097690514393848, 124.18576240539552 7.095221534543205, 124.18735027313234 7.09334850651202, 124.18846607208253 7.091645747144426)', 4326),
  '{}'::jsonb, 'f10855fc-66e2-46be-8443-5ba7cfe3b676', '2026-01-25 08:15:57.064363', '2026-01-25 08:15:57.067249'),
('8d069381-8041-40c4-ace7-13bffcc08734', 'f918a7a0-e736-46ee-966f-30a6a235016b', 'road',
  ST_GeomFromText('LINESTRING(124.180312157 7.087220611, 124.18636322 7.089178802, 124.188508987 7.089519356, 124.193744659 7.09041331, 124.198937416 7.091775522, 124.202756882 7.090243033, 124.208335876 7.091732953, 124.211769104 7.091690384)', 4326),
  '{}'::jsonb, 'f10855fc-66e2-46be-8443-5ba7cfe3b676', '2026-01-25 08:12:19.157565', '2026-01-25 08:16:16.727798'),
('186d37c8-cead-4084-9b7f-bbc350bd5ec0', 'f918a7a0-e736-46ee-966f-30a6a235016b', 'road',
  ST_GeomFromText('LINESTRING(124.20052528381349 7.1052226331073, 124.19657707214357 7.101391514536251, 124.19408798217775 7.097986049013662, 124.19254302978517 7.095517070748513, 124.19142723083498 7.093048079239838)', 4326),
  '{}'::jsonb, 'f10855fc-66e2-46be-8443-5ba7cfe3b676', '2026-01-25 08:20:17.213154', '2026-01-25 08:20:17.215708')
ON CONFLICT (feature_id) DO NOTHING;

-- Project: Road Network - Parang
INSERT INTO gis_features (feature_id, project_id, feature_type, geometry, attributes, created_by, created_at, updated_at) VALUES
('3d07dfe3-250a-44ed-9c59-050082072c61', 'd4c41dae-4ec1-46de-999a-5c085f734d6d', 'road',
  ST_GeomFromText('LINESTRING(124.25640106201173 7.411634134558462, 124.25743103027344 7.398531982608289, 124.25897598266603 7.391895679248314, 124.26515579223634 7.385769772250087, 124.26876068115236 7.377942100876512)', 4326),
  '{}'::jsonb, 'f10855fc-66e2-46be-8443-5ba7cfe3b676', '2026-01-25 08:20:35.609113', '2026-01-25 08:20:35.612217'),
('866e2923-c32b-428d-a026-f2c73730d74c', 'd4c41dae-4ec1-46de-999a-5c085f734d6d', 'road',
  ST_GeomFromText('LINESTRING(124.29880142211915 7.412142444446277, 124.29416656494142 7.401422543262973, 124.28455352783205 7.387979759330991, 124.27803039550781 7.384576457989953, 124.27476882934572 7.381513464381837)', 4326),
  '{}'::jsonb, 'f10855fc-66e2-46be-8443-5ba7cfe3b676', '2026-01-25 08:20:44.524769', '2026-01-25 08:20:44.528226'),
('78f50657-5f5b-4b23-b9bd-75c77d329d37', 'd4c41dae-4ec1-46de-999a-5c085f734d6d', 'road',
  ST_GeomFromText('LINESTRING(124.328670501709 7.380669743313807, 124.31579589843751 7.378117227567106, 124.30892944335939 7.376245373327476, 124.2982864379883 7.377947059327063, 124.29227828979494 7.380329408731863, 124.2850685119629 7.377606722650647, 124.28129196166994 7.371310446934853, 124.27803039550781 7.368417533481841)', 4326),
  '{}'::jsonb, 'f10855fc-66e2-46be-8443-5ba7cfe3b676', '2026-01-25 08:20:55.584334', '2026-01-25 08:20:55.588768')
ON CONFLICT (feature_id) DO NOTHING;

-- =============================================================================
-- MEDIA ASSETS
-- Note: These reference files in MinIO storage. Files must be restored separately.
-- =============================================================================

INSERT INTO media_assets (media_id, project_id, media_type, storage_key, latitude, longitude, captured_at, uploaded_by, uploaded_at, attributes, file_size, mime_type) VALUES
('d6720604-5d5e-4a96-839d-6f6de9d8eb08', 'ef4746e0-af00-4d29-8cb0-628070f3f109', 'photo',
  'photos/ef4746e0-af00-4d29-8cb0-628070f3f109/d6720604-5d5e-4a96-839d-6f6de9d8eb08.jpg',
  6.0035111, 120.9436826, NULL, '473708ff-b560-4f13-a091-f3998ddfd1a2', '2026-01-23 08:30:02.865744',
  '{"status": "confirmed", "filename": "geophoto.285996.Sta. 500_29042022_102413.jpg", "confirmed_at": "2026-01-23T08:30:03.107491", "content_type": "image/jpeg"}'::jsonb,
  4228346, 'image/jpeg'),
('36f65f97-1658-4915-9a78-04cef5e0a576', 'ef4746e0-af00-4d29-8cb0-628070f3f109', 'photo',
  'photos/ef4746e0-af00-4d29-8cb0-628070f3f109/36f65f97-1658-4915-9a78-04cef5e0a576.jpg',
  6.0061682, 120.9455423, NULL, '473708ff-b560-4f13-a091-f3998ddfd1a2', '2026-01-23 08:30:02.811015',
  '{"status": "confirmed", "filename": "geophoto.285966.29042022_101733.jpg", "confirmed_at": "2026-01-23T08:30:03.037147", "content_type": "image/jpeg"}'::jsonb,
  3723509, 'image/jpeg')
ON CONFLICT (media_id) DO NOTHING;

-- =============================================================================
-- PROJECT PROGRESS LOGS
-- =============================================================================

INSERT INTO project_progress_logs (progress_id, project_id, reported_percent, report_date, remarks, reported_by, created_at, prev_hash, record_hash) VALUES
('df6073ad-a154-422d-9777-724ac9dfab5f', '6a1b64fc-4e18-4c48-9d45-d56cc0586e09', 25.50, '2026-01-05',
  'Foundation work completed, ready for steel reinforcement', '473708ff-b560-4f13-a091-f3998ddfd1a2',
  '2026-01-05 03:33:25.490005', NULL, '6f877691e0dee76ce257b9f4489900eba790ac764e4ba27390d44deb5895abba'),
('dcfd67f1-11f1-4ab1-b6fb-41d97815ad03', 'ef4746e0-af00-4d29-8cb0-628070f3f109', 0.00, '2026-01-23',
  '', '473708ff-b560-4f13-a091-f3998ddfd1a2',
  '2026-01-23 10:17:10.604814', NULL, '4f984e789bd918575a34913e6e1f7c32062411ceb4d0ef48a13fd7b147070bbb')
ON CONFLICT (progress_id) DO NOTHING;

-- =============================================================================
-- RE-ENABLE TRIGGERS
-- =============================================================================
SET session_replication_role = DEFAULT;

-- =============================================================================
-- NOTES
-- =============================================================================
--
-- To load this demo data:
--   1. Ensure base seed data (03_seed_data.sql) is loaded first
--   2. Run: psql -U ebarmm_app -d ebarmm -f 05_demo_data.sql
--
-- For media files:
--   - Media assets reference files stored in MinIO
--   - To restore media, copy files to MinIO bucket 'ebarmm-media'
--   - Or re-upload photos through the application
--
-- User IDs referenced:
--   - 473708ff-b560-4f13-a091-f3998ddfd1a2 (admin or deo_user_1)
--   - 593e33f6-60a1-4480-9451-c62d92b7cecb (deo_user)
--   - f10855fc-66e2-46be-8443-5ba7cfe3b676 (deo_user)
--
