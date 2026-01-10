import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // First check: User not authenticated at all
  if (!isAuthenticated || !profile) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Check onboarding status - don't block access to onboarding page itself
  const isOnboardingPage = location.pathname === '/auth/create-organization';
  const hasAgency = !!profile?.agency_id;
  
  // Second check: Redirect to onboarding if user hasn't completed org setup
  // Only if they're not already on the onboarding page
  if (!isOnboardingPage && !hasAgency && profile?.role === 'admin') {
    return <Navigate to="/auth/create-organization" replace />;
  }
  
  // Third check: If user is on onboarding page but already has an agency, redirect to dashboard
  if (isOnboardingPage && hasAgency) {
    const role = profile?.role || 'admin';
    const dashboardPath = role === 'admin' ? '/admin/dashboard' : role === 'employee' ? '/employee/dashboard' : '/customer/dashboard';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
}

