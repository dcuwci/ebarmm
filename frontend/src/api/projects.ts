/**
 * Projects API service
 */

import { apiClient } from './client'
import type {
  Project,
  ProjectListResponse,
  ProjectFilters,
  ProjectCreate,
  ProjectUpdate,
} from '../types/project'

/**
 * Fetch projects list with optional filters
 */
export async function fetchProjects(
  filters?: ProjectFilters
): Promise<ProjectListResponse> {
  const params = new URLSearchParams()

  if (filters?.deo_id) params.append('deo_id', filters.deo_id.toString())
  if (filters?.fund_year) params.append('fund_year', filters.fund_year.toString())
  if (filters?.status) params.append('status', filters.status)
  if (filters?.search) params.append('search', filters.search)
  if (filters?.limit) params.append('limit', filters.limit.toString())
  if (filters?.offset) params.append('offset', filters.offset.toString())

  const { data } = await apiClient.get<ProjectListResponse>(
    `/projects?${params.toString()}`
  )
  return data
}

/**
 * Fetch single project by ID
 */
export async function fetchProject(projectId: string): Promise<Project> {
  const { data } = await apiClient.get<Project>(`/projects/${projectId}`)
  return data
}

/**
 * Create new project
 */
export async function createProject(project: ProjectCreate): Promise<Project> {
  const { data } = await apiClient.post<Project>('/projects', project)
  return data
}

/**
 * Update existing project
 */
export async function updateProject(
  projectId: string,
  updates: ProjectUpdate
): Promise<Project> {
  const { data } = await apiClient.patch<Project>(`/projects/${projectId}`, updates)
  return data
}

/**
 * Delete project
 */
export async function deleteProject(projectId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}`)
}
