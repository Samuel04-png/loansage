/**
 * Advanced Risk Assessment Module
 * Comprehensive risk scoring engine for loan evaluation
 */

import { calculateLoanFinancials } from '../firebase/loan-calculations';

export interface RiskAssessmentInput {
  loanAmount: number;
  interestRate: number;
  durationMonths: number;
  customerProfile: {
    monthlyIncome?: number;
    monthlyExpenses?: number;
    employmentStatus?: string;
    employmentDuration?: string;
    pastLoans?: number;
    pastDefaults?: number;
    pastOverdueCount?: number;
    creditScore?: number;
  };
  repaymentHistory?: {
    onTimePayments: number;
    latePayments: number;
    missedPayments: number;
    averageDaysLate: number;
  };
  collateralValue?: number;
  collateralType?: string;
  kycVerified: boolean;
  fraudSignals?: {
    suspiciousActivity: boolean;
    duplicateApplications: boolean;
    identityMismatch: boolean;
    documentIssues: boolean;
  };
}

export interface RiskAssessmentOutput {
  riskScore: number; // 0-100 (0 = no risk, 100 = maximum risk)
  riskCategory: 'Low' | 'Medium' | 'High' | 'Critical';
  suggestedMaxLoan: number;
  defaultProbability: number; // 0-100%
  collateralSufficiency: number; // 0-100%
  factors: {
    positive: string[];
    negative: string[];
    recommendations: string[];
  };
  breakdown: {
    incomeRisk: number;
    debtRisk: number;
    historyRisk: number;
    collateralRisk: number;
    fraudRisk: number;
  };
}

/**
 * Comprehensive risk assessment engine
 */
