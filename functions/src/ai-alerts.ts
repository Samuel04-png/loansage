/**
 * AI Alerts Generator Cloud Function
 * 
 * Analyzes loans and generates alerts based on loan type rules
 * Handles alert lifecycle (acknowledgedAt, resolvedAt, expiresAt)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface AlertData {
  agencyId: string;
  loanId: string;
  type: 'risk' | 'compliance' | 'reminder' | 'warning';
  severity: 'low' | 'medium' | 'high';
  source: 'ai';
  rule: string;
  message: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: admin.firestore.Timestamp;
  acknowledgedAt?: admin.firestore.Timestamp;
  resolvedAt?: admin.firestore.Timestamp;
  expiresAt?: admin.firestore.Timestamp;
}

/**
 * Generate alerts for a loan based on loan type rules
 */
async function generateAlertsForLoan(
  agencyId: string,
  loanId: string,
  loanData: any,
  loanTypeConfig: any
): Promise<void> {
  const alerts: Omit<AlertData, 'createdAt'>[] = [];

  // Check if loan type is disabled but loan exists
  if (!loanTypeConfig?.enabled) {
    alerts.push({
      agencyId,
      loanId,
      type: 'compliance',
      severity: 'high',
      source: 'ai',
      rule: 'loan_type_disabled',
      message: `Loan was created with disabled loan type: ${loanData.loanType}`,
      status: 'open',
    });
  }

  // Check for missing required sections based on loan type rules
  if (loanTypeConfig?.collateralRequirement === 'required' && !loanData.collateral) {
    alerts.push({
      agencyId,
      loanId,
      type: 'compliance',
      severity: 'high',
      source: 'ai',
      rule: 'missing_collateral',
      message: 'Collateral is required for this loan type but was not provided',
      status: 'open',
    });
  }

  // Check loan amount against limits
  if (loanData.terms?.amount) {
    if (loanData.terms.amount > loanTypeConfig?.loanAmount?.max * 0.9) {
      alerts.push({
        agencyId,
        loanId,
        type: 'risk',
        severity: 'medium',
        source: 'ai',
        rule: 'high_loan_amount',
        message: `Loan amount (${loanData.terms.amount.toLocaleString()}) is close to maximum limit`,
        status: 'open',
      });
    }
  }

  // Check interest rate
  if (loanData.terms?.interestRate) {
    if (loanData.terms.interestRate > loanTypeConfig?.interestRate?.max * 0.9) {
      alerts.push({
        agencyId,
        loanId,
        type: 'risk',
        severity: 'medium',
        source: 'ai',
        rule: 'high_interest_rate',
        message: `Interest rate (${loanData.terms.interestRate}%) is close to maximum limit`,
        status: 'open',
      });
    }
  }

  // Check for missing borrower information
  if (!loanData.borrower?.nrcNumber || !loanData.borrower?.phone) {
    alerts.push({
      agencyId,
      loanId,
      type: 'compliance',
      severity: 'medium',
      source: 'ai',
      rule: 'incomplete_borrower_info',
      message: 'Borrower information is incomplete',
      status: 'open',
    });
  }

  // Upsert alerts (dedupe by rule)
  for (const alert of alerts) {
    await upsertAlert({
      ...alert,
      createdAt: admin.firestore.Timestamp.now(),
    });
  }
}

/**
 * Upsert alert (dedupe by agencyId + loanId + rule + status=open)
 */
