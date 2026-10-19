# Manual Verification Checklist & Acceptance Runbook

Follow this checklist to manually verify all features, roles, multi-tenant isolation boundaries, and notification mechanisms across the application.

---

## 1. Demo Credentials Matrix

All accounts use the standard password: `password123`

| User | Email | Role | Scope |
| :--- | :--- | :--- | :--- |
| **Alice Client** | `client@acme.com` | `client` | Brand A (Acme Brands Inc.) |
| **Bob Client** | `client@starlight.com` | `client` | Brand B (Starlight Retail Ltd.) |
| **Alex Developer** | `dev@agency.com` | `developer` | Agency Dev (Assigned to Acme checkout) |
| **Elena Engineer** | `dev2@agency.com` | `developer` | Agency Dev (Assigned to Starlight) |
| **Sarah Support** | `support@agency.com` | `support_manager` | Agency Manager (Triage & Rules) |
| **Arthur Admin** | `admin@agency.com` | `super_admin` | Agency Super Admin (Full Access) |

---

## 2. End-to-End Acceptance Scenario Checklist

- [ ] **Step 1: Sign In as Brand A Client**
  - Navigate to `http://localhost:5173`.
  - Use the one-click demo pill for **Alice (Acme Brand)** or sign in with `client@acme.com` / `password123`.
  - Verify that only Acme Brands tickets (`WEB-1001`, `WEB-1002`) appear in the table.
  - Verify that Starlight tickets (`WEB-1003`, `WEB-1004`) are **NOT visible**.

- [ ] **Step 2: Submit a New Bug Report**
  - Click **Report Bug**.
  - Select an Acme website (`Acme Main Store` or `Acme Staging Portal`).
  - Notice that Starlight websites do NOT appear in the dropdown.
  - Enter bug title, detailed description, steps to reproduce, and select **P1 — Critical**.
  - Attach an image or test screenshot and click **Submit Bug Report**.

- [ ] **Step 3 & 4: Unique Ticket Generation**
  - Verify that the app generates a unique human-readable ticket ID matching `WEB-XXXX` (e.g. `WEB-1005`).
  - Verify that the ticket detail page opens automatically displaying the ticket reference.

- [ ] **Step 5: Verify Slack Notification (Simulated or Live)**
  - If `SLACK_WEBHOOK_URL` is set, check the `#production-incidents` channel for the structured Block Kit message.
  - If in mock mode, check terminal logs or the `notification_deliveries` table for the delivery event.

- [ ] **Step 6 & 7: Support Manager Assigns Developer**
  - Use the top-right **Demo Role** dropdown to switch to **Sarah Support** (`support@agency.com`).
  - Open the newly created ticket.
  - Under **Developer Assignment**, select **Alex Developer** and save.
  - Verify status updates to **ASSIGNED** and activity logs record the assignment.

- [ ] **Step 8: Developer Starts Work**
  - Switch role to **Alex Developer** (`dev@agency.com`).
  - Click **My Assigned Tickets** in the sidebar. Verify the ticket appears.
  - Open the ticket and change status to **IN PROGRESS**.

- [ ] **Step 9 & 10: Private Internal Developer Note Verification**
  - On the ticket detail page, click the tab **🔒 Internal Note (Devs Only • Hidden from Client)**.
  - Enter: `INTERNAL NOTE: Isolated bug to rate limit timeout on Redis session cluster`.
  - Click **Save Internal Note**.
  - Verify that the note renders with an amber `INTERNAL DEV NOTE` badge.
  - **Critical Test:** Switch back to **Alice Client** (`client@acme.com`).
  - Open the ticket as the client.
  - **Verify:** The internal note is **COMPLETELY ABSENT** from the client view.

- [ ] **Step 11 & 12: Public Developer Reply Verification**
  - Switch back to **Alex Developer**.
  - Click the **Public Reply (Visible to Client & Emailed)** tab.
  - Enter: `Hi Alice, our infrastructure team has deployed the session fix to staging.`
  - Click **Send Public Reply**.
  - Switch to **Alice Client**.
  - **Verify:** The client **CAN** view the public update message.

- [ ] **Step 13 & 14: Defect Resolution with Root Cause Notes**
  - Switch to **Alex Developer**.
  - Select status **RESOLVED**.
  - In the modal, provide Root Cause, Fix Details, and Verification Notes. Click **Confirm & Mark Resolved**.
  - Switch back to **Alice Client**.
  - Verify the green banner appears: **"Fix Deployed — Verification Needed"**.
  - Click **Confirm Resolved & Close** (transitions status to **CLOSED**).
  - Verify that clicking **Issue Persists / Reopen** transitions status back to **IN PROGRESS**.

- [ ] **Step 15: Cross-Organization Security Protection**
  - While logged in as **Bob Client (Starlight)** (`client@starlight.com`), try to navigate directly to Acme's ticket URL.
  - Verify that access is strictly **DENIED** with a `403 Forbidden` error banner.

---

## 3. Agency Admin Suite Verification

- [ ] **CSV Export:**
  - Log in as **Arthur Admin** or **Sarah Support**.
  - Navigate to **All Tickets** and click **Export CSV**.
  - Confirm the downloaded file contains complete ticket headers and metadata.

- [ ] **Brands & Websites Management:**
  - Navigate to **Brands & Websites**.
  - Add a new brand (e.g., `Solaris Media`).
  - Add a website under the new brand.
  - Verify it appears in routing rules and ticket submission.

- [ ] **Slack Connectivity Health Check:**
  - Navigate to **Slack Integration**.
  - Click **Send Test Notification**.
  - Check the delivery status in the recent deliveries table.
