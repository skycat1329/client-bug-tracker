import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import {
  Hash,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
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
  Settings,
  Server,
  Lock,
  Users,
  MapPin,
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
    attendance_group_jid: '',
    default_country_code: '91',
    send_on_punch_in: true,
    send_on_punch_out: true,
    send_on_regularize: true,
    send_on_create: true,
    send_on_assign: true,
    send_on_status: true,
    send_on_ticket_comment: true,
    send_on_task_create: true,
    send_on_task_assign: true,
    send_on_task_status: true,
    send_on_credentials: true,
    send_on_offer_letter: true,
    send_on_payslip: true,
    attendance_notify_mode: 'both',
  });
  const [waGroups, setWaGroups] = useState<any[]>([]);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [fetchGroupsError, setFetchGroupsError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'late' | 'ontime'>('late');
  const [waStatus, setWaStatus] = useState<any>(null);
  const [checkingWaStatus, setCheckingWaStatus] = useState(false);
  const [savingWa, setSavingWa] = useState(false);
  const [saveWaSuccess, setSaveWaSuccess] = useState(false);
  const [saveWaError, setSaveWaError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
      setTestWaResult({ success: false, message: err?.message || 'Failed to dispatch' });
    } finally {
      setTestingWa(false);
    }
  };

  const handleFetchGroups = async () => {
    setFetchingGroups(true);
    setFetchGroupsError(null);
    try {
      const res = await api.get<{ success: boolean; groups: any[]; count: number }>('/integrations/whatsapp/groups');
      if (res && res.groups) {
        setWaGroups(res.groups);
        if (res.groups.length === 0) {
          setFetchGroupsError('No groups found on the paired WhatsApp session. Please ensure this number has joined your company group.');
        }
      }
    } catch (err: any) {
      setFetchGroupsError(err?.message || 'Failed to fetch WhatsApp groups from gateway.');
    } finally {
      setFetchingGroups(false);
    }
  };

  const handleFetchQr = async () => {
    setLoadingQr(true);
    setPairError(null);
    try {
      const res = await api.get<any>('/integrations/whatsapp/login-qr');
      setQrData(res.data || res);
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
    if (!confirm('Are you sure you want to disconnect this WhatsApp session? All active device slots on the gateway will be reset.')) return;
    setActionLoading('disconnecting');
    setActionFeedback(null);
    try {
      const res = await api.post<any>('/integrations/whatsapp/logout', {});
      setActionFeedback({
        type: 'success',
        message: res?.message || 'Device disconnected and session slot reset successfully.'
      });
      await checkWaStatus();
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to disconnect WhatsApp session'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReconnectWa = async () => {
    setActionLoading('reconnecting');
    setActionFeedback(null);
    try {
      const res = await api.post<any>('/integrations/whatsapp/reconnect', {});
      setActionFeedback({
        type: 'success',
        message: res?.message || 'Reconnection signal dispatched to WhatsApp Gateway.'
      });
      await checkWaStatus();
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to reconnect'
      });
    } finally {
      setActionLoading(null);
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
      setTestSlackResult({ success: false, message: err?.message || 'Failed to dispatch Slack test' });
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
      setTestEmailResult({ success: false, message: err?.message || 'Failed to dispatch email test' });
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
            className={`w-2.5 h-2.5 rounded-full ${
              waStatus?.connected
                ? 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse'
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
          {health?.configured && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
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

      {/* ========================================================================= */}
      {/* TAB 1: WHATSAPP GATEWAY (GOWA) CONFIGURATION & STATUS                     */}
      {/* ========================================================================= */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Status Banner */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
            {actionFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
                  actionFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {actionFeedback.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    waStatus?.connected
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : waStatus?.reachable
                      ? 'bg-amber-100 text-amber-700 border border-amber-300'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  <Smartphone size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900">WhatsApp Gateway Connection</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wide border ${
                        waStatus?.connected
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : waStatus?.reachable
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {waStatus?.connected
                        ? 'Connected & Active'
                        : waStatus?.reachable
                        ? 'Gateway Reachable (Not Paired)'
                        : 'Offline / Not Configured'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-1">
                    {waStatus?.connected ? (
                      <span>
                        Device linked and authorized:{' '}
                        <strong className="text-slate-800 font-mono">
                          {waStatus?.active_device?.display_name || 'WhatsApp Account'} (
                          {waStatus?.active_device?.jid?.replace('@s.whatsapp.net', '') || waStatus?.device_id || 'Active'}
                          )
                        </strong>
                        . Ready to dispatch real-time WhatsApp updates.
                      </span>
                    ) : waStatus?.reachable ? (
                      <span>
                        Gateway server responded on <span className="font-mono text-slate-700">{waConfig.gateway_url}</span>, but your phone session is not linked yet.
                      </span>
                    ) : (
                      <span>Enter your Render or local GOWA URL below to activate automated 24/7 WhatsApp messaging.</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={checkWaStatus}
                  disabled={checkingWaStatus}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
                  title="Check live gateway status"
                >
                  <RefreshCw size={13} className={checkingWaStatus ? 'animate-spin text-emerald-600' : ''} />
                  <span>{checkingWaStatus ? 'Checking...' : 'Check Status'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReconnectWa}
                  disabled={Boolean(actionLoading)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} className={actionLoading === 'reconnecting' ? 'animate-spin text-emerald-600' : ''} />
                  <span>{actionLoading === 'reconnecting' ? 'Reconnecting...' : 'Reconnect'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogoutWa}
                  disabled={Boolean(actionLoading)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                  title="Disconnect session and reset device slots"
                >
                  <Power size={13} className={actionLoading === 'disconnecting' ? 'animate-spin' : ''} />
                  <span>{actionLoading === 'disconnecting' ? 'Disconnecting...' : 'Disconnect Device'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPairModal(true);
                    setPairMode('qr');
                    handleFetchQr();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <QrCode size={14} />
                  <span>Scan QR Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPairModal(true);
                    setPairMode('code');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Key size={13} />
                  <span>Pair with Phone Code</span>
                </button>
              </div>
            </div>
          </div>

          {/* Configuration Form */}
          <form onSubmit={handleSaveWaConfig} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Settings size={18} className="text-emerald-600" />
                WhatsApp Multi-Device Gateway Settings
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Connect your 24/7 Render cloud deployment or local standalone GOWA runner (<span className="font-mono text-emerald-700">aldinokemal/go-whatsapp-web-multidevice</span>).
              </p>
            </div>

            {saveWaSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <span>WhatsApp configuration saved successfully!</span>
              </div>
            )}

            {saveWaError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />
                <span>{saveWaError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Gateway URL */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Globe size={13} className="text-emerald-600" />
                  Gateway Base URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={waConfig.gateway_url || ''}
                  onChange={(e) => setWaConfig({ ...waConfig, gateway_url: e.target.value })}
                  placeholder="https://assurance-whatsapp-xxxx.onrender.com or http://localhost:3000"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white transition-all"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Your Render HTTPS URL (e.g. <span className="font-mono text-slate-600">https://assurance-whatsapp.onrender.com</span>) or Cloudflare tunnel URL.
                </p>
              </div>

              {/* Basic Auth User */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Server size={13} className="text-slate-500" />
                  Basic Auth Username
                </label>
                <input
                  type="text"
                  value={waConfig.basic_auth_user || ''}
                  onChange={(e) => setWaConfig({ ...waConfig, basic_auth_user: e.target.value })}
                  placeholder="admin"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Basic Auth Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock size={13} className="text-slate-500" />
                  Basic Auth Password
                </label>
                <input
                  type="password"
                  value={waConfig.basic_auth_password || ''}
                  onChange={(e) => setWaConfig({ ...waConfig, basic_auth_password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Admin Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Smartphone size={13} className="text-slate-500" />
                  Default Admin Alert Phone
                </label>
                <input
                  type="tel"
                  value={waConfig.admin_phone || ''}
                  onChange={(e) => setWaConfig({ ...waConfig, admin_phone: e.target.value })}
                  placeholder="+919999999999"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400">
                  Recipient of admin alerts when punch-ins or high-severity tickets occur.
                </p>
              </div>

              {/* Admin WhatsApp Group JID */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Hash size={13} className="text-slate-500" />
                  General Admin Group JID (Optional)
                </label>
                <input
                  type="text"
                  value={waConfig.admin_group_jid || ''}
                  onChange={(e) => setWaConfig({ ...waConfig, admin_group_jid: e.target.value })}
                  placeholder="120363025555555555@g.us"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400">
                  Optional WhatsApp group for internal leadership & engineering alerts.
                </p>
              </div>
            </div>

            {/* Attendance Announcement Group (All Users) */}
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">
                      Attendance Announcement Group (All Users)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      All-employee broadcast group where punch-in events are automatically announced.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFetchGroups}
                  disabled={fetchingGroups}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-60"
                >
                  <RefreshCw size={13} className={fetchingGroups ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
                  {fetchingGroups ? 'Fetching Groups...' : 'Fetch Connected Groups'}
                </button>
              </div>

              {/* Group JID input & Dropdown selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Hash size={13} className="text-emerald-700" />
                    Attendance Group JID *
                  </label>
                  <input
                    type="text"
                    value={waConfig.attendance_group_jid || ''}
                    onChange={(e) => setWaConfig({ ...waConfig, attendance_group_jid: e.target.value })}
                    placeholder="120363040656010581@g.us"
                    className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    Enter the WhatsApp Group JID ending in <code className="text-emerald-700 font-mono">@g.us</code>.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Users size={13} className="text-emerald-700" />
                    Select From WhatsApp Groups
                  </label>
                  <select
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    onChange={(e) => {
                      if (e.target.value) {
                        setWaConfig({ ...waConfig, attendance_group_jid: e.target.value });
                      }
                    }}
                    value={waConfig.attendance_group_jid || ''}
                  >
                    <option value="">-- Choose a Group --</option>
                    {waGroups.map((g) => (
                      <option key={g.jid} value={g.jid}>
                        {g.name} ({g.participants_count ? `${g.participants_count} members` : g.jid.slice(0, 15) + '...'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    {waGroups.length > 0
                      ? `${waGroups.length} groups loaded from WhatsApp session`
                      : 'Click "Fetch Connected Groups" to populate your WhatsApp groups'}
                  </p>
                </div>
              </div>

              {fetchGroupsError && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  {fetchGroupsError}
                </div>
              )}

              {/* Crucial Announcement Group Instructions */}
              <div className="p-3 bg-white/90 rounded-lg border border-emerald-200 text-xs text-slate-700 space-y-1">
                <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                  💡 How to make this group Announcement-Only (Prevent Member Chat):
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  1. Open the group on your phone in WhatsApp.<br />
                  2. Tap the group header → select <b>Group permissions</b> (or <b>Group settings</b>).<br />
                  3. Turn <b>Send messages</b> to <b>&quot;Only admins&quot;</b>.<br />
                  4. Make sure your paired WhatsApp Business number (<code className="font-mono text-emerald-700">+918369406363</code>) is an Admin.
                  Now employees cannot type messages, but automated punch-in notifications will be posted instantly!
                </p>
              </div>

              {/* Visual Message Preview (Red vs Green) */}
              <div className="pt-2 border-t border-emerald-200/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">Live WhatsApp Message Format Preview:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('late')}
                      className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                        previewTab === 'late'
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🔴 Late Punch-In (Red Alert)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('ontime')}
                      className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                        previewTab === 'ontime'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🟢 On-Time (Normal)
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs leading-relaxed border border-slate-800">
                  {previewTab === 'late' ? (
                    <div>
                      <div className="text-rose-400 font-bold">🔴 *LATE PUNCH-IN ALERT* 🔴</div>
                      <div className="text-slate-500">━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                      <div>👤 *Staff:* <span className="text-amber-300 font-bold">Faizan Khan</span></div>
                      <div>⏰ *Punch Time:* <span className="text-rose-300 font-bold">10:24:18 AM</span> (IST)</div>
                      <div>📅 *Date:* 30 Oct 2026</div>
                      <div>📍 *Location:* 🏢 Assurance Media HQ (14m from office geofence)</div>
                      <div>🗺️ *GPS Map:* <span className="text-sky-400 underline">https://maps.google.com/?q=19.0825,72.8967</span></div>
                      <div className="text-rose-400 font-bold">🚨 *Status:* 🔴 *LATE ARRIVAL* (24 mins late)</div>
                      <div>⏳ *Shift Standard:* 10:00 AM (Grace: 10:15 AM)</div>
                      <div className="text-slate-500">━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                      <div className="text-slate-400 italic">⚠️ _Notice: Punctuality is strictly monitored. Please ensure on-time arrival._</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-emerald-400 font-bold">🟢 *ATTENDANCE PUNCH-IN* 🟢</div>
                      <div className="text-slate-500">━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                      <div>👤 *Staff:* <span className="text-emerald-300 font-bold">Jane Doe</span></div>
                      <div>⏰ *Punch Time:* <span className="text-emerald-300 font-bold">09:55:02 AM</span> (IST)</div>
                      <div>📅 *Date:* 30 Oct 2026</div>
                      <div>📍 *Location:* 🏢 Assurance Media HQ (18m from office geofence)</div>
                      <div>🗺️ *GPS Map:* <span className="text-sky-400 underline">https://maps.google.com/?q=19.0825,72.8967</span></div>
                      <div className="text-emerald-400 font-bold">🚦 *Status:* 🟢 *ON TIME*</div>
                      <div>⏳ *Shift Start:* 10:00 AM</div>
                      <div className="text-slate-500">━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                      <div className="text-slate-400 italic">✨ _Assurance Media Workforce Management • Have a productive day!_</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notification Triggers */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Automated Trigger Preferences
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Attendance */}
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_punch_in)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_punch_in: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Punch In Alerts</span>
                    <span className="text-[11px] text-slate-500">Notify admin/employee on clock in</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_punch_out)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_punch_out: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Punch Out Alerts</span>
                    <span className="text-[11px] text-slate-500">Notify on day end & work summary</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_regularize)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_regularize: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Attendance Regularization</span>
                    <span className="text-[11px] text-slate-500">Alerts on submission & approvals</span>
                  </div>
                </label>

                {/* Tickets */}
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_create)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_create: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">New Bug Tickets</span>
                    <span className="text-[11px] text-slate-500">Acknowledge brand & alert triage</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_assign)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_assign: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Ticket Assignment</span>
                    <span className="text-[11px] text-slate-500">Notify developer with SLA target</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_status)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_status: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Ticket Status Updates</span>
                    <span className="text-[11px] text-slate-500">Phase updates sent to Brand</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_ticket_comment)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_ticket_comment: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Ticket Comments & Notes</span>
                    <span className="text-[11px] text-slate-500">Public messages between brand & team</span>
                  </div>
                </label>

                {/* Tasks */}
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_task_assign)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_task_assign: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Task Assignment</span>
                    <span className="text-[11px] text-slate-500">Notify engineer with deadline</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_task_status)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_task_status: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Task Status & Approvals</span>
                    <span className="text-[11px] text-slate-500">Alerts on approve, reject, complete</span>
                  </div>
                </label>

                {/* Credentials */}
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_credentials)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_credentials: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Credentials & Password Resets</span>
                    <span className="text-[11px] text-slate-500">Auto-send login details to users</span>
                  </div>
                </label>

                {/* Payroll */}
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_offer_letter)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_offer_letter: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Official Offer Letters</span>
                    <span className="text-[11px] text-slate-500">Send contract view & accept link</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(waConfig.send_on_payslip)}
                    onChange={(e) => setWaConfig({ ...waConfig, send_on_payslip: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Monthly Salary Slips</span>
                    <span className="text-[11px] text-slate-500">Send net pay & official PDF link</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingWa}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Check size={14} />
                <span>{savingWa ? 'Saving Configuration...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>

          {/* WhatsApp Live Test Dispatcher */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Send size={16} className="text-emerald-600" />
                Live WhatsApp Dispatcher Test
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Send a real test message to any WhatsApp number to verify your gateway connection.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Recipient Phone Number
                </label>
                <input
                  type="tel"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Custom Message (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    placeholder="Hello! This is a test alert from Assurance Media Command Center."
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    disabled={testingWa}
                    onClick={handleTestWhatsApp}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Send size={13} />
                    <span>{testingWa ? 'Dispatching...' : 'Send Test'}</span>
                  </button>
                </div>
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
                  <div className="font-bold">{testWaResult.message}</div>
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
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SLACK WEBHOOKS                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'slack' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <button
                  disabled={testingSlack}
                  onClick={handleTestSlack}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4A154B] hover:bg-[#3b113c] text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  <Send size={12} />
                  <span>{testingSlack ? 'Sending...' : 'Test Slack Dispatch'}</span>
                </button>
              </div>
              {testSlackResult && (
                <div className="text-xs p-2.5 rounded bg-slate-50 border border-slate-200">
                  {testSlackResult.message}
                </div>
              )}
            </div>

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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EMAIL (SMTP)                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'email' && (
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
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <Send size={12} />
                <span>{testingEmail ? 'Sending...' : 'Send Test Email'}</span>
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
              <span className="text-slate-700 font-medium">New Team Members, Client Tickets &amp; Replies</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUDIT LOGS                                                         */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Recent Notification Deliveries</h3>
              <p className="text-xs text-slate-500">
                Audit log of WhatsApp, Slack webhooks, and automated client emails.
              </p>
            </div>
            <button
              onClick={loadData}
              title="Refresh"
              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg border cursor-pointer"
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
      )}

      {/* ========================================================================= */}
      {/* WHATSAPP PAIRING MODAL (QR CODE / 8-DIGIT PHONE CODE)                    */}
      {/* ========================================================================= */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={20} />
                <h3 className="font-bold text-sm">Link WhatsApp Business Device</h3>
              </div>
              <button
                onClick={() => {
                  setShowPairModal(false);
                  checkWaStatus();
                }}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 text-xs font-bold">
              <button
                onClick={() => {
                  setPairMode('qr');
                  handleFetchQr();
                }}
                className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
                  pairMode === 'qr'
                    ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/40'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Scan QR Code
              </button>
              <button
                onClick={() => setPairMode('code')}
                className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
                  pairMode === 'code'
                    ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/40'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Pair with Phone Code
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {pairError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                  {pairError}
                </div>
              )}

              {pairMode === 'qr' ? (
                <div className="text-center space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Open <strong>WhatsApp Business</strong> on your phone &gt; tap <strong>Settings</strong> &gt; <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong> and scan this code:
                  </p>

                  <div className="flex items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200 min-h-[220px]">
                    {loadingQr ? (
                      <div className="flex flex-col items-center gap-2 text-xs text-slate-400">
                        <RefreshCw size={24} className="animate-spin text-emerald-600" />
                        <span>Generating live QR code...</span>
                      </div>
                    ) : qrData?.qr_image || qrData?.qr_link || qrData?.qr ? (
                      <div className="space-y-2">
                        {qrData?.qr_image ? (
                          <img
                            src={qrData.qr_image.startsWith('data:') ? qrData.qr_image : `data:image/png;base64,${qrData.qr_image}`}
                            alt="WhatsApp QR Code"
                            className="w-56 h-56 mx-auto rounded-lg shadow-sm border border-slate-300"
                          />
                        ) : qrData?.qr_link ? (
                          <img
                            src={qrData.qr_link}
                            alt="WhatsApp QR Code"
                            className="w-56 h-56 mx-auto rounded-lg shadow-sm border border-slate-300 bg-white p-2"
                          />
                        ) : (
                          <div className="font-mono text-[10px] break-all p-3 bg-white border rounded">
                            {qrData.qr}
                          </div>
                        )}
                        <span className="text-[11px] text-slate-400 block">QR refreshes every 30 seconds</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">Click below to fetch the QR code directly from your gateway.</p>
                        <button
                          type="button"
                          onClick={handleFetchQr}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Load QR Code
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleFetchQr}
                      disabled={loadingQr}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      <RefreshCw size={12} className={loadingQr ? 'animate-spin' : ''} />
                      <span>Refresh QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPairModal(false);
                        checkWaStatus();
                      }}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Done Scanning
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Enter your phone number with country code (e.g. <strong className="font-mono">919876543210</strong>) to generate an 8-digit linking code.
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">Phone Number</label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={pairPhone}
                        onChange={(e) => setPairPhone(e.target.value)}
                        placeholder="919876543210"
                        className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        disabled={requestingPairCode}
                        onClick={handleRequestPairCode}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        {requestingPairCode ? 'Generating...' : 'Get Code'}
                      </button>
                    </div>
                  </div>

                  {pairCode && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                      <span className="text-xs font-semibold text-emerald-800 block">
                        Enter this 8-digit code in WhatsApp on your phone:
                      </span>
                      <div className="text-3xl font-black font-mono tracking-widest text-emerald-900 bg-white py-2 px-4 rounded-lg border border-emerald-300 inline-block shadow-sm">
                        {pairCode}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pairCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 3000);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                        >
                          {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedCode ? 'Copied to clipboard!' : 'Copy Code'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPairModal(false);
                        checkWaStatus();
                      }}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
