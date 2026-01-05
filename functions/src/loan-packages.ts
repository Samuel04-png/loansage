/**
 * Loan Packages Cloud Functions
 * Enterprise feature for standardized loan products
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getAgencyPlan } from './usage-ledger';

const db = admin.firestore();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LoanPackage {
  id?: string;
  name: string;
  description?: string;
  loanType: string;
  interestRate: number;
  interestRateType: 'fixed' | 'reducing';
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  defaultTermMonths: number;
  processingFee?: number;
  processingFeeType?: 'fixed' | 'percentage';
  insuranceFee?: number;
  insuranceFeeType?: 'fixed' | 'percentage';
  collateralRequired: boolean;
  guarantorRequired: boolean;
  eligibilityCriteria?: string[];
  isActive: boolean;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  createdBy?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE GUARD
// ═══════════════════════════════════════════════════════════════════════════════

async function requireEnterprisePlan(agencyId: string): Promise<void> {
  const plan = await getAgencyPlan(agencyId);
  if (plan !== 'enterprise') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Loan Packages feature is only available on the Enterprise plan.'
    );
  }
}

async function validateAgencyMembership(
  agencyId: string,
  userId: string
): Promise<boolean> {
  const userRef = db.doc(`users/${userId}`);
  const userSnap = await userRef.get();
  
  if (!userSnap.exists) return false;
  
  const userData = userSnap.data();
  return userData?.agencyId === agencyId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new loan package (Enterprise only)
 */
