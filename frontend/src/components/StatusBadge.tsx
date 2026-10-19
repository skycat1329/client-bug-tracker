import React from 'react';
import { TicketStatus } from '../types/index.js';

interface StatusBadgeProps {
  status: TicketStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config: Record<
    TicketStatus,
    { label: string; bg: string; text: string; dot: string; border: string }
  > = {
    NEW: {
      label: 'New',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      dot: 'bg-blue-500',
      border: 'border-blue-200',
    },
    TRIAGED: {
      label: 'Triaged',
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      dot: 'bg-indigo-500',
      border: 'border-indigo-200',
    },
    ASSIGNED: {
      label: 'Assigned',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      dot: 'bg-purple-500',
      border: 'border-purple-200',
    },
    'IN PROGRESS': {
      label: 'In Progress',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      border: 'border-amber-200',
    },
    'WAITING FOR CLIENT': {
      label: 'Waiting for Client',
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      dot: 'bg-sky-500',
      border: 'border-sky-200',
    },
    'FIX READY FOR TESTING': {
      label: 'Fix Ready for QA',
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      dot: 'bg-teal-500',
      border: 'border-teal-200',
    },
    RESOLVED: {
      label: 'Resolved',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      border: 'border-emerald-200',
    },
    CLOSED: {
      label: 'Closed',
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      dot: 'bg-slate-400',
      border: 'border-slate-200',
    },
  };

  const current = config[status] || {
    label: status,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    dot: 'bg-slate-500',
    border: 'border-slate-200',
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${current.bg} ${current.text} ${current.border} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
};
