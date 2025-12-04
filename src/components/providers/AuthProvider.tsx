import { useEffect, ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isDemoMode } from '../../lib/supabase/client';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  useAuth(); // Initialize auth state

  useEffect(() => {
    if (isDemoMode) {
      // Check for demo session on mount
      const demoSession = localStorage.getItem('demo_session');
      if (demoSession) {
        try {
          const session = JSON.parse(demoSession);
          // Restore session in auth store
          const { useAuthStore } = require('../../stores/authStore');
          useAuthStore.getState().setSession(session);
          useAuthStore.getState().setUser(session.user);
        } catch (error) {
          console.error('Failed to restore demo session:', error);
        }
      }
    }
  }, []);

  return <>{children}</>;
}

