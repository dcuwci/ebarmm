/**
 * MFA Verification Dialog
 * Used during login when MFA is required
 */

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import { Shield, Key } from 'lucide-react'

interface MFAVerifyDialogProps {
  open: boolean
  onClose: () => void
  onVerify: (code: string) => Promise<void>
  error?: string | null
}

export const MFAVerifyDialog: React.FC<MFAVerifyDialogProps> = ({
  open,
  onClose,
  onVerify,
  error,
}) => {
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isBackupCode, setIsBackupCode] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setIsLoading(true)
    try {
      await onVerify(code.trim())
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '')
    setCode(value)
    // Auto-detect backup code (8 characters)
    setIsBackupCode(value.length > 6)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Shield size={24} />
          <Typography variant="h6">Two-Factor Authentication</Typography>
        </Box>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the 6-digit code from your authenticator app, or use a backup code.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            autoFocus
            fullWidth
            label={isBackupCode ? 'Backup Code' : 'Authentication Code'}
            value={code}
            onChange={handleCodeChange}
            placeholder={isBackupCode ? 'XXXXXXXX' : '000000'}
            inputProps={{
              maxLength: 8,
              style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' },
            }}
            disabled={isLoading}
          />

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Key size={16} />
            <Typography variant="caption" color="text.secondary">
              {isBackupCode
                ? 'Using backup code (8 characters)'
                : 'Enter code from authenticator app'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={code.length < 6 || isLoading}
            startIcon={isLoading && <CircularProgress size={16} />}
          >
            Verify
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default MFAVerifyDialog
