import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Ticket, Organization, Website } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import {
  Search,
  Download,
  Filter,
  RefreshCw,
  ExternalLink,
  UserCheck,
} from 'lucide-react';

interface InternalTicketListPageProps {
  initialFilter?: 'my-tickets' | 'all';
  onSelectTicket: (ticketId: string) => void;
}

export const InternalTicketListPage: React.FC<InternalTicketListPageProps> = ({
  initialFilter = 'all',
  onSelectTicket,
}) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [myAssignedOnly, setMyAssignedOnly] = useState(initialFilter === 'my-tickets');

  const fetchTickets = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedOrg) params.append('organization_id', selectedOrg);
    if (selectedStatus) params.append('status', selectedStatus);
    if (selectedPriority) params.append('priority', selectedPriority);
    if (search) params.append('search', search);
    if (myAssignedOnly) params.append('my_assigned', 'true');

    const queryStr = params.toString() ? `?${params.toString()}` : '';

    api.get<{ tickets: Ticket[] }>(`/tickets${queryStr}`)
      .then((res) => setTickets(res.tickets || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Fetch organizations for filter dropdown
    api.get<{ organizations: Organization[] }>('/organizations')
      .then((res) => setOrganizations(res.organizations || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [selectedOrg, selectedStatus, selectedPriority, myAssignedOnly]);

  const handleExportCSV = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/tickets/export/csv?token=${token}`, '_blank');
  };

  return (
    <div className="py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {myAssignedOnly ? 'My Assigned Tickets' : 'All Client Tickets'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage ticket assignments, update status, triage incidents, and inspect audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user?.role === 'developer' && (
            <button
              onClick={() => setMyAssignedOnly(!myAssignedOnly)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                myAssignedOnly
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <UserCheck size={14} />
              {myAssignedOnly ? 'Showing My Tickets' : 'Filter My Tickets'}
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTickets()}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          {/* Org Filter */}
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="TRIAGED">Triaged</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN PROGRESS">In Progress</option>
            <option value="WAITING FOR CLIENT">Waiting for Client</option>
            <option value="FIX READY FOR TESTING">Fix Ready for QA</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            <option value="P1">P1 — Critical</option>
            <option value="P2">P2 — High</option>
            <option value="P3">P3 — Normal</option>
            <option value="P4">P4 — Low</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No tickets match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Title & Details</th>
                  <th className="py-3 px-4">Brand / Site</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTicket(t.id)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-blue-600">
                      {t.ticket_number}
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600 truncate">
                        {t.title}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {t.category} • {t.environment}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="font-semibold text-slate-800">{t.organization_name}</div>
                      <div className="text-slate-400 text-[11px] truncate">{t.website_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={t.priority} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={t.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {t.assignee_name ? (
                        <span className="font-medium text-slate-800">👤 {t.assignee_name}</span>
                      ) : (
                        <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(t.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs">
                      <span className="text-blue-600 font-medium group-hover:underline inline-flex items-center gap-1">
                        Open <ExternalLink size={12} />
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
