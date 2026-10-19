import bcrypt from 'bcryptjs';
import { initDatabase, execute, queryOne } from './database.js';

export async function seedDatabase() {
  await initDatabase();

  console.log('Seeding database with realistic fixtures...');

  // Clean tables first to avoid foreign key conflicts on replacement
  await execute('DELETE FROM ticket_attachments');
  await execute('DELETE FROM ticket_comments');
  await execute('DELETE FROM ticket_assignments');
  await execute('DELETE FROM ticket_activity');
  await execute('DELETE FROM notification_deliveries');
  await execute('DELETE FROM tickets');
  await execute('DELETE FROM routing_rules');
  await execute('DELETE FROM websites');
  await execute('DELETE FROM organization_members');
  await execute('DELETE FROM organizations');
  await execute('DELETE FROM users');

  // 1. Organizations
  const orgAcme = {
    id: 'org-acme-1111',
    name: 'Acme Brands Inc.',
    slug: 'acme-brands',
  };
  const orgStarlight = {
    id: 'org-starlight-2222',
    name: 'Starlight Retail Ltd.',
    slug: 'starlight-retail',
  };

  await execute(
    'INSERT OR REPLACE INTO organizations (id, name, slug) VALUES (?, ?, ?), (?, ?, ?)',
    [orgAcme.id, orgAcme.name, orgAcme.slug, orgStarlight.id, orgStarlight.name, orgStarlight.slug]
  );

  // 2. Websites
  const siteAcmeProd = {
    id: 'site-acme-prod-1',
    organization_id: orgAcme.id,
    name: 'Acme Main Store',
    url: 'https://store.acme.example.com',
    environment: 'production',
  };
  const siteAcmeStage = {
    id: 'site-acme-stage-2',
    organization_id: orgAcme.id,
    name: 'Acme Staging Portal',
    url: 'https://stage.acme.example.com',
    environment: 'staging',
  };
  const siteStarlightProd = {
    id: 'site-starlight-prod-3',
    organization_id: orgStarlight.id,
    name: 'Starlight Fashion Store',
    url: 'https://shop.starlight.example.com',
    environment: 'production',
  };
  const siteStarlightBlog = {
    id: 'site-starlight-blog-4',
    organization_id: orgStarlight.id,
    name: 'Starlight Brand Blog',
    url: 'https://blog.starlight.example.com',
    environment: 'production',
  };

  for (const site of [siteAcmeProd, siteAcmeStage, siteStarlightProd, siteStarlightBlog]) {
    await execute(
      'INSERT OR REPLACE INTO websites (id, organization_id, name, url, environment) VALUES (?, ?, ?, ?, ?)',
      [site.id, site.organization_id, site.name, site.url, site.environment]
    );
  }

  // 3. Users (Passwords: 'password123')
  const passwordHash = bcrypt.hashSync('password123', 10);

  const users = [
    {
      id: 'usr-admin-1',
      email: 'admin@agency.com',
      name: 'Arthur Admin',
      role: 'super_admin',
      organization_id: null,
    },
    {
      id: 'usr-support-2',
      email: 'support@agency.com',
      name: 'Sarah Support',
      role: 'support_manager',
      organization_id: null,
    },
    {
      id: 'usr-dev-3',
      email: 'dev@agency.com',
      name: 'Alex Developer',
      role: 'developer',
      organization_id: null,
    },
    {
      id: 'usr-dev-4',
      email: 'dev2@agency.com',
      name: 'Elena Engineer',
      role: 'developer',
      organization_id: null,
    },
    {
      id: 'usr-client-acme-5',
      email: 'client@acme.com',
      name: 'Alice Client (Acme)',
      role: 'client',
      organization_id: orgAcme.id,
    },
    {
      id: 'usr-client-starlight-6',
      email: 'client@starlight.com',
      name: 'Bob Client (Starlight)',
      role: 'client',
      organization_id: orgStarlight.id,
    },
  ];

  for (const u of users) {
    await execute(
      `INSERT OR REPLACE INTO users (id, email, password_hash, name, role, organization_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [u.id, u.email, passwordHash, u.name, u.role, u.organization_id]
    );
  }

  // 4. Organization Members
  await execute(
    'INSERT OR REPLACE INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
    ['mem-1', orgAcme.id, 'usr-client-acme-5', 'owner', 'mem-2', orgStarlight.id, 'usr-client-starlight-6', 'owner']
  );

  // 5. Routing Rules
  await execute(
    `INSERT OR REPLACE INTO routing_rules (id, name, category, website_id, priority, default_assignee_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)`,
    [
      'rule-1',
      'Checkout & Payments Rule',
      'Checkout & Payments',
      null,
      'P1',
      'usr-dev-3',
      1,
      'rule-2',
      'Starlight Fashion Direct Rule',
      null,
      siteStarlightProd.id,
      null,
      'usr-dev-4',
      1,
    ]
  );

  // 6. Reset counter to 1004 so subsequent new tickets start at WEB-1005
  await execute('INSERT OR REPLACE INTO ticket_counters (prefix, current_val) VALUES (?, ?)', ['WEB', 1004]);

  // 7. Seed Sample Tickets
  const sampleTickets = [
    {
      id: 'tkt-1001',
      ticket_number: 'WEB-1001',
      organization_id: orgAcme.id,
      website_id: siteAcmeProd.id,
      requester_id: 'usr-client-acme-5',
      title: 'Cart fails to calculate sales tax during checkout for CA addresses',
      description: 'When users from California enter their shipping zip code (e.g. 94103), the checkout tax field freezes at $0.00 and the place order button throws a validation error.',
      steps_to_reproduce: '1. Add any product to cart\n2. Proceed to checkout\n3. Enter CA shipping address (Zip: 94103)\n4. Observe tax calculation spinning wheel and error',
      browser: 'Chrome 122.0',
      device: 'Desktop Windows 11',
      environment: 'production',
      category: 'Checkout & Payments',
      priority: 'P1',
      status: 'IN PROGRESS',
      assignee_id: 'usr-dev-3',
      source: 'portal',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'tkt-1002',
      ticket_number: 'WEB-1002',
      organization_id: orgAcme.id,
      website_id: siteAcmeStage.id,
      requester_id: 'usr-client-acme-5',
      title: 'Footer newsletter form throws 500 error on submit',
      description: 'Newsletter subscription API endpoint is returning 500 internal server error on staging.',
      steps_to_reproduce: '1. Scroll to footer\n2. Enter email test@test.com\n3. Click Subscribe\n4. Error banner appears',
      browser: 'Firefox 123.0',
      device: 'MacBook Pro macOS Sonoma',
      environment: 'staging',
      category: 'Forms & Leads',
      priority: 'P3',
      status: 'RESOLVED',
      assignee_id: 'usr-dev-3',
      source: 'portal',
      root_cause: 'Missing staging mailchimp API key in environment variables.',
      fix_details: 'Added STAGING_MAILCHIMP_KEY to AWS Secrets Manager and redeployed.',
      resolution_notes: 'Verified subscription webhook is firing and receiving 200 OK.',
      resolved_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
      id: 'tkt-1003',
      ticket_number: 'WEB-1003',
      organization_id: orgStarlight.id,
      website_id: siteStarlightProd.id,
      requester_id: 'usr-client-starlight-6',
      title: 'Mobile navigation hamburger menu will not toggle closed on iOS Safari',
      description: 'On iPhone 15 Pro iOS 17, opening the drawer menu works, but clicking the "X" close icon fails to close the drawer overlay.',
      steps_to_reproduce: '1. Open shop on iPhone Safari\n2. Tap burger menu\n3. Tap X close icon\n4. Menu stays open and page is unscrollable',
      browser: 'Safari Mobile 17.2',
      device: 'iPhone 15 Pro iOS 17.2',
      environment: 'production',
      category: 'UI / Mobile Navigation',
      priority: 'P2',
      status: 'ASSIGNED',
      assignee_id: 'usr-dev-4',
      source: 'portal',
      created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
      id: 'tkt-1004',
      ticket_number: 'WEB-1004',
      organization_id: orgStarlight.id,
      website_id: siteStarlightBlog.id,
      requester_id: 'usr-client-starlight-6',
      title: 'Broken featured hero images on high DPI retina displays',
      description: 'Hero blog images look blurry and occasionally show missing image icons on Retina displays.',
      steps_to_reproduce: '1. Open blog homepage\n2. Inspect top banner image srcset',
      browser: 'Chrome 122.0',
      device: 'MacBook Retina',
      environment: 'production',
      category: 'Visual & Layout',
      priority: 'P4',
      status: 'NEW',
      assignee_id: null,
      source: 'portal',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ];

  for (const t of sampleTickets) {
    await execute(
      `INSERT OR REPLACE INTO tickets (
        id, ticket_number, organization_id, website_id, requester_id,
        title, description, steps_to_reproduce, browser, device,
        environment, category, priority, status, assignee_id, source,
        root_cause, fix_details, resolution_notes, resolved_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        t.ticket_number,
        t.organization_id,
        t.website_id,
        t.requester_id,
        t.title,
        t.description,
        t.steps_to_reproduce,
        t.browser,
        t.device,
        t.environment,
        t.category,
        t.priority,
        t.status,
        t.assignee_id,
        t.source,
        t.root_cause || null,
        t.fix_details || null,
        t.resolution_notes || null,
        t.resolved_at || null,
        t.created_at,
      ]
    );
  }

  // 8. Seed Sample Comments (showing public vs internal separation)
  const sampleComments = [
    {
      id: 'com-1',
      ticket_id: 'tkt-1001',
      user_id: 'usr-client-acme-5',
      is_internal: 0,
      content: 'Hello, multiple customers called our hotline saying they cannot complete orders today. This is urgent!',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: 'com-2',
      ticket_id: 'tkt-1001',
      user_id: 'usr-dev-3',
      is_internal: 1, // INTERNAL NOTE!
      content: 'INTERNAL NOTE: Found bug in Avalara Tax integration microservice; the zip code lookup endpoint is timing out due to rate limits on their sandbox key.',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'com-3',
      ticket_id: 'tkt-1001',
      user_id: 'usr-dev-3',
      is_internal: 0, // PUBLIC REPLY!
      content: 'Hi Alice, we have isolated the checkout calculation issue and our engineering team is actively rolling out a hotfix to our tax provider connection.',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ];

  for (const c of sampleComments) {
    await execute(
      'INSERT OR REPLACE INTO ticket_comments (id, ticket_id, user_id, is_internal, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [c.id, c.ticket_id, c.user_id, c.is_internal, c.content, c.created_at]
    );
  }

  // 9. Seed Activities
  await execute(
    `INSERT OR REPLACE INTO ticket_activity (id, ticket_id, user_id, action, details, is_internal)
     VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
    [
      'act-1',
      'tkt-1001',
      'usr-client-acme-5',
      'CREATED',
      JSON.stringify({ ticket_number: 'WEB-1001', priority: 'P1' }),
      0,
      'act-2',
      'tkt-1001',
      'usr-support-2',
      'ASSIGNED',
      JSON.stringify({ assignee_id: 'usr-dev-3', assignee_name: 'Alex Developer' }),
      0,
    ]
  );

  console.log('Database seeded successfully!');
}

if (process.argv[1]?.includes('seed')) {
  seedDatabase().catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}
