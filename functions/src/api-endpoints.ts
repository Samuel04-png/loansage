/**
 * REST API Endpoints for Enterprise Customers
 * Requires API Access feature flag
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { PLAN_CONFIG, type PlanCode } from './plan-config';

/**
 * Middleware to check API access
 */
async function checkApiAccess(apiKey: string): Promise<{ agencyId: string; plan: PlanCode }> {
  if (!apiKey) {
    throw new functions.https.HttpsError('unauthenticated', 'API key is required');
  }

  // Find agency by API key
  const agenciesSnapshot = await admin.firestore()
    .collection('agencies')
    .where('apiKey', '==', apiKey)
    .limit(1)
    .get();

  if (agenciesSnapshot.empty) {
    throw new functions.https.HttpsError('unauthenticated', 'Invalid API key');
  }

  const agencyData = agenciesSnapshot.docs[0].data();
  const plan: PlanCode = agencyData.plan || 'starter';

  // Check if agency has API access feature
  const planConfig = PLAN_CONFIG[plan];
  if (!planConfig.features.apiAccess) {
    throw new functions.https.HttpsError('permission-denied', 'API access requires Enterprise plan');
  }

  return {
    agencyId: agenciesSnapshot.docs[0].id,
    plan,
  };
}

/**
 * GET /api/v1/loans
 * List all loans for the agency
 */
export const apiGetLoans = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || req.query.apiKey as string;
    const { agencyId } = await checkApiAccess(apiKey);

    const loansSnapshot = await admin.firestore()
      .collection('agencies')
      .doc(agencyId)
      .collection('loans')
      .get();

    const loans = loansSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: loans,
      count: loans.length,
    });
  } catch (error: any) {
    console.error('API error:', error);
    res.status(error.code === 'permission-denied' ? 403 : error.code === 'unauthenticated' ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/customers
 * List all customers for the agency
 */
export const apiGetCustomers = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || req.query.apiKey as string;
    const { agencyId } = await checkApiAccess(apiKey);

    const customersSnapshot = await admin.firestore()
      .collection('agencies')
      .doc(agencyId)
      .collection('customers')
      .get();

    const customers = customersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: customers,
      count: customers.length,
    });
  } catch (error: any) {
    console.error('API error:', error);
    res.status(error.code === 'permission-denied' ? 403 : error.code === 'unauthenticated' ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/stats
 * Get agency statistics
 */
export const apiGetStats = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || req.query.apiKey as string;
    const { agencyId } = await checkApiAccess(apiKey);

    // Get basic stats
    const [loansSnapshot, customersSnapshot] = await Promise.all([
      admin.firestore().collection('agencies').doc(agencyId).collection('loans').get(),
      admin.firestore().collection('agencies').doc(agencyId).collection('customers').get(),
    ]);

    const loans = loansSnapshot.docs.map(doc => doc.data());
    const totalLoans = loans.length;
    const activeLoans = loans.filter((l: any) => l.status === 'active').length;
    const totalLoanAmount = loans.reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);

    res.json({
      success: true,
      data: {
        totalLoans,
        activeLoans,
        totalCustomers: customersSnapshot.size,
        totalLoanAmount,
      },
    });
  } catch (error: any) {
    console.error('API error:', error);
    res.status(error.code === 'permission-denied' ? 403 : error.code === 'unauthenticated' ? 401 : 500).json({
      success: false,
      error: error.message,
    });
  }
});

