import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ('admin' | 'employee' | 'customer')[];
  employeeCategories?: string[];
}

export function RoleGuard({ children, allowedRoles, employeeCategories }: RoleGuardProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/auth/login" replace />;
  }

  const hasRole = allowedRoles.includes(profile.role);
  const hasCategory = !employeeCategories || 
    (profile.employee_category && employeeCategories.includes(profile.employee_category));

  if (!hasRole || !hasCategory) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

