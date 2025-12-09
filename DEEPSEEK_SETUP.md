# DeepSeek API Setup Guide

## Overview

The DeepSeek API is now called through a Firebase Cloud Function proxy to avoid CORS issues. The API key is stored securely on the server side.

## 🔑 Setting Up the API Key

### Option 1: Using Firebase Functions Config (Recommended)

```bash
firebase functions:config:set deepseek.api_key="sk-YOUR_DEEPSEEK_API_KEY_HERE"
```

### Option 2: Using Environment Variables

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Functions** → **Configuration** → **Environment Variables**
4. Add:
   - **Name**: `DEEP_SEEK_API_KEY`
   - **Value**: `sk-YOUR_DEEPSEEK_API_KEY_HERE`

### Option 3: Local Development (.env.local)

For local development, add the API key to your `.env.local` file:

```env
DEEP_SEEK_API_KEY=sk-YOUR_DEEPSEEK_API_KEY_HERE
```

Or with the VITE_ prefix (for client-side, though not needed anymore):

```env
VITE_DEEP_SEEK_API_KEY=sk-YOUR_DEEPSEEK_API_KEY_HERE
```

The Cloud Function will automatically load the key from `.env.local` during local development.

## 🚀 Deploying the Function

After setting up the API key, deploy the function:

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions:deepseekProxy
```

Or deploy all functions:

```bash
firebase deploy --only functions
```

## 🧪 Testing

1. Go to Settings → AI Settings in your app
2. Click "Test DeepSeek Connection"
3. You should see a success message if everything is configured correctly

## 🔍 Troubleshooting

### Error: "DeepSeek API key is not configured"

Make sure you've set the API key using one of the methods above, then redeploy the function:

```bash
firebase deploy --only functions:deepseekProxy
```

### Error: "User must be authenticated"

Make sure you're logged in to the app before testing the connection.

### Error: "Network error connecting to DeepSeek API"

- Check your internet connection
- Verify the API key is valid
- Check Firebase Functions logs: `firebase functions:log`

### Local Development Issues

If testing locally with the emulator:

1. Make sure `.env.local` has `DEEP_SEEK_API_KEY` set
2. Start the emulator: `firebase emulators:start --only functions`
3. The function will automatically load the key from `.env.local`

## 📝 Notes

- The API key is now stored on the server, not in the client
- This prevents CORS issues and keeps the API key secure
- The client no longer needs `VITE_DEEP_SEEK_API_KEY` in `.env.local` (though it won't hurt if it's there)

