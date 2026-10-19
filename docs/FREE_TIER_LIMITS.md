# External Services & Free-Tier Limits Audit

Before deploying the Client Bug Tracker to production, review the following verified service limits, cost thresholds, and operational constraints across external providers.

---

## 1. Supabase (Database, Auth, Storage)

| Service | Free Tier Allocation | Constraints & Caveats | Recommended Mitigation |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | 500 MB database space | Tables, indexes, and audit logs share this capacity. | Implement table pruning or archive historical `notification_deliveries` past 90 days. |
| **Supabase Auth** | 50,000 Monthly Active Users (MAU) | Plenty for multi-brand agency clients and staff. | Free tier enforces email rate limits (30 emails/hr for auth emails). |
| **Storage (Attachments)** | 1 GB file storage | Ticket attachments (screenshots, MP4 videos) can consume space rapidly. | Enforce 10MB per-file upload limit (already configured in backend). |
| **Egress Bandwidth** | 2 GB / month | Video downloads count toward egress. | Restrict direct video re-downloads; compress images to WebP on upload. |
| **Project Activity** | Active while in use | **Important:** Inactive free-tier projects pause after 7 days of inactivity. | For 24/7 SLA production uptime, upgrade to Supabase Pro ($25/mo) or use a scheduled ping. |

---

## 2. Slack (Incoming Webhooks & App API)

| Feature | Free Workspace Allocation | Caveats |
| :--- | :--- | :--- |
| **Incoming Webhooks** | Unlimited webhook requests | Rate limited by Slack to approximately **1 request per second per channel**. Bursts are queued. |
| **Message History** | 90 days of searchable history | Messages older than 90 days become hidden in free Slack workspaces. |
| **Custom Integrations** | Max 10 custom integrations | If your workspace already has 10 integrations, you must upgrade to Slack Pro or remove unused apps. |

---

## 3. Email Providers (Resend / SMTP)

| Provider | Free Tier Allocation | Considerations |
| :--- | :--- | :--- |
| **Default `logger` Mode** | Unlimited (Local / Zero Cost) | Logs formatted emails directly to server console and `notification_deliveries` table. Recommended for local development and test automation. |
| **Resend** | 3,000 emails / month (100 / day) | Requires DNS verification (DKIM, SPF) on your agency sending domain. Exceeding 100/day requires Pro plan ($20/mo). |
| **SendGrid** | 100 emails / day | Enforces sender identity verification. |

---

## 4. Hosting & Compute

| Host | Service | Free Tier Caveats |
| :--- | :--- | :--- |
| **Vercel** | Frontend (React/Vite) | Free Hobby tier supports full static hosting and custom domains. |
| **Render** | Backend (Node.js/Express) | Free tier instances sleep after 15 minutes of inactivity; initial wake-up takes ~45 seconds. |
| **Railway** | Backend / PostgreSQL | Provides $5 trial credit; requires credit card for ongoing execution. |
