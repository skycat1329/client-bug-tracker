# Hostinger Deployment Guide for Client Bug Tracker

This guide details how to deploy the **Client Bug Tracker** (React + Vite frontend, Express + TypeScript backend, SQLite/LibSQL database) to **Hostinger**.

The application is architected as a **unified production service**: the Express server serves both the REST API (`/api/*`) and the compiled React SPA frontend (`/*`) from a single port (e.g. 4000 or 80/443), eliminating CORS issues and multi-domain configuration overhead.

---

## Which Hostinger Plan Do You Have?

| Hostinger Plan | Recommended Deployment Method | Complexity |
| :--- | :--- | :--- |
| **Hostinger Shared Hosting ("PHP/HTML website")** *(Your Plan)* | **Method 1: PHP + MySQL + HTML (No Upgrade Needed)** | 🟢 Easiest & 100% Free |
| **Hostinger VPS (KVM 1 / 2 / 4)** | **Method 2: Node.js with PM2 + Nginx** or **Docker** | 🟢 Maximum Power |
| **Hostinger Cloud / Business Hosting (hPanel)** | **Method 3: hPanel Node.js Web App Manager** | 🟡 Simple (GUI-based) |

---

## Method 1: Hostinger Shared Hosting (PHP + MySQL + HTML)

If you chose **"PHP/HTML website"** in Hostinger, you can deploy without upgrading your plan or using VPS. We have built a native **PHP REST API** and **MySQL SQL database** that connects directly with the compiled React HTML/CSS frontend.

### Pre-packaged Deployment Zip
We have packaged the entire ready-to-run bundle into:
📁 `hostinger-deploy.zip` (located in the project root)

### Step 1: Create a MySQL Database in Hostinger hPanel
1. In Hostinger hPanel, go to **Databases** &rarr; **MySQL Databases**.
2. Enter:
   - **Database Name**: e.g., `u123456789_tracker`
   - **Username**: e.g., `u123456789_admin`
   - **Password**: *(Create a secure password and remember it)*
3. Click **Create**.

### Step 2: Import the SQL Schema
1. Next to your new database in hPanel, click **Enter phpMyAdmin**.
2. Click the **Import** tab at the top.
3. Choose the `database.sql` file (found inside `hostinger-public_html/database.sql` or inside `hostinger-deploy.zip`).
4. Click **Go** at the bottom.
   *(This creates all 14 tables, indexes, custom roles, triage policy, and the default admin account: `admin@agency.com` / `admin123`).*

### Step 3: Configure Database Credentials in `api/config.php`
Open `api/config.php` (or edit it directly in Hostinger File Manager after uploading) and set your database details:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'u123456789_tracker'); // Your Hostinger DB Name
define('DB_USER', 'u123456789_admin');   // Your Hostinger DB User
define('DB_PASS', 'YourPasswordHere');    // Your Hostinger DB Password
```

### Step 4: Upload to Hostinger File Manager
1. In hPanel, go to **Websites** &rarr; **Dashboard** &rarr; **File Manager**.
2. Open the **`public_html`** folder.
3. Click **Upload** &rarr; select **`hostinger-deploy.zip`**.
4. Right-click `hostinger-deploy.zip` inside File Manager and select **Extract** (extract to `public_html`).
5. Ensure `index.html`, `.htaccess`, `assets/`, `api/`, and `uploads/` are directly inside `public_html`.

### Step 5: That's It!
Visit your domain `https://yourdomain.com`:
- The Salesforce Lightning-styled bug tracker will load instantly.
- Log in with `admin@agency.com` / `admin123`.
- All features (Client bug reporting, triage visibility gate, custom roles, brands, per-brand CSV logs, attachments, Slack notifications) run natively on PHP + MySQL!

---

## Method 1: Hostinger VPS (Recommended)

Hostinger VPS provides full root access on Ubuntu (22.04 or 24.04 LTS), allowing you to run background processes with PM2 or Docker, configure automated restarts, and setup free SSL with Let's Encrypt.

### Step 1: Connect to your Hostinger VPS via SSH
Open your terminal (PowerShell, Command Prompt, or macOS Terminal) and connect using your VPS IP provided in the Hostinger dashboard:

```bash
ssh root@YOUR_SERVER_IP
```

---

### Step 2: Install Node.js 20, NPM, and Git
Run the following commands on your VPS:

```bash
# Update package list
apt update && apt upgrade -y

# Install Git and Curl
apt install -y git curl ufw

# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify versions
node -v   # Should show v20.x.x
npm -v    # Should show 10.x.x

# Install PM2 globally (Process Manager)
npm install -g pm2
```

---

### Step 3: Clone or Upload the Codebase
Navigate to `/var/www` and clone your repository (or upload via SFTP):

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/client-bug-tracker.git
cd client-bug-tracker
```

*(If uploading via FileZilla / WinSCP, upload the project directory to `/var/www/client-bug-tracker`).*

---

### Step 4: Configure Environment Variables
Copy the sample environment file:

```bash
cp .env.example .env
nano .env
```

Adjust the key production settings:
```env
PORT=4000
NODE_ENV=production
APP_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com

DATABASE_URL=file:local.db
JWT_SECRET=generate_a_random_32_character_string_here
JWT_EXPIRES_IN=7d

