# Spark Plan (Free Tier) Configuration Guide

If you're using Firebase on the **Spark (free) plan**, you need to enable Spark plan mode to avoid errors with features that require the Blaze plan.

## How to Enable Spark Plan Mode

Add this to your `.env.local` file:

```env
VITE_FIREBASE_SPARK_PLAN=true
```

## What Gets Disabled on Spark Plan

When Spark plan mode is enabled, the following features are automatically skipped:

1. **File Uploads**:
   - Agency logo uploads
   - Customer ID document uploads
   - Loan document uploads
   - Collateral photo uploads
   - Profile photo uploads

2. **Cloud Functions** (not implemented yet):
   - Email sending (invitations, notifications)
   - Custom claims updates
   - Background jobs

## What Still Works on Spark Plan

✅ All Firestore operations (read/write)
✅ Authentication (login, signup, password reset)
✅ Real-time data sync
✅ All CRUD operations
✅ Loan management
✅ Customer management
✅ Employee management
✅ Reports and analytics

## Upgrading to Blaze Plan

To enable all features:
1. Go to Firebase Console → Project Settings → Usage and billing
2. Upgrade to Blaze plan (pay-as-you-go, still has free tier)
3. Remove `VITE_FIREBASE_SPARK_PLAN=true` from `.env.local` or set it to `false`

## Notes

- Spark plan mode is detected automatically when `VITE_FIREBASE_SPARK_PLAN=true`
- File uploads will show informational messages instead of errors
- All other features work normally
- Audit logs are created in the background and won't block operations

