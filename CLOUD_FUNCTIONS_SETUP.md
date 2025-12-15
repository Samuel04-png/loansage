# Cloud Functions Setup Guide

## Overview

TengaLoans now includes comprehensive Cloud Functions for automatic backend calculations, scheduled jobs, and notifications.

## Functions Created

### 1. Loan Validation (`loanValidation`)
- **Type**: Callable Function
- **Purpose**: Validates loan eligibility before creation
- **Usage**: Call from frontend before creating a loan
- **Returns**: Validation result with risk score and recommendations

### 2. Interest Accrual (`interestAccrual`)
- **Type**: Scheduled Function (Daily)
- **Purpose**: Automatically calculates and updates interest daily
- **Schedule**: Runs every day at midnight (Africa/Lusaka timezone)

### 3. Overdue Checker (`checkOverdueLoans`)
- **Type**: Scheduled Function (Daily)
- **Purpose**: Identifies and updates overdue repayments
- **Schedule**: Runs every day

### 4. Status Updater (`updateLoanStatuses`)
- **Type**: Scheduled Function (Hourly)
- **Purpose**: Automatically updates loan statuses:
  - `pending` → `active` (when disbursement date reached)
  - `active` → `overdue` (when repayments are overdue)
  - `overdue` → `defaulted` (after 90 days overdue)
- **Schedule**: Runs every hour

### 5. Collateral Estimation (`estimateCollateralValue`)
- **Type**: Callable Function
- **Purpose**: Estimates market value of collateral
- **Usage**: Call when evaluating collateral

### 6. Collateral Profit (`calculateCollateralProfit`)
- **Type**: Callable Function
- **Purpose**: Calculates profit/loss from collateral liquidation
- **Usage**: Call when evaluating default scenarios

### 7. Notifications (`sendNotifications`)
- **Type**: Callable Function
- **Purpose**: Sends in-app, email, and FCM notifications
- **Usage**: Call from frontend or other functions

### 8. Payment Reminders (`sendPaymentReminders`)
- **Type**: Scheduled Function (Daily)
- **Purpose**: Sends payment reminders 3 days before due date
- **Schedule**: Runs every day

### 9. Thumbnail Generator (`generateThumbnail`)
- **Type**: Storage Trigger
- **Purpose**: Automatically generates thumbnails for uploaded images
- **Trigger**: When image is uploaded to Storage

## Setup Instructions

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Email (for notifications)

```bash
firebase functions:config:set email.user="your-email@gmail.com" email.password="your-app-password"
```

**Note**: For Gmail, you need to:
1. Enable 2-factor authentication
2. Generate an "App Password" (not your regular password)
3. Use that app password in the config

### 3. Build Functions

```bash
cd functions
npm run build
```

### 4. Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:loanValidation
```

### 5. Set Up Firestore Indexes

The composite indexes are defined in `firestore.indexes.json`. Deploy them:

```bash
firebase deploy --only firestore:indexes
```

### 6. Set Up Storage Rules

Deploy storage rules:

```bash
firebase deploy --only storage
```

## Usage Examples

### Calling Loan Validation from Frontend

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const validateLoan = httpsCallable(functions, 'loanValidation');

const result = await validateLoan({
  agencyId: 'agency-id',
  customerId: 'customer-id',
  requestedAmount: 50000,
  interestRate: 15,
  durationMonths: 12,
  collateralValue: 60000,
});

console.log(result.data); // { valid: true, riskScore: 45, ... }
```

### Calling Collateral Estimation

```typescript
const estimateValue = httpsCallable(functions, 'estimateCollateralValue');

const result = await estimateValue({
  agencyId: 'agency-id',
  collateralId: 'collateral-id',
  type: 'vehicle',
  description: 'Toyota Corolla 2018',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2018,
  condition: 'good',
  location: 'Lusaka',
});
```

## Scheduled Functions

Scheduled functions run automatically. You can monitor them in:
- Firebase Console → Functions → Logs
- Or use: `firebase functions:log`

## Testing Locally

```bash
# Start emulators
firebase emulators:start

# In another terminal, trigger functions
firebase functions:shell
```

## Cost Considerations

- **Callable Functions**: Charged per invocation
- **Scheduled Functions**: Charged per execution
- **Storage Triggers**: Charged per file upload
- **Free Tier**: 2 million invocations/month free

Monitor usage in Firebase Console → Usage and billing.

## Troubleshooting

### Functions not deploying
- Check Node.js version (requires 18+)
- Run `npm install` in functions directory
- Check `firebase.json` configuration

### Email not sending
- Verify email config: `firebase functions:config:get`
- Check Gmail app password is correct
- Check function logs: `firebase functions:log`

### Scheduled functions not running
- Check timezone is correct (Africa/Lusaka)
- Verify function is deployed: `firebase functions:list`
- Check logs for errors

