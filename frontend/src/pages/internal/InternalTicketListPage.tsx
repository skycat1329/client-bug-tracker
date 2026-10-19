import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Ticket, Organization, Queue } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import { getTicketSla } from '../../utils/sla.js';
import {
  Search,
  Download,
  Filter,
  RefreshCw,
  ExternalLink,
  UserCheck,
  Layers,
  Clock,
  Sparkles,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Flame,
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
  const [queues, setQueues] = useState<Queue[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Filters
  const [search, setSearch] = useState('');
  const [selectedQueue, setSelectedQueue] = useState('');
  const [selectedSlaStage, setSelectedSlaStage] = useState<'all' | 'green' | 'yellow' | 'orange' | 'red' | 'p1'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [myAssignedOnly, setMyAssignedOnly] = useState(initialFilter === 'my-tickets');

  const isDeveloper = user?.role === 'developer';
  const isAdminOrManager = user?.role === 'super_admin' || user?.role === 'support_manager';

  const fetchTickets = (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams();
    if (selectedOrg && !isDeveloper) params.append('organization_id', selectedOrg);
    if (selectedQueue) params.append('queue_id', selectedQueue);
    if (selectedStatus) params.append('status', selectedStatus);
    if (selectedPriority) params.append('priority', selectedPriority);
    if (search) params.append('search', search);
    if (myAssignedOnly) params.append('assignee_id', user?.id || '');

    const queryStr = params.toString() ? `?${params.toString()}` : '';

    api.get<{ tickets: Ticket[] }>(`/tickets${queryStr}`)
      .then((res) => {
        setTickets(res.tickets || []);
        setLastUpdated(new Date());
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    // Fetch Queues and Organizations
    Promise.all([
      api.get<{ queues: Queue[] }>('/queues').catch(() => ({ queues: [] })),
      !isDeveloper
        ? api.get<{ organizations: Organization[] }>('/organizations').catch(() => ({ organizations: [] }))
        : Promise.resolve({ organizations: [] }),
    ]).then(([qRes, orgRes]) => {
      setQueues(qRes.queues || []);
      setOrganizations(orgRes.organizations || []);
    });
  }, [isDeveloper]);

  useEffect(() => {
    fetchTickets();

    // Real-time smart polling every 6 seconds when tab is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTickets(true);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [selectedQueue, selectedOrg, selectedStatus, selectedPriority, myAssignedOnly, search]);

  const handleExportCSV = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/tickets/export/csv?token=${token}`, '_blank');
  };

  const handleQuickAssignQueue = async (ticketId: string, queueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.patch(`/tickets/${ticketId}`, { queue_id: queueId });
      fetchTickets(true);
    } catch (err: any) {
      alert(err.message || 'Failed to reassign queue');
    }
  };

  // Filter by SLA Aging stage if selected
  const filteredTickets = tickets.filter((t) => {
    if (selectedSlaStage === 'all') return true;
    if (selectedSlaStage === 'p1') return t.priority === 'P1';
    const sla = getTicketSla(t);
    return sla.stage === selectedSlaStage;
  });

  // Calculate SLA breakdown counts
  const slaCounts = {
    all: tickets.length,
    green: tickets.filter((t) => getTicketSla(t).stage === 'green').length,
    yellow: tickets.filter((t) => getTicketSla(t).stage === 'yellow').length,
    orange: tickets.filter((t) => getTicketSla(t).stage === 'orange').length,
    red: tickets.filter((t) => getTicketSla(t).stage === 'red').length,
    p1: tickets.filter((t) => t.priority === 'P1' && !['RESOLVED', 'CLOSED'].includes(t.status)).length,
  };

  return (
    <div className="py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Header with Real-Time Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {myAssignedOnly ? 'My Assigned Tickets' : 'Incident Triage & Ticket Queues'}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Real-Time Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isDeveloper
              ? 'Viewing bugs assigned to your designated queues. Confidential client details are securely protected.'
              : 'Enterprise bug tracker with queue governance, real-time SLA tracking, and team triage.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {user?.role === 'developer' && (
            <button
              onClick={() => setMyAssignedOnly(!myAssignedOnly)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                myAssignedOnly
                  ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <UserCheck size={14} />
              {myAssignedOnly ? 'Showing My Tickets' : 'Filter My Tickets'}
            </button>
          )}

          <button
            onClick={() => fetchTickets(false)}
            className="p-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            title="Refresh list now"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 1. QUEUE TABS BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Layers size={14} className="text-blue-600" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Incident Queues
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedQueue('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedQueue === ''
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            All Queues ({tickets.length})
          </button>

          {queues.map((q) => {
            const isSelected = selectedQueue === q.id;
            return (
              <button
                key={q.id}
                onClick={() => setSelectedQueue(isSelected ? '' : q.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>{q.name}</span>
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {q.open_tickets_count ?? 0}
                </span>
              </button>
            );
          })}

          {isAdminOrManager && (
            <button
              onClick={() => setSelectedQueue('unassigned')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                selectedQueue === 'unassigned'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              ⚠️ Unassigned Queue
            </button>
          )}
        </div>
      </div>

      {/* 2. SLA AGING COLOR TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/70 p-2 rounded-2xl border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
            Aging SLA:
          </span>

          <button
            onClick={() => setSelectedSlaStage('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              selectedSlaStage === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Ages ({slaCounts.all})
          </button>

          <button
            onClick={() => setSelectedSlaStage('green')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedSlaStage === 'green'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>24h+ Green ({slaCounts.green})</span>
          </button>

          <button
            onClick={() => setSelectedSlaStage('yellow')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedSlaStage === 'yellow'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>48h+ Yellow ({slaCounts.yellow})</span>
          </button>

          <button
            onClick={() => setSelectedSlaStage('orange')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedSlaStage === 'orange'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-orange-400"></span>
            <span>72h+ Orange ({slaCounts.orange})</span>
          </button>

          <button
            onClick={() => setSelectedSlaStage('red')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedSlaStage === 'red'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 animate-pulse'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>96h+ Critical Red ({slaCounts.red})</span>
          </button>

          {slaCounts.p1 > 0 && (
            <button
              onClick={() => setSelectedSlaStage('p1')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                selectedSlaStage === 'p1'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-100 text-rose-900 border border-rose-300 hover:bg-rose-200'
              }`}
            >
              <Flame size={13} className="text-rose-600" />
              <span>P1 Urgent ({slaCounts.p1})</span>
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-400 hidden lg:block px-2">
          Sync: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

      {/* 3. Search & Detailed Filter Inputs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by WEB-#, title, keywords..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isDeveloper && organizations.length > 0 && (
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">All Brands</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="NEW">NEW</option>
            <option value="TRIAGED">TRIAGED</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="IN PROGRESS">IN PROGRESS</option>
            <option value="WAITING FOR CLIENT">WAITING FOR CLIENT</option>
            <option value="FIX READY FOR TESTING">FIX READY FOR TESTING</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="P1">P1 - Critical Blocker</option>
            <option value="P2">P2 - Major</option>
            <option value="P3">P3 - Moderate</option>
            <option value="P4">P4 - Minor</option>
          </select>
        </div>
      </div>

      {/* 4. TICKETS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && filteredTickets.length === 0 ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-medium">Loading tickets...</span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-16 text-center text-slate-500 space-y-2">
            <CheckCircle2 size={32} className="mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No Tickets Match Current Filters</h3>
            <p className="text-xs text-slate-400">Try adjusting the queue, status, or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Ticket & Queue</th>
                  <th className="py-3 px-4">Title & Problem</th>
                  {!isDeveloper && <th className="py-3 px-4">Brand / Client</th>}
                  <th className="py-3 px-4">Target Website</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Aging SLA Color</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((t) => {
                  const sla = getTicketSla(t);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTicket(t.id)}
                      className={`transition-colors cursor-pointer group ${sla.rowBorderLeft} ${sla.rowBg || 'hover:bg-blue-50/30'}`}
                    >
                      {/* Ticket Number & Queue Tag */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-xs text-blue-600 group-hover:underline">
                          {t.ticket_number}
                        </div>
                        {t.queue_name ? (
                          <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 border border-slate-200">
                            <Layers size={10} className="text-blue-500" />
                            <span>{t.queue_name}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                            No Queue
                          </div>
                        )}
                      </td>

                      {/* Title & Description */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 truncate text-xs">
                          {t.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {t.category} &bull; {t.environment}
                        </div>
                      </td>

                      {/* Brand Name (HIDDEN for developers, VISIBLE for Admin/Manager) */}
                      {!isDeveloper && (
                        <td className="py-3 px-4 text-xs">
                          <div className="font-bold text-slate-800">{t.organization_name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{t.requester_name}</div>
                        </td>
                      )}

                      {/* Target Website */}
                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-slate-700">{t.website_name || 'Main Website'}</div>
                        {t.website_url && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {t.website_url.replace(/^https?:\/\//, '')}
                          </div>
                        )}
                      </td>

                      {/* Priority Badge */}
                      <td className="py-3 px-4">
                        <PriorityBadge priority={t.priority} size="sm" />
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        <StatusBadge status={t.status} size="sm" />
                      </td>

                      {/* SLA Aging Pill with user requested color coding */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${sla.badgeBg} ${sla.badgeBorder}`}
                          title={sla.description}
                        >
                          <span className={`w-2 h-2 rounded-full ${sla.dotColor}`}></span>
                          <span>{sla.label}</span>
                        </span>
                      </td>

                      {/* Assignee & Quick Queue Reassignment */}
                      <td className="py-3 px-4 text-xs">
                        {t.assignee_name ? (
                          <span className="font-medium text-slate-800 flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold">
                              {t.assignee_name.charAt(0)}
                            </span>
                            <span>{t.assignee_name}</span>
                          </span>
                        ) : (
                          <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                            Unassigned
                          </span>
                        )}

                        {isAdminOrManager && queues.length > 0 && (
                          <select
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleQuickAssignQueue(t.id, e.target.value, e as any)}
                            value={t.queue_id || ''}
                            className="mt-1 text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 block text-slate-600 cursor-pointer"
                          >
                            <option value="">Move Queue...</option>
                            {queues.map((q) => (
                              <option key={q.id} value={q.id}>
                                {q.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right text-xs">
                        <span className="text-blue-600 font-bold group-hover:underline inline-flex items-center gap-1">
                          Open <ExternalLink size={12} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
