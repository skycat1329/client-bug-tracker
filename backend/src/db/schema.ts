export const INITIAL_SCHEMA_SQL = `
-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Users / Profiles
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'support_manager', 'developer', 'client')),
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(organization_id, user_id)
);

-- Websites
CREATE TABLE IF NOT EXISTS websites (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'production',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Atomic sequence counter for human-readable IDs (e.g. WEB-1001)
CREATE TABLE IF NOT EXISTS ticket_counters (
    prefix TEXT PRIMARY KEY,
    current_val INTEGER NOT NULL DEFAULT 1000
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    requester_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    steps_to_reproduce TEXT,
    browser TEXT,
    device TEXT,
    environment TEXT DEFAULT 'production',
    category TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (
        status IN (
            'NEW', 'TRIAGED', 'ASSIGNED', 'IN PROGRESS',
            'WAITING FOR CLIENT', 'FIX READY FOR TESTING', 'RESOLVED', 'CLOSED'
        )
    ),
    assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    source TEXT DEFAULT 'portal',
    root_cause TEXT,
    fix_details TEXT,
    resolution_notes TEXT,
    target_response_time TEXT,
    target_resolution_time TEXT,
    resolved_at TEXT,
    closed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Ticket Comments (public vs internal notes)
CREATE TABLE IF NOT EXISTS ticket_comments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    is_internal INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Ticket Attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    comment_id TEXT REFERENCES ticket_comments(id) ON DELETE CASCADE,
    uploader_id TEXT NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    is_internal INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Ticket Assignment History
CREATE TABLE IF NOT EXISTS ticket_assignments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    assigner_id TEXT NOT NULL REFERENCES users(id),
    assignee_id TEXT NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Ticket Activity / Audit Ledger
CREATE TABLE IF NOT EXISTS ticket_activity (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    is_internal INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Notification Deliveries (Slack & Email)
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    recipient TEXT NOT NULL,
    event TEXT NOT NULL,
    ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Routing Rules
CREATE TABLE IF NOT EXISTS routing_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    website_id TEXT REFERENCES websites(id) ON DELETE CASCADE,
    priority TEXT,
    default_assignee_id TEXT NOT NULL REFERENCES users(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Integration Settings
CREATE TABLE IF NOT EXISTS integration_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_org ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_website ON tickets(website_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_activity_ticket ON ticket_activity(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON ticket_attachments(ticket_id);
`;
