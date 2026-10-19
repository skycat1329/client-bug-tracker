# 🚀 Automated GitHub Deployment to Hostinger

Every time you run `git push origin main`, GitHub Actions will **automatically build your React frontend, package the PHP API, and deploy the updated files directly to Hostinger `public_html`**.

No more manual `.zip` uploads, no opening File Manager, and no manual extraction!

---

## 3 Simple Setup Steps

### Step 1: Get Your FTP Credentials from Hostinger (30 Seconds)

1. Log in to **Hostinger hPanel**.
2. Go to **Files** &rarr; **FTP Accounts**.
3. Note down these 3 values:
   - **FTP IP / Host** (e.g. `185.224.138.xxx` or `ftp.yourdomain.com`)
   - **FTP Username** (e.g. `u634780755`)
   - **FTP Password** (if you don't know it, click *Change Password*)

---

### Step 2: Add 3 Secrets to Your GitHub Repository (1 Minute)

1. Open your repository on [GitHub.com](https://github.com).
2. Click **Settings** (top menu of the repository) &rarr; on the left sidebar click **Secrets and variables** &rarr; **Actions**.
3. Click the green **New repository secret** button and add these 3 secrets:

| Secret Name | Value from Hostinger | Example |
| :--- | :--- | :--- |
| `FTP_SERVER` | Your FTP IP or Hostname | `185.224.138.50` |
| `FTP_USERNAME` | Your FTP Username | `u634780755` |
| `FTP_PASSWORD` | Your FTP Account Password | `YourSecureFtpPass123` |

---

### Step 3: Push Your Code to GitHub (30 Seconds)

In your local project terminal, initialize Git (if not already connected) and push:

```bash
git add .
git commit -m "Setup automated Hostinger deployment with Google Sheets sync"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

---

## What Happens Automatically?

1. As soon as you push, open the **Actions** tab on your GitHub repository.
2. You will see the workflow **"Build & Deploy to Hostinger"** running:
   - ✅ Installs dependencies
   - ✅ Compiles React production bundle (`npm run build`)
   - ✅ Bundles PHP API & routes
   - ✅ Syncs files to Hostinger `public_html/` via FTP
3. In ~30–45 seconds, your live Hostinger website updates automatically!

---

## Safe Deployments: What is Protected?

The automated deployer is configured to **protect existing server files**:
* **`uploads/**`** is excluded so user screenshots and bug report attachments are never deleted or overwritten during deployment.
* Only modified or new files are transferred, keeping deployments fast and lightweight.