# Slack Webhook (optional, see docs/SLACK_SETUP.md)
SLACK_WEBHOOK_URL=

# File Storage
UPLOAD_DIR=./uploads
```
Press `Ctrl + O` then `Enter` to save, and `Ctrl + X` to exit `nano`.

Also copy `.env` into the backend directory:
```bash
cp .env backend/.env
```

---

### Step 5: Install Dependencies and Build

```bash
# Install root, backend, and frontend dependencies
npm --prefix backend install
npm --prefix frontend install

# Build both frontend and backend for production
npm run build
```

This compiles:
1. React frontend into `frontend/dist/`
2. Express backend into `backend/dist/`

---

### Step 6: Start with PM2 (Auto-restart on reboot)

Use the included `ecosystem.config.cjs` file to launch the server:

```bash
# Start the application via PM2
pm2 start ecosystem.config.cjs

# Save the PM2 process list
pm2 save

# Enable PM2 to launch on server boot
pm2 startup
```
*(Copy and execute the command that `pm2 startup` displays if prompted).*

Check process status:
```bash
pm2 status
pm2 logs client-bug-tracker
```

You will see:
```text
[Server] Initializing database schema...
[Server] Database is empty. Creating initial agency administrator...
   Default Admin Created: admin@agency.com (Password: admin123)
🚀 Client Bug Tracker API running on http://localhost:4000
```

---

### Step 7: Configure Nginx as Reverse Proxy
Install Nginx:
```bash
apt install -y nginx
```

Create a server configuration file for your domain:
```bash
nano /etc/nginx/sites-available/bug-tracker
```

Paste the following configuration (replace `yourdomain.com` with your real domain or VPS IP):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and test configuration:
```bash
ln -s /etc/nginx/sites-available/bug-tracker /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

---

### Step 8: Install Free SSL Certificate (HTTPS)
Use Certbot to automatically configure Let's Encrypt SSL:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Select the option to automatically redirect HTTP traffic to HTTPS.

---

### Alternative on VPS: One-Command Docker Deployment

If you prefer Docker on your Hostinger VPS:

1. Install Docker & Docker Compose:
   ```bash
   apt install -y docker.io docker-compose
   ```
2. In `/var/www/client-bug-tracker`:
   ```bash
   docker-compose up -d --build
   ```
3. Your app is running on port 4000, persistent SQLite database stored in `./data/`, and uploads in `./uploads/`.

---

## Method 2: Hostinger Cloud / Web Hosting (hPanel Node.js)

Hostinger Business and Cloud hosting plans include a built-in **Node.js selector** in hPanel.

### Step 1: Pre-build Locally or in Git
Ensure you run `npm run build` so that:
- `backend/dist` exists
- `frontend/dist` exists

### Step 2: Upload Files via hPanel File Manager or Git
1. Log in to **Hostinger hPanel**.
2. Go to **Websites** -> Choose your domain -> **File Manager** (or **Git** integration).
3. Upload the project files to your domain directory (e.g. `/home/u123456789/domains/yourdomain.com/public_html` or a subfolder).
   *Make sure `backend/`, `frontend/`, `package.json`, and `.env` are uploaded.*

### Step 3: Setup Node.js in hPanel
1. In hPanel, go to **Advanced** -> **Node.js**.
2. Click **Create Application**.
3. Configure the settings:
   - **Node.js version**: Choose `20.x` or latest LTS.
   - **Application mode**: `Production`
   - **Application root**: Path to your project folder (e.g., `public_html`).
   - **Application URL**: `https://yourdomain.com`
   - **Application startup file**: `backend/dist/server.js`
4. Click **Create**.

### Step 4: Install Dependencies & Run in hPanel
1. Under **NPM Commands** in the hPanel Node.js dashboard:
   - Run `install` (or open the **Terminal / SSH** in hPanel and run `npm --prefix backend install --omit=dev`).
2. Add your environment variables in the hPanel Environment Variables section:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `your_random_secret_string`
   - `DATABASE_URL`: `file:local.db`
3. Click **Restart Application**.

---

## Post-Deployment Verification

1. **Visit your website**: Navigate to `https://yourdomain.com`.
   - The Salesforce Lightning-styled Client Bug Tracker login screen will appear.
2. **Log in as Administrator**:
   - Email: `admin@agency.com`
   - Password: `admin123`
   *(Change this password immediately in your account profile after logging in).*
3. **Verify API Health**:
   - Navigate to `https://yourdomain.com/api/health`.
   - Should return: `{"status":"ok","service":"Client Bug Tracker API"}`.
4. **Create Organizations and Brands**:
   - Head to the Admin panel, add your client brands, websites, and staff members.
   - Per-brand CSV log exports, custom roles, and Slack notifications are immediately ready to use.

---

## Maintenance & Common Commands

| Task | Command / Action |
| :--- | :--- |
| View Live Logs | `pm2 logs client-bug-tracker` |
| Restart Server | `pm2 restart client-bug-tracker` |
| Stop Server | `pm2 stop client-bug-tracker` |
| Backup SQLite Database | `cp local.db local_backup_$(date +%F).db` |
| Update to New Version | `git pull && npm run build && pm2 restart client-bug-tracker` |
