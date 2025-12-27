/**
 * AI-Powered Predictive Analytics
 * Predicts loan defaults, customer behavior, and portfolio performance
 */

import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

interface HistoricalData {
  loans: any[];
  repayments: any[];
  customers: any[];
}

interface PredictionResult {
  prediction: number; // 0-1 probability
  confidence: number; // 0-1
  factors: string[];
  timeframe: string;
}

/**
 * Analyze portfolio and predict default rates
 * Enterprise feature - requires advancedAnalytics feature flag
 */
export async function predictPortfolioDefaults(
  agencyId: string,
  timeframe: '30days' | '90days' | '6months' | '1year' = '90days',
  agencyFeatures?: { advancedAnalytics?: boolean }
): Promise<{
  predictedDefaultRate: number;
  atRiskLoans: number;
  totalExposure: number;
  recommendations: string[];
}> {
  // Enterprise feature check
  if (agencyFeatures && !agencyFeatures.advancedAnalytics) {
    throw new Error('Advanced AI predictions are available on Enterprise plan only. Please upgrade to access this feature.');
  }
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const activeLoansQuery = query(
    loansRef,
    where('status', 'in', ['active', 'pending']),
    orderBy('createdAt', 'desc')
  );
  const loansSnapshot = await getDocs(activeLoansQuery);
  const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  let atRiskLoans = 0;
  let totalExposure = 0;
  const riskFactors: string[] = [];

  for (const loan of loans) {
    totalExposure += Number((loan as any).amount || 0);
    
    // Check repayments
    const repaymentsRef = collection(
      db,
      'agencies',
      agencyId,
      'loans',
      loan.id,
      'repayments'
    );
    const repaymentsSnapshot = await getDocs(repaymentsRef);
    const repayments = repaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Check for overdue repayments
    const now = new Date();
    const overdueCount = repayments.filter((r: any) => {
      const dueDate = r.dueDate?.toDate?.() || new Date(r.dueDate);
      return r.status === 'pending' && dueDate < now;
    }).length;

    if (overdueCount > 0) {
      atRiskLoans++;
      riskFactors.push(`Loan ${loan.id.substring(0, 8)} has ${overdueCount} overdue repayments`);
    }

    // Check payment history
    const paidCount = repayments.filter((r: any) => r.status === 'paid').length;
    const totalCount = repayments.length;
    const paymentRate = totalCount > 0 ? paidCount / totalCount : 1;

    if (paymentRate < 0.7 && totalCount > 3) {
      atRiskLoans++;
      riskFactors.push(`Loan ${loan.id.substring(0, 8)} has low payment rate (${Math.round(paymentRate * 100)}%)`);
    }
  }

  const predictedDefaultRate = loans.length > 0 ? (atRiskLoans / loans.length) * 100 : 0;

  const recommendations: string[] = [];
  if (predictedDefaultRate > 15) {
    recommendations.push('High default risk detected. Consider increasing collection efforts.');
    recommendations.push('Review loans with overdue repayments immediately.');
  } else if (predictedDefaultRate > 10) {
    recommendations.push('Moderate default risk. Monitor at-risk loans closely.');
  } else {
    recommendations.push('Portfolio health is good. Continue current practices.');
  }

  if (riskFactors.length > 0) {
    recommendations.push(`Focus on ${atRiskLoans} loans showing risk indicators.`);
  }

  return {
    predictedDefaultRate: Math.round(predictedDefaultRate * 10) / 10,
    atRiskLoans,
    totalExposure,
    recommendations,
  };
}

/**
 * Predict customer lifetime value
 */
export function predictCustomerLTV(customerData: {
  totalLoans: number;
  averageLoanAmount: number;
  completionRate: number;
  averageInterestRate: number;
}): {
  predictedLTV: number;
  confidence: number;
  factors: string[];
} {
  const { totalLoans, averageLoanAmount, completionRate, averageInterestRate } = customerData;

  // Simple LTV calculation: expected future loans * average amount * interest margin
  const expectedFutureLoans = totalLoans > 0 
    ? Math.max(1, Math.round(totalLoans * completionRate * 1.2)) // Assume 20% growth
    : 2; // New customers expected to take 2 loans

  const interestMargin = averageInterestRate * 0.3; // Assume 30% of interest is profit
  const predictedLTV = expectedFutureLoans * averageLoanAmount * (interestMargin / 100);

  const confidence = totalLoans > 0 ? Math.min(0.9, 0.5 + (totalLoans * 0.1)) : 0.3;

  const factors: string[] = [];
  if (completionRate > 0.8) {
    factors.push('High completion rate indicates reliable customer');
  }
  if (totalLoans > 3) {
    factors.push('Established customer with multiple loans');
  }

  return {
    predictedLTV: Math.round(predictedLTV),
    confidence: Math.round(confidence * 100) / 100,
    factors,
  };
}

