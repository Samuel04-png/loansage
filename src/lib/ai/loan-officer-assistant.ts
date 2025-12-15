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
    const systemPrompt = `You are an AI loan officer assistant for TengaLoans. 
You help loan officers understand their portfolio, find loans, analyze performance, and get insights.
Be concise, professional, and data-driven. Always provide actionable insights.

IMPORTANT: When discussing loans, always include:
- Customer names (customerName)
- Loan numbers (loanNumber)
- Loan amounts (amount with currency)
- Loan status
- Other relevant identifiers

Available data:
${JSON.stringify(data, null, 2)}

Answer the user's question using this data. When listing loans, include customer names, loan numbers, and amounts for clarity.
If you need more specific data, suggest what queries to run.`;

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
 * Enrich loan data with customer information and identifiers
 */
async function enrichLoanData(loans: any[], agencyId: string): Promise<any[]> {
  if (!loans || loans.length === 0) return loans;
  
  const { doc, getDoc } = await import('firebase/firestore');
  const customersRef = collection(db, 'agencies', agencyId, 'customers');
  
  // Get unique customer IDs
  const customerIds = [...new Set(loans.map(loan => loan.customerId).filter(Boolean))];
  
  // Fetch all customers in parallel
  const customerPromises = customerIds.map(async (customerId) => {
    try {
      const customerDoc = await getDoc(doc(customersRef, customerId));
      if (customerDoc.exists()) {
        return { id: customerDoc.id, ...customerDoc.data() };
      }
      return null;
    } catch (error) {
      console.warn(`Failed to fetch customer ${customerId}:`, error);
      return null;
    }
  });
  
  const customers = (await Promise.all(customerPromises)).filter(Boolean) as any[];
  const customerMap = new Map(customers.map(c => [c.id, c]));
  
  // Enrich loans with customer data
  return loans.map(loan => {
    const customer = loan.customerId ? customerMap.get(loan.customerId) : null;
    
    return {
      // Loan identifiers
      id: loan.id,
      loanNumber: loan.loanNumber || loan.id.substring(0, 8).toUpperCase(),
      loanId: loan.id,
      
      // Loan details
      amount: loan.amount || 0,
      currency: loan.currency || 'ZMW',
      interestRate: loan.interestRate || 0,
      durationMonths: loan.durationMonths || 0,
      loanType: loan.loanType || 'Personal',
      purpose: loan.purpose || 'Not specified',
      status: loan.status || 'pending',
      
      // Dates
      createdAt: loan.createdAt,
      disbursementDate: loan.disbursementDate,
      dueDate: loan.dueDate,
      
      // Customer information
      customerId: loan.customerId,
      customerName: customer?.fullName || customer?.name || 'Unknown Customer',
      customerPhone: customer?.phoneNumber || customer?.phone || 'N/A',
      customerEmail: customer?.email || 'N/A',
      customerNRC: customer?.nrc || 'N/A',
      
      // Financial details
      principalAmount: loan.principalAmount || loan.amount || 0,
      totalAmount: loan.totalAmount || loan.amount || 0,
      remainingBalance: loan.remainingBalance || loan.amount || 0,
      paidAmount: loan.paidAmount || 0,
      
      // Officer information
      officerId: loan.officerId,
      officerName: loan.officerName || 'N/A',
      
      // Additional identifiers
      collateralValue: loan.collateralValue || 0,
      riskScore: loan.riskScore,
      approvalDate: loan.approvalDate,
      
      // Original loan data (for backward compatibility)
      ...loan,
    };
  });
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
    // Get overdue loans with full details
    const loansSnapshot = await getDocs(query(loansRef, where('status', 'in', ['overdue', 'defaulted']), orderBy('createdAt', 'desc'), limit(50)));
    const rawLoans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    data.overdueLoans = await enrichLoanData(rawLoans, context.agencyId);
  }
  
  if (questionLower.includes('pending') || questionLower.includes('approval')) {
    // Get pending loans with full details
    const loansSnapshot = await getDocs(query(loansRef, where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(50)));
    const rawLoans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    data.pendingLoans = await enrichLoanData(rawLoans, context.agencyId);
  }
  
  if (questionLower.includes('active') || questionLower.includes('portfolio')) {
    // Get active loans with full details
    const loansSnapshot = await getDocs(query(loansRef, where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(100)));
    const rawLoans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    data.activeLoans = await enrichLoanData(rawLoans, context.agencyId);
    
    // Calculate portfolio metrics
    const loans = data.activeLoans;
    data.portfolioMetrics = {
      totalLoans: loans.length,
      totalAmount: loans.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0),
      averageLoanAmount: loans.length > 0 ? loans.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0) / loans.length : 0,
      totalOutstanding: loans.reduce((sum: number, loan: any) => sum + Number(loan.remainingBalance || loan.amount || 0), 0),
    };
  }
  
  // Search by customer name, loan number, or amount
  if (questionLower.includes('find') || questionLower.includes('search') || questionLower.includes('show me')) {
    // Get all loans and filter by question keywords
    const allLoansSnapshot = await getDocs(query(loansRef, orderBy('createdAt', 'desc'), limit(200)));
    const rawLoans = allLoansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const enrichedLoans = await enrichLoanData(rawLoans, context.agencyId);
    
    // Filter by keywords in question
    const searchTerms = questionLower.split(' ').filter(term => term.length > 2);
    const filteredLoans = enrichedLoans.filter((loan: any) => {
      const searchableText = [
        loan.customerName,
        loan.loanNumber,
        loan.id,
        loan.amount?.toString(),
        loan.loanType,
        loan.purpose,
        loan.customerPhone,
        loan.customerNRC,
      ].join(' ').toLowerCase();
      
      return searchTerms.some(term => searchableText.includes(term));
    });
    
    data.searchResults = filteredLoans.slice(0, 20); // Limit to 20 results
  }
  
  if (questionLower.includes('customer') || questionLower.includes('borrower')) {
    // Get customers with their loan counts
    const customersRef = collection(db, 'agencies', context.agencyId, 'customers');
    const customersSnapshot = await getDocs(query(customersRef, limit(100)));
    const customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get loan counts for each customer
    const customerLoanCounts = new Map<string, number>();
    const allLoansSnapshot = await getDocs(query(loansRef, limit(500)));
    allLoansSnapshot.docs.forEach(doc => {
      const loan = doc.data();
      if (loan.customerId) {
        customerLoanCounts.set(loan.customerId, (customerLoanCounts.get(loan.customerId) || 0) + 1);
      }
    });
    
    data.customers = customers.map((customer: any) => ({
      ...customer,
      fullName: customer.fullName || customer.name,
      totalLoans: customerLoanCounts.get(customer.id) || 0,
    }));
  }
  
  if (questionLower.includes('revenue') || questionLower.includes('income') || questionLower.includes('profit')) {
    // Get all loans for revenue calculation
    const loansSnapshot = await getDocs(query(loansRef, orderBy('createdAt', 'desc'), limit(200)));
    const rawLoans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const loans = await enrichLoanData(rawLoans, context.agencyId);
    
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
  
  // Always include basic stats with enriched loan data
  if (!data.portfolioMetrics && !data.searchResults) {
    const allLoansSnapshot = await getDocs(query(loansRef, limit(100)));
    const rawLoans = allLoansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allLoans = await enrichLoanData(rawLoans, context.agencyId);
    
    data.basicStats = {
      totalLoans: allLoans.length,
      byStatus: {
        active: allLoans.filter((l: any) => l.status === 'active').length,
        pending: allLoans.filter((l: any) => l.status === 'pending').length,
        completed: allLoans.filter((l: any) => l.status === 'completed' || l.status === 'paid').length,
        defaulted: allLoans.filter((l: any) => l.status === 'defaulted').length,
      },
      sampleLoans: allLoans.slice(0, 10).map((loan: any) => ({
        loanNumber: loan.loanNumber,
        customerName: loan.customerName,
        amount: loan.amount,
        status: loan.status,
      })),
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
    
    // Add action to view first overdue loan
    if (data.overdueLoans[0]?.id) {
      actions.push({
        label: `View ${data.overdueLoans[0].customerName || 'loan'}`,
        type: 'view_loan',
        data: { loanId: data.overdueLoans[0].id },
      });
    }
  }
  
  if (data.pendingLoans && data.pendingLoans.length > 0) {
    actions.push({
      label: `Approve ${data.pendingLoans.length} pending loans`,
      type: 'view_loans',
      data: { status: 'pending' },
    });
  }
  
  if (data.activeLoans && data.activeLoans.length > 0) {
    actions.push({
      label: 'View active loans',
      type: 'view_loans',
      data: { status: 'active' },
    });
  }
  
  if (data.searchResults && data.searchResults.length > 0) {
    actions.push({
      label: `View ${data.searchResults.length} search results`,
      type: 'view_loans',
      data: {},
    });
    
    // Add action to view first search result
    if (data.searchResults[0]?.id) {
      actions.push({
        label: `View ${data.searchResults[0].customerName || 'loan'}`,
        type: 'view_loan',
        data: { loanId: data.searchResults[0].id },
      });
    }
  }
  
  if (data.customers && data.customers.length > 0) {
    actions.push({
      label: 'View all customers',
      type: 'view_customers',
      data: {},
    });
  }
  
  if (data.portfolioMetrics) {
    actions.push({
      label: 'View dashboard',
      type: 'view_dashboard',
      data: {},
    });
    actions.push({
      label: 'View reports',
      type: 'view_reports',
      data: {},
    });
  }
  
  if (data.revenueMetrics) {
    actions.push({
      label: 'View analytics',
      type: 'view_reports',
      data: {},
    });
  }
  
  return actions.slice(0, 4); // Limit to 4 actions
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

