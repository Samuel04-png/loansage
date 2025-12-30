# PowerShell script to run legacy user migration
# This calls the Cloud Function to migrate existing Starter plan users

Write-Host "Starting Legacy User Migration..." -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is available
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Firebase CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "Install: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

Write-Host "Calling migrateLegacyStarterUsers Cloud Function..." -ForegroundColor Yellow
Write-Host "Mode: graceful (14-day trial from today)" -ForegroundColor Gray
Write-Host ""

# Call the function via Firebase Functions shell
firebase functions:shell --only migrateLegacyStarterUsers

Write-Host ""
Write-Host "Migration complete! Check Firebase Console for results." -ForegroundColor Green