/**
 * Predict optimal loan amount for customer
 */
export function predictOptimalLoanAmount(customerData: {
  monthlyIncome: number;
  existingDebt: number;
  creditHistory: {
    totalLoans: number;
    completedLoans: number;
    averageLoanAmount: number;
  };
}): {
  recommendedAmount: number;
  maxSafeAmount: number;
  reasoning: string;
} {
  const { monthlyIncome, existingDebt, creditHistory } = customerData;

  // Calculate debt-to-income ratio
  const monthlyDebtPayment = existingDebt / 12; // Simplified
  const currentDTI = monthlyDebtPayment / monthlyIncome;

  // Maximum safe DTI is typically 40%
  const maxSafeDTI = 0.4;
  const availableDTI = maxSafeDTI - currentDTI;

  // Calculate maximum safe loan amount
  // Assuming 12% interest and 24-month term
  const interestRate = 0.12;
  const termMonths = 24;
  const monthlyRate = interestRate / 12;
  const monthlyPaymentCapacity = monthlyIncome * availableDTI;
  
  // Reverse calculate loan amount from payment capacity
  const maxSafeAmount = monthlyPaymentCapacity * 
    ((1 - Math.pow(1 + monthlyRate, -termMonths)) / monthlyRate);

  // Consider historical loan amounts
  const historicalAverage = creditHistory.averageLoanAmount || 0;
  const recommendedAmount = Math.min(
    maxSafeAmount,
    historicalAverage * 1.2, // 20% increase from average
    monthlyIncome * 6 // 6 months of income as max
  );

  let reasoning = '';
  if (recommendedAmount >= maxSafeAmount * 0.9) {
    reasoning = 'Customer is at maximum safe borrowing capacity.';
  } else if (recommendedAmount > historicalAverage) {
    reasoning = 'Recommended amount is higher than historical average, indicating growth potential.';
  } else {
    reasoning = 'Recommended amount is conservative based on credit history.';
  }

  return {
    recommendedAmount: Math.round(recommendedAmount),
    maxSafeAmount: Math.round(maxSafeAmount),
    reasoning,
  };
}

/**
 * Detect anomalies in loan applications
 */
export function detectLoanAnomalies(loanData: {
  amount: number;
  interestRate: number;
  durationMonths: number;
  customerHistory?: {
    averageLoanAmount: number;
    averageDuration: number;
  };
}): {
  hasAnomalies: boolean;
  anomalies: string[];
  riskLevel: 'low' | 'medium' | 'high';
} {
  const anomalies: string[] = [];
  const { amount, interestRate, durationMonths, customerHistory } = loanData;

  // Check for unusual amounts
  if (customerHistory) {
    const amountDeviation = Math.abs(amount - customerHistory.averageLoanAmount) / customerHistory.averageLoanAmount;
    if (amountDeviation > 0.5) {
      anomalies.push(`Loan amount is ${Math.round(amountDeviation * 100)}% different from customer's average`);
    }

    const durationDeviation = Math.abs(durationMonths - customerHistory.averageDuration) / customerHistory.averageDuration;
    if (durationDeviation > 0.4) {
      anomalies.push(`Loan duration is ${Math.round(durationDeviation * 100)}% different from customer's average`);
    }
  }

  // Check for suspicious patterns
  if (interestRate > 25) {
    anomalies.push('Unusually high interest rate');
  }

  if (durationMonths > 60) {
    anomalies.push('Very long repayment period');
  }

  if (amount > 500000) {
    anomalies.push('Very large loan amount');
  }

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (anomalies.length > 2) {
    riskLevel = 'high';
  } else if (anomalies.length > 0) {
    riskLevel = 'medium';
  }

  return {
    hasAnomalies: anomalies.length > 0,
    anomalies,
    riskLevel,
  };
}

