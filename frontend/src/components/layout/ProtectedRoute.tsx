// Protected Route - see FRONTEND_DESIGN.md
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
export default function ProtectedRoute({ children, allowedRoles }: any) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!allowedRoles.includes(user?.role)) return <Navigate to="/" />;
  return children;
}
