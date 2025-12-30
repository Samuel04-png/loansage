/**
 * Migration Script for Legacy Starter Plan Users
 * 
 * This script handles users who were on the $0 Starter plan before the pricing update.
 * 
 * Options:
 * 1. Start 14-day trial countdown from today (graceful migration)
 * 2. Immediately require upgrade (strict enforcement)
 * 
 * Run this script once after deploying the pricing update.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Migrate legacy starter plan users to new 14-day trial system
 * 
 * This function:
 * 1. Finds all agencies with plan='starter' and no trialEndDate
 * 2. Sets trialStartDate = now, trialEndDate = now + 14 days
 * 3. Updates subscriptionStatus to 'trialing'
 * 
 * OR (if strict mode):
 * 1. Sets subscriptionStatus to 'expired'
 * 2. Requires immediate upgrade
 */
export const migrateLegacyStarterUsers = functions.https.onCall(async (data, context) => {
  // Only allow admins to run this migration
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  // Check if user is admin (you may want to add your own admin check)
  const userDoc = await admin.firestore().doc(`users/${context.auth.uid}`).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can run migrations');
  }

  const { mode = 'graceful' } = data as { mode?: 'graceful' | 'strict' };

  try {
    const agenciesRef = admin.firestore().collection('agencies');
    
    // Find all starter plan agencies without trial end date
    const starterAgencies = await agenciesRef
      .where('plan', '==', 'starter')
      .get();

    const now = admin.firestore.Timestamp.now();
    const trialEnd = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + (14 * 24 * 60 * 60 * 1000) // 14 days
    );

    const batch = admin.firestore().batch();
    let count = 0;

    for (const doc of starterAgencies.docs) {
      const agencyData = doc.data();
      
      // Skip if already has trial end date (already migrated)
      if (agencyData.trialEndDate) {
        continue;
      }

      // Skip if has active subscription (already paid)
      if (agencyData.subscriptionStatus === 'active' && agencyData.stripeSubscriptionId) {
        continue;
      }

      if (mode === 'graceful') {
        // Graceful migration: Start 14-day trial from today
        batch.update(doc.ref, {
          plan: 'starter',
          planType: 'free',
          subscriptionStatus: 'trialing',
          trialStartDate: now,
          trialEndDate: trialEnd,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Strict mode: Immediately require upgrade
        batch.update(doc.ref, {
          subscriptionStatus: 'expired',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      count++;

      // Firestore batch limit is 500, so commit in batches
      if (count % 500 === 0) {
        await batch.commit();
      }
    }

    // Commit remaining updates
    if (count % 500 !== 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Migrated ${count} legacy starter plan users (mode: ${mode})`,
      count,
    };
  } catch (error: any) {
    console.error('Migration error:', error);
    throw new functions.https.HttpsError('internal', `Migration failed: ${error.message}`);
  }
});

/**
 * Alternative: Cloud Function that runs on schedule to check for expired trials
 * This can be called daily to update trial statuses
 * 
 * NOTE: Commented out to avoid deployment issues. Uncomment and deploy separately if needed.
 */
/*
export const checkExpiredTrials = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    try {
      const agenciesRef = admin.firestore().collection('agencies');
      const now = admin.firestore.Timestamp.now();

      // Find all agencies with expired trials
      const expiredTrials = await agenciesRef
        .where('plan', '==', 'starter')
        .where('subscriptionStatus', '==', 'trialing')
        .get();

      const batch = admin.firestore().batch();
      let count = 0;

      for (const doc of expiredTrials.docs) {
        const agencyData = doc.data();
        const trialEnd = agencyData.trialEndDate?.toMillis?.() || agencyData.trialEndDate;

        if (trialEnd && trialEnd < now.toMillis()) {
          // Trial expired - check if has payment method
          if (!agencyData.stripeSubscriptionId || agencyData.subscriptionStatus !== 'active') {
            // No payment method - expire access
            batch.update(doc.ref, {
              subscriptionStatus: 'expired',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            count++;
          }
        }

        // Firestore batch limit
        if (count % 500 === 0) {
          await batch.commit();
        }
      }

      // Commit remaining
      if (count % 500 !== 0) {
        await batch.commit();
      }

      console.log(`Checked ${expiredTrials.size} trialing agencies, expired ${count}`);
      return null;
    } catch (error: any) {
      console.error('Error checking expired trials:', error);
      return null;
    }
  });
*/

