/**
 * Media Asset types - matching backend schemas
 */

export type MediaType = 'photo' | 'video' | 'document'

export interface MediaAsset {
  media_id: string
  project_id: string
  media_type: MediaType
  storage_key: string
  download_url?: string | null
  latitude?: number | null
  longitude?: number | null
  captured_at?: string | null
  uploaded_by: string
  uploaded_at: string
  attributes?: Record<string, unknown> | null
  file_size?: number | null
  mime_type?: string | null
}

export interface MediaUploadRequest {
  project_id: string
  media_type: MediaType
  filename: string
  content_type: string
  latitude?: number
  longitude?: number
}

export interface MediaUploadResponse {
  upload_url: string
  storage_key: string
  media_id: string
  expires_in: number
}
