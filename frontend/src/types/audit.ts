/**
 * Audit Log types - matching backend schemas
 */

export interface AuditLog {
  audit_id: string
  actor_id: string | null
  actor_name?: string | null
  action: string
  entity_type: string
  entity_id: string | null
  payload?: Record<string, unknown> | null
  ip_address?: string | null
  user_agent?: string | null
  created_at: string
}

export interface AuditLogListParams {
  actor_id?: string
  action?: string
  entity_type?: string
  entity_id?: string
  start_date?: string
  end_date?: string
  search?: string
  limit?: number
  offset?: number
}

export interface AuditLogListResponse {
  total: number
  limit: number
  offset: number
  items: AuditLog[]
}

export interface EntityHistory {
  entity_type: string
  entity_id: string
  total_changes: number
  history: Array<{
    audit_id: string
    action: string
    actor_name: string | null
    payload: Record<string, unknown> | null
    created_at: string
  }>
}
