export interface LeaveRequest {
  id: number;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  avatar_url?: string;
  leave_type: 'casual' | 'sick' | 'paid' | 'unpaid' | 'emergency' | 'other';
  start_date: string;
  end_date: string;
  total_days: number;
  day_fraction: 'full' | 'first_half' | 'second_half';
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  review_remarks?: string;
  created_at: string;
  updated_at?: string;
}

export interface LeaveSummary {
  total_requests: number;
  pending_count: number;
  approved_count: number;
  approved_days: number;
  rejected_count: number;
}
