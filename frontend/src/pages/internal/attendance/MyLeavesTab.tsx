import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client.js';
import { LeaveRequest, LeaveSummary } from './types.js';
import { ApplyLeaveModal } from './ApplyLeaveModal.js';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Sun,
  HeartPulse,
  Sparkles,
  ShieldAlert,
  FileText,
  HelpCircle,
  Trash2,
  UserCheck,
  Check,
} from 'lucide-react';

export const MyLeavesTab: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [summary, setSummary] = useState<LeaveSummary>({
    total_requests: 0,
    pending_count: 0,
    approved_count: 0,
    approved_days: 0,
    rejected_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/leaves/my');
      if (res.success) {
        setLeaves(res.data || []);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load my leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleCancelLeave = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) {
      return;
    }

    setCancellingId(id);
    try {
      const res: any = await api.post(`/leaves/${id}/cancel`, {});
      if (res.success) {
        setCancelSuccessMsg('Leave request cancelled successfully.');
        setTimeout(() => setCancelSuccessMsg(null), 3000);
        await fetchLeaves();
      } else {
        alert(res.error || 'Failed to cancel leave');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while cancelling leave');
    } finally {
      setCancellingId(null);
    }
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
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> PENDING HR APPROVAL
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cancel Toast */}
      {cancelSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Check size={16} className="text-emerald-600" />
          <span>{cancelSuccessMsg}</span>
        </div>
      )}

      {/* Top Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Requests
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
            {summary.total_requests}
          </div>
          <div className="text-xs text-slate-500 mt-1">Lifetime applications</div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/60 p-4 sm:p-5 shadow-sm bg-gradient-to-br from-amber-50/40 to-transparent">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center justify-between">
            <span>Pending Review</span>
            {summary.pending_count > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">
            {summary.pending_count}
          </div>
          <div className="text-xs text-amber-800/80 mt-1">Awaiting HR verification</div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200/60 p-4 sm:p-5 shadow-sm bg-gradient-to-br from-emerald-50/40 to-transparent">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
            Approved Leaves
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">
            {summary.approved_count}
          </div>
          <div className="text-xs text-emerald-800/80 mt-1">
            Total Approved: <strong className="font-bold">{summary.approved_days} Days</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Rejected
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-700 mt-1">
            {summary.rejected_count}
          </div>
          <div className="text-xs text-slate-500 mt-1">Requests declined</div>
        </div>
      </div>

      {/* Main Leave Records List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header Action Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="text-blue-600" size={20} />
              <span>My Leave Records & History</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review your requested leaves, track approvals, and view HR remarks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLeaves}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Refresh leave requests"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setShowApplyModal(true)}
              className="px-4 py-2 sm:px-5 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all"
            >
              <Plus size={16} />
              <span>Apply for Leave</span>
            </button>
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span>Loading leave records...</span>
          </div>
        ) : leaves.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto">
              <Sun size={24} />
            </div>
            <div className="text-sm font-bold text-slate-800">No Leave Requests Raised Yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven't submitted any leave applications. Click "Apply for Leave" above whenever you need time off.
            </p>
            <button
              onClick={() => setShowApplyModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Apply for Leave
            </button>
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
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {getLeaveTypeBadge(l.leave_type)}
                      <span className="text-xs font-black text-slate-800">
                        {l.total_days} {l.total_days === 1 ? 'Working Day' : 'Working Days'}
                      </span>
                      {l.day_fraction !== 'full' && (
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {l.day_fraction === 'first_half' ? 'First Half (0.5)' : 'Second Half (0.5)'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {getStatusBadge(l.status)}
                      {l.status === 'PENDING' && (
                        <button
                          onClick={() => handleCancelLeave(l.id)}
                          disabled={cancellingId === l.id}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors flex items-center gap-1"
                          title="Cancel this leave request"
                        >
                          <Trash2 size={12} />
                          {cancellingId === l.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dates & Reason */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                    <div className="sm:col-span-4 flex items-center gap-2 text-slate-700 font-semibold">
                      <Calendar size={14} className="text-blue-500 shrink-0" />
                      <span>{formattedDates}</span>
                    </div>

                    <div className="sm:col-span-8 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                      <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Reason:
                      </div>
                      <p className="text-slate-700 italic font-normal">"{l.reason}"</p>
                    </div>
                  </div>

                  {/* HR Review Remarks (If reviewed) */}
                  {l.status !== 'PENDING' && l.status !== 'CANCELLED' && (
                    <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserCheck size={14} className="text-slate-500 shrink-0" />
                        <span className="text-slate-600">
                          Reviewed by <strong className="font-bold text-slate-800">{l.reviewer_name || 'HR Admin'}</strong>
                          {l.reviewed_at && (
                            <span className="text-slate-400 font-normal"> on {l.reviewed_at}</span>
                          )}
                        </span>
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

      {/* Apply Leave Modal */}
      <ApplyLeaveModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        onSuccess={() => {
          fetchLeaves();
        }}
      />
    </div>
  );
};
