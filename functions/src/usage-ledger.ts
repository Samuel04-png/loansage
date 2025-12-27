/**
 * Usage metering and quota enforcement.
 * Stores per-agency daily counters under: agencies/{agencyId}/usage_daily/{YYYY-MM-DD}
 */
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { formatDateUTC, Plan, TIER_LIMITS } from './tier-config';

const db = admin.firestore();

export type UsageCounterKey =
  | 'aiCalls'
  | 'collateralValuations'
  | 'notificationsSent'
  | 'loanValidations'
  | 'analysisCalcs'
  | 'apiReads'
  | 'apiWrites'
  | 'pdfExports';

export interface AgencyTierDoc {
  plan?: Plan;
}

export async function getAgencyPlan(agencyId: string): Promise<Plan> {
  try {
    const tierRef = db.doc(`agencies/${agencyId}/billing/tier`);
    const snap = await tierRef.get();
    if (snap.exists) {
      const plan = (snap.data() as AgencyTierDoc)?.plan;
      if (plan === 'professional' || plan === 'enterprise' || plan === 'starter') {
        return plan;
      }
    }
  } catch (e) {
    console.warn('Failed to read agency tier; defaulting to starter', e);
  }
  return 'starter';
}

/**
 * Enforce per-day quota for a given counter. Increments atomically if within limit.
 * Throws resource-exhausted when exceeding the limit, or permission-denied if feature disabled.
 */
export async function enforceQuota(
  agencyId: string,
  counter: UsageCounterKey,
  incrementBy: number = 1
): Promise<void> {
  if (!agencyId) {
    throw new functions.https.HttpsError('invalid-argument', 'agencyId is required for quota checks');
  }

  const plan = await getAgencyPlan(agencyId);
  const limits = TIER_LIMITS[plan];
  const perDayLimit = limits.perDay[counter];

  if (!perDayLimit || perDayLimit <= 0) {
    // Feature effectively disabled at this tier
    throw new functions.https.HttpsError('permission-denied', `Feature not available on ${plan} plan`);
  }

  const dateKey = formatDateUTC();
  const usageRef = db.doc(`agencies/${agencyId}/usage_daily/${dateKey}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const currentValue = (snap.exists ? snap.get(counter) : 0) || 0;
    const nextValue = currentValue + incrementBy;

    if (nextValue > perDayLimit) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Daily limit exceeded for ${counter} on plan ${plan} (${currentValue}/${perDayLimit})`
      );
    }

    const update: Record<string, FirebaseFirestore.FieldValue | number> = {};
    if (snap.exists) {
      update[counter] = admin.firestore.FieldValue.increment(incrementBy);
      update['updatedAt'] = admin.firestore.FieldValue.serverTimestamp();
      tx.update(usageRef, update);
    } else {
      tx.set(usageRef, {
        [counter]: incrementBy,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
}

/**
 * Helper for scheduled jobs to read per-run processing caps based on plan.
 */
export async function getScheduledDocsPerRunCap(agencyId: string): Promise<number> {
  const plan = await getAgencyPlan(agencyId);
  return TIER_LIMITS[plan].automation.scheduledDocsPerRun;
}

export async function isAutomationEnabled(agencyId: string): Promise<boolean> {
  const plan = await getAgencyPlan(agencyId);
  return TIER_LIMITS[plan].automation.enabled;
}

export async function isScheduledAIEnabled(agencyId: string): Promise<boolean> {
  const plan = await getAgencyPlan(agencyId);
  return TIER_LIMITS[plan].automation.scheduledAIEnabled;
}


