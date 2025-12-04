# Stripe Integration Verification Checklist

## ✅ Frontend Configuration

### 1. Publishable Key Setup
- **File**: `src/lib/stripe/config.ts`
- **Status**: ✅ Configured
- **Reads from**: `.env.local` → `VITE_STRIPE_PUBLISHABLE_KEY`
- **Key**: `pk_live_YOUR_STRIPE_PUBLISHABLE_KEY_HERE`

### 2. Frontend Components
- **CheckoutButton**: ✅ Implemented in `src/components/stripe/CheckoutButton.tsx`
- **PlansPage**: ✅ Uses `CheckoutButton` component
- **PaymentHistoryTab**: ✅ Uses `CheckoutButton` component

### 3. Frontend Integration Flow
1. User clicks "Subscribe Now" button
2. `CheckoutButton` checks if Stripe is configured (`isStripeConfigured()`)
3. Calls Cloud Function `createCheckoutSession` via `httpsCallable`
4. Receives `sessionId` from Cloud Function
5. Redirects to Stripe Checkout using `stripe.redirectToCheckout()`

## ✅ Backend Configuration

### 1. Secret Key Setup
- **File**: `functions/src/stripe-checkout.ts`
- **Status**: ✅ Configured
- **Reads from** (in priority order):
  1. `process.env.STRIPE_SECRET_KEY` (environment variable)
  2. `functions.config().stripe.secret_key` (Firebase Functions config) ✅ **SET**
- **Key**: `sk_live_YOUR_STRIPE_SECRET_KEY_HERE`

### 2. Cloud Functions
- **createCheckoutSession**: ✅ Exported in `functions/src/index.ts`
- **stripeWebhook**: ✅ Exported in `functions/src/index.ts`
- **API Version**: ✅ Set to `'2023-10-16'` (valid version)

### 3. Local Development Support
- **File**: `functions/src/index.ts`
- **Status**: ✅ Configured
- **Reads from**: `.env.local` in root directory
- **Looks for**: `VITE_STRIPE_SECREATE_KEY` or `STRIPE_SECRET_KEY`

## 🔄 Integration Flow

### Complete Payment Flow:
1. **User Action**: Clicks "Subscribe Now" on Plans page
2. **Frontend**: `CheckoutButton` component
   - Validates Stripe is configured
   - Gets agency ID from user profile
   - Calls `createCheckoutSession` Cloud Function
3. **Backend**: `createCheckoutSession` function
   - Validates user authentication
   - Gets/creates Stripe customer
   - Creates checkout session
   - Returns `sessionId`
4. **Frontend**: Receives `sessionId`
   - Loads Stripe.js
   - Redirects to Stripe Checkout
5. **Stripe**: Processes payment
6. **Webhook**: `stripeWebhook` function
   - Handles `checkout.session.completed`
   - Saves payment record to Firestore
   - Updates agency subscription status

## ⚠️ Potential Issues to Check

### 1. Environment Variables
- [ ] Verify `.env.local` exists in root directory
- [ ] Verify `VITE_STRIPE_PUBLISHABLE_KEY` is set in `.env.local`
- [ ] Verify `VITE_STRIPE_SECREATE_KEY` is set in `.env.local` (for local dev)

### 2. Firebase Functions
- [ ] Verify functions are deployed: `firebase deploy --only functions`
- [ ] Verify config is set: `firebase functions:config:get`
- [ ] Check function logs: `firebase functions:log`

### 3. Frontend Build
- [ ] Restart dev server after adding `.env.local`
- [ ] Verify `isStripeConfigured()` returns `true`
- [ ] Check browser console for errors

### 4. Testing
- [ ] Test checkout flow on `/admin/plans` page
- [ ] Verify redirect to Stripe Checkout works
- [ ] Test with Stripe test mode first (if using test keys)

## 🧪 Quick Test

1. **Check Frontend Config**:
   ```javascript
   // In browser console
   import { isStripeConfigured, STRIPE_PUBLISHABLE_KEY } from './lib/stripe/config';
   console.log('Stripe configured:', isStripeConfigured());
   console.log('Publishable key:', STRIPE_PUBLISHABLE_KEY);
   ```

2. **Check Backend Config**:
   ```bash
   firebase functions:config:get
   # Should show: stripe.secret_key
   ```

3. **Test Checkout**:
   - Navigate to `/admin/plans`
   - Click "Subscribe Now" on Professional plan
   - Should redirect to Stripe Checkout

## 📝 Notes

- **Production**: Uses Firebase Functions config for secret key
- **Local Dev**: Reads from `.env.local` in root directory
- **Frontend**: Always uses `.env.local` for publishable key
- **Security**: Secret key never exposed to frontend ✅

