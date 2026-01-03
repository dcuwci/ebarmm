/**
 * Progress Logs API service
 */

import { apiClient } from './client'
import type {
  ProgressLog,
  ProgressLogCreate,
  ProgressLogListResponse,
} from '../types/progress'

/**
 * Fetch progress logs for a project
 */
export async function fetchProgressLogs(
  projectId: string
): Promise<ProgressLogListResponse> {
  const { data } = await apiClient.get<ProgressLogListResponse>(
    `/progress/${projectId}`
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
    `/progress/${projectId}`,
    log
  )
  return data
}

/**
 * Verify hash chain integrity for a project's progress logs
 */
export async function verifyHashChain(projectId: string): Promise<{
  is_valid: boolean
  broken_at?: number
}> {
  const { data } = await apiClient.get(`/progress/${projectId}/verify-hash-chain`)
  return data
}
