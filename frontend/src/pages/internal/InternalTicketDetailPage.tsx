import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Ticket,
  TicketComment,
  TicketAttachment,
  TicketActivity,
  TicketStatus,
  Queue,
} from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import { getTicketSla } from '../../utils/sla.js';
import {
  ArrowLeft,
  Send,
  Upload,
  Lock,
  MessageSquare,
  UserCheck,
  CheckCircle,
  AlertCircle,
  FileText,
  Download,
  Clock,
  ExternalLink,
  ChevronRight,
  Shield,
  Code,
  Sparkles,
  Layers,
  History,
  FileSpreadsheet,
  AlertTriangle,
  Image as ImageIcon,
  ZoomIn,
  X,
} from 'lucide-react';

interface InternalTicketDetailPageProps {
  ticketId: string;
  onBack: () => void;
}

export const InternalTicketDetailPage: React.FC<InternalTicketDetailPageProps> = ({
  ticketId,
  onBack,
}) => {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [activities, setActivities] = useState<TicketActivity[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; filename: string } | null>(null);

  // Salesforce Main View Tabs: Details | Chatter / Feed | Related / Audit
  const [activeTab, setActiveTab] = useState<'details' | 'chatter' | 'related'>('chatter');

  // Comment & Internal note form
  const [activeCommentTab, setActiveCommentTab] = useState<'public' | 'internal'>('public');
  const [commentText, setCommentText] = useState('');
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Status Modal & Double Verification
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);
  const [statusConfirmNotes, setStatusConfirmNotes] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [fixDetails, setFixDetails] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Assignment
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);

  const STAGES: TicketStatus[] = [
    'NEW',
    'TRIAGED',
    'ASSIGNED',
    'IN PROGRESS',
    'WAITING FOR CLIENT',
    'FIX READY FOR TESTING',
    'RESOLVED',
    'CLOSED',
  ];

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ticketRes, commentsRes, attachmentsRes, activitiesRes, dupsRes, staffRes, queuesRes] = await Promise.all([
        api.get<{ ticket: Ticket }>(`/tickets/${ticketId}`),
        api.get<{ comments: TicketComment[] }>(`/tickets/${ticketId}/comments`).catch(() => ({ comments: [] })),
        api.get<{ attachments: TicketAttachment[] }>(`/tickets/${ticketId}/attachments`).catch(() => ({ attachments: [] })),
        api.get<{ activities: TicketActivity[] }>(`/audit/tickets/${ticketId}/activity`).catch(() => ({ activities: [] })),
        api.get<{ duplicates: any[] }>(`/tickets/${ticketId}/duplicate-check`).catch(() => ({ duplicates: [] })),
        api.get<{ staff: any[] }>('/auth/staff').catch(() => ({ staff: [] })),
        api.get<{ queues: Queue[] }>('/queues').catch(() => ({ queues: [] })),
      ]);

      setTicket(ticketRes.ticket);
      setComments(commentsRes.comments || []);
      setAttachments(attachmentsRes.attachments || []);
      setActivities(activitiesRes.activities || []);
      setDuplicates(dupsRes.duplicates || []);
      setStaffUsers(staffRes.staff || []);
      setQueues(queuesRes.queues || []);
    } catch (err: any) {
      console.error('Failed to load data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Real-time polling every 6 seconds when active
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 6000);

    return () => clearInterval(timer);
  }, [ticketId]);

  const handleQueueChange = async (newQueueId: string) => {
    try {
      await api.patch(`/tickets/${ticketId}`, { queue_id: newQueueId });
      await loadData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket queue');
    }
  };

  // Status Change with Mandatory Double Verification Popup
  const handleStatusChange = (newStatus: TicketStatus) => {
    if (newStatus === ticket?.status) return;

    if (newStatus === 'RESOLVED') {
      setShowResolveModal(true);
      return;
    }

    setPendingStatus(newStatus);
    setStatusConfirmNotes('');
    setShowStatusConfirmModal(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingStatus) return;

    setStatusLoading(true);
    try {
      await api.patch(`/tickets/${ticketId}/status`, {
        status: pendingStatus,
        resolution_notes: statusConfirmNotes.trim() || undefined,
        notes: statusConfirmNotes.trim() || `Status updated to ${pendingStatus}`,
      });
      setShowStatusConfirmModal(false);
      setPendingStatus(null);
      setStatusConfirmNotes('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootCause.trim() || !fixDetails.trim()) {
      alert('Please provide both the root cause analysis and fix details.');
      return;
    }

    setStatusLoading(true);
    try {
      await api.patch(`/tickets/${ticketId}/status`, {
        status: 'RESOLVED',
        root_cause: rootCause.trim(),
        fix_details: fixDetails.trim(),
        resolution_notes: resolutionNotes.trim() || undefined,
        notes: `Ticket resolved by ${user?.name}. Ready for client verification.`,
      });
      setShowResolveModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to mark ticket resolved');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAssign = async (assigneeId: string) => {
    setAssigningLoading(true);
    try {
      await api.patch(`/tickets/${ticketId}/assign`, {
        assignee_id: assigneeId,
        notes: `Assigned via Assurance Media console`,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to assign ticket');
    } finally {
      setAssigningLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && !commentFile) return;

    setSubmittingComment(true);
    try {
      await api.post(`/tickets/${ticketId}/comments`, {
        content: commentText.trim(),
        is_internal: activeCommentTab === 'internal',
      });

      if (commentFile) {
        const formData = new FormData();
        formData.append('file', commentFile);
        formData.append('is_internal', activeCommentTab === 'internal' ? 'true' : 'false');
        await api.upload(`/tickets/${ticketId}/attachments`, formData);
        setCommentFile(null);
      }

      setCommentText('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleExportTicketCsv = () => {
    window.open(`/api/audit/tickets/${ticketId}/export/csv`, '_blank');
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-medium text-slate-600">Loading Ticket Details...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-16 text-center text-slate-500 max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h3 className="text-base font-bold text-slate-800">Ticket Not Found</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          The requested ticket does not exist, or you do not have permission to view it.
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to All Tickets</span>
        </button>
      </div>
    );
  }

  const currentStageIndex = STAGES.indexOf(ticket.status as TicketStatus);

  const getSenderRoleBadge = (comment: TicketComment) => {
    if (comment.user_custom_role) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200">
          {comment.user_custom_role}
        </span>
      );
    }

    if (comment.user_role === 'client') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
          Client {comment.user_organization_name ? `• ${comment.user_organization_name}` : ''}
        </span>
      );
    }

    if (comment.user_role === 'developer') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
          Developer
        </span>
      );
    }

    if (comment.user_role === 'support_manager') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
          Support Manager
        </span>
      );
    }

    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
        Super Admin
      </span>
    );
  };

  return (
    <div className="py-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-4">
      {/* Top back button & breadcrumb navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0176D3] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Case List</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {user?.role === 'developer' && ticket.assignee_id !== user.id && (
            <button
              disabled={assigningLoading}
              onClick={() => handleAssign(user.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-bold rounded shadow-sm transition-colors"
            >
              <UserCheck size={14} />
              Claim Case For Myself
            </button>
          )}

          <button
            onClick={handleExportTicketCsv}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold shadow-sm transition-colors"
            title="Download dedicated audit log for this ticket as CSV"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Export Case Log (.CSV)</span>
          </button>
        </div>
      </div>

      {/* SALESFORCE LIGHTNING HIGHLIGHTS PANEL (Record Header) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-[#E5B500] text-white flex items-center justify-center font-bold shadow-sm flex-shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Case</span>
                <span className="font-mono text-sm font-bold text-[#0176D3] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {ticket.ticket_number}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500 font-medium">{ticket.category}</span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 leading-snug mt-0.5">
                {ticket.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
            {(() => {
              const sla = getTicketSla(ticket);
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${sla.badgeBg} ${sla.badgeBorder}`}
                  title={sla.description}
                >
                  <span className={`w-2 h-2 rounded-full ${sla.dotColor}`}></span>
                  <span>{sla.label}</span>
                </span>
              );
            })()}
          </div>
        </div>

        {/* 6 Key Highlights Fields in a crisp horizontal row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs pt-1">
          <div>
            <span className="text-slate-400 uppercase font-bold text-[10px] block">
              {user?.role === 'developer' ? 'Target Site' : 'Account / Brand'}
            </span>
            <span className="font-bold text-slate-800 truncate block mt-0.5">
              {user?.role === 'developer' ? ticket.website_name || 'Protected Site' : ticket.organization_name}
            </span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-bold text-[10px] block">Incident Queue</span>
            {['super_admin', 'support_manager'].includes(user?.role || '') && queues.length > 0 ? (
              <select
                value={ticket.queue_id || ''}
                onChange={(e) => handleQueueChange(e.target.value)}
                className="mt-0.5 text-xs font-bold bg-blue-50/60 border border-blue-200 rounded-lg px-2 py-0.5 text-blue-900 cursor-pointer"
              >
                <option value="">Move Queue...</option>
                {queues.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-slate-800 truncate block mt-0.5">
                {ticket.queue_name || 'No Queue'}
              </span>
            )}
          </div>
          <div>
            <span className="text-slate-400 uppercase font-bold text-[10px] block">Case Owner</span>
            <span className="font-bold text-[#0176D3] truncate block mt-0.5">
              {ticket.assignee_name || 'Unassigned (Triage)'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-bold text-[10px] block">Website / Env</span>
            <span className="font-bold text-slate-800 truncate block mt-0.5">
              {ticket.website_name} ({ticket.environment})
            </span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-bold text-[10px] block">Date / Time Opened</span>
            <span className="text-slate-600 block mt-0.5">{new Date(ticket.created_at).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-bold text-[10px] block">Resolution Target</span>
            <span className="text-slate-600 block mt-0.5">
              {ticket.target_resolution_time ? new Date(ticket.target_resolution_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Standard'}
            </span>
          </div>
        </div>
      </div>

      {/* SALESFORCE LIGHTNING PATH / STAGE CHEVRON PROGRESS BAR */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 overflow-x-auto">
        <div className="flex items-center min-w-[760px] gap-1">
          {STAGES.map((stg, idx) => {
            const isCurrent = ticket.status === stg;
            const isCompleted = idx < currentStageIndex;

            return (
              <button
                key={stg}
                disabled={statusLoading}
                onClick={() => handleStatusChange(stg)}
                className={`flex-1 py-2 px-2 text-[11px] font-bold tracking-tight rounded transition-all text-center flex items-center justify-center gap-1.5 ${
                  isCurrent
                    ? 'bg-[#0176D3] text-white shadow-sm ring-2 ring-blue-300'
                    : isCompleted
                    ? 'bg-[#EBF3FB] text-[#014486] hover:bg-[#D8E9F9]'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                title={`Advance Case Stage to ${stg}`}
              >
                {isCompleted && <CheckCircle size={12} className="text-emerald-600 flex-shrink-0" />}
                <span className="truncate">{stg.replace(/_/g, ' ')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKBENCH: Left 2/3 (Tabs: Details, Chatter, Related) | Right 1/3 (Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column (Tabs Content) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Salesforce Tab Headers */}
          <div className="bg-white rounded-t-lg border-x border-t border-slate-200 flex text-xs font-bold overflow-x-auto scrollbar-none whitespace-nowrap">
            <button
              onClick={() => setActiveTab('chatter')}
              className={`flex-shrink-0 py-3 px-4 sm:px-5 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'chatter'
                  ? 'border-[#0176D3] text-[#0176D3] bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900 bg-slate-50/50'
              }`}
            >
              <MessageSquare size={14} />
              <span>Case Feed & Chatter ({comments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('details')}
              className={`py-3 px-5 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-[#0176D3] text-[#0176D3] bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900 bg-slate-50/50'
              }`}
            >
              <FileText size={14} />
              <span>Details & Specifications</span>
            </button>

            <button
              onClick={() => setActiveTab('related')}
              className={`py-3 px-5 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'related'
                  ? 'border-[#0176D3] text-[#0176D3] bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900 bg-slate-50/50'
              }`}
            >
              <History size={14} />
              <span>Audit History & Files ({attachments.length})</span>
            </button>
          </div>

          {/* TAB CONTENT: CHATTER / FEED */}
          {activeTab === 'chatter' && (
            <div className="bg-white rounded-b-lg border border-slate-200 shadow-sm p-5 space-y-5">
              {/* CHATTER COMPOSER / PUBLISHER */}
              <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 shadow-sm">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCommentTab('public')}
                      className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                        activeCommentTab === 'public'
                          ? 'bg-[#0176D3] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      💬 Public Customer Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCommentTab('internal')}
                      className={`text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                        activeCommentTab === 'internal'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Lock size={12} />
                      🔒 Internal Dev Note (Devs Only)
                    </button>
                  </div>

                  {/* SENDER IDENTITY INDICATOR */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 font-medium">
                    <span className="text-slate-400 font-normal">Posting as:</span>
                    <span className="font-bold text-slate-900">{user?.name}</span>
                    <span className="text-[10px] text-[#0176D3] font-semibold">
                      ({user?.custom_role || user?.role})
                    </span>
                  </div>
                </div>

                <form onSubmit={handlePostComment} className="space-y-3">
                  <textarea
                    rows={3}
                    required
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={
                      activeCommentTab === 'public'
                        ? 'Write a public update to the client...'
                        : 'Record internal developer investigation, reproduction findings, or commit hash...'
                    }
                    className="w-full p-3 border rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3] bg-white resize-none"
                  />

                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer">
                      <Upload size={14} className="text-slate-400" />
                      <span>{commentFile ? commentFile.name : 'Attach screenshot/log'}</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => setCommentFile(e.target.files?.[0] || null)}
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={submittingComment}
                      className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded transition-colors shadow-sm disabled:opacity-50 ${
                        activeCommentTab === 'internal'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-[#0176D3] hover:bg-[#014486]'
                      }`}
                    >
                      <Send size={13} />
                      <span>{submittingComment ? 'Posting...' : activeCommentTab === 'internal' ? 'Save Dev Note' : 'Share Update'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* CHATTER STREAM */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Communication Timeline
                </div>

                {comments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    No feed items logged for this case yet.
                  </div>
                ) : (
                  comments.map((c) => {
                    const isInternal = Boolean(c.is_internal);
                    const initial = (c.user_name || 'U').charAt(0).toUpperCase();

                    return (
                      <div
                        key={c.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          isInternal
                            ? 'bg-amber-50/60 border-amber-300 shadow-sm'
                            : c.user_role === 'client'
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-white border-blue-200 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                                isInternal
                                  ? 'bg-amber-200 text-amber-900'
                                  : c.user_role === 'client'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-[#0176D3]'
                              }`}
                            >
                              {initial}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900">{c.user_name}</span>
                              <span className="ml-2">{getSenderRoleBadge(c)}</span>
                              {isInternal && (
                                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                                  <Lock size={10} />
                                  INTERNAL NOTE
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed pl-9">
                          {c.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: DETAILS */}
          {activeTab === 'details' && (
            <div className="bg-white rounded-b-lg border border-slate-200 shadow-sm p-6 space-y-6 text-xs">
              <div>
                <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
                  Bug Description
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-4 text-slate-900 whitespace-pre-wrap leading-relaxed font-sans">
                  {ticket.description}
                </div>
              </div>

              {ticket.steps_to_reproduce && (
                <div>
                  <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
                    Steps to Reproduce
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded p-4 text-slate-900 whitespace-pre-wrap leading-relaxed font-sans">
                    {ticket.steps_to_reproduce}
                  </div>
                </div>
              )}

              {/* System Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Browser</span>
                  <div className="font-bold text-slate-800 mt-0.5">{ticket.browser || 'Not specified'}</div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Device / OS</span>
                  <div className="font-bold text-slate-800 mt-0.5">{ticket.device || 'Not specified'}</div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Environment</span>
                  <div className="font-bold text-slate-800 capitalize mt-0.5">{ticket.environment}</div>
                </div>
              </div>

              {/* Root Cause & Resolution Info */}
              {(ticket.root_cause || ticket.fix_details) && (
                <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <h4 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <span>Resolution & Engineering Fix Notes</span>
                  </h4>
                  {ticket.root_cause && (
                    <div>
                      <strong className="text-emerald-950">Root Cause:</strong>{' '}
                      <span className="text-emerald-900">{ticket.root_cause}</span>
                    </div>
                  )}
                  {ticket.fix_details && (
                    <div>
                      <strong className="text-emerald-950">Fix Details:</strong>{' '}
                      <span className="text-emerald-900">{ticket.fix_details}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Attached Screenshots & Visual Proof */}
              {(() => {
                const imageAttachments = attachments.filter(att => att.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(att.filename));
                if (imageAttachments.length === 0) return null;
                return (
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon size={16} className="text-[#0176D3]" />
                      <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                        Attached Screenshots & Visual Proof ({imageAttachments.length})
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {imageAttachments.map((att) => {
                        const imgUrl = `/api/attachments/${att.id}/preview?token=${localStorage.getItem('token') || ''}`;
                        const downloadUrl = `/api/attachments/${att.id}/download?token=${localStorage.getItem('token') || ''}`;
                        return (
                          <div
                            key={att.id}
                            className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-900/5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                          >
                            <div
                              onClick={() => setLightboxImage({ url: imgUrl, filename: att.filename })}
                              className="cursor-pointer relative overflow-hidden h-32 bg-slate-100 flex items-center justify-center"
                            >
                              <img
                                src={imgUrl}
                                alt={att.filename}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white">
                                <ZoomIn size={16} className="drop-shadow" />
                                <span className="text-[11px] font-bold">Preview</span>
                              </div>
                            </div>
                            <div className="p-2 bg-white border-t border-slate-100 flex items-center justify-between text-[11px]">
                              <span className="font-medium text-slate-700 truncate pr-2" title={att.filename}>
                                {att.filename}
                              </span>
                              <a
                                href={downloadUrl}
                                download={att.filename}
                                className="text-slate-400 hover:text-[#0176D3] transition-colors p-1"
                                title="Download original file"
                              >
                                <Download size={12} />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB CONTENT: RELATED & AUDIT */}
          {activeTab === 'related' && (
            <div className="bg-white rounded-b-lg border border-slate-200 shadow-sm p-6 space-y-6 text-xs">
              {/* Attachments Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Attached Files & Screenshots ({attachments.length})
                  </h3>
                </div>

                {attachments.length === 0 ? (
                  <p className="text-slate-400 italic">No files attached to this case.</p>
                ) : (
                  (() => {
                    const imageAttachments = attachments.filter(att => att.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(att.filename));
                    const otherAttachments = attachments.filter(att => !(att.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(att.filename)));

                    return (
                      <div className="space-y-4">
                        {imageAttachments.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-2.5 text-slate-600 font-semibold text-[11px]">
                              <ImageIcon size={14} className="text-[#0176D3]" />
                              <span>Image Proof & Screenshots ({imageAttachments.length})</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {imageAttachments.map((att) => {
                                const imgUrl = `/api/attachments/${att.id}/preview?token=${localStorage.getItem('token') || ''}`;
                                const downloadUrl = `/api/attachments/${att.id}/download?token=${localStorage.getItem('token') || ''}`;
                                return (
                                  <div
                                    key={att.id}
                                    className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-900/5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                                  >
                                    <div
                                      onClick={() => setLightboxImage({ url: imgUrl, filename: att.filename })}
                                      className="cursor-pointer relative overflow-hidden h-28 bg-slate-100 flex items-center justify-center"
                                    >
                                      <img
                                        src={imgUrl}
                                        alt={att.filename}
                                        loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white">
                                        <ZoomIn size={16} className="drop-shadow" />
                                        <span className="text-[11px] font-bold">Preview</span>
                                      </div>
                                    </div>
                                    <div className="p-2 bg-white border-t border-slate-100 flex items-center justify-between text-[11px]">
                                      <span className="font-medium text-slate-700 truncate pr-2" title={att.filename}>
                                        {att.filename}
                                      </span>
                                      <a
                                        href={downloadUrl}
                                        download={att.filename}
                                        className="text-slate-400 hover:text-[#0176D3] transition-colors p-1"
                                        title="Download original file"
                                      >
                                        <Download size={12} />
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {otherAttachments.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-2 text-slate-600 font-semibold text-[11px]">
                              <FileText size={14} className="text-slate-500" />
                              <span>Documents & Other Files ({otherAttachments.length})</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {otherAttachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={`/api/attachments/${att.id}/download?token=${localStorage.getItem('token') || ''}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-between p-2.5 rounded border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 text-slate-800 transition-colors"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <FileText size={15} className="text-[#0176D3] flex-shrink-0" />
                                    <span className="truncate font-medium">{att.filename}</span>
                                  </div>
                                  <Download size={13} className="text-slate-400" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Dedicated Case History Audit Log */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Case History & State Audit Trail
                  </h3>
                  <button
                    onClick={handleExportTicketCsv}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0176D3] hover:underline"
                  >
                    <Download size={12} />
                    <span>Download Case Log (.CSV)</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date/Time</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">User</th>
                        <th className="py-2.5 px-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activities.map((act) => (
                        <tr key={act.id} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                            {new Date(act.created_at).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {act.action}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {act.user_name || 'System'}
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                            {typeof act.details === 'object' ? JSON.stringify(act.details) : act.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Salesforce Case Console Sidebar */}
        <div className="space-y-4">
          {/* Assignment Control Card */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 text-xs space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <UserCheck size={14} className="text-[#0176D3]" />
              Assignee & Case Ownership
            </h3>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Change Assigned Specialist
              </label>
              <select
                disabled={assigningLoading}
                value={ticket.assignee_id || ''}
                onChange={(e) => handleAssign(e.target.value)}
                className="w-full px-2.5 py-1.5 border rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
              >
                <option value="">Unassigned (In Triage Queue)</option>
                {staffUsers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.custom_role || s.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-slate-500 text-[11px]">
              <span>Current Status:</span>
              <strong className="text-slate-800">{ticket.status}</strong>
            </div>

            {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
              <button
                onClick={() => setShowResolveModal(true)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-sm transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                <CheckCircle size={14} />
                <span>Resolve Case & Log Root Cause</span>
              </button>
            )}
          </div>

          {/* SLA Milestone Tracker */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 text-xs space-y-2.5">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" />
              SLA Milestone Tracker
            </h3>

            <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400">Target Response Time</div>
              <div className="text-slate-800 font-mono mt-0.5">
                {ticket.target_response_time ? new Date(ticket.target_response_time).toLocaleString() : 'Within 4h'}
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400">Target Resolution Time</div>
              <div className="text-slate-800 font-mono mt-0.5">
                {ticket.target_resolution_time ? new Date(ticket.target_resolution_time).toLocaleString() : 'Within 24h'}
              </div>
            </div>
          </div>

          {/* Account Summary */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 text-xs space-y-2">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Brand Account Details
            </h3>
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-400 text-[10px] block">Client Organization:</span>
                <span className="font-bold text-slate-800">{ticket.organization_name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Affected Domain:</span>
                <a
                  href={ticket.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0176D3] hover:underline flex items-center gap-1 font-mono"
                >
                  <span>{ticket.website_url}</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          </div>

          {/* Duplicate Cases check */}
          {duplicates.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 text-xs space-y-2">
              <h3 className="font-bold text-amber-800 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <AlertCircle size={14} className="text-amber-600" />
                <span>Related / Similar Cases ({duplicates.length})</span>
              </h3>
              <div className="space-y-1.5">
                {duplicates.map((dup) => (
                  <div key={dup.id} className="p-2 rounded bg-amber-50 border border-amber-200 text-slate-800">
                    <div className="font-bold text-[11px] text-amber-900">{dup.ticket_number}: {dup.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Status: {dup.status} • Priority: {dup.priority}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RESOLVE CASE MODAL */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <CheckCircle className="text-emerald-600" />
              <span>Mark Case Resolved (Fix Ready for Client Testing)</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Record root cause analysis and fix details for audit compliance and client visibility.
            </p>

            <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Root Cause Analysis *
                </label>
                <textarea
                  rows={2}
                  required
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="e.g. Memory leak in session cookie handler caused timeout drops on mobile devices"
                  className="w-full p-2.5 border rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Fix Details & Code Changes *
                </label>
                <textarea
                  rows={2}
                  required
                  value={fixDetails}
                  onChange={(e) => setFixDetails(e.target.value)}
                  placeholder="e.g. Deployed hotfix to Redis cache layer; updated session timeout TTL to 3600s"
                  className="w-full p-2.5 border rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Client Verification Instructions
                </label>
                <input
                  type="text"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Please test checkout flow on your staging site"
                  className="w-full p-2.5 border rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 border rounded font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-sm disabled:opacity-50"
                >
                  {statusLoading ? 'Resolving...' : 'Confirm & Mark Resolved'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOUBLE VERIFICATION STATUS CHANGE MODAL */}
      {showStatusConfirmModal && pendingStatus && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Confirm Status Change
                  </h3>
                  <p className="text-xs text-slate-500">
                    Double verification required &bull; Live client updates
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Transition pill comparison */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Current State</span>
                  <StatusBadge status={ticket.status} />
                </div>
                <div className="text-slate-400 font-bold text-base px-2">➔</div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">New State</span>
                  <StatusBadge status={pendingStatus} />
                </div>
              </div>

              {/* Automatic Queue transition alert */}
              {['IN PROGRESS', 'ASSIGNED', 'FIX READY FOR TESTING'].includes(pendingStatus) && (
                <div className="flex items-start gap-2.5 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                  <Layers size={16} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Automatic Queue Reassignment</span>
                    <span className="text-[11px] text-indigo-700">
                      This ticket will automatically move from its intake queue into <strong>Assigned &amp; In Progress (q-assigned)</strong>.
                    </span>
                  </div>
                </div>
              )}

              {/* Email & WhatsApp notification warning */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-slate-700 space-y-1.5">
                <div className="font-bold text-blue-900 text-[11px] flex items-center gap-1.5 uppercase tracking-wider">
                  <span>⚡ Real-Time Notification Impact</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span>📧</span>
                  <span>
                    Email sent from <strong>tools.assurance@gmail.com</strong> to {user?.role === 'developer' ? 'the client' : ticket.organization_name}.
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span>💬</span>
                  <span>Instant WhatsApp status alert sent to official brand contact.</span>
                </div>
              </div>

              {/* Optional notes */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[10px]">
                  Update Notes / Client Communication (Optional)
                </label>
                <textarea
                  rows={2}
                  value={statusConfirmNotes}
                  onChange={(e) => setStatusConfirmNotes(e.target.value)}
                  placeholder="e.g. Investigating root cause / patch deployed to test environment..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusConfirmModal(false);
                    setPendingStatus(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={statusLoading}
                  onClick={handleConfirmStatusChange}
                  className="px-4 py-2 bg-[#0176D3] hover:bg-[#014486] text-white font-bold rounded-xl shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {statusLoading ? 'Updating...' : 'Confirm Status Change'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Lightbox Modal for Attached Screenshots */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <span className="text-sm font-bold truncate max-w-md">{lightboxImage.filename}</span>
              <div className="flex items-center gap-3">
                <a
                  href={lightboxImage.url.replace('/preview', '/download')}
                  download={lightboxImage.filename}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#0176D3] hover:bg-[#014486] text-white flex items-center gap-1.5 transition-colors"
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 overflow-auto flex items-center justify-center max-h-[calc(90vh-70px)]">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.filename}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
