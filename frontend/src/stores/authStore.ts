/**
 * Authentication Store
 * Zustand store for user authentication state with MFA and refresh token support
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  user_id: string
  username: string
  email?: string
  role: 'public' | 'deo_user' | 'regional_admin' | 'super_admin'
  deo_id?: number
  region?: string
  is_active: boolean
  first_name?: string
  last_name?: string
  phone_number?: string
  mfa_enabled: boolean
  created_at?: string
  updated_at?: string
  last_login?: string
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean

  // MFA state
  mfaPending: boolean
  mfaSessionToken: string | null

  // Actions
  login: (token: string, user: User, refreshToken?: string) => void
  setMfaPending: (mfaSessionToken: string) => void
  completeMfa: (token: string, user: User, refreshToken?: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  setToken: (token: string, refreshToken?: string) => void
  clearMfaPending: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      mfaPending: false,
      mfaSessionToken: null,

      login: (token: string, user: User, refreshToken?: string) => {
        set({
          token,
          refreshToken: refreshToken || null,
          user,
          isAuthenticated: true,
          mfaPending: false,
          mfaSessionToken: null,
        })
      },

      setMfaPending: (mfaSessionToken: string) => {
        set({
          mfaPending: true,
          mfaSessionToken,
          isAuthenticated: false,
          token: null,
          refreshToken: null,
          user: null,
        })
      },

      completeMfa: (token: string, user: User, refreshToken?: string) => {
        set({
          token,
          refreshToken: refreshToken || null,
          user,
          isAuthenticated: true,
          mfaPending: false,
          mfaSessionToken: null,
        })
      },

      logout: () => {
        set({
          token: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
          mfaPending: false,
          mfaSessionToken: null,
        })
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } })
        }
      },

      setToken: (token: string, refreshToken?: string) => {
        set({
          token,
          refreshToken: refreshToken || get().refreshToken,
        })
      },

      clearMfaPending: () => {
        set({
          mfaPending: false,
          mfaSessionToken: null,
        })
      },
    }),
    {
      name: 'ebarmm-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Don't persist MFA pending state
      }),
    }
  )
)
