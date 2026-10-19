import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Organization, Website, User } from '../../types/index.js';
import {
  Building2,
  Globe,
  Plus,
  ExternalLink,
  KeyRound,
  Download,
  Copy,
  Check,
  UserPlus,
  Users,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Send,
  Edit2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const OrganizationsPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [brandUsers, setBrandUsers] = useState<Record<string, User[]>>({});
  const [loading, setLoading] = useState(true);

  // New Brand modal/form
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgContactName, setOrgContactName] = useState('');
  const [orgContactEmail, setOrgContactEmail] = useState('');
  const [orgInitialPassword, setOrgInitialPassword] = useState('');
  const [orgWebsiteUrl, setOrgWebsiteUrl] = useState('');
  const [orgSheetUrlInput, setOrgSheetUrlInput] = useState('');

  // Edit Brand modal/form
  const [showEditOrg, setShowEditOrg] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    contact_name: '',
    contact_email: '',
    website_url: '',
    google_sheet_url: '',
    status: 'active',
  });

  // New Website modal/form
  const [showAddSite, setShowAddSite] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [siteEnv, setSiteEnv] = useState<'production' | 'staging' | 'development'>('production');

  // New Client Credentials modal/form
  const [showAddClientCreds, setShowAddClientCreds] = useState(false);
  const [clientCredsOrgId, setClientCredsOrgId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [generatedCreds, setGeneratedCreds] = useState<{ email: string; password: string; brand: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // Send Official Brand Credentials modal/form
  const [showSendCredsModal, setShowSendCredsModal] = useState(false);
  const [selectedCredsOrg, setSelectedCredsOrg] = useState<Organization | null>(null);
  const [credsEmail, setCredsEmail] = useState('');
  const [credsName, setCredsName] = useState('');
  const [credsPassword, setCredsPassword] = useState('');
  const [sendingCreds, setSendingCreds] = useState(false);

  // Brand Google Sheet modal
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [selectedSheetOrg, setSelectedSheetOrg] = useState<Organization | null>(null);
  const [orgSheetUrl, setOrgSheetUrl] = useState('');
  const [savingSheetUrl, setSavingSheetUrl] = useState(false);
  const [testingSheet, setTestingSheet] = useState(false);
  const [sheetTestMessage, setSheetTestMessage] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [orgsRes, sitesRes] = await Promise.allSettled([
        api.get<{ organizations: Organization[] }>('/organizations'),
        api.get<{ websites: Website[] }>('/organizations/all-websites'),
      ]);

      const orgs = orgsRes.status === 'fulfilled' ? (orgsRes.value.organizations || []) : [];
      const sites = sitesRes.status === 'fulfilled' ? (sitesRes.value.websites || []) : [];

      if (orgsRes.status === 'rejected') {
        console.error('Failed to load organizations:', orgsRes.reason);
        setError('Could not load organizations. Please refresh.');
      }

      setOrganizations(orgs);
      setWebsites(sites);
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }

      // Load client users for each organization
      const usersMap: Record<string, User[]> = {};
      for (const org of orgs) {
        try {
          const res = await api.get<{ users: User[] }>(`/auth/organization/${org.id}/users`);
          usersMap[org.id] = res.users || [];
        } catch {
          usersMap[org.id] = [];
        }
      }
      setBrandUsers(usersMap);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load brand data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = 'AM-';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<any>('/organizations', {
        name: orgName.trim(),
        contact_name: orgContactName.trim() || undefined,
        contact_email: orgContactEmail.trim() || undefined,
        initial_password: orgInitialPassword || undefined,
        website_url: orgWebsiteUrl.trim() || undefined,
        google_sheet_url: orgSheetUrlInput.trim() || undefined,
      });

      if (res.client_created && orgContactEmail) {
        setGeneratedCreds({
          brand: orgName.trim(),
          email: orgContactEmail.trim(),
          password: orgInitialPassword,
        });
      }

      setOrgName('');
      setOrgContactName('');
      setOrgContactEmail('');
      setOrgInitialPassword('');
      setOrgWebsiteUrl('');
      setOrgSheetUrlInput('');
      setShowAddOrg(false);
      setSuccess(res.message || `Brand "${orgName}" created successfully.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create brand organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.put(`/organizations/${editingOrg.id}`, {
        name: editForm.name.trim(),
        contact_name: editForm.contact_name.trim() || null,
        contact_email: editForm.contact_email.trim() || null,
        website_url: editForm.website_url.trim() || null,
        google_sheet_url: editForm.google_sheet_url.trim() || null,
        status: editForm.status || 'active',
      });
      setShowEditOrg(false);
      setEditingOrg(null);
      setSuccess(`Brand "${editForm.name}" updated successfully.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update brand details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSendCredentials = (org: Organization) => {
    setSelectedCredsOrg(org);
    setCredsEmail(org.contact_email || '');
    setCredsName(org.contact_name || org.name);
    setCredsPassword(generateTempPassword());
    setShowSendCredsModal(true);
  };

  const handleSendCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCredsOrg) return;
    setError(null);
    setSuccess(null);
    setSendingCreds(true);
    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        email: string;
        temporary_password: string;
      }>(`/organizations/${selectedCredsOrg.id}/send-credentials`, {
        email: credsEmail.trim(),
        name: credsName.trim(),
        password: credsPassword.trim(),
      });

      setGeneratedCreds({
        brand: selectedCredsOrg.name,
        email: res.email,
        password: res.temporary_password,
      });

      setShowSendCredsModal(false);
      setSuccess(`Official credentials dispatched to ${res.email}! Login URL: ${window.location.origin}/brand/login, Temporary Password: ${res.temporary_password}`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch credentials to official brand email');
    } finally {
      setSendingCreds(false);
    }
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/organizations/${selectedOrgId}/websites`, {
        name: siteName,
        url: siteUrl,
        environment: siteEnv,
      });
      setSiteName('');
      setSiteUrl('');
      setShowAddSite(false);
      setSuccess('Managed website added successfully.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add website');
    }
  };

  const handleCreateClientCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const org = organizations.find((o) => o.id === clientCredsOrgId);
      const res = await api.post<{ credentials: { email: string; password: string } }>('/auth/create-client', {
        organization_id: clientCredsOrgId,
        name: clientName.trim(),
        email: clientEmail.trim(),
        password: clientPassword,
      });

      setGeneratedCreds({
        email: res.credentials.email,
        password: res.credentials.password,
        brand: org?.name || 'Client Brand',
      });

      setClientName('');
      setClientEmail('');
      setClientPassword('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create client credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredsToClipboard = () => {
    if (!generatedCreds) return;
    const text = `BugTracker Pro Login Credentials:\nBrand: ${generatedCreds.brand}\nEmail: ${generatedCreds.email}\nPassword: ${generatedCreds.password}\nPortal URL: http://localhost:5173`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportBrandCsv = (orgId: string) => {
    const token = localStorage.getItem('token') || '';
    window.open(`/api/audit/export/brand/${orgId}/csv?token=${encodeURIComponent(token)}`, '_blank');
  };

  const handleSaveBrandSheetUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSheetOrg) return;
    setSavingSheetUrl(true);
    try {
      await api.post(`/organizations/${selectedSheetOrg.id}/sheets-url`, {
        google_sheet_url: orgSheetUrl.trim(),
      });
      setShowSheetModal(false);
      setSuccess(`Google Sheet destination updated for "${selectedSheetOrg.name}".`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update Google Sheet URL');
    } finally {
      setSavingSheetUrl(false);
    }
  };

  const handleTestBrandSheet = async () => {
    if (!selectedSheetOrg) return;
    setTestingSheet(true);
    setSheetTestMessage(null);
    try {
      const res = await api.post<any>('/integrations/sheets/test', {
        brand_id: selectedSheetOrg.id,
        webhook_url: orgSheetUrl.trim() || undefined,
      });
      setSheetTestMessage(res.message);
    } catch (err: any) {
      setSheetTestMessage('Error: ' + err.message);
    } finally {
      setTestingSheet(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Building2 className="text-[#0176D3]" />
            Client Brands, Managed Websites & Credentials
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Provision client brands, generate portal access credentials, and download brand spreadsheets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddOrg(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0176D3] hover:bg-[#014486] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus size={16} />
            <span>Add Client Brand</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Brand Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-400">Loading brands and websites...</div>
      ) : organizations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Building2 size={36} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-slate-700 text-base">No Client Brands Registered Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Click &quot;Add Client Brand&quot; above to onboard your first brand, configure their managed websites, and issue client login credentials.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {organizations.map((org) => {
            const orgSites = websites.filter((w) => w.organization_id === org.id);
            const orgUsers = brandUsers[org.id] || [];

            return (
              <div
                key={org.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Brand Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#0176D3] flex items-center justify-center font-bold text-base">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{org.name}</h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                        <span>slug: {org.slug}</span>
                        <span>•</span>
                        <span>{orgSites.length} websites</span>
                        <span>•</span>
                        <span>{orgUsers.length} client logins</span>
                        {org.contact_email && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 font-medium">
                              {org.contact_name ? `${org.contact_name} ` : ''}({org.contact_email})
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {org.google_sheet_url ? 'Custom Sheet Active' : 'Sheets Tab Active'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Edit Brand */}
                    <button
                      onClick={() => {
                        setEditingOrg(org);
                        setEditForm({
                          name: org.name,
                          contact_name: org.contact_name || '',
                          contact_email: org.contact_email || '',
                          website_url: org.website_url || '',
                          google_sheet_url: org.google_sheet_url || '',
                          status: org.status || 'active',
                        });
                        setShowEditOrg(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors shadow-sm"
                      title="Edit brand details"
                    >
                      <Edit2 size={13} className="text-slate-500" />
                      <span>Edit Brand</span>
                    </button>

                    {/* Google Sheets Sync */}
                    <button
                      onClick={() => {
                        setSelectedSheetOrg(org);
                        setOrgSheetUrl(org.google_sheet_url || '');
                        setSheetTestMessage(null);
                        setShowSheetModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors shadow-sm"
                      title="Real-time Google Sheets log sync for this brand"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600" />
                      <span>Google Sheet Sync</span>
                    </button>

                    {/* Export Brand Spreadsheet */}
                    <button
                      onClick={() => handleExportBrandCsv(org.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors shadow-sm"
                      title="Download separate spreadsheet of all tickets and logs for this brand"
                    >
                      <Download size={14} className="text-slate-500" />
                      <span>Download CSV</span>
                    </button>

                    {/* Send Credentials via Email */}
                    <button
                      onClick={() => handleOpenSendCredentials(org)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
                      title="Send or resend brand portal credentials directly to official brand email"
                    >
                      <Send size={13} />
                      <span>Send Credentials via Email</span>
                    </button>

                    {/* Add Client Credentials */}
                    <button
                      onClick={() => {
                        setClientCredsOrgId(org.id);
                        setShowAddClientCreds(true);
                        setGeneratedCreds(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                    >
                      <KeyRound size={13} />
                      <span>Add Client Login</span>
                    </button>

                    {/* Add Website */}
                    <button
                      onClick={() => {
                        setSelectedOrgId(org.id);
                        setShowAddSite(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Globe size={13} />
                      <span>+ Add Website</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Managed Websites */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      <Globe size={14} className="text-slate-400" />
                      Managed Websites ({orgSites.length})
                    </h3>

                    {orgSites.length === 0 ? (
                      <div className="p-4 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 text-center">
                        No managed websites registered for this brand yet.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {orgSites.map((site) => (
                          <div
                            key={site.id}
                            className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-blue-200 transition-colors flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-slate-900 text-xs">{site.name}</div>
                              <a
                                href={site.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-[#0176D3] hover:underline flex items-center gap-1 mt-0.5 font-mono"
                              >
                                <span>{site.url}</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {site.environment}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Authorized Client User Credentials */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400" />
                      Brand Client Logins ({orgUsers.length})
                    </h3>

                    {orgUsers.length === 0 ? (
                      <div className="p-4 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-amber-800">
                        <div className="font-semibold">No Client Logins Provisioned</div>
                        <div className="text-[11px] text-amber-700 mt-0.5">
                          Click &quot;Add Client Login&quot; above to issue credentials so this client can sign into their portal.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {orgUsers.map((user) => (
                          <div
                            key={user.id}
                            className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900">{user.name}</div>
                                <div className="text-slate-500 font-mono text-[11px]">{user.email}</div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active Client
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add Brand with Initial Password & Email Dispatch */}
      {showAddOrg && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 my-8">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create New Client Brand</h3>
            <p className="text-xs text-slate-500 mb-4">
              Onboard a client organization, configure initial credentials, and automatically email access details.
            </p>

            <form onSubmit={handleCreateOrg} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Brand / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Lifestyle Co."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Website URL (Optional)
                </label>
                <input
                  type="url"
                  value={orgWebsiteUrl}
                  onChange={(e) => setOrgWebsiteUrl(e.target.value)}
                  placeholder="https://acmelifestyle.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={orgContactName}
                    onChange={(e) => setOrgContactName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Email Address
                  </label>
                  <input
                    type="email"
                    value={orgContactEmail}
                    onChange={(e) => setOrgContactEmail(e.target.value)}
                    placeholder="sarah@acme.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider">
                    Initial Temporary Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setOrgInitialPassword(generateTempPassword())}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={12} />
                    <span>Generate Password</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={orgInitialPassword}
                  onChange={(e) => setOrgInitialPassword(e.target.value)}
                  placeholder="e.g. AM-X7k9#p2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dedicated Google Sheet Webhook (Optional)
                </label>
                <input
                  type="url"
                  value={orgSheetUrlInput}
                  onChange={(e) => setOrgSheetUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 text-[11.5px] leading-relaxed">
                <strong>🔒 Automated Client Setup:</strong> When you provide an email and initial password, Assurance Media will automatically provision the brand account, set a mandatory first-login password reset, and email credentials directly from <code>tools.assurance@gmail.com</code>.
              </div>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddOrg(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 text-white font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  {submitting ? 'Creating Brand & Emailing...' : 'Create Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Brand Details */}
      {showEditOrg && editingOrg && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 my-8">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Edit Brand Details</h3>
            <p className="text-xs text-slate-500 mb-4">
              Update organization info, primary contact, website, and Google Sheet integration.
            </p>

            <form onSubmit={handleUpdateOrg} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Brand / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={editForm.contact_name}
                    onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                    placeholder="Contact name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.contact_email}
                    onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                    placeholder="contact@brand.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Website URL
                </label>
                <input
                  type="url"
                  value={editForm.website_url}
                  onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })}
                  placeholder="https://brand.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dedicated Google Sheet Webhook URL
                </label>
                <input
                  type="url"
                  value={editForm.google_sheet_url}
                  onChange={(e) => setEditForm({ ...editForm, google_sheet_url: e.target.value })}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Brand Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active (Full Portal Access)</option>
                  <option value="archived">Archived / Paused</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditOrg(false);
                    setEditingOrg(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 text-white font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  {submitting ? 'Saving Changes...' : 'Save Brand Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Website */}
      {showAddSite && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Add Managed Website</h3>
            <p className="text-xs text-slate-500 mb-5">
              Register a domain, store, or portal belonging to this brand.
            </p>

            <form onSubmit={handleCreateSite} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Website Name *
                </label>
                <input
                  type="text"
                  required
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="e.g. Production Store"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Website URL *
                </label>
                <input
                  type="url"
                  required
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://store.brand.com"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Environment
                </label>
                <select
                  value={siteEnv}
                  onChange={(e) => setSiteEnv(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                >
                  <option value="production">Production (Live)</option>
                  <option value="staging">Staging (Pre-release)</option>
                  <option value="development">Development</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddSite(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0176D3] hover:bg-[#014486] text-white font-semibold rounded-lg shadow-sm"
                >
                  Add Website
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Client Credentials */}
      {showAddClientCreds && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Issue Client Login Credentials</h3>
            <p className="text-xs text-slate-500 mb-5">
              Create portal login credentials to provide directly to the client brand representative.
            </p>

            {generatedCreds ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 mb-2">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <span>Credentials Generated Successfully!</span>
                  </div>
                  <p className="mb-3 leading-relaxed">
                    Provide these credentials to your client representative so they can sign into the Customer Portal:
                  </p>

                  <div className="p-3 bg-white rounded-lg border border-emerald-200 font-mono text-xs space-y-1 text-slate-800">
                    <div><strong>Brand Login URL:</strong> {typeof window !== 'undefined' ? `${window.location.origin}/brand/login` : '/brand/login'}</div>
                    <div><strong>Brand:</strong> {generatedCreds.brand}</div>
                    <div><strong>Email:</strong> {generatedCreds.email}</div>
                    <div><strong>Password:</strong> {generatedCreds.password}</div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={copyCredsToClipboard}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddClientCreds(false);
                      setGeneratedCreds(null);
                    }}
                    className="px-4 py-2 border rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-50"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateClientCredentials} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Client Contact Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Alice Client"
                    className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Client Email (Username) *
                  </label>
                  <input
                    type="email"
                    required
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="alice@brand.com"
                    className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    placeholder="Set password (e.g. brand123)"
                    className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddClientCreds(false)}
                    className="px-4 py-2 border rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#0176D3] hover:bg-[#014486] text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Client Credentials'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Send Official Brand Credentials via Email */}
      {showSendCredsModal && selectedCredsOrg && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Send Brand Portal Credentials</h3>
                  <p className="text-xs text-slate-500">Brand: <strong>{selectedCredsOrg.name}</strong></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSendCredsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-blue-900 text-xs mb-4 leading-relaxed">
              <strong>🔒 Official Dispatch:</strong> Credentials will be emailed directly to the official brand email address from <code>tools.assurance@gmail.com</code>. The brand user will be forced to set their permanent password upon logging in.
            </div>

            <form onSubmit={handleSendCredentials} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Official Brand Contact Email *
                </label>
                <input
                  type="email"
                  required
                  value={credsEmail}
                  onChange={(e) => setCredsEmail(e.target.value)}
                  placeholder="contact@brand.com"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  value={credsName}
                  onChange={(e) => setCredsName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Temporary Initial Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCredsPassword(generateTempPassword())}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={12} />
                    <span>Regenerate</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={credsPassword}
                  onChange={(e) => setCredsPassword(e.target.value)}
                  placeholder="e.g. AM-X7k9#p2"
                  className="w-full px-3 py-2 border rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Dedicated Brand Login: <strong className="text-slate-600">{typeof window !== 'undefined' ? `${window.location.origin}/brand/login` : '/brand/login'}</strong>
                </span>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSendCredsModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingCreds || !credsEmail.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Send size={13} />
                  <span>{sendingCreds ? 'Sending Email...' : 'Send Credentials to Brand'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Sheet Destination Modal */}
      {showSheetModal && selectedSheetOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-600" size={20} />
                <h3 className="text-sm font-bold text-slate-900">
                  Google Sheet Real-Time Sync: {selectedSheetOrg.name}
                </h3>
              </div>
              <button
                onClick={() => setShowSheetModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                By default, all ticket creation, status changes, developer assignments, and notes for <strong>{selectedSheetOrg.name}</strong> automatically stream into a dedicated tab named <strong>"{selectedSheetOrg.name}"</strong> inside your Global Google Sheet!
              </p>
              <p className="text-slate-500 text-[11px]">
                To stream this brand into an independent external Google Spreadsheet (e.g. shared with this client), deploy the Apps Script Web App in their sheet and paste their URL below.
              </p>
            </div>

            {sheetTestMessage && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                {sheetTestMessage}
              </div>
            )}

            <form onSubmit={handleSaveBrandSheetUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Custom Google Apps Script Web App URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec (leave empty to use Global Sheet tab)"
                  value={orgSheetUrl}
                  onChange={(e) => setOrgSheetUrl(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={testingSheet}
                  onClick={handleTestBrandSheet}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Send size={12} />
                  {testingSheet ? 'Testing...' : 'Send Test Row for this Brand'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSheetModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSheetUrl}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    {savingSheetUrl ? 'Saving...' : 'Save Brand Destination'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
