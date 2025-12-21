/**
 * Loan Workflow Notifications
 * 
 * Sends notifications for loan status changes and important events
 */

import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createUserNotification } from '../firebase/notifications';
import { LoanStatus } from '../../types/loan-workflow';

export interface LoanNotificationData {
  loanId: string;
  agencyId: string;
  loanNumber?: string;
  customerName?: string;
  amount?: number;
  status: LoanStatus;
  previousStatus?: LoanStatus;
  performedBy?: string;
  notes?: string;
}

/**
 * Send notification to loan officer who created the loan
 */
async function notifyLoanOfficer(
  agencyId: string,
  loanId: string,
  officerId: string,
  type: string,
  message: string,
  link?: string
) {
  try {
    await createUserNotification(officerId, {
      type: type as any,
      title: 'Loan Status Update',
      message,
      link: link || `/employee/loans/${loanId}`,
      agencyId,
      metadata: { loanId },
    });
  } catch (error) {
    console.error('Failed to notify loan officer:', error);
  }
}

/**
 * Send notification to assigned accountant
 */
async function notifyAccountant(
  agencyId: string,
  loanId: string,
  accountantId: string,
  type: string,
  message: string,
  link?: string
) {
  try {
    await createUserNotification(accountantId, {
      type: type as any,
      title: 'Loan Review Required',
      message,
      link: link || `/admin/loans/${loanId}`,
      agencyId,
      metadata: { loanId },
    });
  } catch (error) {
    console.error('Failed to notify accountant:', error);
  }
}

/**
 * Send notification to all admins in the agency
 */
async function notifyAdmins(
  agencyId: string,
  loanId: string,
  type: string,
  message: string,
  link?: string
) {
  try {
    // Get all admins in the agency
    const employeesRef = collection(db, 'agencies', agencyId, 'employees');
    const q = query(employeesRef, where('role', 'in', ['admin', 'manager']));
    const snapshot = await getDocs(q);

    const notifications = snapshot.docs.map(async (doc) => {
      const employee = doc.data();
      if (employee.userId) {
        await createUserNotification(employee.userId, {
          type: type as any,
          title: 'Loan Status Update',
          message,
          link: link || `/admin/loans/${loanId}`,
          agencyId,
          metadata: { loanId },
        });
      }
    });

    await Promise.all(notifications);
  } catch (error) {
    console.error('Failed to notify admins:', error);
  }
}

/**
 * Notify when loan is submitted for review
 */
export async function notifyLoanSubmitted(data: LoanNotificationData) {
  const { loanId, agencyId, loanNumber, customerName, amount, performedBy } = data;

  const message = `Loan ${loanNumber || loanId} for ${customerName || 'customer'} (${amount?.toLocaleString() || 'N/A'} ZMW) has been submitted for review.`;

  // Notify accountant and admins
  await notifyAccountant(agencyId, loanId, '', 'loan_submitted', message);
  await notifyAdmins(agencyId, loanId, 'loan_submitted', message);
}

/**
 * Notify when loan is approved
 */
export async function notifyLoanApproved(data: LoanNotificationData) {
  const { loanId, agencyId, loanNumber, customerName, amount, performedBy } = data;

  const message = `Loan ${loanNumber || loanId} for ${customerName || 'customer'} (${amount?.toLocaleString() || 'N/A'} ZMW) has been approved.`;

  // Notify loan officer
  if (performedBy) {
    // Get loan to find officer
    const loanRef = collection(db, 'agencies', agencyId, 'loans');
    const q = query(loanRef, where('__name__', '==', loanId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const loan = snapshot.docs[0].data();
      if (loan.officerId) {
        await notifyLoanOfficer(agencyId, loanId, loan.officerId, 'loan_approved', message);
      }
    }
  }

  // Notify admins
  await notifyAdmins(agencyId, loanId, 'loan_approved', message);
}

/**
 * Notify when loan is rejected
 */
export async function notifyLoanRejected(data: LoanNotificationData) {
  const { loanId, agencyId, loanNumber, customerName, amount, notes, performedBy } = data;

  const reason = notes ? ` Reason: ${notes}` : '';
  const message = `Loan ${loanNumber || loanId} for ${customerName || 'customer'} (${amount?.toLocaleString() || 'N/A'} ZMW) has been rejected.${reason}`;

  // Notify loan officer
  if (performedBy) {
    const loanRef = collection(db, 'agencies', agencyId, 'loans');
    const q = query(loanRef, where('__name__', '==', loanId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const loan = snapshot.docs[0].data();
      if (loan.officerId) {
        await notifyLoanOfficer(agencyId, loanId, loan.officerId, 'loan_rejected', message);
      }
    }
  }

  // Notify admins
  await notifyAdmins(agencyId, loanId, 'loan_rejected', message);
}

/**
 * Notify when loan is disbursed
 */
export async function notifyLoanDisbursed(data: LoanNotificationData) {
  const { loanId, agencyId, loanNumber, customerName, amount } = data;

  const message = `Loan ${loanNumber || loanId} for ${customerName || 'customer'} (${amount?.toLocaleString() || 'N/A'} ZMW) has been disbursed.`;

  // Notify all relevant parties
  await notifyAdmins(agencyId, loanId, 'loan_disbursed', message);
  
  // Get loan to find officer
  const loanRef = collection(db, 'agencies', agencyId, 'loans');
  const q = query(loanRef, where('__name__', '==', loanId));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const loan = snapshot.docs[0].data();
    if (loan.officerId) {
      await notifyLoanOfficer(agencyId, loanId, loan.officerId, 'loan_disbursed', message);
    }
  }
}

/**
 * Notify when repayment is due
 */
export async function notifyRepaymentDue(
  agencyId: string,
  loanId: string,
  customerId: string,
  amount: number,
  dueDate: Date
) {
  const message = `Repayment of ${amount.toLocaleString()} ZMW is due on ${dueDate.toLocaleDateString()}.`;

  // Get customer user ID
  try {
    const customerRef = collection(db, 'agencies', agencyId, 'customers');
    const q = query(customerRef, where('__name__', '==', customerId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const customer = snapshot.docs[0].data();
      if (customer.userId) {
        await createUserNotification(customer.userId, {
          type: 'payment_due',
          title: 'Repayment Due',
          message,
          link: `/customer/loans/${loanId}`,
          agencyId,
          metadata: { loanId, amount, dueDate: dueDate.toISOString() },
        });
      }
    }
  } catch (error) {
    console.error('Failed to notify customer:', error);
  }

  // Notify loan officer and accountant
  const loanRef = collection(db, 'agencies', agencyId, 'loans');
  const q = query(loanRef, where('__name__', '==', loanId));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const loan = snapshot.docs[0].data();
    if (loan.officerId) {
      await notifyLoanOfficer(agencyId, loanId, loan.officerId, 'payment_due', message);
    }
  }
}

/**
 * Notify when loan becomes overdue
 */
export async function notifyLoanOverdue(
  agencyId: string,
  loanId: string,
  loanNumber: string,
  customerName: string,
  overdueAmount: number
) {
  const message = `Loan ${loanNumber} for ${customerName} is overdue. Amount: ${overdueAmount.toLocaleString()} ZMW.`;

  await notifyAdmins(agencyId, loanId, 'overdue', message);
  
  // Get loan to find officer
  const loanRef = collection(db, 'agencies', agencyId, 'loans');
  const q = query(loanRef, where('__name__', '==', loanId));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const loan = snapshot.docs[0].data();
    if (loan.officerId) {
      await notifyLoanOfficer(agencyId, loanId, loan.officerId, 'overdue', message);
    }
  }
}

