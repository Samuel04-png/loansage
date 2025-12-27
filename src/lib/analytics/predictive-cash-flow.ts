/**
 * Predictive Cash Flow Forecasting
 * Predicts future cash flows based on loan portfolio
 */

import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { callDeepSeekAPI } from '../ai/deepseek-client';

export interface CashFlowPrediction {
  period: string; // '1week' | '1month' | '3months' | '6months' | '1year'
  predictedInflow: number;
  predictedOutflow: number;
  netCashFlow: number;
  confidence: number; // 0-1
  breakdown: {
    loanDisbursements: number;
    repayments: number;
    interest: number;
    fees: number;
    defaults: number;
  };
  scenarios: {
    optimistic: { inflow: number; outflow: number; net: number };
    realistic: { inflow: number; outflow: number; net: number };
    pessimistic: { inflow: number; outflow: number; net: number };
  };
  warnings: string[];
  recommendations: string[];
}

/**
 * Predict cash flow for agency
 */
export async function predictCashFlow(
  agencyId: string,
  period: '1week' | '1month' | '3months' | '6months' | '1year' = '3months'
): Promise<CashFlowPrediction> {
  try {
    // Fetch all active and pending loans
    const loansRef = collection(db, 'agencies', agencyId, 'loans');
    const activeLoansQuery = query(
      loansRef,
      where('status', 'in', ['active', 'pending']),
      orderBy('createdAt', 'desc')
    );
    const loansSnapshot = await getDocs(activeLoansQuery);
    const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Calculate days in period
    const daysInPeriod = getDaysInPeriod(period);
    const now = new Date();
    const endDate = new Date(now.getTime() + daysInPeriod * 24 * 60 * 60 * 1000);
    
    // Predict repayments
    let predictedRepayments = 0;
    let predictedInterest = 0;
    let predictedFees = 0;
    let predictedDefaults = 0;
    
    // Predict disbursements
    const pendingLoans = loans.filter((l: any) => l.status === 'pending');
    let predictedDisbursements = 0;
    
    for (const loan of pendingLoans) {
      const disbursementDate = loan.disbursementDate?.toDate?.() || loan.createdAt?.toDate?.() || new Date(loan.createdAt);
      if (disbursementDate <= endDate) {
        predictedDisbursements += Number(loan.amount || 0);
      }
    }
    
    // Calculate expected repayments from active loans
    for (const loan of loans.filter((l: any) => l.status === 'active')) {
      try {
        const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
        const repaymentsSnapshot = await getDocs(repaymentsRef);
        const repayments = repaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Get pending repayments due in period
        const pendingRepayments = repayments.filter((r: any) => {
          if (r.status === 'paid') return false;
          const dueDate = r.dueDate?.toDate?.() || new Date(r.dueDate);
          return dueDate <= endDate;
        });
        
        // Predict payment probability based on history
        const paymentProbability = await calculatePaymentProbability(agencyId, loan.customerId || loan.customer_id, loan);
        
        for (const repayment of pendingRepayments) {
          const amountDue = Number(repayment.amountDue || 0);
          const interestAmount = Number(repayment.interestAmount || 0);
          const fees = Number(repayment.lateFee || 0) + Number(repayment.otherFees || 0);
          
          // Expected value = amount * probability
          predictedRepayments += amountDue * paymentProbability;
          predictedInterest += interestAmount * paymentProbability;
          predictedFees += fees * paymentProbability;
          
          // Default probability
          const defaultProbability = 1 - paymentProbability;
          predictedDefaults += amountDue * defaultProbability;
        }
      } catch (error) {
        // Skip if error
      }
    }
    
    // Use AI to enhance predictions
    const aiEnhanced = await enhancePredictionsWithAI({
      predictedRepayments,
      predictedInterest,
      predictedFees,
      predictedDefaults,
      predictedDisbursements,
      period,
      totalLoans: loans.length,
    });
    
    const predictedInflow = predictedRepayments + predictedInterest + predictedFees;
    const predictedOutflow = predictedDisbursements + predictedDefaults;
    const netCashFlow = predictedInflow - predictedOutflow;
    
    // Generate scenarios
    const scenarios = {
      optimistic: {
        inflow: predictedInflow * 1.15, // 15% better
        outflow: predictedOutflow * 0.9, // 10% less
        net: predictedInflow * 1.15 - predictedOutflow * 0.9,
      },
      realistic: {
        inflow: predictedInflow,
        outflow: predictedOutflow,
        net: netCashFlow,
      },
      pessimistic: {
        inflow: predictedInflow * 0.85, // 15% worse
        outflow: predictedOutflow * 1.1, // 10% more
        net: predictedInflow * 0.85 - predictedOutflow * 1.1,
      },
    };
    
    // Generate warnings and recommendations
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    if (netCashFlow < 0) {
      warnings.push('Negative cash flow predicted. Consider reducing disbursements.');
      recommendations.push('Review pending loan approvals');
      recommendations.push('Increase collection efforts');
    }
    
    if (predictedDefaults > predictedInflow * 0.2) {
      warnings.push('High default risk detected. Defaults may exceed 20% of inflows.');
      recommendations.push('Implement stricter credit checks');
      recommendations.push('Increase collection activities');
    }
    
    if (predictedDisbursements > predictedInflow) {
      warnings.push('Disbursements exceed expected repayments. Monitor liquidity.');
      recommendations.push('Stagger loan disbursements');
      recommendations.push('Secure additional funding if needed');
    }
    
    return {
      period,
      predictedInflow: Math.round(predictedInflow),
      predictedOutflow: Math.round(predictedOutflow),
      netCashFlow: Math.round(netCashFlow),
      confidence: aiEnhanced.confidence || 0.75,
      breakdown: {
        loanDisbursements: Math.round(predictedDisbursements),
        repayments: Math.round(predictedRepayments),
        interest: Math.round(predictedInterest),
        fees: Math.round(predictedFees),
        defaults: Math.round(predictedDefaults),
      },
      scenarios,
      warnings,
      recommendations,
    };
  } catch (error: any) {
    console.error('Cash flow prediction error:', error);
    throw error;
  }
}

