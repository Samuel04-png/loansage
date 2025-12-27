/**
 * Migration function to update existing agencies to new plan structure
 * Maps legacy planType ('free'|'paid') to new plan ('starter'|'professional'|'enterprise')
 * and sets up plan limits and features
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { PLAN_CONFIG, type PlanCode } from './plan-config';

/**
 * Migrate all agencies to new plan structure
 * This is a one-time migration function
 */
export const migrateAgenciesToNewPlans = functions.https.onCall(async (data, context) => {
  // Only allow admins (you can customize this check)
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Optional: Add admin check here if you have an admin list
  // const isAdmin = await checkIfAdmin(context.auth.uid);
  // if (!isAdmin) {
  //   throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  // }

  try {
    const agenciesSnapshot = await admin.firestore()
      .collection('agencies')
      .get();

    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const batch = admin.firestore().batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const doc of agenciesSnapshot.docs) {
      const agencyData = doc.data();
      
      // Skip if already migrated (has 'plan' field with valid value)
      if (agencyData.plan === 'starter' || agencyData.plan === 'professional' || agencyData.plan === 'enterprise') {
        skipped++;
        continue;
      }

      // Determine plan from legacy planType
      let newPlan: PlanCode = 'starter';
      if (agencyData.planType === 'paid') {
        // Check if it's enterprise (you might have other indicators)
        // For now, default to professional
        newPlan = 'professional';
      } else {
        newPlan = 'starter';
      }

      const planConfig = PLAN_CONFIG[newPlan];

      // Prepare update
      const updateData: any = {
        plan: newPlan,
        loanTypeLimit: planConfig.limits.loanTypeLimit,
        maxCustomers: planConfig.quotas.maxCustomers,
        maxActiveLoans: planConfig.quotas.maxActiveLoans,
        features: planConfig.features,
        // Keep legacy fields for backward compatibility during transition
        // planType: agencyData.planType || 'free', // Keep for compatibility
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      batch.update(doc.ref, updateData);
      batchCount++;
      migrated++;

      // Commit batch if it reaches the limit
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }
    }

    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      migrated,
      skipped,
      total: agenciesSnapshot.size,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error('Migration error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Migration failed');
  }
});

/**
 * Migrate a single agency (useful for testing or manual migration)
 */
export const migrateSingleAgency = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { agencyId } = data;
  if (!agencyId) {
    throw new functions.https.HttpsError('invalid-argument', 'agencyId is required');
  }

  try {
    const agencyRef = admin.firestore().doc(`agencies/${agencyId}`);
    const agencyDoc = await agencyRef.get();

    if (!agencyDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Agency not found');
    }

    const agencyData = agencyDoc.data()!;

    // Skip if already migrated
    if (agencyData.plan === 'starter' || agencyData.plan === 'professional' || agencyData.plan === 'enterprise') {
      return {
        success: true,
        message: 'Agency already migrated',
        plan: agencyData.plan,
      };
    }

    // Determine plan from legacy planType
    let newPlan: PlanCode = 'starter';
    if (agencyData.planType === 'paid') {
      newPlan = 'professional';
    }

    const planConfig = PLAN_CONFIG[newPlan];

    await agencyRef.update({
      plan: newPlan,
      loanTypeLimit: planConfig.limits.loanTypeLimit,
      maxCustomers: planConfig.quotas.maxCustomers,
      maxActiveLoans: planConfig.quotas.maxActiveLoans,
      features: planConfig.features,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      message: 'Agency migrated successfully',
      plan: newPlan,
    };
  } catch (error: any) {
    console.error('Migration error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Migration failed');
  }
});

