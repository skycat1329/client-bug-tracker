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
  can_manage_payroll?: boolean;
  can_manage_attendance?: boolean;
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

export type TaskStatus = 'PENDING_APPROVAL' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface Task {
  id: string;
  task_number: string;
  title: string;
  description: string | null;
  priority: TicketPriority;
  status: TaskStatus;
  assignee_id: string;
  assignee_name?: string;
  assignee_email?: string;
  creator_id: string;
  creator_name?: string;
  creator_email?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  deadline: string;
  completed_at?: string | null;
  completion_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type EmploymentType = 'full_time' | 'part_time' | 'internship';
export type OfferStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface SalaryBreakupItem {
  item: string;
  monthly: number;
  annual: number;
}

export interface OfferClause {
  id: string;
  title: string;
  content: string;
  is_default?: boolean;
}

export interface OfferLetter {
  id: string;
  offer_number: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string | null;
  candidate_address?: string | null;
  employment_type: EmploymentType;
  position: string;
  department: string;
  reporting_to: string;
  joining_date: string;
  work_location: string;
  laptop_required: boolean | number;
  work_mode: string;
  working_days: string;
  working_hours: string;
  monthly_salary: number;
  annual_ctc: number;
  payment_cycle: string;
  salary_breakup: SalaryBreakupItem[];
  clauses: OfferClause[];
  signatory_name: string;
  signatory_title: string;
  status: OfferStatus;
  sent_at?: string | null;
  sent_to_email?: string | null;
  view_token: string;
  created_by?: string;
  creator_name?: string;
  created_at: string;
  updated_at?: string;
}

export type PaySlipStatus = 'DRAFT' | 'GENERATED' | 'SENT';

export interface SalaryComponent {
  label: string;
  amount: number;
}

export interface PaySlip {
  id: string;
  slip_number: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  designation: string;
  department: string;
  date_of_joining?: string | null;
  month: string;
  year: number;
  total_working_days: number;
  lop_days: number;
  paid_days: number;
  bank_name: string;
  bank_account_no?: string | null;
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  total_earnings: number;
  total_deductions: number;
  net_pay: number;
  net_pay_words: string;
  signatory_label: string;
  status: PaySlipStatus;
  sent_at?: string | null;
  sent_to_email?: string | null;
  view_token: string;
  created_by?: string;
  creator_name?: string;
  created_at: string;
  updated_at?: string;
}

