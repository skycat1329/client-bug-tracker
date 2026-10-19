# Client Bug Tracker — Customer Portal + Developer Dashboard + Slack Integration

A production-minded, multi-tenant client support ticketing application built for a digital web agency managing websites for multiple brands.

Clients report website defects through a dedicated branded customer portal. Tickets are automatically routed, assigned to internal developers, broadcast to team channels via Slack Incoming Webhooks, and tracked with strict organization data isolation.

---

## 🚀 Key Highlights & Architecture

- **Customer Portal:** Secure brand-isolated bug submission (reproduction steps, browser, device, environment, attachments, P1–P4 severity), unique human-readable ticket references (`WEB-1001`), public support replies, and client resolution verification.
- **Internal Agency & Developer Dashboard:** Overview metrics, priority triage queues, "My Assigned Tickets" view, full ticket lifecycle state machine, one-click claim, assignment routing, private internal notes, root-cause recording, and CSV report export.
- **Strict Privacy & Multi-Tenant Isolation:**
  - Client users can **never** inspect other organizations' tickets or websites.
  - Internal developer notes (`is_internal: true`) are filtered at the database/API query level and never returned to client endpoints.
- **Slack Incoming Webhook Integration:**
  - Dispatches structured Block Kit notifications to dynamic channels (`#client-bug-reports`, `#dev-triage`, `#production-incidents`, `#ticket-resolutions`).
  - Zero credential exposure, 5s timeout, exponential backoff retries, and delivery audit logging.
- **Automated Routing Rules:** Automatically routes tickets by category, website, or severity to designated developers.
- **Zero-Friction Local Execution:** Runs instantly using an embedded SQL runtime (LibSQL / SQLite) or connects seamlessly to Supabase PostgreSQL in production using the included migrations and RLS policies.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend** | Node.js, Express, TypeScript, Zod, JWT, Multer, bcryptjs |
| **Database** | LibSQL / SQLite (zero-config local) & Supabase PostgreSQL (production) |
| **Integrations** | Slack Incoming Webhooks (Block Kit), Email Notification Service (Logger / SMTP / Resend) |
| **Testing** | Vitest, Supertest (100% pass on 15-step end-to-end acceptance suite) |

---

## 📋 Quick Start Guide

### 1. Prerequisites
- Node.js v18+ (tested on Node v24)
- npm v9+

### 2. Installation
From the project root:
```bash
# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Initialize & Seed Database
Initialize the database tables and seed realistic fixtures (2 client brands, 4 websites, 6 user accounts, sample tickets across lifecycle stages, routing rules):
```bash
npm --prefix backend run seed
```

### 4. Run the Full Test Suite
Run the 15-step end-to-end acceptance test suite covering organization isolation, developer assignment, status state machine, internal note privacy, and CSV exports:
```bash
npm --prefix backend run test
```

### 5. Launch the Application
Open two terminals (or use concurrent execution):

**Terminal 1 (Backend API on http://localhost:4000):**
```bash
npm run dev:backend
```

**Terminal 2 (Frontend on http://localhost:5173):**
```bash
npm run dev:frontend
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 👥 Demo User Accounts

All demo accounts use password: `password123`

| Name | Email | Role | Brand / Context |
| :--- | :--- | :--- | :--- |
| **Alice Client** | `client@acme.com` | `client` | Acme Brands Inc. (Client Portal) |
| **Bob Client** | `client@starlight.com` | `client` | Starlight Retail Ltd. (Client Portal) |
| **Alex Developer** | `dev@agency.com` | `developer` | Internal Developer (Checkout specialist) |
| **Elena Engineer** | `dev2@agency.com` | `developer` | Internal Developer (UI/Mobile specialist) |
| **Sarah Support** | `support@agency.com` | `support_manager` | Agency Support Manager |
| **Arthur Admin** | `admin@agency.com` | `super_admin` | Agency Super Admin |

> **Pro Tip:** In the top navigation bar, use the **Demo Role** dropdown to switch between Alice Client, Bob Client, Alex Developer, and Sarah Support with a single click to test different views and access boundaries!

---

## 🔐 Security & Access Control Model

