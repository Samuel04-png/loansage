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
                  profile = result.data as UserProfile | null;
                } catch (error) {
                  // If query fails or times out, profile will be null and fallback will be used
                  console.warn('Profile fetch failed during initialization:', error);
                  profile = null;
                }
              }
            } catch (error) {
              // If profile fetch fails, create a basic profile from user metadata
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
      partialize: (state) => ({ user: state.user, session: state.session }),
    }
  )
);

