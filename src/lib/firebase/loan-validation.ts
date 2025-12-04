import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from './config';
import { isDemoMode } from './config';

export interface LoanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface LoanEligibilityCheck {
  customerId: string;
  agencyId: string;
  requestedAmount: number;
  customerSalary?: number;
  existingLoans?: any[];
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

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
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

