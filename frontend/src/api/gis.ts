/**
 * GIS Features API service
 * Matches backend endpoints: /gis/*
 */

import { apiClient } from './client'
import type {
  GISFeature,
  GISFeatureCreate,
  GISFeatureUpdate,
  GISFeatureListResponse,
  GeoJSONFeatureCollection,
  FeatureType,
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
      feature_id: f.id || '',
      project_id: f.properties.project_id as string,
      feature_type: f.properties.feature_type as FeatureType,
      geometry: f.geometry,
      attributes: (f.properties.attributes as Record<string, unknown>) || {},
      created_at: f.properties.created_at as string,
      created_by: (f.properties.created_by as string) || '',
      updated_at: (f.properties.updated_at as string) || '',
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
    '/gis/features',
    { params: { project_id: projectId } }
  )
  return transformFeatureCollection(data)
}

/**
 * Fetch GIS features as raw GeoJSON
 */
export async function fetchGISFeaturesGeoJSON(
  projectId: string
): Promise<GeoJSONFeatureCollection> {
  const { data } = await apiClient.get<GeoJSONFeatureCollection>(
    '/gis/features',
    { params: { project_id: projectId } }
  )
  return data
}

/**
 * Get single GIS feature
 */
export async function fetchGISFeature(featureId: string): Promise<GISFeature> {
  const { data } = await apiClient.get<GISFeature>(`/gis/features/${featureId}`)
  return data
}

/**
 * Create new GIS feature
 */
export async function createGISFeature(
  projectId: string,
  feature: GISFeatureCreate
): Promise<GISFeature> {
  const { data } = await apiClient.post<GISFeature>('/gis/features', {
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
  featureId: string,
  updates: GISFeatureUpdate
): Promise<GISFeature> {
  const { data } = await apiClient.patch<GISFeature>(
    `/gis/features/${featureId}`,
    updates
  )
  return data
}

/**
 * Delete GIS feature
 */
export async function deleteGISFeature(featureId: string): Promise<void> {
  await apiClient.delete(`/gis/features/${featureId}`)
}

/**
 * Get vector tile URL for MapLibre GL
 */
export function getVectorTileUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL || '/api/v1'
  return `${baseUrl}/gis/tiles/{z}/{x}/{y}.mvt`
}

/**
 * Feature type display names
 */
export const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  road: 'Road',
  bridge: 'Bridge',
  drainage: 'Drainage',
  facility: 'Facility',
  building: 'Building',
  other: 'Other',
}

/**
 * Feature type colors for map styling
 */
export const FEATURE_TYPE_COLORS: Record<FeatureType, string> = {
  road: '#4A5568',
  bridge: '#E53E3E',
  drainage: '#3182CE',
  facility: '#38A169',
  building: '#805AD5',
  other: '#718096',
}
