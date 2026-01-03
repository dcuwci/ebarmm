/**
 * GIS Features API service
 */

import { apiClient } from './client'
import type {
  GISFeature,
  GISFeatureCreate,
  GISFeatureUpdate,
  GISFeatureListResponse,
} from '../types/gis'

/**
 * Fetch GIS features for a project
 */
export async function fetchGISFeatures(
  projectId: string
): Promise<GISFeatureListResponse> {
  const { data } = await apiClient.get<GISFeatureListResponse>(
    `/gis/${projectId}/features`
  )
  return data
}

/**
 * Create new GIS feature
 */
export async function createGISFeature(
  projectId: string,
  feature: GISFeatureCreate
): Promise<GISFeature> {
  const { data } = await apiClient.post<GISFeature>(
    `/gis/${projectId}/features`,
    feature
  )
  return data
}

/**
 * Update GIS feature
 */
export async function updateGISFeature(
  projectId: string,
  featureId: number,
  updates: GISFeatureUpdate
): Promise<GISFeature> {
  const { data } = await apiClient.put<GISFeature>(
    `/gis/${projectId}/features/${featureId}`,
    updates
  )
  return data
}

/**
 * Delete GIS feature
 */
export async function deleteGISFeature(
  projectId: string,
  featureId: number
): Promise<void> {
  await apiClient.delete(`/gis/${projectId}/features/${featureId}`)
}

/**
 * Get vector tiles (for MapLibre GL)
 */
export function getVectorTileUrl(z: number, x: number, y: number): string {
  return `/gis/tiles/${z}/${x}/${y}`
}
