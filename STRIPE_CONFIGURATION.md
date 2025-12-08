# Stripe Configuration Guide

## ✅ Current Setup

Your Stripe keys are configured in `.env.local`:

- **Publishable Key**: `VITE_STRIPE_PUBLISHABLE_KEY` - ✅ Used by frontend
- **Secret Key**: `VITE_STRIPE_SECREATE_KEY` - ⚠️ Only for reference, NOT used in frontend

## 🔒 Important Security Notes

1. **Frontend (.env.local)**: Only the **publishable key** is used by the frontend
2. **Backend (Firebase Functions)**: The **secret key** must be set separately in Firebase Functions config
3. **Never expose the secret key** in frontend code - it's only for backend use

## 📋 Setup Instructions

### Frontend (Already Done ✅)
The frontend automatically reads from `.env.local`:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY_HERE
```

### Backend (Firebase Functions) - REQUIRED

#### For Production:
Set the secret key in Firebase Functions config:
```bash
firebase functions:config:set stripe.secret_key="sk_live_YOUR_SECRET_KEY_HERE"
```

#### For Local Development:
Create a `.env` file in the `functions` directory:
```env
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE
```

### Webhook Secret (After Creating Webhook)
```bash
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
```

## 🚀 Deploy Functions

After setting the config:
```bash
cd functions
npm install
firebase deploy --only functions
```

## ⚠️ Security Reminders

- ✅ Publishable key (`pk_live_...`) - Safe in frontend
- ❌ Secret key (`sk_live_...`) - NEVER in frontend, only in Firebase Functions
- ❌ Webhook secret (`whsec_...`) - Only in Firebase Functions
- ✅ `.env.local` is in `.gitignore` - Won't be committed

## 🧪 Testing

1. Restart your dev server after adding `.env.local`
2. Check that `isStripeConfigured()` returns `true` in the frontend
3. Test checkout flow on `/admin/plans` page

