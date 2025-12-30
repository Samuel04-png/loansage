# Pricing & Billing Update Summary

## ✅ Changes Completed

### 1. Starter Plan - $15/month with 14-Day Free Trial

**Pricing Change:**
- **From:** $0/month (free forever)
- **To:** $15/month after 14-day free trial
- **Trial:** 14 days (no payment required upfront)
- **Payment Collection:** After trial ends

**Stripe Configuration:**
- Product ID: `prod_ThCTnpdWau2YYr`
- Price ID: `price_1Sjo4GELOV3w2OwuKyZUZNXh`
- Trial Period: 14 days
- Payment Method: Not required at signup

**Files Modified:**
- `src/lib/pricing/plan-config.ts` - Updated Starter price from $0 to $15
- `functions/src/plan-config.ts` - Added Starter Stripe Price/Product IDs
- `src/lib/firebase/subscription-helpers.ts` - Changed trial from 30 to 14 days
- `functions/src/stripe-checkout.ts` - Added trial support without payment method
- `src/lib/firebase/firestore-helpers.ts` - Updated agency creation to 14-day trial
- `src/components/stripe/CheckoutButton.tsx` - Removed starter plan restriction

### 2. Enterprise Plan - $499.99/month

**Pricing Change:**
- **From:** $120/month
- **To:** $499.99/month

**Stripe Configuration:**
- Product ID: `prod_ThCapj7gZp8XWq`
- Price ID: `price_1SjoB7ELOV3w2OwuNNfd1EVh`

**Files Modified:**
- `src/lib/pricing/plan-config.ts` - Updated Enterprise price from $120 to $499.99
- `functions/src/plan-config.ts` - Updated Enterprise Stripe Price/Product IDs

### 3. UI Updates

**Files Modified:**
- `src/features/public/pages/LandingPage.tsx` - Updated pricing display
- `src/features/admin/pages/PlansPage.tsx` - Updated plan status messages
- `src/features/admin/pages/PaymentHistoryTab.tsx` - Needs update (hardcoded $35)

**Copy Changes:**
- Starter: "14-day free trial, then $15/month"
- Enterprise: "$499.99/month" or "Contact Sales"

### 4. Backend Logic Updates

**Trial Management:**
- Trial period: 14 days (changed from 30)
- Trial tracking: `trialStartDate`, `trialEndDate`
- Trial expiry enforcement: Added `hasAccess()` function
- One trial per account: Enforced via Stripe subscription

**Stripe Checkout:**
- Starter plan now creates subscription with 14-day trial
- `payment_method_collection: 'if_required'` - No payment required upfront
- `trial_settings.end_behavior.missing_payment_method: 'cancel'` - Cancels if no payment by trial end

**Webhook Handlers:**
- `handleCheckoutCompleted` - Handles trial subscription creation
- `handleSubscriptionUpdated` - Updates trial dates and status
- `handleTrialWillEnd` - Notifies when trial is ending (new handler)

### 5. Access Control

**Trial Expiry Enforcement:**
- Added `hasAccess()` function in `subscription-helpers.ts`
- Checks if trial is active OR subscription is active
- Returns false if trial expired without payment

**Status Tracking:**
- `trialing` - Active trial (days remaining > 0)
- `active` - Paid subscription active
- `expired` - Trial ended without payment
- `cancelled` - Subscription cancelled

## ⚠️ Required Actions

### 1. Stripe Configuration

**Verify Stripe Products/Prices:**
- ✅ Starter: `prod_ThCTnpdWau2YYr` / `price_1Sjo4GELOV3w2OwuKyZUZNXh`
- ✅ Enterprise: `prod_ThCapj7gZp8XWq` / `price_1SjoB7ELOV3w2OwuNNfd1EVh`

**Stripe Product Settings:**
- Starter product must have 14-day trial period configured
- Trial should NOT require payment method upfront
- Set `trial_settings.end_behavior.missing_payment_method` to `cancel`

### 2. Legacy User Migration

**Users on $0 Starter Plan:**
- Option A: Start 14-day trial countdown from today
- Option B: Immediately require upgrade (business decision)

**Migration Script Needed:**
```typescript
// functions/src/migrate-legacy-starter.ts
// Update all agencies with plan='starter' and price=0
// Set trialStartDate = now, trialEndDate = now + 14 days
// OR set subscriptionStatus = 'expired' and require upgrade
```

### 3. Firestore Security Rules

**Update Rules for Trial Enforcement:**
- Check `hasAccess()` before allowing write operations
- Restrict access if `trialEndDate` passed and `subscriptionStatus !== 'active'`

### 4. UI Updates Needed

**Files to Update:**
- `src/features/admin/pages/PaymentHistoryTab.tsx` - Remove hardcoded $35/month
- `src/components/pricing/UpgradeModal.tsx` - Update pricing references
- All email templates - Update pricing copy

## 🔍 Validation Checklist

- [ ] Trial starts correctly without payment
- [ ] Trial expires exactly on day 14
- [ ] Payment is requested only after trial
- [ ] No access after trial expiry without payment
- [ ] Stripe prices are correct
- [ ] Webhooks fire correctly
- [ ] Free-plan logic fully removed
- [ ] Legacy users handled appropriately

## 📋 Testing Steps

1. **New User Signup:**
   - Sign up as new user
   - Create agency
   - Verify 14-day trial starts
   - Verify no payment required

2. **Trial Expiry:**
   - Wait for trial to expire (or manually set `trialEndDate` in past)
   - Verify access is restricted
   - Verify upgrade prompt appears

3. **Payment After Trial:**
   - Add payment method during trial
   - Verify subscription activates
   - Verify access continues after trial

4. **Enterprise Plan:**
   - Verify $499.99/month displayed
   - Verify Stripe checkout uses correct price ID

## 🚨 Risks & Follow-ups

### Risks:
1. **Legacy Users:** Existing $0 users may lose access if not migrated properly
2. **Trial Abuse:** Need to enforce one trial per account (handled by Stripe)
3. **Payment Failures:** Need clear messaging when trial ends without payment

### Follow-ups:
1. Create migration script for legacy users
2. Update email templates with new pricing
3. Add trial expiry notifications
4. Update documentation
5. Monitor Stripe webhook logs for trial events

## 📝 Notes

- All changes maintain backward compatibility where possible
- Legacy `planType: 'free'` still supported but maps to `plan: 'starter'`
- Trial enforcement happens at application level, not just Firestore rules
- Stripe handles trial period automatically, but we track it in Firestore for UI

