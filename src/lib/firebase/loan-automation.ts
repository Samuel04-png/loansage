/**
 * Loan Automation System
 * Automatically updates loan status based on due dates and calculates late fees
 */

import { collection, getDocs, query, where, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './config';
import { createAuditLog } from './firestore-helpers';
import { getLateFeeConfig, DEFAULT_LOAN_SETTINGS } from './loan-settings';

interface LateFeeConfig {
  gracePeriodDays: number; // Days before late fees start
  lateFeeRate: number; // Percentage of overdue amount per month
  maxLateFeeRate: number; // Maximum late fee percentage
}

const DEFAULT_LATE_FEE_CONFIG: LateFeeConfig = {
  gracePeriodDays: DEFAULT_LOAN_SETTINGS.gracePeriodDays,
  lateFeeRate: DEFAULT_LOAN_SETTINGS.lateFeeRate,
  maxLateFeeRate: DEFAULT_LOAN_SETTINGS.maxLateFeeRate,
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
    // Get late fee config from agency settings
    const lateFeeConfig = await getLateFeeConfig(agencyId);
    const lateFee = calculateLateFee(overdueAmount, daysOverdue, lateFeeConfig);

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

    // Send email notification if status changed to overdue
    if (newStatus === 'overdue' || (hasOverdue && newStatus !== 'defaulted')) {
      try {
        const customerRef = doc(db, 'agencies', agencyId, 'customers', loan.customerId);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          const customer = customerSnap.data();
          const overdueAmount = repayments
            .filter((r: any) => r.status === 'overdue')
            .reduce((sum: number, r: any) => sum + Number(r.amountDue || 0), 0);
          
          // Trigger email via Cloud Function
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const functions = getFunctions();
          const sendLoanEmail = httpsCallable(functions, 'sendLoanEmail');
          await sendLoanEmail({
            agencyId,
            loanId,
            customerId: loan.customerId,
            customerEmail: customer.email,
            templateType: 'loan_overdue',
            data: {
              loanNumber: loan.loanNumber || loanId,
              customerName: customer.fullName || customer.name,
              overdueAmount,
            },
          }).catch((err) => {
            console.error('Failed to send overdue email:', err);
          });
        }
      } catch (error) {
        console.error('Error sending overdue email notification:', error);
      }
    }

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

/**
 * Generate payment schedule for a loan
 */
export async function generatePaymentSchedule(
  agencyId: string,
  loanId: string,
  principal: number,
  interestRate: number,
  durationMonths: number,
  startDate: Date
): Promise<void> {
  const monthlyRate = interestRate / 100 / 12;
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) / 
    (Math.pow(1 + monthlyRate, durationMonths) - 1);

  const repaymentsRef = collection(
    db,
    'agencies',
    agencyId,
    'loans',
    loanId,
    'repayments'
  );

  const { addDoc } = await import('firebase/firestore');
  let remainingBalance = principal;

  for (let i = 0; i < durationMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i + 1);

    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    remainingBalance -= principalPayment;

    await addDoc(repaymentsRef, {
      month: i + 1,
      dueDate: Timestamp.fromDate(dueDate),
      amountDue: Math.round(monthlyPayment * 100) / 100,
      principalDue: Math.round(principalPayment * 100) / 100,
      interestDue: Math.round(interestPayment * 100) / 100,
      amountPaid: 0,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Check and send due-date reminders
 */
export async function checkAndSendDueDateReminders(agencyId: string): Promise<{
  remindersSent: number;
  upcomingRepayments: Array<{ loanId: string; repaymentId: string; customerId: string; dueDate: Date }>;
}> {
  const now = new Date();
  const reminderDays = [3, 1]; // Remind 3 days and 1 day before due date
  
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const activeLoansQuery = query(loansRef, where('status', '==', 'active'));
  const loansSnapshot = await getDocs(activeLoansQuery);

  const upcomingRepayments: Array<{ loanId: string; repaymentId: string; customerId: string; dueDate: Date }> = [];
  let remindersSent = 0;

  for (const loanDoc of loansSnapshot.docs) {
    const loan = loanDoc.data();
    const loanId = loanDoc.id;
    const customerId = loan.customerId;

    const repaymentsRef = collection(
      db,
      'agencies',
      agencyId,
      'loans',
      loanId,
      'repayments'
    );
    
    const pendingRepaymentsQuery = query(
      repaymentsRef,
      where('status', '==', 'pending')
    );
    const repaymentsSnapshot = await getDocs(pendingRepaymentsQuery);

    for (const repaymentDoc of repaymentsSnapshot.docs) {
      const repayment = repaymentDoc.data();
      const dueDate = repayment.dueDate?.toDate?.() || new Date(repayment.dueDate);
      
      const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (reminderDays.includes(daysUntilDue)) {
        // Send reminder (create notification)
        upcomingRepayments.push({
          loanId,
          repaymentId: repaymentDoc.id,
          customerId,
          dueDate,
        });

        // Create notification for customer
        try {
          const notificationsRef = collection(db, 'agencies', agencyId, 'notifications');
          const { addDoc } = await import('firebase/firestore');
          await addDoc(notificationsRef, {
            userId: customerId,
            type: 'payment_reminder',
            title: 'Payment Due Reminder',
            message: `Your payment of ${repayment.amountDue.toLocaleString()} ZMW is due in ${daysUntilDue} day(s).`,
            loanId,
            repaymentId: repaymentDoc.id,
            read: false,
            createdAt: serverTimestamp(),
          });
          remindersSent++;
        } catch (error) {
          console.warn(`Failed to create reminder notification:`, error);
        }
      }
    }
  }

  return { remindersSent, upcomingRepayments };
}

/**
 * Default Detection Bot - Automatically detect and flag potential defaults
 */
export async function detectDefaults(agencyId: string): Promise<{
  defaultsDetected: number;
  atRiskLoans: Array<{ loanId: string; customerId: string; riskLevel: string; reason: string }>;
}> {
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const activeLoansQuery = query(loansRef, where('status', '==', 'active'));
  const loansSnapshot = await getDocs(activeLoansQuery);

  const atRiskLoans: Array<{ loanId: string; customerId: string; riskLevel: string; reason: string }> = [];
  let defaultsDetected = 0;
  const now = new Date();

  for (const loanDoc of loansSnapshot.docs) {
    const loan = loanDoc.data();
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

    // Count overdue repayments
    const overdueRepayments = repayments.filter((r: any) => {
      const dueDate = r.dueDate?.toDate?.() || new Date(r.dueDate);
      return r.status === 'overdue' || (r.status === 'pending' && dueDate < now);
    });

    if (overdueRepayments.length >= 3) {
      // Critical - mark as defaulted
      const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
      await updateDoc(loanRef, {
        status: 'defaulted',
        defaultedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      defaultsDetected++;
      
      atRiskLoans.push({
        loanId,
        customerId: loan.customerId,
        riskLevel: 'critical',
        reason: `${overdueRepayments.length} overdue repayments - AUTO-DEFAULTED`,
      });
    } else if (overdueRepayments.length >= 2) {
      // High risk
      atRiskLoans.push({
        loanId,
        customerId: loan.customerId,
        riskLevel: 'high',
        reason: `${overdueRepayments.length} overdue repayments - High default risk`,
      });
    } else if (overdueRepayments.length === 1) {
      // Medium risk
      atRiskLoans.push({
        loanId,
        customerId: loan.customerId,
        riskLevel: 'medium',
        reason: '1 overdue repayment - Monitor closely',
      });
    }
  }

  return { defaultsDetected, atRiskLoans };
}

/**
 * Collateral Follow-up Alerts
 */
export async function checkCollateralFollowUp(agencyId: string): Promise<{
  alertsGenerated: number;
  collateralsRequiringFollowUp: Array<{ loanId: string; collateralInfo: string }>;
}> {
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const activeLoansQuery = query(
    loansRef,
    where('status', '==', 'active'),
    where('collateralIncluded', '==', true)
  );
  const loansSnapshot = await getDocs(activeLoansQuery);

  const collateralsRequiringFollowUp: Array<{ loanId: string; collateralInfo: string }> = [];
  let alertsGenerated = 0;
  const now = new Date();

  for (const loanDoc of loansSnapshot.docs) {
    const loan = loanDoc.data();
    const loanId = loanDoc.id;
    const loanDate = loan.createdAt?.toDate?.() || new Date(loan.createdAt);
    
    // Check if collateral verification is overdue (should be verified within 30 days)
    const daysSinceLoan = Math.floor((now.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLoan >= 30 && !loan.collateralVerified) {
      collateralsRequiringFollowUp.push({
        loanId,
        collateralInfo: 'Collateral verification overdue - requires immediate follow-up',
      });

      // Create alert for loan officer
      try {
        const notificationsRef = collection(db, 'agencies', agencyId, 'notifications');
        const { addDoc } = await import('firebase/firestore');
        await addDoc(notificationsRef, {
          userId: loan.officerId,
          type: 'collateral_followup',
          title: 'Collateral Follow-up Required',
          message: `Loan ${loanId.substring(0, 8)}: Collateral verification overdue. Please verify collateral status.`,
          loanId,
          read: false,
          createdAt: serverTimestamp(),
        });
        alertsGenerated++;
      } catch (error) {
        console.warn(`Failed to create collateral follow-up alert:`, error);
      }
    }
  }

  return { alertsGenerated, collateralsRequiringFollowUp };
}

/**
 * Loan Ageing Analysis
 */
export async function analyzeLoanAgeing(agencyId: string): Promise<{
  ageingBreakdown: {
    current: number; // 0-30 days past due
    days31to60: number;
    days61to90: number;
    over90: number;
  };
  totalAgeingAmount: number;
}> {
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const activeLoansQuery = query(loansRef, where('status', '==', 'active'));
  const loansSnapshot = await getDocs(activeLoansQuery);

  const ageingBreakdown = {
    current: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
  };
  let totalAgeingAmount = 0;
  const now = new Date();

  for (const loanDoc of loansSnapshot.docs) {
    const loanId = loanDoc.id;
    const repaymentsRef = collection(
      db,
      'agencies',
      agencyId,
      'loans',
      loanId,
      'repayments'
    );
    const overdueQuery = query(repaymentsRef, where('status', '==', 'overdue'));
    const repaymentsSnapshot = await getDocs(overdueQuery);

    for (const repaymentDoc of repaymentsSnapshot.docs) {
      const repayment = repaymentDoc.data();
      const dueDate = repayment.dueDate?.toDate?.() || new Date(repayment.dueDate);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const overdueAmount = Number(repayment.amountDue || 0) - Number(repayment.amountPaid || 0);

      totalAgeingAmount += overdueAmount;

      if (daysOverdue <= 30) {
        ageingBreakdown.current += overdueAmount;
      } else if (daysOverdue <= 60) {
        ageingBreakdown.days31to60 += overdueAmount;
      } else if (daysOverdue <= 90) {
        ageingBreakdown.days61to90 += overdueAmount;
      } else {
        ageingBreakdown.over90 += overdueAmount;
      }
    }
  }

  return { ageingBreakdown, totalAgeingAmount };
}

/**
 * Auto-approve/reject based on risk score
 */
export async function autoApproveRejectLoans(agencyId: string): Promise<{
  approved: number;
  rejected: number;
  requiresReview: number;
}> {
  const loansRef = collection(db, 'agencies', agencyId, 'loans');
  const pendingLoansQuery = query(loansRef, where('status', '==', 'pending'));
  const loansSnapshot = await getDocs(pendingLoansQuery);

  let approved = 0;
  let rejected = 0;
  let requiresReview = 0;

  for (const loanDoc of loansSnapshot.docs) {
    const loan = loanDoc.data();
    const loanId = loanDoc.id;
    const riskScore = loan.riskScore || 50; // Default to medium if not set

    const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
    let newStatus: string | null = null;

    // Auto-approve very low risk (score < 25)
    if (riskScore < 25) {
      newStatus = 'approved';
      approved++;
    }
    // Auto-reject very high risk (score >= 75)
    else if (riskScore >= 75) {
      newStatus = 'rejected';
      rejected++;
    } else {
      requiresReview++;
      continue; // Requires manual review
    }

    if (newStatus) {
      await updateDoc(loanRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        autoProcessedAt: serverTimestamp(),
        autoProcessedReason: riskScore < 25 ? 'auto_approved_low_risk' : 'auto_rejected_high_risk',
      });

      // Create audit log
      createAuditLog(agencyId, {
        actorId: 'system',
        action: `loan_${newStatus}`,
        targetCollection: 'loans',
        targetId: loanId,
        metadata: {
          autoProcessed: true,
          riskScore,
          reason: riskScore < 25 ? 'Auto-approved: Very low risk profile' : 'Auto-rejected: Very high risk profile',
        },
      }).catch(() => {});
    }
  }

  return { approved, rejected, requiresReview };
}

