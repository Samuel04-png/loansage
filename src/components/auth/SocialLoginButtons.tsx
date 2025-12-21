import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Chrome, Apple } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../../lib/supabase/auth';
import { useAuthStore } from '../../stores/authStore';

export function SocialLoginButtons() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const { setUser, setSession, setProfile } = useAuthStore();

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    try {
      let result;
      
      if (provider === 'google') {
        result = await authService.signInWithGoogle();
      } else if (provider === 'apple') {
        result = await authService.signInWithApple();
      } else {
        throw new Error('Unsupported provider');
      }

      if (result?.user && result?.session) {
        const { isDemoMode } = await import('../../lib/supabase/client');
        if (isDemoMode) {
          localStorage.setItem('demo_session', JSON.stringify(result.session));
        }

        // Get or create user profile
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

        toast.success(`Welcome! Signed in with ${provider === 'google' ? 'Google' : 'Apple'}`);
        
        // Check onboarding status before navigation
        const hasAgency = profile?.agency_id;
        const onboardingCompleted = profile?.onboardingCompleted !== false; // Default to true if not set (for backward compatibility)
        
        // If user doesn't have agency or onboarding not completed, redirect to onboarding
        if (!hasAgency || !onboardingCompleted) {
          navigate('/auth/create-organization', { replace: true });
          return;
        }
        
        // Navigate based on role
        const userRole = profile?.role || result.user.user_metadata?.role || 'admin';
        if (userRole === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (userRole === 'employee') {
          navigate('/employee/dashboard', { replace: true });
        } else if (userRole === 'customer') {
          navigate('/customer/dashboard', { replace: true });
        } else {
          navigate('/admin/dashboard', { replace: true });
        }
      }
    } catch (error: any) {
      console.error(`${provider} sign-in error:`, error);
      const errorMessage = error.message || `Failed to sign in with ${provider === 'google' ? 'Google' : 'Apple'}`;
      toast.error(errorMessage);
    } finally {
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
    { 
      name: 'Apple', 
      icon: Apple, 
      provider: 'apple' as const, 
      color: 'hover:bg-slate-50 hover:border-slate-300' 
    },
  ];

  return (
    <div className="space-y-3">
      {socialProviders.map((social, index) => {
        const isLoading = loading === social.provider;
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
                  Signing in...
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

