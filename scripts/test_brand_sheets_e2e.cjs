const BASE_URL = 'https://lightsteelblue-barracuda-559543.hostingersite.com';

async function main() {
  console.log('================================================================');
  console.log('📊 BRAND WORK SHEETS COLLABORATION E2E TEST (PRODUCTION)');
  console.log(`🌐 Target: ${BASE_URL}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const testResults = [];
  function record(testName, passed, details = '') {
    console.log(`   ${passed ? '✅' : '❌'} ${testName} ${details ? `(${details})` : ''}`);
    testResults.push({ testName, passed, details });
  }

  // Step 1: Admin Login
  console.log('--- Step 1: Super Admin Authentication ---');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin',
      password: 'AssuranceAdmin2026!',
      totp_code: '202626'
    })
  });
  const loginData = await loginRes.json();
  const adminToken = loginData.token;
  record('Admin Authentication', Boolean(adminToken), `User: ${loginData.user?.name}, Role: ${loginData.user?.role}`);

  if (!adminToken) {
    console.error('Fatal: Cannot continue without admin token');
    process.exit(1);
  }
  const adminHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  // Step 2: Fetch Organizations & Staff
  console.log('\n--- Step 2: Fetch Brands and Staff Directory ---');
  const orgsRes = await fetch(`${BASE_URL}/api/organizations`, { headers: adminHeaders });
  const orgsData = await orgsRes.json();
  const orgList = orgsData.organizations || [];
  record('Fetch Organizations', orgsRes.status === 200 && orgList.length > 0, `Count: ${orgList.length}`);
  const targetOrg = orgList[0];
  console.log(`   Selected Test Brand: ${targetOrg.name} (ID: ${targetOrg.id}, Code: ${targetOrg.code || 'N/A'})`);

  const staffRes = await fetch(`${BASE_URL}/api/auth/staff`, { headers: adminHeaders });
  const staffData = await staffRes.json();
  const staffList = staffData.staff || [];
  record('Fetch Staff Directory', staffRes.status === 200 && staffList.length > 0, `Count: ${staffList.length}`);
  const assignedDev = staffList.find(s => s.role === 'developer') || staffList[0];
  console.log(`   Selected Staff Member: ${assignedDev.name} (ID: ${assignedDev.id}, Role: ${assignedDev.role})`);

  // Step 3: Fetch Brand Sheets Brands list
  console.log('\n--- Step 3: Fetch Brand Sheets Brand Switcher Data ---');
  const brandsRes = await fetch(`${BASE_URL}/api/brand-sheets/brands`, { headers: adminHeaders });
  const brandsData = await brandsRes.json();
  record('GET /api/brand-sheets/brands', brandsRes.status === 200 && Array.isArray(brandsData.brands), `Active Brands: ${brandsData.brands?.length}`);

  // Step 4: Create a Brand Sheet Item as Staff
  console.log('\n--- Step 4: Create Work Item in Brand Sheet as Staff ---');
  const uniqueTitle = `Performance Optimization & CDN Setup - ${Date.now()}`;
  const createItemRes = await fetch(`${BASE_URL}/api/brand-sheets`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      organization_id: targetOrg.id,
      title: uniqueTitle,
      description: 'Audit mobile Core Web Vitals, implement WebP conversions and edge caching rules.',
      category: 'DEVELOPMENT',
      priority: 'P2',
      target_url: 'https://staging.example.com',
      due_date: '2026-11-20'
    })
  });
  const createItemData = await createItemRes.json();
  const createdItem = createItemData.data;
  record(
    'POST /api/brand-sheets (Create Work Item)',
    createItemRes.status === 201 && Boolean(createdItem?.id),
    `Item Code: ${createdItem?.item_code}, Status: ${createdItem?.status}`
  );

  // Step 5: Query Brand Sheet Items with metrics
  console.log('\n--- Step 5: Query Brand Work Sheet Items & Metrics ---');
  const listRes = await fetch(`${BASE_URL}/api/brand-sheets?organization_id=${targetOrg.id}`, { headers: adminHeaders });
  const listData = await listRes.json();
  const foundItem = listData.items?.find(it => it.id === createdItem.id);
  record(
    'GET /api/brand-sheets (Brand Items & KPIs)',
    listRes.status === 200 && Boolean(foundItem) && Boolean(listData.summary),
    `Total: ${listData.summary?.total}, Pending: ${listData.summary?.pending}`
  );

  // Step 6: Staff edits Item (Assign specialist, update status to IN_PROGRESS, add team remarks)
  console.log('\n--- Step 6: Team Staff Inline Edit (Status, Assignee, Team Remarks) ---');
  const updateRemarks = `Developer assigned (${assignedDev.name}). Began audit of asset bundles and cache TTL.`;
  const updateRes = await fetch(`${BASE_URL}/api/brand-sheets/${createdItem.id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      status: 'IN_PROGRESS',
      assigned_to_user_id: assignedDev.id,
      team_remarks: updateRemarks,
      priority: 'P1',
      due_date: '2026-11-18'
    })
  });
  const updateData = await updateRes.json();
  const updatedItem = updateData.data;
  record(
    'PUT /api/brand-sheets/{id} (Collaborative Edit)',
    updateRes.status === 200 &&
    updatedItem?.status === 'IN_PROGRESS' &&
    updatedItem?.assigned_to_user_id === assignedDev.id &&
    updatedItem?.team_remarks === updateRemarks &&
    updatedItem?.priority === 'P1',
    `New Status: ${updatedItem?.status}, Assignee: ${updatedItem?.assigned_to_name}`
  );

  // Step 7: Quick Status Transition
  console.log('\n--- Step 7: Quick Status Transition ---');
  const quickStatusRes = await fetch(`${BASE_URL}/api/brand-sheets/${createdItem.id}/status`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'IN_REVIEW' })
  });
  const quickStatusData = await quickStatusRes.json();
  record(
    'POST /api/brand-sheets/{id}/status',
    quickStatusRes.status === 200 && quickStatusData.data?.status === 'IN_REVIEW',
    `Status transitioned to: ${quickStatusData.data?.status}`
  );

  // Step 8: Complete Work Item
  console.log('\n--- Step 8: Complete Work Item ---');
  const completeRes = await fetch(`${BASE_URL}/api/brand-sheets/${createdItem.id}/status`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'COMPLETED' })
  });
  const completeData = await completeRes.json();
  record(
    'Transition to COMPLETED',
    completeRes.status === 200 && completeData.data?.status === 'COMPLETED',
    `Status: ${completeData.data?.status}, Completed At: ${completeData.data?.completed_at}`
  );

  // Step 9: Client Role Provisioning & Client Sheet Flow
  console.log('\n--- Step 9: Provision Brand Client Account for Collaborative Verification ---');
  const clientEmail = `client-brand-${Date.now()}@testbrand.com`;
  const clientPass = 'ClientPass2026!';
  const createClientRes = await fetch(`${BASE_URL}/api/auth/create-user`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Brand Marketing Manager',
      email: clientEmail,
      password: clientPass,
      role: 'client',
      organization_id: targetOrg.id
    })
  });
  const createClientData = await createClientRes.json();
  record('Create Brand Client User', createClientRes.status === 201 && Boolean(createClientData.user), `Client: ${clientEmail}`);

  // Step 10: Authenticate as Brand Client
  console.log('\n--- Step 10: Authenticate as Brand Client via Brand Portal ---');
  const clientLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: clientEmail,
      password: clientPass,
      portal: 'brand'
    })
  });
  const clientLoginData = await clientLoginRes.json();
  const clientToken = clientLoginData.token;
  record('Brand Client Portal Login', Boolean(clientToken), `User: ${clientLoginData.user?.name}, Org: ${clientLoginData.user?.organization_id}`);

  const clientHeaders = {
    'Authorization': `Bearer ${clientToken}`,
    'Content-Type': 'application/json'
  };

  // Step 11: Brand Client Views their Sheet
  console.log('\n--- Step 11: Brand Client Fetches Scoped Sheet Items ---');
  const clientSheetRes = await fetch(`${BASE_URL}/api/brand-sheets`, { headers: clientHeaders });
  const clientSheetData = await clientSheetRes.json();
  record(
    'GET /api/brand-sheets (Client Scoped)',
    clientSheetRes.status === 200 && Array.isArray(clientSheetData.items),
    `Brand Items Count: ${clientSheetData.items?.length}`
  );

  // Step 12: Brand Client Adds a Work Item to their Sheet
  console.log('\n--- Step 12: Brand Client Adds Work Request to their Sheet ---');
  const clientItemTitle = `Diwali Banner Campaign & Tracking Pixels - ${Date.now()}`;
  const clientAddRes = await fetch(`${BASE_URL}/api/brand-sheets`, {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify({
      title: clientItemTitle,
      description: 'Upload homepage hero slider banners and verify Meta Pixel Purchase events.',
      category: 'MARKETING',
      priority: 'P1',
      target_url: 'https://staging.example.com/diwali-sale',
      due_date: '2026-11-25'
    })
  });
  const clientAddData = await clientAddRes.json();
  const clientWorkItem = clientAddData.data;
  record(
    'Client Creates Work Item in Sheet',
    clientAddRes.status === 201 && Boolean(clientWorkItem?.id),
    `Item Code: ${clientWorkItem?.item_code}, Title: ${clientWorkItem?.title}`
  );

  // Step 13: Team Member Views and Edits the Client-Added Item
  console.log('\n--- Step 13: Agency Staff Views & Updates Client Item Remarks & Status ---');
  const staffCollabRes = await fetch(`${BASE_URL}/api/brand-sheets/${clientWorkItem.id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      status: 'IN_PROGRESS',
      assigned_to_user_id: assignedDev.id,
      team_remarks: `Banners received in 1920x800. Meta Pixel helper confirmed event firing. Deployed to staging.`
    })
  });
  const staffCollabData = await staffCollabRes.json();
  record(
    'Staff Edits Client Work Item',
    staffCollabRes.status === 200 && staffCollabData.data?.status === 'IN_PROGRESS',
    `Status: ${staffCollabData.data?.status}, Assigned: ${staffCollabData.data?.assigned_to_name}`
  );

  // Step 14: Client re-checks their sheet and verifies staff updates are visible
  console.log('\n--- Step 14: Brand Client Verifies Live Staff Updates in their Sheet ---');
  const clientVerifyRes = await fetch(`${BASE_URL}/api/brand-sheets`, { headers: clientHeaders });
  const clientVerifyData = await clientVerifyRes.json();
  const verifiedItem = clientVerifyData.items?.find(it => it.id === clientWorkItem.id);
  record(
    'Client Confirms Real-time Staff Edits & Remarks',
    Boolean(verifiedItem) &&
    verifiedItem?.status === 'IN_PROGRESS' &&
    verifiedItem?.assigned_to_name === assignedDev.name &&
    verifiedItem?.team_remarks?.includes('Banners received'),
    `Verified Assignee: ${verifiedItem?.assigned_to_name}, Remarks: "${verifiedItem?.team_remarks?.substring(0, 40)}..."`
  );

  // Summary
  console.log('\n================================================================');
  const allPassed = testResults.every(r => r.passed);
  console.log(`🏁 TEST SUITE RESULT: ${allPassed ? 'ALL PASSED (100%)' : 'SOME TESTS FAILED'}`);
  console.log(`Passed: ${testResults.filter(r => r.passed).length}/${testResults.length}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
