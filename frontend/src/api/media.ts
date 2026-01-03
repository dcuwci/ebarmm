/**
 * Media Assets API service
 */

import { apiClient } from './client'
import axios from 'axios'
import type {
  MediaUploadResponse,
  MediaListResponse,
  MediaType,
} from '../types/media'

/**
 * Fetch media assets for a project
 */
export async function fetchMedia(projectId: string): Promise<MediaListResponse> {
  const { data } = await apiClient.get<MediaListResponse>(`/media/${projectId}`)
  return data
}

/**
 * Request upload URL for media file
 */
export async function requestUploadUrl(
  projectId: string,
  fileName: string,
  mediaType: MediaType,
  gpsLatitude?: number,
  gpsLongitude?: number,
  caption?: string
): Promise<MediaUploadResponse> {
  const { data } = await apiClient.post<MediaUploadResponse>(
    `/media/${projectId}/upload-url`,
    {
      file_name: fileName,
      media_type: mediaType,
      gps_latitude: gpsLatitude,
      gps_longitude: gpsLongitude,
      caption,
    }
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
 * Delete media asset
 */
export async function deleteMedia(
  projectId: string,
  mediaId: number
): Promise<void> {
  await apiClient.delete(`/media/${projectId}/${mediaId}`)
}
