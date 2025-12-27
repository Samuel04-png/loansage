/**
 * Advanced Automation Cloud Functions
 * Scheduled jobs and triggers for loan management automation
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getScheduledDocsPerRunCap, isAutomationEnabled } from './usage-ledger';

/**
 * Daily interest accrual calculation
 * Runs every day at midnight UTC
 */
export const dailyInterestAccrual = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    
    // Get all active loans (guard per-agency during processing)
    const activeLoans = await db.collection('loans')
      .where('status', 'in', ['active', 'disbursed'])
      .get();
    
    const batch = db.batch();
    let processed = 0;
    const perAgencyProcessed: Record<string, number> = {};
    const perAgencyCapCache: Record<string, number> = {};
    const automationEnabledCache: Record<string, boolean> = {};
    
    for (const loanDoc of activeLoans.docs) {
      const loan = loanDoc.data();
      const loanId = loanDoc.id;
      const agencyId = loan.agencyId;

      if (!agencyId) continue;

      // Check automation enabled for this agency (cached)
      if (automationEnabledCache[agencyId] === undefined) {
        automationEnabledCache[agencyId] = await isAutomationEnabled(agencyId);
      }
      if (!automationEnabledCache[agencyId]) {
        continue; // Skip Starter or disabled automation
      }

      // Enforce per-run cap per agency (cached)
      if (perAgencyCapCache[agencyId] === undefined) {
        perAgencyCapCache[agencyId] = await getScheduledDocsPerRunCap(agencyId);
      }
      const cap = perAgencyCapCache[agencyId];
      if (cap > 0) {
        perAgencyProcessed[agencyId] = perAgencyProcessed[agencyId] || 0;
        if (perAgencyProcessed[agencyId] >= cap) {
          continue;
        }
      }
      
      // Calculate daily interest
      const principal = loan.principalAmount || loan.loanAmount || 0;
      const annualRate = loan.interestRate || 0;
      const dailyRate = annualRate / 365;
      const dailyInterest = principal * (dailyRate / 100);
      
      // Update loan with accrued interest
      const currentAccrued = loan.accruedInterest || 0;
      batch.update(loanDoc.ref, {
        accruedInterest: currentAccrued + dailyInterest,
        lastInterestAccrual: now,
        updatedAt: now,
      });
      
      // Create interest accrual transaction record
      const transactionRef = db.collection('loanTransactions').doc();
      batch.set(transactionRef, {
        loanId,
        agencyId,
        type: 'interest_accrual',
        amount: dailyInterest,
        date: now,
        description: `Daily interest accrual (${dailyRate.toFixed(4)}%)`,
        createdAt: now,
      });
      
      processed++;
      if (cap > 0) {
        perAgencyProcessed[agencyId] = (perAgencyProcessed[agencyId] || 0) + 1;
      }
      
      // Commit batch every 500 operations (Firestore limit)
      if (processed % 500 === 0) {
        await batch.commit();
      }
    }
    
    // Commit remaining operations
    if (processed % 500 !== 0) {
      await batch.commit();
    }
    
    console.log(`Processed interest accrual for ${processed} loans`);
    return null;
  });

/**
 * Payment reminder notifications
 * Runs daily at 9 AM UTC
 */
