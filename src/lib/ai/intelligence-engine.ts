/**
 * TengaLoans AI Intelligence Engine
 * Embedded background intelligence that analyzes system data and provides insights
 * NOT a chatbot - provides actionable system messages and warnings
 */

import { callDeepSeekAPI } from './deepseek-client';
import { formatCurrency } from '../utils';

export interface AIInsight {
  type: 'risk' | 'reminder' | 'insight' | 'suggestion' | 'warning';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  action?: {
    label: string;
    type: 'update_status' | 'add_payment' | 'contact_customer' | 'verify_documents' | 'review_loan' | 'evaluate_collateral';
    data?: any;
  };
  loanId?: string;
  customerId?: string;
  timestamp: Date;
}

interface LoanData {
  id: string;
  customerId: string;
  amount: number;
  status: string;
  interestRate: number;
  durationMonths: number;
  createdAt: any;
  disbursementDate?: any;
  dueDate?: any;
  remainingBalance?: number;
  totalPaid?: number;
}

interface CustomerData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  nrc?: string;
  totalLoans?: number;
  activeLoans?: number;
}

interface PaymentData {
  id: string;
  loanId: string;
  amountDue: number;
  amountPaid?: number;
  dueDate: any;
  paidDate?: any;
  status: string;
}

interface AnalysisContext {
  loans: LoanData[];
  customers: CustomerData[];
  payments: PaymentData[];
  agencyId: string;
}

/**
 * Analyze loans for risk monitoring
 */
export async function analyzeRiskMonitoring(context: AnalysisContext): Promise<AIInsight[]> {
  const insights: AIInsight[] = [];
  const now = new Date();

  // Check for overdue loans
  for (const loan of context.loans) {
    if (loan.status !== 'active') continue;

    const dueDate = loan.dueDate?.toDate?.() || new Date(loan.dueDate);
    if (isNaN(dueDate.getTime())) continue;

    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue > 0) {
      insights.push({
        type: 'risk',
        severity: daysOverdue > 30 ? 'critical' : daysOverdue > 10 ? 'high' : 'medium',
        title: `Loan #${loan.id.substring(0, 8)} is overdue`,
        message: `Loan #${loan.id.substring(0, 8)} is overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}.`,
        loanId: loan.id,
        timestamp: now,
        action: {
          label: 'Review Loan',
          type: 'review_loan',
          data: { loanId: loan.id },
        },
      });
    } else if (daysOverdue >= -3 && daysOverdue < 0) {
      insights.push({
        type: 'reminder',
        severity: 'low',
        title: `Loan #${loan.id.substring(0, 8)} payment due soon`,
        message: `Loan #${loan.id.substring(0, 8)} payment is due in ${Math.abs(daysOverdue)} day${Math.abs(daysOverdue) > 1 ? 's' : ''}.`,
        loanId: loan.id,
        timestamp: now,
      });
    }
  }

  // Check for customers with repeated late payments
  const customerPaymentHistory = new Map<string, { late: number; total: number }>();
  
  for (const payment of context.payments) {
    if (payment.status === 'paid' && payment.paidDate) {
      const paidDate = payment.paidDate?.toDate?.() || new Date(payment.paidDate);
      const dueDate = payment.dueDate?.toDate?.() || new Date(payment.dueDate);
      
      if (!isNaN(paidDate.getTime()) && !isNaN(dueDate.getTime())) {
        const daysLate = Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLate > 0) {
          const loan = context.loans.find(l => l.id === payment.loanId);
          if (loan) {
            const history = customerPaymentHistory.get(loan.customerId) || { late: 0, total: 0 };
            history.late += daysLate > 0 ? 1 : 0;
            history.total += 1;
            customerPaymentHistory.set(loan.customerId, history);
          }
        }
      }
    }
  }

  for (const [customerId, history] of customerPaymentHistory.entries()) {
    if (history.late >= 2 && history.total >= 2) {
      const customer = context.customers.find(c => c.id === customerId);
      if (customer) {
        insights.push({
          type: 'risk',
          severity: 'medium',
          title: `${customer.name} has delayed payments`,
          message: `${customer.name} has delayed ${history.late} payment${history.late > 1 ? 's' : ''} in a row.`,
          customerId,
          timestamp: now,
          action: {
            label: 'Contact Customer',
            type: 'contact_customer',
            data: { customerId },
          },
        });
      }
    }
  }

  // Check for missing payment entries
  for (const loan of context.loans) {
    if (loan.status !== 'active') continue;
    
    const loanPayments = context.payments.filter(p => p.loanId === loan.id);
    const pendingPayments = loanPayments.filter(p => p.status === 'pending');
    const overduePayments = pendingPayments.filter(p => {
      const dueDate = p.dueDate?.toDate?.() || new Date(p.dueDate);
      return !isNaN(dueDate.getTime()) && dueDate < now;
    });

    if (overduePayments.length > 0 && loanPayments.length === 0) {
      insights.push({
        type: 'warning',
        severity: 'medium',
        title: `Loan #${loan.id.substring(0, 8)} has missing payment entries`,
        message: `Loan #${loan.id.substring(0, 8)} has missing payment entries.`,
        loanId: loan.id,
        timestamp: now,
        action: {
          label: 'Add Payment',
          type: 'add_payment',
          data: { loanId: loan.id },
        },
      });
    }
  }

  // Check for incomplete verification
  for (const customer of context.customers) {
    const missingFields: string[] = [];
    if (!customer.nrc) missingFields.push('NRC');
    if (!customer.phone) missingFields.push('phone number');
    if (!customer.email) missingFields.push('email');

    if (missingFields.length > 0) {
      const activeLoans = context.loans.filter(l => l.customerId === customer.id && l.status === 'active');
      if (activeLoans.length > 0) {
        insights.push({
          type: 'reminder',
          severity: 'low',
          title: `Missing customer data for ${customer.name}`,
          message: `${customer.name} is missing ${missingFields.join(', ')}.`,
          customerId: customer.id,
          timestamp: now,
        });
      }
    }
  }

  return insights;
}

