# Stripe Configuration Guide

## ✅ Current Setup

Your Stripe keys are configured in `.env.local`:

- **Publishable Key**: `VITE_STRIPE_PUBLISHABLE_KEY` - ✅ Used by frontend
- **Secret Key**: `VITE_STRIPE_SECREATE_KEY` - ⚠️ Only for reference, NOT used in frontend

## 🔒 Important Security Notes

1. **Frontend (.env.local)**: Only the **publishable key** is used by the frontend
2. **Backend (Firebase Functions)**: The **secret key** must be set in environment variables
3. **Never expose the secret key** in frontend code - it's only for backend use

## 📋 Setup Instructions

### Frontend (Vercel Deployment) ✅

The frontend automatically reads from `.env.local` or Vercel environment variables:

**In Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add: `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_live_YOUR_PUBLISHABLE_KEY_HERE`
3. Select all environments (Production, Preview, Development)

**In `.env.local` (for local development):**
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY_HERE
```

### Backend (Firebase Functions) - REQUIRED

Firebase Functions will read from environment variables. You have two options:

#### Option 1: Firebase Functions Runtime Config (Recommended for Firebase)

Set the secret key in Firebase Functions config:
```bash
firebase functions:config:set stripe.secret_key="sk_live_YOUR_SECRET_KEY_HERE"
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
```

Then deploy:
```bash
cd functions
npm install
firebase deploy --only functions
```

#### Option 2: Environment Variables (Works with Vercel-style setup)

If you're using Firebase Functions with runtime environment variables:

**In Firebase Console:**
1. Go to Functions → Configuration → Environment Variables
2. Add: `STRIPE_SECRET_KEY` = `sk_live_YOUR_SECRET_KEY_HERE`
3. Add: `STRIPE_WEBHOOK_SECRET` = `whsec_YOUR_WEBHOOK_SECRET`

**For Local Development:**
Create a `.env` file in the `functions` directory:
```env
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

### Priority Order

The code checks for the secret key in this order:
1. `process.env.STRIPE_SECRET_KEY` (environment variable - works with Vercel, Firebase runtime config, local .env)
2. `functions.config().stripe.secret_key` (Firebase Functions config - legacy method)

## 🚀 Deployment

### Frontend (Vercel)
1. Push your code to GitHub
2. Vercel will automatically detect and deploy
3. Make sure environment variables are set in Vercel dashboard

### Backend (Firebase Functions)
```bash
cd functions
npm install
firebase deploy --only functions
```

## ⚠️ Security Reminders

- ✅ Publishable key (`pk_live_...`) - Safe in frontend, can be in Vercel env vars
- ❌ Secret key (`sk_live_...`) - NEVER in frontend, only in backend environment variables
- ❌ Webhook secret (`whsec_...`) - Only in backend environment variables
- ✅ `.env.local` is in `.gitignore` - Won't be committed
- ✅ Never commit actual keys to Git

## 🧪 Testing

1. Restart your dev server after adding `.env.local`
2. Check that `isStripeConfigured()` returns `true` in the frontend
3. Test checkout flow on `/admin/plans` page
4. Verify Firebase Functions can access the secret key (check function logs)

