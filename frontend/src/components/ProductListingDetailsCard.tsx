import React, { useState } from 'react';
import { Ticket } from '../types/index.js';
import { Package, Copy, Check, ExternalLink, Sparkles, Tag, DollarSign, Image as ImageIcon } from 'lucide-react';

interface ProductListingDetailsCardProps {
  ticket: Ticket;
}

export const ProductListingDetailsCard: React.FC<ProductListingDetailsCardProps> = ({ ticket }) => {
  const [copiedSku, setCopiedSku] = useState(false);

  const isListing =
    ticket.ticket_type === 'listing' ||
    Boolean(ticket.sku) ||
    ticket.category === 'Product Listing / Catalog';

  if (!isListing) return null;

  const handleCopySku = () => {
    if (ticket.sku) {
      navigator.clipboard.writeText(ticket.sku);
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 2000);
    }
  };

  // Calculate discount percentage if numeric
  const calculateDiscount = () => {
    if (!ticket.product_price || !ticket.compare_at_price) return null;
    const p = parseFloat(ticket.product_price.replace(/[^0-9.]/g, ''));
    const c = parseFloat(ticket.compare_at_price.replace(/[^0-9.]/g, ''));
    if (p > 0 && c > p) {
      const discountPct = Math.round(((c - p) / c) * 100);
      const savings = (c - p).toLocaleString('en-IN', { maximumFractionDigits: 2 });
      return { discountPct, savings };
    }
    return null;
  };

  const discount = calculateDiscount();

  // Parse listing details if JSON string
  let extraDetails: any = null;
  if (ticket.listing_details) {
    if (typeof ticket.listing_details === 'string') {
      try {
        extraDetails = JSON.parse(ticket.listing_details);
      } catch (e) {
        extraDetails = null;
      }
    } else {
      extraDetails = ticket.listing_details;
    }
  }

  const requestedChanges = extraDetails?.changes || null;
  const catalogDescription = extraDetails?.catalog_description || null;

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 p-5 shadow-sm space-y-4">
      {/* Top Header Pill Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-600 text-white shadow-xs">
            <Package size={14} />
            PRODUCT LISTING SPECIFICATIONS
          </span>

          {ticket.listing_action && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                ticket.listing_action === 'new_listing'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {ticket.listing_action === 'new_listing' ? '🆕 New Listing' : '✏️ Edit Existing Listing'}
            </span>
          )}
        </div>

        {ticket.sku && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">SKU:</span>
            <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-300 shadow-xs select-all">
              {ticket.sku}
            </span>
            <button
              type="button"
              onClick={handleCopySku}
              title="Copy SKU to clipboard"
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {copiedSku ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* Grid of Product Attributes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {ticket.product_title && (
          <div className="sm:col-span-3 bg-white p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-0.5">
              Product Title / Catalog Name
            </span>
            <div className="text-sm font-bold text-slate-900">{ticket.product_title}</div>
          </div>
        )}

        {(ticket.product_price || ticket.compare_at_price) && (
          <div className="sm:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
            {ticket.product_price && (
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-0.5">
                  Selling Price
                </span>
                <div className="text-base font-extrabold text-emerald-700">
                  {ticket.product_price.startsWith('₹') || ticket.product_price.startsWith('$')
                    ? ticket.product_price
                    : `₹${ticket.product_price}`}
                </div>
              </div>
            )}

            {ticket.compare_at_price && (
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-0.5">
                  Compare-at Price (MRP)
                </span>
                <div className="text-sm font-medium text-slate-400 line-through">
                  {ticket.compare_at_price.startsWith('₹') || ticket.compare_at_price.startsWith('$')
                    ? ticket.compare_at_price
                    : `₹${ticket.compare_at_price}`}
                </div>
              </div>
            )}

            {discount && (
              <div className="flex items-center">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Sparkles size={12} />
                  {discount.discountPct}% OFF • Save ₹{discount.savings}
                </span>
              </div>
            )}
          </div>
        )}

        {ticket.product_images && (
          <div className="sm:col-span-3 bg-white p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-1">
              Product Images & Media Drive Link
            </span>
            <div className="text-slate-800 whitespace-pre-wrap break-all font-mono text-xs space-y-1">
              {ticket.product_images.split('\n').map((line, idx) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                  return (
                    <div key={idx}>
                      <a
                        href={trimmed}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        <ExternalLink size={12} />
                        <span>{trimmed}</span>
                      </a>
                    </div>
                  );
                }
                return trimmed ? <div key={idx}>{line}</div> : null;
              })}
            </div>
          </div>
        )}

        {requestedChanges && (
          <div className="sm:col-span-3 bg-white p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-1">
              Changes to be Made / Action Instructions
            </span>
            <div className="text-slate-900 whitespace-pre-wrap leading-relaxed">
              {requestedChanges}
            </div>
          </div>
        )}

        {catalogDescription && (
          <div className="sm:col-span-3 bg-white p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-1">
              Product Description & Specifications
            </span>
            <div className="text-slate-900 whitespace-pre-wrap leading-relaxed">
              {catalogDescription}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
