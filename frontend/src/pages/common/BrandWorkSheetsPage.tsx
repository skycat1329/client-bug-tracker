import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { BrandSheetItem, BrandSheetCategory, BrandSheetStatus, TicketPriority } from '../../types/index.js';
import { PriorityBadge } from '../../components/PriorityBadge.js';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Download,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Edit3,
  Trash2,
  User,
  MessageSquare,
  Globe,
  Tag,
  Check,
  X,
  Layers,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

interface BrandMeta {
  id: string;
  name: string;
  slug: string;
  website_url?: string | null;
  google_sheet_url?: string | null;
  item_count: number;
  active_count: number;
}

const CATEGORIES: BrandSheetCategory[] = [
  'Feature Request',
  'Bug Fix',
  'UI / Design',
  'Content Update',
  'Speed / SEO',
  'Maintenance',
  'Integration',
  'Other',
];

const STATUS_CONFIG: Record<
  BrandSheetStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  PENDING: {
    label: 'To Do / Pending',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  IN_REVIEW: {
    label: 'In Review / QA',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  COMPLETED: {
    label: 'Completed',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  BLOCKED: {
    label: 'Blocked / On Hold',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
};

export const BrandWorkSheetsPage: React.FC = () => {
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const isStaff = !isClient;

  // Data states
  const [items, setItems] = useState<BrandSheetItem[]>([]);
  const [brands, setBrands] = useState<BrandMeta[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    in_review: 0,
    completed: 0,
    blocked: 0,
  });

  // Filters
  const [selectedBrandId, setSelectedBrandId] = useState<string>(
    isClient ? (user?.organization_id || '') : 'ALL'
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<BrandSheetItem | null>(null);
  const [remarksModalItem, setRemarksModalItem] = useState<BrandSheetItem | null>(null);
  const [tempRemarks, setTempRemarks] = useState('');
  const [savingRemarks, setSavingRemarks] = useState(false);

  // Form states
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    organization_id: isClient ? (user?.organization_id || '') : '',
    title: '',
    description: '',
    category: 'Feature Request',
    priority: 'P2' as TicketPriority,
    target_url: '',
    due_date: '',
    estimated_hours: '',
    assigned_to_user_id: '',
    team_remarks: '',
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch brands list
  const fetchBrands = async () => {
    try {
      const res = await api.get<{ success: boolean; brands: BrandMeta[] }>('/brand-sheets/brands');
      if (res.success && res.brands) {
        setBrands(res.brands);
        // If client, ensure selectedBrandId is their brand
        if (isClient && user?.organization_id) {
          setSelectedBrandId(user.organization_id);
        }
      }
    } catch (err) {
      console.error('Failed to load brands list:', err);
    }
  };

  // Fetch staff list for assignment
  const fetchStaff = async () => {
    if (!isStaff) return;
    try {
      const res = await api.get<{ staff: any[] }>('/auth/staff');
      if (res.staff) {
        setStaff(res.staff);
      }
    } catch (err) {
      console.error('Failed to load staff:', err);
    }
  };

  // Fetch items
  const fetchItems = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedBrandId && selectedBrandId !== 'ALL') {
        q.set('organization_id', selectedBrandId);
      }
      if (statusFilter && statusFilter !== 'ALL') {
        q.set('status', statusFilter);
      }
      if (categoryFilter && categoryFilter !== 'ALL') {
        q.set('category', categoryFilter);
      }
      if (priorityFilter && priorityFilter !== 'ALL') {
        q.set('priority', priorityFilter);
      }
      if (search.trim()) {
        q.set('search', search.trim());
      }

      const res = await api.get<{
        success: boolean;
        items: BrandSheetItem[];
        summary: any;
        current_organization?: any;
      }>(`/brand-sheets?${q.toString()}`);

      if (res.success) {
        setItems(res.items || []);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err: any) {
      console.error('Failed to load brand sheet items:', err);
      showToast('error', err?.message || 'Failed to load brand sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [selectedBrandId, statusFilter, categoryFilter, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  // Get active brand metadata
  const currentBrandMeta = useMemo(() => {
    if (selectedBrandId === 'ALL') return null;
    return brands.find((b) => b.id === selectedBrandId) || null;
  }, [brands, selectedBrandId]);

  // Handle Add Item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.title.trim()) {
      showToast('error', 'Please enter what work needs to be done');
      return;
    }
    const orgId = isClient ? (user?.organization_id || '') : addForm.organization_id;
    if (!orgId) {
      showToast('error', 'Please select a brand / organization');
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await api.post<{ success: boolean; message: string; data: BrandSheetItem }>(
        '/brand-sheets',
        {
          organization_id: orgId,
          title: addForm.title.trim(),
          description: addForm.description.trim() || undefined,
          category: addForm.category,
          priority: addForm.priority,
          target_url: addForm.target_url.trim() || undefined,
          due_date: addForm.due_date || undefined,
          estimated_hours: addForm.estimated_hours ? parseFloat(addForm.estimated_hours) : undefined,
          assigned_to_user_id: addForm.assigned_to_user_id || undefined,
          team_remarks: addForm.team_remarks.trim() || undefined,
        }
      );

      if (res.success) {
        showToast('success', res.message || 'Work item added to sheet successfully!');
        setShowAddModal(false);
        setAddForm({
          organization_id: isClient ? (user?.organization_id || '') : selectedBrandId !== 'ALL' ? selectedBrandId : '',
          title: '',
          description: '',
          category: 'Feature Request',
          priority: 'P2',
          target_url: '',
          due_date: '',
          estimated_hours: '',
          assigned_to_user_id: '',
          team_remarks: '',
        });
        fetchItems();
        fetchBrands();
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to add work item');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Inline Quick Status Change
  const handleQuickStatusChange = async (itemId: string, newStatus: BrandSheetStatus) => {
    try {
      const res = await api.post<{ success: boolean; message: string; data: BrandSheetItem }>(
        `/brand-sheets/${itemId}/status`,
        { status: newStatus }
      );
      if (res.success && res.data) {
        setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...res.data } : it)));
        showToast('success', `Status updated to ${STATUS_CONFIG[newStatus].label}`);
        fetchItems();
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update status');
    }
  };

  // Inline Quick Assignee Change (Staff only)
  const handleQuickAssigneeChange = async (itemId: string, newAssigneeId: string) => {
    try {
      const res = await api.put<{ success: boolean; data: BrandSheetItem }>(`/brand-sheets/${itemId}`, {
        assigned_to_user_id: newAssigneeId,
      });
      if (res.success && res.data) {
        setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...res.data } : it)));
        showToast('success', 'Assigned specialist updated');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update assignee');
    }
  };

  // Save Remarks from Modal
  const handleSaveRemarks = async () => {
    if (!remarksModalItem) return;
    setSavingRemarks(true);
    try {
      const res = await api.put<{ success: boolean; data: BrandSheetItem }>(
        `/brand-sheets/${remarksModalItem.id}`,
        { team_remarks: tempRemarks.trim() }
      );
      if (res.success && res.data) {
        setItems((prev) =>
          prev.map((it) => (it.id === remarksModalItem.id ? { ...it, ...res.data } : it))
        );
        showToast('success', 'Team remarks saved and updated on sheet!');
        setRemarksModalItem(null);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save remarks');
    } finally {
      setSavingRemarks(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (itemId: string, code: string) => {
    if (!confirm(`Are you sure you want to delete work item ${code}?`)) return;
    try {
      const res = await api.delete<{ success: boolean }>(`/brand-sheets/${itemId}`);
      if (res.success) {
        setItems((prev) => prev.filter((it) => it.id !== itemId));
        showToast('success', `Item ${code} deleted from sheet`);
        fetchBrands();
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete item');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (items.length === 0) {
      showToast('error', 'No items to export');
      return;
    }

    const headers = [
      'Item Code',
      'Brand',
      'Title',
      'Category',
      'Priority',
      'Status',
      'Target URL',
      'Due Date',
      'Assigned Specialist',
      'Created By',
      'Team Remarks',
      'Created At',
      'Completed At',
    ];

    const rows = items.map((it) => [
      `"${it.item_code}"`,
      `"${it.organization_name || ''}"`,
      `"${(it.title || '').replace(/"/g, '""')}"`,
      `"${it.category || ''}"`,
      `"${it.priority || ''}"`,
      `"${it.status || ''}"`,
      `"${it.target_url || ''}"`,
      `"${it.due_date || ''}"`,
      `"${it.assigned_to_name || 'Unassigned'}"`,
      `"${it.created_by_name || ''}"`,
      `"${(it.team_remarks || '').replace(/"/g, '""')}"`,
      `"${it.created_at || ''}"`,
      `"${it.completed_at || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const brandNameClean = currentBrandMeta ? currentBrandMeta.name.replace(/\s+/g, '_') : 'All_Brands';
    link.setAttribute('download', `${brandNameClean}_Work_Sheet_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="py-6 px-3 sm:px-6 max-w-[1600px] mx-auto space-y-6 animate-fadeIn">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 text-xs font-semibold animate-fadeIn ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* =========================================================================
          HERO BANNER
      ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-blue-400/30">
              <FileSpreadsheet size={13} />
              <span>{isClient ? 'Dedicated Client Work Backlog' : 'Multi-Brand Collaborative Work Suite'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>{isClient ? `${user?.organization_name || 'Brand'} Work Sheet` : 'Brand Work Sheets'}</span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl font-normal leading-relaxed">
              {isClient
                ? 'Add what works to be done on your website and applications. Our engineering team reviews, updates progress, and records developer remarks in real-time.'
                : 'Central work backlog across all brand partners. Review client requests, assign team specialists, update execution status, and share developer remarks.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {currentBrandMeta?.google_sheet_url && (
              <a
                href={currentBrandMeta.google_sheet_url}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                title="Open live Google Sheet"
              >
                <FileSpreadsheet size={14} className="text-emerald-400" />
                <span>Open Google Sheet</span>
                <ArrowUpRight size={13} />
              </a>
            )}

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Download CSV export"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={() => {
                setAddForm((prev) => ({
                  ...prev,
                  organization_id: isClient
                    ? user?.organization_id || ''
                    : selectedBrandId !== 'ALL'
                    ? selectedBrandId
                    : brands[0]?.id || '',
                }));
                setShowAddModal(true);
              }}
              className="px-4 py-2 sm:px-5 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={16} />
              <span>{isClient ? 'Add Work to Sheet' : 'Add Work Item'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MULTI-BRAND SWITCHER (Visible to internal staff)
      ========================================================================= */}
      {isStaff && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <Building2 size={14} className="text-indigo-600" />
              <span>Select Brand Sheet ({brands.length} Brands Available):</span>
            </span>
            <span>Switch tabs to view or edit each brand's separate sheet</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedBrandId('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedBrandId === 'ALL'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Layers size={13} />
              <span>All Brands Consolidated</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedBrandId === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {brands.reduce((acc, b) => acc + b.item_count, 0)}
              </span>
            </button>

            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBrandId(b.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  selectedBrandId === b.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Building2 size={13} className={selectedBrandId === b.id ? 'text-indigo-200' : 'text-slate-400'} />
                <span>{b.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    selectedBrandId === b.id ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {b.item_count}
                </span>
                {b.active_count > 0 && selectedBrandId !== b.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title={`${b.active_count} active items`} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          METRIC SUMMARY CARDS
      ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-sm">
          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Total Items</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{summary.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Logged on sheet</div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/80 p-3.5 sm:p-4 shadow-sm bg-gradient-to-br from-amber-50/40 to-transparent">
          <div className="text-[10.5px] font-bold text-amber-700 uppercase tracking-wider">To Do / Pending</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{summary.pending}</div>
          <div className="text-[11px] text-amber-800/80 mt-0.5">Awaiting start</div>
        </div>

        <div className="bg-white rounded-2xl border border-blue-200/80 p-3.5 sm:p-4 shadow-sm bg-gradient-to-br from-blue-50/40 to-transparent">
          <div className="text-[10.5px] font-bold text-blue-700 uppercase tracking-wider">In Progress</div>
          <div className="text-2xl font-black text-blue-700 mt-1">{summary.in_progress}</div>
          <div className="text-[11px] text-blue-800/80 mt-0.5">Active development</div>
        </div>

        <div className="bg-white rounded-2xl border border-purple-200/80 p-3.5 sm:p-4 shadow-sm bg-gradient-to-br from-purple-50/40 to-transparent">
          <div className="text-[10.5px] font-bold text-purple-700 uppercase tracking-wider">In Review / QA</div>
          <div className="text-2xl font-black text-purple-700 mt-1">{summary.in_review}</div>
          <div className="text-[11px] text-purple-800/80 mt-0.5">Testing & review</div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200/80 p-3.5 sm:p-4 shadow-sm bg-gradient-to-br from-emerald-50/40 to-transparent">
          <div className="text-[10.5px] font-bold text-emerald-700 uppercase tracking-wider">Completed</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{summary.completed}</div>
          <div className="text-[11px] text-emerald-800/80 mt-0.5">Delivered & verified</div>
        </div>

        <div className="bg-white rounded-2xl border border-rose-200/80 p-3.5 sm:p-4 shadow-sm bg-gradient-to-br from-rose-50/40 to-transparent">
          <div className="text-[10.5px] font-bold text-rose-700 uppercase tracking-wider">Blocked / Hold</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{summary.blocked}</div>
          <div className="text-[11px] text-rose-800/80 mt-0.5">Needs clarification</div>
        </div>
      </div>

      {/* =========================================================================
          MAIN SPREADSHEET CARD
      ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search work title, code, scope, or dev remarks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
            >
              Filter
            </button>
          </form>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Selector */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Not Completed)</option>
              <option value="PENDING">Pending / To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="COMPLETED">Completed</option>
              <option value="BLOCKED">Blocked</option>
            </select>

            {/* Category Selector */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Priority Selector */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="P1">P1 - Critical</option>
              <option value="P2">P2 - High</option>
              <option value="P3">P3 - Medium</option>
              <option value="P4">P4 - Low</option>
            </select>

            <button
              onClick={fetchItems}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors ml-auto lg:ml-0"
              title="Refresh sheet"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Spreadsheet Content */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span>Loading brand work sheet...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileSpreadsheet size={28} />
            </div>
            <div className="text-base font-bold text-slate-900">
              No Work Items on this Sheet Yet
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {isClient
                ? 'Your brand work sheet is currently clear. Click "Add Work to Sheet" whenever you have a new task, feature request, or update to be done.'
                : 'No work items match the current brand or status filter. Click "Add Work Item" to log work for this brand.'}
            </p>
            <button
              onClick={() => {
                setAddForm((prev) => ({
                  ...prev,
                  organization_id: isClient
                    ? user?.organization_id || ''
                    : selectedBrandId !== 'ALL'
                    ? selectedBrandId
                    : brands[0]?.id || '',
                }));
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Plus size={14} />
              <span>Add Work Item Now</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <th className="py-3 px-3.5 w-24">Item Code</th>
                  {isStaff && selectedBrandId === 'ALL' && <th className="py-3 px-3.5 w-32">Brand</th>}
                  <th className="py-3 px-3.5 min-w-[260px]">Work to be Done & Scope</th>
                  <th className="py-3 px-3.5 w-28">Category</th>
                  <th className="py-3 px-3.5 w-24">Priority</th>
                  <th className="py-3 px-3.5 w-36">Status</th>
                  <th className="py-3 px-3.5 w-40">Assigned Team</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Team Remarks & Updates</th>
                  <th className="py-3 px-3.5 w-28">Target Date</th>
                  <th className="py-3 px-3.5 w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-blue-50/30 transition-colors ${
                        item.status === 'COMPLETED' ? 'bg-slate-50/40 text-slate-600' : ''
                      }`}
                    >
                      {/* Code */}
                      <td className="py-3.5 px-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[11px]">
                          {item.item_code}
                        </span>
                      </td>

                      {/* Brand (if viewing all) */}
                      {isStaff && selectedBrandId === 'ALL' && (
                        <td className="py-3.5 px-3.5 font-bold text-slate-800 truncate max-w-[140px]">
                          <span className="flex items-center gap-1.5" title={item.organization_name}>
                            <Building2 size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{item.organization_name}</span>
                          </span>
                        </td>
                      )}

                      {/* Work to be done & Scope */}
                      <td className="py-3.5 px-3.5">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{item.title}</span>
                            {item.target_url && (
                              <a
                                href={item.target_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-500 hover:text-blue-700 inline-flex items-center gap-0.5 text-[10.5px] font-semibold"
                                title="Open reference link"
                              >
                                <Globe size={11} />
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-slate-500 text-[11px] line-clamp-2 max-w-xl">
                              {item.description}
                            </p>
                          )}
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>Logged by {item.created_by_name}</span>
                            <span>•</span>
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.category}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <PriorityBadge priority={item.priority} />
                      </td>

                      {/* Status (Interactive for staff, badge for client) */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        {isStaff ? (
                          <div className="relative inline-block">
                            <select
                              value={item.status}
                              onChange={(e) =>
                                handleQuickStatusChange(item.id, e.target.value as BrandSheetStatus)
                              }
                              className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}
                            >
                              <option value="PENDING">To Do / Pending</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="IN_REVIEW">In Review / QA</option>
                              <option value="COMPLETED">Completed</option>
                              <option value="BLOCKED">Blocked</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                            <span>{statusInfo.label}</span>
                          </span>
                        )}
                      </td>

                      {/* Assigned Team */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        {isStaff ? (
                          <select
                            value={item.assigned_to_user_id || ''}
                            onChange={(e) => handleQuickAssigneeChange(item.id, e.target.value)}
                            className="text-[11px] font-medium bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[140px]"
                          >
                            <option value="">Unassigned</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                              {item.assigned_to_name ? item.assigned_to_name.charAt(0) : '?'}
                            </div>
                            <span className="truncate max-w-[120px]">
                              {item.assigned_to_name || 'Assurance Team'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Team Remarks & Updates */}
                      <td className="py-3.5 px-3.5">
                        {item.team_remarks ? (
                          <div
                            onClick={() => {
                              if (isStaff) {
                                setRemarksModalItem(item);
                                setTempRemarks(item.team_remarks || '');
                              }
                            }}
                            className={`p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 italic max-w-sm cursor-pointer hover:bg-slate-100 transition-colors ${
                              isStaff ? 'hover:border-blue-300' : ''
                            }`}
                            title={isStaff ? 'Click to edit remarks' : ''}
                          >
                            "{item.team_remarks}"
                          </div>
                        ) : isStaff ? (
                          <button
                            onClick={() => {
                              setRemarksModalItem(item);
                              setTempRemarks('');
                            }}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                          >
                            <Plus size={12} /> Add Remarks
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No notes yet</span>
                        )}
                      </td>

                      {/* Target Date */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap text-slate-600 font-medium">
                        {item.due_date ? (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Calendar size={12} className="text-slate-400" />
                            <span>{item.due_date}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingItem(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit work item details"
                          >
                            <Edit3 size={13} />
                          </button>
                          {(isStaff || item.created_by_user_id === user?.id) && (
                            <button
                              onClick={() => handleDeleteItem(item.id, item.item_code)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete work item"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL: ADD WORK ITEM
      ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Plus size={18} className="text-blue-600" />
                  <span>Add Work to {currentBrandMeta?.name || 'Brand'} Sheet</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Describe what needs to be done. The team will see this on the sheet immediately.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="overflow-y-auto flex-1 space-y-4 py-3">
              {/* Brand Selector (Staff only) */}
              {isStaff && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Target Brand / Organization <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={addForm.organization_id}
                    onChange={(e) => setAddForm({ ...addForm, organization_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select Brand...</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  What work needs to be done? <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fix mobile checkout banner, Revamp product cards, Add promo code..."
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Category & Priority Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Category</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Priority Level</label>
                  <select
                    value={addForm.priority}
                    onChange={(e) => setAddForm({ ...addForm, priority: e.target.value as TicketPriority })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="P1">P1 - Critical Blocker</option>
                    <option value="P2">P2 - High Priority</option>
                    <option value="P3">P3 - Medium (Standard)</option>
                    <option value="P4">P4 - Low / Nice to Have</option>
                  </select>
                </div>
              </div>

              {/* Description / Scope */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Detailed Scope / Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Provide any specific requirements, reproduction steps, or design notes..."
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Target Page URL & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Target Page / Website URL</label>
                  <input
                    type="url"
                    placeholder="https://yourbrand.com/page"
                    value={addForm.target_url}
                    onChange={(e) => setAddForm({ ...addForm, target_url: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Target Completion Date</label>
                  <input
                    type="date"
                    value={addForm.due_date}
                    onChange={(e) => setAddForm({ ...addForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Staff Only Fields */}
              {isStaff && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Internal Engineering Options
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Assign Specialist</label>
                      <select
                        value={addForm.assigned_to_user_id}
                        onChange={(e) => setAddForm({ ...addForm, assigned_to_user_id: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Unassigned</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Estimated Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="e.g. 4.5"
                        value={addForm.estimated_hours}
                        onChange={(e) => setAddForm({ ...addForm, estimated_hours: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Initial Developer Remarks</label>
                    <input
                      type="text"
                      placeholder="e.g. Assigned to sprint, waiting for assets..."
                      value={addForm.team_remarks}
                      onChange={(e) => setAddForm({ ...addForm, team_remarks: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  {submittingAdd ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving to Sheet...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Add to Brand Sheet</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT WORK ITEM (Comprehensive)
      ========================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit3 size={18} className="text-indigo-600" />
                  <span>Edit {editingItem.item_code}</span>
                </h3>
                <span className="text-xs text-slate-500">
                  {editingItem.organization_name || 'Brand'} Work Sheet Entry
                </span>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const res = await api.put<{ success: boolean; data: BrandSheetItem }>(
                    `/brand-sheets/${editingItem.id}`,
                    editingItem
                  );
                  if (res.success && res.data) {
                    setItems((prev) =>
                      prev.map((it) => (it.id === editingItem.id ? { ...it, ...res.data } : it))
                    );
                    showToast('success', `Item ${editingItem.item_code} updated!`);
                    setEditingItem(null);
                    fetchItems();
                  }
                } catch (err: any) {
                  showToast('error', err?.message || 'Failed to update item');
                }
              }}
              className="overflow-y-auto flex-1 space-y-4 py-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Work Title</label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Category</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Priority</label>
                  <select
                    value={editingItem.priority}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, priority: e.target.value as TicketPriority })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                  >
                    <option value="P1">P1 - Critical</option>
                    <option value="P2">P2 - High</option>
                    <option value="P3">P3 - Medium</option>
                    <option value="P4">P4 - Low</option>
                  </select>
                </div>
              </div>

              {/* Status & Assignee (Staff only) */}
              {isStaff && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Execution Status</label>
                    <select
                      value={editingItem.status}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, status: e.target.value as BrandSheetStatus })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      <option value="PENDING">To Do / Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="IN_REVIEW">In Review / QA</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="BLOCKED">Blocked</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Assignee Specialist</label>
                    <select
                      value={editingItem.assigned_to_user_id || ''}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, assigned_to_user_id: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                    >
                      <option value="">Unassigned</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Detailed Scope / Instructions</label>
                <textarea
                  rows={3}
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              {isStaff && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Developer & Team Remarks (Visible to Client)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Fix deployed to staging for brand verification..."
                    value={editingItem.team_remarks || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, team_remarks: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Target URL</label>
                  <input
                    type="url"
                    value={editingItem.target_url || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, target_url: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Target Date</label>
                  <input
                    type="date"
                    value={editingItem.due_date || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: QUICK DEVELOPER REMARKS
      ========================================================================= */}
      {remarksModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare size={16} className="text-blue-600" />
                  <span>Team Remarks for {remarksModalItem.item_code}</span>
                </h3>
                <span className="text-xs text-slate-500 truncate max-w-xs block">
                  {remarksModalItem.title}
                </span>
              </div>
              <button
                onClick={() => setRemarksModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <textarea
                rows={4}
                placeholder="Enter engineering remarks, deployment links, or status updates for this brand..."
                value={tempRemarks}
                onChange={(e) => setTempRemarks(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRemarksModalItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingRemarks}
                  onClick={handleSaveRemarks}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                >
                  {savingRemarks ? 'Saving...' : 'Save Remarks'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
