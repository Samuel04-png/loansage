import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Enforce internal enterprise plan for agencies created by @byteandberry.com users.
 * On agency create, if creator's email is internal, set agency plan to 'enterprise'
 * and write billing/tier plan so scheduled automation is enabled.
 */
export const onAgencyCreate = functions.firestore
  .document('agencies/{agencyId}')
  .onCreate(async (snap, context) => {
    const db = admin.firestore();
    const agencyId = context.params.agencyId;
    const data = snap.data() || {};

    const createdBy: string | undefined = data.createdBy;
    if (!createdBy) {
      return null;
    }

    // Read creator's user doc to get email
    try {
      const userRef = db.doc(`users/${createdBy}`);
      const userSnap = await userRef.get();
      const email = (userSnap.data()?.email as string | undefined)?.toLowerCase() || '';

      const isInternal = email.endsWith('@byteandberry.com');
      if (!isInternal) {
        return null;
      }

      // Set enterprise plan on agency doc (idempotent)
      await snap.ref.set(
        {
          plan: 'enterprise',
          subscriptionStatus: 'active',
          planType: 'paid',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Write billing/tier doc for Functions quota/automation checks
      const tierRef = db.doc(`agencies/${agencyId}/billing/tier`);
      await tierRef.set(
        {
          plan: 'enterprise',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('onAgencyCreate internal enterprise assignment failed:', err);
    }

    return null;
  });


