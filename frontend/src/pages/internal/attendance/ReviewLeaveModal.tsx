import React, { useState } from 'react';
import { api } from '../../../api/client.js';
import { LeaveRequest } from './types.js';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Clock,
  User,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

interface ReviewLeaveModalProps {
  leave: LeaveRequest | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewLeaveModal: React.FC<ReviewLeaveModalProps> = ({
  leave,
  onClose,
  onSuccess,
}) => {
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!leave) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res: any = await api.post(`/admin/leaves/${leave.id}/review`, {
        action,
        remarks: remarks.trim(),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to submit review');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while reviewing leave');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDates =
    leave.start_date === leave.end_date
      ? leave.start_date
      : `${leave.start_date} to ${leave.end_date}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 sm:p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Review Leave Request</h2>
              <p className="text-xs text-slate-300">Verify and decide on employee leave application</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {/* Applicant Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm border border-blue-200">
                {leave.user_name ? leave.user_name.charAt(0).toUpperCase() : <User size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate">{leave.user_name || 'Staff Member'}</div>
                <div className="text-xs text-slate-500 truncate">{leave.user_email} • {leave.user_role}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 font-medium block">Leave Type:</span>
                <span className="font-bold text-slate-800 uppercase tracking-wider">{leave.leave_type} Leave</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Duration:</span>
                <span className="font-bold text-blue-700">{leave.total_days} {leave.total_days === 1 ? 'Day' : 'Days'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 font-medium block">Dates:</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Calendar size={13} className="text-slate-400" />
                  {formattedDates}
                  {leave.day_fraction !== 'full' && (
                    <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {leave.day_fraction === 'first_half' ? 'First Half' : 'Second Half'}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Reason */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Reason Stated by Staff:
              </div>
              <p className="text-slate-700 italic">"{leave.reason}"</p>
            </div>
          </div>

          {/* Decision Action Buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              HR / Admin Decision
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction('approve')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  action === 'approve'
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300'
                }`}
              >
                <CheckCircle2 size={16} />
                <span>Approve Request</span>
              </button>

              <button
                type="button"
                onClick={() => setAction('reject')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  action === 'reject'
                    ? 'border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-rose-300'
                }`}
              >
                <XCircle size={16} />
                <span>Reject Request</span>
              </button>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Reviewer Remarks / Feedback</span>
              <span className="text-[11px] font-normal text-slate-400">Optional</span>
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                action === 'approve'
                  ? 'e.g. Approved. Please ensure pending tasks are handed over.'
                  : 'e.g. Denied due to critical client sprint deadline.'
              }
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all ${
                action === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
              }`}
            >
              {action === 'approve' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {submitting
                ? 'Processing...'
                : action === 'approve'
                ? 'Confirm Approval'
                : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
