/**
 * Loan Workflow Management
 * 
 * Handles all loan status transitions with proper validation, permissions, and audit logging
 */

import { LoanStatus, UserRole, LoanApproval, LoanAuditAction, canTransitionStatus, canPerformAction } from '../../types/loan-workflow';
import { doc, updateDoc, getDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createAuditLog } from '../firebase/firestore-helpers';
import { supabase } from '../supabase/client';
import { notifyLoanSubmitted, notifyLoanApproved, notifyLoanRejected, notifyLoanDisbursed } from './notifications';

export interface ChangeLoanStatusParams {
  loanId: string;
  agencyId: string;
  newStatus: LoanStatus;
  userId: string;
  userRole: UserRole;
  notes?: string;
  approval?: LoanApproval;
}

export interface SubmitLoanParams {
  loanId: string;
  agencyId: string;
  userId: string;
  userRole: UserRole;
}

/**
 * Change loan status with full validation and audit logging
 */
export async function changeLoanStatus(params: ChangeLoanStatusParams): Promise<{
  success: boolean;
  error?: string;
  previousStatus?: LoanStatus;
}> {
  const { loanId, agencyId, newStatus, userId, userRole, notes, approval } = params;

  try {
    // Get current loan data
    const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
    const loanSnap = await getDoc(loanRef);

    if (!loanSnap.exists()) {
      return { success: false, error: 'Loan not found' };
    }

    const loanData = loanSnap.data();
    const currentStatus = loanData.status as LoanStatus;

    // Validate status transition
    if (!canTransitionStatus(currentStatus, newStatus, userRole)) {
      return {
        success: false,
        error: `Cannot transition from ${currentStatus} to ${newStatus} with role ${userRole}`,
      };
    }

    // Validate permissions
    let action: 'approve' | 'reject' | 'disburse' | 'close' | 'submit' = 'submit';
    if (newStatus === LoanStatus.APPROVED) action = 'approve';
    if (newStatus === LoanStatus.REJECTED) action = 'reject';
    if (newStatus === LoanStatus.DISBURSED) action = 'disburse';
    if (newStatus === LoanStatus.CLOSED) action = 'close';

    if (!canPerformAction(action, userRole, currentStatus, loanData.createdBy === userId)) {
      return {
        success: false,
        error: `You do not have permission to ${action} loans`,
      };
    }

    // Prepare update data
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Add approval data if provided
    if (approval) {
      updateData.approval = {
        decision: approval.decision,
        reviewedBy: approval.reviewedBy,
        reviewedAt: approval.reviewedAt,
        notes: approval.notes,
        previousStatus: approval.previousStatus,
        newStatus: approval.newStatus,
      };
      updateData.approved_by = approval.reviewedBy;
    }

    // Update status-specific fields
    if (newStatus === LoanStatus.DISBURSED) {
      updateData.disbursed_at = new Date().toISOString();
      updateData.disbursed_by = userId;
    }

    if (newStatus === LoanStatus.CLOSED) {
      updateData.closed_at = new Date().toISOString();
      updateData.closed_by = userId;
    }

    // Update in Supabase (primary database)
    const { error: supabaseError } = await supabase
      .from('loans')
      .update({
        status: newStatus,
        approved_by: approval?.reviewedBy || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loanId);

    if (supabaseError) {
      console.error('Supabase update error:', supabaseError);
      // Continue with Firestore update even if Supabase fails
    }

    // Update in Firestore
    await updateDoc(loanRef, updateData);

    // Create audit log
    await createAuditLog(agencyId, {
      actorId: userId,
      action: 'loan_status_change',
      targetCollection: 'loans',
      targetId: loanId,
      metadata: {
        previousStatus: currentStatus,
        newStatus: newStatus,
        action: LoanAuditAction.STATUS_CHANGE,
        notes: notes || approval?.notes || '',
        role: userRole,
      },
    });

    // Create audit log entry in Firestore
    const auditLogRef = collection(db, 'agencies', agencyId, 'loans', loanId, 'audit_logs');
    await addDoc(auditLogRef, {
      action: LoanAuditAction.STATUS_CHANGE,
      previousStatus: currentStatus,
      newStatus: newStatus,
      performedBy: userId,
      performedByRole: userRole,
      timestamp: new Date().toISOString(),
      notes: notes || approval?.notes || '',
      metadata: {
        approval: approval || null,
      },
    });

    // Send notifications based on status change
    try {
      const customerData = loanData.customer || {};
      const notificationData = {
        loanId,
        agencyId,
        loanNumber: loanData.loanNumber || loanId,
        customerName: customerData.name || customerData.fullName || 'Customer',
        amount: loanData.amount,
        status: newStatus,
        previousStatus: currentStatus,
        performedBy: userId,
        notes: notes || approval?.notes,
      };

      if (newStatus === LoanStatus.PENDING && currentStatus === LoanStatus.DRAFT) {
        await notifyLoanSubmitted(notificationData);
      } else if (newStatus === LoanStatus.APPROVED) {
        await notifyLoanApproved(notificationData);
      } else if (newStatus === LoanStatus.REJECTED) {
        await notifyLoanRejected(notificationData);
      } else if (newStatus === LoanStatus.DISBURSED) {
        await notifyLoanDisbursed(notificationData);
      }
    } catch (notifError) {
      console.error('Failed to send notifications:', notifError);
      // Don't fail the status change if notifications fail
    }

    return {
      success: true,
      previousStatus: currentStatus,
    };
  } catch (error: any) {
    console.error('Error changing loan status:', error);
    return {
      success: false,
      error: error.message || 'Failed to change loan status',
    };
  }
}

/**
 * Submit loan for review (Draft → Pending)
 */
export async function submitLoanForReview(params: SubmitLoanParams): Promise<{
  success: boolean;
  error?: string;
}> {
  const { loanId, agencyId, userId, userRole } = params;

  // Validate permission
  if (!canPerformAction('submit', userRole, LoanStatus.DRAFT, true)) {
    return {
      success: false,
      error: 'You do not have permission to submit loans',
    };
  }

  return await changeLoanStatus({
    loanId,
    agencyId,
    newStatus: LoanStatus.PENDING,
    userId,
    userRole,
    notes: 'Loan submitted for review',
  });
}

/**
 * Approve loan (Under Review → Approved)
 */
export async function approveLoan(
  loanId: string,
  agencyId: string,
  userId: string,
  userRole: UserRole,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  // Get current status
  const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
  const loanSnap = await getDoc(loanRef);

  if (!loanSnap.exists()) {
    return { success: false, error: 'Loan not found' };
  }

  const currentStatus = loanSnap.data().status as LoanStatus;

  // Determine target status
  let targetStatus = LoanStatus.APPROVED;
  if (currentStatus === LoanStatus.PENDING) {
    targetStatus = LoanStatus.UNDER_REVIEW; // First move to under review
  }

  const approval: LoanApproval = {
    decision: 'approved',
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
    notes: notes,
    previousStatus: currentStatus,
    newStatus: targetStatus === LoanStatus.UNDER_REVIEW ? LoanStatus.APPROVED : targetStatus,
  };

  // If currently pending, first move to under review
  if (currentStatus === LoanStatus.PENDING) {
    const reviewResult = await changeLoanStatus({
      loanId,
      agencyId,
      newStatus: LoanStatus.UNDER_REVIEW,
      userId,
      userRole,
      notes: 'Loan moved to under review',
    });

    if (!reviewResult.success) {
      return reviewResult;
    }
  }

  // Then approve
  return await changeLoanStatus({
    loanId,
    agencyId,
    newStatus: LoanStatus.APPROVED,
    userId,
    userRole,
    notes: notes,
    approval: approval,
  });
}

/**
 * Reject loan (Pending/Under Review → Rejected)
 */
export async function rejectLoan(
  loanId: string,
  agencyId: string,
  userId: string,
  userRole: UserRole,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
  const loanSnap = await getDoc(loanRef);

  if (!loanSnap.exists()) {
    return { success: false, error: 'Loan not found' };
  }

  const currentStatus = loanSnap.data().status as LoanStatus;

  const approval: LoanApproval = {
    decision: 'rejected',
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
    notes: notes,
    previousStatus: currentStatus,
    newStatus: LoanStatus.REJECTED,
  };

  // If currently pending, first move to under review
  if (currentStatus === LoanStatus.PENDING) {
    const reviewResult = await changeLoanStatus({
      loanId,
      agencyId,
      newStatus: LoanStatus.UNDER_REVIEW,
      userId,
      userRole,
      notes: 'Loan moved to under review',
    });

    if (!reviewResult.success) {
      return reviewResult;
    }
  }

  return await changeLoanStatus({
    loanId,
    agencyId,
    newStatus: LoanStatus.REJECTED,
    userId,
    userRole,
    notes: notes,
    approval: approval,
  });
}

/**
 * Disburse loan (Approved → Disbursed → Active)
 */
export async function disburseLoan(
  loanId: string,
  agencyId: string,
  userId: string,
  userRole: UserRole,
  disbursementDate?: Date
): Promise<{ success: boolean; error?: string }> {
  // Validate permission
  if (!canPerformAction('disburse', userRole, LoanStatus.APPROVED, false)) {
    return {
      success: false,
      error: 'You do not have permission to disburse loans',
    };
  }

  const result = await changeLoanStatus({
    loanId,
    agencyId,
    newStatus: LoanStatus.DISBURSED,
    userId,
    userRole,
    notes: `Loan disbursed on ${disbursementDate?.toISOString() || new Date().toISOString()}`,
  });

  if (result.success) {
    // Automatically move to Active after disbursement
    await changeLoanStatus({
      loanId,
      agencyId,
      newStatus: LoanStatus.ACTIVE,
      userId,
      userRole,
      notes: 'Loan activated after disbursement',
    });
  }

  return result;
}

