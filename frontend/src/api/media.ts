/**
 * Media Assets API service
 * Matches backend endpoints: /media/*
 */

import { apiClient } from './client'
import axios from 'axios'
import type {
  MediaAsset,
  MediaType,
  MediaUploadRequest,
  MediaUploadResponse,
  GeotaggedMedia,
} from '../types/media'

/**
 * Fetch media assets for a project
 */
export async function fetchProjectMedia(
  projectId: string,
  mediaType?: MediaType,
  limit = 50
): Promise<MediaAsset[]> {
  const params: Record<string, unknown> = { limit }
  if (mediaType) {
    params.media_type = mediaType
  }
  const { data } = await apiClient.get<MediaAsset[]>(
    `/media/projects/${projectId}/media`,
    { params }
  )
  return data
}

/**
 * Request upload URL for media file
 */
export async function requestUploadUrl(
  request: MediaUploadRequest
): Promise<MediaUploadResponse> {
  const { data } = await apiClient.post<MediaUploadResponse>(
    '/media/upload-url',
    request
  )
  return data
}

/**
 * Upload file to S3 using pre-signed URL
 */
export async function uploadToS3(
  presignedUrl: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  await axios.put(presignedUrl, file, {
    headers: {
      'Content-Type': file.type,
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
        onProgress(percentCompleted)
      }
    },
  })
}

/**
 * Confirm upload was successful
 */
export async function confirmUpload(mediaId: string): Promise<MediaAsset> {
  const { data } = await apiClient.post<MediaAsset>(`/media/${mediaId}/confirm`)
  return data
}

/**
 * Get single media asset
 */
export async function fetchMediaAsset(mediaId: string): Promise<MediaAsset> {
  const { data } = await apiClient.get<MediaAsset>(`/media/${mediaId}`)
  return data
}

/**
 * Delete media asset
 */
export async function deleteMedia(mediaId: string): Promise<void> {
  await apiClient.delete(`/media/${mediaId}`)
}

/**
 * Fetch geotagged photos for map display
 */
export async function fetchGeotaggedMedia(
  projectId?: string,
  limit = 100
): Promise<GeotaggedMedia[]> {
  const params: Record<string, unknown> = { limit }
  if (projectId) {
    params.project_id = projectId
  }
  const { data } = await apiClient.get<GeotaggedMedia[]>('/media/geotagged', { params })
  return data
}

/**
 * Helper to get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2)
}

/**
 * Helper to determine media type from file MIME type
 */
export function getMediaTypeFromMime(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'photo'
  if (mimeType.startsWith('video/')) return 'video'
  return 'document'
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return 'Unknown size'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}
