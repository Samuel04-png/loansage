import { runTransaction, doc, getDoc, setDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { createEmployee } from './firestore-helpers';
import { db } from './config';
import { isDemoMode } from './config';
import { Timestamp } from 'firebase/firestore';
import { validateLoanEligibility } from './loan-validation';

interface CreateLoanTransactionData {
  agencyId: string;
  customerId: string;
  officerId: string;
  amount: number;
  interestRate: number;
  durationMonths: number;
  loanType: string;
  disbursementDate?: Date;
  collateralIncluded?: boolean;
}

/**
 * Atomically create a loan with all related records
 * Uses Firestore transactions to ensure data consistency
 */
export async function createLoanTransaction(
  data: CreateLoanTransactionData
): Promise<{ loanId: string; success: boolean; error?: string }> {
  if (isDemoMode) {
    // Demo mode - return mock data
    return {
      loanId: `demo-loan-${Date.now()}`,
      success: true,
    };
  }

  try {
    // First validate eligibility
    const validation = await validateLoanEligibility({
      customerId: data.customerId,
      agencyId: data.agencyId,
      requestedAmount: data.amount,
    });

    if (!validation.valid) {
      return {
        loanId: '',
        success: false,
        error: validation.errors.join(', '),
      };
    }

    // Check if employee record exists, create if it doesn't
    // Employees are stored with their own IDs, linked via userId field
    const employeesRef = collection(db, 'agencies', data.agencyId, 'employees');
    const employeeQuery = query(employeesRef, where('userId', '==', data.officerId));
    const employeeSnapshot = await getDocs(employeeQuery);
    
    if (employeeSnapshot.empty) {
      // Employee record doesn't exist - create it automatically
      // Get user info first
      const userRef = doc(db, 'users', data.officerId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        return {
          loanId: '',
          success: false,
          error: 'User not found',
        };
      }
      
      const userData = userSnap.data();
      
      // Create employee record
      await createEmployee(data.agencyId, {
        userId: data.officerId,
        email: userData.email || '',
        name: userData.full_name || 'Officer',
        role: (userData.role === 'admin' ? 'admin' : 'loan_officer') as any,
      });
    }

    const result = await runTransaction(db, async (transaction) => {
      // Generate loan ID
      const loanId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const loanRef = doc(db, 'agencies', data.agencyId, 'loans', loanId);

      // Check if customer exists
      const customerRef = doc(db, 'agencies', data.agencyId, 'customers', data.customerId);
      const customerSnap = await transaction.get(customerRef);

      if (!customerSnap.exists()) {
        throw new Error('Customer not found');
      }

      // Verify user exists (employee record was already created above if needed)
      const userRef = doc(db, 'users', data.officerId);
      const userSnap = await transaction.get(userRef);
      
      if (!userSnap.exists()) {
        throw new Error('User not found');
      }

      // Create loan document
      transaction.set(loanRef, {
        id: loanId,
        customerId: data.customerId,
        officerId: data.officerId,
        amount: data.amount,
        interestRate: data.interestRate,
        durationMonths: data.durationMonths,
        loanType: data.loanType,
        status: 'pending',
        disbursementDate: data.disbursementDate
          ? Timestamp.fromDate(data.disbursementDate)
          : null,
        collateralIncluded: data.collateralIncluded || false,
        hasDocuments: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create initial repayment schedule
      const monthlyRate = data.interestRate / 100 / 12;
      const monthlyPayment =
        (data.amount * monthlyRate * Math.pow(1 + monthlyRate, data.durationMonths)) /
        (Math.pow(1 + monthlyRate, data.durationMonths) - 1);

      let remainingBalance = data.amount;
      const startDate = data.disbursementDate || new Date();

      for (let i = 0; i < data.durationMonths; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i + 1);

        const interestPayment = remainingBalance * monthlyRate;
        const principalPayment = monthlyPayment - interestPayment;
        remainingBalance -= principalPayment;

        const repaymentId = `${loanId}-repayment-${i + 1}`;
        const repaymentRef = doc(
          db,
          'agencies',
          data.agencyId,
          'loans',
          loanId,
          'repayments',
          repaymentId
        );

        transaction.set(repaymentRef, {
          id: repaymentId,
          loanId: loanId,
          dueDate: Timestamp.fromDate(dueDate),
          amountDue: monthlyPayment,
          amountPaid: 0,
          paidAt: null,
          status: 'pending',
          method: null,
          createdAt: serverTimestamp(),
        });
      }

      // Create audit log
      const auditLogId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const auditLogRef = doc(db, 'agencies', data.agencyId, 'audit_logs', auditLogId);
      transaction.set(auditLogRef, {
        id: auditLogId,
        actorId: data.officerId,
        action: 'create_loan',
        targetCollection: 'loans',
        targetId: loanId,
        metadata: {
          amount: data.amount,
          customerId: data.customerId,
          loanType: data.loanType,
        },
        createdAt: serverTimestamp(),
      });

      return loanId;
    });

    return {
      loanId: result,
      success: true,
    };
  } catch (error: any) {
    console.error('Transaction error:', error);
    return {
      loanId: '',
      success: false,
      error: error.message || 'Failed to create loan',
    };
  }
}

