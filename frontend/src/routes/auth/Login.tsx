/**
 * Login Page
 * MUI-based authentication form with MFA support
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { Button } from '../../components/mui';
import { useAuthStore } from '../../stores/authStore';
import { login as loginApi, verifyMfa } from '../../api/auth';
import MFAVerifyDialog from '../../components/auth/MFAVerifyDialog';

interface LoginFormData {
  username: string;
  password: string;
}

interface LoginFormErrors {
  username?: string;
  password?: string;
  general?: string;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });

  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [loading, setLoading] = useState(false);

  // MFA state
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [mfaSessionToken, setMfaSessionToken] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: LoginFormErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name as keyof LoginFormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await loginApi(formData.username, formData.password);

      // Check if MFA is required
      if (response.mfa_required && response.mfa_session_token) {
        setMfaSessionToken(response.mfa_session_token);
        setMfaDialogOpen(true);
        setMfaError(null);
      } else if (response.access_token && response.user) {
        // No MFA required, complete login
        login(response.access_token, response.user, response.refresh_token);
        const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/admin';
        navigate(from, { replace: true });
      }
    } catch (error: unknown) {
      console.error('Login error:', error);

      const axiosError = error as { response?: { status?: number; data?: { detail?: string } } };

      if (axiosError.response?.status === 401) {
        setErrors({
          general: 'Invalid username or password'
        });
      } else if (axiosError.response?.status === 403) {
        setErrors({
          general: 'Account is disabled. Please contact administrator.'
        });
      } else if (axiosError.response?.data?.detail) {
        setErrors({
          general: axiosError.response.data.detail
        });
      } else {
        setErrors({
          general: 'Login failed. Please try again.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle MFA verification
  const handleMfaVerify = async (code: string) => {
    if (!mfaSessionToken) return;

    try {
      const response = await verifyMfa(code, mfaSessionToken);

      if (response.access_token && response.user) {
        login(response.access_token, response.user, response.refresh_token);
        setMfaDialogOpen(false);
        const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/admin';
        navigate(from, { replace: true });
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setMfaError(axiosError.response?.data?.detail || 'Invalid verification code');
      throw error; // Let the dialog handle the error state
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Box sx={{ maxWidth: 400, width: '100%' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h3" fontWeight={700} color="primary.main">
            E-BARMM
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Enhanced BARMM Transparency System
          </Typography>
        </Box>

        {/* Login Form */}
        <Paper sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" fontWeight={600}>
                Sign in
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Enter your credentials to access the system
              </Typography>
            </Box>

            {errors.general && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {errors.general}
              </Alert>
            )}

            <TextField
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              error={!!errors.username}
              helperText={errors.username}
              placeholder="Enter your username"
              required
              fullWidth
              autoComplete="username"
              autoFocus
              disabled={loading}
              sx={{ mb: 2 }}
            />

            <TextField
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              error={!!errors.password}
              helperText={errors.password}
              placeholder="Enter your password"
              required
              fullWidth
              autoComplete="current-password"
              disabled={loading}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={loading}
            >
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  Signing in...
                </Box>
              ) : (
                'Sign in'
              )}
            </Button>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
              Forgot password? Contact your system administrator
            </Typography>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/')}
              >
                Back to Home
              </Button>
            </Box>
          </form>
        </Paper>

        {/* Footer */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Ministry of Public Works - BARMM
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bangsamoro Autonomous Region in Muslim Mindanao
          </Typography>
        </Box>

        {/* Development credentials hint */}
        {import.meta.env.DEV && (
          <Paper
            sx={{
              mt: 3,
              p: 2,
              bgcolor: 'warning.50',
              border: 2,
              borderColor: 'warning.300',
            }}
          >
            <Typography variant="body2" fontWeight={600} color="warning.dark" sx={{ mb: 1 }}>
              Development Credentials:
            </Typography>
            <Box sx={{ fontSize: '0.875rem', color: 'warning.dark' }}>
              <Typography variant="body2">
                Super Admin: <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>admin / Admin@2026</code>
              </Typography>
              <Typography variant="body2">
                DEO User: <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>deo_user_1 / Deo@2026</code>
              </Typography>
              <Typography variant="body2">
                Regional Admin: <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>regional_admin / Regional@2026</code>
              </Typography>
            </Box>
          </Paper>
        )}
      </Box>

      {/* MFA Verification Dialog */}
      <MFAVerifyDialog
        open={mfaDialogOpen}
        onClose={() => {
          setMfaDialogOpen(false);
          setMfaSessionToken(null);
          setMfaError(null);
        }}
        onVerify={handleMfaVerify}
        error={mfaError}
      />
    </Box>
  );
}
