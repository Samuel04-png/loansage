/**
 * Borrower Profile Strength Index
 * Calculates comprehensive profile strength score with 5 levels
 */

import { RiskFactors } from './risk-scoring';

export interface BorrowerProfileData {
  income: number;
  monthlyExpenses?: number;
  nrcHistory?: {
    totalLoans: number;
    completedLoans: number;
    defaultedLoans: number;
    averageRepaymentTime: number;
  };
  repaymentBehavior?: {
    onTimeRate: number; // 0-1
    averageDelay: number; // days
    consistency: number; // 0-1
  };
  collateralStrength?: {
    value: number;
    ltvRatio: number;
    verificationStatus: 'verified' | 'pending' | 'rejected';
  };
  pastLoanConsistency?: {
    loanAmountVariation: number; // Standard deviation / mean
    durationVariation: number;
    successfulCompletions: number;
  };
}

export interface ProfileStrengthIndex {
  score: number; // 0-100
  level: 'weak' | 'developing' | 'stable' | 'strong' | 'very_strong';
  breakdown: {
    incomeScore: number;
    historyScore: number;
    behaviorScore: number;
    collateralScore: number;
    consistencyScore: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

/**
 * Calculate borrower profile strength index
 */
export function calculateProfileStrength(data: BorrowerProfileData): ProfileStrengthIndex {
  const scores = {
    incomeScore: calculateIncomeScore(data.income, data.monthlyExpenses),
    historyScore: calculateHistoryScore(data.nrcHistory),
    behaviorScore: calculateBehaviorScore(data.repaymentBehavior),
    collateralScore: calculateCollateralScore(data.collateralStrength),
    consistencyScore: calculateConsistencyScore(data.pastLoanConsistency),
  };

  // Weighted average
  const weights = {
    incomeScore: 0.25,
    historyScore: 0.25,
    behaviorScore: 0.25,
    collateralScore: 0.15,
    consistencyScore: 0.10,
  };

  const overallScore = 
    scores.incomeScore * weights.incomeScore +
    scores.historyScore * weights.historyScore +
    scores.behaviorScore * weights.behaviorScore +
    scores.collateralScore * weights.collateralScore +
    scores.consistencyScore * weights.consistencyScore;

  const level = determineLevel(overallScore);

  const { strengths, weaknesses, recommendations } = generateAnalysis(
    scores,
    overallScore,
    level,
    data
  );

  return {
    score: Math.round(overallScore),
    level,
    breakdown: scores,
    strengths,
    weaknesses,
    recommendations,
  };
}

/**
 * Calculate income score (0-100)
 */
function calculateIncomeScore(income: number, expenses?: number): number {
  let score = 0;

  // Income level (0-40 points)
  if (income >= 10000) score += 40;
  else if (income >= 5000) score += 30;
  else if (income >= 3000) score += 20;
  else if (income >= 1500) score += 10;
  else score += 5;

  // Expense ratio (0-30 points)
  if (expenses !== undefined) {
    const expenseRatio = expenses / income;
    if (expenseRatio < 0.3) score += 30;
    else if (expenseRatio < 0.5) score += 25;
    else if (expenseRatio < 0.7) score += 15;
    else if (expenseRatio < 0.8) score += 5;
    // else 0 points for high expense ratio
  } else {
    score += 15; // Neutral if not provided
  }

  // Disposable income (0-30 points)
  if (expenses !== undefined) {
    const disposable = income - expenses;
    if (disposable >= 5000) score += 30;
    else if (disposable >= 3000) score += 25;
    else if (disposable >= 1500) score += 15;
    else if (disposable >= 500) score += 5;
  } else {
    score += 15; // Neutral if not provided
  }

  return Math.min(100, score);
}

/**
 * Calculate history score (0-100)
 */
function calculateHistoryScore(history?: BorrowerProfileData['nrcHistory']): number {
  if (!history || history.totalLoans === 0) {
    return 50; // Neutral for new borrowers
  }

  let score = 0;

  // Completion rate (0-40 points)
  const completionRate = history.completedLoans / history.totalLoans;
  score += completionRate * 40;

  // Default rate (0-30 points, negative)
  const defaultRate = history.defaultedLoans / history.totalLoans;
  score += (1 - defaultRate) * 30;

  // Repayment speed (0-30 points)
  if (history.averageRepaymentTime <= 0) {
    score += 30; // Early/on-time
  } else if (history.averageRepaymentTime <= 7) {
    score += 25; // Slight delays
  } else if (history.averageRepaymentTime <= 14) {
    score += 15; // Moderate delays
  } else if (history.averageRepaymentTime <= 30) {
    score += 5; // Significant delays
  }
  // else 0 for very slow repayments

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate behavior score (0-100)
 */
function calculateBehaviorScore(behavior?: BorrowerProfileData['repaymentBehavior']): number {
  if (!behavior) {
    return 50; // Neutral if not provided
  }

  let score = 0;

  // On-time rate (0-40 points)
  score += behavior.onTimeRate * 40;

  // Payment delay (0-30 points, negative)
  if (behavior.averageDelay <= 0) {
    score += 30;
  } else if (behavior.averageDelay <= 7) {
    score += 20;
  } else if (behavior.averageDelay <= 14) {
    score += 10;
  } else if (behavior.averageDelay <= 30) {
    score += 5;
  }

  // Consistency (0-30 points)
  score += behavior.consistency * 30;

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate collateral score (0-100)
 */
function calculateCollateralScore(collateral?: BorrowerProfileData['collateralStrength']): number {
  if (!collateral) {
    return 0; // No collateral
  }

  let score = 0;

  // LTV ratio (0-50 points)
  if (collateral.ltvRatio <= 0.65) {
    score += 50; // Excellent LTV
  } else if (collateral.ltvRatio <= 0.80) {
    score += 35; // Good LTV
  } else if (collateral.ltvRatio <= 1.0) {
    score += 20; // Acceptable LTV
  } else {
    score += 5; // Poor LTV
  }

  // Verification status (0-50 points)
  if (collateral.verificationStatus === 'verified') {
    score += 50;
  } else if (collateral.verificationStatus === 'pending') {
    score += 25;
  }

  return Math.min(100, score);
}

/**
 * Calculate consistency score (0-100)
 */
function calculateConsistencyScore(consistency?: BorrowerProfileData['pastLoanConsistency']): number {
  if (!consistency) {
    return 50; // Neutral if not provided
  }

  let score = 0;

  // Amount variation (0-40 points, lower variation is better)
  if (consistency.loanAmountVariation < 0.2) {
    score += 40; // Very consistent
  } else if (consistency.loanAmountVariation < 0.4) {
    score += 30;
  } else if (consistency.loanAmountVariation < 0.6) {
    score += 20;
  } else {
    score += 10;
  }

  // Completion success (0-60 points)
  const completionRate = consistency.successfulCompletions / 10; // Assuming 10 loans max for calculation
  score += Math.min(60, completionRate * 60);

  return Math.min(100, score);
}

/**
 * Determine profile strength level
 */
function determineLevel(score: number): 'weak' | 'developing' | 'stable' | 'strong' | 'very_strong' {
  if (score >= 80) return 'very_strong';
  if (score >= 65) return 'strong';
  if (score >= 50) return 'stable';
  if (score >= 35) return 'developing';
  return 'weak';
}

/**
 * Generate analysis with strengths, weaknesses, and recommendations
 */
function generateAnalysis(
  scores: ProfileStrengthIndex['breakdown'],
  overallScore: number,
  level: ProfileStrengthIndex['level'],
  data: BorrowerProfileData
): {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  // Income analysis
  if (scores.incomeScore >= 70) {
    strengths.push('Strong income profile with good disposable income');
  } else if (scores.incomeScore < 40) {
    weaknesses.push('Limited income capacity');
    recommendations.push('Consider smaller loan amounts');
  }

  // History analysis
  if (scores.historyScore >= 70) {
    strengths.push('Excellent repayment history');
  } else if (scores.historyScore < 40) {
    weaknesses.push('Poor repayment history or high default rate');
    recommendations.push('Require additional collateral or co-signer');
  } else if (data.nrcHistory?.totalLoans === 0) {
    weaknesses.push('No credit history');
    recommendations.push('Start with smaller loan to build credit');
  }

  // Behavior analysis
  if (scores.behaviorScore >= 70) {
    strengths.push('Consistent and timely payment behavior');
  } else if (scores.behaviorScore < 40) {
    weaknesses.push('Inconsistent payment patterns');
    recommendations.push('Monitor payment behavior closely');
  }

  // Collateral analysis
  if (scores.collateralScore >= 50) {
    strengths.push('Strong collateral coverage');
  } else if (scores.collateralScore === 0) {
    weaknesses.push('No collateral provided');
    if (data.income && data.income < 5000) {
      recommendations.push('Consider requiring collateral for higher loan amounts');
    }
  }

  // Consistency analysis
  if (scores.consistencyScore >= 70) {
    strengths.push('Consistent loan performance');
  }

  // Overall recommendations based on level
  if (level === 'weak') {
    recommendations.push('High-risk profile. Consider rejecting or require significant safeguards');
  } else if (level === 'developing') {
    recommendations.push('Monitor closely and provide financial education support');
  } else if (level === 'very_strong') {
    recommendations.push('Excellent profile. Eligible for premium terms and higher amounts');
  }

  return { strengths, weaknesses, recommendations };
}

