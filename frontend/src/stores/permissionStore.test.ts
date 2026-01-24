/**
 * Permission Store Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePermissionStore } from './permissionStore'

// Mock the API client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
  },
}))

import apiClient from '../api/client'

const mockPermissions = {
  projects: {
    create: true,
    read: true,
    update: true,
    delete: false,
  },
  users: {
    create: false,
    read: true,
    update: false,
    delete: false,
  },
  reports: {
    create: true,
    read: true,
    update: false,
    delete: false,
  },
}

const mockGroups = [
  {
    id: 'group-1',
    name: 'DEO Users',
    description: 'Department Extension Office Users',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    member_count: 10,
  },
]

describe('permissionStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    usePermissionStore.setState({
      permissions: {},
      groups: [],
      isLoading: false,
      isLoaded: false,
      error: null,
    })
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty permissions initially', () => {
      const state = usePermissionStore.getState()

      expect(state.permissions).toEqual({})
      expect(state.groups).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.isLoaded).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('fetchPermissions', () => {
    it('should fetch and store permissions successfully', async () => {
      const mockResponse = {
        data: {
          permissions: mockPermissions,
          groups: mockGroups,
        },
      }
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

      await usePermissionStore.getState().fetchPermissions('user-123')

      const state = usePermissionStore.getState()
      expect(state.permissions).toEqual(mockPermissions)
      expect(state.groups).toEqual(mockGroups)
      expect(state.isLoading).toBe(false)
      expect(state.isLoaded).toBe(true)
      expect(state.error).toBeNull()
    })

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(apiClient.get).mockReturnValue(promise as any)

      const fetchPromise = usePermissionStore.getState().fetchPermissions('user-123')

      // Check loading state
      expect(usePermissionStore.getState().isLoading).toBe(true)

      // Resolve the promise
      resolvePromise!({
        data: { permissions: mockPermissions, groups: mockGroups },
      })

      await fetchPromise

      // Check final state
      expect(usePermissionStore.getState().isLoading).toBe(false)
    })

    it('should handle fetch errors', async () => {
      const errorMessage = 'Access denied'
      vi.mocked(apiClient.get).mockRejectedValue({
        response: { data: { detail: errorMessage } },
      })

      await usePermissionStore.getState().fetchPermissions('user-123')

      const state = usePermissionStore.getState()
      expect(state.error).toBe(errorMessage)
      expect(state.isLoading).toBe(false)
      expect(state.isLoaded).toBe(false)
    })

    it('should handle network errors without response', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'))

      await usePermissionStore.getState().fetchPermissions('user-123')

      const state = usePermissionStore.getState()
      expect(state.error).toBe('Failed to load permissions')
    })

    it('should call correct API endpoint', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { permissions: {}, groups: [] },
      })

      await usePermissionStore.getState().fetchPermissions('test-user-id')

      expect(apiClient.get).toHaveBeenCalledWith('/users/test-user-id/permissions')
    })
  })

  describe('hasPermission', () => {
    beforeEach(() => {
      usePermissionStore.setState({ permissions: mockPermissions })
    })

    it('should return true for granted permissions', () => {
      const { hasPermission } = usePermissionStore.getState()

      expect(hasPermission('projects', 'create')).toBe(true)
      expect(hasPermission('projects', 'read')).toBe(true)
      expect(hasPermission('projects', 'update')).toBe(true)
      expect(hasPermission('users', 'read')).toBe(true)
    })

    it('should return false for denied permissions', () => {
      const { hasPermission } = usePermissionStore.getState()

      expect(hasPermission('projects', 'delete')).toBe(false)
      expect(hasPermission('users', 'create')).toBe(false)
      expect(hasPermission('users', 'update')).toBe(false)
      expect(hasPermission('users', 'delete')).toBe(false)
    })

    it('should return false for unknown resources', () => {
      const { hasPermission } = usePermissionStore.getState()

      expect(hasPermission('unknown', 'read')).toBe(false)
      expect(hasPermission('settings', 'update')).toBe(false)
    })

    it('should return false for unknown actions', () => {
      const { hasPermission } = usePermissionStore.getState()

      expect(hasPermission('projects', 'execute')).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    beforeEach(() => {
      usePermissionStore.setState({ permissions: mockPermissions })
    })

    it('should return true if any permission is granted', () => {
      const { hasAnyPermission } = usePermissionStore.getState()

      const result = hasAnyPermission([
        { resource: 'projects', action: 'delete' }, // false
        { resource: 'projects', action: 'create' }, // true
        { resource: 'users', action: 'delete' }, // false
      ])

      expect(result).toBe(true)
    })

    it('should return false if no permissions are granted', () => {
      const { hasAnyPermission } = usePermissionStore.getState()

      const result = hasAnyPermission([
        { resource: 'projects', action: 'delete' },
        { resource: 'users', action: 'create' },
        { resource: 'users', action: 'delete' },
      ])

      expect(result).toBe(false)
    })

    it('should return false for empty array', () => {
      const { hasAnyPermission } = usePermissionStore.getState()

      expect(hasAnyPermission([])).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    beforeEach(() => {
      usePermissionStore.setState({ permissions: mockPermissions })
    })

    it('should return true if all permissions are granted', () => {
      const { hasAllPermissions } = usePermissionStore.getState()

      const result = hasAllPermissions([
        { resource: 'projects', action: 'create' },
        { resource: 'projects', action: 'read' },
        { resource: 'projects', action: 'update' },
      ])

      expect(result).toBe(true)
    })

    it('should return false if any permission is denied', () => {
      const { hasAllPermissions } = usePermissionStore.getState()

      const result = hasAllPermissions([
        { resource: 'projects', action: 'create' },
        { resource: 'projects', action: 'delete' }, // false
      ])

      expect(result).toBe(false)
    })

    it('should return true for empty array', () => {
      const { hasAllPermissions } = usePermissionStore.getState()

      expect(hasAllPermissions([])).toBe(true)
    })
  })

  describe('clearPermissions', () => {
    it('should reset all permission state', () => {
      // Set some state
      usePermissionStore.setState({
        permissions: mockPermissions,
        groups: mockGroups,
        isLoading: false,
        isLoaded: true,
        error: 'Some error',
      })

      // Clear
      usePermissionStore.getState().clearPermissions()

      const state = usePermissionStore.getState()
      expect(state.permissions).toEqual({})
      expect(state.groups).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.isLoaded).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('groups', () => {
    it('should store groups from fetch response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          permissions: {},
          groups: mockGroups,
        },
      })

      await usePermissionStore.getState().fetchPermissions('user-123')

      const state = usePermissionStore.getState()
      expect(state.groups).toHaveLength(1)
      expect(state.groups[0].name).toBe('DEO Users')
      expect(state.groups[0].member_count).toBe(10)
    })
  })
})
