# Run Legacy User Migration

## ✅ Cloud Functions Deployed Successfully!

All functions including `migrateLegacyStarterUsers` have been deployed.

## Option 1: Run Migration via Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/project/digital-bible-e3122/functions)
2. Find `migrateLegacyStarterUsers` function
3. Click "Test" button
4. Enter test data: `{ "mode": "graceful" }`
5. Click "Test" to run

## Option 2: Run Migration via Firebase CLI

```bash
# Start Firebase Functions shell
firebase functions:shell

# In the shell, call the function:
migrateLegacyStarterUsers({ mode: 'graceful' })
```

## Option 3: Run Migration via Frontend (Admin Dashboard)

Add this code to an admin page:

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase/config';

const migrateLegacyUsers = async () => {
  const migrateFunction = httpsCallable(functions, 'migrateLegacyStarterUsers');
  const result = await migrateFunction({ mode: 'graceful' });
  console.log('Migration result:', result.data);
};
```

## Option 4: Manual Script (Alternative)

If Cloud Function doesn't work, use the Node.js script:

```bash
# Install dependencies if needed
npm install -g tsx

# Run migration script
npx tsx scripts/migrate-legacy-users.ts graceful
```

## Migration Modes

- **graceful** (recommended): Starts 14-day trial from today
- **strict**: Immediately requires upgrade (no trial)

## What the Migration Does

1. Finds all agencies with `plan: 'starter'` and no `trialEndDate`
2. Sets `trialStartDate` = now
3. Sets `trialEndDate` = now + 14 days
4. Updates `subscriptionStatus` = 'trialing'
5. Updates `planType` = 'free'

## Verification

After migration, verify in Firestore:
- All starter agencies have `trialEndDate` set
- `trialEndDate` is exactly 14 days from `trialStartDate`
- `subscriptionStatus` is 'trialing'

## Next Steps

1. ✅ Run migration (choose one option above)
2. ✅ Verify migration results in Firestore
3. ✅ Test new user signup (should start 14-day trial)
4. ✅ Test trial expiry enforcement
5. ✅ Monitor Stripe webhooks for trial subscriptions

