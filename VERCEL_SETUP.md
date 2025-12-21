# Vercel Setup Instructions

## Fix "No GitHub account matching commit author email" Error

The Vercel deployment is failing because the commit author email doesn't match your GitHub account.

### Solution Options:

#### Option 1: Add Email to GitHub Account (Recommended)
1. Go to GitHub Settings: https://github.com/settings/emails
2. Click "Add email address"
3. Add your git email address (check with: `git config user.email`)
4. Verify the email if required
5. Vercel will now recognize your commits

**Note:** Make sure your git email matches your GitHub account email.

#### Option 2: Configure Git to Use GitHub Email
1. Find your GitHub email in Settings > Emails
2. Configure git locally:
   ```bash
   git config user.email "your-github-email@example.com"
   ```
3. Amend the last commit:
   ```bash
   git commit --amend --reset-author --no-edit
   ```
4. Force push (if needed):
   ```bash
   git push --force-with-lease
   ```

#### Option 3: Configure Vercel to Use Different Email
1. Go to Vercel Dashboard > Settings > Git
2. Configure the commit author email in Vercel settings
3. Or disable the email check in Vercel project settings

### Check Your Current Commit Author Email:
```bash
git config user.email
```

This email should match your GitHub account email for Vercel to work properly.

