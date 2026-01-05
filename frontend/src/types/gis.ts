/**
 * GIS Feature types
 */

// Geometry types (from GeoJSON)
export type GeometryType = 'Point' | 'LineString' | 'Polygon'

// Infrastructure feature types (backend enum)
export type FeatureType = 'road' | 'bridge' | 'drainage' | 'facility' | 'building' | 'other'

export interface GISFeature {
  feature_id: string // UUID
  project_id: string
  feature_type: FeatureType
  geometry: GeoJSON.Geometry
  attributes: Record<string, unknown>
  created_at: string
  created_by: string
  updated_at: string
}

export interface GISFeatureCreate {
  feature_type: FeatureType
  geometry: GeoJSON.Geometry
  attributes?: Record<string, unknown>
}

export interface GISFeatureUpdate {
  geometry?: GeoJSON.Geometry
  attributes?: Record<string, unknown>
}

export interface GISFeatureListResponse {
  total: number
  items: GISFeature[]
}

// GeoJSON FeatureCollection from backend
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    id: string
    geometry: GeoJSON.Geometry
    properties: {
      feature_type: FeatureType
      project_id: string
      attributes: Record<string, unknown>
      created_at: string
      created_by?: string
      updated_at?: string
    }
  }>
}

// Coordinate type for easier handling
export interface Coordinate {
  lat: number
  lng: number
}

// List response type
export interface GISFeatureListResponse {
  total: number
  items: GISFeature[]
}

// Map geometry type to feature type
export function geometryTypeToFeatureType(geomType: GeometryType): FeatureType {
  switch (geomType) {
    case 'Point':
      return 'facility'
    case 'LineString':
      return 'road'
    case 'Polygon':
      return 'building'
    default:
      return 'other'
  }
}
