/**
 * Scheduled Job to Check Overdue Loans
 * Runs daily to identify and update overdue repayments
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const checkOverdueLoans = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight UTC
  .timeZone('UTC')
  .onRun(async (context: any) => {
    console.log('Running overdue loans check...');

    try {
      const agenciesSnapshot = await db.collection('agencies').get();
      let totalOverdue = 0;

      for (const agencyDoc of agenciesSnapshot.docs) {
        const agencyId = agencyDoc.id;

        // Get all active loans
        const loansSnapshot = await db
          .collection(`agencies/${agencyId}/loans`)
          .where('status', 'in', ['active', 'approved'])
          .get();

        for (const loanDoc of loansSnapshot.docs) {
          const loanId = loanDoc.id;
          const repaymentsSnapshot = await db
            .collection(`agencies/${agencyId}/loans/${loanId}/repayments`)
            .where('status', '==', 'pending')
            .get();

          const now = admin.firestore.Timestamp.now();
          const batch = db.batch();

          for (const repaymentDoc of repaymentsSnapshot.docs) {
            const repayment = repaymentDoc.data();
            const dueDate = repayment.dueDate as admin.firestore.Timestamp;

            if (dueDate && dueDate < now) {
              const daysOverdue = Math.floor(
                (now.toMillis() - dueDate.toMillis()) / (1000 * 60 * 60 * 24)
              );
              const overdueAmount = (repayment.amountDue || 0) - (repayment.amountPaid || 0);

              // Get late fee config from agency settings
              const agencyData = agencyDoc.data();
              const lateFeeConfig = agencyData.settings?.loanSettings || {
                gracePeriodDays: 7,
                lateFeeRate: 2.5,
                maxLateFeeRate: 25,
              };

              // Calculate late fee
              const gracePeriodDays = lateFeeConfig.gracePeriodDays || 7;
              let lateFee = 0;

              if (daysOverdue > gracePeriodDays) {
                const daysCharged = daysOverdue - gracePeriodDays;
                const feeRate = Math.min(
                  (lateFeeConfig.lateFeeRate || 2.5) / 100,
                  (lateFeeConfig.maxLateFeeRate || 25) / 100
                );
                lateFee = overdueAmount * feeRate * (daysCharged / 30); // Monthly rate
              }

              // Update repayment
              const repaymentRef = db.doc(
                `agencies/${agencyId}/loans/${loanId}/repayments/${repaymentDoc.id}`
              );
              batch.update(repaymentRef, {
                status: 'overdue',
                lateFee: lateFee,
                daysOverdue: daysOverdue,
                lastChecked: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              totalOverdue++;
            }
          }

          if (totalOverdue > 0) {
            await batch.commit();
          }
        }
      }

      console.log(`Found and updated ${totalOverdue} overdue repayments`);
      return null;
    } catch (error) {
      console.error('Error checking overdue loans:', error);
      throw error;
    }
  });

