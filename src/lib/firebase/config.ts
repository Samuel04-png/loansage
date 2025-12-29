import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED 
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import { getDatabase, Database } from 'firebase/database';

// Get environment variables with fallbacks
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  // Try import.meta.env first (Vite)
  const value = import.meta.env[key];
  if (value && value !== 'undefined' && value !== 'null') {
    return value;
  }
  // Fallback to window.__ENV__ for build-time injection
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    return (window as any).__ENV__[key] || defaultValue;
  }
  return defaultValue;
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', ''),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', ''),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', ''),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', ''),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', ''),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', ''),
};

// Check if we're in demo mode (no Firebase credentials)
export const isDemoMode = !firebaseConfig.apiKey || 
  !firebaseConfig.projectId ||
  firebaseConfig.apiKey.includes('your-api-key') ||
  firebaseConfig.projectId.includes('your-project') ||
  firebaseConfig.apiKey === '' ||
  firebaseConfig.projectId === '';

// Spark plan mode - free tier limitations
// NOTE: Project has been upgraded to Blaze plan - all features are now enabled
// This flag is kept for backward compatibility but defaults to false (Blaze plan)
// Set to true ONLY if you need to temporarily restrict features for testing
export const isSparkPlan = import.meta.env.VITE_FIREBASE_SPARK_PLAN === 'true' || 
  import.meta.env.VITE_FIREBASE_SPARK_PLAN === '1' ||
  false; // Default to false (Blaze plan) - all features enabled

if (isSparkPlan) {
  console.warn('⚠️ Running in SPARK PLAN mode - Some features may be limited');
  console.warn('Features disabled: File uploads, Cloud Functions, some advanced operations');
  console.warn('Note: Project is on Blaze plan - remove VITE_FIREBASE_SPARK_PLAN from .env to enable all features');
} else {
  console.info('✅ Running on BLAZE PLAN - All features enabled (Cloud Storage, Cloud Functions, etc.)');
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
  // Only initialize if we have valid credentials
  if (!isDemoMode && firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (error: any) {
      console.error('Failed to initialize Firebase:', error);
      // Create a dummy app to prevent crashes
      throw new Error('Firebase initialization failed. Please check your environment variables.');
    }
  } else {
    // In demo mode, we still need to initialize with dummy config to prevent crashes
    // But we'll show warnings
    console.warn('⚠️ Firebase not configured - running in demo mode');
    try {
      app = initializeApp({
        apiKey: 'demo-api-key',
        authDomain: 'demo.firebaseapp.com',
        projectId: 'demo-project',
        storageBucket: 'demo.appspot.com',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:demo',
      });
    } catch (error) {
      // If even dummy init fails, get existing app
      app = getApps()[0] || initializeApp({
        apiKey: 'demo',
        authDomain: 'demo.firebaseapp.com',
        projectId: 'demo',
        storageBucket: 'demo.appspot.com',
        messagingSenderId: '123',
        appId: '1:123:web:demo',
      });
    }
  }
} else {
  app = getApps()[0];
}

// Initialize services
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

// Initialize Realtime Database (lazy initialization)
let realtimeDB: Database | null = null;
export function getRealtimeDatabase(): Database {
  if (!realtimeDB && !isDemoMode) {
    try {
      realtimeDB = getDatabase(app);
    } catch (error) {
      console.error('Failed to initialize Realtime Database:', error);
    }
  }
  return realtimeDB as Database;
}

// Initialize Firestore with multi-tab persistence support
// Using the new cache API which supports multiple tabs by default
let db: Firestore;

// Use a window flag to track initialization across HMR reloads
const firestoreInitKey = '__firestoreInitialized';
const wasInitialized = typeof window !== 'undefined' && (window as any)[firestoreInitKey];

if (!isDemoMode && typeof window !== 'undefined' && !wasInitialized) {
  try {
    // Initialize Firestore with persistent multi-tab cache
    // This replaces the deprecated enableIndexedDbPersistence and automatically handles multi-tab
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      })
    });
    (window as any)[firestoreInitKey] = true;
    console.info('✅ Firestore initialized with multi-tab persistence');
  } catch (err: any) {
    // If initialization fails (e.g., already initialized), fall back to getFirestore
    console.warn('Firestore initialization with cache failed, using default:', err?.message);
    db = getFirestore(app);
  }
} else {
  // Demo mode or already initialized - use standard getFirestore
  db = getFirestore(app);
}

export { db };

export default app;

