/**
 * Automatic Interest Accrual Cloud Function
 * Calculates and updates interest daily/weekly/monthly
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Removed unused interface

export const interestAccrual = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight UTC
  .timeZone('UTC')
  .onRun(async (context: any) => {
    console.log('Running interest accrual job...');

    try {
      // Get all agencies
      const agenciesSnapshot = await db.collection('agencies').get();

      for (const agencyDoc of agenciesSnapshot.docs) {
        const agencyId = agencyDoc.id;
        // Agency data available if needed: agencyDoc.data()
        // Accrual config available in agencyData.settings?.interestAccrual if needed

        // Get all active loans for this agency
        const loansSnapshot = await db
          .collection(`agencies/${agencyId}/loans`)
          .where('status', 'in', ['active', 'approved'])
          .get();

        const batch = db.batch();
        let updateCount = 0;

        for (const loanDoc of loansSnapshot.docs) {
          const loan = loanDoc.data();
          const loanId = loanDoc.id;

          // Skip if loan is fully paid
          const repaymentsSnapshot = await db
            .collection(`agencies/${agencyId}/loans/${loanId}/repayments`)
            .get();

          const totalPaid = repaymentsSnapshot.docs.reduce(
            (sum: number, doc: any) => sum + (doc.data().amountPaid || 0),
            0
          );

          const principal = loan.amount || 0;
          const interestRate = loan.interestRate || 0;
          const durationMonths = loan.durationMonths || 12;

          // Calculate total payable
          const totalInterest = principal * (interestRate / 100) * (durationMonths / 12);
          const totalPayable = principal + totalInterest;

          if (totalPaid >= totalPayable) {
            continue; // Loan is fully paid
          }

          // Calculate daily interest
          const dailyInterestRate = interestRate / 100 / 365;
          const dailyInterest = principal * dailyInterestRate;

          // Update loan with accrued interest
          const loanRef = db.doc(`agencies/${agencyId}/loans/${loanId}`);
          const currentAccruedInterest = loan.accruedInterest || 0;
          const newAccruedInterest = currentAccruedInterest + dailyInterest;

          batch.update(loanRef, {
            accruedInterest: newAccruedInterest,
            lastAccrualDate: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          updateCount++;
        }

        if (updateCount > 0) {
          await batch.commit();
          console.log(`Updated ${updateCount} loans for agency ${agencyId}`);
        }
      }

      console.log('Interest accrual job completed successfully');
      return null;
    } catch (error) {
      console.error('Error in interest accrual job:', error);
      throw error;
    }
  });