export const paymentReminders = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const threeDaysFromNow = new Date(now.toDate());
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    // Get repayments due in next 3 days
    const dueRepayments = await db.collection('repayments')
      .where('status', '==', 'pending')
      .where('dueDate', '<=', admin.firestore.Timestamp.fromDate(threeDaysFromNow))
      .where('dueDate', '>=', now)
      .get();
    
    const perAgencyProcessed: Record<string, number> = {};
    const perAgencyCapCache: Record<string, number> = {};
    const automationEnabledCache: Record<string, boolean> = {};

    for (const repaymentDoc of dueRepayments.docs) {
      const repayment = repaymentDoc.data();
      
      // Get loan details
      const loanDoc = await db.collection('loans').doc(repayment.loanId).get();
      if (!loanDoc.exists) continue;
      
      const loan = loanDoc.data();
      const agencyId = loan?.agencyId;
      if (!agencyId) continue;

      // Check automation enabled
      if (automationEnabledCache[agencyId] === undefined) {
        automationEnabledCache[agencyId] = await isAutomationEnabled(agencyId);
      }
      if (!automationEnabledCache[agencyId]) {
        continue;
      }

      // Cap per agency
      if (perAgencyCapCache[agencyId] === undefined) {
        perAgencyCapCache[agencyId] = await getScheduledDocsPerRunCap(agencyId);
      }
      const cap = perAgencyCapCache[agencyId];
      if (cap > 0) {
        perAgencyProcessed[agencyId] = perAgencyProcessed[agencyId] || 0;
        if (perAgencyProcessed[agencyId] >= cap) {
          continue;
        }
      }
      
      // Get customer details
      const customerDoc = await db.collection('customers').doc(loan?.customerId).get();
      if (!customerDoc.exists) continue;
      
      const customer = customerDoc.data();
      
      // Create notification
      await db.collection('notifications').add({
        agencyId,
        userId: customer?.userId,
        type: 'payment_reminder',
        title: 'Payment Due Soon',
        message: `Your payment of ${repayment.amountDue} is due on ${repayment.dueDate.toDate().toLocaleDateString()}`,
        loanId: repayment.loanId,
        repaymentId: repaymentDoc.id,
        read: false,
        createdAt: now,
      });
      
      // TODO: Send SMS/Email via integration

      if (cap > 0) {
        perAgencyProcessed[agencyId] = (perAgencyProcessed[agencyId] || 0) + 1;
      }
    }
    
    console.log(`Sent payment reminders for ${dueRepayments.size} repayments`);
    return null;
  });

/**
 * Overdue loan checker and escalation
 * Runs daily at 10 AM UTC
 */
export const overdueLoanChecker = functions.pubsub
  .schedule('0 10 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    
    // Get overdue repayments
    const overdueRepayments = await db.collection('repayments')
      .where('status', '==', 'overdue')
      .where('dueDate', '<', now)
      .get();
    
    const perAgencyProcessed: Record<string, number> = {};
    const perAgencyCapCache: Record<string, number> = {};
    const automationEnabledCache: Record<string, boolean> = {};

    for (const repaymentDoc of overdueRepayments.docs) {
      const repayment = repaymentDoc.data();
      
      // Get loan
      const loanDoc = await db.collection('loans').doc(repayment.loanId).get();
      if (!loanDoc.exists) continue;
      
      const loan = loanDoc.data();
      const agencyId = loan?.agencyId;
      if (!agencyId) continue;

      // Check automation enabled
      if (automationEnabledCache[agencyId] === undefined) {
        automationEnabledCache[agencyId] = await isAutomationEnabled(agencyId);
      }
      if (!automationEnabledCache[agencyId]) {
        continue;
      }

      // Cap per agency
      if (perAgencyCapCache[agencyId] === undefined) {
        perAgencyCapCache[agencyId] = await getScheduledDocsPerRunCap(agencyId);
      }
      const cap = perAgencyCapCache[agencyId];
      if (cap > 0) {
        perAgencyProcessed[agencyId] = perAgencyProcessed[agencyId] || 0;
        if (perAgencyProcessed[agencyId] >= cap) {
          continue;
        }
      }
      
      // Calculate days overdue
      const daysOverdue = Math.floor(
        (now.toMillis() - repayment.dueDate.toMillis()) / (1000 * 60 * 60 * 24)
      );
      
      // Escalate based on days overdue
      if (daysOverdue >= 90) {
        // Mark loan as defaulted
        await loanDoc.ref.update({
          status: 'defaulted',
          defaultedDate: now,
          updatedAt: now,
        });
        
        // Create task for collections team
        await db.collection('tasks').add({
          agencyId,
          type: 'collections',
          priority: 'high',
          title: `Loan Defaulted: ${loan?.loanNumber}`,
          description: `Loan has been overdue for ${daysOverdue} days`,
          loanId: repayment.loanId,
          assignedTo: null,
          status: 'open',
          dueDate: now,
          createdAt: now,
        });
      } else if (daysOverdue >= 30) {
        // Create high-priority collection task
        await db.collection('tasks').add({
          agencyId,
          type: 'collections',
          priority: 'high',
          title: `Overdue Payment: ${loan?.loanNumber}`,
          description: `Payment overdue for ${daysOverdue} days`,
          loanId: repayment.loanId,
          assignedTo: null,
          status: 'open',
          dueDate: now,
          createdAt: now,
        });
      }

      if (cap > 0) {
        perAgencyProcessed[agencyId] = (perAgencyProcessed[agencyId] || 0) + 1;
      }
    }
    
    console.log(`Processed ${overdueRepayments.size} overdue repayments`);
    return null;
  });

