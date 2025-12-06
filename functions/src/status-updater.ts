/**
 * Automatic Loan Status Updates
 * pending → active → overdue → defaulted
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const updateLoanStatuses = functions.pubsub
  .schedule('0 * * * *') // Every hour at minute 0
  .timeZone('UTC')
  .onRun(async (context: any) => {
    console.log('Running loan status update job...');

    try {
      const agenciesSnapshot = await db.collection('agencies').get();

      for (const agencyDoc of agenciesSnapshot.docs) {
        const agencyId = agencyDoc.id;

        // Update pending → active (when disbursement date is reached)
        const pendingLoansSnapshot = await db
          .collection(`agencies/${agencyId}/loans`)
          .where('status', '==', 'pending')
          .get();

        const batch1 = db.batch();
        const now = admin.firestore.Timestamp.now();

        for (const loanDoc of pendingLoansSnapshot.docs) {
          const loan = loanDoc.data();
          const disbursementDate = loan.disbursementDate as admin.firestore.Timestamp;

          if (disbursementDate && disbursementDate <= now) {
            const loanRef = db.doc(`agencies/${agencyId}/loans/${loanDoc.id}`);
            batch1.update(loanRef, {
              status: 'active',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        await batch1.commit();

        // Update active → overdue (when repayments are overdue)
        const activeLoansSnapshot = await db
          .collection(`agencies/${agencyId}/loans`)
          .where('status', '==', 'active')
          .get();

        const batch2 = db.batch();

        for (const loanDoc of activeLoansSnapshot.docs) {
          const loanId = loanDoc.id;
          const repaymentsSnapshot = await db
            .collection(`agencies/${agencyId}/loans/${loanId}/repayments`)
            .where('status', '==', 'overdue')
            .get();

          if (!repaymentsSnapshot.empty) {
            const loanRef = db.doc(`agencies/${agencyId}/loans/${loanId}`);
            batch2.update(loanRef, {
              status: 'overdue',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        await batch2.commit();

        // Update overdue → defaulted (after 90 days overdue)
        const overdueLoansSnapshot = await db
          .collection(`agencies/${agencyId}/loans`)
          .where('status', '==', 'overdue')
          .get();

        const batch3 = db.batch();

        for (const loanDoc of overdueLoansSnapshot.docs) {
          const loanId = loanDoc.id;
          const repaymentsSnapshot = await db
            .collection(`agencies/${agencyId}/loans/${loanId}/repayments`)
            .where('status', '==', 'overdue')
            .get();

          let shouldDefault = false;

          for (const repaymentDoc of repaymentsSnapshot.docs) {
            const repayment = repaymentDoc.data();
            const daysOverdue = repayment.daysOverdue || 0;

            if (daysOverdue >= 90) {
              shouldDefault = true;
              break;
            }
          }

          if (shouldDefault) {
            const loanRef = db.doc(`agencies/${agencyId}/loans/${loanId}`);
            batch3.update(loanRef, {
              status: 'defaulted',
              defaultedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        await batch3.commit();
      }

      console.log('Loan status update job completed');
      return null;
    } catch (error) {
      console.error('Error updating loan statuses:', error);
      throw error;
    }
  });

