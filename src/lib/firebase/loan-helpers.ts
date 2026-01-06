import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';
import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { createAuditLog } from './firestore-helpers';

/**
 * Delete a loan (only if in DRAFT or REJECTED status)
 * Also checks if loan has repayments before deletion
 */
export async function deleteLoan(
  agencyId: string,
  loanId: string,
  userId: string
): Promise<void> {
  // Get loan to check status
  const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
  const { getDoc } = await import('firebase/firestore');
  const loanSnap = await getDoc(loanRef);

  if (!loanSnap.exists()) {
    throw new Error('Loan not found');
  }

  const loan = loanSnap.data();

  // Only allow deletion of DRAFT or REJECTED loans
  if (loan.status !== 'draft' && loan.status !== 'rejected') {
    throw new Error(`Cannot delete loan with status "${loan.status}". Only DRAFT or REJECTED loans can be deleted.`);
  }

  // Check if loan has repayments
  const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loanId, 'repayments');
  const repaymentsSnapshot = await getDocs(repaymentsRef);

  if (!repaymentsSnapshot.empty) {
    throw new Error('Cannot delete loan with existing repayments. Please remove repayments first.');
  }

  // Delete the loan
  await deleteDoc(loanRef);

  // Create audit log
  await createAuditLog(agencyId, {
    actorId: userId,
    action: 'delete_loan',
    targetCollection: 'loans',
    targetId: loanId,
    metadata: { 
      deletedAt: new Date().toISOString(),
      previousStatus: loan.status,
    },
  }).catch(() => {});
}

/**
 * Update loan fields (only allowed for DRAFT loans or by authorized roles)
 */
export async function updateLoan(
  agencyId: string,
  loanId: string,
  data: {
    amount?: number;
    interestRate?: number;
    durationMonths?: number;
    repaymentFrequency?: string;
    loanType?: string;
    [key: string]: any;
  },
  userId: string,
  userRole: string
): Promise<void> {
  const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
  const { getDoc } = await import('firebase/firestore');
  const loanSnap = await getDoc(loanRef);

  if (!loanSnap.exists()) {
    throw new Error('Loan not found');
  }

  const loan = loanSnap.data();

  // Check permissions: Only DRAFT loans can be edited by loan officers
  // Managers and admins can edit more statuses
  const canEdit = 
    loan.status === 'draft' ||
    userRole === 'admin' ||
    userRole === 'manager' ||
    (userRole === 'accountant' && ['pending', 'approved'].includes(loan.status));

  if (!canEdit) {
    throw new Error(`Cannot edit loan with status "${loan.status}". Only DRAFT loans can be edited, or you need appropriate permissions.`);
  }

  // Prepare update data
  const updateData: any = {
    updatedAt: serverTimestamp(),
  };

  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.interestRate !== undefined) updateData.interestRate = data.interestRate;
  if (data.durationMonths !== undefined) updateData.durationMonths = data.durationMonths;
  if (data.repaymentFrequency !== undefined) updateData.repaymentFrequency = data.repaymentFrequency;
  if (data.loanType !== undefined) updateData.loanType = data.loanType;

  // Recalculate financials if amount, interest rate, or duration changed
  if (data.amount !== undefined || data.interestRate !== undefined || data.durationMonths !== undefined) {
    const { calculateLoanFinancials } = await import('./loan-calculations');
    const principal = data.amount !== undefined ? data.amount : loan.amount;
    const rate = data.interestRate !== undefined ? data.interestRate : loan.interestRate;
    const months = data.durationMonths !== undefined ? data.durationMonths : loan.durationMonths;
    
    if (principal && rate && months) {
      const financials = calculateLoanFinancials(Number(principal), Number(rate), Number(months));
      updateData.totalAmount = financials.totalAmount;
      updateData.totalInterest = financials.totalInterest;
      updateData.monthlyPayment = financials.monthlyPayment;
      
      // Recalculate remaining balance if totalPaid exists
      if (loan.totalPaid !== undefined) {
        updateData.remainingBalance = Math.max(0, financials.totalAmount - Number(loan.totalPaid || 0));
        updateData.outstandingBalance = updateData.remainingBalance;
      }
    }
  }

  // Update the loan
  await updateDoc(loanRef, updateData);

  // Create audit log
  await createAuditLog(agencyId, {
    actorId: userId,
    action: 'update_loan',
    targetCollection: 'loans',
    targetId: loanId,
    metadata: { 
      updatedFields: Object.keys(data),
      previousStatus: loan.status,
    },
  }).catch(() => {});
}
