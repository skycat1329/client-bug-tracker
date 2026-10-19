import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Ticket } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Users,
  Flame,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface AdminDashboardPageProps {
  onSelectTicket: (ticketId: string) => void;
  onNavigate: (view: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onSelectTicket,
  onNavigate,
}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ tickets: Ticket[] }>('/tickets')
      .then((res) => setTickets(res.tickets || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const openTickets = tickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status));
  const p1Tickets = tickets.filter((t) => t.priority === 'P1' && t.status !== 'CLOSED');
  const inProgress = tickets.filter((t) => t.status === 'IN PROGRESS');
  const unassigned = tickets.filter((t) => !t.assignee_id && !['RESOLVED', 'CLOSED'].includes(t.status));
  const resolved = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');

  return (
    <div className="py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Agency Support Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Operational overview of client websites, incident triage, and SLA resolution health.
          </p>
        </div>

        <button
          onClick={() => onNavigate('tickets')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          View All Tickets <ArrowRight size={14} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Backlog
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{openTickets.length}</div>
            <div className="text-xs text-blue-600 mt-1 font-medium">{inProgress.length} In Progress</div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm flex items-center justify-between bg-rose-50/20">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-rose-600">
              P1 Critical Outages
            </div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{p1Tickets.length}</div>
            <div className="text-xs text-rose-500 mt-1 font-medium">Urgent attention required</div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
            <Flame size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between bg-amber-50/20">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Unassigned Triage
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{unassigned.length}</div>
            <div className="text-xs text-amber-500 mt-1 font-medium">Needs routing or developer claim</div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between bg-emerald-50/20">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Resolved & Closed
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{resolved.length}</div>
            <div className="text-xs text-emerald-600 mt-1 font-medium">Delivered to clients</div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Two Column Grid: Critical/Triage Queue & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent Action Needed (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base">Priority Triage & Outage Queue</h3>
            <span className="text-xs font-medium text-slate-400">P1 and Unassigned tickets</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading triage queue...</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {openTickets
                .filter((t) => t.priority === 'P1' || !t.assignee_id)
                .slice(0, 6)
                .map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket.id)}
                    className="py-3.5 hover:bg-slate-50 flex items-center justify-between gap-4 cursor-pointer group transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-600">
                          {ticket.ticket_number}
                        </span>
                        <PriorityBadge priority={ticket.priority} size="sm" />
                        <span className="text-xs font-semibold text-slate-500">
                          {ticket.organization_name}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 truncate">
                        {ticket.title}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={ticket.status} size="sm" />
                      <span className="text-xs font-medium text-blue-600 group-hover:underline">
                        Review →
                      </span>
                    </div>
                  </div>
                ))}
              {openTickets.filter((t) => t.priority === 'P1' || !t.assignee_id).length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">
                  🎉 No urgent outages or unassigned tickets pending triage!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Priority Breakdown Card (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-base">Priority Distribution</h3>

          <div className="space-y-3">
            {[
              { label: 'P1 — Critical Outage', priority: 'P1', color: 'bg-rose-500', count: tickets.filter((t) => t.priority === 'P1').length },
              { label: 'P2 — High Impact', priority: 'P2', color: 'bg-orange-500', count: tickets.filter((t) => t.priority === 'P2').length },
              { label: 'P3 — Normal Defect', priority: 'P3', color: 'bg-blue-500', count: tickets.filter((t) => t.priority === 'P3').length },
              { label: 'P4 — Minor Improvement', priority: 'P4', color: 'bg-slate-400', count: tickets.filter((t) => t.priority === 'P4').length },
            ].map((p) => {
              const pct = tickets.length > 0 ? Math.round((p.count / tickets.length) * 100) : 0;
              return (
                <div key={p.priority} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>{p.label}</span>
                    <span className="font-bold">{p.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${p.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
            Target response times: P1: 1hr • P2: 4hr • P3: 8hr • P4: 24hr. Automatic Slack notifications trigger upon creation and assignment.
          </div>
        </div>
      </div>
    </div>
  );
};
