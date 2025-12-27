/**
 * Hook for using AI Intelligence Engine
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { analyzeLoanSystem, AIInsight } from '../lib/ai/intelligence-engine';
import { useAgency } from './useAgency';
import { useAuth } from './useAuth';
import { useAIAlerts } from './useAIAlerts';

export function useAIInsights(enabled: boolean = true) {
  const { agency } = useAgency();
  const { profile } = useAuth();
  const { addAlert } = useAIAlerts();
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
        // Get all loans (no limit for comprehensive analysis)
        getDocs(query(collection(db, 'agencies', profile.agency_id, 'loans'), orderBy('createdAt', 'desc'))),
        // Get all customers
        getDocs(collection(db, 'agencies', profile.agency_id, 'customers')),
        // Get payments from all loans (comprehensive)
        (async () => {
          const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
          const loansSnap = await getDocs(loansRef);
          const allPayments: any[] = [];
          
          // Fetch repayments from all loans in parallel
          await Promise.all(
            loansSnap.docs.map(async (loanDoc) => {
              try {
                const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loanDoc.id, 'repayments');
                const repaymentsSnap = await getDocs(repaymentsRef);
                repaymentsSnap.docs.forEach(doc => {
                  allPayments.push({
                    id: doc.id,
                    loanId: loanDoc.id,
                    ...doc.data(),
                  });
                });
              } catch (error) {
                console.warn(`Failed to fetch repayments for loan ${loanDoc.id}:`, error);
              }
            })
          );
          
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

  // Auto-analyze when data changes (use ref to prevent infinite loops)
  const analysisDataRef = useRef(analysisData);
  const aiEnabledRef = useRef(aiEnabled);
  const lastAnalysisHashRef = useRef<string>('');

  // Analyze when data is available
  const analyze = useCallback(async () => {
    if (!analysisData || !aiEnabled || isAnalyzing) return;
    
    // Don't analyze if we already have insights for this data
    const dataHash = JSON.stringify({
      loans: analysisData.loans?.length || 0,
      customers: analysisData.customers?.length || 0,
      payments: analysisData.payments?.length || 0,
    });
    
    if (lastAnalysisHashRef.current === dataHash && insights.length > 0) {
      return; // Already analyzed this data
    }

    setIsAnalyzing(true);
    try {
      lastAnalysisHashRef.current = dataHash;
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<AIInsight[]>((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timeout')), 30000); // 30 second timeout
      });

      const analysisPromise = analyzeLoanSystem({
        ...analysisData,
        agencyId: profile.agency_id,
      });
      const newInsights = await Promise.race([analysisPromise, timeoutPromise]);
      
      setInsights(newInsights);
      
      // Convert critical/high severity insights to notifications/alerts
      const importantInsights = newInsights.filter(
        insight => insight.severity === 'critical' || insight.severity === 'high'
      );
      
      // Create notifications for important insights (fire and forget)
      for (const insight of importantInsights) {
        addAlert({
          type: insight.severity === 'critical' ? 'critical' : 'warning',
          title: insight.title,
          message: insight.message,
          loanId: insight.loanId,
          customerId: insight.customerId,
        }).catch(err => {
          console.warn('Failed to create alert notification:', err);
        });
      }
    } catch (error: any) {
      console.error('Error analyzing loan system:', error);
      
      // Generate fallback insights even if AI fails
      const fallbackInsights = generateFallbackInsights(analysisData);
      setInsights(fallbackInsights);
      
      // Also convert fallback insights to alerts if they're important
      const importantFallbacks = fallbackInsights.filter(
        insight => insight.severity === 'critical' || insight.severity === 'high'
      );
      
      // Create notifications for important fallback insights (fire and forget)
      for (const insight of importantFallbacks) {
        addAlert({
          type: insight.severity === 'critical' ? 'critical' : 'warning',
          title: insight.title,
          message: insight.message,
          loanId: insight.loanId,
          customerId: insight.customerId,
        }).catch(err => {
          console.warn('Failed to create fallback alert notification:', err);
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [analysisData, aiEnabled, isAnalyzing, addAlert, insights.length]);
  
  useEffect(() => {
    analysisDataRef.current = analysisData;
    aiEnabledRef.current = aiEnabled;
  }, [analysisData, aiEnabled]);

  useEffect(() => {
    if (analysisDataRef.current && aiEnabledRef.current && !isAnalyzing) {
      // Create a hash of the data to avoid re-analyzing the same data
      const dataHash = JSON.stringify({
        loans: analysisDataRef.current.loans?.length || 0,
        customers: analysisDataRef.current.customers?.length || 0,
        payments: analysisDataRef.current.payments?.length || 0,
      });
      
      // Only analyze if data has actually changed
      if (lastAnalysisHashRef.current !== dataHash) {
        // Use a debounce delay to prevent rapid re-analysis
        const timeoutId = setTimeout(() => {
          if (analysisDataRef.current && aiEnabledRef.current && lastAnalysisHashRef.current !== dataHash) {
            lastAnalysisHashRef.current = dataHash;
            analyze();
          }
        }, 1000); // Increased to 1 second to reduce flashing
        
        return () => clearTimeout(timeoutId);
      }
    } else if (!analysisDataRef.current || !aiEnabledRef.current) {
      setInsights([]);
      lastAnalysisHashRef.current = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisData, aiEnabled, isAnalyzing]);

  // Only show as analyzing if we're actively analyzing, not just loading data
  const isActuallyAnalyzing = isAnalyzing && !isLoading;
  
  return {
    insights,
    isAnalyzing: isActuallyAnalyzing,
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

/**
 * Generate fallback insights when AI fails
 */
