# Deployment Checklist

## Pre-Deployment

- [x] Update pricing in `src/lib/pricing/plan-config.ts`
- [x] Update Stripe Price IDs in `functions/src/plan-config.ts`
- [x] Update trial period from 30 to 14 days
- [x] Update Stripe checkout to support trial without payment
- [x] Update all UI references to new pricing
- [x] Fix TypeScript errors
- [x] Build functions successfully

## Deployment Steps

### 1. Deploy Cloud Functions

**Option A: Deploy all functions (may timeout)**
```bash
firebase deploy --only functions
```

**Option B: Deploy in batches (recommended if timeout occurs)**
```bash
# Essential functions first
firebase deploy --only functions:createCheckoutSession,functions:stripeWebhook

# Then migration function
firebase deploy --only functions:migrateLegacyStarterUsers

# Then other functions as needed
firebase deploy --only functions:sendInvitationEmail
```

**Option C: Deploy via Firebase Console**
- Go to Firebase Console → Functions
- Use "Deploy from source" option

### 2. Verify Stripe Configuration

- [ ] Verify Starter product: `prod_ThCTnpdWau2YYr`
- [ ] Verify Starter price: `price_1Sjo4GELOV3w2OwuKyZUZNXh` ($15/month)
- [ ] Verify Enterprise product: `prod_ThCapj7gZp8XWq`
- [ ] Verify Enterprise price: `price_1SjoB7ELOV3w2OwuNNfd1EVh` ($499.99/month)
- [ ] Verify Starter product has 14-day trial configured
- [ ] Verify trial does NOT require payment method upfront

### 3. Run Legacy User Migration

**Option A: Via Cloud Function (if deployed)**
```bash
# Call the function
firebase functions:shell
migrateLegacyStarterUsers({ mode: 'graceful' })
```

**Option B: Via Manual Script**
```bash
npx tsx scripts/migrate-legacy-users.ts graceful
```

**Option C: Via Firebase Console**
- Go to Functions → migrateLegacyStarterUsers → Test
- Input: `{ "mode": "graceful" }`

### 4. Verify Deployment

- [ ] New user signup creates 14-day trial
- [ ] Trial countdown displays correctly
- [ ] Payment not required at signup
- [ ] Enterprise pricing shows $499.99
- [ ] Starter pricing shows $15/month after trial
- [ ] Legacy users migrated successfully

### 5. Test Critical Flows

- [ ] New user signup → Trial starts
- [ ] Trial expiry → Access restricted
- [ ] Add payment during trial → Subscription activates
- [ ] Upgrade to Enterprise → Correct price charged
- [ ] Stripe webhooks fire correctly

## Post-Deployment

- [ ] Monitor Firebase Functions logs
- [ ] Monitor Stripe webhook events
- [ ] Check for any errors in console
- [ ] Verify trial expiry enforcement
- [ ] Send trial expiry reminders (3 days before)
- [ ] Track conversion rates

## Rollback Plan

If issues occur:

1. **Revert pricing changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Revert Cloud Functions:**
   ```bash
   firebase deploy --only functions --force
   ```

3. **Restore legacy user access:**
   - Update Firestore: Set `subscriptionStatus: 'trialing'` for all starter users
   - Or run migration script with `mode: 'graceful'`

## Support Contacts

- Firebase: Check Functions logs
- Stripe: Check webhook logs
- Code issues: Review `PRICING_UPDATE_SUMMARY.md`

