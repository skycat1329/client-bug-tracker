import { app } from './app.js';
import bcrypt from 'bcryptjs';
import { config } from './config/index.js';
import { execute, initDatabase, queryOne } from './db/database.js';

async function startServer() {
  try {
    console.log('[Server] Initializing database schema...');
    await initDatabase();

    // Check if initial admin account needs to be created
    const userCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if (!userCount || Number(userCount.count) === 0) {
      console.log('[Server] Database is empty. Creating initial agency administrator...');
      const adminHash = bcrypt.hashSync('admin123', 10);
      await execute(
        `INSERT INTO users (id, email, password_hash, name, role, organization_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'usr-admin-primary',
          'admin@agency.com',
          adminHash,
          'Agency Administrator',
          'super_admin',
          null,
        ]
      );
      console.log('   Default Admin Created: admin@agency.com (Password: admin123)');
    }

    app.listen(config.port, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Client Bug Tracker API running on http://localhost:${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   Slack Mode:  ${config.slackWebhookUrl ? 'Live Webhook' : 'Mock (Safe Local)'}`);
      console.log(`   Email Mode:  ${config.emailProvider}`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

startServer();
