# Supabase Setup Guide for TengaLoans

This guide will walk you through setting up Supabase for your TengaLoans project.

## ⚡ Quick Start Checklist

- [ ] Create Supabase account and project
- [ ] Get your Project URL and anon key
- [ ] Create `.env.local` file with credentials
- [ ] Run database migrations (3 SQL files)
- [ ] Create `agency-logos` storage bucket
- [ ] Configure authentication redirect URLs
- [ ] Test sign-up and login

**Estimated time**: 15-20 minutes

---

## 📋 Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com) - free tier available)
- Node.js 18+ installed
- Basic understanding of databases

## 🎯 What Supabase Features Are Used?

Your TengaLoans project uses the following Supabase services:

1. **🔐 Authentication (Supabase Auth)**
   - User registration and login
   - Email verification
   - Password reset
   - Session management
   - Role-based access control

2. **💾 Database (PostgreSQL)**
   - 13+ tables for loans, customers, employees, etc.
   - Row Level Security (RLS) for multi-tenant data isolation
   - Database functions and triggers
   - Full-text search capabilities

3. **📦 Storage**
   - `agency-logos` bucket for organization logos
   - File uploads with public URLs
   - Secure file access policies

4. **⚡ Realtime (Future)**
   - Real-time notifications
   - Live messaging
   - Live data updates

All of these are included in Supabase's free tier, which is perfect for getting started!

## 🚀 Step-by-Step Setup

### Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Fill in the details:
   - **Name**: `tengaloans` (or your preferred name)
   - **Database Password**: Choose a strong password (save it securely!)
   - **Region**: Choose the closest region to your users
   - **Pricing Plan**: Free tier is fine to start
4. Click **"Create new project"**
5. Wait 2-3 minutes for your project to be provisioned

### Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** (gear icon) → **API**
2. You'll find two important values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (a long JWT token)

### Step 3: Configure Environment Variables

1. Create a `.env.local` file in your project root (or copy from `.env.example` if it exists):
   ```bash
   # On Windows (PowerShell)
   New-Item -Path .env.local -ItemType File
   
   # On Mac/Linux
   touch .env.local
   ```

2. Add the following content to `.env.local` and replace the placeholder values:
   ```env
   # Supabase Configuration
   # Get these values from your Supabase project dashboard: https://app.supabase.com
   VITE_SUPABASE_URL=https://your-actual-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
   
   # Google Gemini API (for AI underwriting - optional)
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

   **Important**: 
   - Replace `your-actual-project-ref` with your actual Project URL (from Step 2)
   - Replace `your-actual-anon-key-here` with your actual anon key (from Step 2)
   - The `GEMINI_API_KEY` is optional if you're not using AI features yet
   - **No quotes needed** around the values
   - **No spaces** around the `=` sign
   - Restart your dev server after creating/updating `.env.local`

### Step 4: Set Up the Database Schema

Your project includes migration files that will create all the necessary tables, policies, and functions.

#### Option A: Using Supabase Dashboard (Recommended for beginners)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Open each migration file in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_functions_and_triggers.sql`
4. Copy the entire contents of each file
5. Paste into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)
7. Repeat for each migration file in order

#### Option B: Using Supabase CLI (Advanced)

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Step 5: Set Up Storage Buckets

Your app needs a storage bucket for agency logos:

1. In Supabase dashboard, go to **Storage** (left sidebar)
2. Click **"New bucket"**
3. Configure:
   - **Name**: `agency-logos`
   - **Public bucket**: ✅ **Enable** (check this box)
   - **File size limit**: 5 MB (or your preference)
   - **Allowed MIME types**: `image/*` (or leave empty for all)
4. Click **"Create bucket"**

5. Set up bucket policies (for public access):
   - Click on the `agency-logos` bucket
   - Go to **Policies** tab
   - Click **"New policy"**
   - Select **"For full customization"**
   - Use this policy:

```sql
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'agency-logos');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'agency-logos' 
  AND auth.role() = 'authenticated'
);

-- Allow users to update their own uploads
CREATE POLICY "Users can update own uploads" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'agency-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Step 6: Configure Authentication Settings

1. In Supabase dashboard, go to **Authentication** → **Settings**
2. Configure the following:

   **Site URL**: 
   - Development: `http://localhost:5173` (or your Vite dev port)
   - Production: Your production domain

   **Redirect URLs**: Add:
   - `http://localhost:5173/**`
   - `http://localhost:5173/auth/callback`
   - Your production URLs when ready

   **Email Templates**: (Optional - customize as needed)
   - You can customize the email templates for:
     - Email confirmation
     - Password reset
     - Magic link

3. **Email Auth**: Make sure it's enabled (should be by default)

### Step 7: Test Your Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Try signing up:
   - Navigate to the sign-up page
   - Create a test account
   - Check your email for verification (if email confirmation is enabled)

3. Check the Supabase dashboard:
   - **Authentication** → **Users**: Should see your new user
   - **Table Editor** → **users**: Should see a corresponding record

## 🔍 Verifying Your Setup

### Check Database Tables

1. Go to **Table Editor** in Supabase dashboard
2. You should see these tables:
   - `agencies`
   - `users`
   - `employees`
   - `customers`
   - `loans`
   - `loan_repayments`
   - `collateral`
   - `documents`
   - `invitations`
   - `notifications`
   - `messages`
   - `tasks`
   - `audit_logs`

### Check Row Level Security (RLS)

1. Go to **Authentication** → **Policies**
2. Each table should have RLS enabled with appropriate policies

### Test Storage

1. Try uploading a logo in the "Create Organization" page
2. Check **Storage** → **agency-logos** bucket
3. The file should appear there

## 🛠️ Troubleshooting

### Issue: "Failed to fetch" errors

**Solution**: 
- Check that your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Make sure there are no extra spaces or quotes in `.env.local`
- Restart your dev server after changing `.env.local`

### Issue: "Row Level Security policy violation"

**Solution**:
- Make sure you ran all migration files in order
- Check that RLS policies are created correctly
- Verify your user has the correct `agency_id` set

### Issue: Storage upload fails

**Solution**:
- Verify the `agency-logos` bucket exists and is public
- Check bucket policies allow uploads
- Verify file size is within limits

### Issue: Email verification not working

**Solution**:
- Check **Authentication** → **Settings** → **Site URL** is correct
- Verify redirect URLs include your callback URL
- Check spam folder
- In development, you can disable email confirmation temporarily in Auth settings

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)

## 🎯 Next Steps

Once Supabase is set up:

1. ✅ Test user registration and login
2. ✅ Create your first organization
3. ✅ Test file uploads
4. ✅ Set up your production environment variables
5. ✅ Configure custom domain (if needed)

## 💡 Pro Tips

1. **Use separate projects for dev/staging/prod**: Create different Supabase projects for each environment
2. **Backup your database**: Use Supabase's backup feature regularly
3. **Monitor usage**: Keep an eye on your database size and API calls in the dashboard
4. **Use Supabase Studio**: The built-in SQL editor and table editor are great for debugging
5. **Enable database backups**: In project settings, enable automatic backups

## 🔐 Security Notes

- **Never commit `.env.local`** to git (it's already in `.gitignore`)
- The `anon` key is safe to use in client-side code (it's restricted by RLS)
- For server-side operations, use the `service_role` key (keep this secret!)
- Always use HTTPS in production
- Regularly review and update RLS policies

---

Need help? Check the [Supabase Discord](https://discord.supabase.com) or [GitHub Discussions](https://github.com/supabase/supabase/discussions).

