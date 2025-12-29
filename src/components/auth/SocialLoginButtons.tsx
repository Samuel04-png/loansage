import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Chrome } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService, isMobileDevice } from '../../lib/supabase/auth';
import { useAuthStore } from '../../stores/authStore';

export function SocialLoginButtons() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { setUser, setSession, setProfile } = useAuthStore();

  // Check for pending OAuth redirect on mount
  useEffect(() => {
    const checkRedirectResult = async () => {
      // Check if we have a pending redirect
      if (authService.hasPendingRedirect()) {
        setIsRedirecting(true);
        try {
          const result = await authService.handleRedirectResult();
          if (result?.user && result?.session) {
            await handleAuthSuccess(result.user, result.session, result.provider as 'google' | 'apple');
          }
        } catch (error: any) {
          console.error('Redirect result error:', error);
          toast.error(error.message || 'Sign-in failed. Please try again.');
        } finally {
          setIsRedirecting(false);
        }
      }
    };

    checkRedirectResult();
  }, []);

  const handleAuthSuccess = async (user: any, session: any, provider: 'google' | 'apple') => {
        const { isDemoMode } = await import('../../lib/supabase/client');
        if (isDemoMode) {
      localStorage.setItem('demo_session', JSON.stringify(session));
        }

        // Get or create user profile
        let profile = null;
        try {
          const { supabase } = await import('../../lib/supabase/client');
          const profilePromise = supabase
            .from('users')
            .select('*')
        .eq('id', user.id)
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
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            phone: null,
        role: (user.user_metadata?.role as 'admin' | 'employee' | 'customer') || 'admin',
        employee_category: user.user_metadata?.employee_category || null,
            agency_id: null,
            is_active: true,
          };
        }

    setUser(user as any);
    setSession(session as any);
        setProfile(profile as any);

        toast.success(`Welcome! Signed in with ${provider === 'google' ? 'Google' : 'Apple'}`);
        
        // Check onboarding status before navigation
        const hasAgency = profile?.agency_id;
    const onboardingCompleted = profile?.onboardingCompleted !== false;
        
        if (!hasAgency || !onboardingCompleted) {
          navigate('/auth/create-organization', { replace: true });
          return;
        }
        
        // Navigate based on role
    const userRole = profile?.role || user.user_metadata?.role || 'admin';
        if (userRole === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (userRole === 'employee') {
          navigate('/employee/dashboard', { replace: true });
        } else if (userRole === 'customer') {
          navigate('/customer/dashboard', { replace: true });
        } else {
          navigate('/admin/dashboard', { replace: true });
        }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    
    // On mobile, show a different message since we're redirecting
    const isMobile = isMobileDevice();
    if (isMobile) {
      toast.loading(`Redirecting to ${provider === 'google' ? 'Google' : 'Apple'}...`, { 
        id: 'oauth-redirect',
        duration: 10000 
      });
    }
    
    try {
      let result;
      
      if (provider === 'google') {
        result = await authService.signInWithGoogle();
      } else if (provider === 'apple') {
        result = await authService.signInWithApple();
      } else {
        throw new Error('Unsupported provider');
      }

      // If result is null/empty, it means we're doing a redirect (mobile)
      if (!result?.user || !result?.session) {
        // Keep loading state for redirect - the page will reload
        return;
      }

      toast.dismiss('oauth-redirect');
      await handleAuthSuccess(result.user, result.session, provider);
    } catch (error: any) {
      toast.dismiss('oauth-redirect');
      console.error(`${provider} sign-in error:`, error);
      
      // Don't show error for redirect flow
      if (error.message?.includes('Redirecting')) {
        return;
      }
      
      const errorMessage = error.message || `Failed to sign in with ${provider === 'google' ? 'Google' : 'Apple'}`;
      toast.error(errorMessage);
      setLoading(null);
    }
  };

  const socialProviders = [
    { 
      name: 'Google', 
      icon: Chrome, 
      provider: 'google' as const, 
      color: 'hover:bg-red-50 hover:border-red-200' 
    },
  ];

  // Show loading state when returning from OAuth redirect
  if (isRedirecting) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center justify-center py-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mb-2" />
          <p className="text-sm text-slate-600">Completing sign-in...</p>
          <p className="text-xs text-slate-500 mt-1">Please wait while we verify your account</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {socialProviders.map((social, index) => {
        const isLoading = loading === social.provider;
        const isMobile = isMobileDevice();
        return (
          <motion.div
            key={social.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin(social.provider)}
              disabled={loading !== null}
              className={`w-full h-10 rounded-xl border-2 transition-all duration-200 text-sm ${social.color} ${
                loading !== null && !isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  {isMobile ? 'Redirecting...' : 'Signing in...'}
                </>
              ) : (
                <>
                  <social.icon className="mr-3 h-5 w-5" />
                  Continue with {social.name}
                </>
              )}
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
}

