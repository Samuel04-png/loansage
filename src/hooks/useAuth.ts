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
                  
                  // CRITICAL: Distinguish between "user doesn't exist" vs "database error"
                  if (result.error) {
                    const errorCode = result.error?.code || '';
                    const errorMessage = result.error?.message || '';
                    
                    // Check if this is a real database error (not "document not found")
                    const isDatabaseError = 
                      errorCode !== '' ||
                      errorMessage.includes('permission') ||
                      errorMessage.includes('network') ||
                      errorMessage.includes('unavailable') ||
                      errorMessage.includes('timeout') ||
                      errorMessage.includes('Internal error') ||
                      errorMessage.includes('backing store') ||
                      errorMessage.includes('IndexedDB');
                    
                    if (isDatabaseError && !errorMessage.includes('timeout')) {
                      // Database error - DO NOT create default profile
                      console.error('❌ Database error fetching user profile:', result.error);
                      // Don't set profile - let the UI handle the error state
                      return; // Exit early, don't set default profile
                    }
                  }
                  
                  if (result.data) {
                    // Clean the profile data to ensure no nested objects that can't be rendered
                    const rawProfile = result.data;
                    const cleanProfile = {
                      id: rawProfile.id,
                      email: rawProfile.email || '',
                      full_name: rawProfile.full_name || null,
                      phone: rawProfile.phone || null,
                      role: rawProfile.role || 'admin',
                      employee_category: rawProfile.employee_category || null,
                      agency_id: rawProfile.agency_id || null,
                      is_active: rawProfile.is_active !== false,
                      photoURL: rawProfile.photoURL || rawProfile.photo_url || null,
                      onboardingCompleted: rawProfile.onboardingCompleted || false,
                    };
                    setProfile(cleanProfile as any);
                  } else {
                    // User doesn't exist (data: null, error: null) - safe to use defaults
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
                } catch (error: any) {
                  // Check if this is a database/persistence error vs timeout
                  const errorMessage = error?.message || String(error || '');
                  const isDatabaseError = 
                    errorMessage.includes('Database error') ||
                    errorMessage.includes('permission') ||
                    errorMessage.includes('network') ||
                    errorMessage.includes('unavailable') ||
                    errorMessage.includes('backing store') ||
                    errorMessage.includes('IndexedDB') ||
                    errorMessage.includes('Internal error');
                  
                  if (isDatabaseError && !errorMessage.includes('timeout')) {
                    // Database error - DO NOT create default profile
                    console.error('❌ Database error during profile fetch:', error);
                    // Don't set profile - let the UI handle the error state
                    return; // Exit early, don't set default profile
                  }
                  
                  // Timeout or user doesn't exist - safe to use defaults
                  // Only log in development to reduce console noise in production
                  if (import.meta.env.DEV) {
                    console.warn('⚠️ Profile fetch failed (timeout or non-critical), using defaults:', errorMessage);
                  }
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
  }, [initialized, initialize]);

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

