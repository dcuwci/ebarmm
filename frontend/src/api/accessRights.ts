/**
 * Access Rights API Service
 */

import apiClient from './client'

export interface AccessRight {
  id: string
  resource: string
  permissions: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
  group_id: string
  group_name?: string
  created_at: string
  updated_at: string
}

export interface AccessRightListParams {
  skip?: number
  limit?: number
  resource?: string
  group_id?: string
}

export interface AccessRightListResponse {
  total: number
  items: AccessRight[]
}

export interface AccessRightCreateData {
  resource: string
  permissions: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
  group_id: string
}

export interface AccessRightUpdateData {
  permissions: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
}

// List access rights
export const listAccessRights = async (params: AccessRightListParams = {}): Promise<AccessRightListResponse> => {
  const response = await apiClient.get('/access-rights', { params })
  return response.data
}

// Get available resources
export const listResources = async (): Promise<string[]> => {
  const response = await apiClient.get('/access-rights/resources')
  return response.data
}

// Get a single access right
export const getAccessRight = async (id: string): Promise<AccessRight> => {
  const response = await apiClient.get(`/access-rights/${id}`)
  return response.data
}

// Create an access right
export const createAccessRight = async (data: AccessRightCreateData): Promise<AccessRight> => {
  const response = await apiClient.post('/access-rights', data)
  return response.data
}

// Update an access right
export const updateAccessRight = async (id: string, data: AccessRightUpdateData): Promise<AccessRight> => {
  const response = await apiClient.put(`/access-rights/${id}`, data)
  return response.data
}

// Delete an access right
export const deleteAccessRight = async (id: string): Promise<void> => {
  await apiClient.delete(`/access-rights/${id}`)
}

// Check permission for current user
export const checkPermission = async (resource: string, action: string): Promise<{ allowed: boolean }> => {
  const response = await apiClient.get(`/access-rights/check/${resource}/${action}`)
  return response.data
}