/**
 * Predict loan default probability for a specific loan
 * Enterprise feature - requires advancedAnalytics feature flag
 */
export async function predictLoanDefault(
  agencyId: string,
  loanId: string,
  agencyFeatures?: { advancedAnalytics?: boolean }
): Promise<{
  defaultProbability: number; // 0-1
  confidence: number; // 0-1
  timeframe: string;
  factors: string[];
  recommendations: string[];
}> {
  // Enterprise feature check
  if (agencyFeatures && !agencyFeatures.advancedAnalytics) {
    throw new Error('Advanced AI predictions are available on Enterprise plan only. Please upgrade to access this feature.');
  }
  
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
    const loanSnap = await getDoc(loanRef);
    
    if (!loanSnap.exists()) {
      throw new Error('Loan not found');
    }
    
    const loan = { id: loanSnap.id, ...loanSnap.data() } as any;
    
    // Get repayment history
    const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loanId, 'repayments');
    const repaymentsSnapshot = await getDocs(repaymentsRef);
    const repayments = repaymentsSnapshot.docs.map(doc => doc.data());
    
    // Calculate factors
    const factors: string[] = [];
    let defaultProbability = 0.1; // Base 10%
    
    // Check for overdue repayments
    const now = new Date();
    const overdueRepayments = repayments.filter((r: any) => {
      if (r.status === 'paid') return false;
      const dueDate = r.dueDate?.toDate?.() || new Date(r.dueDate);
      return dueDate < now;
    });
    
    if (overdueRepayments.length > 0) {
      defaultProbability += 0.3;
      factors.push(`${overdueRepayments.length} overdue repayment(s)`);
    }
    
    // Check payment history
    const paidRepayments = repayments.filter((r: any) => r.status === 'paid');
    const totalRepayments = repayments.length;
    const paymentRate = totalRepayments > 0 ? paidRepayments.length / totalRepayments : 1;
    
    if (paymentRate < 0.7) {
      defaultProbability += 0.2;
      factors.push(`Low payment rate: ${Math.round(paymentRate * 100)}%`);
    }
    
    // Check loan risk score
    const riskScore = loan.riskScore || 50;
    if (riskScore > 70) {
      defaultProbability += 0.2;
      factors.push(`High risk score: ${riskScore}/100`);
    }
    
    // Check loan amount relative to customer income
    const customerId = loan.customerId || loan.customer_id;
    if (customerId) {
      const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
      const customerSnap = await getDoc(customerRef);
      if (customerSnap.exists()) {
        const customer = customerSnap.data();
        const monthlyIncome = Number(customer.monthlyIncome || 0);
        const loanAmount = Number(loan.amount || 0);
        
        if (monthlyIncome > 0 && loanAmount > monthlyIncome * 12) {
          defaultProbability += 0.15;
          factors.push('Loan amount exceeds annual income');
        }
      }
    }
    
    // Cap probability
    defaultProbability = Math.min(0.95, defaultProbability);
    
    // Generate recommendations
    const recommendations: string[] = [];
    if (defaultProbability > 0.5) {
      recommendations.push('High default risk. Consider restructuring or early intervention.');
      recommendations.push('Increase collection efforts immediately.');
    } else if (defaultProbability > 0.3) {
      recommendations.push('Moderate default risk. Monitor closely.');
      recommendations.push('Send payment reminders.');
    } else {
      recommendations.push('Low default risk. Continue normal operations.');
    }
    
    return {
      defaultProbability: Math.round(defaultProbability * 100) / 100,
      confidence: 0.75,
      timeframe: '90days',
      factors,
      recommendations,
    };
  } catch (error: any) {
    console.error('Error predicting loan default:', error);
    throw error;
  }
}

/**
 * Predict portfolio default rate
 */
export async function predictPortfolioDefaultRate(
  agencyId: string,
  timeframe: '30days' | '90days' | '6months' | '1year' = '90days'
): Promise<{
  predictedDefaultRate: number;
  atRiskLoans: number;
  totalExposure: number;
  recommendations: string[];
}> {
  return predictPortfolioDefaults(agencyId, timeframe);
}

