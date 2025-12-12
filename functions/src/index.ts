/**
 * Cloud Functions for LoanSage
 * Automatic backend calculations and scheduled jobs
 */

import * as admin from 'firebase-admin';

// Load environment variables from .env.local (for local development)
// In production, these should be set via Firebase Functions config or environment variables
if (process.env.NODE_ENV !== 'production') {
  try {
    // Try to load from root .env.local (for local development)
    const path = require('path');
    const fs = require('fs');
    // Go up from lib/ (compiled) or src/ (source) to root
    const rootEnvPath = path.resolve(__dirname, '../../.env.local');
    if (fs.existsSync(rootEnvPath)) {
      const envFile = fs.readFileSync(rootEnvPath, 'utf8');
      envFile.split('\n').forEach((line: string) => {
        // Handle both VITE_STRIPE_SECREATE_KEY (with typo) and STRIPE_SECRET_KEY
        const match = line.match(/^(?:VITE_STRIPE_SECREATE_KEY|STRIPE_SECRET_KEY)=(.+)$/);
        if (match && !process.env.STRIPE_SECRET_KEY) {
          process.env.STRIPE_SECRET_KEY = match[1].trim().replace(/^["']|["']$/g, '');
        }
        // Load DeepSeek API key (with or without VITE_ prefix)
        const deepseekMatch = line.match(/^(?:VITE_)?DEEP_SEEK_API_KEY=(.+)$/);
        if (deepseekMatch && !process.env.DEEP_SEEK_API_KEY) {
          process.env.DEEP_SEEK_API_KEY = deepseekMatch[1].trim().replace(/^["']|["']$/g, '');
        }
      });
    }
  } catch (error) {
    // Silently fail if .env.local doesn't exist or can't be read
    // This is expected in production
  }
}

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
export { deepseekProxy } from './deepseek-proxy';

// Export advanced automation functions
export {
  dailyInterestAccrual,
  paymentReminders,
  overdueLoanChecker,
  generateRepaymentSchedule,
  dailyBackup,
} from './advanced-automation';

