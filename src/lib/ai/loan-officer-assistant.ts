/**
 * AI Loan Officer Assistant
 * Natural language interface for querying loan data and getting insights
 */

import { callDeepSeekAPI } from './deepseek-client';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface AssistantQuery {
  question: string;
  context?: {
    agencyId: string;
    userId?: string;
    filters?: any;
  };
}

export interface AssistantResponse {
  answer: string;
  data?: any;
  suggestions?: string[];
  actions?: Array<{
    label: string;
    type: string;
    data: any;
  }>;
  confidence: number;
}

/**
 * Process natural language query about loans
 */
export async function askLoanOfficerAssistant(
  query: AssistantQuery
): Promise<AssistantResponse> {
  const { question, context } = query;
  
  if (!context?.agencyId) {
    return {
      answer: 'Please provide agency context to answer your question.',
      confidence: 0,
    };
  }
  
  try {
    // Fetch relevant data based on question keywords
    const data = await fetchRelevantData(question, context);
    
    // Use AI to generate answer
    const systemPrompt = `You are an AI loan officer assistant for LoanSage. 
You help loan officers understand their portfolio, find loans, analyze performance, and get insights.
Be concise, professional, and data-driven. Always provide actionable insights.

Available data:
${JSON.stringify(data, null, 2)}

Answer the user's question using this data. If you need more specific data, suggest what queries to run.`;

    const aiResponse = await callDeepSeekAPI([
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: question,
      },
    ], { temperature: 0.3, maxTokens: 1000 });
    
    // Extract suggestions and actions from response
    const suggestions = extractSuggestions(aiResponse);
    const actions = extractActions(aiResponse, data);
    
    return {
      answer: aiResponse,
      data,
      suggestions,
      actions,
      confidence: 0.85,
    };
  } catch (error: any) {
    console.error('AI Assistant error:', error);
    return {
      answer: `I encountered an error: ${error.message}. Please try rephrasing your question.`,
      confidence: 0,
    };
  }
}

/**
 * Fetch relevant data based on question
 */
async function fetchRelevantData(question: string, context: { agencyId: string; filters?: any }): Promise<any> {
  const questionLower = question.toLowerCase();
  const data: any = {};
  
  const loansRef = collection(db, 'agencies', context.agencyId, 'loans');
  
  // Detect what data is needed
  if (questionLower.includes('overdue') || questionLower.includes('late') || questionLower.includes('default')) {
    // Get overdue loans
    const loansSnapshot = await getDocs(query(loansRef, where('status', 'in', ['overdue', 'defaulted']), orderBy('createdAt', 'desc'), limit(50)));
    data.overdueLoans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  
  if (questionLower.includes('pending') || questionLower.includes('approval')) {
    // Get pending loans
    const loansSnapshot = await getDocs(query(loansRef, where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(50)));
    data.pendingLoans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  
  if (questionLower.includes('active') || questionLower.includes('portfolio')) {
    // Get active loans
    const loansSnapshot = await getDocs(query(loansRef, where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(100)));
    data.activeLoans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Calculate portfolio metrics
    const loans = data.activeLoans;
    data.portfolioMetrics = {
      totalLoans: loans.length,
      totalAmount: loans.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0),
      averageLoanAmount: loans.length > 0 ? loans.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0) / loans.length : 0,
    };
  }
  
  if (questionLower.includes('customer') || questionLower.includes('borrower')) {
    // Get customers
    const customersRef = collection(db, 'agencies', context.agencyId, 'customers');
    const customersSnapshot = await getDocs(query(customersRef, limit(100)));
    data.customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  
  if (questionLower.includes('revenue') || questionLower.includes('income') || questionLower.includes('profit')) {
    // Get all loans for revenue calculation
    const loansSnapshot = await getDocs(query(loansRef, orderBy('createdAt', 'desc'), limit(200)));
    const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Calculate revenue metrics
    let totalDisbursed = 0;
    let totalCollected = 0;
    
    for (const loan of loans) {
      totalDisbursed += Number(loan.amount || 0);
      
      // Get repayments
      try {
        const repaymentsRef = collection(db, 'agencies', context.agencyId, 'loans', loan.id, 'repayments');
        const repaymentsSnapshot = await getDocs(repaymentsRef);
        const repayments = repaymentsSnapshot.docs.map(doc => doc.data());
        
        const paidRepayments = repayments.filter((r: any) => r.status === 'paid');
        totalCollected += paidRepayments.reduce((sum: number, r: any) => sum + Number(r.amountPaid || 0), 0);
      } catch (error) {
        // Skip if error
      }
    }
    
    data.revenueMetrics = {
      totalDisbursed,
      totalCollected,
      outstanding: totalDisbursed - totalCollected,
      collectionRate: totalDisbursed > 0 ? (totalCollected / totalDisbursed) * 100 : 0,
    };
  }
  
  // Always include basic stats
  if (!data.portfolioMetrics) {
    const allLoansSnapshot = await getDocs(query(loansRef, limit(100)));
    const allLoans = allLoansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    data.basicStats = {
      totalLoans: allLoans.length,
      byStatus: {
        active: allLoans.filter((l: any) => l.status === 'active').length,
        pending: allLoans.filter((l: any) => l.status === 'pending').length,
        completed: allLoans.filter((l: any) => l.status === 'completed' || l.status === 'paid').length,
        defaulted: allLoans.filter((l: any) => l.status === 'defaulted').length,
      },
    };
  }
  
  return data;
}

/**
 * Extract suggestions from AI response
 */
function extractSuggestions(response: string): string[] {
  const suggestions: string[] = [];
  
  // Look for numbered lists or bullet points
  const lines = response.split('\n');
  for (const line of lines) {
    if (line.match(/^[-*•]\s+/) || line.match(/^\d+\.\s+/)) {
      suggestions.push(line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').trim());
    }
  }
  
  return suggestions.slice(0, 5); // Limit to 5 suggestions
}

/**
 * Extract actionable items from response
 */
function extractActions(response: string, data: any): Array<{ label: string; type: string; data: any }> {
  const actions: Array<{ label: string; type: string; data: any }> = [];
  
  // Suggest actions based on data
  if (data.overdueLoans && data.overdueLoans.length > 0) {
    actions.push({
      label: `Review ${data.overdueLoans.length} overdue loans`,
      type: 'view_loans',
      data: { status: 'overdue' },
    });
  }
  
  if (data.pendingLoans && data.pendingLoans.length > 0) {
    actions.push({
      label: `Approve ${data.pendingLoans.length} pending loans`,
      type: 'view_loans',
      data: { status: 'pending' },
    });
  }
  
  return actions;
}

/**
 * Get common queries/suggestions
 */
export function getCommonQueries(): string[] {
  return [
    'Show me all overdue loans',
    'What is my portfolio performance?',
    'How many loans are pending approval?',
    'What is my total revenue this month?',
    'Show me high-risk loans',
    'What is my default rate?',
    'Which customers have multiple loans?',
    'Show me loans that need attention',
  ];
}

