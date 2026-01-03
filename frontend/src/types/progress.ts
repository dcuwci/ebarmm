/**
 * Progress Log types
 */

export interface ProgressLog {
  progress_id: number
  project_id: string
  reported_percent: number
  report_date: string
  remarks?: string
  reported_by: string
  created_at: string
  previous_hash?: string
  current_hash: string
  is_hash_valid: boolean
}

export interface ProgressLogCreate {
  reported_percent: number
  report_date: string
  remarks?: string
}

export interface ProgressLogListResponse {
  total: number
  items: ProgressLog[]
}
