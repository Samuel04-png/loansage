# Stripe Setup Guide

## How to Get Your Stripe API Keys

### Step 1: Create a Stripe Account
1. Go to [https://stripe.com](https://stripe.com)
2. Click "Sign up" or "Start now"
3. Create your account with your email and password
4. Complete the account setup process

### Step 2: Access Your API Keys

#### For Development (Test Mode):
1. Log in to your Stripe Dashboard: [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Make sure you're in **Test mode** (toggle in the top right)
3. Go to **Developers** → **API keys** (or click [here](https://dashboard.stripe.com/test/apikeys))
4. You'll see:
   - **Publishable key** (starts with `pk_test_...`) - This is safe to use in frontend code
   - **Secret key** (starts with `sk_test_...`) - Click "Reveal test key" to see it
     - ⚠️ **Keep this secret!** Never expose it in frontend code

#### For Production:
1. Switch to **Live mode** in Stripe Dashboard (toggle in top right)
2. Go to **Developers** → **API keys**
3. Get your live keys:
   - **Publishable key** (starts with `pk_live_...`)
   - **Secret key** (starts with `sk_live_...`)

### Step 3: Add Keys to Your Project

#### Frontend (.env file):
Create or update `.env` in your project root:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
```

#### Backend (Firebase Functions):
Set the secret key in Firebase Functions config:
```bash
firebase functions:config:set stripe.secret_key="sk_test_YOUR_SECRET_KEY_HERE"
```

### Step 4: Set Up Webhook Secret

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Enter your webhook URL:
   ```
   https://us-central1-<your-project-id>.cloudfunctions.net/stripeWebhook
   ```
   Replace `<your-project-id>` with your Firebase project ID
4. Select events to listen to:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Add it to Firebase Functions config:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET_HERE"
   ```

### Step 5: Verify Your Product and Price IDs

1. In Stripe Dashboard, go to **Products**
2. Find your product (ID: `prod_TYWEIL2gnwQmvD`)
3. Verify the price ID matches: `price_1SbPCBELOV3w2OwuwlZDaIwz`
4. If they don't match, update them in:
   - `src/lib/stripe/config.ts`

## Quick Setup Commands

```bash
# 1. Add publishable key to .env
echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_test_..." >> .env

# 2. Set secret key in Firebase Functions
firebase functions:config:set stripe.secret_key="sk_test_..."

# 3. Set webhook secret (after creating webhook)
firebase functions:config:set stripe.webhook_secret="whsec_..."

# 4. Deploy functions
cd functions
npm install
firebase deploy --only functions
```

## Testing

### Test Mode
- Use test card: `4242 4242 4242 4242`
- Any future expiry date (e.g., 12/34)
- Any 3-digit CVC
- Any ZIP code

### Test Payment Flow
1. Go to `/admin/plans`
2. Click "Subscribe Now"
3. Use test card details above
4. Complete checkout
5. Check payment history in Settings

## Security Notes

- ✅ **Publishable key** (`pk_...`) - Safe to use in frontend
- ❌ **Secret key** (`sk_...`) - NEVER expose in frontend, only in backend
- ❌ **Webhook secret** (`whsec_...`) - Only in backend
- Always use environment variables, never hardcode keys

## Troubleshooting

### "Stripe is not configured" error
- Check that `VITE_STRIPE_PUBLISHABLE_KEY` is set in `.env`
- Restart your dev server after adding the key

### Webhook not working
- Verify webhook URL is correct
- Check webhook secret is set in Firebase Functions config
- View webhook logs in Stripe Dashboard

### Payment not appearing in history
- Check Cloud Functions logs: `firebase functions:log`
- Verify webhook is receiving events in Stripe Dashboard
- Check Firestore `payments` collection

## Support

- Stripe Documentation: [https://stripe.com/docs](https://stripe.com/docs)
- Stripe Support: [https://support.stripe.com](https://support.stripe.com)

