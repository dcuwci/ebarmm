/**
 * Progress Log types - matching backend schemas
 */

export interface ProgressLog {
  progress_id: string
  project_id: string
  reported_percent: number
  report_date: string
  remarks?: string
  reported_by: string
  reporter_name?: string
  created_at: string
  prev_hash?: string | null
  record_hash: string
  hash_valid?: boolean
}

export interface ProgressLogCreate {
  reported_percent: number
  report_date: string
  remarks?: string
}

export interface ProgressVerification {
  project_id: string
  total_logs: number
  chain_valid: boolean
  broken_links: Array<{
    index: number
    expected_hash: string
    actual_hash: string
  }>
}

export interface LatestProgress {
  project_id: string
  current_progress: number
  last_updated: string | null
  remarks: string | null
  reported_by?: string
}
