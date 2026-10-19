import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { initDatabase } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
import { SlackNotificationService } from '../notifications/slack.service.js';
import { EmailNotificationService } from '../notifications/email.service.js';

describe('Client Bug Tracker - Comprehensive Test Suite & Acceptance Criteria', () => {
  let brandAToken: string;
  let brandBToken: string;
  let managerToken: string;
  let devToken: string;

  let createdTicketId: string;
  let createdTicketNumber: string;

  beforeAll(async () => {
    await initDatabase();
    await seedDatabase();

    // 1. Log in client from Brand A (Acme)
    const brandALogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'client@acme.com', password: 'password123' });
    expect(brandALogin.status).toBe(200);
    brandAToken = brandALogin.body.token;

    // Log in client from Brand B (Starlight)
    const brandBLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'client@starlight.com', password: 'password123' });
    expect(brandBLogin.status).toBe(200);
    brandBToken = brandBLogin.body.token;

    // Log in Support Manager
    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'support@agency.com', password: 'password123' });
    expect(managerLogin.status).toBe(200);
    managerToken = managerLogin.body.token;

    // Log in Developer A
    const devLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dev@agency.com', password: 'password123' });
    expect(devLogin.status).toBe(200);
    devToken = devLogin.body.token;
  });

  // Step 1 - 4: Brand A submits a bug report and receives unique ticket reference
  it('Steps 1-4: Brand A submits bug report, gets unique ticket reference (e.g. WEB-100X)', async () => {
    // Client selects their website (Acme Main Store)
    const websitesRes = await request(app)
      .get('/api/organizations/org-acme-1111/websites')
      .set('Authorization', `Bearer ${brandAToken}`);
    expect(websitesRes.status).toBe(200);
    expect(websitesRes.body.websites.length).toBeGreaterThan(0);
    const websiteId = websitesRes.body.websites[0].id;

    // Submit new bug report
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${brandAToken}`)
      .send({
        title: 'Checkout payment gateway drops session cookie',
        description: 'Users on Chrome mobile report that after entering CVV the session drops back to empty cart.',
        website_id: websiteId,
        category: 'Checkout & Payments',
        priority: 'P1',
        steps_to_reproduce: '1. Add item\n2. Enter credit card\n3. Click pay',
        browser: 'Chrome 122',
        device: 'Pixel 8',
        environment: 'production',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.ticket).toBeDefined();

    createdTicketId = createRes.body.ticket.id;
    createdTicketNumber = createRes.body.ticket.ticket_number;

    // Verify format WEB-XXXX
    expect(createdTicketNumber).toMatch(/^WEB-\d+$/);
    expect(createRes.body.ticket.priority).toBe('P1');
  });

  // Step 5: Slack notification format and delivery
  it('Step 5: Slack notification payload is properly formatted with ticket info', () => {
    const payload = SlackNotificationService.buildPayload({
      ticket: {
        id: createdTicketId,
        ticket_number: createdTicketNumber,
        title: 'Checkout payment gateway drops session cookie',
        description: 'Users on Chrome mobile report that after entering CVV the session drops',
        organization_id: 'org-acme-1111',
        organization_name: 'Acme Brands Inc.',
        website_id: 'site-acme-prod-1',
        website_name: 'Acme Main Store',
        requester_id: 'usr-client-acme-5',
        category: 'Checkout & Payments',
        priority: 'P1',
        status: 'NEW',
        assignee_id: null,
        source: 'portal',
        root_cause: null,
        fix_details: null,
        resolution_notes: null,
        target_response_time: null,
        target_resolution_time: null,
        resolved_at: null,
        closed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      event: 'created',
      actorName: 'Alice Client',
    });

    expect(payload.channel).toBe('#production-incidents'); // P1 routed to incidents
    expect(payload.text).toContain(createdTicketNumber);
    expect(payload.blocks.length).toBeGreaterThan(2);
  });

  // Step 6-7: Support manager assigns Developer A
  it('Steps 6-7: Support manager assigns Developer A, advancing status and recording history', async () => {
    // Assign to Alex Developer (usr-dev-3)
    const assignRes = await request(app)
      .patch(`/api/tickets/${createdTicketId}/assign`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        assignee_id: 'usr-dev-3',
        notes: 'Assigned to Alex for immediate P1 hotfix investigation.',
      });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.ticket.assignee_id).toBe('usr-dev-3');
    expect(assignRes.body.ticket.assignee_name).toBe('Alex Developer');
    expect(assignRes.body.ticket.status).toBe('ASSIGNED');
  });

  // Step 8: Developer A marks ticket In Progress
  it('Step 8: Developer A transitions status to IN PROGRESS', async () => {
    const statusRes = await request(app)
      .patch(`/api/tickets/${createdTicketId}/status`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        status: 'IN PROGRESS',
        notes: 'Investigating Redis session store timeout during 3D secure callback.',
      });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.ticket.status).toBe('IN PROGRESS');
  });

  // Steps 9-10: Developer adds internal note; Client cannot see it
  it('Steps 9-10: Developer posts internal note; Client CANNOT view internal note', async () => {
    // 9. Developer posts internal note
    const noteRes = await request(app)
      .post(`/api/tickets/${createdTicketId}/comments`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        content: 'INTERNAL CONFIDENTIAL: Redis cluster node 2 memory exceeded 95%, causing dropped sessions.',
        is_internal: true,
      });

    expect(noteRes.status).toBe(201);
    expect(noteRes.body.comment.is_internal).toBe(1);

    // 10. Developer can see the note
    const devComments = await request(app)
      .get(`/api/tickets/${createdTicketId}/comments`)
      .set('Authorization', `Bearer ${devToken}`);
    expect(devComments.body.comments.some((c: any) => c.is_internal === 1)).toBe(true);

    // 10. Client from Brand A attempts to fetch comments
    const clientComments = await request(app)
      .get(`/api/tickets/${createdTicketId}/comments`)
      .set('Authorization', `Bearer ${brandAToken}`);

    expect(clientComments.status).toBe(200);
    // Crucial: Client comments list MUST NOT contain any comments where is_internal is truthy
    const hasInternal = clientComments.body.comments.some(
      (c: any) => c.is_internal === 1 || c.is_internal === true || c.content.includes('INTERNAL CONFIDENTIAL')
    );
    expect(hasInternal).toBe(false);
  });

  // Steps 11-12: Developer posts public update; Client CAN see it
  it('Steps 11-12: Developer posts public reply; Client CAN view the public update', async () => {
    const publicReplyRes = await request(app)
      .post(`/api/tickets/${createdTicketId}/comments`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        content: 'Hi Alice, our infrastructure team has diagnosed the session drop and is deploying additional cache capacity.',
        is_internal: false,
      });

    expect(publicReplyRes.status).toBe(201);
    expect(publicReplyRes.body.comment.is_internal).toBe(0);

    // Client verifies comment is visible
    const clientComments = await request(app)
      .get(`/api/tickets/${createdTicketId}/comments`)
      .set('Authorization', `Bearer ${brandAToken}`);

    expect(clientComments.status).toBe(200);
    const foundPublic = clientComments.body.comments.find((c: any) =>
      c.content.includes('additional cache capacity')
    );
    expect(foundPublic).toBeDefined();
    expect(foundPublic.is_internal).toBe(0);
  });

  // Steps 13-14: Developer resolves ticket with root cause & resolution notes
  it('Steps 13-14: Developer resolves ticket with root cause notes; Client sees RESOLVED status', async () => {
    const resolveRes = await request(app)
      .patch(`/api/tickets/${createdTicketId}/status`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        status: 'RESOLVED',
        root_cause: 'Redis cache eviction policy misconfigured on payment webhook callback cluster.',
        fix_details: 'Increased Redis cache cluster RAM and updated cookie TTL.',
        resolution_notes: 'Tested 50 consecutive mobile checkout transactions with 100% success rate.',
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.ticket.status).toBe('RESOLVED');
    expect(resolveRes.body.ticket.resolved_at).toBeDefined();

    // Client inspects resolved ticket
    const clientTicketRes = await request(app)
      .get(`/api/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${brandAToken}`);

    expect(clientTicketRes.status).toBe(200);
    expect(clientTicketRes.body.ticket.status).toBe('RESOLVED');
    // Client must not see internal root_cause
    expect(clientTicketRes.body.ticket.root_cause).toBeNull();
  });

  // Step 15: Brand B user attempting to access Brand A's ticket is strictly DENIED (403)
  it('Step 15: Cross-organization protection - Brand B user is DENIED access to Brand A ticket (403)', async () => {
    const crossOrgGet = await request(app)
      .get(`/api/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${brandBToken}`);

    expect(crossOrgGet.status).toBe(403);
    expect(crossOrgGet.body.error).toContain('Forbidden');

    // Brand B also cannot see comments for Brand A's ticket
    const crossOrgComments = await request(app)
      .get(`/api/tickets/${createdTicketId}/comments`)
      .set('Authorization', `Bearer ${brandBToken}`);

    expect(crossOrgComments.status).toBe(403);

    // Brand B cannot post comments to Brand A's ticket
    const crossOrgPost = await request(app)
      .post(`/api/tickets/${createdTicketId}/comments`)
      .set('Authorization', `Bearer ${brandBToken}`)
      .send({ content: 'I should not be able to comment here' });

    expect(crossOrgPost.status).toBe(403);
  });

  // Client resolution confirmation & reopening test
  it('Client can confirm resolution or reopen a persisted bug', async () => {
    // Client cannot directly change to invalid status (e.g. TRIAGED)
    const invalidStatusRes = await request(app)
      .patch(`/api/tickets/${createdTicketId}/status`)
      .set('Authorization', `Bearer ${brandAToken}`)
      .send({ status: 'TRIAGED' });
    expect(invalidStatusRes.status).toBe(403);

    // Client confirms resolution (RESOLVED -> CLOSED)
    const confirmRes = await request(app)
      .patch(`/api/tickets/${createdTicketId}/status`)
      .set('Authorization', `Bearer ${brandAToken}`)
      .send({ status: 'CLOSED', notes: 'Confirmed working on our devices.' });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.ticket.status).toBe('CLOSED');

    // Issue persists! Client reopens ticket (CLOSED -> IN PROGRESS)
    const reopenRes = await request(app)
      .patch(`/api/tickets/${createdTicketId}/status`)
      .set('Authorization', `Bearer ${brandAToken}`)
      .send({ status: 'IN PROGRESS', notes: 'Still seeing occasional failure on Samsung Internet browser.' });
    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.ticket.status).toBe('IN PROGRESS');
  });

  // Client cannot assign developers
  it('Clients are prohibited from assigning developers', async () => {
    const assignAttempt = await request(app)
      .patch(`/api/tickets/${createdTicketId}/assign`)
      .set('Authorization', `Bearer ${brandAToken}`)
      .send({ assignee_id: 'usr-dev-3' });

    expect(assignAttempt.status).toBe(403);
  });

  // CSV Export is protected
  it('CSV export endpoint is accessible only to staff and forbidden to clients', async () => {
    const clientCsv = await request(app)
      .get('/api/tickets/export/csv')
      .set('Authorization', `Bearer ${brandAToken}`);
    expect(clientCsv.status).toBe(403);

    const staffCsv = await request(app)
      .get('/api/tickets/export/csv')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(staffCsv.status).toBe(200);
    expect(staffCsv.headers['content-type']).toContain('text/csv');
    expect(staffCsv.text).toContain('Ticket ID,Title,Organization');
  });
});
