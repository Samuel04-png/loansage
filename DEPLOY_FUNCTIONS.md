# How to Deploy Firebase Functions

## 📋 Prerequisites

1. **Firebase CLI installed**: If not, install it:
   ```bash
   npm install -g firebase-tools
   ```

2. **Logged into Firebase**:
   ```bash
   firebase login
   ```

3. **Project selected**:
   ```bash
   firebase use digital-bible-e3122
   # or your project ID
   ```

## 🔑 Step 1: Set Environment Variables

### Option A: Firebase Functions Config (Recommended)

Set the Stripe secret key:
```bash
firebase functions:config:set stripe.secret_key="sk_live_YOUR_STRIPE_SECRET_KEY_HERE"
```

Set the webhook secret (after creating webhook in Stripe):
```bash
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
```

Set the DeepSeek API key:
```bash
firebase functions:config:set deepseek.api_key="sk-YOUR_DEEPSEEK_API_KEY_HERE"
```

Or using environment variables (Alternative):
- **Name**: `DEEP_SEEK_API_KEY`
- **Value**: `sk-YOUR_DEEPSEEK_API_KEY_HERE`

### Option B: Firebase Functions Environment Variables (Alternative)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Functions** → **Configuration** → **Environment Variables**
4. Add:
   - **Name**: `STRIPE_SECRET_KEY`
   - **Value**: `sk_live_YOUR_STRIPE_SECRET_KEY_HERE`

## 🏗️ Step 2: Build Functions

Navigate to the functions directory and install dependencies:
```bash
cd functions
npm install
```

Build TypeScript:
```bash
npm run build
```

## 🚀 Step 3: Deploy Functions

### Deploy All Functions
```bash
firebase deploy --only functions
```

### Deploy Specific Function
```bash
firebase deploy --only functions:createCheckoutSession
firebase deploy --only functions:stripeWebhook
```

### Deploy from Root Directory
If you're in the root directory:
```bash
firebase deploy --only functions
```

## 📝 Step 4: Verify Deployment

1. Check Firebase Console → Functions to see deployed functions
2. Check function logs:
   ```bash
   firebase functions:log
   ```
3. Test a function:
   - Go to Firebase Console → Functions
   - Click on a function name
   - View the function URL and test it

## 🔍 Troubleshooting

### Error: "No currently active project"
```bash
firebase use digital-bible-e3122
# or
firebase projects:list
firebase use <project-id>
```

### Error: "Node.js version mismatch"
- Check `functions/package.json` - should be `"node": "20"`
- Make sure you're using Node.js 20+

### Error: "Missing dependencies"
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Error: "Permission denied"
```bash
firebase login
# Make sure you're logged in with the correct account
```

### Check Function Status
```bash
firebase functions:list
```

## 📊 Function URLs

After deployment, you'll get URLs like:
- `https://us-central1-digital-bible-e3122.cloudfunctions.net/createCheckoutSession`
- `https://us-central1-digital-bible-e3122.cloudfunctions.net/stripeWebhook`

## 🔄 Update Existing Functions

To update functions after making changes:
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

## 🧪 Local Testing

Test functions locally before deploying:
```bash
cd functions
npm run serve
# Functions will be available at http://localhost:5001
```

## 📚 Available Functions

- `createCheckoutSession` - Creates Stripe checkout sessions
- `stripeWebhook` - Handles Stripe webhook events
- `loanValidation` - Validates loan creation
- `interestAccrual` - Daily interest accrual (scheduled)
- `checkOverdueLoans` - Checks for overdue loans (scheduled)
- `updateLoanStatuses` - Updates loan statuses (scheduled)
- `estimateCollateralValue` - Estimates collateral value
- `calculateCollateralProfit` - Calculates collateral profit
- `sendNotifications` - Sends notifications
- `generateThumbnail` - Generates image thumbnails
- `deepseekProxy` - Proxies DeepSeek API calls (avoids CORS issues)

