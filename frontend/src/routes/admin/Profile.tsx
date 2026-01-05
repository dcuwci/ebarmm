/**
 * User Profile Page
 * View/edit profile information, change password, manage MFA
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import {
  User,
  Shield,
  Key,
  Smartphone,
  Mail,
  Phone,
} from 'lucide-react'
import { Button, LoadingSpinner } from '../../components/mui'
import { useAuthStore } from '../../stores/authStore'
import { updateUser, changePassword } from '../../api/users'
import {
  getMfaStatus,
  disableMfa,
  regenerateBackupCodes,
} from '../../api/auth'
import MFASetupWizard from '../../components/auth/MFASetupWizard'

interface ProfileFormData {
  first_name: string
  last_name: string
  phone_number: string
  email: string
}

interface PasswordFormData {
  current_password: string
  new_password: string
  confirm_password: string
}

export default function Profile() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const updateUserStore = useAuthStore((state) => state.updateUser)

  // Form state
  const [profileData, setProfileData] = useState<ProfileFormData>({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone_number: user?.phone_number || '',
    email: user?.email || '',
  })
  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  // Dialog state
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false)
  const [mfaDisableOpen, setMfaDisableOpen] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [backupCodesOpen, setBackupCodesOpen] = useState(false)
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([])

  // Error/success state
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [mfaError, setMfaError] = useState('')

  // Fetch MFA status
  const { data: mfaStatus, isLoading: mfaLoading } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: getMfaStatus,
  })

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<ProfileFormData>) =>
      updateUser(user!.user_id, {
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number,
        email: data.email,
      }),
    onSuccess: (updatedUser) => {
      updateUserStore(updatedUser)
      setProfileSuccess('Profile updated successfully')
      setProfileError('')
      setTimeout(() => setProfileSuccess(''), 3000)
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setProfileError(error.response?.data?.detail || 'Failed to update profile')
      setProfileSuccess('')
    },
  })

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      changePassword(user!.user_id, {
        current_password: data.current_password,
        new_password: data.new_password,
      }),
    onSuccess: () => {
      setPasswordSuccess('Password changed successfully')
      setPasswordError('')
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
      setTimeout(() => setPasswordSuccess(''), 3000)
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setPasswordError(error.response?.data?.detail || 'Failed to change password')
      setPasswordSuccess('')
    },
  })

  // Disable MFA mutation
  const disableMfaMutation = useMutation({
    mutationFn: (code: string) => disableMfa(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
      updateUserStore({ mfa_enabled: false })
      setMfaDisableOpen(false)
      setDisableCode('')
      setMfaError('')
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setMfaError(error.response?.data?.detail || 'Failed to disable MFA')
    },
  })

  // Regenerate backup codes mutation
  const regenerateCodesMutation = useMutation({
    mutationFn: (code: string) => regenerateBackupCodes(code),
    onSuccess: (data) => {
      setNewBackupCodes(data.backup_codes)
      setBackupCodesOpen(true)
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setMfaError(error.response?.data?.detail || 'Failed to regenerate backup codes')
    },
  })

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate(profileData)
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('Passwords do not match')
      return
    }
    if (passwordData.new_password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    changePasswordMutation.mutate({
      current_password: passwordData.current_password,
      new_password: passwordData.new_password,
    })
  }

  const handleMfaSetupComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
    updateUserStore({ mfa_enabled: true })
    setMfaSetupOpen(false)
  }

  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <LoadingSpinner size="lg" />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          Profile
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Manage your account settings and security
        </Typography>
      </Box>

      {/* Profile Information */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={24} color="white" />
          </Box>
          <Box>
            <Typography variant="h6">{user.username}</Typography>
            <Chip label={user.role.replace('_', ' ').toUpperCase()} size="small" color="primary" />
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <form onSubmit={handleProfileSubmit}>
          {profileError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {profileError}
            </Alert>
          )}
          {profileSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {profileSuccess}
            </Alert>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
            <TextField
              label="First Name"
              value={profileData.first_name}
              onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
              InputProps={{
                startAdornment: <User size={18} style={{ marginRight: 8, color: '#9e9e9e' }} />,
              }}
            />
            <TextField
              label="Last Name"
              value={profileData.last_name}
              onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
            <TextField
              label="Email"
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
              InputProps={{
                startAdornment: <Mail size={18} style={{ marginRight: 8, color: '#9e9e9e' }} />,
              }}
            />
            <TextField
              label="Phone Number"
              value={profileData.phone_number}
              onChange={(e) => setProfileData({ ...profileData, phone_number: e.target.value })}
              InputProps={{
                startAdornment: <Phone size={18} style={{ marginRight: 8, color: '#9e9e9e' }} />,
              }}
            />
          </Box>

          <Button
            type="submit"
            variant="primary"
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Paper>

      {/* Change Password */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Key size={24} />
          <Typography variant="h6">Change Password</Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <form onSubmit={handlePasswordSubmit}>
          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}
          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {passwordSuccess}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <TextField
              label="Current Password"
              type="password"
              value={passwordData.current_password}
              onChange={(e) =>
                setPasswordData({ ...passwordData, current_password: e.target.value })
              }
              required
            />
            <TextField
              label="New Password"
              type="password"
              value={passwordData.new_password}
              onChange={(e) =>
                setPasswordData({ ...passwordData, new_password: e.target.value })
              }
              required
              helperText="Minimum 8 characters"
            />
            <TextField
              label="Confirm New Password"
              type="password"
              value={passwordData.confirm_password}
              onChange={(e) =>
                setPasswordData({ ...passwordData, confirm_password: e.target.value })
              }
              required
            />
          </Box>

          <Button
            type="submit"
            variant="primary"
            disabled={changePasswordMutation.isPending}
          >
            {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
          </Button>
        </form>
      </Paper>

      {/* MFA Settings */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Shield size={24} />
          <Typography variant="h6">Two-Factor Authentication</Typography>
          {mfaLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <Chip
              label={mfaStatus?.mfa_enabled ? 'Enabled' : 'Disabled'}
              color={mfaStatus?.mfa_enabled ? 'success' : 'default'}
              size="small"
            />
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {mfaError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {mfaError}
          </Alert>
        )}

        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Add an extra layer of security to your account by enabling two-factor authentication.
          You'll need to enter a code from your authenticator app each time you sign in.
        </Typography>

        {mfaStatus?.mfa_enabled ? (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="danger"
              startIcon={<Smartphone size={18} />}
              onClick={() => {
                // Prompt for code before regenerating
                const code = prompt('Enter your current MFA code to regenerate backup codes:')
                if (code) {
                  regenerateCodesMutation.mutate(code)
                }
              }}
              disabled={regenerateCodesMutation.isPending}
            >
              Regenerate Backup Codes
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setMfaDisableOpen(true)
                setMfaError('')
              }}
            >
              Disable MFA
            </Button>
          </Box>
        ) : (
          <Button
            variant="primary"
            startIcon={<Shield size={18} />}
            onClick={() => setMfaSetupOpen(true)}
          >
            Enable Two-Factor Authentication
          </Button>
        )}
      </Paper>

      {/* MFA Setup Wizard */}
      <MFASetupWizard
        open={mfaSetupOpen}
        onClose={() => setMfaSetupOpen(false)}
        onComplete={handleMfaSetupComplete}
      />

      {/* Disable MFA Dialog */}
      <Dialog open={mfaDisableOpen} onClose={() => setMfaDisableOpen(false)}>
        <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
        <DialogContent>
          {mfaError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {mfaError}
            </Alert>
          )}
          <Typography sx={{ mb: 2, mt: 1 }}>
            Enter your current MFA code to disable two-factor authentication.
            This will make your account less secure.
          </Typography>
          <TextField
            label="MFA Code"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            placeholder="Enter 6-digit code"
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMfaDisableOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => disableMfaMutation.mutate(disableCode)}
            disabled={disableMfaMutation.isPending || !disableCode}
          >
            {disableMfaMutation.isPending ? 'Disabling...' : 'Disable MFA'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={backupCodesOpen} onClose={() => setBackupCodesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Backup Codes</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
            Save these backup codes in a safe place. Each code can only be used once.
            Your old backup codes are no longer valid.
          </Alert>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 1,
                fontFamily: 'monospace',
              }}
            >
              {newBackupCodes.map((code, index) => (
                <Typography key={index} variant="body2">
                  {code}
                </Typography>
              ))}
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(newBackupCodes.join('\n'))
            }}
          >
            Copy All
          </Button>
          <Button variant="primary" onClick={() => setBackupCodesOpen(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
