import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Check if we're in demo mode (no Firebase credentials)
export const isDemoMode = !firebaseConfig.apiKey || 
  !firebaseConfig.projectId ||
  firebaseConfig.apiKey.includes('your-api-key') ||
  firebaseConfig.projectId.includes('your-project');

// Spark plan mode - free tier limitations
// Set to true if you're on Spark (free) plan to disable features that require Blaze plan
export const isSparkPlan = import.meta.env.VITE_FIREBASE_SPARK_PLAN === 'true' || 
  import.meta.env.VITE_FIREBASE_SPARK_PLAN === '1' ||
  false; // Default to false, set VITE_FIREBASE_SPARK_PLAN=true in .env.local if on free tier

if (isSparkPlan) {
  console.info('ℹ️ Running in SPARK PLAN mode - Some features may be limited');
  console.info('Features disabled: File uploads, Cloud Functions, some advanced operations');
}

if (isDemoMode) {
  console.warn('⚠️ Running in DEMO MODE - Firebase credentials not configured');
  console.warn('Create a .env.local file with:');
  console.warn('VITE_FIREBASE_API_KEY=your_api_key');
  console.warn('VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com');
  console.warn('VITE_FIREBASE_PROJECT_ID=your_project_id');
  console.warn('VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com');
  console.warn('VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id');
  console.warn('VITE_FIREBASE_APP_ID=your_app_id');
  console.warn('You can still test the UI flow, but data will not be persisted.');
}

// Initialize Firebase (only if not already initialized)
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize services
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

// Initialize Firestore
// Note: Persistence must be enabled before any Firestore operations
export const db: Firestore = getFirestore(app);

// Enable offline persistence for Firestore
// This must be called before any Firestore operations, but we handle
// the case where it's already been started (common during HMR)
if (!isDemoMode && typeof window !== 'undefined') {
  // Use a persistent flag across HMR reloads to prevent multiple attempts
  const persistenceKey = '__firestorePersistenceEnabled';
  const hasAttempted = (window as any)[persistenceKey];
  
  if (!hasAttempted) {
    // Mark as attempted immediately to prevent race conditions
    (window as any)[persistenceKey] = true;
    
    // Enable persistence - errors are expected during HMR and handled silently
    const persistencePromise = enableIndexedDbPersistence(db, { cacheSizeBytes: CACHE_SIZE_UNLIMITED });
    
    // Always attach error handler to prevent unhandled promise rejections
    persistencePromise.catch((err: any) => {
      // Silently handle all expected errors (HMR, multiple tabs, browser support, etc.)
      const errorMessage = String(err?.message || '');
      const isExpectedError = 
        err?.code === 'failed-precondition' ||
        err?.code === 'unimplemented' ||
        errorMessage.includes('already been started') ||
        errorMessage.includes('can no longer be enabled');
      
      // Only log truly unexpected errors
      if (!isExpectedError) {
        console.warn('Could not enable Firestore persistence:', err?.message || err);
      }
    });
  }
}

export default app;

