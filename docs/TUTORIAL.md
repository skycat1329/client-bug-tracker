# Client Bug Tracker — Complete Getting Started Tutorial

Welcome to **BugTracker Pro**! All mock/dummy records have been cleared from your database. You are starting with a clean slate ready for real-world operations.

---

## 🔑 Clean Starter Accounts

Your system includes clean initial agency staff accounts (with 0 mock tickets, 0 mock brands, and 0 dummy data):

| Role | Email | Password | Permissions & Dashboard |
| :--- | :--- | :--- | :--- |
| **Agency Administrator** | `admin@agency.com` | `admin123` | **Super Admin**: Brands, Team, Websites, Routing, Slack & All Tickets |
| **Primary Developer** | `dev@agency.com` | `dev123` | **Developer**: My Assigned Tickets, Triage, Claim, Root Cause & Internal Notes |

*(Both accounts are pre-configured on the login page via quick 1-click credential buttons: **Admin** and **Developer**).*

**Next Ticket Reference:** `WEB-1001`

---

## 🚀 Step-by-Step Onboarding Walkthrough

Follow these 8 steps to set up your agency, onboard your first client brand, and process your first bug report.

---

### Step 1: Launch the System

Start the backend and frontend in separate terminals (or from the project root):

```bash
cd C:\Users\skyma\.gemini\antigravity\scratch\client-bug-tracker

# Terminal 1: Backend API
npm run dev:backend

# Terminal 2: Frontend App
npm run dev:frontend
```

Open your browser to: **[http://localhost:5173](http://localhost:5173)**

Sign in using:
- **Email:** `admin@agency.com`
- **Password:** `admin123`

---

### Step 2: Create Your First Client Brand (Organization)

In the left sidebar, click **Brands & Websites**:

1. Click **+ Add Client Brand**.
2. Enter the name of your client (e.g., `Acme Brands Inc.` or `Nordic Fashion Ltd.`).
3. Click **Create Brand**.

Your new client organization is now registered in the system.

---

### Step 3: Register Managed Websites for that Brand

Still on the **Brands & Websites** page:

1. Click **+ Add Managed Website**.
2. Select your client brand from the dropdown.
3. Enter the website name (e.g., `Acme Online Store`).
4. Enter the live or staging URL (e.g., `https://shop.acme.example.com`).
5. Choose the environment: **Production**, **Staging**, or **Development**.
6. Click **Add Website**.

> You can add multiple websites per brand (e.g., production store, staging site, blog).

---

### Step 4: Configure Automated Developer Routing (Optional)

In the left sidebar, click **Routing Rules**:

1. Click **+ Add Routing Rule**.
2. Name the rule (e.g., `Checkout Defects -> Senior Developer`).
3. Set your trigger condition:
   - Match Category: `Checkout & Payments`
   - Match Priority: `P1 Critical` (or leave as Any Priority)
   - Match Website: Select a specific website or leave as Any Website
4. Select the **Default Assignee** (e.g., `Agency Administrator` or an invited developer).
5. Click **Save Rule**.

Whenever a customer submits a matching bug report, it will automatically be assigned to that developer and advanced to `ASSIGNED` status!

---

### Step 5: Configure Slack Notifications (Optional)

1. Open `backend/.env` in your editor.
2. Paste your Slack incoming webhook URL:
   ```env
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T000.../B000.../XXXXX
   ```
3. Restart the backend: `npm run dev:backend`.
4. In the app sidebar, click **Slack Integration** and click **Send Test Notification**.
5. Check your Slack channel to verify that the Block Kit message arrives.

*(See [docs/SLACK_SETUP.md](SLACK_SETUP.md) for full channel routing documentation).*

---

### Step 6: Client Experience — Reporting a Bug

Now let's test the client perspective:

1. Click **Sign Out** in the top navigation bar.
2. On the login screen, click **Register as a new Client Brand** (or register a member for your existing brand):
   - **Full Name:** `Sarah Client`
   - **Company:** `Acme Brands Inc.`
   - **Email:** `sarah@acme.example.com`
   - **Password:** `client123`
3. Click **Create Client Account & Brand**.
4. You are now inside the **Customer Portal Mode**!
5. Click **Report Bug**:
   - **Affected Website:** Choose your website from the dropdown.
   - **Title:** e.g., `Mobile navigation cart count does not increment on tap`.
   - **Category:** `Checkout & Payments`
   - **Severity:** `P2 — High`
   - **Detailed Description:** Describe the bug clearly.
   - **Attach Screenshot / Recording:** Upload any relevant screenshot.
   - Click **Submit Bug Report**.
6. The client is immediately redirected to ticket **`WEB-1001`**!

> **Security Guarantee:** Clients only see tickets belonging to their own brand. They can never view other brands' tickets or internal agency discussions.

---

### Step 7: Developer Workflow — Triage, Fix, and Internal Notes

1. Sign out and log back in as your agency administrator (`admin@agency.com` / `admin123`).
2. Navigate to **All Tickets** in the sidebar.
3. Click on **`WEB-1001`** to open the Command View:
   - **Claim or Assign:** Click **Claim Ticket For Myself** (or assign to a colleague).
   - **Start Work:** Change status to **IN PROGRESS**.
   - **Add an Internal Note:**
     - Click the tab **🔒 Internal Note (Devs Only • Hidden from Client)**.
     - Type: `Found race condition in localStorage cart state handler. Deploying patch to staging.`
     - Click **Save Internal Note**.
     - Notice the amber badge indicating it is strictly private.
   - **Post a Public Reply:**
     - Click **Public Reply**.
     - Type: `Hi Sarah, we've deployed a fix to your staging site for review.`
     - Click **Send Public Reply**.
   - **Resolve the Bug:**
     - Click **✅ Resolve Defect & Record Root Cause**.
     - Enter Root Cause, Fix Details, and Verification Notes.
     - Click **Confirm & Mark Resolved**.

---

### Step 8: Client Verification & Closing the Ticket

1. Sign back in as the client (`sarah@acme.example.com`).
2. Open ticket **`WEB-1001`**:
   - Notice the prominent green banner: **"Fix Deployed — Verification Needed"**.
   - Notice that the developer's internal note is **completely hidden**; only public replies are visible.
   - If the fix works: click **Confirm Resolved & Close** (ticket status transitions to `CLOSED`).
   - If the issue persists: click **Issue Persists / Reopen** to send it back to `IN PROGRESS` with a reason.

---

## 📊 Summary of CLI & Reset Commands

| Command | Action |
| :--- | :--- |
| `npm run clean` | **Wipe all tickets, brands, comments, and reset to clean Admin** |
| `npm run seed` | Re-inject demo brands (Acme, Starlight) and sample tickets for testing |
| `npm test` | Run the full automated 15-step end-to-end test suite |
| `npm run dev:backend` | Start backend API (`http://localhost:4000`) |
| `npm run dev:frontend` | Start frontend client (`http://localhost:5173`) |
