/**
 * Group Management API Service
 */

import apiClient from './client'
import { Group } from '../stores/permissionStore'

export interface GroupListParams {
  skip?: number
  limit?: number
  search?: string
  is_active?: boolean
}

export interface GroupListResponse {
  total: number
  items: Group[]
}

export interface GroupCreateData {
  name: string
  description?: string
  is_active?: boolean
}

export interface GroupUpdateData {
  name?: string
  description?: string
  is_active?: boolean
}

export interface GroupMember {
  user_id: string
  username: string
  email?: string
  first_name?: string
  last_name?: string
  role: string
  joined_at: string
}

// List groups
export const listGroups = async (params: GroupListParams = {}): Promise<GroupListResponse> => {
  const response = await apiClient.get('/groups', { params })
  return response.data
}

// Get a single group
export const getGroup = async (groupId: string): Promise<Group> => {
  const response = await apiClient.get(`/groups/${groupId}`)
  return response.data
}

// Create a group
export const createGroup = async (data: GroupCreateData): Promise<Group> => {
  const response = await apiClient.post('/groups', data)
  return response.data
}

// Update a group
export const updateGroup = async (groupId: string, data: GroupUpdateData): Promise<Group> => {
  const response = await apiClient.put(`/groups/${groupId}`, data)
  return response.data
}

// Delete a group
export const deleteGroup = async (groupId: string): Promise<void> => {
  await apiClient.delete(`/groups/${groupId}`)
}

// List group members
export const listGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
  const response = await apiClient.get(`/groups/${groupId}/members`)
  return response.data
}

// Add member to group
export const addGroupMember = async (groupId: string, userId: string): Promise<GroupMember> => {
  const response = await apiClient.post(`/groups/${groupId}/members`, { user_id: userId })
  return response.data
}

// Remove member from group
export const removeGroupMember = async (groupId: string, userId: string): Promise<void> => {
  await apiClient.delete(`/groups/${groupId}/members/${userId}`)
}
