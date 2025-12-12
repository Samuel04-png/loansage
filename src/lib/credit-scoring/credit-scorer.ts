/**
 * Credit Scoring and Risk Assessment Engine
 */

import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CreditScore, RiskAssessment } from '../../types/features';
import { lookupNRC } from '../ai/nrc-lookup';

/**
 * Calculate credit score for a customer
 */
export async function calculateCreditScore(
  agencyId: string,
  customerId: string,
  loanAmount?: number
): Promise<CreditScore> {
  // Get customer data
  const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
  const customerSnap = await getDoc(customerRef);
  
  if (!customerSnap.exists()) {
    throw new Error('Customer not found');
  }

  const customerData = customerSnap.data();
  const nrc = customerData.nrc || customerData.nrcNumber;

  // Get customer's loan history
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const loansQuery = query(
    loansRef,
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  );
  
  let loansSnapshot;
  try {
    loansSnapshot = await getDocs(loansQuery);
  } catch (error) {
    // Fallback if index missing
    const fallbackQuery = query(loansRef, where('customerId', '==', customerId));
    loansSnapshot = await getDocs(fallbackQuery);
  }

  const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Calculate factors
  const paymentHistory = calculatePaymentHistoryScore(loans);
  const debtToIncome = calculateDebtToIncomeRatio(customerData, loans, loanAmount);
  const creditHistory = calculateCreditHistoryScore(loans);
  const collateralValue = calculateCollateralScore(customerData);
  const employmentStability = calculateEmploymentStabilityScore(customerData);

  // Weighted credit score calculation
  const score = Math.round(
    paymentHistory * 0.35 +      // 35% - Most important
    creditHistory * 0.25 +        // 25%
    debtToIncome * 0.15 +         // 15%
    collateralValue * 0.15 +      // 15%
    employmentStability * 0.10    // 10%
  );

  // Determine tier
  let tier: 'A' | 'B' | 'C' | 'D';
  if (score >= 750) tier = 'A';
  else if (score >= 650) tier = 'B';
  else if (score >= 550) tier = 'C';
  else tier = 'D';

  // Calculate recommendations
  const maxLoanAmount = calculateMaxLoanAmount(score, customerData, collateralValue);
  const recommendedInterestRate = calculateRecommendedInterestRate(score, tier);
  const riskLevel = determineRiskLevel(score);

  return {
    score: Math.max(0, Math.min(1000, score)),
    tier,
    factors: {
      paymentHistory,
      debtToIncome,
      creditHistory,
      collateralValue,
      employmentStability,
    },
    recommendations: {
      maxLoanAmount,
      recommendedInterestRate,
      riskLevel,
    },
    calculatedAt: new Date(),
  };
}

/**
 * Perform comprehensive risk assessment
 */
export async function performRiskAssessment(
  agencyId: string,
  customerId: string,
  loanAmount: number,
  loanDuration: number
): Promise<RiskAssessment> {
  const creditScore = await calculateCreditScore(agencyId, customerId, loanAmount);
  
  // Get NRC lookup data if available
  const customerRef = doc(db, 'agencies', agencyId, 'customers', customerId);
  const customerSnap = await getDoc(customerRef);
  const customerData = customerSnap.data();
  const nrc = customerData?.nrc || customerData?.nrcNumber;

  let nrcAnalysis = null;
  if (nrc) {
    try {
      nrcAnalysis = await lookupNRC(agencyId, nrc);
    } catch (error) {
      console.warn('NRC lookup failed:', error);
    }
  }

  // Calculate default probability
  const defaultProbability = calculateDefaultProbability(
    creditScore,
    loanAmount,
    loanDuration,
    nrcAnalysis
  );

  // Identify risk factors
  const riskFactors: string[] = [];
  const positiveFactors: string[] = [];

  if (creditScore.score < 550) {
    riskFactors.push('Low credit score');
  }
  if (creditScore.factors.debtToIncome > 0.5) {
    riskFactors.push('High debt-to-income ratio');
  }
  if (creditScore.factors.paymentHistory < 600) {
    riskFactors.push('Poor payment history');
  }
  if (defaultProbability > 0.3) {
    riskFactors.push('High default probability');
  }

  if (nrcAnalysis) {
    if (nrcAnalysis.defaultedLoans > 0) {
      riskFactors.push(`Has ${nrcAnalysis.defaultedLoans} defaulted loan(s)`);
    }
    if (nrcAnalysis.repaymentBehavior.onTimeRate > 0.8) {
      positiveFactors.push('Good repayment history');
    }
  }

  if (creditScore.score >= 750) {
    positiveFactors.push('Excellent credit score');
  }
  if (creditScore.factors.collateralValue > 700) {
    positiveFactors.push('Strong collateral');
  }

  // Make recommendation
  let recommendation: 'approve' | 'approve_with_conditions' | 'reject';
  const conditions: string[] = [];

  if (creditScore.score >= 650 && defaultProbability < 0.2) {
    recommendation = 'approve';
  } else if (creditScore.score >= 550 && defaultProbability < 0.35) {
    recommendation = 'approve_with_conditions';
    if (creditScore.factors.debtToIncome > 0.4) {
      conditions.push('Reduce loan amount to improve debt-to-income ratio');
    }
    if (creditScore.factors.paymentHistory < 650) {
      conditions.push('Require additional collateral');
    }
    if (defaultProbability > 0.25) {
      conditions.push('Increase interest rate by 2-3%');
    }
  } else {
    recommendation = 'reject';
  }

  return {
    customerId,
    creditScore,
    defaultProbability,
    riskFactors,
    positiveFactors,
    recommendation,
    conditions: conditions.length > 0 ? conditions : undefined,
  };
}

