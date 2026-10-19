import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Website, TicketPriority } from '../../types/index.js';
import { Upload, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

interface NewTicketPageProps {
  onTicketCreated: (ticketId: string) => void;
  onCancel: () => void;
}

export const NewTicketPage: React.FC<NewTicketPageProps> = ({
  onTicketCreated,
  onCancel,
}) => {
  const { user } = useAuth();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [websiteId, setWebsiteId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Checkout & Payments');
  const [priority, setPriority] = useState<TicketPriority>('P3');
  const [environment, setEnvironment] = useState('production');
  const [browser, setBrowser] = useState('');
  const [device, setDevice] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    // Detect user's current browser and OS for quick autofill
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent;
      if (ua.includes('Chrome')) setBrowser('Chrome Desktop');
      else if (ua.includes('Safari')) setBrowser('Safari Desktop');
      else if (ua.includes('Firefox')) setBrowser('Firefox');

      if (navigator.userAgent.includes('Windows')) setDevice('Windows PC');
      else if (navigator.userAgent.includes('Macintosh')) setDevice('macOS');
      else if (navigator.userAgent.includes('iPhone')) setDevice('iPhone');
      else if (navigator.userAgent.includes('Android')) setDevice('Android');
    }

    // Fetch client websites
    api.get<{ websites: Website[] }>('/organizations/all-websites')
      .then((res) => {
        setWebsites(res.websites || []);
        if (res.websites && res.websites.length > 0) {
          setWebsiteId(res.websites[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // 1. Create ticket
      const ticketRes = await api.post<{ success: boolean; ticket: any }>('/tickets', {
        website_id: websiteId,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        environment: environment || 'production',
        browser: browser?.trim() || undefined,
        device: device?.trim() || undefined,
        steps_to_reproduce: stepsToReproduce?.trim() || undefined,
      });

      const newTicketId = ticketRes.ticket.id;

      // 2. If attachment selected, upload it
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('is_internal', 'false');
        await api.upload(`/tickets/${newTicketId}/attachments`, formData);
      }

      onTicketCreated(newTicketId);
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        const detailMsg = err.details
          .map((d: any) => `${d.field ? `${d.field.toUpperCase()}: ` : ''}${d.message}`)
          .join(' • ');
        setError(detailMsg);
      } else {
        setError(err.message || 'Failed to submit bug report');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to tickets
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="mb-6 border-b border-slate-200 pb-5">
          <h1 className="text-xl font-bold text-slate-900">Report Website Bug</h1>
          <p className="text-sm text-slate-500 mt-1">
            Provide detailed steps and reproduction details to help our engineering team triage and resolve the defect swiftly.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Affected Website & Environment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Affected Website *
              </label>
              {websites.length > 0 ? (
                <select
                  value={websiteId}
                  onChange={(e) => setWebsiteId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {websites.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.url})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-slate-500 py-2">
                  {loading ? 'Loading websites...' : 'No websites registered for your brand.'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="production">Production (Live Store / Site)</option>
                <option value="staging">Staging / QA Environment</option>
                <option value="development">Development / Preview Link</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Bug Title / Summary *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Checkout credit card validation hangs on step 2"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category & Severity / Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Bug Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Checkout & Payments">Checkout & Payments</option>
                <option value="Forms & Leads">Forms & Lead Capture</option>
                <option value="UI / Mobile Navigation">UI / Mobile Navigation</option>
                <option value="Visual & Layout">Visual & Layout Defects</option>
                <option value="Authentication & Accounts">Authentication & Customer Accounts</option>
                <option value="Performance & Speed">Performance & Page Speed</option>
                <option value="Other">Other Issues</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Severity / Urgency *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="P1">P1 — Critical (Major outage, purchases blocked)</option>
                <option value="P2">P2 — High (Significant broken functionality)</option>
                <option value="P3">P3 — Normal (Limited defect, workaround exists)</option>
                <option value="P4">P4 — Low (Cosmetic, minor layout or text)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Detailed Description *
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what happened, what was expected to happen, and any error message displayed..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Steps to Reproduce */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Steps to Reproduce
            </label>
            <textarea
              rows={3}
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              placeholder="1. Navigate to /product/example&#10;2. Click Add to Cart&#10;3. Click Checkout button"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
            />
          </div>

          {/* Device and Browser */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Browser & Version
              </label>
              <input
                type="text"
                value={browser}
                onChange={(e) => setBrowser(e.target.value)}
                placeholder="e.g. Chrome 122, Safari Mobile 17"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Device / Operating System
              </label>
              <input
                type="text"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                placeholder="e.g. iPhone 15 Pro iOS 17, Windows 11"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Screenshot / File Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Attach Screenshot or Video (Max 10MB)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center hover:bg-slate-50 transition-colors">
              <Upload className="mx-auto text-slate-400 mb-2" size={24} />
              <input
                type="file"
                id="file-upload"
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                className="hidden"
                accept="image/*,video/mp4,video/webm,application/pdf"
              />
              <label
                htmlFor="file-upload"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                {file ? file.name : 'Click to upload a screenshot or screen recording'}
              </label>
              <p className="text-xs text-slate-500 mt-1">PNG, JPG, WEBP, MP4, WEBM up to 10MB</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-500/20"
            >
              {submitting ? 'Submitting Report...' : 'Submit Bug Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
