import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'
import type { User } from './authStore'

const mockUser: User = {
  user_id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'deo_user',
  deo_id: 1,
  is_active: true,
  mfa_enabled: false,
}

const mockSuperAdmin: User = {
  user_id: 'admin-123',
  username: 'admin',
  email: 'admin@example.com',
  role: 'super_admin',
  is_active: true,
  mfa_enabled: true,
}

describe('authStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      mfaPending: false,
      mfaSessionToken: null,
    })
  })

  describe('login', () => {
    it('should set user and token on login', () => {
      const { login } = useAuthStore.getState()

      login('test-token', mockUser)

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe('test-token')
      expect(state.user).toEqual(mockUser)
      expect(state.mfaPending).toBe(false)
    })

    it('should set refresh token when provided', () => {
      const { login } = useAuthStore.getState()

      login('test-token', mockUser, 'refresh-token-123')

      const state = useAuthStore.getState()
      expect(state.refreshToken).toBe('refresh-token-123')
    })

    it('should clear MFA pending state on login', () => {
      // Set MFA pending state first
      useAuthStore.setState({
        mfaPending: true,
        mfaSessionToken: 'mfa-session-123',
      })

      const { login } = useAuthStore.getState()
      login('test-token', mockUser)

      const state = useAuthStore.getState()
      expect(state.mfaPending).toBe(false)
      expect(state.mfaSessionToken).toBeNull()
    })
  })

  describe('logout', () => {
    it('should clear all auth state on logout', () => {
      // Login first
      useAuthStore.getState().login('test-token', mockUser, 'refresh-token')

      // Then logout
      useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.token).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.user).toBeNull()
      expect(state.mfaPending).toBe(false)
      expect(state.mfaSessionToken).toBeNull()
    })
  })

  describe('MFA flow', () => {
    it('should set MFA pending state', () => {
      const { setMfaPending } = useAuthStore.getState()

      setMfaPending('mfa-session-token-456')

      const state = useAuthStore.getState()
      expect(state.mfaPending).toBe(true)
      expect(state.mfaSessionToken).toBe('mfa-session-token-456')
      expect(state.isAuthenticated).toBe(false)
      expect(state.token).toBeNull()
    })

    it('should complete MFA and authenticate user', () => {
      // Start MFA flow
      useAuthStore.getState().setMfaPending('mfa-session-token')

      // Complete MFA
      useAuthStore.getState().completeMfa('final-token', mockSuperAdmin, 'refresh-123')

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe('final-token')
      expect(state.user).toEqual(mockSuperAdmin)
      expect(state.mfaPending).toBe(false)
      expect(state.mfaSessionToken).toBeNull()
    })

    it('should clear MFA pending state without completing auth', () => {
      useAuthStore.getState().setMfaPending('mfa-session-token')
      useAuthStore.getState().clearMfaPending()

      const state = useAuthStore.getState()
      expect(state.mfaPending).toBe(false)
      expect(state.mfaSessionToken).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('updateUser', () => {
    it('should update user fields while preserving others', () => {
      useAuthStore.getState().login('token', mockUser)

      useAuthStore.getState().updateUser({
        first_name: 'John',
        last_name: 'Doe',
      })

      const state = useAuthStore.getState()
      expect(state.user?.first_name).toBe('John')
      expect(state.user?.last_name).toBe('Doe')
      expect(state.user?.username).toBe('testuser') // preserved
      expect(state.user?.role).toBe('deo_user') // preserved
    })

    it('should not update if no user is logged in', () => {
      useAuthStore.getState().updateUser({ first_name: 'John' })

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
    })
  })

  describe('setToken', () => {
    it('should update token while keeping existing refresh token', () => {
      useAuthStore.getState().login('old-token', mockUser, 'existing-refresh')

      useAuthStore.getState().setToken('new-token')

      const state = useAuthStore.getState()
      expect(state.token).toBe('new-token')
      expect(state.refreshToken).toBe('existing-refresh')
    })

    it('should update both tokens when refresh token is provided', () => {
      useAuthStore.getState().login('old-token', mockUser, 'old-refresh')

      useAuthStore.getState().setToken('new-token', 'new-refresh')

      const state = useAuthStore.getState()
      expect(state.token).toBe('new-token')
      expect(state.refreshToken).toBe('new-refresh')
    })
  })

  describe('role checks', () => {
    it('should correctly identify super_admin role', () => {
      useAuthStore.getState().login('token', mockSuperAdmin)

      const state = useAuthStore.getState()
      expect(state.user?.role).toBe('super_admin')
    })

    it('should correctly identify deo_user role with deo_id', () => {
      useAuthStore.getState().login('token', mockUser)

      const state = useAuthStore.getState()
      expect(state.user?.role).toBe('deo_user')
      expect(state.user?.deo_id).toBe(1)
    })
  })
})
