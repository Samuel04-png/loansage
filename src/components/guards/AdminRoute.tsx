import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { profile, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (profile?.role !== 'admin') {
    // Redirect based on role
    if (profile?.role === 'employee') {
      return <Navigate to="/employee/dashboard" replace />;
    }
    if (profile?.role === 'customer') {
      return <Navigate to="/customer/dashboard" replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

