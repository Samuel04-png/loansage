import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../lib/supabase/auth';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const {
    user,
    session,
    profile,
    loading,
    initialized,
    setUser,
    setSession,
    setProfile,
    initialize,
    signOut,
  } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      initialize();
    }

    let subscription: { unsubscribe: () => void } | null = null;
    
    try {
      const result = authService.onAuthStateChange(
        async (event, session) => {
          // Convert Firebase session to Supabase-compatible format
          if (session) {
            const supabaseSession: Session = {
              ...session,
              token_type: 'bearer' as const,
              user: {
                ...session.user,
                app_metadata: session.user.app_metadata || {},
              } as User,
            } as Session;
            setSession(supabaseSession);
          } else {
            setSession(null);
          }
          
          if (session?.user) {
            // Ensure app_metadata exists for Supabase type compatibility
            const supabaseUser: User = {
              ...session.user,
              app_metadata: session.user.app_metadata || {},
            } as User;
            setUser(supabaseUser);
            
            // Try to fetch user profile
            try {
              const { supabase, isDemoMode } = await import('../lib/supabase/client');
              
              if (isDemoMode) {
                // In demo mode, create a mock profile
                setProfile({
                  id: session.user.id,
                  email: session.user.email || '',
                  full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Demo User',
                  phone: null,
                  role: (session.user.user_metadata?.role as 'admin' | 'employee' | 'customer') || 'admin',
                  employee_category: session.user.user_metadata?.employee_category || null,
                  agency_id: 'demo-agency-id',
                  is_active: true,
                  onboardingCompleted: true,
                });
              } else {
                // Query user profile with timeout to prevent hanging
                try {
                  const queryResult = supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                  
                  // Convert thenable to Promise with timeout
                  const profilePromise = new Promise<{ data: any; error: any }>((resolve, reject) => {
                    queryResult.then(resolve, reject);
                  });
                  
                  const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) => 
                    setTimeout(() => reject(new Error('Profile fetch timeout')), 15000) // Increased to 15 seconds
                  );
                  
                  const result = await Promise.race([profilePromise, timeoutPromise]);
                  
                  if (result.data) {
                    setProfile(result.data as any);
                  } else {
                    // If no data, create default profile
                    throw new Error('No profile data');
                  }
                } catch (error) {
                  // If profile fetch fails, create a basic profile
                  console.warn('Profile fetch failed, using defaults:', error);
                  setProfile({
                    id: session.user.id,
                    email: session.user.email || '',
                    full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                    phone: null,
                    role: (session.user.user_metadata?.role as 'admin' | 'employee' | 'customer') || 'admin',
                    employee_category: session.user.user_metadata?.employee_category || null,
                    agency_id: null,
                    is_active: true,
                  });
                }
              }
            } catch (error) {
              // If profile fetch fails, create a basic profile
              setProfile({
                id: session.user.id,
                email: session.user.email || '',
                full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                phone: null,
                role: (session.user.user_metadata?.role as 'admin' | 'employee' | 'customer') || 'admin',
                employee_category: session.user.user_metadata?.employee_category || null,
                agency_id: null,
                is_active: true,
              });
            }
          } else {
            setUser(null);
            setProfile(null);
          }
        }
      );
      
      // Handle both structures: { data: { subscription: ... } } and direct unsubscribe function
      if (!result) {
        console.warn('onAuthStateChange returned undefined or null');
      } else if (typeof result === 'object' && result !== null) {
        if ('data' in result && result.data && typeof result.data === 'object' && 'subscription' in result.data) {
          subscription = result.data.subscription as { unsubscribe: () => void };
        } else if ('subscription' in result && result.subscription) {
          subscription = result.subscription as { unsubscribe: () => void };
        }
      } else if (typeof result === 'function') {
        // If it's a direct unsubscribe function (legacy Firebase format)
        subscription = { unsubscribe: result };
      }
    } catch (error) {
      console.error('Failed to set up auth state listener:', error);
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [initialized, setUser, setSession, setProfile, initialize]);

  return {
    user,
    session,
    profile,
    loading: loading || !initialized,
    isAuthenticated: !!user && !!session,
    isAdmin: profile?.role === 'admin',
    isEmployee: profile?.role === 'employee',
    isCustomer: profile?.role === 'customer',
    signOut,
  };
}

