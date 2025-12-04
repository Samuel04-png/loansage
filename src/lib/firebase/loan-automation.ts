/**
 * Loan Automation System
 * Automatically updates loan status based on due dates and calculates late fees
 */

import { collection, getDocs, query, where, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './config';
import { createAuditLog } from './firestore-helpers';

interface LateFeeConfig {
  gracePeriodDays: number; // Days before late fees start
  lateFeeRate: number; // Percentage of overdue amount per month
  maxLateFeeRate: number; // Maximum late fee percentage
}

const DEFAULT_LATE_FEE_CONFIG: LateFeeConfig = {
  gracePeriodDays: 7,
  lateFeeRate: 2.5, // 2.5% per month
  maxLateFeeRate: 25, // Max 25% of loan amount
};

/**
 * Calculate late fees for an overdue repayment
 */
export function calculateLateFee(
  overdueAmount: number,
  daysOverdue: number,
  config: LateFeeConfig = DEFAULT_LATE_FEE_CONFIG
): number {
  if (daysOverdue <= config.gracePeriodDays) {
    return 0;
  }

  const effectiveDaysOverdue = daysOverdue - config.gracePeriodDays;
  const monthsOverdue = effectiveDaysOverdue / 30;
  const feeRate = Math.min(config.lateFeeRate * monthsOverdue, config.maxLateFeeRate / 100);
  
  return Math.round(overdueAmount * feeRate * 100) / 100;
}

/**
 * Check and update repayment status based on due date
 */
export async function updateRepaymentStatus(
  agencyId: string,
  loanId: string,
  repaymentId: string,
  repayment: any
): Promise<{ updated: boolean; lateFee?: number }> {
  const now = new Date();
  const dueDate = repayment.dueDate?.toDate?.() || new Date(repayment.dueDate);
  
  // If already paid, no update needed
  if (repayment.status === 'paid' || repayment.amountPaid >= repayment.amountDue) {
    return { updated: false };
  }

  // Check if overdue
  if (dueDate < now && repayment.status === 'pending') {
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const overdueAmount = repayment.amountDue - (repayment.amountPaid || 0);
    const lateFee = calculateLateFee(overdueAmount, daysOverdue);

    const repaymentRef = doc(
      db,
      'agencies',
      agencyId,
      'loans',
      loanId,
      'repayments',
      repaymentId
    );

    await updateDoc(repaymentRef, {
      status: 'overdue',
      lateFee: lateFee,
      daysOverdue: daysOverdue,
      lastChecked: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create audit log
    createAuditLog(agencyId, {
      actorId: 'system',
      action: 'repayment_overdue',
      targetCollection: 'repayments',
      targetId: repaymentId,
      metadata: {
        loanId,
        daysOverdue,
        lateFee,
        overdueAmount,
      },
    }).catch(() => {
      // Ignore audit log errors
    });

    return { updated: true, lateFee };
  }

  return { updated: false };
}

/**
 * Check and update all repayments for a loan
 */
export async function updateLoanRepayments(agencyId: string, loanId: string): Promise<{
  updated: number;
  totalLateFees: number;
  overdueCount: number;
}> {
  const repaymentsRef = collection(
    db,
    'agencies',
    agencyId,
    'loans',
    loanId,
    'repayments'
  );
  
  const snapshot = await getDocs(repaymentsRef);
  let updated = 0;
  let totalLateFees = 0;
  let overdueCount = 0;

  for (const docSnap of snapshot.docs) {
    const repayment = { id: docSnap.id, ...docSnap.data() };
    const result = await updateRepaymentStatus(agencyId, loanId, docSnap.id, repayment);
    
    if (result.updated) {
      updated++;
      totalLateFees += result.lateFee || 0;
      overdueCount++;
    }
  }

  return { updated, totalLateFees, overdueCount };
}

/**
 * Update loan status based on repayment status
 */
export async function updateLoanStatus(agencyId: string, loanId: string): Promise<{
  statusChanged: boolean;
  newStatus?: string;
}> {
  const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
  const { getDoc, updateDoc } = await import('firebase/firestore');
  const loanDoc = await getDoc(loanRef);
  
  if (!loanDoc.exists()) {
    return { statusChanged: false };
  }

  const loan = loanDoc.data();
  const repaymentsRef = collection(
    db,
    'agencies',
    agencyId,
    'loans',
    loanId,
    'repayments'
  );
  
  const repaymentsSnapshot = await getDocs(repaymentsRef);
  const repayments = repaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Check all repayments
  let allPaid = true;
  let hasOverdue = false;
  let hasPending = false;
  let totalPaid = 0;
  let totalDue = 0;

  for (const repayment of repayments) {
    totalDue += Number(repayment.amountDue || 0);
    totalPaid += Number(repayment.amountPaid || 0);
    
    if (repayment.status === 'overdue') {
      hasOverdue = true;
      allPaid = false;
    } else if (repayment.status === 'pending') {
      hasPending = true;
      allPaid = false;
    } else if (repayment.status !== 'paid') {
      allPaid = false;
    }
  }

  let newStatus = loan.status;

  // Determine new status
  if (allPaid && totalPaid >= totalDue) {
    newStatus = 'completed';
  } else if (hasOverdue) {
    // Check if multiple repayments are overdue (defaulted)
    const overdueCount = repayments.filter((r: any) => r.status === 'overdue').length;
    if (overdueCount >= 3 || (overdueCount > 0 && hasOverdue && !hasPending)) {
      newStatus = 'defaulted';
    } else if (loan.status !== 'active') {
      newStatus = 'active';
    }
  } else if (loan.status === 'pending' && repayments.length > 0) {
    newStatus = 'active';
  }

  // Update loan status if changed
  if (newStatus !== loan.status) {
    await updateDoc(loanRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
      statusUpdatedAt: serverTimestamp(),
    });

    // Create audit log
    createAuditLog(agencyId, {
      actorId: 'system',
      action: 'loan_status_auto_update',
      targetCollection: 'loans',
      targetId: loanId,
      metadata: {
        oldStatus: loan.status,
        newStatus,
        reason: allPaid ? 'all_repayments_completed' : hasOverdue ? 'overdue_repayments' : 'status_change',
      },
    }).catch(() => {
      // Ignore audit log errors
    });

    return { statusChanged: true, newStatus };
  }

  return { statusChanged: false };
}

/**
 * Process all active loans and update their status
 * This should be called periodically (e.g., daily via cron or scheduled function)
 */
export async function processAllLoans(agencyId: string): Promise<{
  loansProcessed: number;
  loansUpdated: number;
  totalLateFees: number;
}> {
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const activeLoansQuery = query(loansRef, where('status', 'in', ['active', 'pending']));
  const snapshot = await getDocs(activeLoansQuery);

  let loansProcessed = 0;
  let loansUpdated = 0;
  let totalLateFees = 0;

  for (const loanDoc of snapshot.docs) {
    const loanId = loanDoc.id;
    
    // Update repayments
    const repaymentResult = await updateLoanRepayments(agencyId, loanId);
    totalLateFees += repaymentResult.totalLateFees;
    
    // Update loan status
    const statusResult = await updateLoanStatus(agencyId, loanId);
    
    loansProcessed++;
    if (statusResult.statusChanged || repaymentResult.updated > 0) {
      loansUpdated++;
    }
  }

  return { loansProcessed, loansUpdated, totalLateFees };
}

/**
 * Get overdue repayments summary
 */
export async function getOverdueSummary(agencyId: string): Promise<{
  overdueCount: number;
  totalOverdueAmount: number;
  totalLateFees: number;
  loansAtRisk: number;
}> {
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const activeLoansQuery = query(loansRef, where('status', 'in', ['active', 'defaulted']));
  const snapshot = await getDocs(activeLoansQuery);

  let overdueCount = 0;
  let totalOverdueAmount = 0;
  let totalLateFees = 0;
  let loansAtRisk = 0;

  for (const loanDoc of snapshot.docs) {
    const loanId = loanDoc.id;
    const repaymentsRef = collection(
      db,
      'agencies',
      agencyId,
      'loans',
      loanId,
      'repayments'
    );
    
    const repaymentsSnapshot = await getDocs(repaymentsRef);
    const repayments = repaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    let loanHasOverdue = false;
    let loanOverdueAmount = 0;
    let loanLateFees = 0;

    for (const repayment of repayments) {
      if (repayment.status === 'overdue') {
        loanHasOverdue = true;
        const overdueAmount = Number(repayment.amountDue || 0) - Number(repayment.amountPaid || 0);
        loanOverdueAmount += overdueAmount;
        loanLateFees += Number(repayment.lateFee || 0);
        overdueCount++;
      }
    }

    if (loanHasOverdue) {
      loansAtRisk++;
      totalOverdueAmount += loanOverdueAmount;
      totalLateFees += loanLateFees;
    }
  }

  return {
    overdueCount,
    totalOverdueAmount,
    totalLateFees,
    loansAtRisk,
  };
}