/**
 * Calculate payment probability for a customer/loan
 */
async function calculatePaymentProbability(
  agencyId: string,
  customerId: string,
  loan: any
): Promise<number> {
  try {
    // Get customer's payment history
    const loansRef = collection(db, 'agencies', agencyId, 'loans');
    const customerLoansQuery = query(loansRef, where('customerId', '==', customerId));
    const loansSnapshot = await getDocs(customerLoansQuery);
    const customerLoans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    let totalRepayments = 0;
    let onTimeRepayments = 0;
    
    for (const customerLoan of customerLoans) {
      try {
        const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', customerLoan.id, 'repayments');
        const repaymentsSnapshot = await getDocs(repaymentsRef);
        const repayments = repaymentsSnapshot.docs.map(doc => doc.data());
        
        for (const repayment of repayments) {
          if (repayment.status === 'paid') {
            totalRepayments++;
            const dueDate = repayment.dueDate?.toDate?.() || new Date(repayment.dueDate);
            const paidDate = repayment.paidAt?.toDate?.() || new Date(repayment.paidAt);
            if (paidDate <= dueDate) {
              onTimeRepayments++;
            }
          }
        }
      } catch (error) {
        // Skip if error
      }
    }
    
    // Base probability on payment history
    const onTimeRate = totalRepayments > 0 ? onTimeRepayments / totalRepayments : 0.85;
    
    // Adjust based on loan risk score
    const riskScore = loan.riskScore || 50;
    const riskAdjustment = (100 - riskScore) / 100; // Higher risk = lower probability
    
    // Combine factors
    const probability = onTimeRate * 0.7 + riskAdjustment * 0.3;
    
    return Math.max(0.1, Math.min(0.95, probability)); // Cap between 10% and 95%
  } catch (error) {
    // Default probability
    return 0.75;
  }
}

/**
 * Enhance predictions with AI
 */
async function enhancePredictionsWithAI(data: any): Promise<{ confidence: number; adjustments?: any }> {
  try {
    const prompt = `Analyze this cash flow prediction data and provide confidence score (0-1) and any adjustments:
${JSON.stringify(data, null, 2)}

Consider:
- Historical payment patterns
- Economic factors
- Seasonal trends
- Portfolio composition

Respond with JSON: { confidence: number, adjustments: { ... } }`;

    const response = await callDeepSeekAPI([
      {
        role: 'system',
        content: 'You are a financial analyst. Provide structured analysis in JSON format.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], { temperature: 0.2, maxTokens: 300, agencyId });
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    // Fallback
  }
  
  return { confidence: 0.75 };
}

function getDaysInPeriod(period: string): number {
  switch (period) {
    case '1week': return 7;
    case '1month': return 30;
    case '3months': return 90;
    case '6months': return 180;
    case '1year': return 365;
    default: return 90;
  }
}