/**
 * Generate financial insights using AI
 */
export async function generateFinancialInsights(context: AnalysisContext): Promise<AIInsight[]> {
  const insights: AIInsight[] = [];
  
  // Calculate basic metrics
  const activeLoans = context.loans.filter(l => l.status === 'active');
  const completedLoans = context.loans.filter(l => l.status === 'completed' || l.status === 'paid');
  const defaultedLoans = context.loans.filter(l => l.status === 'defaulted');
  const pendingLoans = context.loans.filter(l => l.status === 'pending');

  const totalPortfolio = activeLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalDisbursed = context.loans.reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalCollected = context.payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

  const defaultRate = context.loans.length > 0 
    ? (defaultedLoans.length / context.loans.length) * 100 
    : 0;

  // Prepare data for AI analysis
  const analysisPrompt = `You are an embedded intelligence system for TengaLoans loan management. Analyze this data and provide SHORT, ACTIONABLE insights. Do NOT act like a chatbot. Be direct and professional.

Loan Statistics:
- Total Loans: ${context.loans.length}
- Active Loans: ${activeLoans.length}
- Completed Loans: ${completedLoans.length}
- Defaulted Loans: ${defaultedLoans.length}
- Pending Loans: ${pendingLoans.length}
- Total Portfolio Value: ${totalPortfolio}
- Total Disbursed: ${totalDisbursed}
- Total Collected: ${totalCollected}
- Default Rate: ${defaultRate.toFixed(1)}%

Provide 2-3 short, actionable insights about:
1. Portfolio health
2. Risk indicators
3. Performance trends

Format each insight as: "INSIGHT_TYPE|SEVERITY|TITLE|MESSAGE"
Where INSIGHT_TYPE is: insight, warning, or suggestion
Where SEVERITY is: low, medium, high, or critical
Example: "insight|medium|Revenue increased|Your revenue increased by 12% this month."
Keep each message under 100 characters.`;

  try {
    // Add timeout to prevent hanging - increased to 25 seconds
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('AI request timeout')), 25000); // 25 second timeout
    });

    const aiPromise = callDeepSeekAPI([
      { role: 'system', content: 'You are an embedded intelligence system. Provide only short, actionable insights. Never act like a chatbot.' },
      { role: 'user', content: analysisPrompt },
    ], { temperature: 0.3, maxTokens: 500, agencyId: context.agencyId });

    const response = await Promise.race([aiPromise, timeoutPromise]);

    // Parse AI response
    const lines = response.split('\n').filter(line => line.trim());
    for (const line of lines) {
      const match = line.match(/^([^|]+)\|([^|]+)\|([^|]+)\|(.+)$/);
      if (match) {
        const [, type, severity, title, message] = match;
        insights.push({
          type: type.trim() as any,
          severity: severity.trim() as any,
          title: title.trim(),
          message: message.trim(),
          timestamp: new Date(),
        });
      }
    }
  } catch (error: any) {
    // Only log non-timeout errors as warnings, timeouts are expected and handled gracefully
    if (error?.message?.includes('timeout')) {
      // Timeout is expected - silently use fallback insights
    } else {
      console.warn('AI insights unavailable, using fallback:', error?.message || 'Unknown error');
    }
    // Always provide fallback insights if AI fails
    if (defaultRate > 20) {
      insights.push({
        type: 'warning',
        severity: 'high',
        title: 'High default rate',
        message: `Default rate is ${defaultRate.toFixed(1)}% - above recommended threshold.`,
        timestamp: new Date(),
      });
    }
    
    if (activeLoans.length > 0) {
      insights.push({
        type: 'insight',
        severity: 'low',
        title: 'Portfolio overview',
        message: `You have ${activeLoans.length} active loans with a total portfolio value of ${formatCurrency(totalPortfolio, 'ZMW')}.`,
        timestamp: new Date(),
      });
    }
    
    if (totalCollected > 0) {
      const collectionRate = totalDisbursed > 0 ? (totalCollected / totalDisbursed) * 100 : 0;
      if (collectionRate < 70) {
        insights.push({
          type: 'warning',
          severity: 'medium',
          title: 'Low collection rate',
          message: `Collection rate is ${collectionRate.toFixed(1)}% - consider increasing collection efforts.`,
          timestamp: new Date(),
        });
      }
    }
  }

  return insights;
}

