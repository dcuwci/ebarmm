/**
 * GIS Features API service
 */

import { apiClient } from './client'
import type {
  GISFeature,
  GISFeatureCreate,
  GISFeatureUpdate,
  GISFeatureListResponse,
  GeoJSONFeatureCollection,
} from '../types/gis'

/**
 * Transform GeoJSON FeatureCollection to our list response format
 */
function transformFeatureCollection(
  collection: GeoJSONFeatureCollection
): GISFeatureListResponse {
  return {
    total: collection.features.length,
    items: collection.features.map((f) => ({
      feature_id: f.id,
      project_id: f.properties.project_id,
      feature_type: f.properties.feature_type,
      geometry: f.geometry,
      attributes: f.properties.attributes || {},
      created_at: f.properties.created_at,
      created_by: f.properties.created_by || '',
      updated_at: f.properties.updated_at || '',
    })),
  }
}

/**
 * Fetch GIS features for a project
 */
export async function fetchGISFeatures(
  projectId: string
): Promise<GISFeatureListResponse> {
  const { data } = await apiClient.get<GeoJSONFeatureCollection>(
    `/gis/features`,
    { params: { project_id: projectId } }
  )
  return transformFeatureCollection(data)
}

/**
 * Create new GIS feature
 */
export async function createGISFeature(
  projectId: string,
  feature: GISFeatureCreate
): Promise<GISFeature> {
  const { data } = await apiClient.post<GISFeature>(`/gis/features`, {
    project_id: projectId,
    feature_type: feature.feature_type,
    geometry: feature.geometry,
    attributes: feature.attributes || {},
  })
  return data
}

/**
 * Update GIS feature (uses PATCH)
 */
export async function updateGISFeature(
  _projectId: string,
  featureId: string,
  updates: GISFeatureUpdate
): Promise<GISFeature> {
  const { data } = await apiClient.patch<GISFeature>(
    `/gis/features/${featureId}`,
    {
      geometry: updates.geometry,
      attributes: updates.attributes,
    }
  )
  return data
}

/**
 * Delete GIS feature
 */
export async function deleteGISFeature(
  _projectId: string,
  featureId: string
): Promise<void> {
  await apiClient.delete(`/gis/features/${featureId}`)
}

/**
 * Get vector tiles (for MapLibre GL)
 */
export function getVectorTileUrl(z: number, x: number, y: number): string {
  return `/gis/tiles/${z}/${x}/${y}`
}
