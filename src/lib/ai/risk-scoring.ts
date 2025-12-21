/**
 * AI-Powered Risk Scoring System
 * Uses machine learning algorithms to assess loan and customer risk
 */

// Helper to get loan type category for AI context
function getLoanTypeCategoryForAI(loanType: string): string {
  if (!loanType) return 'Standard';
  
  const securedTypes = ['collateral_based', 'asset_financing', 'equipment', 'trade_finance', 'construction', 'vehicle', 'property'];
  const unsecuredTypes = ['salary_based', 'personal_unsecured', 'education', 'medical', 'emergency', 'microfinance', 'personal'];
  const conditionalTypes = ['sme_business', 'group', 'working_capital', 'invoice_financing', 'refinancing', 'business'];
  
  const typeLower = loanType.toLowerCase();
  if (securedTypes.some(t => typeLower.includes(t))) return 'Secured';
  if (unsecuredTypes.some(t => typeLower.includes(t))) return 'Unsecured';
  if (conditionalTypes.some(t => typeLower.includes(t))) return 'Conditional';
  return 'Standard';
}

interface RiskFactors {
  // Required inputs
  nrc?: string;
  phoneNumber?: string;
  customerHistory?: {
    totalLoans: number;
    completedLoans: number;
    defaultedLoans: number;
    averageLoanAmount: number;
    averageRepaymentTime: number;
    repaymentSpeed?: number; // Average days to complete repayment vs scheduled
  };
  loanDetails?: {
    amount: number;
    interestRate: number;
    durationMonths: number;
    loanType: string;
  };
  customerProfile?: {
    monthlyIncome?: number;
    monthlyExpenses?: number; // NEW: Monthly expenses
    employmentStatus?: string;
    employmentStability?: number; // Years at current job
    kycStatus?: string;
    age?: number;
  };
  collateral?: {
    value: number;
    type: string;
    verificationStatus?: string;
    ltvRatio?: number; // Loan-to-value ratio
  };
  // NEW: Additional risk factors
  fraudIndicators?: {
    multipleAccountsSameNRC?: boolean;
    suspiciousPhonePatterns?: boolean;
    inconsistentInformation?: boolean;
    flaggedTransactions?: number;
  };
  previousDefaults?: number; // Number of previous defaults
  borrowerBehaviorPatterns?: {
    averagePaymentDelay?: number; // Days
    paymentConsistency?: number; // 0-1 score
    communicationResponsiveness?: number; // 0-1 score
  };
}

interface RiskScore {
  score: number; // 0-100, lower is better
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    positive: string[];
    negative: string[];
  };
  recommendation: 'approve' | 'review' | 'reject';
  confidence: number; // 0-1
  suggestedLoanAmount?: number; // NEW: Suggested safe loan amount
  riskExplanation?: string; // NEW: Key flags explanation
  repaymentProbability?: number; // NEW: 0-1 predicted repayment probability
  defaultProbability?: number; // NEW: 0-1 predicted default probability
}

/**
 * Calculate customer risk score based on historical data
 * Uses DeepSeek API for intelligent risk assessment when available
 */
