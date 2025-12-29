import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isDemoMode } from '../../lib/supabase/client';
import { authService } from '../../lib/supabase/auth';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  useAuth(); // Initialize auth state
  const [isHandlingRedirect, setIsHandlingRedirect] = useState(false);
  const { setUser, setSession, setProfile } = useAuthStore();

  useEffect(() => {
    // Handle OAuth redirect result on app load
    const handleOAuthRedirect = async () => {
      // Only check for redirect if we have a pending provider
      if (!authService.hasPendingRedirect()) {
        return;
      }

      setIsHandlingRedirect(true);
      try {
        const result = await authService.handleRedirectResult();
        
        if (result?.user && result?.session) {
          console.log('OAuth redirect result processed:', result.provider);
          
          // Fetch user profile
          let profile = null;
          try {
            const { supabase } = await import('../../lib/supabase/client');
            const profilePromise = supabase
              .from('users')
              .select('*')
              .eq('id', result.user.id)
              .single();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
            );
            const profileResult = await Promise.race([profilePromise, timeoutPromise]) as any;
            if (profileResult?.data) {
              profile = profileResult.data;
            }
          } catch (error: any) {
            console.warn('Profile fetch failed, using defaults:', error);
          }
          
          if (!profile) {
            profile = {
              id: result.user.id,
              email: result.user.email || '',
              full_name: result.user.user_metadata?.full_name || result.user.email?.split('@')[0] || 'User',
              phone: null,
              role: (result.user.user_metadata?.role as 'admin' | 'employee' | 'customer') || 'admin',
              employee_category: result.user.user_metadata?.employee_category || null,
              agency_id: null,
              is_active: true,
            };
          }

          setUser(result.user as any);
          setSession(result.session as any);
          setProfile(profile as any);
        }
      } catch (error) {
        console.error('Error handling OAuth redirect:', error);
      } finally {
        setIsHandlingRedirect(false);
      }
    };

    handleOAuthRedirect();

    if (isDemoMode) {
      // Check for demo session on mount
      const demoSession = localStorage.getItem('demo_session');
      if (demoSession) {
        try {
          const session = JSON.parse(demoSession);
          // Restore session in auth store
          setSession(session);
          setUser(session.user);
        } catch (error) {
          console.error('Failed to restore demo session:', error);
        }
      }
    }
  }, []);

  // Show loading state while handling OAuth redirect
  if (isHandlingRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
          <p className="text-lg font-medium text-foreground">Completing sign-in...</p>
          <p className="text-sm text-muted-foreground">Please wait while we verify your account</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

