# Migration Instructions for Legacy Starter Plan Users

## Overview

After updating pricing from $0/month to $15/month with 14-day trial, you need to migrate existing users who were on the free Starter plan.

## Option 1: Run Migration via Cloud Function (Recommended)

### Step 1: Deploy Cloud Functions

The deployment may timeout due to initialization issues. Try these approaches:

**Approach A: Deploy specific functions only**
```bash
# Deploy just the essential functions first
firebase deploy --only functions:createCheckoutSession,functions:stripeWebhook

# Then deploy the migration function separately
firebase deploy --only functions:migrateLegacyStarterUsers
```

**Approach B: Deploy in smaller batches**
```bash
# Deploy functions in groups
firebase deploy --only functions:createCheckoutSession
firebase deploy --only functions:stripeWebhook
firebase deploy --only functions:migrateLegacyStarterUsers
```

**Approach C: If timeout persists, deploy via Firebase Console**
1. Go to Firebase Console → Functions
2. Use "Deploy from source" option
3. Or use `firebase deploy --only functions --force` (may take longer)

### Step 2: Run Migration

Once deployed, call the migration function:

**Via Firebase Console:**
1. Go to Firebase Console → Functions
2. Find `migrateLegacyStarterUsers`
3. Click "Test" and provide: `{ "mode": "graceful" }`

**Via Frontend (Admin Dashboard):**
Add a button in admin settings to call:
```typescript
const migrateLegacyUsers = httpsCallable(functions, 'migrateLegacyStarterUsers');
const result = await migrateLegacyUsers({ mode: 'graceful' });
```

**Via Firebase CLI:**
```bash
firebase functions:shell
# Then in the shell:
migrateLegacyStarterUsers({ mode: 'graceful' })
```

## Option 2: Manual Migration Script (Alternative)

If Cloud Function deployment fails, use this Node.js script:

### Create `scripts/migrate-legacy-users.ts`:

```typescript
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
const serviceAccount = require('../path-to-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function migrateLegacyUsers(mode: 'graceful' | 'strict' = 'graceful') {
  const db = admin.firestore();
  const agenciesRef = db.collection('agencies');
  
  // Find all starter plan agencies without trial end date
  const starterAgencies = await agenciesRef
    .where('plan', '==', 'starter')
    .get();

  const now = admin.firestore.Timestamp.now();
  const trialEnd = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + (14 * 24 * 60 * 60 * 1000) // 14 days
  );

  let count = 0;
  const batch = db.batch();

  for (const doc of starterAgencies.docs) {
    const agencyData = doc.data();
    
    // Skip if already has trial end date
    if (agencyData.trialEndDate) continue;
    
    // Skip if has active subscription
    if (agencyData.subscriptionStatus === 'active' && agencyData.stripeSubscriptionId) continue;

    if (mode === 'graceful') {
      batch.update(doc.ref, {
        plan: 'starter',
        planType: 'free',
        subscriptionStatus: 'trialing',
        trialStartDate: now,
        trialEndDate: trialEnd,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      batch.update(doc.ref, {
        subscriptionStatus: 'expired',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    count++;

    // Firestore batch limit is 500
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`Migrated ${count} agencies...`);
    }
  }

  // Commit remaining
  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`✅ Migration complete: ${count} agencies migrated (mode: ${mode})`);
}

// Run migration
migrateLegacyUsers('graceful')
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

### Run the script:
```bash
npx tsx scripts/migrate-legacy-users.ts
```

## Option 3: Direct Firestore Update (Quick Fix)

For immediate migration, update Firestore directly:

1. Go to Firebase Console → Firestore Database
2. Filter agencies where `plan == 'starter'` and `trialEndDate` doesn't exist
3. For each agency, update:
   - `trialStartDate`: Current timestamp
   - `trialEndDate`: Current timestamp + 14 days
   - `subscriptionStatus`: `'trialing'`
   - `planType`: `'free'`

## Migration Modes

### Graceful Mode (Recommended)
- Starts 14-day trial from today
- Users get 14 days to add payment
- Smooth transition

### Strict Mode
- Immediately sets status to 'expired'
- Users must upgrade immediately
- More aggressive enforcement

## Verification

After migration, verify:

1. **Check trial dates:**
   ```javascript
   // In Firestore Console
   agencies.where('plan', '==', 'starter').where('subscriptionStatus', '==', 'trialing')
   ```

2. **Verify trial end dates:**
   - Should be exactly 14 days from `trialStartDate`
   - All should be in the future

3. **Test access:**
   - Log in as a migrated user
   - Verify they can access features during trial
   - Verify they see trial countdown

## Post-Migration

1. **Monitor trial expirations:**
   - Set up alerts for agencies approaching trial end
   - Send reminder emails 3 days before trial ends

2. **Handle expired trials:**
   - Update `subscriptionStatus` to `'expired'` when trial ends
   - Restrict access for expired trials
   - Show upgrade prompts

3. **Track conversions:**
   - Monitor how many users add payment during trial
   - Track conversion rate from trial to paid

## Troubleshooting

### Deployment Timeout
- Try deploying functions individually
- Check for heavy imports or top-level async code
- Consider splitting large functions

### Migration Fails
- Check Firestore permissions
- Verify admin authentication
- Check batch size limits (500 per batch)

### Users Not Migrated
- Check if they already have `trialEndDate`
- Verify `plan` field is set to `'starter'`
- Check for active subscriptions (should skip)

## Support

If you encounter issues:
1. Check Firebase Functions logs
2. Verify Firestore security rules
3. Check Stripe webhook configuration
4. Review `PRICING_UPDATE_SUMMARY.md` for complete changes

