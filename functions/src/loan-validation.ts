/**
 * Loan Creation Validation Cloud Function
 * Validates loan eligibility before creation
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface LoanValidationRequest {
  agencyId: string;
  customerId: string;
  requestedAmount: number;
  interestRate: number;
  durationMonths: number;
  collateralValue?: number;
}

interface LoanValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  maximumSafeLoanAmount?: number;
  riskScore?: number;
  eligibilityReasoning?: string;
}

export const loanValidation = functions.https.onCall(
  async (data: LoanValidationRequest, context: any): Promise<LoanValidationResponse> => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, customerId, requestedAmount, collateralValue } = data;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get customer data
      const customerRef = db.doc(`agencies/${agencyId}/customers/${customerId}`);
      const customerSnap = await customerRef.get();

      if (!customerSnap.exists) {
        errors.push('Customer not found');
        return { valid: false, errors, warnings };
      }

      const customer = customerSnap.data()!;

      // Get existing loans for this customer
      const existingLoansQuery = await db
        .collection(`agencies/${agencyId}/loans`)
        .where('customerId', '==', customerId)
        .where('status', 'in', ['active', 'pending', 'approved'])
        .get();

      const existingLoans = existingLoansQuery.docs.map((doc: any) => doc.data());
      const totalExistingDebt = existingLoans.reduce((sum: number, loan: any) => sum + (loan.amount || 0), 0);

      // Validation Rules
      const MAX_LOAN_AMOUNT = 500000;
      const MIN_LOAN_AMOUNT = 1000;
      const MAX_TOTAL_DEBT = 1000000;

      // Rule 1: Amount limits
      if (requestedAmount > MAX_LOAN_AMOUNT) {
        errors.push(`Loan amount exceeds maximum limit of ${MAX_LOAN_AMOUNT.toLocaleString()} ZMW`);
      }
      if (requestedAmount < MIN_LOAN_AMOUNT) {
        errors.push(`Loan amount must be at least ${MIN_LOAN_AMOUNT.toLocaleString()} ZMW`);
      }

      // Rule 2: Total debt limit
      const totalDebt = totalExistingDebt + requestedAmount;
      if (totalDebt > MAX_TOTAL_DEBT) {
        errors.push(`Total debt (${totalDebt.toLocaleString()} ZMW) exceeds maximum limit`);
      }

      // Rule 3: Salary-based eligibility
      const monthlyIncome = customer.monthlyIncome || 0;
      if (monthlyIncome > 0) {
        const maxEligibleAmount = monthlyIncome * 3;
        if (requestedAmount > maxEligibleAmount) {
          errors.push(
            `Loan amount exceeds 3x monthly salary (${maxEligibleAmount.toLocaleString()} ZMW)`
          );
        } else if (requestedAmount > maxEligibleAmount * 0.8) {
          warnings.push('Loan amount is close to maximum eligibility based on salary');
        }
      }

      // Rule 4: Collateral coverage
      if (collateralValue) {
        const ltvRatio = (requestedAmount / collateralValue) * 100;
        if (ltvRatio > 80) {
          errors.push(`Loan-to-Value ratio (${ltvRatio.toFixed(1)}%) exceeds 80% limit`);
        } else if (ltvRatio > 65) {
          warnings.push(`LTV ratio (${ltvRatio.toFixed(1)}%) is high`);
        }
      }

      // Calculate maximum safe loan amount
      let maximumSafeLoanAmount = MAX_LOAN_AMOUNT;
      if (monthlyIncome > 0) {
        maximumSafeLoanAmount = Math.min(maximumSafeLoanAmount, monthlyIncome * 3);
      }
      if (collateralValue) {
        maximumSafeLoanAmount = Math.min(maximumSafeLoanAmount, collateralValue * 0.8);
      }
      maximumSafeLoanAmount = Math.min(maximumSafeLoanAmount, MAX_TOTAL_DEBT - totalExistingDebt);

      // Calculate risk score (0-100)
      let riskScore = 50; // Base score
      if (monthlyIncome > 0) {
        const incomeRatio = (requestedAmount / monthlyIncome) * 100;
        if (incomeRatio > 200) riskScore += 30;
        else if (incomeRatio > 150) riskScore += 20;
        else if (incomeRatio > 100) riskScore += 10;
      }
      if (existingLoans.length > 0) riskScore += 15;
      if (collateralValue && (requestedAmount / collateralValue) > 0.7) riskScore += 10;
      riskScore = Math.min(100, Math.max(0, riskScore));

      const valid = errors.length === 0;
      const eligibilityReasoning = valid
        ? `Loan is eligible. Maximum safe amount: ${maximumSafeLoanAmount.toLocaleString()} ZMW. Risk score: ${riskScore}/100`
        : `Loan is not eligible. ${errors.join('; ')}`;

      return {
        valid,
        errors,
        warnings,
        maximumSafeLoanAmount: Math.round(maximumSafeLoanAmount),
        riskScore,
        eligibilityReasoning,
      };
    } catch (error: any) {
      console.error('Loan validation error:', error);
      throw new functions.https.HttpsError('internal', 'Validation failed', error.message);
    }
  }
);

