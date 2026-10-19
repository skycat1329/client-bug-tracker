import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { History, RefreshCw, Lock } from 'lucide-react';

interface AuditLogsPageProps {
  onSelectTicket: (ticketId: string) => void;
}

export const AuditLogsPage: React.FC<AuditLogsPageProps> = ({ onSelectTicket }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = () => {
    setLoading(true);
    api.get<{ logs: any[] }>('/audit/logs')
      .then((res) => setLogs(res.logs || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <History className="text-blue-600" size={26} />
            Agency Audit Ledger & Activity History
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tamper-evident record of all ticket actions, status transitions, developer assignments, and note submissions.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh Audit Trail
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading audit trail...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No audit logs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Ticket</th>
                  <th className="py-2.5 px-4">Client Brand</th>
                  <th className="py-2.5 px-4">Actor / User</th>
                  <th className="py-2.5 px-4">Details</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-bold text-slate-800">
                        {log.action}
                      </span>
                      {log.is_internal && (
                        <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          Internal
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        onClick={() => onSelectTicket(log.ticket_id)}
                        className="font-mono font-bold text-blue-600 hover:underline"
                      >
                        {log.ticket_number}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-700">
                      {log.organization_name}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {log.user_name || 'System / Automated'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate font-mono text-[11px]">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
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