export async function calculateCustomerRiskScore(factors: RiskFactors): Promise<RiskScore> {
  // Try to use DeepSeek API for intelligent risk assessment if configured
  if (isDeepSeekConfigured()) {
    try {
      const prompt = `You are a loan risk assessment expert for a microfinance institution in Zambia. Analyze this loan application and provide a comprehensive risk assessment.

Customer History:
- Total Loans: ${factors.customerHistory?.totalLoans || 0}
- Completed Loans: ${factors.customerHistory?.completedLoans || 0}
- Defaulted Loans: ${factors.customerHistory?.defaultedLoans || 0}
- Average Loan Amount: ${factors.customerHistory?.averageLoanAmount || 0} ZMW
- Average Repayment Time: ${factors.customerHistory?.averageRepaymentTime || 0} months
- Repayment Speed: ${factors.customerHistory?.repaymentSpeed || 'Not provided'} days vs scheduled

Loan Details:
- Amount: ${factors.loanDetails?.amount || 0} ZMW
- Interest Rate: ${factors.loanDetails?.interestRate || 0}%
- Duration: ${factors.loanDetails?.durationMonths || 0} months
- Loan Type: ${factors.loanDetails?.loanType || factors.loanDetails?.loan_type || 'Not specified'}
- Loan Type Category: ${getLoanTypeCategoryForAI(factors.loanDetails?.loanType || factors.loanDetails?.loan_type || '')}

Customer Profile:
- NRC: ${factors.nrc || 'Not provided'}
- Phone: ${factors.phoneNumber || 'Not provided'}
- Monthly Income: ${factors.customerProfile?.monthlyIncome || 'Not provided'} ZMW
- Monthly Expenses: ${factors.customerProfile?.monthlyExpenses || 'Not provided'} ZMW
- Employment Status: ${factors.customerProfile?.employmentStatus || 'Not provided'}
- Employment Stability: ${factors.customerProfile?.employmentStability || 'Not provided'} years
- KYC Status: ${factors.customerProfile?.kycStatus || 'Not provided'}
- Age: ${factors.customerProfile?.age || 'Not provided'}

Collateral:
- Value: ${factors.collateral?.value || 0} ZMW
- Type: ${factors.collateral?.type || 'Not provided'}
- LTV Ratio: ${factors.collateral?.ltvRatio || 'Not calculated'}%
- Verification Status: ${factors.collateral?.verificationStatus || 'Not provided'}

Risk Indicators:
- Previous Defaults: ${factors.previousDefaults || 0}
- Fraud Indicators: ${factors.fraudIndicators ? JSON.stringify(factors.fraudIndicators) : 'None'}
- Multiple Accounts Same NRC: ${factors.fraudIndicators?.multipleAccountsSameNRC ? 'Yes' : 'No'}
- Borrower Behavior:
  - Average Payment Delay: ${factors.borrowerBehaviorPatterns?.averagePaymentDelay || 'N/A'} days
  - Payment Consistency: ${factors.borrowerBehaviorPatterns?.paymentConsistency ? (factors.borrowerBehaviorPatterns.paymentConsistency * 100).toFixed(0) + '%' : 'N/A'}

Please provide a JSON response with the following structure:
{
  "score": <number 0-100, lower is better risk>,
  "level": "low" | "medium" | "high" | "critical",
  "factors": {
    "positive": [<array of positive risk factors>],
    "negative": [<array of negative risk factors>]
  },
  "recommendation": "approve" | "review" | "reject",
  "confidence": <number 0-1>,
  "suggestedLoanAmount": <number in ZMW - safe loan amount based on income and risk>,
  "riskExplanation": "<brief explanation of key risk flags>",
  "repaymentProbability": <number 0-1 - probability of full repayment>,
  "defaultProbability": <number 0-1 - probability of default>
}

Consider:
1. Historical repayment behavior
2. Debt-to-income ratio
3. Collateral coverage
4. Employment stability
5. Loan amount relative to income
6. Zambian microfinance market conditions

Return ONLY valid JSON, no additional text.`;

      const response = await callDeepSeekAPI([
        {
          role: 'system',
          content: 'You are an expert loan risk assessor for microfinance in Zambia. Provide accurate risk scores (0-100, lower is better) and clear recommendations. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ], {
        temperature: 0.2, // Very low temperature for consistent risk assessment
        maxTokens: 2000,
      });

      const aiResult = parseAIResponse<RiskScore>(response, {
        score: 50,
        level: 'medium',
        factors: { positive: [], negative: [] },
        recommendation: 'review',
        confidence: 0.5,
        suggestedLoanAmount: factors.loanDetails?.amount || 0,
        riskExplanation: 'Standard risk assessment',
        repaymentProbability: 0.7,
        defaultProbability: 0.3,
      });

      // Validate and use AI result if it looks reasonable
      if (aiResult.score >= 0 && aiResult.score <= 100 && aiResult.factors) {
        return aiResult;
      }
    } catch (error) {
      console.warn('DeepSeek API call failed, falling back to rule-based scoring:', error);
      // Fall through to rule-based scoring
    }
  }

  // Fallback to rule-based scoring
  return calculateCustomerRiskScoreRuleBased(factors);
}

/**
 * Rule-based risk scoring (fallback)
 */
function calculateCustomerRiskScoreRuleBased(factors: RiskFactors): RiskScore {
  let score = 50; // Start with neutral score
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];

  // Historical performance (40% weight)
  if (factors.customerHistory) {
    const { totalLoans, completedLoans, defaultedLoans, averageRepaymentTime } = factors.customerHistory;

    if (totalLoans > 0) {
      const completionRate = completedLoans / totalLoans;
      const defaultRate = defaultedLoans / totalLoans;

      if (completionRate > 0.8) {
        score -= 15;
        positiveFactors.push('High loan completion rate');
      } else if (completionRate < 0.5) {
        score += 20;
        negativeFactors.push('Low loan completion rate');
      }

      if (defaultRate > 0.3) {
        score += 25;
        negativeFactors.push('High default rate');
      } else if (defaultRate === 0) {
        score -= 10;
        positiveFactors.push('No defaults in history');
      }

      if (averageRepaymentTime > 0) {
        const onTimeRate = averageRepaymentTime < 1 ? 1 : 1 / averageRepaymentTime;
        if (onTimeRate > 0.9) {
          score -= 8;
          positiveFactors.push('Consistent on-time payments');
        } else if (onTimeRate < 0.7) {
          score += 12;
          negativeFactors.push('Frequent late payments');
        }
      }
    } else {
      // New customer - moderate risk
      score += 5;
      negativeFactors.push('No credit history');
    }
  }

  // Loan details (30% weight)
  if (factors.loanDetails) {
    const { amount, interestRate, durationMonths, loanType } = factors.loanDetails;

    // Amount risk
    if (amount > 100000) {
      score += 10;
      negativeFactors.push('High loan amount');
    } else if (amount < 10000) {
      score -= 5;
      positiveFactors.push('Low loan amount');
    }

    // Duration risk
    if (durationMonths > 36) {
      score += 8;
      negativeFactors.push('Long repayment period');
    } else if (durationMonths < 12) {
      score -= 3;
      positiveFactors.push('Short repayment period');
    }

    // Interest rate (higher rate might indicate higher risk)
    if (interestRate > 20) {
      score += 5;
      negativeFactors.push('High interest rate');
    }
  }

  // Customer profile (25% weight)
  if (factors.customerProfile) {
    const { monthlyIncome, monthlyExpenses, employmentStatus, employmentStability, kycStatus, age } = factors.customerProfile;

    if (monthlyIncome) {
      // Calculate disposable income
      const disposableIncome = monthlyIncome - (monthlyExpenses || 0);
      
      if (factors.loanDetails) {
        const monthlyRate = factors.loanDetails.interestRate / 100 / 12;
        const monthlyPayment = factors.loanDetails.amount * (monthlyRate * Math.pow(1 + monthlyRate, factors.loanDetails.durationMonths)) / 
          (Math.pow(1 + monthlyRate, factors.loanDetails.durationMonths) - 1);
        
        const debtToIncome = monthlyPayment / monthlyIncome;
        const paymentToDisposable = disposableIncome > 0 ? monthlyPayment / disposableIncome : 1;
        
        if (debtToIncome > 0.4) {
          score += 15;
          negativeFactors.push('High debt-to-income ratio');
        } else if (debtToIncome < 0.2) {
          score -= 8;
          positiveFactors.push('Low debt-to-income ratio');
        }

        // Check if payment exceeds disposable income
        if (paymentToDisposable > 0.8) {
          score += 20;
          negativeFactors.push('Loan payment exceeds available disposable income');
        } else if (paymentToDisposable < 0.3) {
          score -= 10;
          positiveFactors.push('Comfortable payment-to-disposable income ratio');
        }

        // Income stability check - should be at least 3x monthly payment
        if (monthlyIncome < monthlyPayment * 3) {
          score += 10;
          negativeFactors.push('Income ratio below 3x monthly payment (recommended minimum)');
        }
      }

      // Expenses analysis
      if (monthlyExpenses) {
        const expenseRatio = monthlyExpenses / monthlyIncome;
        if (expenseRatio > 0.8) {
          score += 10;
          negativeFactors.push('High expense-to-income ratio');
        } else if (expenseRatio < 0.5) {
          score -= 5;
          positiveFactors.push('Low expense-to-income ratio');
        }
      }
    }

    // Employment stability (years at job)
    if (employmentStability) {
      if (employmentStability >= 3) {
        score -= 8;
        positiveFactors.push(`Stable employment (${employmentStability} years)`);
      } else if (employmentStability < 1) {
        score += 10;
        negativeFactors.push(`Unstable employment (${employmentStability} years)`);
      }
    }

    if (employmentStatus === 'employed' || employmentStatus === 'self-employed') {
      score -= 5;
      positiveFactors.push('Stable employment');
    } else if (employmentStatus === 'unemployed') {
      score += 15;
      negativeFactors.push('Unemployed');
    }

    if (kycStatus === 'verified') {
      score -= 3;
      positiveFactors.push('KYC verified');
    } else if (kycStatus === 'rejected') {
      score += 10;
      negativeFactors.push('KYC rejected');
    }

    if (age && age < 25) {
      score += 5;
      negativeFactors.push('Young borrower (higher risk)');
    } else if (age && age > 50) {
      score -= 3;
      positiveFactors.push('Mature borrower');
    }
  }

  // Fraud indicators (15% weight)
  if (factors.fraudIndicators) {
    const fraudCount = [
      factors.fraudIndicators.multipleAccountsSameNRC,
      factors.fraudIndicators.suspiciousPhonePatterns,
      factors.fraudIndicators.inconsistentInformation,
    ].filter(Boolean).length;

    if (fraudCount > 0) {
      score += fraudCount * 15;
      negativeFactors.push(`${fraudCount} fraud indicator(s) detected`);
    }

    if (factors.fraudIndicators.flaggedTransactions && factors.fraudIndicators.flaggedTransactions > 0) {
      score += factors.fraudIndicators.flaggedTransactions * 5;
      negativeFactors.push(`${factors.fraudIndicators.flaggedTransactions} flagged transaction(s)`);
    }
  }

  // Previous defaults (10% weight)
  if (factors.previousDefaults !== undefined) {
    if (factors.previousDefaults === 0) {
      score -= 5;
      positiveFactors.push('No previous defaults');
    } else if (factors.previousDefaults === 1) {
      score += 10;
      negativeFactors.push('1 previous default');
    } else if (factors.previousDefaults >= 2) {
      score += 25;
      negativeFactors.push(`${factors.previousDefaults}+ previous defaults - high risk`);
    }
  }

  // Borrower behavior patterns (10% weight)
  if (factors.borrowerBehaviorPatterns) {
    const { averagePaymentDelay, paymentConsistency, communicationResponsiveness } = factors.borrowerBehaviorPatterns;

    if (averagePaymentDelay) {
      if (averagePaymentDelay <= 0) {
        score -= 5;
        positiveFactors.push('On-time or early payments');
      } else if (averagePaymentDelay <= 7) {
        score += 3;
        negativeFactors.push(`Slight payment delays (avg ${averagePaymentDelay} days)`);
      } else if (averagePaymentDelay <= 14) {
        score += 10;
        negativeFactors.push(`Moderate payment delays (avg ${averagePaymentDelay} days)`);
      } else {
        score += 20;
        negativeFactors.push(`Severe payment delays (avg ${averagePaymentDelay} days)`);
      }
    }

    if (paymentConsistency !== undefined) {
      if (paymentConsistency >= 0.9) {
        score -= 5;
        positiveFactors.push('Highly consistent payment history');
      } else if (paymentConsistency < 0.7) {
        score += 10;
        negativeFactors.push('Inconsistent payment history');
      }
    }

    if (communicationResponsiveness !== undefined && communicationResponsiveness < 0.5) {
      score += 5;
      negativeFactors.push('Poor communication responsiveness');
    }
  }

  // Repayment speed
  if (factors.customerHistory?.repaymentSpeed !== undefined) {
    const repaymentSpeed = factors.customerHistory.repaymentSpeed;
    if (repaymentSpeed <= 0) {
      score -= 5;
      positiveFactors.push('Early or on-time repayments');
    } else if (repaymentSpeed <= 7) {
      score += 2;
      negativeFactors.push(`Slight repayment delays`);
    } else {
      score += 8;
      negativeFactors.push(`Slow repayment speed (${repaymentSpeed} days behind)`);
    }
  }

  // Collateral (10% weight)
  if (factors.collateral) {
    const { value, verificationStatus, ltvRatio } = factors.collateral;
    
    if (factors.loanDetails) {
      const collateralRatio = value / factors.loanDetails.amount;
      
      // Use provided LTV or calculate
      const effectiveLTV = ltvRatio !== undefined ? (ltvRatio / 100) : (factors.loanDetails.amount / value);
      
      // For collateralized loans, LTV should be <= 80%
      if (effectiveLTV <= 0.65) {
        score -= 12;
        positiveFactors.push(`Strong collateral coverage (LTV: ${(effectiveLTV * 100).toFixed(1)}%)`);
      } else if (effectiveLTV <= 0.80) {
        score -= 6;
        positiveFactors.push(`Adequate collateral coverage (LTV: ${(effectiveLTV * 100).toFixed(1)}%)`);
      } else if (effectiveLTV > 0.80) {
        score += 15;
        negativeFactors.push(`High LTV ratio (${(effectiveLTV * 100).toFixed(1)}% - exceeds 80% limit)`);
      }

      // Also check collateral ratio
      if (collateralRatio > 1.5) {
        score -= 5;
        positiveFactors.push('Strong collateral coverage');
      } else if (collateralRatio < 0.8) {
        score += 8;
        negativeFactors.push('Insufficient collateral coverage');
      }
    }

    if (verificationStatus === 'verified') {
      score -= 3;
      positiveFactors.push('Collateral verified');
    } else if (verificationStatus === 'rejected') {
      score += 10;
      negativeFactors.push('Collateral verification failed');
    }
  }

  // Normalize score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine risk level
  let level: 'low' | 'medium' | 'high' | 'critical';
  if (score < 30) {
    level = 'low';
  } else if (score < 50) {
    level = 'medium';
  } else if (score < 70) {
    level = 'high';
  } else {
    level = 'critical';
  }

  // Generate recommendation
  let recommendation: 'approve' | 'review' | 'reject';
  if (score < 35) {
    recommendation = 'approve';
  } else if (score < 65) {
    recommendation = 'review';
  } else {
    recommendation = 'reject';
  }

  // Calculate confidence based on data completeness
  const dataCompleteness = [
    factors.customerHistory ? 1 : 0,
    factors.loanDetails ? 1 : 0,
    factors.customerProfile ? 1 : 0,
    factors.collateral ? 1 : 0,
    factors.fraudIndicators ? 0.5 : 0,
    factors.borrowerBehaviorPatterns ? 0.5 : 0,
  ].reduce((a, b) => a + b, 0) / 4;

  // Calculate suggested loan amount based on income and risk
  let suggestedLoanAmount = factors.loanDetails?.amount || 0;
  if (factors.customerProfile?.monthlyIncome && factors.loanDetails) {
    // Maximum safe amount: 3x monthly income for low risk, 2x for medium, 1.5x for high
    const incomeMultiplier = level === 'low' ? 3 : level === 'medium' ? 2 : 1.5;
    const maxSafeAmount = factors.customerProfile.monthlyIncome * incomeMultiplier;
    suggestedLoanAmount = Math.min(suggestedLoanAmount, maxSafeAmount);
  }

  // Generate risk explanation
  const riskExplanation = generateRiskExplanation(level, negativeFactors, score);

  // Calculate repayment and default probabilities
  const repaymentProbability = Math.max(0, Math.min(1, 1 - (score / 100) * 0.9));
  const defaultProbability = Math.min(0.95, (score / 100) * 0.85);

  return {
    score: Math.round(score),
    level,
    factors: {
      positive: positiveFactors,
      negative: negativeFactors,
    },
    recommendation,
    confidence: dataCompleteness,
    suggestedLoanAmount: Math.round(suggestedLoanAmount),
    riskExplanation,
    repaymentProbability: Math.round(repaymentProbability * 100) / 100,
    defaultProbability: Math.round(defaultProbability * 100) / 100,
  };
}

