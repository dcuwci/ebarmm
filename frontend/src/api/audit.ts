/**
 * Audit Logs API Service
 */

import apiClient from './client'

export interface AuditLog {
  audit_id: string
  actor_id: string | null
  actor_username: string | null
  action: string
  entity_type: string
  entity_id: string | null
  payload: Record<string, unknown> | null
  created_at: string
  ip_address: string | null
  user_agent: string | null
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

export interface ActionStats {
  start_date: string | null
  end_date: string | null
  total_logs: number
  by_action: Record<string, number>
}

export interface UserActivityStats {
  start_date: string | null
  end_date: string | null
  users: Array<{
    user_id: string
    username: string
    role: string
    action_count: number
  }>
}

// List audit logs
export const listAuditLogs = async (params: AuditLogListParams = {}): Promise<AuditLogListResponse> => {
  const response = await apiClient.get('/audit/logs', { params })
  return response.data
}

// Get single audit log
export const getAuditLog = async (auditId: string): Promise<AuditLog> => {
  const response = await apiClient.get(`/audit/logs/${auditId}`)
  return response.data
}

// Get action statistics
export const getActionStats = async (startDate?: string, endDate?: string): Promise<ActionStats> => {
  const response = await apiClient.get('/audit/stats/actions', {
    params: { start_date: startDate, end_date: endDate },
  })
  return response.data
}

// Get user activity statistics
export const getUserActivityStats = async (
  startDate?: string,
  endDate?: string,
  limit?: number
): Promise<UserActivityStats> => {
  const response = await apiClient.get('/audit/stats/users', {
    params: { start_date: startDate, end_date: endDate, limit },
  })
  return response.data
}

// Get entity history
export const getEntityHistory = async (
  entityType: string,
  entityId: string
): Promise<{
  entity_type: string
  entity_id: string
  total_changes: number
  history: Array<{
    audit_id: string
    action: string
    actor_username: string | null
    payload: Record<string, unknown> | null
    created_at: string
  }>
}> => {
  const response = await apiClient.get(`/audit/entity/${entityType}/${entityId}/history`)
  return response.data
}

// Export audit logs
export const exportAuditLogs = async (
  startDate?: string,
  endDate?: string,
  format: 'json' | 'csv' = 'json'
) => {
  const response = await apiClient.get('/audit/export', {
    params: { start_date: startDate, end_date: endDate, format },
    responseType: format === 'csv' ? 'blob' : 'json',
  })
  return response.data
}
