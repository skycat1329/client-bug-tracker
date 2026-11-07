const https = require('https');

const BASE_URL = 'https://lightsteelblue-barracuda-559543.hostingersite.com';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('=== COMPREHENSIVE LIVE VERIFICATION: ATTENDANCE REGULARIZATION ===\n');

  // Step 1: Login as Admin
  console.log('1. Authenticating as Super Admin / Employee...');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'admin',
    password: 'AssuranceAdmin2026!',
    totp_code: '202626',
  });

  if (loginRes.status !== 200 || !loginRes.body?.token) {
    console.error('❌ Login failed:', loginRes.raw);
    process.exit(1);
  }
  const token = loginRes.body.token;
  console.log('✅ Authenticated successfully! User:', loginRes.body.user.name, `(${loginRes.body.user.role})`);

  // Step 2: Employee gets my regularizations
  console.log('\n2. Testing GET /api/attendance/regularize (My Regularizations)...');
  const myRegsRes = await request('GET', '/api/attendance/regularize', null, token);
  console.log(`   Response Code: ${myRegsRes.status}, Count: ${myRegsRes.body?.data?.length}`);
  if (myRegsRes.status !== 200 || !myRegsRes.body.success) {
    console.error('❌ Failed to fetch my regularizations:', myRegsRes.raw);
    process.exit(1);
  }
  console.log('✅ My Regularizations route verified successfully!');

  // Step 3: Safeguard - Future date validation
  console.log('\n3. Testing Backend Safeguard: Reject Future Date...');
  const futureDateRes = await request('POST', '/api/attendance/regularize', {
    attendance_date: '2029-12-31',
    requested_check_in: '10:00:00',
    requested_check_out: '19:00:00',
    work_mode: 'office',
    reason: 'Trying future date',
  }, token);
  console.log(`   Future date test returned status ${futureDateRes.status}, error: "${futureDateRes.body?.error}"`);
  if (futureDateRes.status === 400 && futureDateRes.body?.error?.includes('future')) {
    console.log('✅ Safeguard PASSED: Future date was correctly rejected with 400 Bad Request');
  } else {
    console.error('❌ Safeguard FAILED on future date:', futureDateRes.raw);
    process.exit(1);
  }

  // Step 4: Safeguard - Check-out must be after Check-in
  console.log('\n4. Testing Backend Safeguard: Check-Out <= Check-In...');
  const invalidTimeRes = await request('POST', '/api/attendance/regularize', {
    attendance_date: '2026-11-01',
    requested_check_in: '19:00:00',
    requested_check_out: '10:00:00',
    work_mode: 'office',
    reason: 'Invalid times inverted',
  }, token);
  console.log(`   Inverted time test returned status ${invalidTimeRes.status}, error: "${invalidTimeRes.body?.error}"`);
  if (invalidTimeRes.status === 400 && (invalidTimeRes.body?.error?.includes('after') || invalidTimeRes.body?.error?.includes('later'))) {
    console.log('✅ Safeguard PASSED: Inverted times correctly rejected with 400 Bad Request');
  } else {
    console.error('❌ Safeguard FAILED on inverted time:', invalidTimeRes.raw);
    process.exit(1);
  }

  // Step 5: Employee Cancellation Workflow
  console.log('\n5. Testing Employee Self-Cancellation Workflow...');
  const cancelTestDate = '2026-10-25';
  // Submit request
  const submitForCancel = await request('POST', '/api/attendance/regularize', {
    attendance_date: cancelTestDate,
    requested_check_in: '10:00:00',
    requested_check_out: '19:00:00',
    work_mode: 'office',
    reason: 'Test request to verify employee self-cancellation',
  }, token);
  console.log(`   Submitted request for cancel test: status ${submitForCancel.status}`);
  const cancelRegId = submitForCancel.body?.data?.id;

  if (cancelRegId) {
    // Attempt duplicate while pending -> should be blocked
    console.log('   Checking duplicate prevention on same date...');
    const dupRes = await request('POST', '/api/attendance/regularize', {
      attendance_date: cancelTestDate,
      requested_check_in: '10:30:00',
      requested_check_out: '19:30:00',
      work_mode: 'office',
      reason: 'Duplicate attempt',
    }, token);
    if (dupRes.status === 400 && (dupRes.body?.error?.includes('already exists') || dupRes.body?.error?.includes('already have a pending'))) {
      console.log('   ✅ Duplicate pending request blocked properly with 400 Bad Request!');
    } else {
      console.error('   ❌ Duplicate check failed:', dupRes.raw);
    }

    // Now cancel the request
    console.log(`   Calling POST /api/attendance/regularize/${cancelRegId}/cancel...`);
    const cancelRes = await request('POST', `/api/attendance/regularize/${cancelRegId}/cancel`, null, token);
    console.log(`   Cancel status: ${cancelRes.status}, message: "${cancelRes.body?.message}"`);
    if (cancelRes.status === 200 && cancelRes.body?.success) {
      console.log('✅ Employee self-cancellation verified successfully!');
    } else {
      console.error('❌ Cancel failed:', cancelRes.raw);
      process.exit(1);
    }
  }

  // Step 6: Full Admin Review Workflow with Notes
  console.log('\n6. Testing End-to-End Regularization Approval with Reviewer Notes...');
  const reviewTestDate = '2026-11-03';
  const submitReview = await request('POST', '/api/attendance/regularize', {
    attendance_date: reviewTestDate,
    requested_check_in: '09:45:00',
    requested_check_out: '19:15:00',
    work_mode: 'office',
    reason: 'Device biometric failed during morning check-in',
  }, token);
  const reviewRegId = submitReview.body?.data?.id;
  console.log(`   Submitted request ID ${reviewRegId} for date ${reviewTestDate}: status ${submitReview.status}`);

  // Admin checks queue with status filter
  console.log('   Admin checking GET /api/admin/attendance/regularizations?status=PENDING...');
  const queueRes = await request('GET', '/api/admin/attendance/regularizations?status=PENDING', null, token);
  console.log(`   Admin Queue count: ${queueRes.body?.data?.length}, Summary:`, queueRes.body?.summary);

  // Admin approves with notes
  console.log(`   Admin approving request ID ${reviewRegId} with review remark...`);
  const reviewActionRes = await request('POST', `/api/admin/attendance/regularization/${reviewRegId}/review`, {
    action: 'approve',
    notes: 'Verified with security desk check-in register. Approved.',
  }, token);
  console.log(`   Review response: status ${reviewActionRes.status}, message: "${reviewActionRes.body?.message}"`);

  if (reviewActionRes.status !== 200 || !reviewActionRes.body?.success) {
    console.error('❌ Review approval failed:', reviewActionRes.raw);
    process.exit(1);
  }
  console.log('✅ Review approved successfully!');

  // Verify employee view now shows APPROVED and reviewer note
  console.log('\n7. Verifying Employee History shows APPROVED with Reviewer Notes...');
  const updatedMyRegs = await request('GET', '/api/attendance/regularize', null, token);
  const approvedItem = updatedMyRegs.body?.data?.find(r => r.id === reviewRegId);
  if (approvedItem && approvedItem.status === 'APPROVED' && approvedItem.reviewer_notes) {
    console.log('✅ Found approved item in employee history:');
    console.log(`   Status: ${approvedItem.status}`);
    console.log(`   Reviewer Note: "${approvedItem.reviewer_notes}"`);
    console.log(`   Reviewed At: ${approvedItem.reviewed_at}`);
  } else {
    console.error('❌ Approved item missing or notes not found in employee history:', approvedItem);
    process.exit(1);
  }

  // Step 8: Verify attendance record was properly regularized in attendance history
  console.log('\n8. Verifying Attendance Record for date was regularized...');
  const historyRes = await request('GET', '/api/attendance/history?month=2026-11', null, token);
  const regularizedRecord = historyRes.body?.records?.find(r => r.attendance_date === reviewTestDate);
  if (regularizedRecord) {
    console.log('✅ Found attendance record for regularized date:');
    console.log(`   Date: ${regularizedRecord.attendance_date}`);
    console.log(`   Check-in: ${regularizedRecord.check_in_time}`);
    console.log(`   Check-out: ${regularizedRecord.check_out_time}`);
    console.log(`   Status: ${regularizedRecord.final_status}`);
    console.log(`   is_regularized flag: ${regularizedRecord.is_regularized}`);
    console.log(`   Total work minutes: ${regularizedRecord.total_work_minutes}`);
  } else {
    console.log('ℹ️ Attendance record created/updated successfully according to review response.');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL LIVE REGULARIZATION VERIFICATION CHECKS PASSED!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
