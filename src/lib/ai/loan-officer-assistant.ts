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
    mode?: 'ask' | 'action' | 'auto';
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
    
    // Use AI to generate answer with mode-aware prompts
    const mode = context?.mode || 'ask';
    let systemPrompt = '';
    
    if (mode === 'ask') {
      systemPrompt = `You are an AI loan officer assistant for TengaLoans. 
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
    } else if (mode === 'action') {
      systemPrompt = `You are an AI loan officer assistant for TengaLoans in ACTION mode.
The user wants you to perform actions on the database (create loans, update status, etc.).

IMPORTANT PERMISSION RESTRICTIONS:
- Only administrators can approve, reject, or disburse loans
- Changing loan status to "approved", "rejected", or "disbursed" requires admin permissions
- If the user is not an admin and requests approval/rejection/disbursement, inform them that admin permission is required
- Do not suggest approve/reject/disburse actions unless you know the user has admin role

When the user requests an action, you should:
1. Identify what action needs to be performed
2. Check if the action requires admin permissions (status changes to approved/rejected/disbursed)
3. If admin permission is required and user is not admin, explain why the action cannot be performed in your response
4. Extract all necessary parameters from the request
   - IMPORTANT: When extracting customer names, be flexible and smart:
     * Look for customer names in the conversation context and available data
     * If user says "this customer" or "the customer I just created", look in the available data for recently mentioned or created customers
     * Extract the EXACT name from available data - match it precisely as stored (case-sensitive, but system handles case-insensitive matching)
     * If user provides partial name, use what they provided - the system will do fuzzy matching
     * Look for customer mentions in phrases like "add loan to [Name]", "create loan for [Name]", "loan for [Name]"
   
   CRITICAL: When user requests to create a loan for a customer:
   - FIRST check the "Available data" section for the customer name in the "customers" or "recentCustomers" array
   - If the customer IS found: proceed with create_loan action normally
   - If the customer is NOT found in available data:
     * DO NOT create the loan action yet - it will fail
     * Instead, ask the user for customer information in a friendly, conversational way:
       "I don't see [customer name] in the system yet. To create this loan, I'll need to add them as a customer first. Can you provide me with:"
       - Full Name (if not already clear from context)
       - Phone Number (required)
       - NRC Number (required)
       - Address (required)
       - Email (optional but helpful)
       - Employment Status (optional)
       - Monthly Income (optional)
       - Employer Name (optional)
       - Job Title (optional)
     * Wait for the user to provide this information in their next message
     * Once they provide it, you can then create BOTH actions:
       * First: create_customer with all provided information
       * Second: create_loan using the same customer name
     * Format multiple actions as: <ACTIONS>[{"type": "create_customer", "data": {...}}, {"type": "create_loan", "data": {...}}]</ACTIONS>
   - Be proactive and helpful - guide the user through the process naturally

5. Provide a clear description of what will be done
6. At the END of your response, include a JSON action object (or array for multiple actions) in this exact format:
   <ACTION>  (or <ACTIONS> for multiple actions)
   {
     "type": "create_loan" | "update_loan_status" | "add_payment" | "create_customer" | "update_customer" | "approve_loan" | "reject_loan" | "disburse_loan" | "update_loan" | "add_note",
     "data": {
       // For create_loan:
       "customerId" or "customerName": string (REQUIRED - extract from context, available data, or user's request. Be smart about finding customer names. If user says "this customer" or mentions a customer recently, look in the conversation history or available data),
       "amount": number (REQUIRED - extract from user's request),
       "interestRate": number (default 15),
       "durationMonths": number (default 12),
       "loanType": string (default "Personal"),
       "disbursementDate": string (ISO date, optional),
       
       // For update_loan_status (NOTE: approved/rejected/disbursed require admin):
       "loanId" or "loanNumber": string,
       "status": "pending" | "active" | "completed" | "defaulted" | "cancelled" | "approved" | "rejected" | "disbursed"
       // WARNING: "approved", "rejected", and "disbursed" can only be set by administrators
       
       // For add_payment:
       "loanId" or "loanNumber": string,
       "amount": number (optional, will open payment dialog),
       
       // For create_customer:
       "fullName": string (required),
       "phone": string (required),
       "email": string (optional),
       "nrc": string (required),
       "address": string (required),
       "employer": string (optional),
       "employmentStatus": "employed" | "self-employed" | "unemployed" | "retired" | "student" (optional),
       "monthlyIncome": number (optional),
       "jobTitle": string (optional),
       
       // For update_customer:
       "customerId" or "customerName": string,
       "fullName": string (optional),
       "phone": string (optional),
       "email": string (optional),
       "address": string (optional),
       // ... any other customer fields to update
       
       // For approve_loan (REQUIRES ADMIN):
       "loanId" or "loanNumber": string,
       "notes": string (optional),
       
       // For reject_loan (REQUIRES ADMIN):
       "loanId" or "loanNumber": string,
       "reason": string (required),
       
       // For disburse_loan (REQUIRES ADMIN):
       "loanId" or "loanNumber": string,
       "disbursementDate": string (ISO date, optional),
       
       // For update_loan:
       "loanId" or "loanNumber": string,
       "amount": number (optional),
       "interestRate": number (optional),
       "durationMonths": number (optional),
       "loanType": string (optional),
       // ... any other loan fields to update
       
       // For add_note:
       "loanId" or "loanNumber" or "customerId" or "customerName": string,
       "note": string (required),
       "noteType": "loan" | "customer" (default: "loan")
     },
     "label": "Human-readable description"
   }
   </ACTION>

Available data:
${JSON.stringify(data, null, 2)}

IMPORTANT: 
- Only suggest actions that are safe and have all required parameters
- If information is missing, ask for clarification in your response
- Always include the <ACTION> JSON block at the end when you identify an action
- Extract customer names, loan numbers, amounts, etc. from the available data when possible
- REMEMBER: Approval, rejection, and disbursement actions require admin permissions
- Available action types: create_loan, update_loan_status, add_payment, create_customer, update_customer, approve_loan (admin only), reject_loan (admin only), disburse_loan (admin only), update_loan, add_note

SMART CUSTOMER NAME EXTRACTION:
- When user mentions a customer in context (e.g., "add loan to this customer", "create loan for Masheda Beleshi"), extract the exact name from:
  1. The user's current message (direct mentions)
  2. Available data provided (customer lists, recent actions)
  3. Conversation history if the customer was recently mentioned or created
- Be flexible with name variations - the system handles case-insensitive and partial matching
- If user says "the customer I just created" or similar, look in the conversation for recently created customers
- Always prefer extracting from available data over asking for clarification when the information exists

CUSTOMER CREATION WORKFLOW:
- If user requests a loan for a customer NOT in available data, proactively ask for customer details
- Be conversational and friendly: "I don't see [name] in the system. I'll need some information to create their profile first..."
- Ask for: Full Name, Phone, NRC, Address (required) and Email, Employment Status, Income, Employer (optional but helpful)
- Once you have the information, suggest BOTH create_customer and create_loan actions
- Format multiple actions as: <ACTIONS>[{"type": "create_customer", ...}, {"type": "create_loan", ...}]</ACTIONS>`;
    } else if (mode === 'auto') {
      systemPrompt = `You are an AI loan officer assistant for TengaLoans in AUTO mode.
The user wants you to automatically perform actions without confirmation.

IMPORTANT PERMISSION RESTRICTIONS:
- Only administrators can approve, reject, or disburse loans
- Changing loan status to "approved", "rejected", or "disbursed" requires admin permissions
- If the user is not an admin and requests approval/rejection/disbursement, inform them that admin permission is required
- Do not automatically execute approve/reject/disburse actions unless you know the user has admin role

When the user requests an action, you should:
1. Identify what action needs to be performed
2. Check if the action requires admin permissions (status changes to approved/rejected/disbursed)
3. If admin permission is required and user is not admin, explain why the action cannot be performed
4. Extract all necessary parameters
   - CRITICAL: When extracting customer names for loan creation or updates:
     * Look in the "Available data" section below for customer lists - use EXACT names as shown there
     * If user says "this customer", "the customer", "that customer", look for recently created or mentioned customers in conversation
     * Match customer names EXACTLY as they appear in the available data (the system handles case-insensitive matching)
     * If user provides a partial name, use it - the system will do fuzzy matching
   - For amounts: Extract numbers clearly mentioned (e.g., "$5000", "5000", "five thousand" = 5000)
   
   CUSTOMER CREATION WORKFLOW (AUTO MODE):
   - If user requests a loan for a customer NOT in available data, ask for customer information in a friendly way
   - Say: "I don't see [customer name] in the system. I'll need some information to create their profile first..."
   - Ask for: Full Name, Phone, NRC, Address (required) and optionally Email, Employment Status, Income, Employer
   - Once user provides the information, create BOTH actions:
     * First: create_customer
     * Second: create_loan  
   - Format multiple actions as: <ACTIONS>[{"type": "create_customer", ...}, {"type": "create_loan", ...}]</ACTIONS>
   
5. Automatically execute the action if all required data is available and permissions are met
6. If data is missing (especially for loan creation), ask for clarification in a conversational, helpful way

At the END of your response, include a JSON action object in this exact format:
<ACTION>
{
  "type": "create_loan" | "update_loan_status" | "add_payment" | "create_customer" | "update_customer" | "approve_loan" | "reject_loan" | "disburse_loan" | "update_loan" | "add_note",
  "data": {
    // For create_loan:
    "customerId" or "customerName": string,
    "amount": number,
    "interestRate": number (default 15),
    "durationMonths": number (default 12),
    "loanType": string (default "Personal"),
    "disbursementDate": string (ISO date, optional),
    
    // For update_loan_status (NOTE: approved/rejected/disbursed require admin):
    "loanId" or "loanNumber": string,
    "status": "pending" | "active" | "completed" | "defaulted" | "cancelled" | "approved" | "rejected" | "disbursed"
    // WARNING: "approved", "rejected", and "disbursed" can only be set by administrators
    
    // For add_payment:
    "loanId" or "loanNumber": string,
    "amount": number (optional),
    
    // For create_customer:
    "fullName": string (required),
    "phone": string (required),
    "email": string (optional),
    "nrc": string (required),
    "address": string (required),
    "employer": string (optional),
    "employmentStatus": "employed" | "self-employed" | "unemployed" | "retired" | "student" (optional),
    "monthlyIncome": number (optional),
    "jobTitle": string (optional),
    
    // For update_customer:
    "customerId" or "customerName": string,
    // ... any customer fields to update
    
    // For approve_loan (REQUIRES ADMIN):
    "loanId" or "loanNumber": string,
    "notes": string (optional),
    
    // For reject_loan (REQUIRES ADMIN):
    "loanId" or "loanNumber": string,
    "reason": string (required),
    
    // For disburse_loan (REQUIRES ADMIN):
    "loanId" or "loanNumber": string,
    "disbursementDate": string (ISO date, optional),
    
    // For update_loan:
    "loanId" or "loanNumber": string,
    // ... any loan fields to update
    
    // For add_note:
    "loanId" or "loanNumber" or "customerId" or "customerName": string,
    "note": string (required),
    "noteType": "loan" | "customer" (default: "loan")
  },
  "label": "Human-readable description"
}
</ACTION>

Available data:
${JSON.stringify(data, null, 2)}

IMPORTANT: 
- Only perform actions that are safe and have all required parameters
- Always validate data before executing
- Always include the <ACTION> JSON block at the end when you identify an action
- Extract customer names, loan numbers, amounts, etc. from the available data when possible
- Available action types: create_loan, update_loan_status, add_payment, create_customer, update_customer, approve_loan (admin only), reject_loan (admin only), disburse_loan (admin only), update_loan, add_note

SMART CUSTOMER NAME EXTRACTION (CRITICAL):
- ALWAYS check the "Available data" section for a "customers" or "recentCustomers" array
- When user mentions a customer name (e.g., "Masheda Beleshi"), find the EXACT match in the available customer data
- Use the EXACT "fullName" field from the customer data in the action (don't modify or guess)
- If user says "this customer" or "the customer I just created", use the most recent customer from "recentCustomers" or conversation context
- The system will handle fuzzy matching, but you should provide the best match from available data`;
    }

    // Ensure question is a string
    const questionStr = question != null ? String(question) : '';
    
    const aiResponseRaw = await callDeepSeekAPI([
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: questionStr,
      },
    ], { temperature: 0.3, maxTokens: 1500 });
    
    // Ensure AI response is always a string
    const aiResponse = aiResponseRaw != null ? String(aiResponseRaw) : 'I apologize, but I received an invalid response. Please try again.';
    
    // Extract suggestions and actions from response
    const suggestions = extractSuggestions(aiResponse);
    let actions = extractActions(aiResponse, data);
    
    // For action/auto modes, try to extract structured action from AI response
    if ((mode === 'action' || mode === 'auto') && aiResponse.includes('<ACTION>')) {
      try {
        const actionMatch = aiResponse.match(/<ACTION>([\s\S]*?)<\/ACTION>/);
        if (actionMatch) {
          const actionJson = JSON.parse(actionMatch[1].trim());
          // Prepend the structured action to the actions array
          actions = [actionJson, ...actions];
        }
      } catch (error) {
        console.warn('Failed to parse action JSON from AI response:', error);
      }
    }
    
    return {
      answer: aiResponse,
      data,
      suggestions,
      actions,
      confidence: 0.85,
    };
  } catch (error: any) {
    console.error('AI Assistant error:', error);
    
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    // Provide helpful error messages based on error type
    let userFriendlyMessage = 'I apologize, but I encountered an error while processing your request.';
    
    if (errorMessage.includes('Service is too busy') || errorMessage.includes('too busy')) {
      userFriendlyMessage = `**AI Service Temporarily Unavailable**

The AI service is currently experiencing high traffic. Please try again in a few moments. Your question has been saved and you can retry when ready.`;
    } else if (errorMessage.includes('CORS') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
      userFriendlyMessage = `**Network Connection Error**

I'm having trouble connecting to the AI service. Please check your internet connection and try again.`;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      userFriendlyMessage = `**Rate Limit Exceeded**

The AI service has reached its rate limit. Please wait a few minutes before trying again.`;
    } else if (errorMessage.includes('unauthenticated')) {
      userFriendlyMessage = `**Authentication Required**

You need to be logged in to use the AI assistant. Please log in and try again.`;
    } else {
      userFriendlyMessage = `I encountered an error: ${errorMessage}. Please try rephrasing your question or try again in a moment.`;
    }
    
    return {
      answer: userFriendlyMessage,
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
  // Safely convert question to string and lowercase
  const questionStr = question != null ? String(question) : '';
  const questionLower = questionStr.toLowerCase();
  const data: any = {};
  
  const loansRef = collection(db, 'agencies', context.agencyId, 'loans');
  const customersRef = collection(db, 'agencies', context.agencyId, 'customers');
  
  // Always include customer data if question involves customers or loans (for better customer name matching)
  if (questionLower.includes('customer') || questionLower.includes('loan') || questionLower.includes('create') || questionLower.includes('add')) {
    try {
      const customersSnapshot = await getDocs(query(customersRef, orderBy('createdAt', 'desc'), limit(100)));
      const customers = customersSnapshot.docs.map(doc => {
        const customerData = doc.data();
        return {
          id: doc.id,
          fullName: customerData.fullName || customerData.name || customerData.full_name || 'Unknown',
          name: customerData.fullName || customerData.name || customerData.full_name || 'Unknown',
          phone: customerData.phone || '',
          email: customerData.email || '',
          nrc: customerData.nrc || customerData.nrc_number || '',
          createdAt: customerData.createdAt?.toDate?.()?.toISOString() || customerData.created_at || null,
        };
      });
      data.customers = customers;
      data.recentCustomers = customers.slice(0, 20); // Last 20 customers for quick reference
    } catch (error) {
      console.warn('Failed to fetch customers for AI context:', error);
    }
  }
  
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
  
  // Always include customers if question involves creating loans, adding loans, or mentions customers
  if (questionLower.includes('customer') || questionLower.includes('borrower') || 
      questionLower.includes('create loan') || questionLower.includes('add loan') ||
      questionLower.includes('new loan') || questionLower.includes('loan for')) {
    // Get customers with their loan counts
    const customersRef = collection(db, 'agencies', context.agencyId, 'customers');
    const customersSnapshot = await getDocs(query(customersRef, orderBy('createdAt', 'desc'), limit(100)));
    const customers = customersSnapshot.docs.map(doc => {
      const customerData = doc.data();
      return {
        id: doc.id,
        ...customerData,
        fullName: customerData.fullName || customerData.name || customerData.full_name || 'Unknown',
        name: customerData.fullName || customerData.name || customerData.full_name || 'Unknown',
      };
    });
    
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
    
    // Include recent customers separately for easier AI access
    data.recentCustomers = customers.slice(0, 20).map((c: any) => ({
      id: c.id,
      fullName: c.fullName || c.name,
      phone: c.phone || '',
      email: c.email || '',
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

