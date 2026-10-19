export type UserRole = 'super_admin' | 'support_manager' | 'developer' | 'client';

export type TicketStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN PROGRESS'
  | 'WAITING FOR CLIENT'
  | 'FIX READY FOR TESTING'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  name: string;
  role: UserRole;
  custom_role?: string | null;
  organization_id: string | null;
  organization_name?: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  label: string;
  description: string;
  color: string;
  base_role: UserRole;
  is_system: number | boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Website {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  environment: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  organization_id: string;
  website_id: string;
  requester_id: string;
  title: string;
  description: string;
  steps_to_reproduce: string | null;
  browser: string | null;
  device: string | null;
  environment: string | null;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee_id: string | null;
  source: string;
  root_cause: string | null;
  fix_details: string | null;
  resolution_notes: string | null;
  target_response_time: string | null;
  target_resolution_time: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields for convenience
  organization_name?: string;
  website_name?: string;
  website_url?: string;
  requester_name?: string;
  requester_email?: string;
  assignee_name?: string | null;
  assignee_email?: string | null;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  is_internal: boolean;
  content: string;
  created_at: string;

  // Joined
  user_name?: string;
  user_role?: UserRole;
  user_custom_role?: string | null;
  user_organization_name?: string | null;
  user_email?: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  comment_id: string | null;
  uploader_id: string;
  filename: string;
  stored_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  is_internal: boolean;
  created_at: string;
  uploader_name?: string;
}

export interface TicketActivity {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: string;
  details: any;
  is_internal: boolean;
  created_at: string;
  user_name?: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  category: string | null;
  website_id: string | null;
  priority: string | null;
  default_assignee_id: string;
  is_active: boolean;
  created_at: string;
  default_assignee_name?: string;
}

export interface NotificationDelivery {
  id: string;
  channel: 'slack' | 'email';
  recipient: string;
  event: string;
  ticket_id: string | null;
  payload: any;
  status: 'delivered' | 'failed' | 'mocked';
  attempts: number;
  error_message: string | null;
  created_at: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  name?: string;
  role: UserRole;
  organizationId: string | null;
}

export interface AuthenticatedUser extends AuthTokenPayload {
  name: string;
}
