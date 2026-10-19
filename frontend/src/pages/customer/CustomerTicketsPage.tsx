import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Ticket } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import { Search, Plus, ExternalLink, RefreshCw } from 'lucide-react';

interface CustomerTicketsPageProps {
  onSelectTicket: (ticketId: string) => void;
  onNewTicket: () => void;
}

export const CustomerTicketsPage: React.FC<CustomerTicketsPageProps> = ({
  onSelectTicket,
  onNewTicket,
}) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED' | 'CLOSED'>('ALL');

  const fetchTickets = () => {
    setLoading(true);
    api.get<{ tickets: Ticket[] }>('/tickets')
      .then((res) => setTickets(res.tickets || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'ACTIVE') {
      return !['RESOLVED', 'CLOSED'].includes(t.status);
    }
    if (statusFilter === 'RESOLVED') {
      return t.status === 'RESOLVED';
    }
    if (statusFilter === 'CLOSED') {
      return t.status === 'CLOSED';
    }
    return true;
  });

  const activeCount = tickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status)).length;
  const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED').length;

  return (
    <div className="py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {user?.organization_name || 'Brand'} Support Portal
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track and report website defects across all your brand properties.
          </p>
        </div>

        <button
          onClick={onNewTicket}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors shadow-blue-500/20"
        >
          <Plus size={16} />
          Report Bug
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active Issues
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{activeCount}</div>
          <div className="text-xs text-slate-400 mt-1">In triage, assigned or under development</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ready for Verification
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{resolvedCount}</div>
          <div className="text-xs text-slate-400 mt-1">Resolved by team, awaiting your confirmation</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Tickets Logged
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{tickets.length}</div>
          <div className="text-xs text-slate-400 mt-1">Total lifetime tickets for your organization</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search tickets by ID or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {(
            [
              { id: 'ALL', label: 'All Tickets' },
              { id: 'ACTIVE', label: `Active (${activeCount})` },
              { id: 'RESOLVED', label: `Resolved (${resolvedCount})` },
              { id: 'CLOSED', label: 'Closed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            onClick={fetchTickets}
            title="Refresh tickets"
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500 font-medium">No bug reports match your filter.</p>
            <button
              onClick={onNewTicket}
              className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              + Submit a new bug report
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Title & Website</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Support Contact</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTicket(t.id)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold text-blue-600 text-xs">
                      {t.ticket_number}
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {t.title}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{t.website_name || 'Website'}</span>
                        <span>•</span>
                        <span className="capitalize">{t.environment}</span>
                        <span>•</span>
                        <span>{t.category}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={t.priority} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={t.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {t.assignee_name ? (
                        <span className="font-medium text-slate-800">👤 {t.assignee_name}</span>
                      ) : (
                        <span className="text-slate-400 italic">In agency triage</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(t.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs">
                      <span className="text-blue-600 group-hover:underline font-medium inline-flex items-center gap-1">
                        View <ExternalLink size={12} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
