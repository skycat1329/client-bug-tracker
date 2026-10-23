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
      timeout: 15000,
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

async function runSecurityAudit() {
  console.log('================================================================');
  console.log('🔒 ENTERPRISE BACKEND SECURITY AUDIT & VERIFICATION');
  console.log(`🌐 Target: ${BASE_URL}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const results = [];

  // 1. Security Headers Check
  console.log('--- 1. Apache Security Headers Check ---');
  try {
    const res = await httpRequest(BASE_URL, { method: 'HEAD' });
    const h = res.headers;
    const checks = [
      { name: 'X-Content-Type-Options', expected: 'nosniff', actual: h['x-content-type-options'] },
      { name: 'X-Frame-Options', expected: 'SAMEORIGIN', actual: h['x-frame-options'] },
      { name: 'Strict-Transport-Security', expected: 'includeSubDomains', actual: h['strict-transport-security'] },
      { name: 'Referrer-Policy', expected: 'strict-origin-when-cross-origin', actual: h['referrer-policy'] },
      { name: 'Content-Security-Policy', expected: 'default-src', actual: h['content-security-policy'] ? 'Present' : 'Missing' },
    ];

    checks.forEach((c) => {
      const pass = c.actual && c.actual.toLowerCase().includes(c.expected.toLowerCase());
      console.log(`   ${pass ? '✅' : '❌'} ${c.name}: ${c.actual || 'NOT SET'} (Pass: ${pass})`);
      results.push({ test: `Header: ${c.name}`, pass, detail: c.actual || 'NOT SET' });
    });
  } catch (err) {
    console.error('   ❌ Error checking security headers:', err.message);
  }

  // 2. Sensitive File Blocking
  console.log('\n--- 2. Sensitive File Blocking Check (.env, .sql, .git, uploads listing) ---');
  const sensitiveFiles = [
    '/.env',
    '/database.sql',
    '/.git/config',
    '/.git/HEAD',
    '/api/.env',
    '/uploads/',
  ];

  for (const file of sensitiveFiles) {
    try {
      const res = await httpRequest(`${BASE_URL}${file}`, { method: 'GET' });
      const pass = res.statusCode === 403 || res.statusCode === 404;
      console.log(`   ${pass ? '✅' : '❌'} GET ${file} -> HTTP ${res.statusCode} (Expected 403/404)`);
      results.push({ test: `Blocked: ${file}`, pass, detail: `HTTP ${res.statusCode}` });
    } catch (err) {
      console.error(`   ❌ Error requesting ${file}:`, err.message);
    }
  }

  // 3. Demo User Endpoint Removal
  console.log('\n--- 3. Demo Users Endpoint Removal Check ---');
  try {
    const res = await httpRequest(`${BASE_URL}/api/auth/demo-users`, { method: 'GET' });
    const pass = res.statusCode === 404 || res.statusCode === 401;
    console.log(`   ${pass ? '✅' : '❌'} GET /api/auth/demo-users -> HTTP ${res.statusCode} (Expected 404 Not Found)`);
    results.push({ test: 'Remove /api/auth/demo-users', pass, detail: `HTTP ${res.statusCode}` });
  } catch (err) {
    console.error('   ❌ Error requesting demo-users:', err.message);
  }

  // 4. Generic Login Error Response
  console.log('\n--- 4. Generic Login Error Check (No Information Leakage) ---');
  try {
    const res = await httpRequest(
      `${BASE_URL}/api/auth/login`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'nonexistent-user@invalid.com', password: 'randomPassword123!', portal: 'admin' }
    );
    const pass = res.statusCode === 401 && res.json?.error === 'Invalid email, password, or authentication code';
    console.log(`   ${pass ? '✅' : '❌'} POST /api/auth/login (bad email) -> HTTP ${res.statusCode}, Error: "${res.json?.error}"`);
    results.push({ test: 'Generic Login Error (Bad Email)', pass, detail: res.json?.error });
  } catch (err) {
    console.error('   ❌ Error testing login error:', err.message);
  }

  try {
    const res = await httpRequest(
      `${BASE_URL}/api/auth/login`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'client@brand.com', password: 'wrongPassword123', portal: 'admin' }
    );
    const pass = res.statusCode === 401 && res.json?.error === 'Invalid email, password, or authentication code';
    console.log(`   ${pass ? '✅' : '❌'} POST /api/auth/login (bad pass) -> HTTP ${res.statusCode}, Error: "${res.json?.error}"`);
    results.push({ test: 'Generic Login Error (Bad Password)', pass, detail: res.json?.error });
  } catch (err) {
    console.error('   ❌ Error testing login error:', err.message);
  }

  // 5. Rate Limiting & Account Lockout
  console.log('\n--- 5. Server-Side Rate Limiting & Lockout Check ---');
  try {
    const attackEmail = `stress-test-${Date.now()}@security-test.com`;
    let lockoutHit = false;
    let lockoutCode = null;

    for (let i = 1; i <= 6; i++) {
      const res = await httpRequest(
        `${BASE_URL}/api/auth/login`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { email: attackEmail, password: 'wrongPassword', portal: 'brand' }
      );
      if (res.statusCode === 429) {
        lockoutHit = true;
        lockoutCode = res.statusCode;
        console.log(`   ✅ Attempt ${i}: Rate limit triggered with HTTP 429 Too Many Requests ("${res.json?.error}")`);
        break;
      } else {
        console.log(`   Attempt ${i}: HTTP ${res.statusCode} (recorded failed attempt)`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    const pass = lockoutHit;
    results.push({ test: 'Rate Limit Lockout (HTTP 429)', pass, detail: lockoutHit ? '429 Triggered' : 'Not triggered in 6 attempts' });
  } catch (err) {
    console.error('   ❌ Error testing rate limiting:', err.message);
  }

  // 6. Public Health Check
  console.log('\n--- 6. API Health Check ---');
  try {
    const res = await httpRequest(`${BASE_URL}/api/health`, { method: 'GET' });
    const pass = res.statusCode === 200 && res.json?.status === 'ok';
    console.log(`   ${pass ? '✅' : '❌'} GET /api/health -> HTTP ${res.statusCode} (Status: ${res.json?.status})`);
    results.push({ test: 'API Health Check', pass, detail: `HTTP ${res.statusCode}` });
  } catch (err) {
    console.error('   ❌ Error testing health check:', err.message);
  }

  console.log('\n================================================================');
  console.log(`📊 SUMMARY: ${results.filter((r) => r.pass).length}/${results.length} CHECKS PASSED`);
  console.log('================================================================\n');
}

runSecurityAudit();
