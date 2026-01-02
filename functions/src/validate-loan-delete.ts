/**
 * Cloud Function to validate loan deletion
 * Checks if loan can be deleted based on status and repayments
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const validateLoanDelete = functions.https.onCall(
  async (data: { agencyId: string; loanId: string }, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to delete loans'
      );
    }

    const { agencyId, loanId } = data;

    if (!agencyId || !loanId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'agencyId and loanId are required'
      );
    }

    try {
      const loanRef = admin
        .firestore()
        .collection('agencies')
        .doc(agencyId)
        .collection('loans')
        .doc(loanId);

      const loanDoc = await loanRef.get();

      if (!loanDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Loan not found');
      }

      const loanData = loanDoc.data();
      const loanStatus = loanData?.status || 'draft';

      // Only DRAFT or REJECTED loans can be deleted
      if (loanStatus !== 'draft' && loanStatus !== 'rejected') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Cannot delete loan with status "${loanStatus}". Only DRAFT or REJECTED loans can be deleted.`
        );
      }

      // Check if loan has repayments
      const repaymentsRef = loanRef.collection('repayments');
      const repaymentsSnapshot = await repaymentsRef.get();

      if (!repaymentsSnapshot.empty) {
        const repaymentCount = repaymentsSnapshot.size;
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Cannot delete loan with ${repaymentCount} repayment(s). Please remove repayments first.`
        );
      }

      return {
        success: true,
        canDelete: true,
        status: loanStatus,
        repaymentCount: 0,
      };
    } catch (error: any) {
      // Re-throw HttpsError as-is
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Wrap other errors
      console.error('Error validating loan delete:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to validate loan deletion',
        error.message
      );
    }
  }
);
