import https from 'https';

const BASE_URL = 'https://lightsteelblue-barracuda-559543.hostingersite.com';

function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 30000,
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runPayrollSystemVerification() {
  console.log('================================================================');
  console.log('📑 ASSURANCE MEDIA PAYROLL & DOCUMENT GENERATOR VERIFICATION');
  console.log(`🌐 Target: ${BASE_URL}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const testResults = [];
  function record(testName, passed, details = '') {
    console.log(`   ${passed ? '✅' : '❌'} ${testName} ${details ? `(${details})` : ''}`);
    testResults.push({ testName, passed, details });
  }

  try {
    // 1. Health check
    console.log('--- Step 1: Health & API Connectivity ---');
    const healthRes = await httpRequest(`${BASE_URL}/api/health`);
    record('API Health Check', healthRes.statusCode === 200 && healthRes.json?.status === 'ok', `Status: ${healthRes.statusCode}`);

    // 2. Admin Authentication
    console.log('\n--- Step 2: Admin Authentication with 2FA ---');
    const adminLoginRes = await httpRequest(
      `${BASE_URL}/api/auth/login`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      {
        email: 'admin@assurancemedia.com',
        password: 'AssuranceAdmin2026!',
        totp_code: '202626',
        portal: 'admin',
      }
    );

    const adminToken = adminLoginRes.json?.token;
    record('Super Admin Login with TOTP', !!adminToken, `HTTP ${adminLoginRes.statusCode}`);

    if (!adminToken) {
      throw new Error(`Admin login failed: ${adminLoginRes.body}`);
    }

    // 3. Admin Access to Offer Letters & Pay Slips
    console.log('\n--- Step 3: Admin Default Access to Payroll ---');
    const adminOffersRes = await httpRequest(`${BASE_URL}/api/payroll/offer-letters`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record('Admin Access to /api/payroll/offer-letters', adminOffersRes.statusCode === 200, `HTTP ${adminOffersRes.statusCode}`);

    const adminSlipsRes = await httpRequest(`${BASE_URL}/api/payroll/pay-slips`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record('Admin Access to /api/payroll/pay-slips', adminSlipsRes.statusCode === 200, `HTTP ${adminSlipsRes.statusCode}`);

    // 4. Create a Developer Account to test Granular Role Isolation
    console.log('\n--- Step 4: Granular Staff Permission Isolation ---');
    const testDevEmail = `dev-test-${Date.now()}@assurancemedia.com`;
    const createDevRes = await httpRequest(
      `${BASE_URL}/api/auth/create-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        name: 'Payroll Test Dev',
        email: testDevEmail,
        password: 'DevPassword2026!',
        role: 'developer',
      }
    );

    const testDevId = createDevRes.json?.user?.id;
    record('Create Developer Staff Member', createDevRes.statusCode === 201 && !!testDevId, `ID: ${testDevId}`);

    // Developer logs in
    const devLoginRes = await httpRequest(
      `${BASE_URL}/api/auth/login`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      {
        email: testDevEmail,
        password: 'DevPassword2026!',
        totp_code: '202626',
        portal: 'admin',
      }
    );

    let devToken = devLoginRes.json?.token;
    if (devLoginRes.json?.setup_2fa) {
      const setup2faRes = await httpRequest(
        `${BASE_URL}/api/auth/2fa/setup`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        {
          temp_token: devLoginRes.json.temp_token,
          totp_code: '202626',
        }
      );
      devToken = setup2faRes.json?.token;
    }

    if (devLoginRes.json?.require_2fa) {
      const verify2faRes = await httpRequest(
        `${BASE_URL}/api/auth/2fa/verify`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        {
          temp_token: devLoginRes.json.temp_token,
          totp_code: '202626',
        }
      );
      devToken = verify2faRes.json?.token;
    }

    // Check if initial temporary password reset is required
    const meRes = await httpRequest(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    if (meRes.json?.user?.must_reset_password) {
      const resetRes = await httpRequest(
        `${BASE_URL}/api/auth/force-reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${devToken}`,
          },
        },
        { new_password: 'PermanentDevPass2026!' }
      );
      devToken = resetRes.json?.token || devToken;
    }

    // Check dev WITHOUT permission gets 403 Forbidden
    const devOffersBeforeRes = await httpRequest(`${BASE_URL}/api/payroll/offer-letters`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    record(
      'Developer Denied Payroll Access by Default (403 Forbidden)',
      devOffersBeforeRes.statusCode === 403,
      `HTTP ${devOffersBeforeRes.statusCode}`
    );

    // Admin grants payroll access to this specific developer
    const grantRes = await httpRequest(
      `${BASE_URL}/api/auth/staff/${testDevId}/payroll-access`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { can_manage_payroll: 1 }
    );
    const grantPassed = grantRes.statusCode === 200 && (grantRes.json?.can_manage_payroll === 1 || grantRes.json?.user?.can_manage_payroll === true);
    record('Admin Grants can_manage_payroll = 1', grantPassed, `HTTP ${grantRes.statusCode}`);

    // Developer now accesses payroll -> should succeed 200 OK!
    const devOffersAfterRes = await httpRequest(`${BASE_URL}/api/payroll/offer-letters`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    record(
      'Developer Allowed Payroll Access after Permission Granted (200 OK)',
      devOffersAfterRes.statusCode === 200,
      `HTTP ${devOffersAfterRes.statusCode}`
    );

    // Admin revokes payroll access
    const revokeRes = await httpRequest(
      `${BASE_URL}/api/auth/staff/${testDevId}/payroll-access`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { can_manage_payroll: 0 }
    );
    const revokePassed = revokeRes.statusCode === 200 && (revokeRes.json?.can_manage_payroll === 0 || revokeRes.json?.user?.can_manage_payroll === false);
    record('Admin Revokes can_manage_payroll = 0', revokePassed, `HTTP ${revokeRes.statusCode}`);

    // Developer denied again
    const devOffersRevokedRes = await httpRequest(`${BASE_URL}/api/payroll/offer-letters`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    record(
      'Developer Denied Payroll Access after Revocation (403 Forbidden)',
      devOffersRevokedRes.statusCode === 403,
      `HTTP ${devOffersRevokedRes.statusCode}`
    );

    // 5. Offer Letter Generation & Dynamic Customization
    console.log('\n--- Step 5: Offer Letter Creation & Customization ---');
    const customClauses = [
      {
        id: 'probation',
        title: 'Probation Period',
        content: 'The first 15 days of the Job will be considered a probation period.',
      },
      {
        id: 'hours',
        title: 'Working Hours',
        content: 'Monday to Saturday (Office), 10 AM – 6:30 PM.',
      },
      {
        id: 'custom_tech',
        title: 'Technology Stack & Intellectual Property',
        content: 'All source code, repositories, and architectural assets developed remain exclusive property of Assurance Media LLP.',
      },
    ];

    const salaryBreakup = [
      { item: 'Basic Salary', monthly: 15000, annual: 180000 },
      { item: 'Special Performance Incentive', monthly: 2000, annual: 24000 },
    ];

    const createOfferRes = await httpRequest(
      `${BASE_URL}/api/payroll/offer-letters`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        candidate_name: 'Vanshika Kondar',
        candidate_email: 'vanshika.test@assurancemedia.in',
        candidate_phone: '+91 96965 84985',
        candidate_address: '204/Priya Arcade, Plot no 28, Sector 2A, Karanjade, Panvel - 410206',
        employment_type: 'full_time',
        position: 'Web Developer',
        department: 'Tech',
        reporting_to: 'Management Team / Director',
        joining_date: '2026-09-29',
        work_location: '3rd Floor, 302, SHIV KRUPA CHS LTD, near Railway Station, Kirol Village, Vidyavihar West, Mumbai, M.H 400086',
        laptop_required: 1,
        work_mode: 'On Site',
        working_days: 'Monday to Saturday (Office)',
        working_hours: '10 AM – 6:30 PM',
        monthly_salary: 17000,
        annual_ctc: 204000,
        payment_cycle: 'Monthly (13th of Every Month)',
        salary_breakup: salaryBreakup,
        clauses: customClauses,
        signatory_name: 'Mr. Faizan Siddiqui',
        signatory_title: 'Business Head',
      }
    );

    const createdOffer = createOfferRes.json?.offer_letter;
    record(
      'Create Customizable Offer Letter (Vanshika Kondar)',
      createOfferRes.statusCode === 201 && createdOffer?.offer_number?.startsWith('OFF-'),
      `Offer #: ${createdOffer?.offer_number}`
    );

    // Verify public printable web page for Offer Letter
    const offerViewRes = await httpRequest(`${BASE_URL}/api/payroll/view/offer/${createdOffer?.view_token}`);
    record(
      'Public Printable Offer Letter HTML View',
      offerViewRes.statusCode === 200 && offerViewRes.body.includes('Vanshika Kondar') && offerViewRes.body.includes('Assurance Media LLP'),
      `Contains branding & candidate details`
    );

    // Test on-demand email dispatch for Offer Letter
    const sendOfferEmailRes = await httpRequest(
      `${BASE_URL}/api/payroll/offer-letters/${createdOffer?.id}/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {}
    );
    record(
      'On-Demand Offer Letter Email Dispatch (Candidate Only)',
      sendOfferEmailRes.statusCode === 200 && sendOfferEmailRes.json?.success === true,
      `Sent to: ${sendOfferEmailRes.json?.sent_to}`
    );

    // 6. Salary Slip Generation & Calculation
    console.log('\n--- Step 6: Salary Slip Creation & Auto Net Pay / Number-to-Words ---');
    const createSlipRes = await httpRequest(
      `${BASE_URL}/api/payroll/pay-slips`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        employee_name: 'Akash Mahendra Maurya',
        employee_id: 'AM050926',
        employee_email: 'akash.test@assurancemedia.in',
        designation: 'Web Developer',
        department: 'Tech',
        date_of_joining: '2026-09-05',
        month: 'September',
        year: 2026,
        total_working_days: 30,
        lop_days: 4,
        paid_days: 26,
        bank_name: 'HDFC BANK',
        bank_account_no: '50100898870968',
        earnings: [
          { label: 'Basic Salary', amount: 25000 },
          { label: 'Travel Allowances', amount: 0 },
          { label: 'Incentive', amount: 0 },
        ],
        deductions: [
          { label: 'LOP Deduction', amount: 3333 },
          { label: 'Professional Tax (PT)', amount: 0 },
        ],
      }
    );

    const createdSlip = createSlipRes.json?.pay_slip;
    const netPayMatch = Math.round(createdSlip?.net_pay || 0) === 21667;
    const wordsHasTwentyOneThousand = (createdSlip?.net_pay_words || '').toLowerCase().includes('twenty-one thousand');

    record(
      'Create Salary Slip (Akash Mahendra Maurya - September 2026)',
      createSlipRes.statusCode === 201 && createdSlip?.slip_number?.startsWith('PAY-'),
      `Slip #: ${createdSlip?.slip_number}`
    );

    record(
      'Net Pay Calculation (25000 - 3333 = 21667)',
      netPayMatch,
      `Calculated: ₹${createdSlip?.net_pay}`
    );

    record(
      'Number-to-Words In Indian Rupees (Twenty-one Thousand Six Hundred & Sixty-Seven)',
      wordsHasTwentyOneThousand,
      `Words: "${createdSlip?.net_pay_words}"`
    );

    // Verify public printable web page for Salary Slip
    const slipViewRes = await httpRequest(`${BASE_URL}/api/payroll/view/payslip/${createdSlip?.view_token}`);
    record(
      'Public Printable Salary Slip HTML View',
      slipViewRes.statusCode === 200 && slipViewRes.body.includes('Akash Mahendra Maurya') && slipViewRes.body.includes('21,667'),
      `Contains employee table & Net Pay`
    );

    // Test on-demand email dispatch for Salary Slip
    const sendSlipEmailRes = await httpRequest(
      `${BASE_URL}/api/payroll/pay-slips/${createdSlip?.id}/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {}
    );
    record(
      'On-Demand Salary Slip Email Dispatch (Employee Only)',
      sendSlipEmailRes.statusCode === 200 && sendSlipEmailRes.json?.success === true,
      `Sent to: ${sendSlipEmailRes.json?.sent_to}`
    );

    // Clean up test staff user
    if (testDevId) {
      await httpRequest(`${BASE_URL}/api/auth/staff/${testDevId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }

    console.log('\n================================================================');
    const passedCount = testResults.filter((r) => r.passed).length;
    console.log(`📊 FINAL RESULT: ${passedCount}/${testResults.length} CHECKS PASSED`);
    console.log('================================================================');

    if (passedCount !== testResults.length) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runPayrollSystemVerification();