/**
 * Analyze payment health and predict outcomes
 */
export async function analyzePaymentHealth(loan: LoanData, payments: PaymentData[]): Promise<AIInsight[]> {
  const insights: AIInsight[] = [];
  const now = new Date();

  const paidPayments = payments.filter(p => p.status === 'paid');
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const overduePayments = pendingPayments.filter(p => {
    const dueDate = p.dueDate?.toDate?.() || new Date(p.dueDate);
    return !isNaN(dueDate.getTime()) && dueDate < now;
  });

  // Calculate payment rate
  const totalPaid = paidPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const totalDue = payments.reduce((sum, p) => sum + (p.amountDue || 0), 0);
  const paymentRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

  // Check if behind schedule
  if (paymentRate < 50 && overduePayments.length > 0) {
    insights.push({
      type: 'risk',
      severity: 'high',
      title: `Loan #${loan.id.substring(0, 8)} is behind schedule`,
      message: `This customer is behind schedule—predicted repayment date is after the deadline.`,
      loanId: loan.id,
      timestamp: now,
      action: {
        label: 'Review Loan',
        type: 'review_loan',
        data: { loanId: loan.id },
      },
    });
  }

  // Check for default risk
  if (overduePayments.length >= 2) {
    insights.push({
      type: 'risk',
      severity: 'critical',
      title: `High default risk for Loan #${loan.id.substring(0, 8)}`,
      message: `Multiple overdue payments detected. Default risk is rising.`,
      loanId: loan.id,
      timestamp: now,
      action: {
        label: 'Contact Customer',
        type: 'contact_customer',
        data: { loanId: loan.id },
      },
    });
  }

  return insights;
}

