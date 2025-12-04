/**
 * AI-Powered Risk Scoring System
 * Uses machine learning algorithms to assess loan and customer risk
 */

interface RiskFactors {
  customerHistory?: {
    totalLoans: number;
    completedLoans: number;
    defaultedLoans: number;
    averageLoanAmount: number;
    averageRepaymentTime: number;
  };
  loanDetails?: {
    amount: number;
    interestRate: number;
    durationMonths: number;
    loanType: string;
  };
  customerProfile?: {
    monthlyIncome?: number;
    employmentStatus?: string;
    kycStatus?: string;
    age?: number;
  };
  collateral?: {
    value: number;
    type: string;
    verificationStatus?: string;
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

Loan Details:
- Amount: ${factors.loanDetails?.amount || 0} ZMW
- Interest Rate: ${factors.loanDetails?.interestRate || 0}%
- Duration: ${factors.loanDetails?.durationMonths || 0} months
- Loan Type: ${factors.loanDetails?.loanType || 'Not specified'}

Customer Profile:
- Monthly Income: ${factors.customerProfile?.monthlyIncome || 'Not provided'} ZMW
- Employment Status: ${factors.customerProfile?.employmentStatus || 'Not provided'}
- KYC Status: ${factors.customerProfile?.kycStatus || 'Not provided'}
- Age: ${factors.customerProfile?.age || 'Not provided'}

Collateral:
- Value: ${factors.collateral?.value || 0} ZMW
- Type: ${factors.collateral?.type || 'Not provided'}
- Verification Status: ${factors.collateral?.verificationStatus || 'Not provided'}

Please provide a JSON response with the following structure:
{
  "score": <number 0-100, lower is better risk>,
  "level": "low" | "medium" | "high" | "critical",
  "factors": {
    "positive": [<array of positive risk factors>],
    "negative": [<array of negative risk factors>]
  },
  "recommendation": "approve" | "review" | "reject",
  "confidence": <number 0-1>
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

  // Customer profile (20% weight)
  if (factors.customerProfile) {
    const { monthlyIncome, employmentStatus, kycStatus, age } = factors.customerProfile;

    if (monthlyIncome) {
      if (factors.loanDetails) {
        const monthlyPayment = (factors.loanDetails.amount * (factors.loanDetails.interestRate / 100 / 12)) / 
          (1 - Math.pow(1 + factors.loanDetails.interestRate / 100 / 12, -factors.loanDetails.durationMonths));
        const debtToIncome = monthlyPayment / monthlyIncome;
        
        if (debtToIncome > 0.4) {
          score += 15;
          negativeFactors.push('High debt-to-income ratio');
        } else if (debtToIncome < 0.2) {
          score -= 8;
          positiveFactors.push('Low debt-to-income ratio');
        }
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

  // Collateral (10% weight)
  if (factors.collateral) {
    const { value, verificationStatus } = factors.collateral;
    
    if (factors.loanDetails) {
      const collateralRatio = value / factors.loanDetails.amount;
      
      if (collateralRatio > 1.5) {
        score -= 12;
        positiveFactors.push('Strong collateral coverage');
      } else if (collateralRatio > 1.0) {
        score -= 6;
        positiveFactors.push('Adequate collateral coverage');
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
  ].reduce((a, b) => a + b, 0) / 4;

  return {
    score: Math.round(score),
    level,
    factors: {
      positive: positiveFactors,
      negative: negativeFactors,
    },
    recommendation,
    confidence: dataCompleteness,
  };
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

