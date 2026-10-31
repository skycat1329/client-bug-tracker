import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client.js';
import {
  X,
  Calendar,
  Clock,
  Send,
  AlertCircle,
  Sparkles,
  HeartPulse,
  Sun,
  ShieldAlert,
  FileText,
  HelpCircle,
} from 'lucide-react';

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [leaveType, setLeaveType] = useState<
    'casual' | 'sick' | 'paid' | 'unpaid' | 'emergency' | 'other'
  >('casual');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [dayFraction, setDayFraction] = useState<'full' | 'first_half' | 'second_half'>('full');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setLeaveType('casual');
      setStartDate(todayStr);
      setEndDate(todayStr);
      setDayFraction('full');
      setReason('');
      setError(null);
    }
  }, [isOpen, todayStr]);

  if (!isOpen) return null;

  // Calculate live duration
  let calculatedDays = 1.0;
  if (startDate && endDate) {
    if (startDate === endDate) {
      calculatedDays = dayFraction === 'full' ? 1.0 : 0.5;
    } else {
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      if (e >= s) {
        calculatedDays = Math.round((e - s) / 86400000) + 1;
      } else {
        calculatedDays = 0;
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError('Start date and end date are required');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be earlier than start date');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for your leave request');
      return;
    }

    setSubmitting(true);
    try {
      const res: any = await api.post('/leaves/apply', {
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        day_fraction: startDate === endDate ? dayFraction : 'full',
        reason: reason.trim(),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to submit leave request');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting leave');
    } finally {
      setSubmitting(false);
    }
  };

  const leaveTypesConfig = [
    {
      id: 'casual' as const,
      name: 'Casual Leave',
      icon: Sun,
      color: 'border-blue-200 bg-blue-50/60 text-blue-700 hover:border-blue-400',
      activeColor: 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-500/20',
    },
    {
      id: 'sick' as const,
      name: 'Sick Leave',
      icon: HeartPulse,
      color: 'border-amber-200 bg-amber-50/60 text-amber-700 hover:border-amber-400',
      activeColor: 'border-amber-600 bg-amber-600 text-white shadow-md shadow-amber-500/20',
    },
    {
      id: 'paid' as const,
      name: 'Paid Privilege',
      icon: Sparkles,
      color: 'border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:border-emerald-400',
      activeColor: 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-500/20',
    },
    {
      id: 'emergency' as const,
      name: 'Emergency',
      icon: ShieldAlert,
      color: 'border-rose-200 bg-rose-50/60 text-rose-700 hover:border-rose-400',
      activeColor: 'border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-500/20',
    },
    {
      id: 'unpaid' as const,
      name: 'Unpaid / LWP',
      icon: FileText,
      color: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400',
      activeColor: 'border-slate-700 bg-slate-700 text-white shadow-md shadow-slate-500/20',
    },
    {
      id: 'other' as const,
      name: 'Other Leave',
      icon: HelpCircle,
      color: 'border-purple-200 bg-purple-50/60 text-purple-700 hover:border-purple-400',
      activeColor: 'border-purple-600 bg-purple-600 text-white shadow-md shadow-purple-500/20',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 p-4 sm:p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Apply for Leave</h2>
              <p className="text-xs text-slate-300">Submit your leave request for HR/Admin approval</p>
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {/* Leave Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Leave Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {leaveTypesConfig.map((item) => {
                const Icon = item.icon;
                const isSelected = leaveType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLeaveType(item.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 text-xs font-semibold ${
                      isSelected ? item.activeColor : item.color
                    }`}
                  >
                    <Icon size={15} className={`shrink-0 ${isSelected ? 'text-white' : ''}`} />
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (new Date(e.target.value) > new Date(endDate)) {
                    setEndDate(e.target.value);
                  }
                }}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Day Fraction Option (Only if single day) */}
          {startDate === endDate && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Duration Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'full', label: 'Full Day (1.0)' },
                  { id: 'first_half', label: 'First Half (0.5)' },
                  { id: 'second_half', label: 'Second Half (0.5)' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDayFraction(f.id as any)}
                    className={`py-2 px-2 text-center rounded-xl text-xs font-semibold border transition-all ${
                      dayFraction === f.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Calculated Duration Indicator */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-center justify-between text-xs text-blue-900">
            <span className="font-semibold flex items-center gap-1.5">
              <Clock size={14} className="text-blue-600" /> Total Duration:
            </span>
            <span className="font-black text-sm text-blue-700">
              {calculatedDays} {calculatedDays === 1 ? 'Working Day' : 'Working Days'}
            </span>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Reason for Leave</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Attending a family function, medical appointment, personal emergency..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
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
              disabled={submitting || calculatedDays <= 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all"
            >
              <Send size={14} />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
