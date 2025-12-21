# GitHub Authentication Guide

## Current Repository
- Repository: `Samuel04-png/loansage`
- URL: https://github.com/Samuel04-png/loansage.git

## Git Configuration Updated
- Global user name: `Samuel04-png`
- Global user email: `skamanga85@gmail.com`

## How to Authenticate with GitHub

### Option 1: Use GitHub CLI (Recommended)
1. Install GitHub CLI if not already installed:
   ```bash
   winget install GitHub.cli
   ```
   Or download from: https://cli.github.com/

2. Authenticate:
   ```bash
   gh auth login
   ```
   - Select "GitHub.com"
   - Select "HTTPS"
   - Select "Login with a web browser"
   - Copy the one-time code
   - Press Enter to open browser
   - Paste code in browser and authorize

3. Verify authentication:
   ```bash
   gh auth status
   ```

### Option 2: Use Personal Access Token (PAT)
1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
   - URL: https://github.com/settings/tokens

2. Generate a new token:
   - Click "Generate new token" > "Generate new token (classic)"
   - Give it a name like "tengaloans-repo"
   - Select scopes: `repo` (full control of private repositories)
   - Click "Generate token"
   - Copy the token (you won't see it again!)

3. Configure git to use the token:
   ```bash
   git config --global credential.helper wincred
   ```

4. When you push, use your GitHub username and the token as password:
   - Username: `Samuel04-png`
   - Password: `<your-token>`

### Option 3: Use SSH (Most Secure)
1. Generate SSH key (if you don't have one):
   ```bash
   ssh-keygen -t ed25519 -C "skamanga85@gmail.com"
   ```
   - Press Enter to accept default location
   - Enter a passphrase (optional but recommended)

2. Add SSH key to GitHub:
   ```bash
   # Copy public key to clipboard
   type $env:USERPROFILE\.ssh\id_ed25519.pub | clip
   ```
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Paste the key and save

3. Change remote URL to SSH:
   ```bash
   git remote set-url origin git@github.com:Samuel04-png/loansage.git
   ```

4. Test connection:
   ```bash
   ssh -T git@github.com
   ```

## Verify Current Configuration

Check your current git config:
```bash
git config --global --list
```

Check remote repository:
```bash
git remote -v
```

## Next Steps

After authenticating:
1. Make sure your git email is added to your GitHub account
   - Go to: https://github.com/settings/emails
   - Add your email if it's not there
   - Verify it if needed

2. Test by pushing a commit:
   ```bash
   git status
   git add .
   git commit -m "Test commit"
   git push origin main
   ```
