import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import {
  Hash,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  Bell,
  ExternalLink,
  Mail,
  Smartphone,
  MessageCircle,
  QrCode,
  Key,
  Globe,
  Power,
  Copy,
  Check,
  Radio,
  X,
  ShieldCheck,
} from 'lucide-react';

export const SlackHealthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'slack' | 'email' | 'audit'>('whatsapp');
  const [health, setHealth] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // WhatsApp Configuration & Gateway Status
  const [waConfig, setWaConfig] = useState<any>({
    enabled: true,
    gateway_url: '',
    device_id: '',
    basic_auth_user: '',
    basic_auth_password: '',
    admin_phone: '+919999999999',
    admin_group_jid: '',
    default_country_code: '91',
    send_on_punch_in: true,
    send_on_punch_out: true,
    send_on_regularize: true,
    send_on_create: true,
    send_on_assign: true,
    send_on_status: true,
    attendance_notify_mode: 'both',
  });
  const [waStatus, setWaStatus] = useState<any>(null);
  const [checkingWaStatus, setCheckingWaStatus] = useState(false);
  const [savingWa, setSavingWa] = useState(false);
  const [saveWaSuccess, setSaveWaSuccess] = useState(false);
  const [saveWaError, setSaveWaError] = useState<string | null>(null);

  // WhatsApp Testing
  const [targetPhone, setTargetPhone] = useState('+919999999999');
  const [customMsg, setCustomMsg] = useState('');
  const [testingWa, setTestingWa] = useState(false);
  const [testWaResult, setTestWaResult] = useState<any>(null);

  // WhatsApp Pairing Modal (QR / Code)
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairMode, setPairMode] = useState<'qr' | 'code'>('qr');
  const [qrData, setQrData] = useState<any>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [pairPhone, setPairPhone] = useState('');
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [requestingPairCode, setRequestingPairCode] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Slack Testing
  const [testingSlack, setTestingSlack] = useState(false);
  const [testSlackResult, setTestSlackResult] = useState<any>(null);

  // Email Testing
  const [targetEmail, setTargetEmail] = useState('tools.assurance@gmail.com');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<any>(null);

  const loadData = async () => {
    try {
      const [healthRes, deliveriesRes, waConfigRes] = await Promise.all([
        api.get<any>('/integrations/slack/health').catch(() => null),
        api.get<any>('/audit/notifications').catch(() => ({ deliveries: [] })),
        api.get<any>('/integrations/whatsapp/config').catch(() => null),
      ]);
      if (healthRes) setHealth(healthRes);
      setDeliveries(deliveriesRes?.deliveries || []);
      if (waConfigRes?.config) {
        setWaConfig((prev: any) => ({ ...prev, ...waConfigRes.config }));
        if (waConfigRes.config.admin_phone) {
          setTargetPhone(waConfigRes.config.admin_phone);
        }
      }
    } catch (err) {
      console.error('Error loading notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkWaStatus = async () => {
    setCheckingWaStatus(true);
    try {
      const res = await api.get<any>('/integrations/whatsapp/status');
      setWaStatus(res);
    } catch (err: any) {
      setWaStatus({
        success: false,
        configured: Boolean(waConfig.gateway_url),
        reachable: false,
        raw_error: err?.message || 'Failed to reach WhatsApp Gateway',
      });
    } finally {
      setCheckingWaStatus(false);
    }
  };

  useEffect(() => {
    loadData().then(() => {
      checkWaStatus();
    });
  }, []);

  const handleSaveWaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWa(true);
    setSaveWaSuccess(false);
    setSaveWaError(null);
    try {
      const res = await api.post<any>('/integrations/whatsapp/config', waConfig);
      if (res.success) {
        setSaveWaSuccess(true);
        setTimeout(() => setSaveWaSuccess(false), 4000);
        await checkWaStatus();
      }
    } catch (err: any) {
      setSaveWaError(err?.message || 'Failed to save WhatsApp configuration');
    } finally {
      setSavingWa(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setTestingWa(true);
    setTestWaResult(null);
    try {
      const res = await api.post<any>('/integrations/whatsapp/test', {
        phone: targetPhone.trim() || undefined,
        message: customMsg.trim() || undefined,
      });
      setTestWaResult(res);
      await loadData();
    } catch (err: any) {
      setTestWaResult({ success: false, message: err.message });
    } finally {
      setTestingWa(false);
    }
  };

  const handleFetchQr = async () => {
    setLoadingQr(true);
    setPairError(null);
    try {
      const res = await api.get<any>('/integrations/whatsapp/login-qr');
      setQrData(res.data);
    } catch (err: any) {
      setPairError(err?.message || 'Failed to fetch QR code from WhatsApp gateway');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleRequestPairCode = async () => {
    if (!pairPhone.trim()) {
      setPairError('Please enter your phone number with country code (e.g. 919876543210)');
      return;
    }
    setRequestingPairCode(true);
    setPairError(null);
    setPairCode(null);
    try {
      const res = await api.post<any>('/integrations/whatsapp/login-code', {
        phone: pairPhone.trim(),
      });
      if (res.success && res.data) {
        setPairCode(res.data.pair_code || res.data.code || JSON.stringify(res.data));
      } else {
        setPairError(res.error || 'Gateway did not return a pairing code');
      }
    } catch (err: any) {
      setPairError(err?.message || 'Failed to request pairing code');
    } finally {
      setRequestingPairCode(false);
    }
  };

  const handleLogoutWa = async () => {
    if (!confirm('Are you sure you want to disconnect this WhatsApp session from the gateway?')) return;
    try {
      await api.post('/integrations/whatsapp/logout', {});
      await checkWaStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReconnectWa = async () => {
    try {
      await api.post('/integrations/whatsapp/reconnect', {});
      await checkWaStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestSlack = async () => {
    setTestingSlack(true);
    setTestSlackResult(null);
    try {
      const res = await api.post<any>('/integrations/slack/test');
      setTestSlackResult(res);
      await loadData();
    } catch (err: any) {
      setTestSlackResult({ success: false, message: err.message });
    } finally {
      setTestingSlack(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setTestEmailResult(null);
    try {
      const res = await api.post<any>('/integrations/email/test', {
        email: targetEmail.trim() || undefined,
      });
      setTestEmailResult(res);
      await loadData();
    } catch (err: any) {
      setTestEmailResult({ success: false, message: err.message });
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="py-6 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Notification &amp; Dispatcher Hub
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <MessageCircle className="text-emerald-600" size={28} />
            Integrations &amp; Real-Time Alerts
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            WhatsApp Multi-Device REST Gateway (<span className="font-mono text-emerald-700 font-semibold">aldinokemal/go-whatsapp-web-multidevice</span>), Slack Webhooks, and Automated SMTP Deliveries.
          </p>
        </div>

        <button
          onClick={() => {
            loadData();
            checkWaStatus();
          }}
          title="Refresh All Integrations"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading || checkingWaStatus ? 'animate-spin' : ''} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'whatsapp'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Smartphone size={16} />
          <span>WhatsApp Gateway (GOWA)</span>
          <span
            className={`w-2 h-2 rounded-full ${
              waStatus?.connected
                ? 'bg-emerald-500'
                : waStatus?.reachable
                ? 'bg-amber-400'
                : 'bg-slate-300'
            }`}
          />
        </button>

        <button
          onClick={() => setActiveTab('slack')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'slack'
              ? 'border-[#4A154B] text-[#4A154B] bg-[#4A154B]/5'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Hash size={16} />
          <span>Slack Webhooks</span>
          {health?.configured && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'email'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Mail size={16} />
          <span>Email (SMTP Relay)</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Radio size={16} />
          <span>Delivery Audit Logs</span>
          <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px] font-mono">
            {deliveries.length}
          </span>
        </button>
      </div>


      {/* Integration Status & Channel Mapping */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Integration State
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                health?.configured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-bold text-slate-900 text-base">
              {health?.configured ? 'Live Webhook Connected' : 'Mock Mode (Safe Local)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {health?.configured
              ? 'Real-time JSON Block Kit payloads are dispatched to your Slack workspace webhook with retry & backoff.'
              : 'No SLACK_WEBHOOK_URL is set in backend .env. Notifications are logged safely to the delivery ledger without crashing.'}
          </p>

          <div className="pt-3 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-700">Setup Guide:</span>{' '}
            <span className="text-blue-600 font-mono">docs/SLACK_SETUP.md</span>
          </div>
        </div>

        {/* Dynamic Channel Routing */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Dynamic Channel Routing Configuration
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>#client-bug-reports</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
                  Standard
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Triggered when standard bug reports (P2–P4) are submitted by clients.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 text-xs space-y-1">
              <div className="font-bold text-rose-900 flex items-center justify-between">
                <span>#production-incidents</span>
                <span className="text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded font-semibold">
                  High Alert
                </span>
              </div>
              <p className="text-rose-700 text-[11px]">
                Triggered immediately for P1 Critical outages and major blockers.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50 text-xs space-y-1">
              <div className="font-bold text-purple-900 flex items-center justify-between">
                <span>#dev-triage</span>
                <span className="text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded font-semibold">
                  Assignment
                </span>
              </div>
              <p className="text-purple-700 text-[11px]">
                Triggered when a ticket is assigned, claimed, or triaged by staff.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 text-xs space-y-1">
              <div className="font-bold text-emerald-900 flex items-center justify-between">
                <span>#ticket-resolutions</span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-semibold">
                  Resolved
                </span>
              </div>
              <p className="text-emerald-700 text-[11px]">
                Triggered when a ticket is marked RESOLVED with root-cause analysis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Email Notification Health & Live Test Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Automated Email Dispatcher (Google Workspace / SMTP)
                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                  Active Sender
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Sends credentials to newly created team members and client bug updates directly via{' '}
                <strong className="text-slate-800">tools.assurance@gmail.com</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="Recipient email address"
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
            <button
              disabled={testingEmail}
              onClick={handleTestEmail}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <Send size={12} />
              {testingEmail ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
        </div>

        {testEmailResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              testEmailResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {testEmailResult.success ? (
              <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-rose-600" />
            )}
            <div>
              <div className="font-bold">
                {testEmailResult.success ? 'Email Delivered Successfully!' : 'Email Delivery Status'}
              </div>
              <div className="mt-0.5">{testEmailResult.message}</div>
              {testEmailResult.error && (
                <div className="mt-1 font-mono text-[11px] bg-rose-100/70 p-1.5 rounded text-rose-900">
                  {testEmailResult.error}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <span className="text-slate-400 font-bold block text-[10px] uppercase">Sender Account</span>
            <span className="font-mono text-slate-800 font-semibold">tools.assurance@gmail.com</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <span className="text-slate-400 font-bold block text-[10px] uppercase">SMTP Relay</span>
            <span className="font-mono text-slate-800 font-semibold">smtp.gmail.com : 465 (SSL)</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <span className="text-slate-400 font-bold block text-[10px] uppercase">Email Triggers</span>
            <span className="text-slate-700 font-medium">New Team Members, Client Tickets & Replies</span>
          </div>
        </div>
      </div>

      {/* WhatsApp Notification Health & Live Test Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <MessageCircle size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                WhatsApp Dispatcher & Real-Time Alerts
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  Active Gateway & Direct Web Link
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Instant alerts for ticket creation, assignments to specialists, and status updates to client brands.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              placeholder="+919876543210"
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 w-44 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              disabled={testingWa}
              onClick={handleTestWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Send size={13} />
              <span>{testingWa ? 'Dispatching...' : 'Send Test WhatsApp'}</span>
            </button>
          </div>
        </div>

        {testWaResult && (
          <div
            className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
              testWaResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">
                {testWaResult.message}
              </div>
              {testWaResult.whatsapp_web_url && (
                <div className="pt-1">
                  <a
                    href={testWaResult.whatsapp_web_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[11px] transition-colors"
                  >
                    <span>Open in WhatsApp Web / App</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <span className="text-slate-400 font-bold block text-[10px] uppercase">Default Admin Alert</span>
            <span className="font-mono text-slate-800 font-semibold">{targetPhone || '+919999999999'}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <span className="text-slate-400 font-bold block text-[10px] uppercase">Dispatch Channels</span>
            <span className="text-slate-700 font-medium">WhatsApp Cloud API &amp; Direct WhatsApp Web Links</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <span className="text-slate-400 font-bold block text-[10px] uppercase">Automated Triggers</span>
            <span className="text-slate-700 font-medium">Brand Creation, Assignment, &amp; Status Transitions</span>
          </div>
        </div>
      </div>

      {/* Delivery Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Recent Notification Deliveries</h3>
            <p className="text-xs text-slate-500">
              Audit log of Slack incoming webhooks and automated client emails.
            </p>
          </div>
          <button
            onClick={loadData}
            title="Refresh"
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg border"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {deliveries.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No notification deliveries recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Event</th>
                  <th className="py-2.5 px-4">Channel</th>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Ticket</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                      {del.event}
                    </td>
                    <td className="py-2.5 px-4 capitalize font-semibold text-slate-700">
                      {del.channel}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{del.recipient}</td>
                    <td className="py-2.5 px-4 font-mono text-blue-600 font-bold">
                      {del.ticket_number || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          del.status === 'delivered'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : del.status === 'mocked'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {del.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">
                      {new Date(del.created_at).toLocaleString()}
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
