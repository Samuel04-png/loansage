import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { useAuth } from './useAuth';

export interface LoanStatusCounts {
  pending: number;
  approved: number;
  rejected: number;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch real-time loan counts by status for the current agency
 * Approved/Rejected counts include only loans updated in the last 24 hours
 */
export const useLoanStatusCounts = (): LoanStatusCounts => {
  const { user } = useAuth();
    const { profile } = useAuth();
  const [counts, setCounts] = useState<LoanStatusCounts>({
    pending: 0,
    approved: 0,
    rejected: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!profile?.agency_id) {
      setCounts((prev) => ({
        ...prev,
        loading: false,
        error: 'No agency ID found',
      }));
      return;
    }

    // Calculate timestamp for 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const timestamp24hAgo = Timestamp.fromDate(twentyFourHoursAgo);

    // Set up listeners for each status
    const unsubscribers: (() => void)[] = [];

    // Pending loans query (scoped to agency subcollection)
    const pendingQuery = query(
      collection(db, 'agencies', profile.agency_id, 'loans'),
      where('status', '==', 'pending')
    );

    const unsubscribePending = onSnapshot(
      pendingQuery,
      (snapshot) => {
        setCounts((prev) => ({
          ...prev,
          pending: snapshot.docs.length,
          loading: false,
        }));
      },
      (error) => {
        console.error('Error fetching pending loans:', error);
        const errMsg = error?.code === 'permission-denied' ? 'Permission denied - check agency membership' : 'Failed to load pending count';
        setCounts((prev) => ({
          ...prev,
          error: errMsg,
          loading: false,
        }));
      }
    );
    unsubscribers.push(unsubscribePending);

    // Approved loans query (last 24 hours)
    const approvedQuery = query(
      collection(db, 'agencies', profile.agency_id, 'loans'),
      where('status', '==', 'approved'),
      where('updatedAt', '>=', timestamp24hAgo)
    );

    const unsubscribeApproved = onSnapshot(
      approvedQuery,
      (snapshot) => {
        setCounts((prev) => ({
          ...prev,
          approved: snapshot.docs.length,
          loading: false,
        }));
      },
      (error) => {
        console.error('Error fetching approved loans:', error);
        const errMsg = error?.code === 'permission-denied' ? 'Permission denied - check agency membership' : 'Failed to load approved count';
        setCounts((prev) => ({
          ...prev,
          error: errMsg,
          loading: false,
        }));
      }
    );
    unsubscribers.push(unsubscribeApproved);

    // Rejected loans query (last 24 hours)
    const rejectedQuery = query(
      collection(db, 'agencies', profile.agency_id, 'loans'),
      where('status', '==', 'rejected'),
      where('updatedAt', '>=', timestamp24hAgo)
    );

    const unsubscribeRejected = onSnapshot(
      rejectedQuery,
      (snapshot) => {
        setCounts((prev) => ({
          ...prev,
          rejected: snapshot.docs.length,
          loading: false,
        }));
      },
      (error) => {
        console.error('Error fetching rejected loans:', error);
        const errMsg = error?.code === 'permission-denied' ? 'Permission denied - check agency membership' : 'Failed to load rejected count';
        setCounts((prev) => ({
          ...prev,
          error: errMsg,
          loading: false,
        }));
      }
    );
    unsubscribers.push(unsubscribeRejected);

    // Cleanup listeners on unmount
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [profile?.agency_id]);

  return counts;
};
