/**
 * Cloud Function to validate customer deletion
 * Checks if customer has active loans before allowing deletion
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const validateCustomerDelete = functions.https.onCall(
  async (data: { agencyId: string; customerId: string }, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to delete customers'
      );
    }

    const { agencyId, customerId } = data;

    if (!agencyId || !customerId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'agencyId and customerId are required'
      );
    }

    try {
      // Check if customer has active loans
      const loansRef = admin
        .firestore()
        .collection('agencies')
        .doc(agencyId)
        .collection('loans');

      const activeLoansQuery = loansRef
        .where('customerId', '==', customerId)
        .where('status', 'in', ['draft', 'pending', 'approved', 'active', 'disbursed']);

      const activeLoansSnapshot = await activeLoansQuery.get();

      if (!activeLoansSnapshot.empty) {
        const activeLoanCount = activeLoansSnapshot.size;
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Cannot delete customer with ${activeLoanCount} active loan(s). Please close or cancel all loans first.`
        );
      }

      // Check for any loans with this customer (including closed/rejected)
      const allLoansQuery = loansRef.where('customerId', '==', customerId);
      const allLoansSnapshot = await allLoansQuery.get();

      return {
        success: true,
        canDelete: true,
        activeLoanCount: 0,
        totalLoanCount: allLoansSnapshot.size,
      };
    } catch (error: any) {
      // Re-throw HttpsError as-is
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Wrap other errors
      console.error('Error validating customer delete:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to validate customer deletion',
        error.message
      );
    }
  }
);
