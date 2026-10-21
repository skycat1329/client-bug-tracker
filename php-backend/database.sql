-- ==============================================================================
-- Client Bug Tracker - MySQL / MariaDB Schema (Hostinger Compatible)
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Organizations (Brands)
CREATE TABLE IF NOT EXISTS `organizations` (
    `id` VARCHAR(64) PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL UNIQUE,
    `google_sheet_url` VARCHAR(500) NULL,
    `contact_email` VARCHAR(255) NULL,
    `contact_name` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `website_url` VARCHAR(500) NULL,
    `status` VARCHAR(50) DEFAULT 'active',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. System & Custom Roles
CREATE TABLE IF NOT EXISTS `roles` (
    `id` VARCHAR(64) PRIMARY KEY,
    `name` VARCHAR(64) NOT NULL UNIQUE,
    `label` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `color` VARCHAR(50) DEFAULT 'blue',
    `base_role` ENUM('super_admin', 'support_manager', 'developer', 'client') NOT NULL DEFAULT 'developer',
    `is_system` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Users / Profiles
CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(64) PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `phone` VARCHAR(50) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `role` ENUM('super_admin', 'support_manager', 'developer', 'client') NOT NULL,
    `custom_role` VARCHAR(64) NULL,
    `organization_id` VARCHAR(64) NULL,
    `avatar_url` VARCHAR(500) NULL,
    `must_reset_password` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_user_org` (`organization_id`),
    INDEX `idx_user_role` (`role`),
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Organization Members
CREATE TABLE IF NOT EXISTS `organization_members` (
    `id` VARCHAR(64) PRIMARY KEY,
    `organization_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `role` VARCHAR(50) NOT NULL DEFAULT 'member',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_org_user` (`organization_id`, `user_id`),
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Websites
CREATE TABLE IF NOT EXISTS `websites` (
    `id` VARCHAR(64) PRIMARY KEY,
    `organization_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `environment` VARCHAR(50) NOT NULL DEFAULT 'production',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_website_org` (`organization_id`),
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Ticket Sequence Counter
CREATE TABLE IF NOT EXISTS `ticket_counters` (
    `prefix` VARCHAR(20) PRIMARY KEY,
    `current_val` INT NOT NULL DEFAULT 1000
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tickets
CREATE TABLE IF NOT EXISTS `tickets` (
    `id` VARCHAR(64) PRIMARY KEY,
    `ticket_number` VARCHAR(30) NOT NULL UNIQUE,
    `organization_id` VARCHAR(64) NOT NULL,
    `website_id` VARCHAR(64) NOT NULL,
    `requester_id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` LONGTEXT NOT NULL,
    `steps_to_reproduce` TEXT NULL,
    `browser` VARCHAR(100) NULL,
    `device` VARCHAR(100) NULL,
    `environment` VARCHAR(50) DEFAULT 'production',
    `category` VARCHAR(100) NOT NULL,
    `priority` ENUM('P1', 'P2', 'P3', 'P4') NOT NULL DEFAULT 'P3',
    `status` ENUM(
        'NEW', 'TRIAGED', 'ASSIGNED', 'IN PROGRESS',
        'WAITING FOR CLIENT', 'FIX READY FOR TESTING', 'RESOLVED', 'CLOSED'
    ) NOT NULL DEFAULT 'NEW',
    `assignee_id` VARCHAR(64) NULL,
    `source` VARCHAR(50) DEFAULT 'portal',
    `root_cause` TEXT NULL,
    `fix_details` TEXT NULL,
    `resolution_notes` TEXT NULL,
    `target_response_time` DATETIME NULL,
    `target_resolution_time` DATETIME NULL,
    `resolved_at` DATETIME NULL,
    `closed_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_ticket_org` (`organization_id`),
    INDEX `idx_ticket_status` (`status`),
    INDEX `idx_ticket_priority` (`priority`),
    INDEX `idx_ticket_assignee` (`assignee_id`),
    INDEX `idx_ticket_created` (`created_at`),
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`),
    FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Ticket Comments (Internal vs Public)
CREATE TABLE IF NOT EXISTS `ticket_comments` (
    `id` VARCHAR(64) PRIMARY KEY,
    `ticket_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `is_internal` TINYINT(1) NOT NULL DEFAULT 0,
    `content` LONGTEXT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_comment_ticket` (`ticket_id`),
    FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Ticket Attachments
CREATE TABLE IF NOT EXISTS `ticket_attachments` (
    `id` VARCHAR(64) PRIMARY KEY,
    `ticket_id` VARCHAR(64) NOT NULL,
    `comment_id` VARCHAR(64) NULL,
    `uploader_id` VARCHAR(64) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `stored_filename` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_size` INT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `is_internal` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`uploader_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Ticket Assignments History
CREATE TABLE IF NOT EXISTS `ticket_assignments` (
    `id` VARCHAR(64) PRIMARY KEY,
    `ticket_id` VARCHAR(64) NOT NULL,
    `assigned_by` VARCHAR(64) NOT NULL,
    `assignee_id` VARCHAR(64) NOT NULL,
    `assigned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Ticket Audit Activity
CREATE TABLE IF NOT EXISTS `ticket_activity` (
    `id` VARCHAR(64) PRIMARY KEY,
    `ticket_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NULL,
    `action` VARCHAR(100) NOT NULL,
    `details` LONGTEXT NULL,
    `is_internal` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_activity_ticket` (`ticket_id`),
    FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Notification Deliveries
CREATE TABLE IF NOT EXISTS `notification_deliveries` (
    `id` VARCHAR(64) PRIMARY KEY,
    `channel` ENUM('slack', 'email') NOT NULL,
    `recipient` VARCHAR(255) NOT NULL,
    `event` VARCHAR(100) NOT NULL,
    `ticket_id` VARCHAR(64) NULL,
    `payload` LONGTEXT NULL,
    `status` ENUM('delivered', 'failed', 'mocked') NOT NULL,
    `attempts` INT DEFAULT 1,
    `error_message` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Routing Rules
CREATE TABLE IF NOT EXISTS `routing_rules` (
    `id` VARCHAR(64) PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NULL,
    `website_id` VARCHAR(64) NULL,
    `priority` VARCHAR(10) NULL,
    `default_assignee_id` VARCHAR(64) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`default_assignee_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Integration Settings
CREATE TABLE IF NOT EXISTS `integration_settings` (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` LONGTEXT NOT NULL,
    `description` VARCHAR(255) NULL,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Queues
CREATE TABLE IF NOT EXISTS `queues` (
    `id` VARCHAR(64) PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(50) DEFAULT 'blue',
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Queue Members
CREATE TABLE IF NOT EXISTS `queue_members` (
    `id` VARCHAR(64) PRIMARY KEY,
    `queue_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_queue_user` (`queue_id`, `user_id`),
    INDEX `idx_qm_queue` (`queue_id`),
    INDEX `idx_qm_user` (`user_id`),
    FOREIGN KEY (`queue_id`) REFERENCES `queues`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- Seed Initial Data
-- ==============================================================================

-- Initial Ticket Counter (Starts at 1000 so next is WEB-1001)
INSERT INTO `ticket_counters` (`prefix`, `current_val`) 
VALUES ('WEB', 1000)
ON DUPLICATE KEY UPDATE `prefix` = `prefix`;

-- Initial System Roles
INSERT INTO `roles` (`id`, `name`, `label`, `description`, `color`, `base_role`, `is_system`) VALUES
('role-admin', 'super_admin', 'Super Admin', 'Full access to manage agency, clients, routing and settings', 'purple', 'super_admin', 1),
('role-support', 'support_manager', 'Support Manager', 'Triage, assign, routing rules and client communications', 'blue', 'support_manager', 1),
('role-dev', 'developer', 'Developer', 'Assigned tickets, claim, internal notes and root cause fixes', 'emerald', 'developer', 1),
('role-qa', 'qa_lead', 'QA Lead', 'Test validation, reproduction specs, fix verification', 'teal', 'developer', 0),
('role-client', 'client', 'Client Brand User', 'Submit bug reports and track resolution', 'amber', 'client', 1)
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

-- Initial Triage Visibility Policy & Integrations
INSERT INTO `integration_settings` (`key`, `value`, `description`) VALUES
('triage_visibility_policy', 'false', 'Controls whether new tickets are hidden from team members until assigned/triaged'),
('google_sheets_config', '{"enabled":false,"global_webhook_url":"","create_brand_tabs":true,"sync_on_create":true,"sync_on_assign":true,"sync_on_status":true,"sync_on_comment":true}', 'Configuration for automatic real-time Google Sheets logging per brand'),
('whatsapp_config', '{"enabled":true,"gateway_url":"","admin_phone":"+919999999999","send_on_create":true,"send_on_assign":true,"send_on_status":true}', 'WhatsApp notifications configuration for brand and team dispatches')
ON DUPLICATE KEY UPDATE `key` = `key`;

-- Initial Default Queues
INSERT INTO `queues` (`id`, `name`, `slug`, `description`, `color`, `is_active`) VALUES
('q-assigned', 'Assigned & In Progress', 'assigned-in-progress', 'Tickets currently assigned or opened by engineering personnel', 'indigo', 1),
('q-frontend', 'Frontend & UI Bugs', 'frontend-ui', 'CSS, responsive display, layout issues, and React client bugs', 'blue', 1),
('q-backend', 'Backend & API', 'backend-api', 'PHP server logic, database records, and API endpoints', 'emerald', 1),
('q-urgent', 'Critical Escalations', 'critical-escalations', 'High priority blockers, checkout errors, server timeouts', 'rose', 1),
('q-general', 'General QA & Triage', 'general-qa', 'Initial bug reviews, reproduction tests, and customer QA', 'purple', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Primary Agency Super Admin (admin@agency.com / admin123)
INSERT INTO `users` (`id`, `email`, `password_hash`, `name`, `role`, `custom_role`, `organization_id`) VALUES
('usr-admin-primary', 'admin@agency.com', '$2a$10$eEWJg2OgWM22CA2JdMbMyuLcn.lTHjMOQKWJ0VwKjvJjXhrRTnn1a', 'Agency Administrator', 'super_admin', NULL, NULL)
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- Primary Developer (dev@agency.com / dev123)
INSERT INTO `users` (`id`, `email`, `password_hash`, `name`, `role`, `custom_role`, `organization_id`) VALUES
('usr-dev-primary', 'dev@agency.com', '$2a$10$eEWJg2OgWM22CA2JdMbMyuLcn.lTHjMOQKWJ0VwKjvJjXhrRTnn1a', 'Alex Developer', 'developer', NULL, NULL)
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);
