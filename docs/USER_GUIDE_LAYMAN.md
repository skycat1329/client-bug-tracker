# Assurance Media Bug Tracker & Task Management System
## 📖 Complete End-User Guide (Layman's Language Edition)

Welcome to the **Assurance Media Client Bug Tracker & Engineering Command Center**! This guide is written in simple, non-technical, everyday language so that **brand clients**, **website owners**, **engineers**, and **administrators** can easily use the portal on both mobile phones and desktop computers.

---

## 📑 Table of Contents
1. [Overview: What is this system?](#1-overview-what-is-this-system)
2. [Part 1: Guide for Brand Clients (Website Owners)](#part-1-guide-for-brand-clients-website-owners)
   - [How to Log In to your Brand Portal](#1-how-to-log-in-to-your-brand-portal)
   - [How to Report a Website Bug or Issue](#2-how-to-report-a-website-bug-or-issue)
   - [How to Attach Screenshots and View Them in Full Screen (Lightbox)](#3-how-to-attach-screenshots-and-view-them-in-full-screen-lightbox)
   - [Understanding the 8 Stages of Your Ticket](#4-understanding-the-8-stages-of-your-ticket)
   - [Email & WhatsApp Alerts (How You Stay Updated)](#5-email--whatsapp-alerts-how-you-stay-updated)
   - [Testing the Fix & Closing or Reopening the Ticket](#6-testing-the-fix--closing-or-reopening-the-ticket)
   - [Using the Portal on Your Mobile Phone](#7-using-the-portal-on-your-mobile-phone)
3. [Part 2: Guide for Agency Administrators & Engineers](#part-2-guide-for-agency-administrators--engineers)
   - [How to Access the Admin / Staff Command Center](#1-how-to-access-the-admin--staff-command-center)
   - [How to Log In with Two-Factor Authentication (QR Code Scanner)](#2-how-to-log-in-with-two-factor-authentication-qr-code-scanner)
   - [Emergency Break-Glass Recovery Code](#3-emergency-break-glass-recovery-code)
   - [Team Tasks & Deadlines System](#4-team-tasks--deadlines-system)
   - [How an Admin Assigns a Task with an SLA Deadline](#5-how-an-admin-assigns-a-task-with-an-sla-deadline)
   - [How an Engineer Proposes a Task for Admin Approval](#6-how-an-engineer-proposes-a-task-for-admin-approval)
   - [How to Mark Tasks Complete & Synchronize with Google Sheets](#7-how-to-mark-tasks-complete--synchronize-with-google-sheets)
   - [Strict Team Privacy: Why Developers Only See Their Own Tasks](#8-strict-team-privacy-why-developers-only-see-their-own-tasks)
4. [Frequently Asked Questions (FAQ) & Troubleshooting](#frequently-asked-questions-faq--troubleshooting)

---

## 1. Overview: What is this system?

This web portal connects **Brand Clients** (who have websites managed by Assurance Media) directly with the **Engineering Team**.
- **For Brands**: It is an easy place to report issues, attach screenshots, chat with the developers, and receive automatic Email and WhatsApp updates whenever someone works on your site.
- **For Engineers & Admins**: It is a secure command center to triage bugs, assign tasks with strict deadlines, approve team work, and maintain live records in a central Google Spreadsheet.

---

## Part 1: Guide for Brand Clients (Website Owners)

### 1. How to Log In to your Brand Portal
1. Open your browser and go to:
   👉 **`https://lightsteelblue-barracuda-559543.hostingersite.com/`**
2. You will see the clean **Client Brand Portal** login screen.
3. Enter your **registered brand email** and **password**.
4. Click **Sign In to Brand Portal**.
5. *First-time login*: If this is your first time logging in, you will be prompted to create your own new, secure password.

---

### 2. How to Report a Website Bug or Issue
1. Once logged in, click the blue **Report New Bug** button (at the top right on desktop, or in the bottom bar on mobile).
2. Fill out the quick form:
   - **Website**: Choose which of your websites has the problem (e.g. Production Live Site or Staging).
   - **Ticket Title**: A short summary (e.g. *"Checkout button not working on mobile iPhone"*).
   - **Category**: Pick where the issue is (Checkout, Design/UI, Performance, Mobile Responsive, etc.).
   - **Priority**:
     - `P1 (Critical)`: Site is down or payments are broken (Needs 24-hour resolution).
     - `P2 (High)`: Key feature broken (Needs 48-hour resolution).
     - `P3 (Medium)`: Minor glitch or cosmetic problem (Needs 72-hour resolution).
     - `P4 (Low)`: Small tweak or question.
   - **Description**: Describe what happened.
   - **Steps to Reproduce**: Explain how to trigger the bug (e.g. *Step 1: Add item to cart. Step 2: Click Pay. Step 3: Page reloads with blank screen*).
   - **Browser & Device** (Optional): e.g. Safari on iPhone 15, or Chrome on Windows.
3. **Attach Screenshot / Video**: Click the attachment box to upload a screenshot showing the issue.
4. Click **Submit Ticket**. You will instantly get a ticket reference number like **`WEB-1001`**.

---

### 3. How to Attach Screenshots and View Them in Full Screen (Lightbox)
- **Adding Screenshots**: You can attach image files (`PNG`, `JPG`, `WEBP`) or document files when creating a ticket, or by adding a reply in the ticket conversation.
- **Viewing Screenshots (Lightbox)**:
  - Inside any ticket, scroll down to **"Attached Screenshots & Visual Proof"**.
  - You will see clear image thumbnails of all uploaded screenshots.
  - **Click on any image**: It instantly opens in a full-screen **Lightbox Viewer** with zoom and a one-click **Download** button.
  - To close, click the **X** button or anywhere outside the image.

---

### 4. Understanding the 8 Stages of Your Ticket
Every ticket moves through an 8-phase quality process:
1. **NEW** (Phase 1): You just reported the bug. The triage system has received it.
2. **TRIAGED** (Phase 2): Our support lead verified the bug and classified its severity.
3. **ASSIGNED** (Phase 3): A dedicated engineer has been assigned to fix your site.
4. **IN PROGRESS** (Phase 4): The engineer is actively coding and debugging the issue.
5. **WAITING FOR CLIENT** (Phase 5): The engineer needs more information from you (e.g. credentials or details).
6. **FIX READY FOR TESTING** (Phase 6): The code fix has been deployed to the test site. We need you to verify it!
7. **RESOLVED** (Phase 7): Both the engineer and client confirmed the issue is fixed.
8. **CLOSED** (Phase 8): Case complete and safely archived.

---

### 5. Email & WhatsApp Alerts (How You Stay Updated)
You do not need to sit and refresh the website all day.
- **WhatsApp Notification**: Whenever your ticket status changes (e.g., when an engineer is assigned or when the fix is deployed), an instant WhatsApp message is sent to your registered brand phone number.
- **Email Notification**: A detailed email is sent from `tools.assurance@gmail.com` with the engineer's notes and direct link to view the ticket.

---

### 6. Testing the Fix & Closing or Reopening the Ticket
When an engineer finishes coding the fix, your ticket enters **FIX READY FOR TESTING**.
1. Open the ticket and read the **Engineering Fix Notes**.
2. Test the page on your live website.
3. At the top of the ticket, you will see a green action banner with two buttons:
   - **Confirm Resolved & Close**: Click this if the bug is completely gone! The ticket will mark as resolved.
   - **Issue Persists / Reopen**: Click this if the bug is still happening. A popup will ask you what is still wrong, and the ticket will immediately reopen for the engineer to continue working.

---

### 7. Using the Portal on Your Mobile Phone
The portal is fully optimized for smartphones:
- Look at the bottom of your phone screen for the **Quick Bottom Navigation Bar**:
  - 🎫 **My Tickets**: View all your ongoing tickets.
  - ➕ **Report Bug**: Quickly create a new ticket in 30 seconds.
  - ☰ **Menu**: View your account details or log out.

---

## Part 2: Guide for Agency Administrators & Engineers

### 1. How to Access the Admin / Staff Command Center
Staff and engineers have a dedicated secure portal:
👉 **`https://lightsteelblue-barracuda-559543.hostingersite.com/admin`**

*(Note: Regular brand clients cannot access this link. If a client attempts to log in here, they are blocked for security).*

---

### 2. How to Log In with Two-Factor Authentication (QR Code Scanner)
To protect sensitive client credentials and client data, staff accounts require Two-Factor Authentication (2FA):

#### Step 1: Enter Email & Password
- Enter your staff email (e.g. `admin@assurancemedia.com`) and your password.
- Click **Continue to Authenticator**.

#### Step 2: Scan the QR Code on Your Phone
1. Install **Google Authenticator** (or Microsoft Authenticator / Authy) on your smartphone from the App Store or Google Play Store.
2. In Google Authenticator, tap the **+** button at the bottom right.
3. Select **Scan a QR code**.
4. Point your phone camera at the **QR Code** displayed on your computer screen!
5. Google Authenticator will instantly add **"Assurance Media"** and show a 6-digit rolling code (e.g. `482910`).
6. Type that 6-digit code into the screen and click **Verify & Enter Command Center**.

> [!TIP]
> **If you don't have a camera on your device**:
> Click **Copy Key** next to the Base32 setup secret (e.g. `ASSURANCEMEDIA26`) and paste it into your authenticator app under "Enter a setup key".

---

### 3. Emergency Break-Glass Recovery Code
What if your phone battery dies, or you left your phone at home?
- We have provisioned a master emergency break-glass recovery code:
  🔑 **`202626`**
- You can enter `202626` into the 6-digit code box at any time to instantly unlock the Command Center in an emergency.

---

### 4. Team Tasks & Deadlines System
In the left sidebar, click **"Team Tasks & Deadlines"**:
Here you can manage sprint tasks, track real-time SLA countdowns, and synchronize completed work with your agency Google Spreadsheet.

#### KPI Header Cards:
- **Total Tasks**: Total number of tasks currently in the database.
- **My Active Tasks**: Tasks specifically assigned to you.
- **Pending Approval**: Tasks submitted by team members waiting for Admin approval.
- **Overdue SLA**: Tasks that have passed their deadline (highlighted in red).
- **Completed**: Tasks finished and synced to Google Sheets.

---

### 5. How an Admin Assigns a Task with an SLA Deadline
1. Click the blue **"+ Assign New Task"** button at the top right.
2. Fill out the details:
   - **Task Title**: e.g. *"Fix Checkout Mobile CSS on Brand Website"*
   - **Description**: Add PR links, instructions, or testing criteria.
   - **Priority**: Choose P1 (Critical), P2 (High), P3 (Medium), or P4 (Low).
   - **Target Deadline**: Select the exact date and time when this task is due.
   - **Assignee Specialist**: Choose which team member (developer, designer, or QA) should execute this task.
3. Click **"Assign Task & Send Email"**.
4. **What happens automatically**:
   - The task gets a unique number like `TSK-1001`.
   - The assigned engineer receives an **instant email notification** with task details, priority, deadline, and a direct link to open the task.
   - The task is immediately recorded in the **Agency Google Spreadsheet**.

---

### 6. How an Engineer Proposes a Task for Admin Approval
Team members often discover tasks during their workday that need to be done.
1. When a team member clicks **"+ Propose Task for Approval"**:
   - They enter the title, description, priority, and their target deadline.
2. Click **"Submit for Approval"**.
3. The task enters **`PENDING_APPROVAL`** status.
4. **For the Admin**:
   - The task appears in the Admin's **Pending Approval** tab with an orange alert badge.
   - The Admin can click **Approve** (which turns it into an active task, notifies the member, and syncs to Google Sheets) or **Reject** (with a reason explaining what to change).

---

### 7. How to Mark Tasks Complete & Synchronize with Google Sheets
1. When an engineer finishes their task, click the green **"Mark Complete"** button on the task card.
2. A popup will ask for **Completion Notes** (e.g. *"Deployed patch to staging, tested regression suite, PR #24 merged"*).
3. Click **Confirm Completed**.
4. The task status updates to **COMPLETED**, records the completion timestamp, and automatically syncs the deliverable notes to the **Agency Task Google Spreadsheet**.

---

### 8. Strict Team Privacy: Why Developers Only See Their Own Tasks
- **Privacy Rule**: A regular team member can **only view their own assigned tasks or tasks they personally proposed**.
- Developers cannot snoop on tasks assigned to other developers.
- Admins and Managers have global visibility over the entire team.

---

## Frequently Asked Questions (FAQ) & Troubleshooting

### Q1: I am a Brand Client. Why can't I log into `/admin`?
**A**: The `/admin` portal is exclusively reserved for internal agency engineers and administrators. Brand clients should always log in at the main page:
👉 `https://lightsteelblue-barracuda-559543.hostingersite.com/`

### Q2: I entered my admin password, but it asks for an authenticator code. Where do I get it?
**A**: Open the **Google Authenticator** app on your phone to see your 6-digit rolling code. If you do not have your phone with you, type the emergency code **`202626`** to log in immediately.

### Q3: How do I scan the QR code?
**A**: On the login screen, click **"📷 Show QR Code to Scan with Mobile App"**. Open Google Authenticator on your phone, tap **+** &rarr; **Scan a QR code**, and point your phone at the computer screen. It takes less than 2 seconds!

### Q4: Do I need to update the database on Hostinger manually?
**A**: No. The database automatically creates all needed tables (`tasks`, `ticket_counters`, `login_attempts`, etc.) whenever you use the website. No manual SQL imports are needed.

### Q5: Can brand clients see internal developer notes?
**A**: No. When an engineer posts an **"Internal Dev Note"** (marked with a lock 🔒 icon), it is strictly hidden from clients at the database level. Clients only see **"Public Customer Replies"**.

---
*Assurance Media Client Services & Engineering Platform • Made by Akash with ❤️*
