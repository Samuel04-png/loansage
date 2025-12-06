/**
 * Loan Plan Comparison Tool
 * Generates 3 algorithmically optimized loan plan options for borrowers
 */

import { calculateLoanFinancials } from '../firebase/loan-calculations';

export interface LoanPlan {
  planName: string;
  loanAmount: number;
  interestRate: number;
  durationMonths: number;
  monthlyPayment: number;
  totalAmount: number;
  totalInterest: number;
  risk: 'low' | 'medium' | 'high';
  profit: number;
  profitMargin: number;
  description: string;
  recommendedFor: string[];
}

export interface LoanPlanComparisonInput {
  requestedAmount: number;
  monthlyIncome: number;
  monthlyExpenses?: number;
  riskScore: number; // 0-100, lower is better
  creditHistory?: {
    totalLoans: number;
    completedLoans: number;
    defaultedLoans: number;
  };
  collateralValue?: number;
}

export interface LoanPlanComparison {
  plans: LoanPlan[];
  recommendedPlan: LoanPlan;
  comparison: {
    cheapest: LoanPlan;
    fastest: LoanPlan;
    safest: LoanPlan;
  };
  borrowerEligibility: {
    eligible: boolean;
    maxSafeAmount: number;
    reasoning: string;
  };
}

/**
 * Generate 3 optimized loan plan options
 */
export function generateLoanPlans(input: LoanPlanComparisonInput): LoanPlanComparison {
  const { requestedAmount, monthlyIncome, monthlyExpenses = 0, riskScore, creditHistory, collateralValue } = input;

  const disposableIncome = monthlyIncome - monthlyExpenses;
  const maxSafeAmount = calculateMaxSafeAmount(monthlyIncome, disposableIncome, riskScore);
  
  // Plan 1: Conservative (Lower amount, lower risk)
  const conservativeAmount = Math.min(requestedAmount * 0.7, maxSafeAmount * 0.8);
  const conservativeRate = riskScore < 30 ? 12 : riskScore < 50 ? 15 : 18;
  const conservativeDuration = 24;
  const conservativeFinancials = calculateLoanFinancials(conservativeAmount, conservativeRate, conservativeDuration);

  const plan1: LoanPlan = {
    planName: 'Conservative Plan',
    loanAmount: Math.round(conservativeAmount),
    interestRate: conservativeRate,
    durationMonths: conservativeDuration,
    monthlyPayment: conservativeFinancials.monthlyPayment,
    totalAmount: conservativeFinancials.totalAmount,
    totalInterest: conservativeFinancials.totalInterest,
    risk: 'low',
    profit: conservativeFinancials.totalInterest,
    profitMargin: conservativeFinancials.profitMargin,
    description: 'Lower loan amount with competitive interest rate. Best for borrowers seeking manageable payments and lower risk.',
    recommendedFor: [
      'First-time borrowers',
      'Conservative financial approach',
      'Stable but limited income',
    ],
  };

  // Plan 2: Standard (Requested amount, balanced terms)
  const standardAmount = Math.min(requestedAmount, maxSafeAmount);
  const standardRate = riskScore < 30 ? 14 : riskScore < 50 ? 17 : 20;
  const standardDuration = calculateOptimalDuration(standardAmount, disposableIncome, standardRate);
  const standardFinancials = calculateLoanFinancials(standardAmount, standardRate, standardDuration);

  const plan2: LoanPlan = {
    planName: 'Standard Plan',
    loanAmount: Math.round(standardAmount),
    interestRate: standardRate,
    durationMonths: standardDuration,
    monthlyPayment: standardFinancials.monthlyPayment,
    totalAmount: standardFinancials.totalAmount,
    totalInterest: standardFinancials.totalInterest,
    risk: riskScore < 50 ? 'low' : 'medium',
    profit: standardFinancials.totalInterest,
    profitMargin: standardFinancials.profitMargin,
    description: 'Balanced plan with requested amount. Optimal terms based on your profile and income capacity.',
    recommendedFor: [
      'Established borrowers',
      'Stable income',
      'Moderate risk tolerance',
    ],
  };

  // Plan 3: Aggressive (Higher amount or shorter duration, higher risk/reward)
  const aggressiveAmount = Math.min(requestedAmount * 1.1, maxSafeAmount);
  const aggressiveRate = riskScore < 30 ? 16 : riskScore < 50 ? 19 : 22;
  const aggressiveDuration = Math.max(12, standardDuration - 6);
  const aggressiveFinancials = calculateLoanFinancials(aggressiveAmount, aggressiveRate, aggressiveDuration);

  const plan3: LoanPlan = {
    planName: 'Fast-Track Plan',
    loanAmount: Math.round(aggressiveAmount),
    interestRate: aggressiveRate,
    durationMonths: aggressiveDuration,
    monthlyPayment: aggressiveFinancials.monthlyPayment,
    totalAmount: aggressiveFinancials.totalAmount,
    totalInterest: aggressiveFinancials.totalInterest,
    risk: riskScore < 40 ? 'medium' : 'high',
    profit: aggressiveFinancials.totalInterest,
    profitMargin: aggressiveFinancials.profitMargin,
    description: 'Higher amount or faster repayment. Suitable for borrowers with strong credit history and higher income capacity.',
    recommendedFor: [
      'Experienced borrowers',
      'High income',
      'Strong credit history',
      'Quick repayment goal',
    ],
  };

  const plans = [plan1, plan2, plan3];

  // Determine recommended plan
  let recommendedPlan = plan2; // Default to standard
  if (riskScore < 30 && creditHistory && creditHistory.completedLoans > 2) {
    recommendedPlan = plan3; // Aggressive for low-risk experienced borrowers
  } else if (riskScore >= 50 || !creditHistory || creditHistory.totalLoans === 0) {
    recommendedPlan = plan1; // Conservative for high-risk or new borrowers
  }

  // Eligibility check
  const eligible = requestedAmount <= maxSafeAmount;
  const eligibilityReasoning = eligible
    ? `Requested amount is within safe limits. Maximum safe amount: ${maxSafeAmount.toLocaleString()} ZMW`
    : `Requested amount exceeds safe limit. Maximum safe amount: ${maxSafeAmount.toLocaleString()} ZMW. Consider reducing amount or improving credit profile.`;

  return {
    plans,
    recommendedPlan,
    comparison: {
      cheapest: plans.reduce((min, plan) => plan.totalAmount < min.totalAmount ? plan : min),
      fastest: plans.reduce((min, plan) => plan.durationMonths < min.durationMonths ? plan : min),
      safest: plans.reduce((min, plan) => plan.risk === 'low' && min.risk !== 'low' ? plan : plan.risk === 'low' ? (plan.totalAmount < min.totalAmount ? plan : min) : min),
    },
    borrowerEligibility: {
      eligible,
      maxSafeAmount: Math.round(maxSafeAmount),
      reasoning: eligibilityReasoning,
    },
  };
}

