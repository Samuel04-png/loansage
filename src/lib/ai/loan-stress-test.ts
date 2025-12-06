/**
 * Loan Stress Testing Module
 * Simulates various stress scenarios: payment delays, collateral price drops, inflation impact
 */

import { calculateLoanFinancials } from '../firebase/loan-calculations';

export interface StressTestInput {
  principal: number;
  interestRate: number;
  durationMonths: number;
  collateralValue?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
}

export interface StressFactor {
  name: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface StressTestResult {
  factor: StressFactor;
  impact: {
    onProfit: number; // Change in profit
    onRepayment: number; // Change in repayment probability (0-1)
    onDefault: number; // Change in default probability (0-1)
    financialImpact: number; // Monetary impact in ZMW
  };
  warnings: string[];
  recommendations: string[];
}

export interface StressTestOutput {
  baseCase: {
    profit: number;
    repaymentProbability: number;
    defaultProbability: number;
  };
  stressTests: StressTestResult[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
}

/**
 * Run comprehensive stress tests on a loan
 */
export function runStressTests(input: StressTestInput): StressTestOutput {
  const baseFinancials = calculateLoanFinancials(
    input.principal,
    input.interestRate,
    input.durationMonths
  );
  
  const baseProfit = baseFinancials.totalInterest;
  const baseRepaymentProb = 0.75; // Assumed base repayment probability
  const baseDefaultProb = 0.15; // Assumed base default probability

  const stressTests: StressTestResult[] = [];

  // Stress Factor 1: Payment Delay +7 days
  stressTests.push(calculateDelayImpact(input, 7, baseProfit, baseRepaymentProb, baseDefaultProb));

  // Stress Factor 2: Payment Delay +14 days
  stressTests.push(calculateDelayImpact(input, 14, baseProfit, baseRepaymentProb, baseDefaultProb));

  // Stress Factor 3: Payment Delay +30 days
  stressTests.push(calculateDelayImpact(input, 30, baseProfit, baseRepaymentProb, baseDefaultProb));

  // Stress Factor 4: Collateral Price Drop -10%
  if (input.collateralValue) {
    stressTests.push(calculateCollateralDropImpact(input, 0.10, baseProfit, baseDefaultProb));
  }

  // Stress Factor 5: Collateral Price Drop -20%
  if (input.collateralValue) {
    stressTests.push(calculateCollateralDropImpact(input, 0.20, baseProfit, baseDefaultProb));
  }

  // Stress Factor 6: Collateral Price Drop -40%
  if (input.collateralValue) {
    stressTests.push(calculateCollateralDropImpact(input, 0.40, baseProfit, baseDefaultProb));
  }

  // Stress Factor 7: Inflation Impact (10% reduction in disposable income)
  if (input.monthlyIncome && input.monthlyExpenses) {
    stressTests.push(calculateInflationImpact(input, 0.10, baseProfit, baseRepaymentProb, baseDefaultProb));
  }

  // Stress Factor 8: Loan Restructuring (extend duration by 25%)
  stressTests.push(calculateRestructuringImpact(input, 1.25, baseProfit));

  // Calculate overall risk
  const criticalCount = stressTests.filter(t => t.factor.severity === 'critical').length;
  const highCount = stressTests.filter(t => t.factor.severity === 'high').length;
  
  let overallRisk: 'low' | 'medium' | 'high' | 'critical';
  if (criticalCount > 0) {
    overallRisk = 'critical';
  } else if (highCount >= 3) {
    overallRisk = 'high';
  } else if (highCount >= 1) {
    overallRisk = 'medium';
  } else {
    overallRisk = 'low';
  }

  const summary = generateStressSummary(stressTests, overallRisk);

  return {
    baseCase: {
      profit: baseProfit,
      repaymentProbability: baseRepaymentProb,
      defaultProbability: baseDefaultProb,
    },
    stressTests,
    overallRisk,
    summary,
  };
}

/**
 * Calculate impact of payment delays
 */
function calculateDelayImpact(
  input: StressTestInput,
  delayDays: number,
  baseProfit: number,
  baseRepaymentProb: number,
  baseDefaultProb: number
): StressTestResult {
  const lateFeeRate = 0.05;
  const penaltyRate = 0.02;
  const monthlyPayment = calculateLoanFinancials(input.principal, input.interestRate, input.durationMonths).monthlyPayment;
  
  const lateFee = monthlyPayment * lateFeeRate;
  const penaltyInterest = input.principal * (penaltyRate / 100) * (delayDays / 30);
  
  const additionalRevenue = lateFee + penaltyInterest;
  const impactOnProfit = additionalRevenue * (input.durationMonths / 3); // Assume 1/3 of payments are late
  
  // Delays increase default probability
  const defaultIncrease = Math.min(0.3, (delayDays / 30) * 0.05);
  const repaymentDecrease = defaultIncrease * 0.8;

  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (delayDays >= 30) severity = 'critical';
  else if (delayDays >= 14) severity = 'high';
  else if (delayDays >= 7) severity = 'medium';

  const warnings: string[] = [];
  if (delayDays >= 30) {
    warnings.push(`Severe payment delays (${delayDays} days) significantly increase default risk`);
  } else if (delayDays >= 14) {
    warnings.push(`Moderate delays (${delayDays} days) may impact cash flow`);
  }

  return {
    factor: {
      name: `Payment Delay +${delayDays} days`,
      description: `All payments delayed by ${delayDays} days`,
      impact: 'negative',
      severity,
    },
    impact: {
      onProfit: impactOnProfit,
      onRepayment: -repaymentDecrease,
      onDefault: defaultIncrease,
      financialImpact: impactOnProfit,
    },
    warnings,
    recommendations: delayDays >= 14 ? [
        'Consider restructuring loan terms',
        'Implement early warning system for late payments',
        'Review borrower financial capacity',
    ] : ['Monitor payment patterns closely'],
  };
}

/**
 * Calculate impact of collateral price drops
 */
function calculateCollateralDropImpact(
  input: StressTestInput,
  dropPercentage: number,
  baseProfit: number,
  baseDefaultProb: number
): StressTestResult {
  const newCollateralValue = (input.collateralValue || 0) * (1 - dropPercentage);
  const loanAmount = input.principal;
  
  // Reduced recovery in default scenario
  const quickSaleValue = newCollateralValue * 0.65;
  const totalOwed = calculateLoanFinancials(input.principal, input.interestRate, input.durationMonths).totalAmount;
  const recovery = Math.min(quickSaleValue, totalOwed);
  const loss = Math.max(0, totalOwed - recovery);
  
  const originalRecovery = (input.collateralValue || 0) * 0.65;
  const originalLoss = Math.max(0, totalOwed - originalRecovery);
  
  const impactOnProfit = originalLoss - loss; // Negative impact
  const defaultIncrease = dropPercentage * 0.15; // Higher default risk with lower collateral

  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (dropPercentage >= 0.40) severity = 'critical';
  else if (dropPercentage >= 0.20) severity = 'high';
  else severity = 'medium';

  return {
    factor: {
      name: `Collateral Price Drop -${(dropPercentage * 100).toFixed(0)}%`,
      description: `Collateral value decreases by ${(dropPercentage * 100).toFixed(0)}%`,
      impact: 'negative',
      severity,
    },
    impact: {
      onProfit: -Math.abs(impactOnProfit),
      onRepayment: -defaultIncrease * 0.5,
      onDefault: defaultIncrease,
      financialImpact: -Math.abs(impactOnProfit),
    },
    warnings: [
      `Collateral value reduced by ${(dropPercentage * 100).toFixed(0)}% reduces recovery in default scenario`,
      `Estimated additional loss: ${Math.abs(impactOnProfit).toLocaleString()} ZMW`,
    ],
    recommendations: [
      'Monitor collateral market value regularly',
      'Consider requiring additional collateral',
      'Review LTV ratio and adjust if necessary',
    ],
  };
}

/**
 * Calculate inflation impact
 */
function calculateInflationImpact(
  input: StressTestInput,
  incomeReduction: number,
  baseProfit: number,
  baseRepaymentProb: number,
  baseDefaultProb: number
): StressTestResult {
  const reducedIncome = (input.monthlyIncome || 0) * (1 - incomeReduction);
  const monthlyPayment = calculateLoanFinancials(input.principal, input.interestRate, input.durationMonths).monthlyPayment;
  const disposableIncome = reducedIncome - (input.monthlyExpenses || 0);
  
  const paymentRatio = disposableIncome > 0 ? monthlyPayment / disposableIncome : 1;
  
  // Higher payment ratio increases default risk
  const defaultIncrease = Math.min(0.25, paymentRatio > 0.8 ? 0.2 : (paymentRatio - 0.3) * 0.25);
  const repaymentDecrease = defaultIncrease * 0.8;

  let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  if (paymentRatio > 0.9) severity = 'critical';
  else if (paymentRatio > 0.7) severity = 'high';

  return {
    factor: {
      name: `Inflation Impact (-${(incomeReduction * 100).toFixed(0)}% disposable income)`,
      description: `Reduced purchasing power affects borrower repayment capacity`,
      impact: 'negative',
      severity,
    },
    impact: {
      onProfit: -baseProfit * defaultIncrease * 0.3, // Reduced profit due to higher defaults
      onRepayment: -repaymentDecrease,
      onDefault: defaultIncrease,
      financialImpact: -baseProfit * defaultIncrease * 0.3,
    },
    warnings: paymentRatio > 0.8 ? [
      `Payment now represents ${(paymentRatio * 100).toFixed(0)}% of disposable income - high risk`,
    ] : ['Monitor borrower financial situation'],
    recommendations: [
      'Consider flexible repayment options',
      'Offer payment restructuring if needed',
      'Monitor economic indicators',
    ],
  };
}

/**
 * Calculate restructuring impact
 */
function calculateRestructuringImpact(
  input: StressTestInput,
  durationMultiplier: number,
  baseProfit: number
): StressTestResult {
  const newDuration = Math.round(input.durationMonths * durationMultiplier);
  const restructuredFinancials = calculateLoanFinancials(
    input.principal,
    input.interestRate,
    newDuration
  );

  const profitIncrease = restructuredFinancials.totalInterest - baseProfit;

  return {
    factor: {
      name: `Loan Restructuring (+${((durationMultiplier - 1) * 100).toFixed(0)}% duration)`,
      description: `Loan duration extended to ${newDuration} months`,
      impact: 'positive',
      severity: 'low',
    },
    impact: {
      onProfit: profitIncrease,
      onRepayment: 0.10, // Slightly better repayment probability
      onDefault: -0.05, // Lower default risk
      financialImpact: profitIncrease,
    },
    warnings: [],
    recommendations: [
      'Restructuring improves cash flow but increases total interest',
      'Consider this option for struggling borrowers',
    ],
  };
}

/**
 * Generate stress test summary
 */
function generateStressSummary(
  tests: StressTestResult[],
  overallRisk: 'low' | 'medium' | 'high' | 'critical'
): string {
  const criticalTests = tests.filter(t => t.factor.severity === 'critical');
  const highTests = tests.filter(t => t.factor.severity === 'high');
  
  if (overallRisk === 'critical') {
    return `CRITICAL RISK: ${criticalTests.length} critical stress factors detected. Loan is highly vulnerable to adverse conditions. Consider reducing loan amount or requiring additional safeguards.`;
  } else if (overallRisk === 'high') {
    return `HIGH RISK: ${highTests.length} high-severity stress factors identified. Loan shows vulnerability to adverse conditions. Monitor closely and consider risk mitigation strategies.`;
  } else if (overallRisk === 'medium') {
    return `MODERATE RISK: Some vulnerability to stress factors detected. Loan should be monitored but is generally resilient to normal adverse conditions.`;
  } else {
    return `LOW RISK: Loan demonstrates resilience to stress factors. Low vulnerability to adverse conditions.`;
  }
}

