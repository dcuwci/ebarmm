/**
 * Authentication API Service
 * Login, MFA, and token management
 */

import apiClient from './client'
import { User } from '../stores/authStore'

export interface LoginResponse {
  access_token?: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  user?: User
  mfa_required: boolean
  mfa_session_token?: string
}

export interface MFASetupResponse {
  secret: string
  qr_code: string
  backup_codes: string[]
  issuer: string
}

export interface MFAStatusResponse {
  mfa_enabled: boolean
  backup_codes_remaining: number
}

// Login with username/password
export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const formData = new URLSearchParams()
  formData.append('username', username)
  formData.append('password', password)

  const response = await apiClient.post('/auth/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  return response.data
}

// Verify MFA code during login
export const verifyMfa = async (code: string, mfaSessionToken: string): Promise<LoginResponse> => {
  const response = await apiClient.post('/auth/mfa/verify', {
    code,
    mfa_session_token: mfaSessionToken,
  })
  return response.data
}

// Logout
export const logout = async (): Promise<void> => {
  await apiClient.post('/auth/logout')
}

// Get current user info
export const getCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get('/auth/me')
  return response.data
}

// Refresh access token using refresh token
export const refreshToken = async (refreshToken: string): Promise<LoginResponse> => {
  const response = await apiClient.post('/auth/token/refresh', {
    refresh_token: refreshToken,
  })
  return response.data
}

// Setup MFA - get QR code and backup codes
export const setupMfa = async (): Promise<MFASetupResponse> => {
  const response = await apiClient.post('/auth/mfa/setup')
  return response.data
}

// Verify MFA setup with first code
export const verifyMfaSetup = async (code: string): Promise<MFAStatusResponse> => {
  const response = await apiClient.post('/auth/mfa/verify-setup', { code })
  return response.data
}

// Disable MFA
export const disableMfa = async (code: string): Promise<MFAStatusResponse> => {
  const response = await apiClient.post('/auth/mfa/disable', { code })
  return response.data
}

// Get MFA status
export const getMfaStatus = async (): Promise<MFAStatusResponse> => {
  const response = await apiClient.get('/auth/mfa/status')
  return response.data
}

// Regenerate backup codes
export const regenerateBackupCodes = async (code: string): Promise<MFASetupResponse> => {
  const response = await apiClient.post('/auth/mfa/backup-codes/regenerate', { code })
  return response.data
}
