/**
 * Realtime Database Configuration and Helpers
 * Used for real-time collaboration, presence tracking, and live updates
 */

import { getDatabase, Database, ref, onValue, off, set, serverTimestamp, onDisconnect, connectDatabaseEmulator } from 'firebase/database';
import { getApps } from 'firebase/app';
import app from './config';

let database: Database | null = null;

/**
 * Initialize Realtime Database
 */
export function initRealtimeDatabase(): Database {
  if (!database) {
    try {
      database = getDatabase(app);
      
      // Connect to emulator in development if configured
      if (import.meta.env.DEV && import.meta.env.VITE_REALTIME_EMULATOR_HOST) {
        try {
          connectDatabaseEmulator(database, 'localhost', 9000);
        } catch (error: any) {
          // Emulator already connected, ignore
          if (!error.message?.includes('already been connected')) {
            console.warn('Could not connect to Realtime Database emulator:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize Realtime Database:', error);
      throw error;
    }
  }
  return database;
}

/**
 * Get Realtime Database instance
 */
export function getRealtimeDB(): Database {
  if (!database) {
    return initRealtimeDatabase();
  }
  return database;
}

/**
 * Update user presence (online/offline status)
 */
export async function updatePresence(userId: string, agencyId: string, metadata?: {
  currentPage?: string;
  editingLoanId?: string | null;
  userAgent?: string;
}): Promise<void> {
  const db = getRealtimeDB();
  const presenceRef = ref(db, `presence/${agencyId}/${userId}`);
  
  // Set user as online
  await set(presenceRef, {
    online: true,
    lastSeen: serverTimestamp(),
    ...metadata,
  });
  
  // Set up disconnect handler to mark user as offline
  onDisconnect(presenceRef).set({
    online: false,
    lastSeen: serverTimestamp(),
  });
}

/**
 * Remove user presence
 */
export async function removePresence(userId: string, agencyId: string): Promise<void> {
  const db = getRealtimeDB();
  const presenceRef = ref(db, `presence/${agencyId}/${userId}`);
  await set(presenceRef, null);
}

/**
 * Subscribe to presence changes for an agency
 */
export function subscribeToPresence(
  agencyId: string,
  callback: (presence: Record<string, any>) => void
): () => void {
  const db = getRealtimeDB();
  const presenceRef = ref(db, `presence/${agencyId}`);
  
  const unsubscribe = onValue(presenceRef, (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  return () => {
    off(presenceRef);
    unsubscribe();
  };
}

/**
 * Track loan editing activity
 */
export async function setEditingLoan(
  userId: string,
  agencyId: string,
  loanId: string | null
): Promise<void> {
  await updatePresence(userId, agencyId, {
    editingLoanId: loanId,
  });
}

/**
 * Subscribe to who's editing a specific loan
 */
export function subscribeToLoanEditors(
  agencyId: string,
  loanId: string,
  callback: (editors: Record<string, any>) => void
): () => void {
  const db = getRealtimeDB();
  const editorsRef = ref(db, `presence/${agencyId}`);
  
  const unsubscribe = onValue(editorsRef, (snapshot) => {
    const allPresence = snapshot.val() || {};
    const editors: Record<string, any> = {};
    
    // Filter users editing this loan
    Object.entries(allPresence).forEach(([userId, data]: [string, any]) => {
      if (data?.editingLoanId === loanId && data?.online) {
        editors[userId] = data;
      }
    });
    
    callback(editors);
  });
  
  return () => {
    off(editorsRef);
    unsubscribe();
  };
}

/**
 * Add activity log entry
 */
export async function addActivity(
  agencyId: string,
  activity: {
    type: string;
    userId: string;
    data?: any;
  }
): Promise<void> {
  const db = getRealtimeDB();
  const activityRef = ref(db, `activity/${agencyId}/${Date.now()}`);
  
  await set(activityRef, {
    ...activity,
    timestamp: serverTimestamp(),
  });
}

/**
 * Subscribe to activity feed
 */
export function subscribeToActivity(
  agencyId: string,
  callback: (activities: Array<{ id: string; data: any }>) => void,
  limit: number = 50
): () => void {
  const db = getRealtimeDB();
  const activityRef = ref(db, `activity/${agencyId}`);
  
  const unsubscribe = onValue(activityRef, (snapshot) => {
    const data = snapshot.val() || {};
    const activities = Object.entries(data)
      .map(([id, activity]: [string, any]) => ({ id, data: activity }))
      .sort((a, b) => {
        const aTime = a.data?.timestamp || 0;
        const bTime = b.data?.timestamp || 0;
        return bTime - aTime; // Most recent first
      })
      .slice(0, limit);
    
    callback(activities);
  });
  
  return () => {
    off(activityRef);
    unsubscribe();
  };
}

/**
 * Real-time collaboration: Track changes to a document
 */
export async function trackDocumentChange(
  agencyId: string,
  documentId: string,
  userId: string,
  change: {
    field: string;
    oldValue: any;
    newValue: any;
  }
): Promise<void> {
  const db = getRealtimeDB();
  const changeRef = ref(db, `collaboration/${agencyId}/${documentId}/changes/${Date.now()}`);
  
  await set(changeRef, {
    userId,
    ...change,
    timestamp: serverTimestamp(),
  });
}

/**
 * Subscribe to document changes
 */
export function subscribeToDocumentChanges(
  agencyId: string,
  documentId: string,
  callback: (changes: Array<{ id: string; data: any }>) => void
): () => void {
  const db = getRealtimeDB();
  const changesRef = ref(db, `collaboration/${agencyId}/${documentId}/changes`);
  
  const unsubscribe = onValue(changesRef, (snapshot) => {
    const data = snapshot.val() || {};
    const changes = Object.entries(data)
      .map(([id, change]: [string, any]) => ({ id, data: change }))
      .sort((a, b) => {
        const aTime = a.data?.timestamp || 0;
        const bTime = b.data?.timestamp || 0;
        return aTime - bTime; // Oldest first
      });
    
    callback(changes);
  });
  
  return () => {
    off(changesRef);
    unsubscribe();
  };
}

