/**
 * Media Asset types
 */

export interface MediaAsset {
  media_id: number
  project_id: string
  media_type: MediaType
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  gps_latitude?: number
  gps_longitude?: number
  caption?: string
  uploaded_by: string
  uploaded_at: string
}

export type MediaType = 'photo' | 'video' | 'document' | 'other'

export interface MediaUploadResponse {
  media_id: number
  presigned_url: string
  file_path: string
}

export interface MediaListResponse {
  total: number
  items: MediaAsset[]
}