/**
 * Calculate maximum safe loan amount
 */
function calculateMaxSafeAmount(
  monthlyIncome: number,
  disposableIncome: number,
  riskScore: number
): number {
  // Base: 3x monthly income for low risk, 2x for medium, 1.5x for high
  const incomeMultiplier = riskScore < 30 ? 3 : riskScore < 50 ? 2 : 1.5;
  const maxByIncome = monthlyIncome * incomeMultiplier;

  // Also consider disposable income - monthly payment shouldn't exceed 40% of disposable
  const maxMonthlyPayment = disposableIncome * 0.4;
  // Reverse calculate from payment capacity (assuming 15% interest, 24 months)
  const monthlyRate = 0.15 / 12;
  const termMonths = 24;
  const maxByDisposable = maxMonthlyPayment * ((1 - Math.pow(1 + monthlyRate, -termMonths)) / monthlyRate);

  return Math.min(maxByIncome, maxByDisposable);
}

/**
 * Calculate optimal loan duration based on payment capacity
 */
function calculateOptimalDuration(
  amount: number,
  disposableIncome: number,
  interestRate: number
): number {
  const monthlyRate = interestRate / 100 / 12;
  const maxMonthlyPayment = disposableIncome * 0.35; // 35% of disposable income

  // Find duration where monthly payment <= maxMonthlyPayment
  for (let months = 12; months <= 36; months++) {
    const monthlyPayment = amount * (monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
    
    if (monthlyPayment <= maxMonthlyPayment) {
      return months;
    }
  }

  // If even 36 months is too much, return 36 as maximum
  return 36;
}

