import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface CustomerRouteProps {
  children: React.ReactNode;
}

export function CustomerRoute({ children }: CustomerRouteProps) {
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

  if (profile?.role !== 'customer') {
    // Redirect based on role
    if (profile?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (profile?.role === 'employee') {
      return <Navigate to="/employee/dashboard" replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

