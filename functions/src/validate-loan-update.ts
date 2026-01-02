/**
 * Cloud Function to validate loan updates
 * Checks if loan can be updated based on status and user role
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const validateLoanUpdate = functions.https.onCall(
  async (
    data: {
      agencyId: string;
      loanId: string;
      updateData: any;
      userRole: string;
    },
    context
  ) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to update loans'
      );
    }

    const { agencyId, loanId, updateData, userRole } = data;

    if (!agencyId || !loanId || !updateData) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'agencyId, loanId, and updateData are required'
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

      // Check permissions based on role and status
      const isAdmin = userRole === 'admin';
      const isManager = userRole === 'manager' || userRole === 'accountant';
      const isLoanOfficer = userRole === 'loan_officer' || userRole === 'employee';

      // Admins can update any loan
      if (isAdmin) {
        return {
          success: true,
          canUpdate: true,
          reason: 'Admin has full access',
        };
      }

      // Managers and accountants can update pending/approved loans
      if (isManager && ['pending', 'approved', 'disbursed'].includes(loanStatus)) {
        return {
          success: true,
          canUpdate: true,
          reason: 'Manager/Accountant can update active loans',
        };
      }

      // Loan officers can only edit DRAFT loans
      if (isLoanOfficer) {
        if (loanStatus === 'draft' || loanStatus === null || loanStatus === '') {
          return {
            success: true,
            canUpdate: true,
            reason: 'Loan officer can edit DRAFT loans',
          };
        } else {
          throw new functions.https.HttpsError(
            'permission-denied',
            `Loan officers can only edit DRAFT loans. Current status: ${loanStatus}`
          );
        }
      }

      // Default: deny update
      throw new functions.https.HttpsError(
        'permission-denied',
        `User role "${userRole}" cannot update loans with status "${loanStatus}"`
      );
    } catch (error: any) {
      // Re-throw HttpsError as-is
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Wrap other errors
      console.error('Error validating loan update:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to validate loan update',
        error.message
      );
    }
  }
);
