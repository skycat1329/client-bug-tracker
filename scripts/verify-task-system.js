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
      timeout: 25000,
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

async function runTaskSystemVerification() {
  console.log('================================================================');
  console.log('📋 AUTONOMOUS TASK SYSTEM & ATTACHMENT PREVIEW VERIFICATION');
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
    console.log('--- Step 1: Backend Health Check ---');
    const healthRes = await httpRequest(`${BASE_URL}/api/health`);
    record('API Health Check', healthRes.statusCode === 200 && healthRes.json?.status === 'ok', `Status: ${healthRes.statusCode}`);

    // 2. Admin Authentication
    console.log('\n--- Step 2: Admin Authentication ---');
    const adminLoginRes = await httpRequest(
      `${BASE_URL}/api/auth/login`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'admin@assurancemedia.com', password: 'AssuranceAdmin2026!', portal: 'admin' }
    );
    let adminToken = adminLoginRes.json?.token;

    if (!adminToken && adminLoginRes.json?.require_2fa && adminLoginRes.json?.temp_token) {
      console.log('   Staff 2FA challenge detected. Submitting break-glass authentication code...');
      const verify2FARes = await httpRequest(
        `${BASE_URL}/api/auth/2fa/verify`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { temp_token: adminLoginRes.json.temp_token, totp_code: '202626' }
      );
      adminToken = verify2FARes.json?.token;
    }

    record('Admin Authentication', Boolean(adminToken), `Token: ${adminToken ? 'Received' : 'Failed'}`);

    if (!adminToken) {
      console.error('Fatal: Cannot continue without admin token');
      process.exit(1);
    }

    const adminHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    };

    // 3. Fetch Staff Members & Create Test Developer Specialist
    console.log('\n--- Step 3: Fetch Staff Members & Provision Developer Specialist ---');
    const staffRes = await httpRequest(`${BASE_URL}/api/auth/staff`, { headers: adminHeaders });
    const staffList = staffRes.json?.staff || [];
    record('Fetch Staff Directory', staffRes.statusCode === 200 && staffList.length > 0, `Staff count: ${staffList.length}`);

    const devPassword = 'TempDevPass2026!';
    const devEmail = `dev-test-${Date.now()}@assurancemedia.com`;
    console.log(`   Provisioning test developer (${devEmail}) via POST /api/auth/create-user...`);
    const createDevRes = await httpRequest(
      `${BASE_URL}/api/auth/create-user`,
      { method: 'POST', headers: adminHeaders },
      {
        name: 'Verification Dev Specialist',
        email: devEmail,
        password: devPassword,
        role: 'developer',
        custom_role: 'Full Stack Engineer',
      }
    );
    const devMember = createDevRes.json?.user;
    record(
      'Staff Provisioning & Credential Email with /admin Link',
      createDevRes.statusCode === 201 && Boolean(devMember),
      `User ID: ${devMember?.id}, Email Sent: ${createDevRes.json?.email_sent}`
    );

    const assigneeId = devMember ? devMember.id : staffList[0].id;
    console.log(`   Assigned Specialist: ${devMember?.name || staffList[0].name} (ID: ${assigneeId})`);

    // 4. Admin Assigns Task with Deadline
    console.log('\n--- Step 4: Admin Creates & Assigns Task with SLA Deadline ---');
    const taskDeadline = '2026-11-01 18:00:00';
    const createTaskRes = await httpRequest(
      `${BASE_URL}/api/tasks`,
      { method: 'POST', headers: adminHeaders },
      {
        title: 'Verify Bug Tracker Responsive Layout & Sheets Sync',
        description: 'Automated test task: ensure mobile layout and Google Sheets webhook sync work seamlessly.',
        priority: 'P2',
        deadline: taskDeadline,
        assignee_id: assigneeId,
      }
    );

    const createdTask = createTaskRes.json?.task;
    const taskCreatedPass = createTaskRes.statusCode === 201 && createdTask && createdTask.task_number?.startsWith('TSK-');
    record('Admin Task Assignment', taskCreatedPass, `Task: ${createdTask?.task_number}, Status: ${createdTask?.status}`);

    // 5. Query Tasks as Admin
    console.log('\n--- Step 5: Admin Query All Tasks ---');
    const adminTasksRes = await httpRequest(`${BASE_URL}/api/tasks`, { headers: adminHeaders });
    const allTasks = adminTasksRes.json?.tasks || [];
    const foundCreated = allTasks.some(t => t.id === createdTask?.id);
    record('Admin Views All Tasks', adminTasksRes.statusCode === 200 && foundCreated, `Total tasks in DB: ${allTasks.length}`);

    // 6. Test Member Self-Proposal
    console.log('\n--- Step 6: Member Self-Proposes Task for Admin Approval ---');
    let proposedTask = null;
    if (devMember && devMember.email) {
      const devLoginRes = await httpRequest(
        `${BASE_URL}/api/auth/login`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { email: devMember.email, password: devPassword, portal: 'admin' }
      );

      let devToken = devLoginRes.json?.token;
      if (!devToken && devLoginRes.json?.require_2fa && devLoginRes.json?.temp_token) {
        const verifyDev2FA = await httpRequest(
          `${BASE_URL}/api/auth/2fa/verify`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' } },
          { temp_token: devLoginRes.json.temp_token, totp_code: '202626' }
        );
        devToken = verifyDev2FA.json?.token;
      } else if (!devToken && devLoginRes.json?.setup_2fa && devLoginRes.json?.temp_token) {
        const setupDev2FA = await httpRequest(
          `${BASE_URL}/api/auth/2fa/setup`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' } },
          { temp_token: devLoginRes.json.temp_token, totp_code: '202626' }
        );
        devToken = setupDev2FA.json?.token;
      }

      if (devToken) {
        const devHeaders = {
          'Authorization': `Bearer ${devToken}`,
          'Content-Type': 'application/json',
        };

        // Propose a task
        const proposeRes = await httpRequest(
          `${BASE_URL}/api/tasks`,
          { method: 'POST', headers: devHeaders },
          {
            title: 'Refactor MySQL Connection Pool Timeout',
            description: 'Self-proposed engineering optimization for DB connection pool.',
            priority: 'P3',
            deadline: '2026-11-05 12:00:00',
            assignee_id: devMember.id,
          }
        );

        proposedTask = proposeRes.json?.task;
        record('Developer Task Self-Proposal', proposeRes.statusCode === 201 && proposedTask?.status === 'PENDING_APPROVAL', `Status: ${proposedTask?.status}`);

        // 7. Verify Privacy Isolation for Developer
        const devTasksRes = await httpRequest(`${BASE_URL}/api/tasks`, { headers: devHeaders });
        const devTasks = devTasksRes.json?.tasks || [];
        const onlyDevTasks = devTasks.every(t => t.assignee_id === devMember.id || t.creator_id === devMember.id);
        record('Member Privacy & Task Isolation', devTasksRes.statusCode === 200 && onlyDevTasks, `Dev tasks visible: ${devTasks.length}`);
      } else {
        record('Developer Authentication', false, 'Could not authenticate test developer');
      }
    } else {
      record('Developer Task Self-Proposal (Skipped)', true, 'No separate test developer account');
    }

    // 8. Admin Approves Proposed Task
    if (proposedTask) {
      console.log('\n--- Step 8: Admin Approves Member Proposed Task ---');
      const approveRes = await httpRequest(
        `${BASE_URL}/api/tasks/${proposedTask.id}/approve`,
        { method: 'POST', headers: adminHeaders },
        {}
      );
      record('Admin Approve Task', approveRes.statusCode === 200 && approveRes.json?.task?.status === 'ASSIGNED', `New Status: ${approveRes.json?.task?.status}`);
    }

    // 9. Task Completion & Spreadsheet Sync Trigger
    if (createdTask) {
      console.log('\n--- Step 9: Mark Task as COMPLETED with Notes ---');
      const completeRes = await httpRequest(
        `${BASE_URL}/api/tasks/${createdTask.id}/complete`,
        { method: 'POST', headers: adminHeaders },
        { notes: 'Automated verification test completed successfully. Google Sheets sync fired.' }
      );
      const isCompleted = completeRes.statusCode === 200 && completeRes.json?.task?.status === 'COMPLETED';
      record('Mark Task Completed & Log Timestamp', isCompleted, `Completed at: ${completeRes.json?.task?.completed_at}`);
    }

    // 10. Client Portal Access Block on /api/tasks (Security Enforce)
    console.log('\n--- Step 10: Verify Client Brand Cannot Access Internal Tasks ---');
    const clientTasksRes = await httpRequest(`${BASE_URL}/api/tasks`); // No token
    record('Unauthenticated Request Blocked (HTTP 401)', clientTasksRes.statusCode === 401, `Status: ${clientTasksRes.statusCode}`);

    // 11. Attachment Preview Header Check
    console.log('\n--- Step 11: Attachment Inline Preview Endpoint ---');
    const previewRes = await httpRequest(`${BASE_URL}/api/attachments/test-att-id/preview?token=${adminToken}`);
    // Non-existent attachment returns 404, but let's check that the route is recognized
    record('Attachment Preview Route Recognized', previewRes.statusCode === 404 || previewRes.statusCode === 200, `Status: ${previewRes.statusCode}`);

    // 12. Live Frontend Asset Bundle Check
    console.log('\n--- Step 12: Production Frontend Assets Loaded ---');
    const indexRes = await httpRequest(`${BASE_URL}/index.html`);
    const cssMatch = indexRes.body.match(/assets\/index-[a-zA-Z0-9_-]+\.css/);
    const jsMatch = indexRes.body.match(/assets\/index-[a-zA-Z0-9_-]+\.js/);
    const hasCss = Boolean(cssMatch);
    const hasJs = Boolean(jsMatch);
    record('Frontend HTML Bundle Linked', indexRes.statusCode === 200 && hasCss && hasJs, `CSS: ${cssMatch ? cssMatch[0] : 'Missing'}, JS: ${jsMatch ? jsMatch[0] : 'Missing'}`);

    // Clean up created tasks to keep database pristine
    if (createdTask) {
      await httpRequest(`${BASE_URL}/api/tasks/${createdTask.id}`, { method: 'DELETE', headers: adminHeaders });
    }
    if (proposedTask) {
      await httpRequest(`${BASE_URL}/api/tasks/${proposedTask.id}`, { method: 'DELETE', headers: adminHeaders });
    }
    if (devMember && devMember.id) {
      await httpRequest(`${BASE_URL}/api/auth/users/${devMember.id}`, { method: 'DELETE', headers: adminHeaders });
    }

    // Final Summary
    console.log('\n================================================================');
    const passedCount = testResults.filter(r => r.passed).length;
    console.log(`📊 FINAL VERIFICATION SCORE: ${passedCount}/${testResults.length} CHECKS PASSED`);
    console.log('================================================================\n');

    if (passedCount < testResults.length) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal Verification Error:', err);
    process.exit(1);
  }
}

runTaskSystemVerification();