// Helper functions

function calculatePaymentHistoryScore(loans: any[]): number {
  if (loans.length === 0) return 500; // Neutral for new customers

  let totalScore = 0;
  let count = 0;

  for (const loan of loans) {
    if (loan.status === 'paid' || loan.status === 'completed') {
      totalScore += 800;
    } else if (loan.status === 'active') {
      // Check if payments are on time
      totalScore += 600;
    } else if (loan.status === 'defaulted') {
      totalScore += 200;
    }
    count++;
  }

  return count > 0 ? Math.round(totalScore / count) : 500;
}

function calculateDebtToIncomeRatio(customerData: any, loans: any[], newLoanAmount?: number): number {
  const monthlyIncome = customerData.monthlyIncome || customerData.income || 0;
  if (monthlyIncome === 0) return 0.5; // Default to medium risk

  const activeLoans = loans.filter(l => l.status === 'active');
  const totalMonthlyPayments = activeLoans.reduce((sum, loan) => {
    const monthlyPayment = (loan.amount * (1 + loan.interestRate / 100)) / loan.durationMonths;
    return sum + monthlyPayment;
  }, 0);

  const newLoanMonthlyPayment = newLoanAmount 
    ? (newLoanAmount * 1.15) / 12 // Estimate with 15% interest
    : 0;

  const totalDebt = totalMonthlyPayments + newLoanMonthlyPayment;
  const ratio = totalDebt / monthlyIncome;

  // Convert ratio to score (lower ratio = higher score)
  if (ratio < 0.2) return 800;
  if (ratio < 0.3) return 700;
  if (ratio < 0.4) return 600;
  if (ratio < 0.5) return 500;
  return 300;
}

function calculateCreditHistoryScore(loans: any[]): number {
  if (loans.length === 0) return 500;

  const completedLoans = loans.filter(l => l.status === 'paid' || l.status === 'completed');
  const defaultedLoans = loans.filter(l => l.status === 'defaulted');

  const completionRate = completedLoans.length / loans.length;
  const defaultRate = defaultedLoans.length / loans.length;

  let score = 500;
  score += completionRate * 300;
  score -= defaultRate * 400;

  return Math.max(0, Math.min(1000, Math.round(score)));
}

function calculateCollateralScore(customerData: any): number {
  // This would check collateral value
  // For now, return a default score
  return 600;
}

function calculateEmploymentStabilityScore(customerData: any): number {
  const employmentYears = customerData.employmentYears || 0;
  
  if (employmentYears >= 5) return 800;
  if (employmentYears >= 3) return 700;
  if (employmentYears >= 1) return 600;
  return 400;
}

function calculateMaxLoanAmount(score: number, customerData: any, collateralScore: number): number {
  const monthlyIncome = customerData.monthlyIncome || customerData.income || 0;
  const baseAmount = monthlyIncome * 6; // 6 months income

  // Adjust based on credit score
  const scoreMultiplier = score / 1000;
  const collateralMultiplier = collateralScore / 1000;

  return Math.round(baseAmount * scoreMultiplier * (1 + collateralMultiplier * 0.5));
}

function calculateRecommendedInterestRate(score: number, tier: 'A' | 'B' | 'C' | 'D'): number {
  const baseRates = {
    A: 12,
    B: 18,
    C: 24,
    D: 30,
  };

  return baseRates[tier];
}

function determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'very_high' {
  if (score >= 750) return 'low';
  if (score >= 650) return 'medium';
  if (score >= 550) return 'high';
  return 'very_high';
}

function calculateDefaultProbability(
  creditScore: CreditScore,
  loanAmount: number,
  loanDuration: number,
  nrcAnalysis: any
): number {
  let probability = 0.3; // Base probability

  // Adjust based on credit score
  probability -= (creditScore.score - 500) / 1000;

  // Adjust based on loan amount (larger loans = higher risk)
  if (loanAmount > 100000) probability += 0.1;
  if (loanAmount > 500000) probability += 0.1;

  // Adjust based on loan duration (longer = higher risk)
  if (loanDuration > 12) probability += 0.05;
  if (loanDuration > 24) probability += 0.05;

  // Adjust based on NRC analysis
  if (nrcAnalysis) {
    if (nrcAnalysis.defaultedLoans > 0) {
      probability += nrcAnalysis.defaultedLoans * 0.1;
    }
    if (nrcAnalysis.repaymentBehavior.onTimeRate < 0.7) {
      probability += 0.1;
    }
  }

  return Math.max(0, Math.min(1, probability));
}

