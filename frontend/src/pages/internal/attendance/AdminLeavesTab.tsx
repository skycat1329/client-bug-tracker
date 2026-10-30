import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client.js';
import { LeaveRequest } from './types.js';
import { ReviewLeaveModal } from './ReviewLeaveModal.js';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Sun,
  HeartPulse,
  Sparkles,
  ShieldAlert,
  FileText,
  User,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const AdminLeavesTab: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [search, setSearch] = useState('');
  const [selectedLeaveForReview, setSelectedLeaveForReview] = useState<LeaveRequest | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchAdminLeaves = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter !== 'ALL') q.set('status', statusFilter);
      if (search.trim()) q.set('search', search.trim());

      const res: any = await api.get(`/admin/leaves?${q.toString()}`);
      if (res.success) {
        setLeaves(res.data || []);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load admin leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminLeaves();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAdminLeaves();
  };

  const getLeaveTypeBadge = (type: string) => {
    switch (type) {
      case 'sick':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <HeartPulse size={12} /> Sick Leave
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Sparkles size={12} /> Paid Privilege
          </span>
        );
      case 'emergency':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert size={12} /> Emergency Leave
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <FileText size={12} /> Unpaid Leave
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Sun size={12} /> Casual Leave
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 size={13} className="text-emerald-600" /> APPROVED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200/80">
            <XCircle size={13} className="text-rose-600" /> REJECTED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> PENDING REVIEW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Check size={16} className="text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Staff Applications
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
            {summary.total}
          </div>
          <div className="text-xs text-slate-500 mt-1">Across all team members</div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/60 p-4 sm:p-5 shadow-sm bg-gradient-to-br from-amber-50/40 to-transparent">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center justify-between">
            <span>Pending Review</span>
            {summary.pending > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">
            {summary.pending}
          </div>
          <div className="text-xs text-amber-800/80 mt-1">Requires HR verification</div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200/60 p-4 sm:p-5 shadow-sm bg-gradient-to-br from-emerald-50/40 to-transparent">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
            Approved
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">
            {summary.approved}
          </div>
          <div className="text-xs text-emerald-800/80 mt-1">Granted leaves</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Rejected
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-700 mt-1">
            {summary.rejected}
          </div>
          <div className="text-xs text-slate-500 mt-1">Declined applications</div>
        </div>
      </div>

      {/* Main Review Queue Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="text-indigo-600" size={20} />
              <span>Leave Approval & HR Review Queue</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review staff leave applications, verify reason and coverage, and approve or reject with comments.
            </p>
          </div>

          {/* Filter Pills & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === st
                    ? st === 'PENDING'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'PENDING' && summary.pending > 0 && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-300 mr-1.5 animate-pulse" />
                )}
                {st === 'ALL' ? 'All Requests' : st}
              </button>
            ))}

            <button
              onClick={fetchAdminLeaves}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors ml-auto lg:ml-0"
              title="Refresh queue"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/70">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search by staff name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-indigo-600" />
            <span>Loading leave queue...</span>
          </div>
        ) : leaves.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ShieldCheck size={24} />
            </div>
            <div className="text-sm font-bold text-slate-800">
              No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} Leave Requests Found
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {statusFilter === 'PENDING'
                ? 'All staff leave applications have been reviewed! Enjoy a clear queue.'
                : 'No leave applications match the selected status filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {leaves.map((l) => {
              const formattedDates =
                l.start_date === l.end_date
                  ? l.start_date
                  : `${l.start_date} to ${l.end_date}`;

              return (
                <div
                  key={l.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors space-y-3.5"
                >
                  {/* Top Bar: Applicant Info + Status + Review Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm border border-indigo-200 shrink-0">
                        {l.user_name ? l.user_name.charAt(0).toUpperCase() : <User size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                          <span>{l.user_name || 'Staff Member'}</span>
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {l.user_role}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">{l.user_email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {getStatusBadge(l.status)}
                      {l.status === 'PENDING' && (
                        <button
                          onClick={() => setSelectedLeaveForReview(l)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <ShieldCheck size={14} />
                          <span>Review & Decide</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                    <div className="sm:col-span-5 flex flex-col justify-center space-y-1">
                      <div className="flex items-center gap-2">
                        {getLeaveTypeBadge(l.leave_type)}
                        <span className="font-bold text-slate-900">
                          {l.total_days} {l.total_days === 1 ? 'Working Day' : 'Working Days'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{formattedDates}</span>
                        {l.day_fraction !== 'full' && (
                          <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            {l.day_fraction === 'first_half' ? 'First Half' : 'Second Half'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-7 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                      <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Staff Reason:
                      </div>
                      <p className="text-slate-700 italic font-normal">"{l.reason}"</p>
                    </div>
                  </div>

                  {/* Decision Trail (If already reviewed) */}
                  {l.status !== 'PENDING' && l.status !== 'CANCELLED' && (
                    <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-slate-600">
                        Decision recorded by <strong className="font-bold text-slate-800">{l.reviewer_name || 'HR Admin'}</strong>
                        {l.reviewed_at && <span className="text-slate-400 font-normal"> on {l.reviewed_at}</span>}
                      </div>
                      {l.review_remarks && (
                        <div className="text-slate-600 italic sm:text-right">
                          <span className="font-semibold not-italic text-slate-700">Remarks:</span> "{l.review_remarks}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      <ReviewLeaveModal
        leave={selectedLeaveForReview}
        onClose={() => setSelectedLeaveForReview(null)}
        onSuccess={() => {
          setToastMessage('Decision successfully recorded and employee notified!');
          setTimeout(() => setToastMessage(null), 3500);
          fetchAdminLeaves();
        }}
      />
    </div>
  );
};
