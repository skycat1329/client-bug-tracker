# Slack Integration Setup & Architecture Guide

This guide details how to configure the **Slack Incoming Webhook Integration** for the Client Bug Tracker and outlines the Phase-Two roadmap for interactive Slack app capabilities.

---

## 1. Overview of Slack Integration

The Client Bug Tracker provides real-time team notifications dispatched to your Slack workspace when ticket events occur:

| Event | Target Channel | Description |
| :--- | :--- | :--- |
| **New Standard Bug Report** | `#client-bug-reports` | Submitted by client (P2, P3, P4) |
| **P1 Critical Outage** | `#production-incidents` | Business-critical outage or checkout failure |
| **Developer Assignment** | `#dev-triage` | Ticket claimed by developer or assigned by manager |
| **Defect Resolved** | `#ticket-resolutions` | Fix deployed with root-cause analysis |

### Key Security & Reliability Features:
- **Zero Credential Exposure:** Passwords, customer tokens, and private client data are strictly excluded from Slack payloads.
- **Environment Isolation:** Webhook URLs are read only by server-side code from `SLACK_WEBHOOK_URL`. They are never passed to the browser or client bundles.
- **Timeout & Retries:** Webhook requests enforce a 5-second HTTP timeout and up to 3 automated retries with exponential backoff (`300ms`, `600ms`).
- **Delivery Audit Trail:** Every delivery attempt (delivered, mocked, or failed) is permanently logged in the `notification_deliveries` database table.

---

## 2. Step-by-Step Incoming Webhook Configuration

Follow these steps to connect your Slack workspace:

### Step 1: Create a Slack App
1. Go to the [Slack API App Console](https://api.slack.com/apps).
2. Click **Create New App** > **From scratch**.
3. Name your app (e.g. `Agency Bug Tracker`) and select your development workspace.

### Step 2: Enable Incoming Webhooks
1. In the app settings sidebar, click **Incoming Webhooks**.
2. Toggle the switch to **On**.

### Step 3: Add Webhook to Channels
1. Click **Add New Webhook to Workspace** at the bottom of the page.
2. Select your default triage channel (e.g., `#client-bug-reports` or `#dev-triage`).
3. Click **Allow** to grant permissions.

### Step 4: Copy the Webhook URL
Copy the generated Webhook URL. It looks similar to:
```
https://hooks.slack.com/services/YOUR_WORKSPACE_ID/YOUR_BOT_ID/YOUR_TOKEN
```

### Step 5: Configure Backend Environment
Open `backend/.env` (or set in your production environment variables):
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WORKSPACE_ID/YOUR_BOT_ID/YOUR_TOKEN
SLACK_CHANNEL_BUG_REPORTS=#client-bug-reports
SLACK_CHANNEL_DEV_TRIAGE=#dev-triage
SLACK_CHANNEL_INCIDENTS=#production-incidents
SLACK_CHANNEL_RESOLUTIONS=#ticket-resolutions
```

### Step 6: Restart the Backend Server
Restart the Node.js backend:
```bash
npm --prefix backend run dev
```

### Step 7: Verify Connectivity via In-App Health Check
1. Sign in to the Bug Tracker as a manager or admin (`support@agency.com` / `password123`).
2. Navigate to **Slack Integration** in the sidebar.
3. Click **Send Test Notification**.
4. Confirm that the test message appears in your Slack channel and that the delivery status records as `delivered` in the delivery ledger.

---

## 3. Troubleshooting & Error Diagnosis

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Status displays "mocked"** | `SLACK_WEBHOOK_URL` is empty or commented out in `.env` | Add the webhook URL to `backend/.env` and restart the backend. |
| **HTTP 404 `channel_not_found`** | The Slack channel was deleted or archived | Re-authorize the webhook for an active channel in Slack App settings. |
| **HTTP 403 `invalid_token`** | The webhook URL was revoked or belongs to an uninstalled app | Regenerate the incoming webhook in your Slack App console. |
| **Timeout after 5000ms** | Network egress restricted by corporate firewall | Ensure outbound HTTPS port 443 traffic to `hooks.slack.com` is permitted. |

Official Slack Incoming Webhooks Documentation:
https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/

---

## 4. Phase-Two: Interactive Slack App Extension

Incoming webhooks are unidirectional (server to Slack). To support two-way interactive actions directly inside Slack, the following architecture is designed for Phase Two:

```
[ Slack Workspace ]
        │  (Slash command / Button Click)
        ▼
[ POST /api/integrations/slack/actions ]
        │  1. Verify Slack HMAC-SHA256 Signature (Signing Secret)
        │  2. Authenticate Slack user ID against `users.slack_user_id`
        ▼
[ Ticket Domain Service ]
        │  Update ticket status / Assign developer
        ▼
[ Slack Block Kit Response / Thread Update ]
```

### Phase Two Capabilities:
1. **Slash Commands:**
   - `/bug WEB-1001`: Inspect ticket status and reproduction steps.
   - `/claim WEB-1001`: Directly claim unassigned tickets from Slack.
2. **Interactive Block Kit Actions:**
   - "Claim Ticket" and "Start Investigation" buttons embedded directly in `#client-bug-reports` messages.
   - "Mark Resolved" button prompting a Slack modal for root cause notes.
3. **Account Association:**
   - A `slack_user_id` column added to the `users` table allowing Slack users to act on tickets with their backend role permissions.
4. **Security Verification:**
   - Enforce cryptographic verification using `x-slack-signature` and `x-slack-request-timestamp` with the Slack Signing Secret to reject spoofed webhooks.
