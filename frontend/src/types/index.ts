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
  phone?: string | null;
  name: string;
  role: UserRole;
  custom_role?: string | null;
  organization_id: string | null;
  organization_name?: string;
  avatar_url?: string | null;
  must_reset_password?: boolean | number;
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
  contact_name?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  website_url?: string | null;
  google_sheet_url?: string | null;
  status?: string | null;
  created_at: string;
}

export interface Website {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  environment: string;
  created_at: string;
  organization_name?: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  organization_id: string;
  organization_name?: string;
  website_id: string;
  website_name?: string;
  website_url?: string;
  requester_id: string;
  requester_name?: string;
  requester_email?: string;
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
  assignee_name?: string | null;
  assignee_email?: string | null;
  queue_id?: string | null;
  queue_name?: string | null;
  queue_color?: string | null;
  source: string;
  root_cause?: string | null;
  fix_details?: string | null;
  resolution_notes?: string | null;
  target_response_time: string | null;
  target_resolution_time: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  is_internal: number | boolean;
  content: string;
  created_at: string;
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
  is_internal: number | boolean;
  created_at: string;
  uploader_name?: string;
}

export interface TicketActivity {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: string;
  details: any;
  is_internal: number | boolean;
  created_at: string;
  user_name?: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  category: string | null;
  website_id: string | null;
  website_name?: string;
  priority: string | null;
  default_assignee_id: string;
  default_assignee_name?: string;
  is_active: number | boolean;
  created_at: string;
}

export interface QueueMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  custom_role?: string | null;
}

export interface Queue {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  is_active: number | boolean;
  created_at: string;
  open_tickets_count?: number;
  members_count?: number;
  members?: QueueMember[];
}