function generateFallbackInsights(analysisData: any): AIInsight[] {
  const insights: AIInsight[] = [];
  const now = new Date();

  if (!analysisData || !analysisData.loans) {
    return insights;
  }

  const { loans, payments } = analysisData;

  // Check for overdue loans
  const activeLoans = loans.filter((l: any) => l.status === 'active');
  for (const loan of activeLoans) {
    const loanPayments = payments?.filter((p: any) => p.loanId === loan.id) || [];
    const overduePayments = loanPayments.filter((p: any) => {
      if (p.status === 'paid') return false;
      const dueDate = p.dueDate?.toDate?.() || new Date(p.dueDate);
      return dueDate < now;
    });

    if (overduePayments.length > 0) {
      insights.push({
        type: 'risk',
        severity: overduePayments.length >= 2 ? 'critical' : 'high',
        title: `Loan #${loan.id.substring(0, 8)} has overdue payments`,
        message: `${overduePayments.length} payment(s) are overdue. Action needed.`,
        loanId: loan.id,
        timestamp: now,
        action: {
          label: 'Review Loan',
          type: 'review_loan',
          data: { loanId: loan.id },
        },
      });
    }
  }

  // Check for pending loans that need review
  const pendingLoans = loans.filter((l: any) => l.status === 'pending');
  for (const loan of pendingLoans) {
    const createdAt = loan.createdAt?.toDate?.() || new Date(loan.createdAt);
    const daysPending = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysPending > 7) {
      insights.push({
        type: 'reminder',
        severity: 'medium',
        title: `Loan #${loan.id.substring(0, 8)} needs review`,
        message: `This loan has been pending for ${daysPending} days.`,
        loanId: loan.id,
        timestamp: now,
        action: {
          label: 'Review Loan',
          type: 'review_loan',
          data: { loanId: loan.id },
        },
      });
    }
  }

  // Check for high default rate
  const defaultedLoans = loans.filter((l: any) => l.status === 'defaulted');
  const defaultRate = loans.length > 0 ? (defaultedLoans.length / loans.length) * 100 : 0;
  
  if (defaultRate > 15) {
    insights.push({
      type: 'warning',
      severity: 'high',
      title: 'High default rate detected',
      message: `Default rate is ${defaultRate.toFixed(1)}% - above recommended threshold of 15%.`,
      timestamp: now,
    });
  }

  return insights;
}

