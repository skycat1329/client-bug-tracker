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
4. [Part 3: Guide for Offer Letters & Salary Slips (Payroll Studio)](#part-3-guide-for-offer-letters--salary-slips-payroll-studio)
   - [Who Can Access Payroll & Documents?](#1-who-can-access-payroll--documents)
   - [How Admins Grant or Revoke Access to Specific Team Members](#2-how-admins-grant-or-revoke-access-to-specific-team-members)
   - [How to Generate an Offer Letter (Full Time, Part Time, Internship)](#3-how-to-generate-an-offer-letter-full-time-part-time-internship)
   - [Customizing Candidate Info, Salary Breakup & Legal Clauses](#4-customizing-candidate-info-salary-breakup--legal-clauses)
   - [Printing & Emailing Offer Letters Directly to Candidates](#5-printing--emailing-offer-letters-directly-to-candidates)
   - [How to Generate a Monthly Pay Slip (Salary Slip)](#6-how-to-generate-a-monthly-pay-slip-salary-slip)
   - [Customizing Attendance, Earnings, Deductions & Net Pay In Words](#7-customizing-attendance-earnings-deductions--net-pay-in-words)
   - [Printing & Emailing Pay Slips Directly to Employees](#8-printing--emailing-pay-slips-directly-to-employees)
   - [Strict Privacy & Zero Mass-Email Guardrail](#9-strict-privacy--zero-mass-email-guardrail)
5. [Part 4: Google Sheets Real-Time Sync & Fixing the HTTP 401 Error](#part-4-google-sheets-real-time-sync--fixing-the-http-401-error)
   - [Why did the HTTP 401 Error happen?](#1-why-did-the-http-401-error-happen)
   - [Step-by-Step: Setting Up the Google Apps Script Web App](#2-step-by-step-setting-up-the-google-apps-script-web-app)
   - [Testing and Verifying Connection in 30 Seconds](#3-testing-and-verifying-connection-in-30-seconds)
6. [Frequently Asked Questions (FAQ) & Troubleshooting](#frequently-asked-questions-faq--troubleshooting)

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

## Part 3: Guide for Offer Letters & Salary Slips (Payroll Studio)

### 1. Who Can Access Payroll & Documents?
- **By Default**: Only **Super Admins** (`super_admin`) and **Support Managers** (`support_manager`) have access to view, create, edit, or email Offer Letters and Pay Slips.
- **Client Brands**: Strictly blocked. Clients cannot access these endpoints or view the payroll menu.
- **Delegated Staff**: Regular staff or developers cannot see this menu unless an Admin explicitly turns on their payroll access switch.

---

### 2. How Admins Grant or Revoke Access to Specific Team Members
If an Admin wants an HR manager, team lead, or specific developer to generate offer letters or salary slips:
1. In the left navigation menu, click **"Team Members"**.
2. Look at the team roster table. You will see a column named **"Payroll & Documents Access"**.
3. Next to the team member's name, you will see a badge and toggle button:
   - If they do NOT have access: Click **"Grant Access"** (turns green: **"Payroll Access Active"**).
   - If they already have access: Click **"Revoke"** (turns gray: **"No Access"**).
4. **Instant Effect**: The moment you click the button, that team member's permissions are updated in real-time. The next time they refresh, **"Payroll & Offer Letters"** appears in their sidebar.

---

### 3. How to Generate an Offer Letter (Full Time, Part Time, Internship)
1. In the sidebar, click **"Payroll & Offer Letters"** (or icon 📝).
2. Ensure the top tab is set to **"Offer Letters"**.
3. Click the blue button **"+ Generate New Offer Letter"**.
4. A clean studio popup will open. Select the **Employment Type**:
   - 🔵 **Full Time**
   - 🟣 **Part Time**
   - 🟢 **Internship**

---

### 4. Customizing Candidate Info, Salary Breakup & Legal Clauses

#### Step A: Fill Candidate Details
- **Candidate Full Name**: e.g. *"Rohan Sharma"*
- **Email Address**: e.g. *"rohan@example.com"*
- **Phone Number**: e.g. *"+91 98765 43210"*
- **Job Title / Designation**: e.g. *"Full Stack Engineer"*
- **Department**: e.g. *"Technology"*
- **Date of Joining**: Choose the calendar start date.
- **Reporting Manager / Supervisor**: e.g. *"Faizan Siddiqui"*
- **Work Location**: e.g. *"Mumbai Head Office / Remote"*
- **Signatory Name & Title**: e.g. *"Faizan Siddiqui, Business Head / Partner"*

#### Step B: Customize Salary & Compensation Breakup
- You will see a clean table with salary components (e.g. Basic Salary, HRA, Special Allowance, PF).
- **Add Component**: Click **"+ Add Component"** to create a new row (e.g. Performance Bonus, Travel Allowance).
- **Edit Any Field**: Type directly into the Component Name, Monthly Amount (₹), or Annual Amount (₹).
- **Delete Any Row**: Click the red trash icon 🗑️ next to any row you want to remove.
- **Total Compensation**: The Monthly Total and Annual Total (CTC) calculate automatically.

#### Step C: Customize Contract Terms & Clauses
The system comes pre-loaded with the **8 official Assurance Media LLP legal clauses**:
1. *Probationary Period* (15 days evaluation)
2. *Working Hours & Professional Conduct*
3. *Confidentiality, Intellectual Property & Non-Disclosure*
4. *Termination & Resignation Notice Period* (60 days)
5. *Offer Acceptance Deadline*
6. *Leave Policy* (15 days paid leave per calendar year)
7. *Medical Leave Policy* (Applicable after 180 continuous days)
8. *Corporate Group Health Insurance* (₹20,00,000 top-tier and ₹5,00,000 baseline)

- **Edit Any Clause**: Simply click inside any clause box and rewrite or tweak the wording to match your requirements.
- **Delete Any Clause**: Click **"Remove Clause"** if a clause does not apply (for instance, removing insurance for part-time/interns).
- **Add Custom Clause**: Click **"+ Add Custom Clause"** at the bottom to insert your own custom requirement (e.g. Non-compete, Equipment return).

---

### 5. Printing & Emailing Offer Letters Directly to Candidates
Once you click **"Save & Generate Offer Letter"**:
- The offer letter is saved with an official reference code (e.g. **`OFF-1001`**).
- **Live Preview / Print**: Click the **Print (🖨️)** or **View Document** button:
  - Opens the official 2-page Assurance Media letterhead document.
  - Formatted with the company address (*302, 3rd Floor, Shivkrupa Bldg, Opp Neelkanth Corporate Park, Vidyavihar West, Mumbai - 400086*).
  - Print dialog opens automatically. Choose **"Save as PDF"** to produce an official high-resolution PDF with your company branding.
- **Send via Email**: Click the blue **"Send via Email"** button:
  - An email is sent **ONLY** to the candidate's email address.
  - It contains a congratulatory note, summary of position, and their private secure link to review and download their offer letter.

---

### 6. How to Generate a Monthly Pay Slip (Salary Slip)
1. Go to **"Payroll & Offer Letters"** and switch to the **"Salary Slips"** tab.
2. Click **"+ Generate Salary Slip"**.
3. **Select Employee**: Pick an existing staff member from the dropdown. Their Employee ID, Designation, Department, and Date of Joining will auto-fill instantly!
4. Or type custom details for any new employee.

---

### 7. Customizing Attendance, Earnings, Deductions & Net Pay In Words

#### Attendance & Bank Metrics:
- **Pay Period**: Select Month (e.g. September) and Year (e.g. 2026).
- **Total Working Days**: e.g. `30`
- **LOP (Loss of Pay) Days**: e.g. `4`
- **Paid Days**: Auto-calculates (`30 - 4 = 26`).
- **Bank Name & Account Number**: e.g. `HDFC Bank` & `XXXX-XXXX-8921`.

#### Dynamic Earnings & Deductions:
- **Earnings Table**:
  - Add or edit rows: Basic Pay, House Rent Allowance (HRA), Conveyance, Special Allowance, Performance Incentive.
  - Click **"+ Add Earning Row"** or the red trash can to delete.
  - Total Earnings recalculates in real-time.
- **Deductions Table**:
  - Add or edit rows: Provident Fund (PF), Professional Tax (PT), Loss of Pay (LOP), TDS / Tax.
  - Click **"+ Add Deduction Row"** or the red trash can to delete.
  - Total Deductions recalculates in real-time.

#### Auto-Calculated Net Pay & Indian Rupees In Words:
- **Net Salary**: Calculated instantly (`Total Earnings - Total Deductions`, e.g. ₹21,667).
- **In Words**: Converted automatically into formal Indian English:
  *"Twenty-One Thousand Six Hundred Sixty-Seven Rupees Only"*.

---

### 8. Printing & Emailing Pay Slips Directly to Employees
- **Print / PDF**: Click **Print (🖨️)** to view the exact 1-page structured salary slip layout. It matches the standard corporate payroll format with company header, employee details grid, earnings/deductions columns, Net Pay highlight, and authorized signatory line.
- **Send via Email**: Click **"Send via Email"**. The employee receives a private email with their salary slip reference (e.g. **`PAY-1001`**) and a secure link to view and print their payslip.

---

### 9. Strict Privacy & Zero Mass-Email Guardrail
- 🛡️ **Zero Unwanted Emails**: The system strictly obeys the rule that **no mass emails or unsolicited notifications are ever sent to existing staff or clients during platform updates or database migrations**.
- 🔒 **Individual Delivery Only**: When you click "Send via Email", an email is dispatched **exclusively to that single individual** (the candidate or the employee). No one else receives an email.

---

## Part 4: Google Sheets Real-Time Sync & Fixing the HTTP 401 Error

### 1. Why did the HTTP 401 Error happen?
If you paste a regular browser link like:
`https://docs.google.com/spreadsheets/d/1XYZ.../edit?usp=sharing`

Google's servers will respond with:
`HTTP 401 Unauthorized / Access Denied`

**Why?** Because a spreadsheet viewer URL is meant for human web browsers logged into Google Accounts. When our server tries to send automated task data via an API request, Google blocks it unless it is connected to a **Google Apps Script Web App**.

---

### 2. Step-by-Step: Setting Up the Google Apps Script Web App
You can create a free Google Webhook receiver in less than 2 minutes:

1. Open your Google Spreadsheet in your web browser.
2. In the top Google Sheets menu, click **Extensions** &rarr; **Apps Script**.
3. Delete any default code in the editor, and paste the following snippet:

```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // Append task details as a new row
    sheet.appendRow([
      new Date(),
      data.task_id || '',
      data.title || '',
      data.assigned_to_name || '',
      data.priority || '',
      data.deadline || '',
      data.status || '',
      data.completion_notes || ''
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Row added to Google Sheet"
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Google Apps Script Webhook is active and ready"
  })).setMimeType(ContentService.MimeType.JSON);
}
```

4. Click the blue **Deploy** button (top right) &rarr; **New deployment**.
5. Click the gear icon ⚙️ next to "Select type" and choose **Web app**.
6. Set the options:
   - **Description**: `Assurance Media Task Sync`
   - **Execute as**: `Me (your Google email)`
   - **Who has access**: `Anyone` *(Crucial: allows the server to send task updates)*
7. Click **Deploy** and grant Google permissions if asked.
8. Copy the **Web app URL**. It will look like:
   `https://script.google.com/macros/s/AKfycb.../exec`

---

### 3. Testing and Verifying Connection in 30 Seconds
1. In the Command Center, go to **"Google Sheets Sync"** in the sidebar.
2. Paste the URL ending in **`/exec`** into the **Webhook URL** field.
3. Click **"Test Connection"**.
4. You will see a green badge: **"✅ Connected Successfully"**.
5. All future tasks, SLA deadlines, and completion records will automatically stream into your Google Sheet!

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

### Q6: Will existing users or team members receive emails when the website or database is updated?
**A**: **Never.** We enforce a strict zero-mass-email guardrail. Database updates and system migrations are 100% silent and never trigger email notifications. Emails are only ever sent when you intentionally click a button (such as assigning a task, or clicking "Send via Email" on an offer letter or payslip to send it directly to that one specific person).

### Q7: Why did Google Sheets say "HTTP 401 Unauthorized" when I tested my sheet link?
**A**: That happens when a browser viewer link (`https://docs.google.com/spreadsheets/d/...`) is pasted instead of a Google Apps Script Web App link. To fix it, follow [Part 4: Google Sheets Real-Time Sync](#part-4-google-sheets-real-time-sync--fixing-the-http-401-error) to deploy an Apps Script Web App and paste the URL ending in `/exec`.

---
*Assurance Media Client Services & Engineering Platform • Made by Akash with ❤️*
