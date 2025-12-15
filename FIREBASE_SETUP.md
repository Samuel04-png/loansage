# Firebase Setup Guide for TengaLoans

This guide will walk you through setting up Firebase for your TengaLoans project.

## 📋 Prerequisites

- A Firebase account (sign up at [firebase.google.com](https://firebase.google.com) - free tier available)
- Node.js 18+ installed
- Basic understanding of databases

## ⚡ Quick Start Checklist

- [ ] Create Firebase project
- [ ] Enable Authentication (Email/Password)
- [ ] Create Firestore database
- [ ] Set up Storage bucket
- [ ] Get Firebase configuration
- [ ] Create `.env.local` file with credentials
- [ ] Set up Firestore security rules
- [ ] Set up Storage security rules
- [ ] Test authentication

**Estimated time**: 20-30 minutes

---

## 🚀 Step-by-Step Setup

### Step 1: Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** or **"Create a project"**
3. Fill in the details:
   - **Project name**: `tengaloans` (or your preferred name)
   - **Google Analytics**: Optional (you can enable it later)
4. Click **"Continue"** and follow the prompts
5. Wait for the project to be created

### Step 2: Enable Authentication

1. In your Firebase project, go to **Authentication** (left sidebar)
2. Click **"Get started"**
3. Go to the **"Sign-in method"** tab
4. Click on **"Email/Password"**
5. Enable **"Email/Password"** and click **"Save"**
6. (Optional) Enable **"Email link (passwordless sign-in)"** if needed

### Step 3: Create Firestore Database

1. Go to **Firestore Database** (left sidebar)
2. Click **"Create database"**
3. Choose **"Start in test mode"** for development (we'll add security rules later)
4. Select a **location** closest to your users
5. Click **"Enable"**
6. Wait for the database to be created

### Step 4: Set Up Storage

1. Go to **Storage** (left sidebar)
2. Click **"Get started"**
3. Start in **"test mode"** for development (we'll add security rules later)
4. Choose the same location as your Firestore database
5. Click **"Done"**

### Step 5: Get Your Firebase Configuration

1. Go to **Project Settings** (gear icon next to "Project Overview")
2. Scroll down to **"Your apps"** section
3. Click the **Web icon** (`</>`) to add a web app
4. Register your app:
   - **App nickname**: `TengaLoans Web`
   - **Firebase Hosting**: Optional (check if you plan to use it)
5. Click **"Register app"**
6. Copy the `firebaseConfig` object - you'll need these values:
   ```javascript
   {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   }
   ```

### Step 6: Configure Environment Variables

1. Create a `.env.local` file in your project root:
   ```bash
   # On Windows (PowerShell)
   New-Item -Path .env.local -ItemType File
   
   # On Mac/Linux
   touch .env.local
   ```

2. Add your Firebase configuration:
   ```env
   # Firebase Configuration
   # Get these values from Firebase Console > Project Settings > Your apps
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   
   # Google Gemini API (for AI underwriting - optional)
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

   **Important**: 
   - Replace all placeholder values with your actual Firebase config values
   - **No quotes needed** around the values
   - **No spaces** around the `=` sign
   - Restart your dev server after creating/updating `.env.local`

### Step 7: Set Up Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserAgencyId() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.agency_id;
    }
    
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    function isAdmin() {
      return getUserRole() == 'admin';
    }
    
    function isEmployee() {
      return getUserRole() == 'employee';
    }
    
    function isCustomer() {
      return getUserRole() == 'customer';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && (request.auth.uid == userId || getUserAgencyId() != null);
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isAuthenticated() && request.auth.uid == userId;
      allow delete: if isAuthenticated() && isAdmin();
    }
    
    // Agencies collection
    match /agencies/{agencyId} {
      allow read: if isAuthenticated() && getUserAgencyId() == agencyId;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && (isAdmin() && getUserAgencyId() == agencyId);
      allow delete: if isAuthenticated() && isAdmin() && getUserAgencyId() == agencyId;
    }
    
    // Employees collection
    match /employees/{employeeId} {
      allow read: if isAuthenticated() && getUserAgencyId() != null;
      allow create: if isAuthenticated() && (isAdmin() || isEmployee());
      allow update: if isAuthenticated() && (isAdmin() || (isEmployee() && resource.data.user_id == request.auth.uid));
      allow delete: if isAuthenticated() && isAdmin();
    }
    
    // Customers collection
    match /customers/{customerId} {
      allow read: if isAuthenticated() && (
        isAdmin() || 
        isEmployee() || 
        (isCustomer() && resource.data.user_id == request.auth.uid)
      );
      allow create: if isAuthenticated() && (isAdmin() || isEmployee());
      allow update: if isAuthenticated() && (isAdmin() || isEmployee());
      allow delete: if isAuthenticated() && isAdmin();
    }
    
    // Loans collection
    match /loans/{loanId} {
      allow read: if isAuthenticated() && getUserAgencyId() != null;
      allow create: if isAuthenticated() && (isAdmin() || isEmployee());
      allow update: if isAuthenticated() && (isAdmin() || isEmployee());
      allow delete: if isAuthenticated() && isAdmin();
    }
    
    // Loan repayments collection
    match /loan_repayments/{repaymentId} {
      allow read: if isAuthenticated() && getUserAgencyId() != null;
      allow create: if isAuthenticated() && (isAdmin() || isEmployee());
      allow update: if isAuthenticated() && (isAdmin() || isEmployee());
      allow delete: if isAuthenticated() && isAdmin();
    }
    
    // Documents collection
    match /documents/{documentId} {
      allow read: if isAuthenticated() && getUserAgencyId() != null;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && (isAdmin() || resource.data.uploaded_by == request.auth.uid);
      allow delete: if isAuthenticated() && (isAdmin() || resource.data.uploaded_by == request.auth.uid);
    }
    
    // Messages collection
    match /messages/{messageId} {
      allow read: if isAuthenticated() && (
        resource.data.from_user_id == request.auth.uid ||
        resource.data.to_user_id == request.auth.uid
      );
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && resource.data.from_user_id == request.auth.uid;
      allow delete: if isAuthenticated() && (
        resource.data.from_user_id == request.auth.uid ||
        resource.data.to_user_id == request.auth.uid
      );
    }
    
    // Notifications collection
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && resource.data.user_id == request.auth.uid;
      allow delete: if isAuthenticated() && resource.data.user_id == request.auth.uid;
    }
    
    // Tasks collection
    match /tasks/{taskId} {
      allow read: if isAuthenticated() && getUserAgencyId() != null;
      allow create: if isAuthenticated() && (isAdmin() || isEmployee());
      allow update: if isAuthenticated() && (isAdmin() || isEmployee());
      allow delete: if isAuthenticated() && isAdmin();
    }
    
    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Click **"Publish"**

**Note**: These rules are a starting point. You may need to adjust them based on your specific requirements.

### Step 8: Set Up Storage Security Rules

1. Go to **Storage** → **Rules** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Agency logos bucket
    match /agency-logos/{userId}/{allPaths=**} {
      // Allow public read access
      allow read: if true;
      
      // Allow authenticated users to upload
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Allow updates/deletes by owner
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Documents bucket
    match /documents/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Default deny
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

3. Click **"Publish"**

### Step 9: Install Firebase Package

If you haven't already, install Firebase:

```bash
npm install firebase
```

### Step 10: Test Your Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Try signing up:
   - Navigate to the sign-up page
   - Create a test account
   - Check your email for verification (if email verification is enabled)

3. Check Firebase Console:
   - **Authentication** → **Users**: Should see your new user
   - **Firestore Database**: Should see a `users` collection with your user document

## 🔍 Verifying Your Setup

### Check Firestore Collections

1. Go to **Firestore Database** in Firebase Console
2. You should see collections being created as you use the app:
   - `users`
   - `agencies`
   - `employees`
   - `customers`
   - `loans`
   - etc.

### Check Storage

1. Try uploading a logo in the "Create Organization" page
2. Check **Storage** → **agency-logos** folder
3. The file should appear there

## 🛠️ Troubleshooting

### Issue: "Firebase: Error (auth/invalid-api-key)"

**Solution**: 
- Check that your `VITE_FIREBASE_API_KEY` is correct
- Make sure there are no extra spaces or quotes in `.env.local`
- Restart your dev server after changing `.env.local`

### Issue: "Missing or insufficient permissions"

**Solution**:
- Check your Firestore security rules
- Make sure the user is authenticated
- Verify the user has the correct `agency_id` and `role` set

### Issue: Storage upload fails

**Solution**:
- Check Storage security rules
- Verify the bucket name matches (`agency-logos`)
- Check file size limits (default is 5MB)

### Issue: Email verification not working

**Solution**:
- Check **Authentication** → **Settings** → **Authorized domains**
- Add your domain to authorized domains
- In development, you can disable email verification temporarily

## 📚 Key Differences from Supabase

### Database
- **Supabase**: PostgreSQL with SQL queries
- **Firebase**: Firestore (NoSQL) with document-based queries

### Authentication
- **Supabase**: Built-in auth with RLS policies
- **Firebase**: Firebase Auth with Firestore security rules

### Storage
- **Supabase**: S3-compatible storage
- **Firebase**: Firebase Storage with security rules

### Real-time
- **Supabase**: Built-in real-time subscriptions
- **Firebase**: Firestore real-time listeners

## 🎯 Next Steps

Once Firebase is set up:

1. ✅ Test user registration and login
2. ✅ Create your first organization
3. ✅ Test file uploads
4. ✅ Set up your production environment variables
5. ✅ Configure custom domain (if needed)
6. ✅ Set up Firebase Hosting (optional)

## 💡 Pro Tips

1. **Use separate projects for dev/staging/prod**: Create different Firebase projects for each environment
2. **Monitor usage**: Keep an eye on your Firestore reads/writes and storage usage in the dashboard
3. **Use Firebase Emulator**: For local development, consider using Firebase Emulator Suite
4. **Enable backups**: Set up automated backups for Firestore
5. **Monitor costs**: Firebase has a generous free tier, but monitor usage as you scale

## 🔐 Security Notes

- **Never commit `.env.local`** to git (it's already in `.gitignore`)
- Firebase API keys are safe to use in client-side code (they're restricted by security rules)
- Always use security rules to protect your data
- Regularly review and update security rules
- Use Firebase App Check for additional security in production

## 📖 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Auth Guide](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Storage Guide](https://firebase.google.com/docs/storage)

---

Need help? Check the [Firebase Community](https://firebase.google.com/support) or [Stack Overflow](https://stackoverflow.com/questions/tagged/firebase).

