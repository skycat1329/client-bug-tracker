import { createClient, Client } from '@libsql/client';
import { config } from '../config/index.js';
import { INITIAL_SCHEMA_SQL } from './schema.js';

let dbClient: Client | null = null;

export function getDb(): Client {
  if (!dbClient) {
    dbClient = createClient({
      url: config.databaseUrl,
    });
  }
  return dbClient;
}

export async function query<T = any>(sql: string, args: any[] = []): Promise<T[]> {
  const db = getDb();
  const result = await db.execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function queryOne<T = any>(sql: string, args: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, args);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(
  sql: string,
  args: any[] = []
): Promise<{ rowsAffected: number; lastInsertRowid?: bigint | number }> {
  const db = getDb();
  const result = await db.execute({ sql, args });
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid,
  };
}

export async function initDatabase(): Promise<void> {
  const db = getDb();
  // Split statements by semicolon and execute non-empty statements
  const statements = INITIAL_SCHEMA_SQL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }

  // Ensure default counter exists
  const existingCounter = await queryOne('SELECT prefix FROM ticket_counters WHERE prefix = ?', ['WEB']);
  if (!existingCounter) {
    await execute('INSERT INTO ticket_counters (prefix, current_val) VALUES (?, ?)', ['WEB', 1000]);
  }

  // Create roles table if not exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT 'blue',
      base_role TEXT NOT NULL DEFAULT 'developer',
      is_system INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Ensure custom_role column exists on users
  try {
    await db.execute('ALTER TABLE users ADD COLUMN custom_role TEXT');
  } catch (e) {
    // Ignore if already exists
  }

  // Populate default roles if empty
  const roleCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM roles');
  if (!roleCount || roleCount.count === 0) {
    const defaultRoles = [
      { id: 'role-admin', name: 'super_admin', label: 'Super Admin', description: 'Full access to manage agency, clients, routing and settings', color: 'purple', base: 'super_admin', system: 1 },
      { id: 'role-support', name: 'support_manager', label: 'Support Manager', description: 'Triage, assign, routing rules and client communications', color: 'blue', base: 'support_manager', system: 1 },
      { id: 'role-dev', name: 'developer', label: 'Developer', description: 'Assigned tickets, claim, internal notes and root cause fixes', color: 'emerald', base: 'developer', system: 1 },
      { id: 'role-qa', name: 'qa_lead', label: 'QA Lead', description: 'Test validation, reproduction specs, fix verification', color: 'teal', base: 'developer', system: 0 },
      { id: 'role-client', name: 'client', label: 'Client Brand User', description: 'Submit bug reports and track resolution', color: 'amber', base: 'client', system: 1 },
    ];
    for (const r of defaultRoles) {
      await execute(
        'INSERT OR IGNORE INTO roles (id, name, label, description, color, base_role, is_system) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [r.id, r.name, r.label, r.description, r.color, r.base, r.system]
      );
    }
  }

  // Ensure triage visibility setting exists
  const existingVis = await queryOne('SELECT key FROM integration_settings WHERE key = ?', ['triage_visibility_policy']);
  if (!existingVis) {
    await execute(
      'INSERT INTO integration_settings (key, value, description) VALUES (?, ?, ?)',
      [
        'triage_visibility_policy',
        JSON.stringify({ triage_required_for_team: true, allowed_roles: ['super_admin', 'support_manager'] }),
        'Requires tickets to be in TRIAGED status before becoming visible to all regular team members',
      ]
    );
  }
}

/**
 * Thread-safe, atomic human-readable ticket number generator (e.g. WEB-1001)
 */
export async function getNextTicketNumber(prefix = 'WEB'): Promise<string> {
  const db = getDb();
  const tx = await db.transaction();
  try {
    // Check if counter exists
    const counterRes = await tx.execute({
      sql: 'SELECT current_val FROM ticket_counters WHERE prefix = ?',
      args: [prefix],
    });

    let nextVal = 1001;
    if (counterRes.rows.length === 0) {
      await tx.execute({
        sql: 'INSERT INTO ticket_counters (prefix, current_val) VALUES (?, ?)',
        args: [prefix, nextVal],
      });
    } else {
      nextVal = Number(counterRes.rows[0].current_val) + 1;
      await tx.execute({
        sql: 'UPDATE ticket_counters SET current_val = ? WHERE prefix = ?',
        args: [nextVal, prefix],
      });
    }

    await tx.commit();
    return `${prefix}-${nextVal}`;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
