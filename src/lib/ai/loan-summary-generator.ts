/**
 * AI Loan Summary Generator
 * Generates comprehensive, professional loan summary reports formatted like bank reports
 */

import { callDeepSeekAPI, parseAIResponse, isDeepSeekConfigured } from './deepseek-client';
import { calculateCustomerRiskScore, RiskFactors } from './risk-scoring';
import { estimateCollateralPrice } from './collateral-pricing';
import { calculateProfitProjection } from './profit-projection';

export interface LoanSummaryInput {
  borrower: {
    name: string;
    nrc: string;
    phone: string;
    email?: string;
    age?: number;
    monthlyIncome?: number;
    monthlyExpenses?: number;
    employmentStatus?: string;
    employmentStability?: number;
  };
  loan: {
    amount: number;
    interestRate: number;
    durationMonths: number;
    loanType: string;
    purpose?: string;
  };
  collateral?: {
    type: string;
    description: string;
    brand?: string;
    model?: string;
    year?: number;
    estimatedValue: number;
    condition?: 'excellent' | 'good' | 'fair' | 'poor';
  };
  history?: {
    totalLoans: number;
    completedLoans: number;
    defaultedLoans: number;
    averageLoanAmount: number;
    averageRepaymentTime: number;
  };
}

export interface LoanSummaryReport {
  reportDate: string;
  reportId: string;
  
  // Borrower Summary
  borrowerSummary: {
    name: string;
    nrc: string;
    contact: string;
    age?: number;
    employment: string;
    profileStrength: 'weak' | 'developing' | 'stable' | 'strong' | 'very_strong';
  };

  // Risk Analysis
  riskAnalysis: {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskExplanation: string;
    keyFlags: string[];
    repaymentProbability: number;
    defaultProbability: number;
  };

  // Recommended Loan Details
  recommendedLoan: {
    amount: number;
    interestRate: number;
    durationMonths: number;
    reasoning: string;
  };

  // Collateral Analysis
  collateralAnalysis?: {
    type: string;
    estimatedMarketValue: number;
    quickSaleValue: number;
    auctionPrice: number;
    ltvRatio: number;
    riskAssessment: string;
  };

  // Profit Projection
  profitProjection: {
    normalScenario: {
      totalProfit: number;
      profitMargin: number;
    };
    lateScenario: {
      totalProfit: number;
      additionalRevenue: number;
    };
    defaultScenario: {
      estimatedLoss: number;
      recoveryRate: number;
    };
  };

  // Final Recommendation
  recommendation: {
    decision: 'approve' | 'approve_with_conditions' | 'review' | 'reject';
    conditions?: string[];
    reasoning: string;
    confidence: number;
  };

  // Executive Summary
  executiveSummary: string;
}

/**
 * Generate comprehensive AI-powered loan summary
 */
