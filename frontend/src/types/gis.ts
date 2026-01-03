/**
 * GIS Feature types
 */

export type GeometryType = 'Point' | 'LineString' | 'Polygon'

export interface GISFeature {
  feature_id: number
  project_id: string
  feature_type: GeometryType
  geometry: GeoJSON.Geometry
  properties: Record<string, any>
  created_at: string
  created_by: string
  updated_at: string
}

export interface GISFeatureCreate {
  feature_type: GeometryType
  geometry: GeoJSON.Geometry
  properties?: Record<string, any>
}

export interface GISFeatureUpdate {
  geometry?: GeoJSON.Geometry
  properties?: Record<string, any>
}

export interface GISFeatureListResponse {
  total: number
  items: GISFeature[]
}

// Coordinate type for easier handling
export interface Coordinate {
  lat: number
  lng: number
}