/**
 * Generate risk explanation from key flags
 */
function generateRiskExplanation(
  level: 'low' | 'medium' | 'high' | 'critical',
  negativeFactors: string[],
  score: number
): string {
  if (level === 'low') {
    return 'Low risk profile. Borrower demonstrates strong creditworthiness with minimal risk factors.';
  } else if (level === 'medium') {
    const topFlags = negativeFactors.slice(0, 2).join(', ');
    return `Moderate risk profile. Key considerations: ${topFlags || 'Standard risk assessment'}.`;
  } else if (level === 'high') {
    const topFlags = negativeFactors.slice(0, 3).join(', ');
    return `High risk detected. Critical flags: ${topFlags || 'Multiple risk factors present'}. Requires careful review.`;
  } else {
    const topFlags = negativeFactors.slice(0, 4).join(', ');
    return `CRITICAL RISK: ${topFlags || 'Severe risk factors identified'}. Not recommended for approval without significant safeguards.`;
  }
}

/**
 * Predict loan default probability
 */
export async function predictDefaultProbability(factors: RiskFactors): Promise<{
  probability: number; // 0-1
  timeframe: number; // months until likely default
  confidence: number;
}> {
  const riskScore = await calculateCustomerRiskScore(factors);
  
  // Convert risk score to default probability
  // Higher risk score = higher default probability
  const probability = Math.min(0.95, riskScore / 100);
  
  // Estimate timeframe based on risk factors
  let timeframe = 12; // Default 12 months
  if (riskScore.level === 'critical') {
    timeframe = 3;
  } else if (riskScore.level === 'high') {
    timeframe = 6;
  } else if (riskScore.level === 'medium') {
    timeframe = 9;
  } else {
    timeframe = 18;
  }

  return {
    probability: Math.round(probability * 100) / 100,
    timeframe,
    confidence: riskScore.confidence,
  };
}

