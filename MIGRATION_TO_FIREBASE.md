# Migration from Supabase to Firebase

This document explains the changes made to migrate the LoanSage project from Supabase to Firebase.

## ✅ What Was Changed

### 1. **New Firebase Configuration** (`src/lib/firebase/`)
   - `config.ts` - Firebase initialization and configuration
   - `auth.ts` - Firebase Authentication service (replaces Supabase Auth)
   - `db.ts` - Firestore database service with Supabase-compatible interface
   - `storage.ts` - Firebase Storage service
   - `helpers.ts` - Helper functions for ID generation (replaces RPC functions)
   - `client.ts` - Main export file

### 2. **Backward Compatibility Layer**
   - Updated `src/lib/supabase/client.ts` to re-export Firebase services
   - Updated `src/lib/supabase/auth.ts` to re-export Firebase auth
   - This allows existing code to continue working with minimal changes

### 3. **Environment Variables**
   - Changed from Supabase variables to Firebase variables:
     - `VITE_SUPABASE_URL` → `VITE_FIREBASE_API_KEY`
     - `VITE_SUPABASE_ANON_KEY` → `VITE_FIREBASE_AUTH_DOMAIN`, etc.
   - See `FIREBASE_SETUP.md` for complete list

### 4. **Database Queries**
   - Supabase uses PostgreSQL with SQL-like queries
   - Firebase uses Firestore (NoSQL) with document queries
   - Created a `QueryBuilder` class that mimics Supabase's query interface
   - Most existing queries should work with minimal changes

## 🔄 Key Differences

### Authentication
- **Before**: `supabase.auth.signUp()`, `supabase.auth.signInWithPassword()`
- **After**: `authService.signUp()`, `authService.signIn()` (or use compatibility layer)

### Database Queries
- **Before**: `supabase.from('users').select('*').eq('id', userId)`
- **After**: Same syntax works! (via compatibility layer)

### Storage
- **Before**: `supabase.storage.from('bucket').upload(path, file)`
- **After**: Same syntax works! (via compatibility layer)

### RPC Functions
- **Before**: `supabase.rpc('generate_employee_id', { agency_id })`
- **After**: Same syntax works! (implemented as client-side helpers)

## 📝 What You Need to Do

### 1. Install Firebase
```bash
npm install firebase
```

### 2. Set Up Firebase Project
Follow the instructions in `FIREBASE_SETUP.md`:
- Create Firebase project
- Enable Authentication
- Create Firestore database
- Set up Storage
- Get configuration values

### 3. Update Environment Variables
Create `.env.local` with Firebase credentials (see `FIREBASE_SETUP.md`)

### 4. Set Up Security Rules
- Firestore security rules (see `FIREBASE_SETUP.md`)
- Storage security rules (see `FIREBASE_SETUP.md`)

### 5. Test the Application
- Try signing up
- Create an organization
- Test file uploads
- Verify data appears in Firebase Console

## 🎯 Code Compatibility

Most of your existing code should work without changes because:
1. The Supabase imports are re-exported from Firebase
2. The query interface is similar
3. The auth service has the same API

However, you may need to adjust:
- Complex queries (especially joins - Firestore doesn't support joins)
- RPC functions (now client-side helpers)
- Real-time subscriptions (different API)

## 📚 Files That May Need Updates

While most files should work, you may want to review:
- Files with complex database queries
- Files using Supabase-specific features
- Files with real-time subscriptions

## 🔍 Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] Organization creation works
- [ ] File uploads work
- [ ] Database queries return data
- [ ] Security rules are working
- [ ] No console errors

## 💡 Tips

1. **Start with test mode**: Use test mode security rules initially, then tighten them
2. **Monitor Firebase Console**: Watch for errors in Firebase Console
3. **Check browser console**: Look for any Firebase-related errors
4. **Test incrementally**: Test one feature at a time

## 🆘 Troubleshooting

### "Firebase: Error (auth/invalid-api-key)"
- Check your `.env.local` file
- Restart dev server after changing env vars

### "Missing or insufficient permissions"
- Check Firestore security rules
- Verify user is authenticated
- Check user's `agency_id` and `role`

### Queries not working
- Check browser console for errors
- Verify Firestore security rules allow the operation
- Check that collections exist in Firestore

## 📖 Additional Resources

- `FIREBASE_SETUP.md` - Complete Firebase setup guide
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)

---

**Note**: The Supabase package (`@supabase/supabase-js`) is still in `package.json` but is no longer used. You can remove it if you want, but it's safe to leave it for now.

