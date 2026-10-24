import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Task, TaskStatus, TicketPriority } from '../../types/index.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import {
  CheckSquare,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Search,
  Filter,
  FileSpreadsheet,
  Send,
  Trash2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Inbox,
  Check,
  X,
  FileText,
} from 'lucide-react';

export const TasksPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'support_manager';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'pending' | 'completed'>(isAdmin ? 'all' : 'my');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    priority: 'P2' as TicketPriority,
    deadline: '',
    assignee_id: user?.id || '',
  });

  // Complete modal
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [submittingComplete, setSubmittingComplete] = useState(false);

  // Reject modal
  const [rejectingTask, setRejectingTask] = useState<Task | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Action status message
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchTasksAndStaff = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [tasksRes, staffRes] = await Promise.all([
        api.get<{ tasks: Task[] }>('/tasks'),
        api.get<{ staff: any[] }>('/auth/staff').catch(() => ({ staff: [] })),
      ]);
      setTasks(tasksRes.tasks || []);
      setStaff(staffRes.staff || []);
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
      setActionNotice({ type: 'error', message: err.message || 'Failed to fetch tasks' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksAndStaff();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTasksAndStaff(true);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => {
      setActionNotice(null);
    }, 5000);
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = tasks.length;
    const myTasks = tasks.filter(t => t.assignee_id === user?.id && t.status !== 'COMPLETED' && t.status !== 'REJECTED');
    const pendingApproval = tasks.filter(t => t.status === 'PENDING_APPROVAL');
    const completed = tasks.filter(t => t.status === 'COMPLETED');

    const now = new Date();
    const overdue = tasks.filter(t => {
      if (t.status === 'COMPLETED' || t.status === 'REJECTED') return false;
      return new Date(t.deadline) < now;
    });

    return {
      total,
      myCount: myTasks.length,
      pendingCount: pendingApproval.length,
      completedCount: completed.length,
      overdueCount: overdue.length,
    };
  }, [tasks, user?.id]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Tab filter
      if (activeTab === 'my' && task.assignee_id !== user?.id) return false;
      if (activeTab === 'pending' && task.status !== 'PENDING_APPROVAL') return false;
      if (activeTab === 'completed' && task.status !== 'COMPLETED') return false;

      // Priority filter
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesNumber = task.task_number.toLowerCase().includes(query);
        const matchesAssignee = task.assignee_name?.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesNumber && !matchesAssignee && !matchesDesc) return false;
      }

      return true;
    });
  }, [tasks, activeTab, priorityFilter, searchQuery, user?.id]);

  // Create Task Handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.deadline) {
      showNotification('error', 'Please fill in the task title and target deadline');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        priority: createForm.priority,
        deadline: createForm.deadline,
        assignee_id: isAdmin ? createForm.assignee_id : user?.id,
      };

      const res = await api.post<{ success: boolean; task: Task; message?: string }>('/tasks', payload);
      setShowCreateModal(false);
      setCreateForm({
        title: '',
        description: '',
        priority: 'P2',
        deadline: '',
        assignee_id: user?.id || '',
      });
      showNotification(
        'success',
        isAdmin
          ? `Task ${res.task.task_number} created and assigned. Email notification dispatched.`
          : `Task ${res.task.task_number} submitted for Admin approval.`
      );
      await fetchTasksAndStaff(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  // Admin Approve Task
  const handleApprove = async (task: Task) => {
    try {
      await api.post(`/tasks/${task.id}/approve`, {});
      showNotification('success', `Task ${task.task_number} approved! Assigned notification sent to member.`);
      await fetchTasksAndStaff(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to approve task');
    }
  };

  // Admin Reject Task
  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingTask) return;
    setSubmittingReject(true);
    try {
      await api.post(`/tasks/${rejectingTask.id}/reject`, { reason: rejectionReason });
      setRejectingTask(null);
      setRejectionReason('');
      showNotification('success', `Task ${rejectingTask.task_number} rejected.`);
      await fetchTasksAndStaff(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to reject task');
    } finally {
      setSubmittingReject(false);
    }
  };

  // Complete Task
  const handleCompleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask) return;
    setSubmittingComplete(true);
    try {
      await api.post(`/tasks/${completingTask.id}/complete`, { notes: completionNotes });
      setCompletingTask(null);
      setCompletionNotes('');
      showNotification('success', `Task ${completingTask.task_number} marked as COMPLETED! Synced to Google Sheets.`);
      await fetchTasksAndStaff(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to complete task');
    } finally {
      setSubmittingComplete(false);
    }
  };

  // Admin Delete Task
  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Are you sure you want to permanently delete task ${task.task_number}?`)) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      showNotification('success', `Task ${task.task_number} deleted.`);
      await fetchTasksAndStaff(true);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete task');
    }
  };

  // Deadline formatting & SLA calculations
  const getDeadlineInfo = (task: Task) => {
    const deadlineDate = new Date(task.deadline);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const isCompleted = task.status === 'COMPLETED';

    if (isCompleted) {
      return {
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        text: `Completed on ${task.completed_at ? new Date(task.completed_at).toLocaleDateString() : 'Finished'}`,
        isOverdue: false,
      };
    }

    if (diffMs < 0) {
      const hoursAgo = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)));
      const daysAgo = Math.floor(hoursAgo / 24);
      return {
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
        text: daysAgo > 0 ? `Overdue by ${daysAgo}d` : `Overdue by ${hoursAgo}h`,
        isOverdue: true,
      };
    }

    const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
    const daysLeft = Math.floor(hoursLeft / 24);

    if (hoursLeft <= 24) {
      return {
        badgeColor: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
        text: `Due in ${hoursLeft}h`,
        isOverdue: false,
      };
    }

    return {
      badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
      text: `Due in ${daysLeft}d (${deadlineDate.toLocaleDateString()})`,
      isOverdue: false,
    };
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-md transition-all ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {actionNotice.type === 'success' ? (
              <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-blue-50 text-[#0176D3]">
              <CheckSquare size={20} />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Team Tasks &amp; Deadlines</h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            {isAdmin
              ? 'Assign sprint tasks with SLA deadlines, monitor developer progress, review member-submitted proposals, and automatically sync completed work with Google Sheets.'
              : 'Track your assigned sprint tasks, stay ahead of deadlines, and log your self-managed tasks for admin approval.'}
          </p>
        </div>

        <button
          onClick={() => {
            setCreateForm({
              title: '',
              description: '',
              priority: 'P2',
              deadline: '',
              assignee_id: user?.id || (staff[0]?.id || ''),
            });
            setShowCreateModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Plus size={16} />
          <span>{isAdmin ? 'Assign New Task' : 'Propose Task for Approval'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Tasks</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Tracked in database</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">My Active Tasks</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{stats.myCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Assigned to your queue</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-amber-600 tracking-wider flex items-center justify-between">
            <span>Pending Approval</span>
            {stats.pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.pendingCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Proposed by members</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-rose-600 tracking-wider flex items-center justify-between">
            <span>Overdue SLA</span>
            {stats.overdueCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">{stats.overdueCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Passed deadline threshold</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs col-span-2 lg:col-span-1">
          <div className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Completed</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.completedCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
            <FileSpreadsheet size={11} className="text-emerald-600" />
            <span>Synced to Sheet</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#0176D3] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Team Tasks ({tasks.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('my')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'my'
                  ? 'bg-[#0176D3] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Assigned to Me ({tasks.filter(t => t.assignee_id === user?.id).length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Pending Approval</span>
              {stats.pendingCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  activeTab === 'pending' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-800'
                }`}>
                  {stats.pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Completed ({tasks.filter(t => t.status === 'COMPLETED').length})
            </button>
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs p-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
            >
              <option value="ALL">All Priorities</option>
              <option value="P1">P1 - Critical (24h)</option>
              <option value="P2">P2 - High (48h)</option>
              <option value="P3">P3 - Medium (72h)</option>
              <option value="P4">P4 - Low</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks by title, task # (e.g. TSK-1001), assignee, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3] bg-slate-50/50"
          />
        </div>
      </div>

      {/* Task List Table / Cards */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-400">
          Loading tasks and team assignments...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
          <Inbox size={32} className="mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700 text-sm">No tasks found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeTab === 'pending'
              ? 'There are no member proposals pending approval right now.'
              : activeTab === 'my'
              ? 'You have no active tasks assigned to your queue.'
              : 'No tasks match the active filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const deadlineInfo = getDeadlineInfo(task);
            const isAssignedToMe = task.assignee_id === user?.id;
            const canComplete = (isAssignedToMe || isAdmin) && task.status !== 'COMPLETED' && task.status !== 'REJECTED' && task.status !== 'PENDING_APPROVAL';
            const isPending = task.status === 'PENDING_APPROVAL';

            return (
              <div
                key={task.id}
                className={`bg-white rounded-xl border transition-all p-4 shadow-xs hover:shadow-sm ${
                  deadlineInfo.isOverdue ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left Column: Number, Title, Details */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0176D3] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {task.task_number}
                      </span>
                      <PriorityBadge priority={task.priority} />

                      {/* Status Badges */}
                      {task.status === 'PENDING_APPROVAL' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <Clock size={11} />
                          <span>Pending Approval</span>
                        </span>
                      )}
                      {task.status === 'ASSIGNED' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#0176D3] border border-blue-200 flex items-center gap-1">
                          <CheckCircle size={11} />
                          <span>Assigned &amp; Active</span>
                        </span>
                      )}
                      {task.status === 'COMPLETED' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle size={11} />
                          <span>Completed</span>
                        </span>
                      )}
                      {task.status === 'REJECTED' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                          <XCircle size={11} />
                          <span>Rejected</span>
                        </span>
                      )}

                      {/* Deadline SLA Pill */}
                      <span className={`text-[11px] px-2.5 py-0.5 rounded border flex items-center gap-1 ${deadlineInfo.badgeColor}`}>
                        <Calendar size={11} />
                        <span>{deadlineInfo.text}</span>
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Metadata Subline */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                      <div className="flex items-center gap-1">
                        <User size={12} className="text-slate-400" />
                        <span>Assigned to:</span>
                        <strong className="text-slate-800">{task.assignee_name || 'Unassigned'}</strong>
                      </div>

                      {task.creator_id && task.creator_id !== task.assignee_id && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <span>&bull; Assigned by:</span>
                          <span className="text-slate-600 font-medium">{task.creator_name}</span>
                        </div>
                      )}

                      {task.creator_id && task.creator_id === task.assignee_id && isPending && (
                        <div className="flex items-center gap-1 text-amber-700 font-medium">
                          <span>&bull; Self-proposed by member</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-slate-400">
                        <span>&bull; Created:</span>
                        <span>{new Date(task.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Completion Notes display */}
                    {task.status === 'COMPLETED' && task.completion_notes && (
                      <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 mt-2 flex items-start gap-2">
                        <CheckCircle size={13} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-[11px] uppercase tracking-wider block text-emerald-900">Completion Report:</strong>
                          <span>{task.completion_notes}</span>
                        </div>
                      </div>
                    )}

                    {/* Rejection Reason display */}
                    {task.status === 'REJECTED' && task.rejection_reason && (
                      <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 text-xs text-rose-950 mt-2 flex items-start gap-2">
                        <XCircle size={13} className="text-rose-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-[11px] uppercase tracking-wider block text-rose-900">Rejection Reason:</strong>
                          <span>{task.rejection_reason}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Context Actions */}
                  <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 flex-shrink-0">
                    {/* Admin Approval Actions */}
                    {isAdmin && isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(task)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                        >
                          <Check size={13} />
                          <span>Approve</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRejectingTask(task);
                            setRejectionReason('');
                          }}
                          className="px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <X size={13} />
                          <span>Reject</span>
                        </button>
                      </>
                    )}

                    {/* Mark Complete Action */}
                    {canComplete && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompletingTask(task);
                          setCompletionNotes('');
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <CheckCircle size={14} />
                        <span>Mark Complete</span>
                      </button>
                    )}

                    {/* Admin Delete Action */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task)}
                        title="Delete task"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / PROPOSE TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#0176D3] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare size={18} />
                <h2 className="text-sm font-bold">
                  {isAdmin ? 'Assign New Team Task' : 'Propose New Task for Admin Approval'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4 text-xs">
              {/* Task Title */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[10px]">
                  Task Title / Action Item <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement Webhook retry queue / Fix checkout mobile CSS"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              {/* Task Description */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[10px]">
                  Description &amp; Acceptance Criteria
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide scope, branch reference, testing requirements, or API details..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3] resize-none"
                />
              </div>

              {/* Priority & Deadline Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[10px]">
                    Priority Level <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TicketPriority })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3] bg-white"
                  >
                    <option value="P1">P1 - Critical Priority</option>
                    <option value="P2">P2 - High Priority</option>
                    <option value="P3">P3 - Medium Priority</option>
                    <option value="P4">P4 - Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[10px]">
                    Target Deadline <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={createForm.deadline}
                    onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3] bg-white"
                  />
                </div>
              </div>

              {/* Assignee Selection (Admin only) */}
              {isAdmin ? (
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[10px]">
                    Assignee Specialist <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.assignee_id}
                    onChange={(e) => setCreateForm({ ...createForm, assignee_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3] bg-white"
                  >
                    {staff.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email}) &bull; {m.custom_role || m.role}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-blue-700 mt-1 flex items-center gap-1">
                    <span>⚡ Member will immediately receive an email notification with deadline details.</span>
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <Clock size={12} className="text-amber-600" />
                    <span>Admin Approval Notice</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    This task will be self-assigned to your account and placed in <strong>Pending Approval</strong> state. Once an Admin approves it, you will receive an email confirmation and it will become active.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-[#0176D3] hover:bg-[#014486] text-white font-bold rounded-lg shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {creating ? 'Saving Task...' : isAdmin ? 'Assign Task & Send Email' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK COMPLETE MODAL */}
      {completingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} />
                <h2 className="text-sm font-bold">Mark Task as Completed</h2>
              </div>
              <button
                type="button"
                onClick={() => setCompletingTask(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCompleteConfirm} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="font-mono text-[11px] text-[#0176D3] font-bold">
                  {completingTask.task_number}
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  {completingTask.title}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[10px]">
                  Completion Notes / Deliverable Links (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Deployed to staging, confirmed fix with regression tests, PR #42 merged..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px] flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-emerald-700 flex-shrink-0" />
                <span>This completion will be permanently logged in the Agency Task Google Spreadsheet.</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCompletingTask(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingComplete}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {submittingComplete ? 'Saving...' : 'Confirm Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle size={18} />
                <h2 className="text-sm font-bold">Reject Member Task Proposal</h2>
              </div>
              <button
                type="button"
                onClick={() => setRejectingTask(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRejectConfirm} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="font-mono text-[11px] text-[#0176D3] font-bold">
                  {rejectingTask.task_number}
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  {rejectingTask.title}
                </div>
                <div className="text-[11px] text-slate-500">
                  Proposed by: {rejectingTask.creator_name} ({rejectingTask.creator_email})
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[10px]">
                  Reason for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this task cannot be approved or what changes are required..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRejectingTask(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReject}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
