import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input, Button, Card } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../api/client';

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
      // OAuth2 compatible login using form data
      const formBody = new URLSearchParams();
      formBody.append('username', formData.username);
      formBody.append('password', formData.password);

      const response = await apiClient.post('/auth/login', formBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, user } = response.data;

      // Store token and user in auth store
      login(access_token, user);

      // Redirect to intended page or dashboard
      const from = (location.state as any)?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    } catch (error: any) {
      console.error('Login error:', error);

      if (error.response?.status === 401) {
        setErrors({
          general: 'Invalid username or password'
        });
      } else if (error.response?.status === 403) {
        setErrors({
          general: 'Account is disabled. Please contact administrator.'
        });
      } else if (error.response?.data?.detail) {
        setErrors({
          general: error.response.data.detail
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">E-BARMM</h1>
          <p className="text-lg text-gray-600">Enhanced BARMM Transparency System</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Sign in</h2>
              <p className="text-sm text-gray-600">
                Enter your credentials to access the system
              </p>
            </div>

            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                <p className="text-sm font-medium">{errors.general}</p>
              </div>
            )}

            <Input
              label="Username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
              placeholder="Enter your username"
              required
              autoComplete="username"
              autoFocus
              disabled={loading}
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              disabled={loading}
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              disabled={loading}
            >
              Sign in
            </Button>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Forgot password? Contact your system administrator
              </p>
            </div>
          </form>
        </Card>

        <div className="mt-8 text-center">
          <div className="text-sm text-gray-600 space-y-1">
            <p>Ministry of Public Works - BARMM</p>
            <p>Bangsamoro Autonomous Region in Muslim Mindanao</p>
          </div>
        </div>

        {/* Development credentials hint */}
        {import.meta.env.DEV && (
          <Card className="mt-6 bg-yellow-50 border-2 border-yellow-200">
            <div className="text-sm space-y-2">
              <p className="font-semibold text-yellow-900">Development Credentials:</p>
              <div className="space-y-1 text-yellow-800">
                <p>Super Admin: <code className="bg-yellow-100 px-2 py-0.5 rounded">admin / Admin@2026</code></p>
                <p>DEO User: <code className="bg-yellow-100 px-2 py-0.5 rounded">deo_user_1 / Deo@2026</code></p>
                <p>Regional Admin: <code className="bg-yellow-100 px-2 py-0.5 rounded">regional_admin / Regional@2026</code></p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