export async function generateLoanSummary(input: LoanSummaryInput): Promise<LoanSummaryReport> {
  const reportDate = new Date().toISOString().split('T')[0];
  const reportId = `LS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  // Build risk factors
  const riskFactors: RiskFactors = {
    nrc: input.borrower.nrc,
    phoneNumber: input.borrower.phone,
    customerHistory: input.history,
    loanDetails: {
      amount: input.loan.amount,
      interestRate: input.loan.interestRate,
      durationMonths: input.loan.durationMonths,
      loanType: input.loan.loanType,
    },
    customerProfile: {
      monthlyIncome: input.borrower.monthlyIncome,
      monthlyExpenses: input.borrower.monthlyExpenses,
      employmentStatus: input.borrower.employmentStatus,
      employmentStability: input.borrower.employmentStability,
      age: input.borrower.age,
    },
  };

  // Calculate risk score
  const riskScore = await calculateCustomerRiskScore(riskFactors);

  // Estimate collateral pricing if provided
  let collateralAnalysis;
  if (input.collateral) {
    const pricing = await estimateCollateralPrice({
      type: input.collateral.type,
      description: input.collateral.description,
      brand: input.collateral.brand,
      model: input.collateral.model,
      year: input.collateral.year,
      condition: input.collateral.condition || 'good',
      estimatedValue: input.collateral.estimatedValue,
    });

    const ltvRatio = (input.loan.amount / pricing.estimatedMarketValue) * 100;

    collateralAnalysis = {
      type: input.collateral.type,
      estimatedMarketValue: pricing.estimatedMarketValue,
      quickSaleValue: pricing.estimatedSalePrice,
      auctionPrice: pricing.auctionPrice || pricing.estimatedSalePrice * 0.69,
      ltvRatio,
      riskAssessment: pricing.marketAnalysis,
    };

    riskFactors.collateral = {
      value: pricing.estimatedMarketValue,
      type: input.collateral.type,
      ltvRatio: ltvRatio / 100,
    };
  }

  // Calculate profit projection
  const profitProj = calculateProfitProjection({
    principal: input.loan.amount,
    interestRate: input.loan.interestRate,
    durationMonths: input.loan.durationMonths,
    collateralValue: collateralAnalysis?.estimatedMarketValue,
  });

  // Use AI to generate comprehensive summary if available
  if (isDeepSeekConfigured()) {
    try {
      const prompt = `You are a senior loan officer generating a comprehensive loan assessment report. Create a professional, bank-quality report.

BORROWER INFORMATION:
- Name: ${input.borrower.name}
- NRC: ${input.borrower.nrc}
- Age: ${input.borrower.age || 'Not provided'}
- Employment: ${input.borrower.employmentStatus || 'Not provided'}
- Monthly Income: ${input.borrower.monthlyIncome || 'Not provided'} ZMW
- Monthly Expenses: ${input.borrower.monthlyExpenses || 'Not provided'} ZMW

LOAN DETAILS:
- Requested Amount: ${input.loan.amount.toLocaleString()} ZMW
- Interest Rate: ${input.loan.interestRate}%
- Duration: ${input.loan.durationMonths} months
- Loan Type: ${input.loan.loanType}
- Purpose: ${input.loan.purpose || 'Not specified'}

RISK ASSESSMENT:
- Risk Score: ${riskScore.score}/100
- Risk Level: ${riskScore.level.toUpperCase()}
- Repayment Probability: ${(riskScore.repaymentProbability || 0.7) * 100}%
- Default Probability: ${(riskScore.defaultProbability || 0.3) * 100}%
- Key Flags: ${riskScore.factors.negative.join('; ') || 'None'}
- Positive Factors: ${riskScore.factors.positive.join('; ') || 'None'}

COLLATERAL:
${collateralAnalysis ? `
- Type: ${collateralAnalysis.type}
- Market Value: ${collateralAnalysis.estimatedMarketValue.toLocaleString()} ZMW
- Quick Sale Value: ${collateralAnalysis.quickSaleValue.toLocaleString()} ZMW
- LTV Ratio: ${collateralAnalysis.ltvRatio.toFixed(1)}%
` : 'No collateral provided'}

PROFIT PROJECTION:
- Normal Scenario Profit: ${profitProj.scenarios[0].totalProfit.toLocaleString()} ZMW
- Late Scenario Profit: ${profitProj.scenarios[1].totalProfit.toLocaleString()} ZMW
- Default Scenario Loss: ${Math.abs(profitProj.scenarios[2].totalProfit).toLocaleString()} ZMW

Generate a comprehensive report in JSON format with:
{
  "executiveSummary": "<2-3 sentence executive summary>",
  "borrowerProfileStrength": "weak|developing|stable|strong|very_strong",
  "recommendedLoanAmount": <number>,
  "recommendedInterestRate": <number>,
  "recommendedDuration": <number>,
  "recommendation": {
    "decision": "approve|approve_with_conditions|review|reject",
    "conditions": [<array of conditions if any>],
    "reasoning": "<detailed reasoning>",
    "confidence": <0-1>
  }
}

Return ONLY valid JSON.`;

      const response = await callDeepSeekAPI([
        {
          role: 'system',
          content: 'You are a senior loan officer at a microfinance institution in Zambia. Generate professional, accurate loan assessment reports in JSON format only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ], {
        temperature: 0.3,
        maxTokens: 2500,
      });

      const aiSummary = parseAIResponse<{
        executiveSummary: string;
        borrowerProfileStrength: string;
        recommendedLoanAmount: number;
        recommendedInterestRate: number;
        recommendedDuration: number;
        recommendation: {
          decision: string;
          conditions?: string[];
          reasoning: string;
          confidence: number;
        };
      }>(response, {
        executiveSummary: generateDefaultSummary(riskScore, input),
        borrowerProfileStrength: 'stable',
        recommendedLoanAmount: input.loan.amount,
        recommendedInterestRate: input.loan.interestRate,
        recommendedDuration: input.loan.durationMonths,
        recommendation: {
          decision: riskScore.recommendation,
          reasoning: riskScore.riskExplanation || 'Standard assessment',
          confidence: riskScore.confidence,
        },
      });

      return {
        reportDate,
        reportId,
        borrowerSummary: {
          name: input.borrower.name,
          nrc: input.borrower.nrc,
          contact: `${input.borrower.phone}${input.borrower.email ? ` | ${input.borrower.email}` : ''}`,
          age: input.borrower.age,
          employment: `${input.borrower.employmentStatus || 'Not provided'}${input.borrower.employmentStability ? ` (${input.borrower.employmentStability} years)` : ''}`,
          profileStrength: aiSummary.borrowerProfileStrength as any || 'stable',
        },
        riskAnalysis: {
          riskScore: riskScore.score,
          riskLevel: riskScore.level,
          riskExplanation: riskScore.riskExplanation || 'Standard risk assessment',
          keyFlags: riskScore.factors.negative,
          repaymentProbability: riskScore.repaymentProbability || 0.7,
          defaultProbability: riskScore.defaultProbability || 0.3,
        },
        recommendedLoan: {
          amount: aiSummary.recommendedLoanAmount || riskScore.suggestedLoanAmount || input.loan.amount,
          interestRate: aiSummary.recommendedInterestRate || input.loan.interestRate,
          durationMonths: aiSummary.recommendedDuration || input.loan.durationMonths,
          reasoning: aiSummary.recommendation.reasoning,
        },
        collateralAnalysis,
        profitProjection: {
          normalScenario: {
            totalProfit: profitProj.scenarios[0].totalProfit,
            profitMargin: profitProj.scenarios[0].profitMargin,
          },
          lateScenario: {
            totalProfit: profitProj.scenarios[1].totalProfit,
            additionalRevenue: profitProj.scenarios[1].details.lateFees || 0 + (profitProj.scenarios[1].details.penalties || 0),
          },
          defaultScenario: {
            estimatedLoss: Math.abs(profitProj.scenarios[2].totalProfit),
            recoveryRate: collateralAnalysis ? (collateralAnalysis.quickSaleValue / input.loan.amount) * 100 : 0,
          },
        },
        recommendation: {
          decision: aiSummary.recommendation.decision as any,
          conditions: aiSummary.recommendation.conditions,
          reasoning: aiSummary.recommendation.reasoning,
          confidence: aiSummary.recommendation.confidence,
        },
        executiveSummary: aiSummary.executiveSummary,
      };
    } catch (error) {
      console.warn('AI summary generation failed, using rule-based summary:', error);
    }
  }

  // Fallback to rule-based summary
  return generateRuleBasedSummary(input, riskScore, collateralAnalysis, profitProj, reportDate, reportId);
}

/**
 * Generate default/fallback summary
 */
function generateDefaultSummary(riskScore: any, input: LoanSummaryInput): string {
  return `This loan application for ${input.borrower.name} involves ${input.loan.amount.toLocaleString()} ZMW over ${input.loan.durationMonths} months. The risk assessment indicates a ${riskScore.level} risk profile with a score of ${riskScore.score}/100. ${riskScore.recommendation === 'approve' ? 'Recommendation: APPROVE' : riskScore.recommendation === 'review' ? 'Recommendation: REVIEW REQUIRED' : 'Recommendation: REJECT'}.`;
}

/**
 * Generate rule-based summary
 */
function generateRuleBasedSummary(
  input: LoanSummaryInput,
  riskScore: any,
  collateralAnalysis: any,
  profitProj: any,
  reportDate: string,
  reportId: string
): LoanSummaryReport {
  return {
    reportDate,
    reportId,
    borrowerSummary: {
      name: input.borrower.name,
      nrc: input.borrower.nrc,
      contact: input.borrower.phone,
      age: input.borrower.age,
      employment: input.borrower.employmentStatus || 'Not provided',
      profileStrength: calculateProfileStrength(riskScore, input.history),
    },
    riskAnalysis: {
      riskScore: riskScore.score,
      riskLevel: riskScore.level,
      riskExplanation: riskScore.riskExplanation || 'Standard assessment based on available data',
      keyFlags: riskScore.factors.negative,
      repaymentProbability: riskScore.repaymentProbability || 0.7,
      defaultProbability: riskScore.defaultProbability || 0.3,
    },
    recommendedLoan: {
      amount: riskScore.suggestedLoanAmount || input.loan.amount,
      interestRate: input.loan.interestRate,
      durationMonths: input.loan.durationMonths,
      reasoning: `Recommended amount based on risk assessment and income stability`,
    },
    collateralAnalysis,
    profitProjection: {
      normalScenario: {
        totalProfit: profitProj.scenarios[0].totalProfit,
        profitMargin: profitProj.scenarios[0].profitMargin,
      },
      lateScenario: {
        totalProfit: profitProj.scenarios[1].totalProfit,
        additionalRevenue: (profitProj.scenarios[1].details.lateFees || 0) + (profitProj.scenarios[1].details.penalties || 0),
      },
      defaultScenario: {
        estimatedLoss: Math.abs(profitProj.scenarios[2].totalProfit),
        recoveryRate: collateralAnalysis ? (collateralAnalysis.quickSaleValue / input.loan.amount) * 100 : 0,
      },
    },
    recommendation: {
      decision: riskScore.recommendation,
      conditions: riskScore.score >= 50 && riskScore.score < 70 ? [
        'Require additional documentation',
        'Consider shorter repayment period',
      ] : undefined,
      reasoning: riskScore.riskExplanation || 'Based on comprehensive risk assessment',
      confidence: riskScore.confidence,
    },
    executiveSummary: generateDefaultSummary(riskScore, input),
  };
}

/**
 * Calculate borrower profile strength
 */
function calculateProfileStrength(riskScore: any, history?: any): 'weak' | 'developing' | 'stable' | 'strong' | 'very_strong' {
  if (riskScore.score < 25 && (history?.completedLoans || 0) > 2) return 'very_strong';
  if (riskScore.score < 35 && (history?.completedLoans || 0) > 0) return 'strong';
  if (riskScore.score < 50) return 'stable';
  if (riskScore.score < 70) return 'developing';
  return 'weak';
}

