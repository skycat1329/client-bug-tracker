const https = require('https');

const BASE_URL = 'https://lightsteelblue-barracuda-559543.hostingersite.com';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = https.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== VERIFYING PRODUCT LISTING TICKETING ON LIVE PRODUCTION ===\n');

  // 1. Authenticate as admin
  console.log('1. Authenticating as Admin...');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'admin',
    password: 'AssuranceAdmin2026!',
    totp_code: '202626',
  });

  if (!loginRes.data || !loginRes.data.token) {
    console.error('Login failed:', loginRes);
    process.exit(1);
  }

  const token = loginRes.data.token;
  console.log('✓ Logged in as:', loginRes.data.user.email, `(${loginRes.data.user.name})`);

  // 2. Fetch websites to find an affected website ID
  console.log('\n2. Fetching available websites...');
  const websitesRes = await request('GET', '/api/organizations/all-websites', null, token);
  const website = websitesRes.data?.websites?.[0];

  if (!website) {
    console.error('No website found to associate ticket with');
    process.exit(1);
  }
  console.log(`✓ Using website ID: ${website.id} (${website.name})`);

  // 3. Create a Product Listing Issue Ticket
  console.log('\n3. Creating a Product Listing Issue Ticket...');
  const testSku = 'SKU-AM-' + Math.floor(1000 + Math.random() * 9000);
  const newTicketPayload = {
    website_id: website.id,
    title: `[New Listing] [${testSku}] Premium Linen Summer Polo - Olive Green`,
    description: `### 📦 Product Listing Request: New Listing\n• **SKU:** \`${testSku}\`\n• **Product Title:** Premium Linen Summer Polo - Olive Green\n• **Selling / Regular Price:** ₹899\n• **Compare-at Price (MRP):** ₹1,799 (50% OFF - Save ₹900)\n\n#### 🖼️ Product Images & Media Drive Link:\nhttps://drive.google.com/drive/folders/sample-olive-polo-drive-link\n\n#### 📝 Changes to be Made & Action Required:\n1. Create catalog item under Men > Polos\n2. Upload HD assets from drive link\n3. Set stock count to 100 units\n\n#### 📋 Product Description & Specifications:\nBreathable 100% European linen fabric polo with horn buttons and tailored collar.`,
    category: 'Product Listing / Catalog',
    priority: 'P2',
    ticket_type: 'listing',
    listing_action: 'new_listing',
    sku: testSku,
    product_title: 'Premium Linen Summer Polo - Olive Green',
    product_price: '₹899',
    compare_at_price: '₹1,799',
    product_images: 'https://drive.google.com/drive/folders/sample-olive-polo-drive-link',
    listing_details: {
      action: 'new_listing',
      sku: testSku,
      title: 'Premium Linen Summer Polo - Olive Green',
      price: '₹899',
      compare_at_price: '₹1,799',
      images: 'https://drive.google.com/drive/folders/sample-olive-polo-drive-link',
      changes: '1. Create catalog item under Men > Polos\n2. Upload HD assets from drive link\n3. Set stock count to 100 units',
      catalog_description: 'Breathable 100% European linen fabric polo with horn buttons and tailored collar.',
    },
  };

  const createRes = await request('POST', '/api/tickets', newTicketPayload, token);
  console.log('Create Ticket HTTP Status:', createRes.status);
  if (!createRes.data || !createRes.data.ticket) {
    console.error('Failed to create ticket:', createRes);
    process.exit(1);
  }

  const createdTicket = createRes.data.ticket;
  console.log(`✓ Ticket created successfully!`);
  console.log(`  Ticket #: ${createdTicket.ticket_number}`);
  console.log(`  Ticket ID: ${createdTicket.id}`);

  // 4. Retrieve created ticket and verify all listing attributes are persisted
  console.log('\n4. Fetching Ticket Details from /api/tickets/' + createdTicket.id);
  const fetchRes = await request('GET', `/api/tickets/${createdTicket.id}`, null, token);
  const fetched = fetchRes.data?.ticket;

  if (!fetched) {
    console.error('Failed to fetch created ticket:', fetchRes);
    process.exit(1);
  }

  console.log('\n--- VERIFYING PERSISTED ATTRIBUTES ---');
  console.log(`  Ticket Type:      ${fetched.ticket_type} (Expected: listing)`);
  console.log(`  Listing Action:   ${fetched.listing_action} (Expected: new_listing)`);
  console.log(`  SKU:              ${fetched.sku} (Expected: ${testSku})`);
  console.log(`  Product Title:    ${fetched.product_title}`);
  console.log(`  Selling Price:    ${fetched.product_price} (Expected: ₹899)`);
  console.log(`  Compare-at Price: ${fetched.compare_at_price} (Expected: ₹1,799)`);
  console.log(`  Product Images:   ${fetched.product_images}`);

  const asserts = [
    fetched.ticket_type === 'listing',
    fetched.listing_action === 'new_listing',
    fetched.sku === testSku,
    fetched.product_price === '₹899',
    fetched.compare_at_price === '₹1,799',
    fetched.product_title === 'Premium Linen Summer Polo - Olive Green',
  ];

  if (!asserts.every(Boolean)) {
    console.error('❌ Assertion failed: some fields did not persist correctly!');
    process.exit(1);
  }
  console.log('✓ All listing attributes correctly stored in MySQL and returned by API!');

  // 5. Test search by SKU
  console.log(`\n5. Testing search query by SKU: /api/tickets?search=${testSku}`);
  const searchRes = await request('GET', `/api/tickets?search=${testSku}`, null, token);
  const found = searchRes.data?.tickets?.find((t) => t.sku === testSku || t.id === createdTicket.id);

  if (found) {
    console.log(`✓ SKU Search test PASSED! Found ticket ${found.ticket_number} (SKU: ${found.sku}) with query "${testSku}".`);
  } else {
    console.error('❌ Search by SKU did not return the expected ticket');
    process.exit(1);
  }

  console.log('\n🎉 ALL LIVE VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
}

run().catch((err) => {
  console.error('Unexpected error during verification:', err);
  process.exit(1);
});
