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
