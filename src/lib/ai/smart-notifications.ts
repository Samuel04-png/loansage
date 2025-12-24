/**
 * Smart Notifications using DeepSeek API
 * AI determines which loans are at risk, which customers need follow-up, etc.
 */

import { callDeepSeekAPI, parseAIResponse, isDeepSeekConfigured } from './deepseek-client';
import { collection, query, where, getDocs, Timestamp, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createNotification, notifyPaymentOverdue, notifyLoanDefault } from '../firebase/notifications';

export interface SmartNotificationRecommendation {
  type: 'loan_at_risk' | 'customer_followup' | 'employee_support' | 'payment_reminder';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  loanId?: string;
  customerId?: string;
  employeeId?: string;
  actionRequired: string;
  confidence: number;
}

/**
 * Analyze loans and generate smart notification recommendations
 */
export async function analyzeLoanRisk(
  agencyId: string,
  loanId: string
): Promise<SmartNotificationRecommendation | null> {
  try {
    const loanRef = collection(db, 'agencies', agencyId, 'loans');
    const loanDoc = await getDocs(query(loanRef, where('__name__', '==', loanId)));
    
    if (loanDoc.empty) return null;
    
    const loan = { id: loanDoc.docs[0].id, ...loanDoc.docs[0].data() } as any;
    
    // Fetch repayments
    const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loanId, 'repayments');
    const repaymentsSnapshot = await getDocs(repaymentsRef);
    const repayments = repaymentsSnapshot.docs.map(doc => doc.data());
    
    const overdueRepayments = repayments.filter((r: any) => {
      const dueDate = r.dueDate?.toDate?.() || new Date(r.dueDate);
      return r.status === 'pending' && dueDate < new Date();
    });
    
    if (overdueRepayments.length === 0) return null;
    
    const daysOverdue = Math.ceil(
      (Date.now() - (overdueRepayments[0].dueDate?.toDate?.() || new Date(overdueRepayments[0].dueDate)).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    // Use DeepSeek for intelligent analysis if configured
    if (isDeepSeekConfigured() && overdueRepayments.length > 0) {
      try {
        const prompt = `You are a loan risk analyst. Analyze this loan situation and recommend notification actions.

Loan ID: ${loanId}
Loan Amount: ${loan.amount} ZMW
Status: ${loan.status}
Overdue Repayments: ${overdueRepayments.length}
Days Overdue: ${daysOverdue}
Total Repayments: ${repayments.length}
Completed Repayments: ${repayments.filter((r: any) => r.status === 'paid').length}

Provide a JSON response:
{
  "type": "loan_at_risk" | "payment_reminder",
  "priority": "low" | "medium" | "high" | "urgent",
  "title": "<notification title>",
  "message": "<detailed message>",
  "actionRequired": "<what action should be taken>",
  "confidence": <0-1>
}

Return ONLY valid JSON.`;

        const response = await callDeepSeekAPI([
          {
            role: 'system',
            content: 'You are a loan risk analyst. Provide actionable notification recommendations. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ], {
          temperature: 0.3,
          maxTokens: 1000,
        });

        const aiResult = parseAIResponse<SmartNotificationRecommendation>(response, {
          type: 'loan_at_risk',
          priority: daysOverdue > 7 ? 'urgent' : daysOverdue > 3 ? 'high' : 'medium',
          title: 'Loan At Risk',
          message: `Loan has ${overdueRepayments.length} overdue repayment(s)`,
          loanId,
          actionRequired: 'Contact customer immediately',
          confidence: 0.8,
        });

        return {
          ...aiResult,
          loanId,
          customerId: loan.customerId,
        };
      } catch (error) {
        console.warn('DeepSeek API call failed, using rule-based analysis:', error);
      }
    }
    
    // Fallback to rule-based
    return {
      type: 'loan_at_risk',
      priority: daysOverdue > 7 ? 'urgent' : daysOverdue > 3 ? 'high' : 'medium',
      title: 'Loan At Risk',
      message: `Loan has ${overdueRepayments.length} overdue repayment(s). ${daysOverdue} day(s) overdue.`,
      loanId,
      customerId: loan.customerId,
      actionRequired: daysOverdue > 7 
        ? 'Immediate collection action required' 
        : 'Contact customer for payment arrangement',
      confidence: 0.8,
    };
  } catch (error) {
    console.error('Error analyzing loan risk:', error);
    return null;
  }
}

/**
 * Generate smart notifications for all at-risk loans
 */
export async function generateSmartNotifications(agencyId: string): Promise<SmartNotificationRecommendation[]> {
  try {
    const loansRef = collection(db, 'agencies', agencyId, 'loans');
    const activeLoansQuery = query(loansRef, where('status', '==', 'active'), limit(100));
    const loansSnapshot = await getDocs(activeLoansQuery);
    
    const recommendations: SmartNotificationRecommendation[] = [];
    
    for (const loanDoc of loansSnapshot.docs) {
      const loan = { id: loanDoc.id, ...loanDoc.data() };
      const analysis = await analyzeLoanRisk(agencyId, loan.id);
      if (analysis) {
        recommendations.push(analysis);
      }
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  } catch (error) {
    console.error('Error generating smart notifications:', error);
    return [];
  }
}

