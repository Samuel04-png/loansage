/**
 * Cloud Functions for LoanSage
 * Automatic backend calculations and scheduled jobs
 */

import * as admin from 'firebase-admin';

admin.initializeApp();

// Export all function modules
export { loanValidation } from './loan-validation';
export { interestAccrual } from './interest-accrual';
export { checkOverdueLoans } from './overdue-checker';
export { updateLoanStatuses } from './status-updater';
export { estimateCollateralValue } from './collateral-estimation';
export { calculateCollateralProfit } from './collateral-profit';
export { sendNotifications } from './notifications';
export { generateThumbnail } from './thumbnail-generator';
export { createCheckoutSession, stripeWebhook } from './stripe-checkout';

