/**
 * MFA Setup Wizard
 * Multi-step wizard for setting up two-factor authentication
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material'
import { Shield, Copy, Check, CheckCircle } from 'lucide-react'
import { setupMfa, verifyMfaSetup, MFASetupResponse } from '../../api/auth'

interface MFASetupWizardProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

const steps = ['Get Started', 'Scan QR Code', 'Enter Code', 'Backup Codes']

export const MFASetupWizard: React.FC<MFASetupWizardProps> = ({
  open,
  onClose,
  onComplete,
}) => {
  const [activeStep, setActiveStep] = useState(0)
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  useEffect(() => {
    if (open && activeStep === 1 && !setupData) {
      initSetup()
    }
  }, [open, activeStep])

  const initSetup = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await setupMfa()
      setSetupData(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to initialize MFA setup')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) return

    setIsLoading(true)
    setError(null)
    try {
      await verifyMfaSetup(verificationCode)
      setActiveStep(3) // Move to backup codes step
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid verification code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyBackupCodes = () => {
    if (setupData?.backup_codes) {
      navigator.clipboard.writeText(setupData.backup_codes.join('\n'))
      setCopiedCodes(true)
      setTimeout(() => setCopiedCodes(false), 2000)
    }
  }

  const handleFinish = () => {
    onComplete()
    onClose()
    // Reset state
    setActiveStep(0)
    setSetupData(null)
    setVerificationCode('')
    setError(null)
  }

  const handleNext = () => {
    if (activeStep === 0) {
      setActiveStep(1)
      initSetup()
    } else if (activeStep === 1) {
      setActiveStep(2)
    } else if (activeStep === 2) {
      handleVerify()
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Shield size={64} style={{ marginBottom: 16 }} />
            <Typography variant="h6" gutterBottom>
              Set Up Two-Factor Authentication
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add an extra layer of security to your account by enabling two-factor
              authentication. You'll need an authenticator app like Google Authenticator,
              Authy, or Microsoft Authenticator.
            </Typography>
          </Box>
        )

      case 1:
        return (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {isLoading ? (
              <CircularProgress />
            ) : setupData ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Scan this QR code with your authenticator app
                </Typography>
                <Box
                  component="img"
                  src={setupData.qr_code}
                  alt="MFA QR Code"
                  sx={{ maxWidth: 200, mb: 2 }}
                />
                <Typography variant="caption" display="block" color="text.secondary">
                  Or enter this code manually:
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ p: 1, mt: 1, fontFamily: 'monospace', fontSize: '0.875rem' }}
                >
                  {setupData.secret}
                </Paper>
              </>
            ) : (
              error && <Alert severity="error">{error}</Alert>
            )}
          </Box>
        )

      case 2:
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the 6-digit code from your authenticator app to verify setup
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              autoFocus
              label="Verification Code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              inputProps={{
                maxLength: 6,
                style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' },
              }}
              disabled={isLoading}
            />
          </Box>
        )

      case 3:
        return (
          <Box sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CheckCircle color="green" size={24} />
              <Typography variant="h6" color="success.main">
                MFA Enabled Successfully!
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Save these backup codes in a secure place. You can use them to access your
              account if you lose your authenticator device.
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, position: 'relative' }}>
              <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                <Tooltip title={copiedCodes ? 'Copied!' : 'Copy all codes'}>
                  <IconButton size="small" onClick={handleCopyBackupCodes}>
                    {copiedCodes ? <Check size={16} /> : <Copy size={16} />}
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 1,
                  fontFamily: 'monospace',
                }}
              >
                {setupData?.backup_codes.map((code, index) => (
                  <Typography key={index} variant="body2">
                    {code}
                  </Typography>
                ))}
              </Box>
            </Paper>
            <Alert severity="warning" sx={{ mt: 2 }}>
              Each backup code can only be used once. Store them securely!
            </Alert>
          </Box>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        {renderStepContent()}
      </DialogContent>
      <DialogActions>
        {activeStep < 3 && (
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
        )}
        {activeStep < 3 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={
              isLoading ||
              (activeStep === 1 && !setupData) ||
              (activeStep === 2 && verificationCode.length !== 6)
            }
            startIcon={isLoading && <CircularProgress size={16} />}
          >
            {activeStep === 2 ? 'Verify' : 'Next'}
          </Button>
        ) : (
          <Button variant="contained" onClick={handleFinish}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default MFASetupWizard
