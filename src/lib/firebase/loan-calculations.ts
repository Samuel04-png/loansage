/**
 * Loan calculation utilities
 * Handles interest, profit, and financial calculations
 */

export interface LoanFinancials {
  principal: number;
  interestRate: number;
  totalInterest: number;
  totalAmount: number;
  monthlyPayment: number;
  totalProfit: number;
  profitMargin: number;
}

/**
 * Calculate loan financials
 */
export function calculateLoanFinancials(
  principal: number,
  interestRate: number,
  durationMonths: number
): LoanFinancials {
  const monthlyRate = interestRate / 100 / 12;
  const totalInterest = principal * (interestRate / 100) * (durationMonths / 12);
  const totalAmount = principal + totalInterest;
  
  // Calculate monthly payment using amortization formula
  let monthlyPayment = 0;
  if (monthlyRate > 0) {
    monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) / 
                     (Math.pow(1 + monthlyRate, durationMonths) - 1);
  } else {
    monthlyPayment = principal / durationMonths;
  }
  
  const totalProfit = totalInterest;
  const profitMargin = (totalProfit / principal) * 100;
  
  return {
    principal,
    interestRate,
    totalInterest,
    totalAmount,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
  };
}

/**
 * Calculate profit from a loan based on payments received
 */
export function calculateLoanProfit(
  principal: number,
  interestRate: number,
  totalPaid: number
): {
  profit: number;
  profitMargin: number;
  remainingBalance: number;
  isProfitable: boolean;
} {
  const totalInterest = principal * (interestRate / 100);
  const totalAmountOwed = principal + totalInterest;
  const profit = totalPaid - principal;
  const profitMargin = (profit / principal) * 100;
  const remainingBalance = totalAmountOwed - totalPaid;
  
  return {
    profit: Math.round(profit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
    remainingBalance: Math.round(remainingBalance * 100) / 100,
    isProfitable: profit > 0,
  };
}

/**
 * Calculate remaining balance on a loan
 */
export function calculateRemainingBalance(
  loanAmount: number,
  interestRate: number,
  totalPaid: number
): number {
  const totalInterest = loanAmount * (interestRate / 100);
  const totalOwed = loanAmount + totalInterest;
  return Math.max(0, Math.round((totalOwed - totalPaid) * 100) / 100);
}