```
                    ┌──────────────────────────┐
                    │ Client Bug Tracker API   │
                    └────────────┬─────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│ Client User (`client`)  │               │ Internal Agency Staff   │
├─────────────────────────┤               ├─────────────────────────┤
│ • Own Organization Only │               │ • All Organizations     │
│ • Public Comments Only  │               │ • Internal Dev Notes    │
│ • No Internal Notes     │               │ • Status Transitions    │
│ • No Dev Assignment     │               │ • Dev Assignment / Claim│
│ • Confirm/Reopen Only   │               │ • CSV Report Exports    │
└─────────────────────────┘               └─────────────────────────┘
```

1. **Client Isolation:** When a client signs in, queries automatically bind `organization_id = req.user.organizationId`. Attempting to read another brand's ticket returns `403 Forbidden`.
2. **Internal Note Privacy:** The comments endpoint checks the user's role. For `client` roles, `WHERE is_internal = 0` is strictly enforced. Internal fields (`root_cause`, `fix_details`) are sanitized before responses are sent.
3. **Private Attachment Authorization:** Downloads require a valid JWT token. If a file is flagged `is_internal`, client download requests are blocked with `403 Forbidden`.

---

## 📦 Supabase PostgreSQL Deployment

To deploy with Supabase PostgreSQL:

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in your Supabase dashboard and execute:
   ```
   supabase/migrations/20261016000001_initial_schema.sql
   ```
3. Copy your project's PostgreSQL connection string:
   ```env
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
4. Set `DATABASE_URL` in `backend/.env`.

---

## 💬 Slack Incoming Webhook Setup

1. Follow the step-by-step instructions in [docs/SLACK_SETUP.md](docs/SLACK_SETUP.md).
2. Set your webhook in `backend/.env`:
   ```env
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   ```
3. Verify connectivity under the **Slack Integration** menu tab using the **Send Test Notification** button.

---

## 📁 Repository Directory Structure

```
├── backend/
│   ├── src/
│   │   ├── config/              # Runtime environment config
│   │   ├── db/                  # LibSQL/SQLite database, atomic sequence generator & seed
│   │   ├── middleware/          # Auth JWT, RBAC, Org Access, Uploads, Error Handler
│   │   ├── modules/             # Auth, Tickets, Comments, Attachments, Routing, Audit
│   │   ├── notifications/       # SlackNotificationService & EmailNotificationService
│   │   ├── types/               # TypeScript domain interfaces
│   │   └── tests/               # 15-step end-to-end acceptance test suite
│   ├── uploads/                 # Secure attachment storage
│   ├── .env.example             # Backend configuration template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                 # API client with token interception
│   │   ├── components/          # Accessible badges, navbar, sidebar
│   │   ├── context/             # AuthContext with instant demo role switcher
│   │   ├── pages/               # Customer Portal, Developer Dashboard, Admin Suite
│   │   └── types/               # Frontend types
│   ├── tailwind.config.js
│   └── package.json
├── supabase/
│   └── migrations/              # Supabase PostgreSQL DDL, Triggers, Sequences, RLS Policies
├── docs/
│   ├── ARCHITECTURE.md          # Full architectural blueprint
│   ├── SLACK_SETUP.md           # Slack Incoming Webhooks & Phase 2 Interactive App Guide
│   ├── FREE_TIER_LIMITS.md      # Verified free-tier limits and hosting constraints
│   └── MANUAL_VERIFICATION_CHECKLIST.md # Step-by-step QA verification checklist
├── .env.example                 # Root environment template
└── package.json                 # Monorepo orchestration scripts
```

---

## 🧪 Automated Test Verification

To run tests:
```bash
npm --prefix backend run test
```

### Verified Acceptance Scenarios (11/11 Passed):
- [x] Steps 1–4: Brand A submits bug report, gets unique ticket reference (`WEB-100X`).
- [x] Step 5: Slack Block Kit payload formatted with priority, status, and dashboard link.
- [x] Steps 6–7: Support manager assigns Developer A, advancing status and recording audit history.
- [x] Step 8: Developer A transitions status to `IN PROGRESS`.
- [x] Steps 9–10: Developer posts internal note; Client cannot view internal note.
- [x] Steps 11–12: Developer posts public reply; Client can view public reply.
- [x] Steps 13–14: Developer resolves ticket with root-cause analysis; Client sees `RESOLVED` status without internal notes.
- [x] Step 15: Cross-organization protection — Brand B user is strictly denied access (403) to Brand A's ticket.
- [x] Client can confirm resolution (`CLOSED`) or reopen persisted bug (`IN PROGRESS`).
- [x] Clients are prohibited from directly assigning developers.
- [x] CSV export endpoint is protected and accessible only to internal staff.
