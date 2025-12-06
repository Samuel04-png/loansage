/**
 * Repayment System Helpers
 * Handles repayment calculations, validations, and loan updates
 */

import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';
import { calculateLoanFinancials } from './loan-calculations';

export interface RepaymentUpdateResult {
  success: boolean;
  updatedFields: {
    remainingBalance?: number;
    totalPaid?: number;
    upcomingDueDate?: Date | null;
    loanStatus?: string;
  };
  errors?: string[];
}

/**
 * Update loan summary after payment
 * Updates: remaining balance, total paid, upcoming due date, loan status
 */
export async function updateLoanAfterPayment(
  agencyId: string,
  loanId: string
): Promise<RepaymentUpdateResult> {
  try {
    // Get loan data
    const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
    const { getDoc } = await import('firebase/firestore');
    const loanSnap = await getDoc(loanRef);
    
    if (!loanSnap.exists()) {
      return {
        success: false,
        updatedFields: {},
        errors: ['Loan not found'],
      };
    }

    const loan = loanSnap.data();
    const principal = Number(loan.amount || 0);
    const interestRate = Number(loan.interestRate || 0);
    const durationMonths = Number(loan.durationMonths || 0);

    // Calculate total payable
    const financials = calculateLoanFinancials(principal, interestRate, durationMonths);
    const totalPayable = financials.totalAmount;

    // Get all repayments
    const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loanId, 'repayments');
    const repaymentsSnapshot = await getDocs(repaymentsRef);
    const repayments = repaymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate,
    }));

    // Calculate total paid
    const totalPaid = repayments.reduce((sum: number, r: any) => {
      return sum + Number(r.amountPaid || 0);
    }, 0);

    // Calculate remaining balance
    const remainingBalance = Math.max(0, totalPayable - totalPaid);

    // Find upcoming due date (next unpaid repayment)
    const unpaidRepayments = repayments
      .filter((r: any) => {
        const amountDue = Number(r.amountDue || 0);
        const amountPaid = Number(r.amountPaid || 0);
        return amountPaid < amountDue && r.status !== 'paid';
      })
      .sort((a: any, b: any) => {
        const dateA = a.dueDate instanceof Date ? a.dueDate : new Date(a.dueDate || 0);
        const dateB = b.dueDate instanceof Date ? b.dueDate : new Date(b.dueDate || 0);
        return dateA.getTime() - dateB.getTime();
      });

    const upcomingDueDate = unpaidRepayments.length > 0 
      ? (unpaidRepayments[0].dueDate instanceof Date 
          ? unpaidRepayments[0].dueDate 
          : new Date(unpaidRepayments[0].dueDate))
      : null;

    // Determine loan status
    let loanStatus = loan.status || 'active';
    
    if (remainingBalance <= 0) {
      loanStatus = 'completed';
    } else {
      // Check for overdue repayments
      const hasOverdue = repayments.some((r: any) => {
        if (r.status === 'paid') return false;
        const dueDate = r.dueDate instanceof Date ? r.dueDate : new Date(r.dueDate || 0);
        return dueDate < new Date() && r.status === 'overdue';
      });

      // Check for defaulted (90+ days overdue)
      const hasDefaulted = repayments.some((r: any) => {
        if (r.status !== 'overdue') return false;
        const daysOverdue = r.daysOverdue || 0;
        return daysOverdue >= 90;
      });

      if (hasDefaulted) {
        loanStatus = 'defaulted';
      } else if (hasOverdue) {
        loanStatus = 'overdue';
      } else if (loanStatus === 'pending' && upcomingDueDate) {
        // Auto-activate when first payment is due
        loanStatus = 'active';
      }
    }

    // Update loan document
    const updateData: any = {
      totalPaid: Math.round(totalPaid * 100) / 100,
      remainingBalance: Math.round(remainingBalance * 100) / 100,
      updatedAt: serverTimestamp(),
    };

    if (upcomingDueDate) {
      updateData.upcomingDueDate = Timestamp.fromDate(upcomingDueDate);
    } else {
      updateData.upcomingDueDate = null;
    }

    if (loanStatus !== loan.status) {
      updateData.status = loanStatus;
      if (loanStatus === 'completed') {
        updateData.completedAt = serverTimestamp();
      }
    }

    await updateDoc(loanRef, updateData);

    return {
      success: true,
      updatedFields: {
        remainingBalance: Math.round(remainingBalance * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        upcomingDueDate: upcomingDueDate || null,
        loanStatus,
      },
    };
  } catch (error: any) {
    console.error('Error updating loan after payment:', error);
    return {
      success: false,
      updatedFields: {},
      errors: [error.message || 'Failed to update loan'],
    };
  }
}

/**
 * Validate payment amount before processing
 */
export function validatePaymentAmount(
  paymentAmount: number,
  remainingBalance: number
): { valid: boolean; error?: string } {
  if (!paymentAmount || paymentAmount <= 0) {
    return { valid: false, error: 'Payment amount must be greater than 0' };
  }

  if (paymentAmount > remainingBalance) {
    return {
      valid: false,
      error: `Payment amount (${paymentAmount.toLocaleString()} ZMW) cannot exceed remaining balance (${remainingBalance.toLocaleString()} ZMW)`,
    };
  }

  return { valid: true };
}

/**
 * Get next upcoming payment for a loan
 */
export async function getUpcomingPayment(
  agencyId: string,
  loanId: string
): Promise<{
  amount: number;
  dueDate: Date | null;
  repaymentId: string | null;
} | null> {
  try {
    const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loanId, 'repayments');
    const q = query(
      repaymentsRef,
      where('status', 'in', ['pending', 'overdue']),
      orderBy('dueDate', 'asc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    const repayment = snapshot.docs[0].data();
    const dueDate = repayment.dueDate?.toDate?.() || repayment.dueDate;

    return {
      amount: Number(repayment.amountDue || 0) - Number(repayment.amountPaid || 0),
      dueDate: dueDate instanceof Date ? dueDate : new Date(dueDate),
      repaymentId: snapshot.docs[0].id,
    };
  } catch (error) {
    console.error('Error getting upcoming payment:', error);
    return null;
  }
}

