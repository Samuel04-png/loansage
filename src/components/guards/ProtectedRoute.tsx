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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Check onboarding status - don't block access to onboarding page itself
  const isOnboardingPage = location.pathname === '/auth/create-organization';
  const hasAgency = !!profile?.agency_id;
  
  // Only redirect to onboarding if:
  // 1. User is NOT already on the onboarding page
  // 2. User does NOT have an agency_id (meaning they haven't created an organization yet)
  // Once user has an agency_id, they should be able to access all pages
  // Organization/loan type changes should be done in Settings, not by redirecting to onboarding
  if (!isOnboardingPage && !hasAgency) {
    return <Navigate to="/auth/create-organization" replace />;
  }
  
  // If user is on onboarding page but already has an agency, redirect to dashboard
  // (They shouldn't be able to create another organization)
  if (isOnboardingPage && hasAgency) {
    const role = profile?.role || 'admin';
    const dashboardPath = role === 'admin' ? '/admin/dashboard' : role === 'employee' ? '/employee/dashboard' : '/customer/dashboard';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
}

