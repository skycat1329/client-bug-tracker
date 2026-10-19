import bcrypt from 'bcryptjs';
import { initDatabase, execute } from './database.js';

export async function cleanDatabase() {
  await initDatabase();

  console.log('Clearing all dummy and mock data from database...');

  // 1. Wipe all operational tables
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

  // 2. Reset ticket counter to 1000 (first real ticket will be WEB-1001)
  await execute('INSERT OR REPLACE INTO ticket_counters (prefix, current_val) VALUES (?, ?)', ['WEB', 1000]);

  // 3. Create clean Initial Administrator & Developer accounts
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  await execute(
    `INSERT INTO users (id, email, password_hash, name, role, organization_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'usr-admin-primary',
      'admin@agency.com',
      adminPasswordHash,
      'Agency Administrator',
      'super_admin',
      null,
    ]
  );

  const devPasswordHash = bcrypt.hashSync('dev123', 10);
  await execute(
    `INSERT INTO users (id, email, password_hash, name, role, organization_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'usr-dev-primary',
      'dev@agency.com',
      devPasswordHash,
      'Alex Developer',
      'developer',
      null,
    ]
  );

  console.log('✅ All dummy data successfully removed.');
  console.log('   Clean Starter Accounts created:');
  console.log('   1. Administrator: admin@agency.com / admin123 (Super Admin)');
  console.log('   2. Developer:     dev@agency.com   / dev123   (Developer)');
  console.log('   Next Ticket Reference: WEB-1001');
}

if (process.argv[1]?.includes('clean')) {
  cleanDatabase().catch((err) => {
    console.error('Clean error:', err);
    process.exit(1);
  });
}
