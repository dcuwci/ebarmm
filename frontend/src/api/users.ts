/**
 * User Management API Service
 */

import apiClient from './client'
import { User } from '../stores/authStore'

export interface UserListParams {
  skip?: number
  limit?: number
  search?: string
  role?: string
  is_active?: boolean
  include_deleted?: boolean
}

export interface UserListResponse {
  total: number
  items: User[]
}

export interface UserCreateData {
  username: string
  email?: string
  password: string
  role: string
  deo_id?: number
  region?: string
  first_name?: string
  last_name?: string
  phone_number?: string
  group_ids?: string[]
}

export interface UserUpdateData {
  email?: string
  role?: string
  deo_id?: number
  region?: string
  is_active?: boolean
  first_name?: string
  last_name?: string
  phone_number?: string
}

export interface PasswordChangeData {
  current_password?: string
  new_password: string
}

// List users
export const listUsers = async (params: UserListParams = {}): Promise<UserListResponse> => {
  const response = await apiClient.get('/users', { params })
  return response.data
}

// Get a single user
export const getUser = async (userId: string): Promise<User> => {
  const response = await apiClient.get(`/users/${userId}`)
  return response.data
}

// Create a user
export const createUser = async (data: UserCreateData): Promise<User> => {
  const response = await apiClient.post('/users', data)
  return response.data
}

// Update a user
export const updateUser = async (userId: string, data: UserUpdateData): Promise<User> => {
  const response = await apiClient.put(`/users/${userId}`, data)
  return response.data
}

// Delete (soft) a user
export const deleteUser = async (userId: string): Promise<void> => {
  await apiClient.delete(`/users/${userId}`)
}

// Restore a deleted user
export const restoreUser = async (userId: string): Promise<User> => {
  const response = await apiClient.post(`/users/${userId}/restore`)
  return response.data
}

// Change password
export const changePassword = async (userId: string, data: PasswordChangeData): Promise<void> => {
  await apiClient.post(`/users/${userId}/change-password`, data)
}

// Reset MFA for a user
export const resetUserMfa = async (userId: string): Promise<void> => {
  await apiClient.post(`/users/${userId}/reset-mfa`)
}

// Get user's permissions
export const getUserPermissions = async (userId: string) => {
  const response = await apiClient.get(`/users/${userId}/permissions`)
  return response.data
}

// Get user's groups
export const getUserGroups = async (userId: string) => {
  const response = await apiClient.get(`/users/${userId}/groups`)
  return response.data
}
