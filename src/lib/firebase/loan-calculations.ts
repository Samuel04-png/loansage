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
  // Ensure interestRate is treated as a percentage (e.g., 12 means 12%, not 0.12)
  // If rate is already in decimal form (0.12), convert it
  const normalizedRate = interestRate > 1 ? interestRate : interestRate * 100;
  
  const monthlyRate = normalizedRate / 100 / 12;
  // Calculate total interest: Principal * Annual Rate * Years
  // Example: 10,000 * 0.12 * 1 = 1,200 (for 12% annual rate over 1 year)
  const totalInterest = principal * (normalizedRate / 100) * (durationMonths / 12);
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

