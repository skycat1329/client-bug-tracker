import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Queue, User } from '../../types/index.js';
import {
  Layers,
  Plus,
  Users,
  Ticket,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

export const QueuesPage: React.FC = () => {
  const { user } = useAuth();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / Edit Queue Modal
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [queueName, setQueueName] = useState('');
  const [queueDescription, setQueueDescription] = useState('');
  const [queueColor, setQueueColor] = useState('blue');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Add Member Quick Modal
  const [quickAddQueueId, setQuickAddQueueId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState('');

  const isAdminOrManager = user?.role === 'super_admin' || user?.role === 'support_manager';

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [qRes, staffRes] = await Promise.all([
        api.get<{ queues: Queue[] }>('/queues'),
        api.get<{ staff: User[] }>('/auth/staff').catch(() => ({ staff: [] })),
      ]);
      setQueues(qRes.queues || []);
      setStaff(staffRes.staff || []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load queues');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Real-time polling every 8 seconds
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const openCreateModal = () => {
    setEditingQueue(null);
    setQueueName('');
    setQueueDescription('');
    setQueueColor('blue');
    setSelectedMemberIds([]);
    setShowQueueModal(true);
  };

  const openEditModal = (q: Queue) => {
    setEditingQueue(q);
    setQueueName(q.name);
    setQueueDescription(q.description || '');
    setQueueColor(q.color || 'blue');
    setSelectedMemberIds((q.members || []).map((m) => m.id));
    setShowQueueModal(true);
  };

  const handleSaveQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueName.trim()) return;

    setSubmitting(true);
    try {
      if (editingQueue) {
        await api.put(`/queues/${editingQueue.id}`, {
          name: queueName.trim(),
          description: queueDescription.trim(),
          color: queueColor,
          member_ids: selectedMemberIds,
        });
      } else {
        await api.post('/queues', {
          name: queueName.trim(),
          description: queueDescription.trim(),
          color: queueColor,
          member_ids: selectedMemberIds,
        });
      }
      setShowQueueModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save queue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQueue = async (queue: Queue) => {
    if (!confirm(`Are you sure you want to delete the '${queue.name}' queue? Tickets in this queue will become unassigned.`)) {
      return;
    }
    try {
      await api.delete(`/queues/${queue.id}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete queue');
    }
  };

  const handleRemoveMember = async (queueId: string, memberId: string) => {
    try {
      await api.delete(`/queues/${queueId}/members/${memberId}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member from queue');
    }
  };

  const handleQuickAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddQueueId || !targetUserId) return;
    try {
      await api.post(`/queues/${quickAddQueueId}/members`, {
        user_id: targetUserId,
      });
      setQuickAddQueueId(null);
      setTargetUserId('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add developer to queue');
    }
  };

  const colorOptions = [
    { id: 'blue', label: 'Blue', bg: 'bg-blue-100 text-blue-800 border-blue-300' },
    { id: 'emerald', label: 'Green', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    { id: 'purple', label: 'Purple', bg: 'bg-purple-100 text-purple-800 border-purple-300' },
    { id: 'amber', label: 'Amber', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
    { id: 'rose', label: 'Rose', bg: 'bg-rose-100 text-rose-800 border-rose-300' },
    { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  ];

  const getColorClass = (col: string) => {
    const found = colorOptions.find((c) => c.id === col);
    return found ? found.bg : 'bg-blue-100 text-blue-800 border-blue-300';
  };

  return (
    <div className="py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Ticket Queues & Developer Assignments
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Separate incident queues ensure tickets are routed directly to authorized developers. Team members only see tickets belonging to their assigned queues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            title="Refresh queues"
          >
            <RefreshCw size={15} />
          </button>

          {isAdminOrManager && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Create New Queue</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-medium">Loading Queues & Assignments...</span>
        </div>
      ) : queues.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <Layers size={36} className="mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">No Queues Configured Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create queues (e.g. Frontend, Backend, Urgent) and assign developers to govern ticket visibility.
          </p>
          {isAdminOrManager && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Plus size={14} /> Create First Queue
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
          {queues.map((q) => {
            const members = q.members || [];
            return (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getColorClass(q.color)}`}>
                        {q.name}
                      </span>
                    </div>

                    {isAdminOrManager && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(q)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Queue"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteQueue(q)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Queue"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {q.description && (
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      {q.description}
                    </p>
                  )}

                  {/* Metrics bar */}
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      <Ticket size={16} className="text-blue-600" />
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Open Tickets</div>
                        <div className="text-sm font-extrabold text-slate-800">{q.open_tickets_count || 0}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      <Users size={16} className="text-purple-600" />
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Assigned Team</div>
                        <div className="text-sm font-extrabold text-slate-800">{members.length} members</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Members Section */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Users size={13} className="text-slate-400" />
                      <span>Authorized Queue Developers ({members.length})</span>
                    </span>

                    {isAdminOrManager && (
                      <button
                        onClick={() => {
                          setQuickAddQueueId(q.id);
                          setTargetUserId('');
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        + Add Member
                      </button>
                    )}
                  </div>

                  {members.length === 0 ? (
                    <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-start gap-2">
                      <ShieldAlert size={14} className="flex-shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        No developers assigned yet. Only Super Admins can currently view tickets in this queue.
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 text-slate-800 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
                        >
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold uppercase">
                            {m.name.charAt(0)}
                          </span>
                          <span>{m.name}</span>
                          {isAdminOrManager && (
                            <button
                              onClick={() => handleRemoveMember(q.id, m.id)}
                              className="text-slate-400 hover:text-rose-600 ml-0.5 cursor-pointer"
                              title="Remove developer from queue"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Add Developer Modal */}
      {quickAddQueueId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Add Developer to Queue</h3>
              <button
                onClick={() => setQuickAddQueueId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickAddMember} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Team Member
                </label>
                <select
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Choose Developer / Staff --</option>
                  {staff
                    .filter((s) => s.role !== 'client')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email}) - {s.role}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickAddQueueId(null)}
                  className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!targetUserId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
                >
                  Add to Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Queue Modal */}
      {showQueueModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingQueue ? 'Edit Queue' : 'Create New Incident Queue'}
              </h3>
              <button
                onClick={() => setShowQueueModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQueue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Queue Name *
                </label>
                <input
                  type="text"
                  required
                  value={queueName}
                  onChange={(e) => setQueueName(e.target.value)}
                  placeholder="e.g. Frontend & UI Bugs, Security Escalations"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={queueDescription}
                  onChange={(e) => setQueueDescription(e.target.value)}
                  placeholder="Describe what category of bug tickets should be placed in this queue..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Color Tag
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setQueueColor(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${c.bg} ${
                        queueColor === c.id ? 'ring-2 ring-slate-900 ring-offset-1 scale-105' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assign Team Members (Who can see tickets in this queue)
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                  {staff
                    .filter((s) => s.role !== 'client')
                    .map((s) => {
                      const isChecked = selectedMemberIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMemberIds([...selectedMemberIds, s.id]);
                              } else {
                                setSelectedMemberIds(selectedMemberIds.filter((id) => id !== s.id));
                              }
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold text-slate-800">{s.name}</span>
                          <span className="text-[11px] text-slate-400">({s.email})</span>
                          <span className="ml-auto text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            {s.role}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQueueModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !queueName.trim()}
                  className="px-5 py-2 bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingQueue ? 'Save Changes' : 'Create Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
