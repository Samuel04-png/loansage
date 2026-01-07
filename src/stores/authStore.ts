import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';
import { authService } from '../lib/supabase/auth';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'admin' | 'employee' | 'customer';
  employee_category: string | null;
  agency_id: string | null;
  is_active: boolean;
  photoURL?: string | null;
  photo_url?: string | null;
  onboardingCompleted?: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      profile: null,
      loading: true,
      initialized: false,

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),

      signOut: async () => {
        await authService.signOut();
        // Clear demo session if in demo mode
        const { isDemoMode } = await import('../lib/supabase/client');
        if (isDemoMode) {
          localStorage.removeItem('demo_session');
        }
        set({ user: null, session: null, profile: null });
      },

      initialize: async () => {
        try {
          // First check Firebase Auth currentUser (for persistent sessions)
          const { auth } = await import('../lib/firebase/config');
          let session = null;
          let user = null;
          
          // Check if Firebase Auth has a current user (persisted session)
          if (auth.currentUser) {
            try {
              session = await authService.getSession();
              user = await authService.getUser();
            } catch (error) {
              console.warn('Failed to get session from Firebase Auth:', error);
            }
          }
          
          // If no Firebase session, try to get from persisted Zustand state
          if (!session || !user) {
            session = await authService.getSession();
            user = await authService.getUser();
          }

          if (session && user) {
            // Try to fetch user profile from database
            let profile: UserProfile | null = null;
            
            try {
              const { supabase, isDemoMode } = await import('../lib/supabase/client');
              
              if (isDemoMode) {
                // In demo mode, create a mock profile
                profile = {
                  id: user.id,
                  email: user.email || '',
                  full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Demo User',
                  phone: null,
                  role: (user.user_metadata?.role as 'admin' | 'employee' | 'customer') || 'admin',
                  employee_category: user.user_metadata?.employee_category || null,
                  agency_id: 'demo-agency-id',
                  is_active: true,
                  onboardingCompleted: true,
                };
              } else {
                try {
                  const queryResult = supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                  
                  // Add timeout to prevent hanging
                  const profilePromise = new Promise<{ data: any; error: any }>((resolve, reject) => {
                    queryResult.then(resolve, reject);
                  });
                  
                  const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) => 
                    setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
                  );
                  
                  const result = await Promise.race([profilePromise, timeoutPromise]);
                  
                  // CRITICAL: Distinguish between "user doesn't exist" vs "database error"
                  // - { data: null, error: null } → User doesn't exist (safe to use defaults)
                  // - { data: null, error: {...} } → Database error (DO NOT use defaults, throw error)
                  if (result.error) {
                    // Database/persistence error - DO NOT use defaults, preserve error state
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
                    
                    if (isDatabaseError) {
                      // This is a real database error - throw to prevent "Create Agency" redirect
                      console.error('❌ Database error fetching user profile:', result.error);
                      throw new Error(`Database error: ${errorMessage || 'Unable to connect to database'}`);
                    }
                  }
                  
                  // User document doesn't exist (data: null, error: null) - safe to use defaults
                  profile = result.data as UserProfile | null;
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
                    // Database error - DO NOT create default profile, throw to prevent onboarding redirect
                    console.error('❌ Database error during profile fetch:', error);
                    throw error; // Re-throw to prevent default profile creation
                  }
                  
                  // Timeout or other non-critical errors - use defaults (user might be new)
                  console.warn('⚠️ Profile fetch failed (timeout or non-critical), using defaults:', errorMessage);
                  profile = null;
                }
              }
            } catch (error: any) {
              // Only create default profile if it's NOT a database error
              const errorMessage = error?.message || String(error || '');
              const isDatabaseError = 
                errorMessage.includes('Database error') ||
                errorMessage.includes('permission') ||
                errorMessage.includes('network') ||
                errorMessage.includes('unavailable') ||
                errorMessage.includes('backing store') ||
                errorMessage.includes('IndexedDB') ||
                errorMessage.includes('Internal error');
              
              if (isDatabaseError) {
                // Database error - DO NOT create default profile, preserve error state
                console.error('❌ Critical database error, cannot load user profile:', errorMessage);
                // Set profile to null and let the UI handle the error (show error screen, not onboarding)
                profile = null;
                // Store error state for UI to display
                set({ user, session, profile: null, loading: false, initialized: true });
                return; // Exit early, don't set default profile
              }
              
              // User doesn't exist or other non-critical error - create basic profile from metadata
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

            set({
              user,
              session,
              profile,
              loading: false,
              initialized: true,
            });
          } else {
            set({ user: null, session: null, profile: null, loading: false, initialized: true });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ user: null, session: null, profile: null, loading: false, initialized: true });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user ? {
          id: state.user.id,
          email: state.user.email,
          user_metadata: state.user.user_metadata,
          app_metadata: {},
        } : null, 
        session: state.session ? {
          access_token: state.session.access_token,
          refresh_token: state.session.refresh_token,
          expires_at: state.session.expires_at,
          token_type: state.session.token_type,
          user: state.session.user ? {
            id: state.session.user.id,
            email: state.session.user.email,
            user_metadata: state.session.user.user_metadata,
            app_metadata: {},
          } : null,
        } : null,
      }),
    }
  )
);