/**
 * Auto-generate repayment schedules when loan is approved
 */
export const generateRepaymentSchedule = functions.firestore
  .document('loans/{loanId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const loanId = context.params.loanId;
    
    // Only generate schedule when loan status changes to 'approved' or 'disbursed'
    if (
      before.status !== 'approved' &&
      (after.status === 'approved' || after.status === 'disbursed')
    ) {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();
      
      // Calculate repayment schedule
      const principal = after.loanAmount || 0;
      const interestRate = after.interestRate || 0;
      const termMonths = after.termMonths || 12;
      const monthlyRate = interestRate / 12 / 100;
      
      // Calculate monthly payment using amortization formula
      const monthlyPayment = principal * 
        (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);
      
      const schedule: any[] = [];
      let remainingPrincipal = principal;
      const startDate = new Date(after.disbursementDate?.toDate() || now.toDate());
      
      for (let i = 0; i < termMonths; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        
        const interest = remainingPrincipal * monthlyRate;
        const principalPayment = monthlyPayment - interest;
        remainingPrincipal -= principalPayment;
        
        schedule.push({
          loanId,
          agencyId: after.agencyId,
          installmentNumber: i + 1,
          dueDate: admin.firestore.Timestamp.fromDate(dueDate),
          amountDue: monthlyPayment,
          principalAmount: principalPayment,
          interestAmount: interest,
          status: 'pending',
          createdAt: now,
        });
      }
      
      // Batch write repayment schedule
      const batch = db.batch();
      schedule.forEach((repayment) => {
        const repaymentRef = db.collection('repayments').doc();
        batch.set(repaymentRef, repayment);
      });
      
      await batch.commit();
      
      console.log(`Generated repayment schedule for loan ${loanId}: ${termMonths} installments`);
    }
    
    return null;
  });

/**
 * Daily backup to Realtime Database
 * Creates a snapshot of critical data
 */
export const dailyBackup = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const firestore = admin.firestore();
    const database = admin.database();
    const now = admin.database.ServerValue.TIMESTAMP;
    
    // Get all agencies
    const agencies = await firestore.collection('agencies').get();
    
    for (const agencyDoc of agencies.docs) {
      const agencyId = agencyDoc.id;
      
      // Backup loan summaries
      const loans = await firestore.collection('loans')
        .where('agencyId', '==', agencyId)
        .get();
      
      const loanSummaries: any = {};
      loans.forEach((loanDoc) => {
        const loan = loanDoc.data();
        loanSummaries[loanDoc.id] = {
          loanNumber: loan.loanNumber,
          status: loan.status,
          loanAmount: loan.loanAmount,
          outstandingBalance: loan.outstandingBalance,
          lastUpdated: loan.updatedAt,
        };
      });
      
      // Store backup in Realtime Database
      await database.ref(`backups/${agencyId}/loans/${Date.now()}`).set({
        data: loanSummaries,
        timestamp: now,
        count: loans.size,
      });
      
      console.log(`Backed up ${loans.size} loans for agency ${agencyId}`);
    }
    
    return null;
  });

