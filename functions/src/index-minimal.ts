/**
 * Minimal Cloud Functions Export
 * Used for initial deployment to avoid timeout issues
 * After successful deployment, merge back into index.ts
 */

import * as admin from 'firebase-admin';

admin.initializeApp();

// Export only critical functions for pricing update
export { createCheckoutSession, stripeWebhook } from './stripe-checkout';
export { migrateLegacyStarterUsers } from './migrate-legacy-starter';

