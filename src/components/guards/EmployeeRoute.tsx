import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface EmployeeRouteProps {
  children: React.ReactNode;
}

export function EmployeeRoute({ children }: EmployeeRouteProps) {
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

  if (profile?.role !== 'employee' && profile?.role !== 'admin') {
    // Redirect based on role
    if (profile?.role === 'customer') {
      return <Navigate to="/customer/dashboard" replace />;
    }
    if (profile?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

