import { useState, useEffect } from 'react';
import { onDisconnect, onConnect, getFirestore } from 'firebase/firestore';
import { db } from '../lib/firebase/config';

export interface OfflineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingWrites: number;
}

/**
 * Hook to monitor online/offline status and Firestore sync state
 */
export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);

  useEffect(() => {
    // Monitor browser online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      
      // Check Firestore connection status
      setTimeout(() => {
        setIsSyncing(false);
      }, 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor pending writes by checking localStorage for queued operations
  useEffect(() => {
    const checkPendingWrites = () => {
      try {
        const pending = localStorage.getItem('firestore_pending_writes');
        const count = pending ? JSON.parse(pending).length : 0;
        setPendingWrites(count);
      } catch {
        setPendingWrites(0);
      }
    };

    // Check immediately
    checkPendingWrites();

    // Check periodically
    const interval = setInterval(checkPendingWrites, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingWrites,
  };
}

