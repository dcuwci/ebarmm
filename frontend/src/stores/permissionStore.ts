/**
 * Permission Store
 * Zustand store for user permissions with group-based access control
 */

import { create } from 'zustand'
import apiClient from '../api/client'

export interface Group {
  id: string
  name: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  member_count: number
}

export interface Permissions {
  [resource: string]: {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
  }
}

interface PermissionState {
  permissions: Permissions
  groups: Group[]
  isLoading: boolean
  isLoaded: boolean
  error: string | null

  // Actions
  fetchPermissions: (userId: string) => Promise<void>
  hasPermission: (resource: string, action: string) => boolean
  hasAnyPermission: (checks: Array<{ resource: string; action: string }>) => boolean
  hasAllPermissions: (checks: Array<{ resource: string; action: string }>) => boolean
  clearPermissions: () => void
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: {},
  groups: [],
  isLoading: false,
  isLoaded: false,
  error: null,

  fetchPermissions: async (userId: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await apiClient.get(`/users/${userId}/permissions`)
      set({
        permissions: response.data.permissions,
        groups: response.data.groups,
        isLoading: false,
        isLoaded: true,
      })
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to load permissions',
      })
    }
  },

  hasPermission: (resource: string, action: string) => {
    const { permissions } = get()
    const resourcePerms = permissions[resource]
    if (!resourcePerms) return false
    return resourcePerms[action as keyof typeof resourcePerms] || false
  },

  hasAnyPermission: (checks: Array<{ resource: string; action: string }>) => {
    const { hasPermission } = get()
    return checks.some(({ resource, action }) => hasPermission(resource, action))
  },

  hasAllPermissions: (checks: Array<{ resource: string; action: string }>) => {
    const { hasPermission } = get()
    return checks.every(({ resource, action }) => hasPermission(resource, action))
  },

  clearPermissions: () => {
    set({
      permissions: {},
      groups: [],
      isLoading: false,
      isLoaded: false,
      error: null,
    })
  },
}))
