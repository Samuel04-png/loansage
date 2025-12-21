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
  const hasAgency = profile?.agency_id;
  const onboardingCompleted = profile?.onboardingCompleted !== false; // Default to true for backward compatibility
  
  // If not on onboarding page and user hasn't completed onboarding, redirect
  if (!isOnboardingPage && (!hasAgency || !onboardingCompleted)) {
    return <Navigate to="/auth/create-organization" replace />;
  }

  return <>{children}</>;
}

