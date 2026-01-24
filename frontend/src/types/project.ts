/**
 * Project-related TypeScript types
 * Matches backend Pydantic schemas
 */

export interface Project {
  project_id: string
  deo_id: number
  deo_name?: string
  project_title: string
  location?: string
  fund_source?: string
  mode_of_implementation?: string
  project_cost: number
  project_scale?: string
  fund_year: number
  status: ProjectStatus
  created_at: string
  created_by: string
  updated_at: string
  current_progress?: number
}

export type ProjectStatus =
  | 'planning'
  | 'ongoing'
  | 'completed'
  | 'suspended'
  | 'cancelled'
  | 'deleted'

export interface ProjectListResponse {
  total: number
  items: Project[]
}

export interface ProjectFilters {
  deo_id?: number
  fund_year?: number
  status?: ProjectStatus
  search?: string
  limit?: number
  offset?: number
}

export interface ProjectCreate {
  deo_id?: number
  project_title: string
  location?: string
  fund_source?: string
  mode_of_implementation?: string
  project_cost: number
  project_scale?: string
  fund_year: number
  status?: ProjectStatus
}

export interface ProjectUpdate {
  project_title?: string
  location?: string
  status?: ProjectStatus
  project_cost?: number
}

/**
 * Public project list item (from /public/projects endpoint)
 */
export interface PublicProject {
  project_id: string
  project_title: string
  location: string | null
  fund_source: string | null
  project_cost: number
  fund_year: number
  status: string
  deo_name: string
  current_progress: number
  last_updated: string | null
  geometry_wkt?: string | null
}

/**
 * Public project detail (from /public/projects/{id} endpoint)
 */
export interface PublicProjectDetail {
  project_id: string
  project_title: string
  location: string | null
  fund_source: string | null
  mode_of_implementation: string | null
  project_cost: number
  project_scale: string | null
  fund_year: number
  status: string
  deo_name: string | null
  current_progress: number
  last_updated: string | null
  progress_history: PublicProgressEntry[]
  media_counts: Record<string, number>
  gis_feature_count: number
  created_at: string
}

/**
 * Progress entry in public project detail
 */
export interface PublicProgressEntry {
  report_date: string
  reported_percent: number
  remarks: string | null
}

/**
 * Public statistics (from /public/stats endpoint)
 */
export interface PublicStats {
  total_projects: number
  total_cost: number
  by_province: Record<string, number>
  by_status: Record<string, number>
  avg_completion: number
}
