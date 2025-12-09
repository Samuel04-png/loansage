/**
 * AI Intelligence Triggers
 * Automatically trigger AI analysis when system events occur
 * 
 * Note: These functions should be called with a QueryClient instance
 * from the component that triggers the event
 */

/**
 * Trigger AI analysis refresh after loan operations
 */
export function triggerLoanAnalysis(queryClient: any, agencyId: string) {
  // Invalidate AI insights query to trigger re-analysis
  queryClient.invalidateQueries({ queryKey: ['ai-analysis-data', agencyId] });
  queryClient.invalidateQueries({ queryKey: ['loan-ai-insights'] });
}

/**
 * Trigger AI analysis refresh after customer operations
 */
export function triggerCustomerAnalysis(queryClient: any, agencyId: string) {
  queryClient.invalidateQueries({ queryKey: ['ai-analysis-data', agencyId] });
}

/**
 * Trigger AI analysis refresh after payment operations
 */
export function triggerPaymentAnalysis(queryClient: any, agencyId: string, loanId?: string) {
  queryClient.invalidateQueries({ queryKey: ['ai-analysis-data', agencyId] });
  if (loanId) {
    queryClient.invalidateQueries({ queryKey: ['loan-ai-insights', loanId] });
  }
}

/**
 * Trigger AI analysis refresh after status changes
 */
export function triggerStatusAnalysis(queryClient: any, agencyId: string, loanId?: string) {
  queryClient.invalidateQueries({ queryKey: ['ai-analysis-data', agencyId] });
  if (loanId) {
    queryClient.invalidateQueries({ queryKey: ['loan-ai-insights', loanId] });
  }
}