/**
 * Generate action suggestions
 */
export async function generateActionSuggestions(context: AnalysisContext): Promise<AIInsight[]> {
  const insights: AIInsight[] = [];

  // Check for loans that should be marked as settled
  for (const loan of context.loans) {
    if (loan.status === 'active' && loan.remainingBalance !== undefined) {
      if (loan.remainingBalance <= 0 || (loan.totalPaid && loan.totalPaid >= loan.amount)) {
        insights.push({
          type: 'suggestion',
          severity: 'low',
          title: `Consider marking Loan #${loan.id.substring(0, 8)} as Settled`,
          message: `Consider marking this loan as Settled based on full payment.`,
          loanId: loan.id,
          timestamp: new Date(),
          action: {
            label: 'Update Status',
            type: 'update_status',
            data: { loanId: loan.id, newStatus: 'completed' },
          },
        });
      }
    }
  }

  // Check for loans needing status updates
  for (const loan of context.loans) {
    if (loan.status === 'pending') {
      const daysPending = Math.floor((new Date().getTime() - (loan.createdAt?.toDate?.() || new Date(loan.createdAt)).getTime()) / (1000 * 60 * 60 * 24));
      if (daysPending > 7) {
        insights.push({
          type: 'reminder',
          severity: 'medium',
          title: `Loan #${loan.id.substring(0, 8)} needs review`,
          message: `This loan has been pending for ${daysPending} days and needs a status update.`,
          loanId: loan.id,
          timestamp: new Date(),
          action: {
            label: 'Review Loan',
            type: 'review_loan',
            data: { loanId: loan.id },
          },
        });
      }
    }
  }

  return insights;
}

/**
 * Main function to analyze and generate all insights
 */
export async function analyzeLoanSystem(context: AnalysisContext): Promise<AIInsight[]> {
  const allInsights: AIInsight[] = [];

  try {
    // Risk monitoring (always runs, doesn't require AI)
    try {
      const riskInsights = await analyzeRiskMonitoring(context);
      allInsights.push(...riskInsights);
    } catch (error) {
      console.warn('Risk monitoring failed:', error);
    }

    // Financial insights (uses AI but has fallback)
    try {
      const financialInsights = await generateFinancialInsights(context);
      allInsights.push(...financialInsights);
    } catch (error) {
      console.warn('Financial insights failed, using fallback:', error);
      // Fallback insights are already added in generateFinancialInsights catch block
    }

    // Payment health for each active loan (doesn't require AI)
    for (const loan of context.loans.filter(l => l.status === 'active')) {
      try {
        const loanPayments = context.payments.filter(p => p.loanId === loan.id);
        const paymentInsights = await analyzePaymentHealth(loan, loanPayments);
        allInsights.push(...paymentInsights);
      } catch (error) {
        console.warn(`Payment health analysis failed for loan ${loan.id}:`, error);
      }
    }

    // Action suggestions (doesn't require AI)
    try {
      const actionInsights = await generateActionSuggestions(context);
      allInsights.push(...actionInsights);
    } catch (error) {
      console.warn('Action suggestions failed:', error);
    }
  } catch (error) {
    console.error('Error in analyzeLoanSystem:', error);
    // Even if everything fails, return basic insights
    if (allInsights.length === 0) {
      allInsights.push({
        type: 'insight',
        severity: 'low',
        title: 'System Analysis',
        message: 'AI analysis is temporarily unavailable. Basic insights are still available.',
        timestamp: new Date(),
      });
    }
  }

  // Sort by severity and timestamp
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allInsights.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  return allInsights;
}

