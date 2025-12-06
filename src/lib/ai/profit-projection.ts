/**
 * Profit Projection Module
 * Calculates lender profit under 3 scenarios: Normal Repayment, Late Repayment, and Default
 */

import { calculateLoanFinancials } from '../firebase/loan-calculations';

export interface ProfitProjectionInput {
  principal: number;
  interestRate: number;
  durationMonths: number;
  collateralValue?: number; // For default scenario
  lateFeeRate?: number; // Percentage of payment (default 5%)
  penaltyRate?: number; // Percentage per month (default 2%)
}

export interface ProfitScenario {
  scenario: 'normal' | 'late' | 'default';
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;
  revenuePerDay: number;
  details: {
    interestEarned: number;
    penalties?: number;
    lateFees?: number;
    collateralRecovery?: number;
    totalLoss?: number;
  };
  color: 'green' | 'yellow' | 'red'; // For heatmap visualization
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ProfitProjectionResult {
  scenarios: ProfitScenario[];
  recommendedScenario: 'normal' | 'late' | 'default';
  summary: {
    bestCase: ProfitScenario;
    worstCase: ProfitScenario;
    expectedCase: ProfitScenario;
  };
}

/**
 * Calculate profit projection for all 3 scenarios
 */
export function calculateProfitProjection(input: ProfitProjectionInput): ProfitProjectionResult {
  const {
    principal,
    interestRate,
    durationMonths,
    collateralValue = 0,
    lateFeeRate = 0.05, // 5% of payment
    penaltyRate = 0.02, // 2% per month
  } = input;

  // Base loan financials
  const loanFinancials = calculateLoanFinancials(principal, interestRate, durationMonths);
  const monthlyPayment = loanFinancials.monthlyPayment;

  // Scenario 1: Normal Repayment
  const normalScenario: ProfitScenario = {
    scenario: 'normal',
    totalRevenue: loanFinancials.totalAmount,
    totalProfit: loanFinancials.totalInterest,
    profitMargin: loanFinancials.profitMargin,
    revenuePerDay: loanFinancials.totalAmount / (durationMonths * 30),
    details: {
      interestEarned: loanFinancials.totalInterest,
    },
    color: 'green',
    riskLevel: 'low',
  };

  // Scenario 2: Late Repayment (assumes 30-day delay on all payments)
  const lateDays = 30;
  const latePayments = durationMonths;
  const lateFeePerPayment = monthlyPayment * lateFeeRate;
  const totalLateFees = lateFeePerPayment * latePayments;
  
  // Penalty interest for late period
  const penaltyInterest = principal * (penaltyRate / 100) * (lateDays / 30);
  const totalPenalties = penaltyInterest * latePayments;
  
  // Extended interest (loan takes 30 days longer)
  const extendedMonths = durationMonths + (lateDays / 30);
  const extendedFinancials = calculateLoanFinancials(principal, interestRate, extendedMonths);
  
  const lateScenario: ProfitScenario = {
    scenario: 'late',
    totalRevenue: extendedFinancials.totalAmount + totalLateFees + totalPenalties,
    totalProfit: extendedFinancials.totalInterest + totalLateFees + totalPenalties,
    profitMargin: ((extendedFinancials.totalInterest + totalLateFees + totalPenalties) / principal) * 100,
    revenuePerDay: (extendedFinancials.totalAmount + totalLateFees + totalPenalties) / (extendedMonths * 30),
    details: {
      interestEarned: extendedFinancials.totalInterest,
      penalties: totalPenalties,
      lateFees: totalLateFees,
    },
    color: 'yellow',
    riskLevel: 'medium',
  };

  // Scenario 3: Default (collateral recovery)
  const totalOwed = loanFinancials.totalAmount;
  const recoveryAmount = Math.min(collateralValue, totalOwed);
  const totalLoss = Math.max(0, totalOwed - recoveryAmount);
  
  // Assume we recover 65% of collateral value (quick sale)
  const quickSaleValue = collateralValue * 0.65;
  const actualRecovery = Math.min(quickSaleValue, totalOwed);
  const netLoss = Math.max(0, totalOwed - actualRecovery);
  
  // Profit is negative (loss) in default scenario
  const defaultScenario: ProfitScenario = {
    scenario: 'default',
    totalRevenue: actualRecovery,
    totalProfit: -netLoss, // Negative means loss
    profitMargin: -(netLoss / principal) * 100, // Negative margin
    revenuePerDay: actualRecovery / (durationMonths * 30),
    details: {
      interestEarned: 0, // No interest earned on default
      collateralRecovery: actualRecovery,
      totalLoss: netLoss,
    },
    color: 'red',
    riskLevel: 'high',
  };

  // Determine recommended scenario (usually normal unless high risk)
  const scenarios = [normalScenario, lateScenario, defaultScenario];
  const recommendedScenario = normalScenario.scenario;

  return {
    scenarios,
    recommendedScenario,
    summary: {
      bestCase: normalScenario,
      worstCase: defaultScenario,
      expectedCase: lateScenario, // Conservative estimate
    },
  };
}

/**
 * Generate profit heatmap data for visualization
 */
export function generateProfitHeatmap(projection: ProfitProjectionResult): {
  data: Array<{
    scenario: string;
    profit: number;
    color: string;
    risk: string;
  }>;
  min: number;
  max: number;
} {
  const data = projection.scenarios.map(s => ({
    scenario: s.scenario.charAt(0).toUpperCase() + s.scenario.slice(1),
    profit: s.totalProfit,
    color: s.color,
    risk: s.riskLevel,
  }));

  const profits = projection.scenarios.map(s => s.totalProfit);
  const min = Math.min(...profits);
  const max = Math.max(...profits);

  return { data, min, max };
}

