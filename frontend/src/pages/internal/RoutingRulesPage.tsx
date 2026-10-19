import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { RoutingRule, Website } from '../../types/index.js';
import { GitBranch, Plus, Trash2, ArrowRight } from 'lucide-react';

export const RoutingRulesPage: React.FC = () => {
  const { demoUsers } = useAuth();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [showAdd, setShowAdd] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [category, setCategory] = useState('');
  const [websiteId, setWebsiteId] = useState('');
  const [priority, setPriority] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  const [staffUsers, setStaffUsers] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [rulesRes, sitesRes, staffRes] = await Promise.all([
        api.get<{ rules: RoutingRule[] }>('/routing-rules'),
        api.get<{ websites: Website[] }>('/organizations/all-websites'),
        api.get<{ staff: any[] }>('/auth/staff').catch(() => ({ staff: [] })),
      ]);
      setRules(rulesRes.rules || []);
      setWebsites(sitesRes.websites || []);
      setStaffUsers(staffRes.staff || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/routing-rules', {
        name: ruleName,
        category: category || null,
        website_id: websiteId || null,
        priority: priority || null,
        default_assignee_id: assigneeId,
        is_active: true,
      });

      setRuleName('');
      setCategory('');
      setWebsiteId('');
      setPriority('');
      setAssigneeId('');
      setShowAdd(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this routing rule?')) return;
    try {
      await api.delete(`/routing-rules/${id}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete rule');
    }
  };

  const availableStaff =
    staffUsers.length > 0
      ? staffUsers
      : demoUsers.filter((u) => ['developer', 'support_manager', 'super_admin'].includes(u.role));

  return (
    <div className="py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Automated Ticket Routing Rules
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automatically dispatch new customer bug reports to specific developers based on category, website, or severity.
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-500/20"
        >
          <Plus size={14} />
          Add Routing Rule
        </button>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading routing rules...</div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No routing rules configured. Tickets will default to the unassigned triage queue.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Rule Name</th>
                  <th className="py-3 px-4">Trigger Condition</th>
                  <th className="py-3 px-4">Default Assignee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-xs">
                      {r.name}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.category && (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                            Category: {r.category}
                          </span>
                        )}
                        {r.website_name && (
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                            Site: {r.website_name}
                          </span>
                        )}
                        {r.priority && (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                            Priority: {r.priority}
                          </span>
                        )}
                        {!r.category && !r.website_name && !r.priority && (
                          <span className="text-slate-400 italic">Catch-all</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-800">
                      👤 {r.default_assignee_name}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200 text-[11px]">
                        Active
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteRule(r.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Rule Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateRule} className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg">Add Automatic Routing Rule</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Rule Name *
              </label>
              <input
                type="text"
                required
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g. Checkout bugs -> Senior Dev"
                className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Match Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                >
                  <option value="">Any Category</option>
                  <option value="Checkout & Payments">Checkout & Payments</option>
                  <option value="Forms & Leads">Forms & Leads</option>
                  <option value="UI / Mobile Navigation">UI / Mobile Navigation</option>
                  <option value="Visual & Layout">Visual & Layout</option>
                  <option value="Authentication & Accounts">Authentication & Accounts</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Match Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                >
                  <option value="">Any Priority</option>
                  <option value="P1">P1 Critical</option>
                  <option value="P2">P2 High</option>
                  <option value="P3">P3 Normal</option>
                  <option value="P4">P4 Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Match Specific Website
              </label>
              <select
                value={websiteId}
                onChange={(e) => setWebsiteId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs"
              >
                <option value="">Any Website</option>
                {websites.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.organization_name} — {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Default Assignee *
              </label>
              <select
                required
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs font-semibold"
              >
                <option value="">Select Developer / Manager</option>
                {availableStaff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 border rounded-lg text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
              >
                Save Rule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
