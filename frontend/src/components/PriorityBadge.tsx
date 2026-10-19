import React from 'react';
import { TicketPriority } from '../types/index.js';
import { AlertCircle, AlertTriangle, Info, Clock } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TicketPriority;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'md' }) => {
  const config = {
    P1: {
      label: 'P1 — Critical',
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: AlertCircle,
    },
    P2: {
      label: 'P2 — High',
      bg: 'bg-orange-50 text-orange-700 border-orange-200',
      icon: AlertTriangle,
    },
    P3: {
      label: 'P3 — Normal',
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Info,
    },
    P4: {
      label: 'P4 — Low',
      bg: 'bg-slate-50 text-slate-600 border-slate-200',
      icon: Clock,
    },
  }[priority] || {
    label: priority,
    bg: 'bg-slate-50 text-slate-600 border-slate-200',
    icon: Info,
  };

  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border ${config.bg} ${sizeClasses}`}
    >
      <Icon size={iconSize} className="flex-shrink-0" />
      <span>{config.label}</span>
    </span>
  );
};
