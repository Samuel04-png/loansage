/**
 * Hook for using AI Intelligence Engine
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { analyzeLoanSystem, AIInsight } from '../lib/ai/intelligence-engine';
import { useAgency } from './useAgency';
import { useAuth } from './useAuth';

export function useAIInsights(enabled: boolean = true) {
  const { agency } = useAgency();
  const { profile } = useAuth();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Check if AI is enabled
  const aiEnabled = agency?.settings?.aiEnabled !== false;

  // Fetch data for analysis
  const { data: analysisData, isLoading } = useQuery({
    queryKey: ['ai-analysis-data', agency?.id, profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id || !aiEnabled) return null;

      const [loansSnapshot, customersSnapshot, paymentsData] = await Promise.all([
        getDocs(query(collection(db, 'agencies', profile.agency_id, 'loans'), orderBy('createdAt', 'desc'), limit(1000))),
        getDocs(collection(db, 'agencies', profile.agency_id, 'customers')),
        // Get payments from all loans
        (async () => {
          const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
          const loansSnap = await getDocs(query(loansRef, limit(100)));
          const allPayments: any[] = [];
          
          for (const loanDoc of loansSnap.docs) {
            const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loanDoc.id, 'repayments');
            const repaymentsSnap = await getDocs(repaymentsRef);
            repaymentsSnap.docs.forEach(doc => {
              allPayments.push({
                id: doc.id,
                loanId: loanDoc.id,
                ...doc.data(),
              });
            });
          }
          
          return allPayments;
        })(),
      ]);

      const loans = loansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      const customers = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        loans,
        customers,
        payments: paymentsData,
        agencyId: profile.agency_id,
      };
    },
    enabled: enabled && !!profile?.agency_id && aiEnabled,
    staleTime: 60000, // Cache for 1 minute
  });

  // Analyze when data is available
  const analyze = useCallback(async () => {
    if (!analysisData || !aiEnabled || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const newInsights = await analyzeLoanSystem(analysisData);
      setInsights(newInsights);
    } catch (error) {
      console.error('Error analyzing loan system:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [analysisData, aiEnabled, isAnalyzing]);

  // Auto-analyze when data changes
  useEffect(() => {
    if (analysisData && aiEnabled) {
      analyze();
    } else {
      setInsights([]);
    }
  }, [analysisData, aiEnabled, analyze]);

  return {
    insights,
    isAnalyzing: isLoading || isAnalyzing,
    aiEnabled,
    refresh: analyze,
  };
}

/**
 * Hook for loan-specific AI insights
 */
export function useLoanAIInsights(loanId: string | undefined, enabled: boolean = true) {
  const { agency } = useAgency();
  const { profile } = useAuth();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const aiEnabled = agency?.settings?.aiEnabled !== false;

  const { data, isLoading } = useQuery({
    queryKey: ['loan-ai-insights', loanId, profile?.agency_id],
    queryFn: async () => {
      if (!loanId || !profile?.agency_id || !aiEnabled) return null;

      const [loanDoc, repaymentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'agencies', profile.agency_id, 'loans'), where('__name__', '==', loanId), limit(1))),
        (async () => {
          const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loanId, 'repayments');
          return await getDocs(repaymentsRef);
        })(),
      ]);

      if (loanDoc.empty) return null;

      const loan = { id: loanDoc.docs[0].id, ...loanDoc.docs[0].data() };
      const payments = repaymentsSnap.docs.map(doc => ({
        id: doc.id,
        loanId,
        ...doc.data(),
      }));

      return { loan, payments };
    },
    enabled: enabled && !!loanId && !!profile?.agency_id && aiEnabled,
  });

  useEffect(() => {
    if (data && aiEnabled) {
      // Import and use payment health analysis
      import('../lib/ai/intelligence-engine').then(({ analyzePaymentHealth }) => {
        analyzePaymentHealth(data.loan, data.payments).then(setInsights);
      });
    } else {
      setInsights([]);
    }
  }, [data, aiEnabled]);

  return {
    insights,
    isLoading,
    aiEnabled,
  };
}