export const createLoanPackage = functions.https.onCall(
  async (
    data: { agencyId: string; package: Omit<LoanPackage, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> },
    context
  ): Promise<{ success: boolean; packageId: string }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, package: packageData } = data;
    const userId = context.auth.uid;

    // Validate enterprise plan
    await requireEnterprisePlan(agencyId);

    // Validate agency membership
    const isMember = await validateAgencyMembership(agencyId, userId);
    if (!isMember) {
      throw new functions.https.HttpsError('permission-denied', 'User is not a member of this agency');
    }

    // Validate required fields
    if (!packageData.name || !packageData.loanType) {
      throw new functions.https.HttpsError('invalid-argument', 'Name and loan type are required');
    }

    if (packageData.minAmount > packageData.maxAmount) {
      throw new functions.https.HttpsError('invalid-argument', 'Min amount cannot exceed max amount');
    }

    if (packageData.minTermMonths > packageData.maxTermMonths) {
      throw new functions.https.HttpsError('invalid-argument', 'Min term cannot exceed max term');
    }

    try {
      const packageRef = db.collection(`agencies/${agencyId}/loan_packages`).doc();
      
      const newPackage: LoanPackage = {
        ...packageData,
        id: packageRef.id,
        isActive: packageData.isActive ?? true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdBy: userId,
      };

      await packageRef.set(newPackage);

      console.log(`Loan package created: ${packageRef.id} for agency ${agencyId}`);

      return { success: true, packageId: packageRef.id };
    } catch (error: any) {
      console.error('Error creating loan package:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Update a loan package (Enterprise only)
 */
export const updateLoanPackage = functions.https.onCall(
  async (
    data: { agencyId: string; packageId: string; updates: Partial<LoanPackage> },
    context
  ): Promise<{ success: boolean }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, packageId, updates } = data;
    const userId = context.auth.uid;

    await requireEnterprisePlan(agencyId);

    const isMember = await validateAgencyMembership(agencyId, userId);
    if (!isMember) {
      throw new functions.https.HttpsError('permission-denied', 'User is not a member of this agency');
    }

    try {
      const packageRef = db.doc(`agencies/${agencyId}/loan_packages/${packageId}`);
      const packageSnap = await packageRef.get();

      if (!packageSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Loan package not found');
      }

      // Remove immutable fields from updates
      const safeUpdates = { ...updates };
      delete safeUpdates.id;
      delete safeUpdates.createdAt;
      delete safeUpdates.createdBy;

      await packageRef.update({
        ...safeUpdates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Loan package updated: ${packageId} for agency ${agencyId}`);

      return { success: true };
    } catch (error: any) {
      console.error('Error updating loan package:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Delete a loan package (Enterprise only)
 */
export const deleteLoanPackage = functions.https.onCall(
  async (
    data: { agencyId: string; packageId: string },
    context
  ): Promise<{ success: boolean }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, packageId } = data;
    const userId = context.auth.uid;

    await requireEnterprisePlan(agencyId);

    const isMember = await validateAgencyMembership(agencyId, userId);
    if (!isMember) {
      throw new functions.https.HttpsError('permission-denied', 'User is not a member of this agency');
    }

    try {
      const packageRef = db.doc(`agencies/${agencyId}/loan_packages/${packageId}`);
      const packageSnap = await packageRef.get();

      if (!packageSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Loan package not found');
      }

      // Soft delete by marking inactive
      await packageRef.update({
        isActive: false,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        deletedBy: userId,
      });

      console.log(`Loan package deleted: ${packageId} for agency ${agencyId}`);

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting loan package:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Get all loan packages for an agency
 * Available to all plans (read-only for non-Enterprise)
 */
export const getLoanPackages = functions.https.onCall(
  async (
    data: { agencyId: string; includeInactive?: boolean },
    context
  ): Promise<{ packages: LoanPackage[] }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, includeInactive = false } = data;
    const userId = context.auth.uid;

    const isMember = await validateAgencyMembership(agencyId, userId);
    if (!isMember) {
      throw new functions.https.HttpsError('permission-denied', 'User is not a member of this agency');
    }

    try {
      let query: FirebaseFirestore.Query = db.collection(`agencies/${agencyId}/loan_packages`);

      if (!includeInactive) {
        query = query.where('isActive', '==', true);
      }

      const snapshot = await query.orderBy('name').get();

      const packages: LoanPackage[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LoanPackage[];

      return { packages };
    } catch (error: any) {
      console.error('Error fetching loan packages:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION TEMPLATES MANAGEMENT (Enterprise only)
// ═══════════════════════════════════════════════════════════════════════════════

interface NotificationTemplates {
  customer_welcome?: { subject: string; body: string };
  loan_approved?: { subject: string; body: string };
  loan_disbursed?: { subject: string; body: string };
  loan_settled?: { subject: string; body: string };
  loan_rejected?: { subject: string; body: string };
  payment_reminder?: { subject: string; body: string };
}

/**
 * Save custom notification templates (Enterprise only)
 */
export const saveNotificationTemplates = functions.https.onCall(
  async (
    data: { agencyId: string; templates: NotificationTemplates },
    context
  ): Promise<{ success: boolean }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, templates } = data;
    const userId = context.auth.uid;

    await requireEnterprisePlan(agencyId);

    const isMember = await validateAgencyMembership(agencyId, userId);
    if (!isMember) {
      throw new functions.https.HttpsError('permission-denied', 'User is not a member of this agency');
    }

    try {
      const templateRef = db.doc(`agencies/${agencyId}/notification_config/templates`);
      
      await templateRef.set(
        {
          ...templates,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: userId,
        },
        { merge: true }
      );

      console.log(`Notification templates updated for agency ${agencyId}`);

      return { success: true };
    } catch (error: any) {
      console.error('Error saving notification templates:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Get custom notification templates
 */
export const getNotificationTemplates = functions.https.onCall(
  async (
    data: { agencyId: string },
    context
  ): Promise<{ templates: NotificationTemplates | null; isEnterprise: boolean }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId } = data;
    const userId = context.auth.uid;

    const isMember = await validateAgencyMembership(agencyId, userId);
    if (!isMember) {
      throw new functions.https.HttpsError('permission-denied', 'User is not a member of this agency');
    }

    try {
      const plan = await getAgencyPlan(agencyId);
      const isEnterprise = plan === 'enterprise';

      if (!isEnterprise) {
        return { templates: null, isEnterprise: false };
      }

      const templateRef = db.doc(`agencies/${agencyId}/notification_config/templates`);
      const templateSnap = await templateRef.get();

      if (!templateSnap.exists) {
        return { templates: null, isEnterprise: true };
      }

      return {
        templates: templateSnap.data() as NotificationTemplates,
        isEnterprise: true,
      };
    } catch (error: any) {
      console.error('Error fetching notification templates:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);
