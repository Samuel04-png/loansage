/**
 * Presence Hook
 * Tracks user online/offline status and current activity
 */

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useAgency } from './useAgency';
import {
  updatePresence,
  removePresence,
  subscribeToPresence,
  setEditingLoan,
} from '../lib/firebase/realtime';

export interface PresenceData {
  online: boolean;
  lastSeen: number;
  currentPage?: string;
  editingLoanId?: string | null;
}

export interface AgencyPresence {
  [userId: string]: PresenceData;
}

/**
 * Hook to manage user presence
 */
export function usePresence(currentPage?: string) {
  const { user, profile } = useAuth();
  const { agency } = useAgency();
  const [agencyPresence, setAgencyPresence] = useState<AgencyPresence>({});
  const [isOnline, setIsOnline] = useState(true);
  
  // Update presence when component mounts or page changes
  useEffect(() => {
    if (!user?.id || !agency?.id) return;
    
    // Set initial presence
    updatePresence(user.id, agency.id, {
      currentPage,
    });
    
    // Update presence when page changes
    if (currentPage) {
      updatePresence(user.id, agency.id, {
        currentPage,
      });
    }
    
    // Cleanup on unmount
    return () => {
      removePresence(user.id, agency.id);
    };
  }, [user?.id, agency?.id, currentPage]);
  
  // Subscribe to agency presence
  useEffect(() => {
    if (!agency?.id) return;
    
    const unsubscribe = subscribeToPresence(agency.id, (presence) => {
      setAgencyPresence(presence);
      
      // Check if current user is online
      if (user?.id && presence[user.id]) {
        setIsOnline(presence[user.id].online || false);
      }
    });
    
    return unsubscribe;
  }, [agency?.id, user?.id]);
  
  // Track loan editing
  const startEditingLoan = async (loanId: string) => {
    if (!user?.id || !agency?.id) return;
    await setEditingLoan(user.id, agency.id, loanId);
  };
  
  const stopEditingLoan = async () => {
    if (!user?.id || !agency?.id) return;
    await setEditingLoan(user.id, agency.id, null);
  };
  
  // Get online users count
  const onlineUsersCount = Object.values(agencyPresence).filter(
    (p) => p.online
  ).length;
  
  // Get users editing a specific loan
  const getLoanEditors = (loanId: string): PresenceData[] => {
    return Object.values(agencyPresence).filter(
      (p) => p.online && p.editingLoanId === loanId
    );
  };
  
  return {
    agencyPresence,
    isOnline,
    onlineUsersCount,
    startEditingLoan,
    stopEditingLoan,
    getLoanEditors,
  };
}

