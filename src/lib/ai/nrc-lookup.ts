/**
 * NRC Lookup Risk Check using DeepSeek API
 * Analyzes all loans tied to an NRC and provides risk assessment
 */

import { callDeepSeekAPI, parseAIResponse, isDeepSeekConfigured } from './deepseek-client';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface NRCRiskAnalysis {
  nrc: string;
  totalLoans: number;
  activeLoans: number;
  completedLoans: number;
  defaultedLoans: number;
  repaymentBehavior: {
    onTimeRate: number;
    latePayments: number;
    missedPayments: number;
  };
  riskScore: number; // 0-100, lower is better
  defaultProbability: number; // 0-1
  debtToIncomeRatio: number;
  recommendedMaxLoanSize: number;
  analysis: string;
  factors: {
    positive: string[];
    negative: string[];
  };
}

/**
 * Perform NRC lookup and risk analysis
 */
export async function lookupNRC(
  agencyId: string,
  nrc: string
): Promise<NRCRiskAnalysis> {
  // Fetch all loans for this NRC across all customers
  const customersRef = collection(db, 'agencies', agencyId, 'customers');
  const customersQuery = query(customersRef, where('nrc', '==', nrc));
  const customersSnapshot = await getDocs(customersQuery);
  
  const customerIds = customersSnapshot.docs.map(doc => doc.id);
  
  if (customerIds.length === 0) {
    return {
      nrc,
      totalLoans: 0,
      activeLoans: 0,
      completedLoans: 0,
      defaultedLoans: 0,
      repaymentBehavior: {
        onTimeRate: 0,
        latePayments: 0,
        missedPayments: 0,
      },
      riskScore: 50, // Neutral for new customers
      defaultProbability: 0.3,
      debtToIncomeRatio: 0,
      recommendedMaxLoanSize: 0,
      analysis: 'No previous loan history found for this NRC.',
      factors: {
        positive: ['New customer - no negative history'],
        negative: ['No credit history'],
      },
    };
  }

  // Fetch all loans for these customers
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const allLoans: any[] = [];
  
  for (const customerId of customerIds) {
    const loansQuery = query(
      loansRef,
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );
    try {
      const loansSnapshot = await getDocs(loansQuery);
      allLoans.push(...loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      // Try without orderBy if index missing
      const loansQuery2 = query(loansRef, where('customerId', '==', customerId));
      const loansSnapshot = await getDocs(loansQuery2);
      allLoans.push(...loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  }

  // Calculate basic statistics
  const totalLoans = allLoans.length;
  const activeLoans = allLoans.filter((l: any) => l.status === 'active').length;
  const completedLoans = allLoans.filter((l: any) => 
    ['completed', 'paid'].includes(l.status)
  ).length;
  const defaultedLoans = allLoans.filter((l: any) => l.status === 'defaulted').length;

  // Fetch repayment data
  let onTimePayments = 0;
  let latePayments = 0;
  let missedPayments = 0;
  let totalDebt = 0;
  let totalIncome = 0;

  for (const loan of allLoans) {
    totalDebt += Number(loan.amount || 0);
    
    try {
      const repaymentsRef = collection(
        db,
        'agencies',
        agencyId,
        'loans',
        loan.id,
        'repayments'
      );
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());
      
      for (const repayment of repayments) {
        if (repayment.status === 'paid') {
          const dueDate = repayment.dueDate?.toDate?.() || new Date(repayment.dueDate);
          const paidDate = repayment.paidDate?.toDate?.() || new Date(repayment.paidDate);
          if (paidDate <= dueDate) {
            onTimePayments++;
          } else {
            latePayments++;
          }
        } else if (repayment.status === 'overdue') {
          missedPayments++;
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch repayments for loan ${loan.id}:`, error);
    }
  }

  // Get customer income data
  const customers = customersSnapshot.docs.map(doc => doc.data());
  totalIncome = customers.reduce((sum, c: any) => sum + (Number(c.monthlyIncome || 0) * 12), 0);

  const totalPayments = onTimePayments + latePayments + missedPayments;
  const onTimeRate = totalPayments > 0 ? onTimePayments / totalPayments : 0;
  const debtToIncomeRatio = totalIncome > 0 ? totalDebt / totalIncome : 0;

  // Use DeepSeek API for intelligent analysis if configured
  if (isDeepSeekConfigured()) {
    try {
      const prompt = `You are a loan risk analyst for a microfinance institution in Zambia. Analyze this NRC's loan history and provide a comprehensive risk assessment.

NRC: ${nrc}
Total Loans: ${totalLoans}
Active Loans: ${activeLoans}
Completed Loans: ${completedLoans}
Defaulted Loans: ${defaultedLoans}
On-Time Payment Rate: ${(onTimeRate * 100).toFixed(1)}%
Late Payments: ${latePayments}
Missed Payments: ${missedPayments}
Total Debt: ${totalDebt} ZMW
Total Annual Income: ${totalIncome} ZMW
Debt-to-Income Ratio: ${(debtToIncomeRatio * 100).toFixed(1)}%

Please provide a JSON response with the following structure:
{
  "riskScore": <number 0-100, lower is better>,
  "defaultProbability": <number 0-1>,
  "recommendedMaxLoanSize": <number in ZMW>,
  "analysis": "<detailed risk analysis>",
  "factors": {
    "positive": [<array of positive factors>],
    "negative": [<array of negative factors>]
  }
}

Consider:
1. Historical repayment behavior
2. Default rate
3. Debt-to-income ratio
4. Number of active loans
5. Zambian microfinance market conditions

Return ONLY valid JSON, no additional text.`;

      const response = await callDeepSeekAPI([
        {
          role: 'system',
          content: 'You are an expert loan risk analyst for Zambian microfinance. Provide accurate risk assessments. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ], {
        temperature: 0.2,
        maxTokens: 2000,
        agencyId,
      });

      const aiResult = parseAIResponse<{
        riskScore: number;
        defaultProbability: number;
        recommendedMaxLoanSize: number;
        analysis: string;
        factors: { positive: string[]; negative: string[] };
      }>(response, {
        riskScore: 50,
        defaultProbability: 0.3,
        recommendedMaxLoanSize: 0,
        analysis: '',
        factors: { positive: [], negative: [] },
      });

      return {
        nrc,
        totalLoans,
        activeLoans,
        completedLoans,
        defaultedLoans,
        repaymentBehavior: {
          onTimeRate,
          latePayments,
          missedPayments,
        },
        riskScore: aiResult.riskScore,
        defaultProbability: aiResult.defaultProbability,
        debtToIncomeRatio,
        recommendedMaxLoanSize: aiResult.recommendedMaxLoanSize,
        analysis: aiResult.analysis,
        factors: aiResult.factors,
      };
    } catch (error) {
      console.warn('DeepSeek API call failed, using rule-based analysis:', error);
    }
  }

  // Fallback to rule-based analysis
  let riskScore = 50;
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];

  if (onTimeRate > 0.9) {
    riskScore -= 15;
    positiveFactors.push('Excellent repayment history');
  } else if (onTimeRate < 0.7) {
    riskScore += 20;
    negativeFactors.push('Poor repayment history');
  }

  if (defaultedLoans === 0 && totalLoans > 0) {
    riskScore -= 10;
    positiveFactors.push('No defaults');
  } else if (defaultedLoans > 0) {
    riskScore += 30;
    negativeFactors.push(`${defaultedLoans} defaulted loan(s)`);
  }

  if (debtToIncomeRatio > 0.5) {
    riskScore += 15;
    negativeFactors.push('High debt-to-income ratio');
  } else if (debtToIncomeRatio < 0.2) {
    riskScore -= 8;
    positiveFactors.push('Low debt-to-income ratio');
  }

  if (activeLoans > 3) {
    riskScore += 10;
    negativeFactors.push('Multiple active loans');
  }

  riskScore = Math.max(0, Math.min(100, riskScore));
  const defaultProbability = Math.min(0.95, riskScore / 100);
  const recommendedMaxLoanSize = totalIncome > 0 
    ? Math.min(totalIncome * 0.3, 100000) 
    : 10000;

  return {
    nrc,
    totalLoans,
    activeLoans,
    completedLoans,
    defaultedLoans,
    repaymentBehavior: {
      onTimeRate,
      latePayments,
      missedPayments,
    },
    riskScore,
    defaultProbability,
    debtToIncomeRatio,
    recommendedMaxLoanSize,
    analysis: `Based on ${totalLoans} loan(s), this customer has a ${riskScore < 30 ? 'low' : riskScore < 60 ? 'moderate' : 'high'} risk profile. ${defaultedLoans > 0 ? `Warning: ${defaultedLoans} defaulted loan(s) found.` : ''}`,
    factors: {
      positive: positiveFactors,
      negative: negativeFactors,
    },
  };
}

