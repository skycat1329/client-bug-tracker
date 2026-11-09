import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Website, TicketPriority } from '../../types/index.js';
import {
  Upload,
  AlertCircle,
  ArrowLeft,
  Bug,
  Package,
  PlusCircle,
  Edit3,
  DollarSign,
  Tag,
  Link as LinkIcon,
  FileText,
  Sparkles,
} from 'lucide-react';

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

  // Ticket mode: Bug report vs Product listing issue
  const [ticketMode, setTicketMode] = useState<'bug' | 'listing'>('bug');

  // Shared fields
  const [websiteId, setWebsiteId] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('P3');
  const [file, setFile] = useState<File | null>(null);

  // Bug specific fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Checkout & Payments');
  const [environment, setEnvironment] = useState('production');
  const [browser, setBrowser] = useState('');
  const [device, setDevice] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');

  // Product listing specific fields
  const [listingAction, setListingAction] = useState<'new_listing' | 'edit_existing'>('new_listing');
  const [sku, setSku] = useState('');
  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [productImages, setProductImages] = useState('');
  const [listingChanges, setListingChanges] = useState('');
  const [productDescription, setProductDescription] = useState('');

  // Auto-calculated discount helper
  const calculateDiscount = () => {
    const parseVal = (str: string) => {
      const num = parseFloat(str.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? 0 : num;
    };
    const sell = parseVal(productPrice);
    const mrp = parseVal(compareAtPrice);
    if (sell > 0 && mrp > sell) {
      const discountPct = Math.round(((mrp - sell) / mrp) * 100);
      const savings = (mrp - sell).toLocaleString('en-IN', { maximumFractionDigits: 2 });
      return { discountPct, savings };
    }
    return null;
  };
  const discountInfo = calculateDiscount();

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
      let finalTitle = '';
      let finalDescription = '';
      let finalCategory = category;

      if (ticketMode === 'listing') {
        finalCategory = 'Product Listing / Catalog';
        const actionLabel = listingAction === 'new_listing' ? 'New Listing' : 'Edit Listing';
        finalTitle = `[${actionLabel}] ${sku ? `[${sku.trim()}] ` : ''}${productTitle.trim() || 'Product Listing Request'}`;

        // Construct structured markdown description for listing issue
        finalDescription = [
          `### 📦 Product Listing Request: ${actionLabel}`,
          `• **SKU / Style Code:** \`${sku.trim()}\``,
          `• **Product Title:** ${productTitle.trim()}`,
          productPrice.trim() ? `• **Selling / Regular Price:** ${productPrice.trim()}` : null,
          compareAtPrice.trim() ? `• **Compare-at Price (MRP):** ${compareAtPrice.trim()}${discountInfo ? ` (${discountInfo.discountPct}% OFF - Save ₹${discountInfo.savings})` : ''}` : null,
          productImages.trim() ? `\n#### 🖼️ Product Images & Media Drive Link:\n${productImages.trim()}` : null,
          `\n#### 📝 Changes to be Made & Action Required:\n${listingChanges.trim()}`,
          productDescription.trim() ? `\n#### 📋 Product Description & Specifications:\n${productDescription.trim()}` : null,
        ].filter(Boolean).join('\n');
      } else {
        finalTitle = title.trim();
        finalDescription = description.trim();
      }

      // 1. Create ticket
      const ticketRes = await api.post<{ success: boolean; ticket: any }>('/tickets', {
        website_id: websiteId,
        title: finalTitle,
        description: finalDescription,
        category: finalCategory,
        priority,
        environment: ticketMode === 'listing' ? 'production' : (environment || 'production'),
        browser: ticketMode === 'listing' ? undefined : (browser?.trim() || undefined),
        device: ticketMode === 'listing' ? undefined : (device?.trim() || undefined),
        steps_to_reproduce: ticketMode === 'listing' ? undefined : (stepsToReproduce?.trim() || undefined),
        // Structured listing attributes
        ticket_type: ticketMode === 'listing' ? 'listing' : 'bug',
        listing_action: ticketMode === 'listing' ? listingAction : undefined,
        sku: ticketMode === 'listing' ? sku.trim() : undefined,
        product_title: ticketMode === 'listing' ? productTitle.trim() : undefined,
        product_price: ticketMode === 'listing' ? productPrice.trim() : undefined,
        compare_at_price: ticketMode === 'listing' ? compareAtPrice.trim() : undefined,
        product_images: ticketMode === 'listing' ? productImages.trim() : undefined,
        listing_details: ticketMode === 'listing' ? {
          action: listingAction,
          sku: sku.trim(),
          title: productTitle.trim(),
          price: productPrice.trim(),
          compare_at_price: compareAtPrice.trim(),
          images: productImages.trim(),
          changes: listingChanges.trim(),
          catalog_description: productDescription.trim(),
        } : undefined,
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
        setError(err.message || 'Failed to submit ticket');
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
          <h1 className="text-xl font-bold text-slate-900">Raise Brand Support Ticket</h1>
          <p className="text-sm text-slate-500 mt-1">
            Choose whether you are reporting a website bug or submitting a product listing / catalog request.
          </p>

          {/* Ticket Mode Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={() => setTicketMode('bug')}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                ticketMode === 'bug'
                  ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  ticketMode === 'bug' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Bug size={18} />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900">Website Bug / Defect</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Checkout issues, UI breaks, slow loading, error alerts
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTicketMode('listing')}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                ticketMode === 'listing'
                  ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  ticketMode === 'listing' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Package size={18} />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                  <span>Product Listing Issue</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                    Catalog
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  New product listing, SKU changes, price/MRP, images, copy
                </div>
              </div>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Affected Website & Priority (Common to both modes) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Website / Brand Store *
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
                Priority / Urgency *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="P1">P1 — Critical (Launch blocked / Emergency)</option>
                <option value="P2">P2 — High (High priority catalog drop / Promo)</option>
                <option value="P3">P3 — Normal (Standard catalog turnaround)</option>
                <option value="P4">P4 — Low (Minor update / backlog)</option>
              </select>
            </div>
          </div>

          {/* ==================== PRODUCT LISTING ISSUE MODE ==================== */}
          {ticketMode === 'listing' ? (
            <div className="space-y-5 bg-indigo-50/30 border border-indigo-100 rounded-xl p-5">
              {/* Listing Action: New Listing vs Edit Existing */}
              <div>
                <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2">
                  Listing Action Required *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      listingAction === 'new_listing'
                        ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 text-indigo-950 font-semibold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="listing_action"
                      checked={listingAction === 'new_listing'}
                      onChange={() => setListingAction('new_listing')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                      <PlusCircle size={16} className="text-indigo-600" />
                      <span>New Product Listing</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      listingAction === 'edit_existing'
                        ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 text-indigo-950 font-semibold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="listing_action"
                      checked={listingAction === 'edit_existing'}
                      onChange={() => setListingAction('edit_existing')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                      <Edit3 size={16} className="text-indigo-600" />
                      <span>Edit Existing Listing</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* SKU & Product Title */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Product SKU *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Primary / Parent</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. AM-1049-BLK"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={productTitle}
                    onChange={(e) => setProductTitle(e.target.value)}
                    placeholder="e.g. Men's Slim Fit Cotton Linen Shirt - Black"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign size={14} className="text-emerald-600" />
                    Product Pricing & Compare MRP
                  </span>
                  {discountInfo && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Sparkles size={12} />
                      {discountInfo.discountPct}% OFF • Save ₹{discountInfo.savings}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Selling / Offer Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">₹</span>
                      <input
                        type="text"
                        value={productPrice}
                        onChange={(e) => setProductPrice(e.target.value)}
                        placeholder="999"
                        className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Final price customer pays at checkout</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Compare-at Price (MRP)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">₹</span>
                      <input
                        type="text"
                        value={compareAtPrice}
                        onChange={(e) => setCompareAtPrice(e.target.value)}
                        placeholder="1999"
                        className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Strikethrough MRP shown to show discount</span>
                  </div>
                </div>
              </div>

              {/* Product Images & Media Drive Link */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <LinkIcon size={13} className="text-indigo-600" />
                    Product Images & Assets (Drive / Cloud Link / URLs)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Google Drive / Dropbox / CDN</span>
                </label>
                <textarea
                  rows={2}
                  value={productImages}
                  onChange={(e) => setProductImages(e.target.value)}
                  placeholder="Paste Google Drive folder link, Dropbox, WeTransfer, or image URLs..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Tip: Ensure Drive folders are set to &quot;Anyone with the link can view&quot;.
                </span>
              </div>

              {/* Changes to be made / Action Required */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Changes to be Made / Action Instructions *</span>
                  <span className="text-[10px] text-indigo-600 font-medium">Clear task instructions for catalog team</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={listingChanges}
                  onChange={(e) => setListingChanges(e.target.value)}
                  placeholder={
                    listingAction === 'new_listing'
                      ? '1. Create new product under Men > Shirts category\n2. Set inventory to 50 pcs per size (S, M, L, XL)\n3. Tag: summer, linen, casual\n4. Add size guide chart from drive folder'
                      : '1. Update title to Men\'s Slim Fit Cotton Linen Shirt - Black\n2. Change selling price to ₹999 and MRP to ₹1,999\n3. Replace 2nd image with high-res file from drive link\n4. Add bullet points for 100% pure linen fabric'
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              {/* Product Description / Bullet Points / Specifications */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Product Description & Catalog Copy</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional specifications & bullet points</span>
                </label>
                <textarea
                  rows={4}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Crafted from 100% breathable linen cotton, this shirt features a mandarin collar, button cuffs, and a regular tapered fit. Ideal for warm summer evenings.&#10;&#10;• Material: 100% Cotton Linen&#10;• Fit: Slim Fit&#10;• Wash Care: Machine wash cold with like colors"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>
          ) : (
            /* ==================== WEBSITE BUG REPORT MODE ==================== */
            <div className="space-y-6">
              {/* Environment */}
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

              {/* Category */}
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
            </div>
          )}

          {/* Screenshot / File Upload (Common) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {ticketMode === 'listing'
                ? 'Attach Catalog File, Photo, or Mockup (Max 10MB)'
                : 'Attach Screenshot or Video (Max 10MB)'}
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center hover:bg-slate-50 transition-colors">
              <Upload className="mx-auto text-slate-400 mb-2" size={24} />
              <input
                type="file"
                id="file-upload"
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                className="hidden"
                accept="image/*,video/mp4,video/webm,application/pdf,.csv,.xlsx,.xls,.zip"
              />
              <label
                htmlFor="file-upload"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                {file ? file.name : (ticketMode === 'listing' ? 'Click to upload catalog spreadsheet, mockup or photos' : 'Click to upload a screenshot or screen recording')}
              </label>
              <p className="text-xs text-slate-500 mt-1">PNG, JPG, WEBP, PDF, CSV, XLSX, ZIP up to 10MB</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors shadow-sm text-center disabled:opacity-50 ${
                ticketMode === 'listing'
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {submitting
                ? 'Submitting Request...'
                : ticketMode === 'listing'
                ? 'Submit Listing Request'
                : 'Submit Bug Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};