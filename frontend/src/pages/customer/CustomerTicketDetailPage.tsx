import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Ticket, TicketComment, TicketAttachment, TicketActivity } from '../../types/index.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import {
  ArrowLeft,
  Send,
  Upload,
  CheckCircle,
  AlertTriangle,
  FileText,
  Clock,
  Laptop,
  Globe,
  Download,
} from 'lucide-react';

interface CustomerTicketDetailPageProps {
  ticketId: string;
  onBack: () => void;
}

export const CustomerTicketDetailPage: React.FC<CustomerTicketDetailPageProps> = ({
  ticketId,
  onBack,
}) => {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [activities, setActivities] = useState<TicketActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [ticketRes, commentsRes, attachmentsRes, activitiesRes] = await Promise.all([
        api.get<{ ticket: Ticket }>(`/tickets/${ticketId}`),
        api.get<{ comments: TicketComment[] }>(`/tickets/${ticketId}/comments`),
        api.get<{ attachments: TicketAttachment[] }>(`/tickets/${ticketId}/attachments`),
        api.get<{ activities: TicketActivity[] }>(`/audit/tickets/${ticketId}/activity`),
      ]);

      setTicket(ticketRes.ticket);
      setComments(commentsRes.comments || []);
      setAttachments(attachmentsRes.attachments || []);
      setActivities(activitiesRes.activities || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ticketId]);

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() && !replyFile) return;

    setSubmittingReply(true);
    try {
      if (replyText.trim()) {
        await api.post(`/tickets/${ticketId}/comments`, {
          content: replyText,
          is_internal: false, // Client always public
        });
      }

      if (replyFile) {
        const formData = new FormData();
        formData.append('file', replyFile);
        formData.append('is_internal', 'false');
        await api.upload(`/tickets/${ticketId}/attachments`, formData);
        setReplyFile(null);
      }

      setReplyText('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Client confirmation / Reopen handler
  const handleStatusChange = async (newStatus: 'CLOSED' | 'IN PROGRESS', notes: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/tickets/${ticketId}/status`, {
        status: newStatus,
        notes,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading ticket details...</div>;
  }

  if (error || !ticket) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="text-rose-600 font-semibold mb-2">{error || 'Ticket not found'}</div>
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
          Return to tickets list
        </button>
      </div>
    );
  }

  const isResolved = ticket.status === 'RESOLVED';

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to tickets
      </button>

      {/* RESOLUTION ACTION BANNER FOR CLIENT */}
      {isResolved && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={24} />
            <div>
              <h3 className="font-bold text-emerald-900 text-base">
                Fix Deployed — Verification Needed
              </h3>
              <p className="text-sm text-emerald-800 mt-0.5">
                Our engineering team has marked this defect as resolved. Please test on your site and confirm if the issue is cleared.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              disabled={actionLoading}
              onClick={() => handleStatusChange('CLOSED', 'Client verified fix and confirmed resolution.')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              Confirm Resolved & Close
            </button>
            <button
              disabled={actionLoading}
              onClick={() => {
                const reason = prompt('Please explain why the bug is still persisting:');
                if (reason) {
                  handleStatusChange('IN PROGRESS', `Reopened by client: ${reason}`);
                }
              }}
              className="px-4 py-2 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-bold rounded-lg transition-colors"
            >
              Issue Persists / Reopen
            </button>
          </div>
        </div>
      )}

      {/* Main Ticket Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              {ticket.ticket_number}
            </span>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
          <div className="text-xs text-slate-400">
            Reported on {new Date(ticket.created_at).toLocaleString()}
          </div>
        </div>

        <h1 className="text-xl font-bold text-slate-900 leading-snug">{ticket.title}</h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 p-4 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Website:</span>
            <div className="font-semibold text-slate-800 mt-0.5">{ticket.website_name}</div>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Environment:</span>
            <div className="font-semibold text-slate-800 capitalize mt-0.5">{ticket.environment}</div>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Category:</span>
            <div className="font-semibold text-slate-800 mt-0.5">{ticket.category}</div>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Assigned Specialist:</span>
            <div className="font-semibold text-slate-800 mt-0.5">
              {ticket.assignee_name ? `👤 ${ticket.assignee_name}` : 'Agency Triage Team'}
            </div>
          </div>
        </div>

        {/* Detailed Description */}
        <div className="mt-6">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</h4>
          <div className="text-sm text-slate-800 leading-relaxed bg-white rounded-lg border border-slate-200 p-4 whitespace-pre-wrap">
            {ticket.description}
          </div>
        </div>

        {/* Steps to Reproduce */}
        {ticket.steps_to_reproduce && (
          <div className="mt-5">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Steps to Reproduce
            </h4>
            <pre className="text-xs text-slate-800 font-mono bg-slate-50 border border-slate-200 p-3.5 rounded-lg whitespace-pre-wrap">
              {ticket.steps_to_reproduce}
            </pre>
          </div>
        )}

        {/* Device & Browser Specs */}
        {(ticket.browser || ticket.device) && (
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
            {ticket.browser && (
              <span className="flex items-center gap-1.5">
                <Globe size={14} className="text-slate-400" />
                Browser: <strong>{ticket.browser}</strong>
              </span>
            )}
            {ticket.device && (
              <span className="flex items-center gap-1.5">
                <Laptop size={14} className="text-slate-400" />
                Device: <strong>{ticket.device}</strong>
              </span>
            )}
          </div>
        )}

        {/* Attachments Section */}
        {attachments.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attachments</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attachments.map((att) => (
                <a
                  key={att.id}
                  href={`/api/attachments/${att.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText size={18} className="text-blue-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-800 truncate group-hover:text-blue-600">
                      {att.filename}
                    </span>
                  </div>
                  <Download size={14} className="text-slate-400 group-hover:text-blue-600" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Discussion & Public Updates Thread */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Support Discussion & Case Updates</h3>
            <p className="text-xs text-slate-500 mt-0.5">Public messages exchanged between your brand and our development agency.</p>
          </div>
          <button
            onClick={() => window.open(`/api/audit/tickets/${ticketId}/export/csv`, '_blank')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-colors"
          >
            <Download size={13} className="text-slate-500" />
            <span>Export Case History (.CSV)</span>
          </button>
        </div>

        {/* Comments List */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">
              No replies yet. Our agency support specialist will respond shortly.
            </p>
          ) : (
            comments.map((comment) => {
              const isClient = comment.user_role === 'client';
              const initial = (comment.user_name || 'U').charAt(0).toUpperCase();

              return (
                <div
                  key={comment.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    isClient
                      ? 'bg-blue-50/40 border-blue-200 ml-4 sm:ml-8'
                      : 'bg-slate-50/80 border-slate-200 mr-4 sm:mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          isClient ? 'bg-blue-100 text-[#0176D3]' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {initial}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">{comment.user_name}</span>
                        {comment.user_custom_role ? (
                          <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200">
                            {comment.user_custom_role}
                          </span>
                        ) : isClient ? (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Client Representative
                          </span>
                        ) : comment.user_role === 'developer' ? (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Assigned Developer
                          </span>
                        ) : comment.user_role === 'support_manager' ? (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                            Support Manager
                          </span>
                        ) : (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                            Agency Administrator
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed pl-9">
                    {comment.content}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Reply Box */}
        <form onSubmit={handlePostReply} className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Add Reply or Verification Feedback
            </label>
            <div className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 font-medium">
              <span className="text-slate-400">Posting as:</span>{' '}
              <strong className="text-slate-900">{user?.name}</strong>{' '}
              <span className="text-[#0176D3]">({user?.custom_role || user?.role})</span>
            </div>
          </div>

          <textarea
            rows={3}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your response to the engineering team..."
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
          />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="comment-file"
                onChange={(e) => setReplyFile(e.target.files ? e.target.files[0] : null)}
                className="hidden"
              />
              <label
                htmlFor="comment-file"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                <Upload size={13} />
                {replyFile ? replyFile.name : 'Attach file'}
              </label>
            </div>

            <button
              type="submit"
              disabled={submittingReply || (!replyText.trim() && !replyFile)}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#0176D3] hover:bg-[#014486] disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              <Send size={13} />
              {submittingReply ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
