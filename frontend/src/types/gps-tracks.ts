/**
 * GPS Track types for RouteShoot - matching backend schemas
 */

export interface GpsWaypoint {
  latitude: number
  longitude: number
  altitude?: number | null
  timestamp: number // Unix timestamp in milliseconds
  video_offset_ms?: number | null // Offset from video start for sync
}

export interface GpsTrack {
  track_id: string
  project_id: string
  media_id?: string | null
  track_name: string
  waypoints: GpsWaypoint[]
  waypoint_count: number
  total_distance_meters?: number | null
  start_time: string
  end_time?: string | null
  kml_storage_key?: string | null
  video_url?: string | null
  created_by: string
  created_at: string
}

export interface GpsTrackCreateRequest {
  project_id: string
  media_id?: string
  track_name: string
  waypoints: GpsWaypoint[]
  start_time: string
  end_time?: string
  total_distance_meters?: number
  kml_storage_key?: string
}
