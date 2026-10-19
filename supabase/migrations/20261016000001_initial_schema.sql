-- ==============================================================================
-- Client Bug Tracker: Initial Database Migration (Supabase PostgreSQL Compatible)
-- Schema, Sequences, Tables, Constraints, Indexes, Triggers & Row-Level Security
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 1001 INCREMENT BY 1;

-- 3. TABLES

-- Organizations (Client Brands)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users / Profiles
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'support_manager', 'developer', 'client')),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

-- Websites Managed for Brands
CREATE TABLE IF NOT EXISTS websites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    steps_to_reproduce TEXT,
    browser VARCHAR(100),
    device VARCHAR(100),
    environment VARCHAR(50) DEFAULT 'production',
    category VARCHAR(100) NOT NULL,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    status VARCHAR(50) NOT NULL DEFAULT 'NEW' CHECK (
        status IN (
            'NEW', 'TRIAGED', 'ASSIGNED', 'IN PROGRESS',
            'WAITING FOR CLIENT', 'FIX READY FOR TESTING', 'RESOLVED', 'CLOSED'
        )
    ),
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    source VARCHAR(50) DEFAULT 'portal',
    root_cause TEXT,
    fix_details TEXT,
    resolution_notes TEXT,
    target_response_time TIMESTAMP WITH TIME ZONE,
    target_resolution_time TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Comments (Public Replies vs Internal Notes)
CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES ticket_comments(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Assignments History
CREATE TABLE IF NOT EXISTS ticket_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    assigner_id UUID NOT NULL REFERENCES users(id),
    assignee_id UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Activity & Audit Ledger
CREATE TABLE IF NOT EXISTS ticket_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification Deliveries (Slack Webhook & Email Deliveries)
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel VARCHAR(50) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    event VARCHAR(100) NOT NULL,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Routing Rules (Category / Website to Default Assignee)
CREATE TABLE IF NOT EXISTS routing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
    priority VARCHAR(10),
    default_assignee_id UUID NOT NULL REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Integration Settings (Slack webhook, email providers, etc.)
CREATE TABLE IF NOT EXISTS integration_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_tickets_organization_id ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_website_id ON tickets(website_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket_id ON ticket_activity(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);

-- 5. TRIGGERS: Auto-generate Ticket Number (e.g. WEB-1001)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
        NEW.ticket_number := 'WEB-' || NEXTVAL('ticket_number_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_ticket_number ON tickets;
CREATE TRIGGER trigger_generate_ticket_number
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION generate_ticket_number();

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Helper to extract user organization from JWT
CREATE OR REPLACE FUNCTION get_auth_org_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id', '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_auth_role() RETURNS TEXT AS $$
    SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role';
$$ LANGUAGE sql STABLE;

-- Ticket RLS: Agency staff see all tickets; clients see only their organization
CREATE POLICY staff_all_tickets ON tickets
    FOR ALL
    USING (get_auth_role() IN ('super_admin', 'support_manager', 'developer'));

CREATE POLICY client_org_tickets ON tickets
    FOR ALL
    USING (get_auth_role() = 'client' AND organization_id = get_auth_org_id());

-- Comment RLS: Staff see all comments; clients see ONLY non-internal comments for their org's tickets
CREATE POLICY staff_all_comments ON ticket_comments
    FOR ALL
    USING (get_auth_role() IN ('super_admin', 'support_manager', 'developer'));

CREATE POLICY client_public_comments ON ticket_comments
    FOR SELECT
    USING (
        get_auth_role() = 'client'
        AND is_internal = FALSE
        AND ticket_id IN (SELECT id FROM tickets WHERE organization_id = get_auth_org_id())
    );

CREATE POLICY client_insert_comment ON ticket_comments
    FOR INSERT
    WITH CHECK (
        get_auth_role() = 'client'
        AND is_internal = FALSE
        AND ticket_id IN (SELECT id FROM tickets WHERE organization_id = get_auth_org_id())
    );
