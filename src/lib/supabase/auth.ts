// This file now acts as a compatibility layer, re-exporting Firebase auth service
// to minimize changes in existing code that imports from 'lib/supabase/auth'.

export { authService } from '../firebase/auth';
export { isDemoMode } from '../firebase/config';
export type { User, Session, SignUpData, SignInData } from '../firebase/auth';
