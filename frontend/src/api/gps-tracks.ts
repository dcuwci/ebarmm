/**
 * GPS Tracks API service
 * Matches backend endpoints: /gps-tracks/*
 */

import { apiClient } from './client'
import type { GpsTrack, GpsTrackCreateRequest } from '../types/gps-tracks'

/**
 * Fetch GPS tracks for a project
 */
export async function fetchProjectGpsTracks(
  projectId: string,
  limit = 50
): Promise<GpsTrack[]> {
  const { data } = await apiClient.get<GpsTrack[]>(
    `/gps-tracks/project/${projectId}`,
    { params: { limit } }
  )
  return data
}

/**
 * Get a single GPS track by ID
 */
export async function fetchGpsTrack(trackId: string): Promise<GpsTrack> {
  const { data } = await apiClient.get<GpsTrack>(`/gps-tracks/${trackId}`)
  return data
}

/**
 * Create a new GPS track
 */
export async function createGpsTrack(
  request: GpsTrackCreateRequest
): Promise<GpsTrack> {
  const { data } = await apiClient.post<GpsTrack>('/gps-tracks', request)
  return data
}

/**
 * Delete a GPS track
 */
export async function deleteGpsTrack(trackId: string): Promise<void> {
  await apiClient.delete(`/gps-tracks/${trackId}`)
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number | null | undefined): string {
  if (!meters) return 'Unknown'
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${Math.round(meters)} m`
}

/**
 * Format duration between two timestamps
 */
export function formatDuration(startTime: string, endTime?: string | null): string {
  if (!endTime) return 'In progress'
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  const durationMs = end - start

  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}
