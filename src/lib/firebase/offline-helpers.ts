import { 
  setDoc, 
  updateDoc, 
  addDoc, 
  doc, 
  collection,
  getDoc,
  enableNetwork,
  disableNetwork,
  waitForPendingWrites,
  onSnapshot,
  getFirestore,
  Firestore
} from 'firebase/firestore';
import { db } from './config';

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Wait for Firestore to sync all pending writes
 */
export async function waitForSync(): Promise<void> {
  try {
    await waitForPendingWrites(db);
  } catch (error) {
    console.warn('Error waiting for sync:', error);
  }
}

/**
 * Enable Firestore network (if disabled)
 */
export async function enableFirestoreNetwork(): Promise<void> {
  try {
    await enableNetwork(db);
  } catch (error) {
    console.warn('Error enabling network:', error);
  }
}

/**
 * Disable Firestore network (for testing or manual control)
 */
export async function disableFirestoreNetwork(): Promise<void> {
  try {
    await disableNetwork(db);
  } catch (error) {
    console.warn('Error disabling network:', error);
  }
}

/**
 * Track a pending write operation
 */
export function trackPendingWrite(operation: string, data: any): void {
  try {
    const pending = localStorage.getItem('firestore_pending_writes');
    const writes = pending ? JSON.parse(pending) : [];
    
    writes.push({
      operation,
      data,
      timestamp: Date.now(),
    });
    
    localStorage.setItem('firestore_pending_writes', JSON.stringify(writes));
  } catch (error) {
    console.warn('Error tracking pending write:', error);
  }
}

/**
 * Remove a tracked write operation (after successful sync)
 */
export function removePendingWrite(timestamp: number): void {
  try {
    const pending = localStorage.getItem('firestore_pending_writes');
    if (!pending) return;
    
    const writes = JSON.parse(pending).filter(
      (write: any) => write.timestamp !== timestamp
    );
    
    localStorage.setItem('firestore_pending_writes', JSON.stringify(writes));
  } catch (error) {
    console.warn('Error removing pending write:', error);
  }
}

/**
 * Get all pending writes
 */
export function getPendingWrites(): any[] {
  try {
    const pending = localStorage.getItem('firestore_pending_writes');
    return pending ? JSON.parse(pending) : [];
  } catch {
    return [];
  }
}

/**
 * Clear all pending writes (after successful sync)
 */
export function clearPendingWrites(): void {
  try {
    localStorage.removeItem('firestore_pending_writes');
  } catch (error) {
    console.warn('Error clearing pending writes:', error);
  }
}

/**
 * Enhanced setDoc that works offline and tracks pending writes
 */
export async function setDocOffline(
  docRef: ReturnType<typeof doc>,
  data: any
): Promise<void> {
  const timestamp = Date.now();
  
  // Track the write
  trackPendingWrite('setDoc', { path: docRef.path, data });
  
  try {
    await setDoc(docRef, data);
    // If successful and online, remove from pending
    if (isOnline()) {
      removePendingWrite(timestamp);
    }
  } catch (error: any) {
    // If offline, Firestore will queue the write automatically
    // We just need to track it
    if (error?.code === 'unavailable' || !isOnline()) {
      console.log('Write queued for offline sync:', docRef.path);
    } else {
      // Real error, remove from tracking
      removePendingWrite(timestamp);
      throw error;
    }
  }
}

/**
 * Enhanced updateDoc that works offline
 */
export async function updateDocOffline(
  docRef: ReturnType<typeof doc>,
  data: any
): Promise<void> {
  const timestamp = Date.now();
  
  trackPendingWrite('updateDoc', { path: docRef.path, data });
  
  try {
    await updateDoc(docRef, data);
    if (isOnline()) {
      removePendingWrite(timestamp);
    }
  } catch (error: any) {
    if (error?.code === 'unavailable' || !isOnline()) {
      console.log('Update queued for offline sync:', docRef.path);
    } else {
      removePendingWrite(timestamp);
      throw error;
    }
  }
}

/**
 * Enhanced addDoc that works offline
 */
export async function addDocOffline(
  collectionRef: ReturnType<typeof collection>,
  data: any
): Promise<ReturnType<typeof doc>> {
  const timestamp = Date.now();
  
  trackPendingWrite('addDoc', { path: collectionRef.path, data });
  
  try {
    const docRef = await addDoc(collectionRef, data);
    if (isOnline()) {
      removePendingWrite(timestamp);
    }
    return docRef;
  } catch (error: any) {
    if (error?.code === 'unavailable' || !isOnline()) {
      console.log('Add queued for offline sync:', collectionRef.path);
      // Return a temporary doc reference
      return doc(collectionRef, `temp-${timestamp}`);
    } else {
      removePendingWrite(timestamp);
      throw error;
    }
  }
}

/**
 * Monitor Firestore connection state
 */
export function onFirestoreConnectionChange(
  callback: (connected: boolean) => void
): () => void {
  // Firestore doesn't have a direct connection state listener
  // So we use a combination of network status and document reads
  let isConnected = isOnline();
  
  const handleOnline = () => {
    isConnected = true;
    callback(true);
  };
  
  const handleOffline = () => {
    isConnected = false;
    callback(false);
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Also try to detect Firestore connection by attempting a read
  const checkConnection = async () => {
    try {
      // Try to read a non-existent document to check connection
      const testDoc = doc(db, '_connection_test', 'test');
      await getDoc(testDoc);
      if (!isConnected) {
        isConnected = true;
        callback(true);
      }
    } catch (error: any) {
      if (error?.code === 'unavailable' && isConnected) {
        isConnected = false;
        callback(false);
      }
    }
  };
  
  // Check periodically
  const interval = setInterval(checkConnection, 5000);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(interval);
  };
}

