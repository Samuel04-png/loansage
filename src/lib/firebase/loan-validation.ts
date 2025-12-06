import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from './config';
import { isDemoMode } from './config';

export interface LoanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  maximumSafeLoanAmount?: number; // NEW: Maximum safe loan amount
  eligibilityReasoning?: string; // NEW: Detailed reasoning
  riskFlags?: string[]; // NEW: Risk flags identified
}

interface LoanEligibilityCheck {
  customerId: string;
  agencyId: string;
  requestedAmount: number;
  customerSalary?: number;
  monthlyExpenses?: number; // NEW
  existingLoans?: any[];
  pastDefaults?: number; // NEW: Number of past defaults
  collateralValue?: number; // NEW: Collateral value if any
  riskScore?: number; // NEW: Risk score (0-100)
}

/**
 * Business rules for loan validation
 */
export async function validateLoanEligibility(
  check: LoanEligibilityCheck
): Promise<LoanValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isDemoMode) {
    return { valid: true, errors: [], warnings: [] };
  }

  // Rule 1: Maximum loan amount per customer (e.g., 500,000 ZMW)
  const MAX_LOAN_AMOUNT = 500000;
  if (check.requestedAmount > MAX_LOAN_AMOUNT) {
    errors.push(`Loan amount exceeds maximum limit of ${MAX_LOAN_AMOUNT.toLocaleString()} ZMW`);
  }

  // Rule 2: Minimum loan amount
  const MIN_LOAN_AMOUNT = 1000;
  if (check.requestedAmount < MIN_LOAN_AMOUNT) {
    errors.push(`Loan amount must be at least ${MIN_LOAN_AMOUNT.toLocaleString()} ZMW`);
  }

  // Rule 3: Salary-based eligibility (loan should not exceed 3x monthly salary)
  if (check.customerSalary) {
    const maxEligibleAmount = check.customerSalary * 3;
    if (check.requestedAmount > maxEligibleAmount) {
      errors.push(
        `Loan amount (${check.requestedAmount.toLocaleString()} ZMW) exceeds 3x monthly salary (${maxEligibleAmount.toLocaleString()} ZMW)`
      );
    } else if (check.requestedAmount > maxEligibleAmount * 0.8) {
      warnings.push('Loan amount is close to maximum eligibility based on salary');
    }
  }

  // Rule 4: Check for duplicate/active loans
  if (!check.existingLoans) {
    try {
      const loansRef = collection(db, 'agencies', check.agencyId, 'loans');
      const activeLoansQuery = firestoreQuery(
        loansRef,
        where('customerId', '==', check.customerId),
        where('status', 'in', ['active', 'pending', 'approved'])
      );
      const snapshot = await getDocs(activeLoansQuery);
      check.existingLoans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Failed to fetch existing loans:', error);
    }
  }

  if (check.existingLoans && check.existingLoans.length > 0) {
    const activeLoans = check.existingLoans.filter(
      (loan: any) => loan.status === 'active' || loan.status === 'pending' || loan.status === 'approved'
    );

    if (activeLoans.length > 0) {
      warnings.push(`Customer has ${activeLoans.length} active/pending loan(s)`);

      // Check total outstanding
      const totalOutstanding = activeLoans.reduce(
        (sum: number, loan: any) => sum + Number(loan.amount || 0),
        0
      );
      const newTotal = totalOutstanding + check.requestedAmount;

      if (newTotal > MAX_LOAN_AMOUNT) {
        errors.push(
          `Total loan amount (${newTotal.toLocaleString()} ZMW) would exceed maximum limit`
        );
      }
    }
  }

  // Rule 5: Collateral requirements for large loans
  const COLLATERAL_THRESHOLD = 100000;
  if (check.requestedAmount > COLLATERAL_THRESHOLD) {
    warnings.push('Collateral may be required for loans exceeding 100,000 ZMW');
  }

  // Rule 6: Check past defaults (should not have 2+ defaults)
  if (check.pastDefaults !== undefined && check.pastDefaults >= 2) {
    errors.push(`Borrower has ${check.pastDefaults} previous defaults. Not eligible for new loans.`);
  } else if (check.pastDefaults === 1) {
    warnings.push('Borrower has 1 previous default. Review required.');
  }

  // Rule 7: Check for active unpaid loans
  if (check.existingLoans && check.existingLoans.length > 0) {
    const unpaidLoans = check.existingLoans.filter((loan: any) => {
      return loan.status === 'active' && loan.amount && loan.amount > 0;
    });
    if (unpaidLoans.length > 0) {
      errors.push('Borrower has active unpaid loans. Must clear existing loans first.');
    }
  }

  // Calculate maximum safe loan amount
  let maximumSafeLoanAmount = MAX_LOAN_AMOUNT;
  if (check.customerSalary) {
    const disposableIncome = check.customerSalary - (check.monthlyExpenses || 0);
    // Maximum safe amount: 3x monthly income, but payment shouldn't exceed 40% of disposable income
    const maxByIncome = check.customerSalary * 3;
    const maxPaymentCapacity = disposableIncome * 0.4;
    // Reverse calculate from payment capacity (assuming 15% interest, 24 months)
    const interestRate = 0.15;
    const monthlyRate = interestRate / 12;
    const termMonths = 24;
    const maxByPayment = maxPaymentCapacity * ((1 - Math.pow(1 + monthlyRate, -termMonths)) / monthlyRate);
    maximumSafeLoanAmount = Math.min(maxByIncome, maxByPayment, MAX_LOAN_AMOUNT);
  }

  // Adjust based on risk score if provided
  if (check.riskScore !== undefined) {
    if (check.riskScore >= 70) {
      maximumSafeLoanAmount = Math.min(maximumSafeLoanAmount, check.requestedAmount * 0.5);
    } else if (check.riskScore >= 50) {
      maximumSafeLoanAmount = Math.min(maximumSafeLoanAmount, check.requestedAmount * 0.7);
    }
  }

  // Check LTV ratio if collateral provided
  if (check.collateralValue) {
    const ltvRatio = (check.requestedAmount / check.collateralValue) * 100;
    if (ltvRatio > 80) {
      errors.push(`Loan-to-Value ratio (${ltvRatio.toFixed(1)}%) exceeds 80% limit for collateralized loans`);
    } else if (ltvRatio > 65) {
      warnings.push(`LTV ratio (${ltvRatio.toFixed(1)}%) is high. Consider reducing loan amount or increasing collateral.`);
    }
  } else if (check.requestedAmount > COLLATERAL_THRESHOLD) {
    // For unsecured loans over threshold, LTV should be <= 65% of income
    const incomeLTV = check.customerSalary ? (check.requestedAmount / (check.customerSalary * 12)) * 100 : 100;
    if (incomeLTV > 65) {
      warnings.push('Large unsecured loan. Consider requiring collateral.');
    }
  }

  // Generate eligibility reasoning
  const riskFlags: string[] = [];
  if (check.pastDefaults && check.pastDefaults > 0) {
    riskFlags.push(`${check.pastDefaults} previous default(s)`);
  }
  if (check.riskScore !== undefined && check.riskScore >= 50) {
    riskFlags.push(`High risk score (${check.riskScore})`);
  }
  if (check.existingLoans && check.existingLoans.length > 0) {
    riskFlags.push(`${check.existingLoans.length} existing loan(s)`);
  }

  const eligibilityReasoning = generateEligibilityReasoning(
    check,
    maximumSafeLoanAmount,
    riskFlags,
    errors.length === 0 && check.requestedAmount <= maximumSafeLoanAmount
  );

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    maximumSafeLoanAmount: Math.round(maximumSafeLoanAmount),
    eligibilityReasoning,
    riskFlags,
  };
}

