// Main Firebase client export - replaces Supabase client
export { auth, db, storage, isDemoMode } from './config';
export { authService } from './auth';
export { firestore } from './db';
export { storageService } from './storage';

// Re-export for backward compatibility - use the supabase export from db.ts
export { supabase } from './db';

