/**
 * Progress Logs API service
 * Matches backend endpoints: /progress/projects/{project_id}/progress
 */

import { apiClient } from './client'
import type {
  ProgressLog,
  ProgressLogCreate,
  ProgressVerification,
  LatestProgress,
} from '../types/progress'

/**
 * Fetch progress logs for a project
 */
export async function fetchProgressLogs(projectId: string): Promise<ProgressLog[]> {
  const { data } = await apiClient.get<ProgressLog[]>(
    `/progress/projects/${projectId}/progress`
  )
  return data
}

/**
 * Create new progress log
 */
export async function createProgressLog(
  projectId: string,
  log: ProgressLogCreate
): Promise<ProgressLog> {
  const { data } = await apiClient.post<ProgressLog>(
    `/progress/projects/${projectId}/progress`,
    log
  )
  return data
}

/**
 * Verify hash chain integrity for a project's progress logs
 */
export async function verifyProgressChain(projectId: string): Promise<ProgressVerification> {
  const { data } = await apiClient.get<ProgressVerification>(
    `/progress/projects/${projectId}/progress/verify`
  )
  return data
}

/**
 * Get latest progress for a project
 */
export async function fetchLatestProgress(projectId: string): Promise<LatestProgress> {
  const { data } = await apiClient.get<LatestProgress>(
    `/progress/projects/${projectId}/progress/latest`
  )
  return data
}