export function assessLoanRisk(input: RiskAssessmentInput): RiskAssessmentOutput {
  const {
    loanAmount,
    interestRate,
    durationMonths,
    customerProfile,
    repaymentHistory,
    collateralValue,
    kycVerified,
    fraudSignals,
  } = input;

  const factors = {
    positive: [] as string[],
    negative: [] as string[],
    recommendations: [] as string[],
  };

  const breakdown = {
    incomeRisk: 0,
    debtRisk: 0,
    historyRisk: 0,
    collateralRisk: 0,
    fraudRisk: 0,
  };

  // 1. Income Risk Assessment (0-30 points)
  const monthlyIncome = customerProfile.monthlyIncome || 0;
  const monthlyExpenses = customerProfile.monthlyExpenses || 0;
  const disposableIncome = monthlyIncome - monthlyExpenses;

  if (monthlyIncome > 0) {
    const incomeToLoanRatio = (loanAmount / monthlyIncome) * 100;
    const monthlyPayment = calculateLoanFinancials(loanAmount, interestRate, durationMonths).monthlyPayment;
    const paymentToIncomeRatio = (monthlyPayment / monthlyIncome) * 100;
    const paymentToDisposableRatio = disposableIncome > 0 ? (monthlyPayment / disposableIncome) * 100 : 100;

    if (incomeToLoanRatio > 300) {
      breakdown.incomeRisk = 30;
      factors.negative.push('Loan amount exceeds 3x monthly income');
    } else if (incomeToLoanRatio > 200) {
      breakdown.incomeRisk = 20;
      factors.negative.push('Loan amount is 2-3x monthly income (high risk)');
    } else if (incomeToLoanRatio > 100) {
      breakdown.incomeRisk = 10;
      factors.negative.push('Loan amount is 1-2x monthly income');
    }

    if (paymentToIncomeRatio > 50) {
      breakdown.incomeRisk = Math.max(breakdown.incomeRisk, 25);
      factors.negative.push('Monthly payment exceeds 50% of income');
    } else if (paymentToIncomeRatio > 40) {
      breakdown.incomeRisk = Math.max(breakdown.incomeRisk, 15);
      factors.negative.push('Monthly payment exceeds 40% of income');
    }

    if (paymentToDisposableRatio > 80) {
      breakdown.incomeRisk = Math.max(breakdown.incomeRisk, 28);
      factors.negative.push('Payment exceeds 80% of disposable income');
    }

    if (incomeToLoanRatio < 100 && paymentToIncomeRatio < 30) {
      breakdown.incomeRisk = 0;
      factors.positive.push('Loan amount is reasonable relative to income');
    }
  } else {
    breakdown.incomeRisk = 30;
    factors.negative.push('No income information provided');
  }

  // 2. Debt Risk Assessment (0-25 points)
  const existingDebt = customerProfile.pastLoans || 0;
  const totalDebt = loanAmount + existingDebt;

  if (monthlyIncome > 0) {
    const debtToIncomeRatio = (totalDebt / (monthlyIncome * 12)) * 100;
    if (debtToIncomeRatio > 100) {
      breakdown.debtRisk = 25;
      factors.negative.push('Total debt exceeds annual income');
    } else if (debtToIncomeRatio > 80) {
      breakdown.debtRisk = 18;
      factors.negative.push('Total debt is 80-100% of annual income');
    } else if (debtToIncomeRatio > 60) {
      breakdown.debtRisk = 12;
      factors.warnings?.push('Total debt is 60-80% of annual income');
    }
  }

  if (existingDebt > 0) {
    breakdown.debtRisk = Math.max(breakdown.debtRisk, 10);
    factors.negative.push(`Customer has ${existingDebt.toLocaleString()} ZMW in existing debt`);
  } else {
    factors.positive.push('No existing debt');
  }

  // 3. Repayment History Risk (0-25 points)
  if (repaymentHistory) {
    const totalPayments = repaymentHistory.onTimePayments + repaymentHistory.latePayments + repaymentHistory.missedPayments;
    if (totalPayments > 0) {
      const onTimeRate = (repaymentHistory.onTimePayments / totalPayments) * 100;
      const lateRate = (repaymentHistory.latePayments / totalPayments) * 100;
      const missedRate = (repaymentHistory.missedPayments / totalPayments) * 100;

      if (onTimeRate >= 90) {
        breakdown.historyRisk = 0;
        factors.positive.push('Excellent repayment history (90%+ on-time)');
      } else if (onTimeRate >= 75) {
        breakdown.historyRisk = 5;
        factors.positive.push('Good repayment history (75-90% on-time)');
      } else if (onTimeRate >= 60) {
        breakdown.historyRisk = 12;
        factors.negative.push('Moderate repayment history (60-75% on-time)');
      } else {
        breakdown.historyRisk = 20;
        factors.negative.push('Poor repayment history (<60% on-time)');
      }

      if (missedRate > 10) {
        breakdown.historyRisk = Math.max(breakdown.historyRisk, 25);
        factors.negative.push(`High missed payment rate (${missedRate.toFixed(1)}%)`);
      }

      if (repaymentHistory.averageDaysLate > 30) {
        breakdown.historyRisk = Math.max(breakdown.historyRisk, 18);
        factors.negative.push(`Average ${repaymentHistory.averageDaysLate} days late on payments`);
      }
    } else {
      breakdown.historyRisk = 15; // No history = moderate risk
      factors.negative.push('No repayment history available');
    }
  } else {
    breakdown.historyRisk = 15;
    factors.negative.push('No repayment history data');
  }

  // Past defaults
  const pastDefaults = customerProfile.pastDefaults || 0;
  if (pastDefaults >= 2) {
    breakdown.historyRisk = 25;
    factors.negative.push(`${pastDefaults} previous defaults - HIGH RISK`);
    factors.recommendations.push('Consider requiring additional collateral or guarantor');
  } else if (pastDefaults === 1) {
    breakdown.historyRisk = Math.max(breakdown.historyRisk, 20);
    factors.negative.push('1 previous default');
    factors.recommendations.push('Require additional collateral');
  }

  // 4. Collateral Risk Assessment (0-15 points)
  if (collateralValue) {
    const ltvRatio = (loanAmount / collateralValue) * 100;
    const collateralSufficiency = Math.min(100, (collateralValue / loanAmount) * 100);

    if (ltvRatio <= 50) {
      breakdown.collateralRisk = 0;
      factors.positive.push('Excellent collateral coverage (LTV ≤50%)');
    } else if (ltvRatio <= 65) {
      breakdown.collateralRisk = 3;
      factors.positive.push('Good collateral coverage (LTV 50-65%)');
    } else if (ltvRatio <= 80) {
      breakdown.collateralRisk = 8;
      factors.negative.push('Moderate collateral coverage (LTV 65-80%)');
    } else {
      breakdown.collateralRisk = 15;
      factors.negative.push(`High LTV ratio (${ltvRatio.toFixed(1)}%) - collateral may not cover loan`);
    }
  } else {
    breakdown.collateralRisk = 10;
    factors.negative.push('No collateral provided');
    if (loanAmount > 50000) {
      breakdown.collateralRisk = 15;
      factors.negative.push('Large unsecured loan - collateral recommended');
      factors.recommendations.push('Require collateral for loans over 50,000 ZMW');
    }
  }

  // 5. Fraud Risk Assessment (0-5 points)
  if (fraudSignals) {
    let fraudScore = 0;
    if (fraudSignals.suspiciousActivity) {
      fraudScore += 2;
      factors.negative.push('Suspicious activity detected');
    }
    if (fraudSignals.duplicateApplications) {
      fraudScore += 2;
      factors.negative.push('Duplicate applications detected');
    }
    if (fraudSignals.identityMismatch) {
      fraudScore += 3;
      factors.negative.push('Identity mismatch detected');
    }
    if (fraudSignals.documentIssues) {
      fraudScore += 1;
      factors.negative.push('Document verification issues');
    }
    breakdown.fraudRisk = Math.min(5, fraudScore);
  }

  if (!kycVerified) {
    breakdown.fraudRisk = Math.max(breakdown.fraudRisk, 3);
    factors.negative.push('KYC not verified');
    factors.recommendations.push('Complete KYC verification before approval');
  } else {
    factors.positive.push('KYC verified');
  }

  // Calculate total risk score
  const totalRiskScore = Math.min(
    100,
    breakdown.incomeRisk +
      breakdown.debtRisk +
      breakdown.historyRisk +
      breakdown.collateralRisk +
      breakdown.fraudRisk
  );

  // Determine risk category
  let riskCategory: 'Low' | 'Medium' | 'High' | 'Critical';
  if (totalRiskScore <= 25) {
    riskCategory = 'Low';
  } else if (totalRiskScore <= 50) {
    riskCategory = 'Medium';
  } else if (totalRiskScore <= 75) {
    riskCategory = 'High';
  } else {
    riskCategory = 'Critical';
  }

  // Calculate default probability (based on risk score and historical data)
  const defaultProbability = Math.min(100, totalRiskScore * 0.8 + (pastDefaults * 10));

  // Calculate suggested max loan amount
  let suggestedMaxLoan = loanAmount;
  if (monthlyIncome > 0) {
    const maxByIncome = monthlyIncome * 3;
    const maxByPayment = disposableIncome > 0 ? (disposableIncome * 0.4 * durationMonths) : 0;
    suggestedMaxLoan = Math.min(maxByIncome, maxByPayment || maxByIncome);
  }

  if (collateralValue) {
    suggestedMaxLoan = Math.min(suggestedMaxLoan, collateralValue * 0.8);
  }

  // Adjust based on risk score
  if (totalRiskScore > 50) {
    suggestedMaxLoan = suggestedMaxLoan * 0.7; // Reduce by 30% for high risk
  } else if (totalRiskScore > 25) {
    suggestedMaxLoan = suggestedMaxLoan * 0.85; // Reduce by 15% for medium risk
  }

  // Calculate collateral sufficiency
  const collateralSufficiency = collateralValue
    ? Math.min(100, (collateralValue / loanAmount) * 100)
    : 0;

  // Generate recommendations
  if (totalRiskScore > 50) {
    factors.recommendations.push('Require additional collateral or guarantor');
    factors.recommendations.push('Consider reducing loan amount');
    factors.recommendations.push('Implement stricter monitoring');
  } else if (totalRiskScore > 25) {
    factors.recommendations.push('Monitor repayment schedule closely');
    if (!collateralValue) {
      factors.recommendations.push('Consider requiring collateral');
    }
  }

  if (paymentToIncomeRatio > 40) {
    factors.recommendations.push('Consider extending loan duration to reduce monthly payment');
  }

  return {
    riskScore: Math.round(totalRiskScore),
    riskCategory,
    suggestedMaxLoan: Math.round(suggestedMaxLoan),
    defaultProbability: Math.round(defaultProbability * 10) / 10,
    collateralSufficiency: Math.round(collateralSufficiency * 10) / 10,
    factors,
    breakdown: {
      incomeRisk: Math.round(breakdown.incomeRisk),
      debtRisk: Math.round(breakdown.debtRisk),
      historyRisk: Math.round(breakdown.historyRisk),
      collateralRisk: Math.round(breakdown.collateralRisk),
      fraudRisk: Math.round(breakdown.fraudRisk),
    },
  };
}