/**
 * Get AI-powered loan approval recommendation
 */
export async function getLoanApprovalRecommendation(factors: RiskFactors): Promise<{
  recommendation: 'approve' | 'approve_with_conditions' | 'review' | 'reject';
  conditions?: string[];
  reasoning: string;
  riskScore: RiskScore;
}> {
  const riskScore = await calculateCustomerRiskScore(factors);
  const defaultPrediction = await predictDefaultProbability(factors);

  let recommendation: 'approve' | 'approve_with_conditions' | 'review' | 'reject';
  let conditions: string[] = [];
  let reasoning = '';

  if (riskScore.score < 30 && defaultPrediction.probability < 0.2) {
    recommendation = 'approve';
    reasoning = 'Low risk profile with strong credit history and adequate collateral. Safe to approve.';
  } else if (riskScore.score < 50 && defaultPrediction.probability < 0.35) {
    recommendation = 'approve_with_conditions';
    conditions = [
      'Require additional documentation',
      'Increase collateral coverage if possible',
      'Consider shorter repayment period',
    ];
    reasoning = 'Moderate risk profile. Approval recommended with additional safeguards.';
  } else if (riskScore.score < 70) {
    recommendation = 'review';
    conditions = [
      'Manual review required',
      'Consider reducing loan amount',
      'Require co-signer or additional collateral',
    ];
    reasoning = 'Higher risk profile detected. Requires careful manual review before approval.';
  } else {
    recommendation = 'reject';
    reasoning = 'High risk profile with significant default probability. Not recommended for approval.';
  }

  return {
    recommendation,
    conditions: conditions.length > 0 ? conditions : undefined,
    reasoning,
    riskScore,
  };
}

