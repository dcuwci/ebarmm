/**
 * Public API service
 * Read-only endpoints for transparency portal (no authentication required)
 */

import { apiClient } from './client'
import type { PublicProjectDetail, PublicStats, PublicProject } from '../types/project'
import type { MediaAsset, MediaType } from '../types/media'
import type { GeoJSONFeatureCollection } from '../types/gis'

export interface PublicProjectsResponse {
  total: number
  limit: number
  offset: number
  items: PublicProject[]
}

export interface PublicProjectFilters {
  deo_id?: number
  fund_year?: number
  status?: string
  search?: string
  province?: string
  fund_source?: string
  mode_of_implementation?: string
  project_scale?: string
  limit?: number
  offset?: number
}

/**
 * Fetch public projects list with optional filters
 */
export async function fetchPublicProjects(
  filters?: PublicProjectFilters
): Promise<PublicProjectsResponse> {
  const params = new URLSearchParams()

  if (filters?.deo_id) params.append('deo_id', filters.deo_id.toString())
  if (filters?.fund_year) params.append('fund_year', filters.fund_year.toString())
  if (filters?.status) params.append('status', filters.status)
  if (filters?.search) params.append('search', filters.search)
  if (filters?.province) params.append('province', filters.province)
  if (filters?.fund_source) params.append('fund_source', filters.fund_source)
  if (filters?.mode_of_implementation) params.append('mode_of_implementation', filters.mode_of_implementation)
  if (filters?.project_scale) params.append('project_scale', filters.project_scale)
  if (filters?.limit) params.append('limit', filters.limit.toString())
  if (filters?.offset) params.append('offset', filters.offset.toString())

  const { data } = await apiClient.get<PublicProjectsResponse>(
    `/public/projects?${params.toString()}`
  )
  return data
}

/**
 * Fetch single public project details
 */
export async function fetchPublicProject(projectId: string): Promise<PublicProjectDetail> {
  const { data } = await apiClient.get<PublicProjectDetail>(`/public/projects/${projectId}`)
  return data
}

/**
 * Fetch public statistics for dashboard
 */
export async function fetchPublicStats(): Promise<PublicStats> {
  const { data } = await apiClient.get<PublicStats>('/public/stats')
  return data
}

/**
 * Fetch all public projects for export (no pagination)
 */
export async function fetchAllPublicProjects(
  filters?: Omit<PublicProjectFilters, 'limit' | 'offset'>
): Promise<PublicProject[]> {
  const params = new URLSearchParams()
  params.append('limit', '200') // Backend max is 200

  if (filters?.deo_id) params.append('deo_id', filters.deo_id.toString())
  if (filters?.fund_year) params.append('fund_year', filters.fund_year.toString())
  if (filters?.status) params.append('status', filters.status)
  if (filters?.search) params.append('search', filters.search)
  if (filters?.province) params.append('province', filters.province)
  if (filters?.fund_source) params.append('fund_source', filters.fund_source)
  if (filters?.mode_of_implementation) params.append('mode_of_implementation', filters.mode_of_implementation)
  if (filters?.project_scale) params.append('project_scale', filters.project_scale)

  const { data } = await apiClient.get<PublicProjectsResponse>(
    `/public/projects?${params.toString()}`
  )
  return data.items
}

export interface PublicMediaResponse {
  items: MediaAsset[]
  total: number
}

/**
 * Fetch public media assets for a project (no authentication required)
 */
export async function fetchPublicProjectMedia(
  projectId: string,
  mediaType?: MediaType,
  limit = 50
): Promise<MediaAsset[]> {
  const params: Record<string, unknown> = { limit }
  if (mediaType) {
    params.media_type = mediaType
  }
  const { data } = await apiClient.get<PublicMediaResponse>(
    `/public/projects/${projectId}/media`,
    { params }
  )
  return data.items
}

/**
 * Get public media file URL (proxied through backend, no auth required)
 */
export function getPublicMediaFileUrl(mediaId: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  return `${baseUrl}/public/media/${mediaId}/file`
}

export interface PublicGeotaggedMedia {
  media_id: string
  project_id: string
  project_title: string
  latitude: number
  longitude: number
  thumbnail_url: string
  filename?: string
}

/**
 * Fetch geotagged photos for public map display (no authentication required)
 */
export async function fetchPublicGeotaggedMedia(
  projectId?: string,
  limit = 100
): Promise<PublicGeotaggedMedia[]> {
  const params: Record<string, unknown> = { limit }
  if (projectId) {
    params.project_id = projectId
  }
  const { data } = await apiClient.get<PublicGeotaggedMedia[]>('/public/geotagged-media', { params })

  // Convert relative thumbnail URLs to absolute URLs
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  return data.map(item => ({
    ...item,
    thumbnail_url: item.thumbnail_url.startsWith('/')
      ? `${baseUrl.replace('/api/v1', '')}${item.thumbnail_url}`
      : item.thumbnail_url
  }))
}

/**
 * Fetch GIS features for a project (public, no authentication required)
 */
export async function fetchPublicGISFeatures(
  projectId: string
): Promise<GeoJSONFeatureCollection> {
  const { data } = await apiClient.get<GeoJSONFeatureCollection>('/public/map', {
    params: { project_id: projectId }
  })
  return data
}
