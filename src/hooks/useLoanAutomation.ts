import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { updateLoanRepayments, updateLoanStatus, getOverdueSummary } from '../lib/firebase/loan-automation';
import { useAuth } from './useAuth';

/**
 * Hook to automatically check and update loan statuses
 * Runs periodically to check due dates and update statuses
 */
export function useLoanAutomation(agencyId?: string, enabled: boolean = true) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const effectiveAgencyId = agencyId || profile?.agency_id;

  // Check loans every 5 minutes
  const { data: overdueSummary } = useQuery({
    queryKey: ['loan-automation', effectiveAgencyId],
    queryFn: async () => {
      if (!effectiveAgencyId) return null;
      
      // Get overdue summary (this also triggers updates)
      return await getOverdueSummary(effectiveAgencyId);
    },
    enabled: !!effectiveAgencyId && enabled,
    refetchInterval: 5 * 60 * 1000, // Every 5 minutes
    refetchOnWindowFocus: true,
  });

  // Process all loans periodically (every 15 minutes)
  useEffect(() => {
    if (!effectiveAgencyId || !enabled) return;

    const interval = setInterval(async () => {
      try {
        const { processAllLoans } = await import('../lib/firebase/loan-automation');
        await processAllLoans(effectiveAgencyId);
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['loans'] });
        queryClient.invalidateQueries({ queryKey: ['loan'] });
      } catch (error) {
        console.error('Error processing loans:', error);
      }
    }, 15 * 60 * 1000); // Every 15 minutes

    return () => clearInterval(interval);
  }, [effectiveAgencyId, enabled, queryClient]);

  return {
    overdueSummary,
  };
}

/**
 * Hook to manually trigger loan status update
 */
export function useManualLoanUpdate() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const updateLoan = async (loanId: string) => {
    if (!profile?.agency_id) return;

    try {
      await updateLoanRepayments(profile.agency_id, loanId);
      await updateLoanStatus(profile.agency_id, loanId);
      
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
      
      return { success: true };
    } catch (error: any) {
      console.error('Error updating loan:', error);
      return { success: false, error: error.message };
    }
  };

  return { updateLoan };
}