/**
 * Generate detailed eligibility reasoning
 */
function generateEligibilityReasoning(
  check: LoanEligibilityCheck,
  maxAmount: number,
  riskFlags: string[],
  eligible: boolean
): string {
  if (!eligible) {
    return `Loan application NOT ELIGIBLE. Requested amount (${check.requestedAmount.toLocaleString()} ZMW) exceeds maximum safe amount (${maxAmount.toLocaleString()} ZMW) or violates eligibility rules.`;
  }

  let reasoning = `Eligible for loan up to ${maxAmount.toLocaleString()} ZMW. `;
  
  if (check.customerSalary) {
    const incomeRatio = (check.requestedAmount / check.customerSalary) * 100;
    reasoning += `Requested amount represents ${incomeRatio.toFixed(1)}% of monthly income. `;
  }

  if (check.collateralValue) {
    const ltvRatio = (check.requestedAmount / check.collateralValue) * 100;
    reasoning += `LTV ratio: ${ltvRatio.toFixed(1)}% (within 80% limit). `;
  }

  if (riskFlags.length > 0) {
    reasoning += `Risk flags: ${riskFlags.join(', ')}. `;
  }

  reasoning += 'Loan meets eligibility criteria.';

  return reasoning;
}

/**
 * Validate collateral value meets requirements
 */
export function validateCollateral(
  loanAmount: number,
  collateralValue: number
): LoanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Collateral should be at least 120% of loan amount
  const requiredCollateral = loanAmount * 1.2;

  if (collateralValue < requiredCollateral) {
    errors.push(
      `Collateral value (${collateralValue.toLocaleString()} ZMW) is less than required (${requiredCollateral.toLocaleString()} ZMW - 120% of loan amount)`
    );
  } else if (collateralValue < requiredCollateral * 1.1) {
    warnings.push('Collateral value is close to minimum requirement');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

