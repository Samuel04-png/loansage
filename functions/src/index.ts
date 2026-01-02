/**
 * Cloud Functions for TengaLoans
 * Automatic backend calculations and scheduled jobs
 */

import * as admin from 'firebase-admin';

// Environment variable loading removed to prevent deployment timeouts
// Use Firebase Functions config or runtime environment variables instead

admin.initializeApp();

// Export invitation email function (deployed and working)
export { sendInvitationEmail } from './send-invitation-email';

// Export other functions (can be deployed individually or all at once)
export { loanValidation } from './loan-validation';
export { interestAccrual } from './interest-accrual';
export { checkOverdueLoans } from './overdue-checker';
export { updateLoanStatuses } from './status-updater';
export { estimateCollateralValue } from './collateral-estimation';
export { analyzeCollateralVision } from './analyze-collateral-vision';
export { calculateCollateralProfit } from './collateral-profit';
export { sendNotifications } from './notifications';
export { generateThumbnail } from './thumbnail-generator';
export { createCheckoutSession, stripeWebhook } from './stripe-checkout';
export { deepseekProxy } from './deepseek-proxy';
export {
  dailyInterestAccrual,
  paymentReminders,
  overdueLoanChecker,
  generateRepaymentSchedule,
  dailyBackup,
} from './advanced-automation';
export { sendWelcomeEmail, sendAnnouncementEmail } from './welcome-email';
export { migrateAgenciesToNewPlans, migrateSingleAgency } from './migrate-agencies';
export { migrateLegacyStarterUsers } from './migrate-legacy-starter';
// export { checkExpiredTrials } from './migrate-legacy-starter'; // Commented out - deploy separately if needed
export { apiGetLoans, apiGetCustomers, apiGetStats } from './api-endpoints';
export { createLoan } from './create-loan';
export { 
  onLoanCreate, 
  onLoanUpdate, 
  resolveExpiredAlerts,
  acknowledgeAlert,
  resolveAlert 
} from './ai-alerts';
export { onAgencyCreate } from './agency-triggers';
export { validateCustomerDelete } from './validate-customer-delete';
export { validateLoanDelete } from './validate-loan-delete';
export { validateLoanUpdate } from './validate-loan-update';