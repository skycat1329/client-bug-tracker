import { Ticket } from '../types/index.js';

export interface TicketSlaStatus {
  ageHours: number;
  stage: 'fresh' | 'green' | 'yellow' | 'orange' | 'red' | 'resolved';
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  rowBorderLeft: string;
  rowBg: string;
  dotColor: string;
  description: string;
}

/**
 * Calculates ticket aging and SLA color status:
 * - < 24h: No color (standard neutral / fresh)
 * - > 24h: Green 🟢 (24h - 48h)
 * - > 48h: Yellow 🟡 (48h - 72h)
 * - > 72h: Orange 🟠 (72h - 96h)
 * - > 96h: Red 🔴 (Critical overdue)
 * 
 * Also accelerated by brand priority:
 * - P1 Blocker: accelerates thresholds to >6h Green, >12h Yellow, >24h Orange, >36h Red
 */
export function getTicketSla(ticket: Ticket): TicketSlaStatus {
  if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
    return {
      ageHours: 0,
      stage: 'resolved',
      label: 'Resolved',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200',
      rowBorderLeft: 'border-l-transparent',
      rowBg: '',
      dotColor: 'bg-emerald-500',
      description: 'Completed and closed',
    };
  }

  const createdTime = new Date(ticket.created_at).getTime();
  const now = Date.now();
  const ageHours = Math.max(0, (now - createdTime) / (1000 * 60 * 60));

  const isP1 = ticket.priority === 'P1';
  const greenThreshold = isP1 ? 6 : 24;
  const yellowThreshold = isP1 ? 12 : 48;
  const orangeThreshold = isP1 ? 24 : 72;
  const redThreshold = isP1 ? 36 : 96;

  // < 24 hours: No color (Default neutral)
  if (ageHours < greenThreshold) {
    return {
      ageHours,
      stage: 'fresh',
      label: `< ${greenThreshold}h`,
      badgeBg: 'bg-slate-100',
      badgeText: 'text-slate-600',
      badgeBorder: 'border-slate-200',
      rowBorderLeft: 'border-l-transparent',
      rowBg: '',
      dotColor: 'bg-slate-300',
      description: 'Under 24h (Standard SLA window)',
    };
  }

  // > 24 hours: Green
  if (ageHours < yellowThreshold) {
    return {
      ageHours,
      stage: 'green',
      label: `${Math.floor(ageHours)}h (24h+)`,
      badgeBg: 'bg-emerald-50 text-emerald-800',
      badgeText: 'text-emerald-800',
      badgeBorder: 'border-emerald-300',
      rowBorderLeft: 'border-l-4 border-l-emerald-500',
      rowBg: 'bg-emerald-50/25',
      dotColor: 'bg-emerald-500',
      description: '24+ Hours Elapsed (First Milestone)',
    };
  }

  // > 48 hours (after another 24h): Yellow
  if (ageHours < orangeThreshold) {
    return {
      ageHours,
      stage: 'yellow',
      label: `${Math.floor(ageHours)}h (48h+)`,
      badgeBg: 'bg-amber-50 text-amber-800',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-300',
      rowBorderLeft: 'border-l-4 border-l-amber-500',
      rowBg: 'bg-amber-50/30',
      dotColor: 'bg-amber-500',
      description: '48+ Hours Elapsed (Needs Progress)',
    };
  }

  // > 72 hours (after another 24h): Orange
  if (ageHours < redThreshold) {
    return {
      ageHours,
      stage: 'orange',
      label: `${Math.floor(ageHours)}h (72h+)`,
      badgeBg: 'bg-orange-50 text-orange-800',
      badgeText: 'text-orange-800',
      badgeBorder: 'border-orange-300',
      rowBorderLeft: 'border-l-4 border-l-orange-500',
      rowBg: 'bg-orange-50/35',
      dotColor: 'bg-orange-500',
      description: '72+ Hours Elapsed (High Attention Required)',
    };
  }

  // > 96 hours (lastly): Red
  return {
    ageHours,
    stage: 'red',
    label: `${Math.floor(ageHours)}h (Critical 96h+)`,
    badgeBg: 'bg-rose-100 text-rose-800',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-400',
    rowBorderLeft: 'border-l-4 border-l-rose-500',
    rowBg: 'bg-rose-50/45',
    dotColor: 'bg-rose-600',
    description: '96+ Hours Overdue (Urgent Escalation)',
  };
}