async function upsertAlert(alert: AlertData): Promise<void> {
  const alertsRef = db.collection(`agencies/${alert.agencyId}/alerts`);
  
  // Check for existing open alert with same rule
  const existingQuery = await alertsRef
    .where('loanId', '==', alert.loanId)
    .where('rule', '==', alert.rule)
    .where('status', '==', 'open')
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    // Update existing alert
    const existingAlert = existingQuery.docs[0];
    await existingAlert.ref.update({
      message: alert.message,
      severity: alert.severity,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // Create new alert
    await alertsRef.add({
      ...alert,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Trigger: onCreate loan
 */
export const onLoanCreate = functions.firestore
  .document('agencies/{agencyId}/loans/{loanId}')
  .onCreate(async (snapshot, context) => {
    const loanData = snapshot.data();
    const { agencyId, loanId } = context.params;

    try {
      // Get loan type configuration
      const configRef = db.doc(`agencies/${agencyId}/config/loanTypes`);
      const configSnap = await configRef.get();
      
      if (!configSnap.exists) {
        console.warn(`Loan config not found for agency ${agencyId}`);
        return;
      }

      const agencyConfig = configSnap.data()!;
      const loanTypeConfig = agencyConfig.loanTypes?.[loanData.loanType];

      if (!loanTypeConfig) {
        console.warn(`Loan type config not found: ${loanData.loanType}`);
        return;
      }

      // Generate alerts
      await generateAlertsForLoan(agencyId, loanId, loanData, loanTypeConfig);
    } catch (error) {
      console.error('Error generating alerts for loan:', error);
    }
  });

/**
 * Trigger: onUpdate loan
 * Only triggers AI analysis on significant field changes to avoid rate limits
 */
export const onLoanUpdate = functions.firestore
  .document('agencies/{agencyId}/loans/{loanId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const { agencyId, loanId } = context.params;

    // Only run AI analysis if significant fields changed
    // This prevents unnecessary API calls on minor updates (typos, metadata, etc.)
    const significantFields = [
      'status',
      'loanAmount',
      'terms.amount',
      'interestRate',
      'terms.interestRate',
      'termMonths',
      'terms.durationMonths',
      'loanType',
      'collateral',
      'borrower',
      'customerId',
    ];
    
    const hasSignificantChange = significantFields.some(field => {
      const beforeValue = getNestedValue(beforeData, field);
      const afterValue = getNestedValue(afterData, field);
      return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
    });
    
    if (!hasSignificantChange) {
      console.log(`Loan ${loanId} updated but no significant changes detected. Skipping AI analysis.`);
      return;
    }

    try {
      // Get loan type configuration
      const configRef = db.doc(`agencies/${agencyId}/config/loanTypes`);
      const configSnap = await configRef.get();
      
      if (!configSnap.exists) {
        return;
      }

      const agencyConfig = configSnap.data()!;
      const loanTypeConfig = agencyConfig.loanTypes?.[afterData.loanType];

      if (!loanTypeConfig) {
        return;
      }

      // Generate alerts for updated loan
      await generateAlertsForLoan(agencyId, loanId, afterData, loanTypeConfig);
    } catch (error) {
      console.error('Error generating alerts for updated loan:', error);
    }
  });

/**
 * Helper to get nested object value by dot-notation path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Scheduled function: Auto-resolve expired alerts
 */
export const resolveExpiredAlerts = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // Query all agencies
      const agenciesSnapshot = await db.collection('agencies').get();
      
      for (const agencyDoc of agenciesSnapshot.docs) {
        const agencyId = agencyDoc.id;
        const alertsRef = db.collection(`agencies/${agencyId}/alerts`);
        
        // Find expired alerts
        const expiredQuery = await alertsRef
          .where('status', '==', 'open')
          .where('expiresAt', '<=', now)
          .get();

        // Resolve expired alerts
        const batch = db.batch();
        expiredQuery.docs.forEach((alertDoc) => {
          batch.update(alertDoc.ref, {
            status: 'resolved',
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        if (!expiredQuery.empty) {
          await batch.commit();
          console.log(`Resolved ${expiredQuery.size} expired alerts for agency ${agencyId}`);
        }
      }
    } catch (error) {
      console.error('Error resolving expired alerts:', error);
    }
  });

/**
 * Cloud Function to acknowledge an alert
 */
export const acknowledgeAlert = functions.https.onCall(
  async (data: { agencyId: string; alertId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, alertId } = data;

    try {
      const alertRef = db.doc(`agencies/${agencyId}/alerts/${alertId}`);
      const alertSnap = await alertRef.get();

      if (!alertSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Alert not found');
      }

      const alertData = alertSnap.data()!;
      
      if (alertData.status === 'resolved') {
        throw new functions.https.HttpsError('failed-precondition', 'Alert already resolved');
      }

      await alertRef.update({
        status: 'acknowledged',
        acknowledgedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error acknowledging alert:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Cloud Function to resolve an alert
 */
export const resolveAlert = functions.https.onCall(
  async (data: { agencyId: string; alertId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { agencyId, alertId } = data;

    try {
      const alertRef = db.doc(`agencies/${agencyId}/alerts/${alertId}`);
      const alertSnap = await alertRef.get();

      if (!alertSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Alert not found');
      }

      await alertRef.update({
        status: 'resolved',
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error resolving alert:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

