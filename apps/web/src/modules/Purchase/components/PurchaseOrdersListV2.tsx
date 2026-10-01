/**
 * PurchaseOrdersListV2 — the V2 list screen.
 *
 * Feature source: V1 (PurchaseOrders.tsx) — search, status filter, vendor
 * filter, pagination, per-row action menu, PDF preview / print / download,
 * duplicate, delete.
 * UI source: CreateQuotation's list treatment (card table, muted chrome,
 * indigo accents) rather than V1's toolbar-heavy layout.
 *
 * V1 BUGS FIXED HERE:
 *   1. V1 wrote its activity timeline to `po_activity_log`, a table that has
 *      never held a row. V2 uses `purchase_audit_log` (see ./poAudit.ts).
 *   2. V1's delete ran as a multi-step client sequence (check links, insert
 *      audit row, delete items, delete header) with no transaction. V2 keeps
 *      the same link guards but performs the delete through a single call and
 *      reports precisely which linked documents blocked it.
 *   3. V1's duplicate silently dropped the PO number and re-ran PO series
 *      resolution on the client, which could collide with an existing number.
 *      V2 clones into a new unsaved draft and lets the server allocate the
 *      number under lock.
 *   4. V1's search ran an `or()` across po_number and a vendor-id list without
 *      scoping the vendor lookup to the organisation. V2 scopes it.
 *
 * The editor is PurchaseOrdersV2; this file only lists and acts.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, MoreHorizontal, Edit, Copy, Trash2, Receipt,
  Printer, Download, Loader2, FileText, ChevronLeft, ChevronRight, X, AlertTriangle,
} from 'lucide-react';

import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from '@/lib/logger';
import { formatCurrency } from '../../../utils/formatters';
import { withSessionCheck } from '../../../queryClient';
import { generatePOPDF, downloadPDF, openPDFPreview } from '../utils/pdfGenerator';
import { logPoActivity } from './poAudit';

const PAGE_SIZE = 25;

/** Approval workflow, matching V1's APPROVAL_STEPS (PurchaseOrders.tsx:79). */
const STATUS_OPTIONS = [
  '', 'Draft', 'Pending Approval', 'Approved', 'Sent',
  'Acknowledged', 'Partially Received', 'Completed', 'Cancelled',
] as const;

const STATUS_TONE: Record<string, string> = {
  'Draft': 'bg-zinc-100 text-zinc-600 border-zinc-200',
  'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200',
  'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Sent': 'bg-sky-50 text-sky-700 border-sky-200',
  'Acknowledged': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Partially Received': 'bg-violet-50 text-violet-700 border-violet-200',
  'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Cancelled': 'bg-rose-50 text-rose-600 border-rose-200',
  'Rejected': 'bg-rose-50 text-rose-600 border-rose-200',
};

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] || 'bg-zinc-100 text-zinc-600 border-zinc-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {status || '—'}
    </span>
  );
}

interface PoListRow {
  id: string;
  po_number: string | null;
  po_date: string | null;
  delivery_date: string | null;
  vendor_id: string | null;
  reference_no: string | null;
  currency: string | null;
  total_amount: number | null;
  total_amount_inr: number | null;
  status: string | null;
  approval_status: string | null;
  project_id: string | null;
  vendor?: { company_name: string | null } | null;
}

export default function PurchaseOrdersListV2() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [vendorFilter, setVendorFilter] = useState<string>('');
  const [page, setPage] = useState(0);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PoListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pdfTarget, setPdfTarget] = useState<PoListRow | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (!openMenuId) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenuId]);

  // ---- data ---------------------------------------------------------------
  const { data: vendors = [] } = useQuery({
    queryKey: ['po-v2-list-vendors', orgId],
    queryFn: withSessionCheck(async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('id, company_name')
        .eq('organisation_id', orgId)
        .order('company_name');
      if (error) throw error;
      return data || [];
    }),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['po-v2-list', orgId, debouncedSearch, statusFilter, vendorFilter, page],
    queryFn: withSessionCheck(async () => {
      if (!orgId) return { rows: [] as PoListRow[], count: 0 };
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('purchase_orders')
        .select(
          'id, po_number, po_date, delivery_date, vendor_id, reference_no, currency, ' +
          'total_amount, total_amount_inr, status, approval_status, project_id, ' +
          'vendor:purchase_vendors(company_name)',
          { count: 'exact' }
        )
        .eq('organisation_id', orgId)
        .order('po_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (statusFilter) query = query.eq('status', statusFilter);
      if (vendorFilter) query = query.eq('vendor_id', vendorFilter);

      if (debouncedSearch) {
        // Vendor names are not a searchable column on purchase_orders, so match
        // vendors in scope first, then OR the two searchable dimensions.
        // Scoped to orgId — V1 did not scope this lookup.
        const { data: matchingVendors } = await supabase
          .from('purchase_vendors')
          .select('id')
          .eq('organisation_id', orgId)
          .ilike('company_name', `%${debouncedSearch}%`);

        const vendorIds = (matchingVendors || []).map(v => v.id);
        const term = debouncedSearch.replace(/[%,()]/g, ' ').trim();

        const orParts = [`po_number.ilike.%${term}%`, `reference_no.ilike.%${term}%`];
        if (vendorIds.length) orParts.push(`vendor_id.in.(${vendorIds.join(',')})`);
        query = query.or(orParts.join(','));
      }

      const { data: rows, count, error } = await query;
      if (error) throw error;
      return { rows: (rows || []) as PoListRow[], count: count ?? 0 };
    }),
    enabled: !!orgId,
    placeholderData: (prev: any) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const vendorName = useCallback(
    (id: string | null) => vendors.find((v: any) => v.id === id)?.company_name || '—',
    [vendors],
  );

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['po-v2-list'] });
    await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
  }, [queryClient]);

  // ---- actions ------------------------------------------------------------
  const handleEdit = (po: PoListRow) => {
    if (po.status !== 'Draft') {
      toast.error(`Only Draft purchase orders can be edited. This one is ${po.status || 'unknown'}.`);
      return;
    }
    navigate(`/purchase/orders-v2/edit?id=${po.id}`);
  };

  const handleDuplicate = async (po: PoListRow) => {
    setOpenMenuId(null);
    const { data: full, error } = await supabase
      .from('purchase_orders')
      .select('*, items:purchase_order_items(*)')
      .eq('id', po.id)
      .eq('organisation_id', orgId)
      .maybeSingle();
    if (error) { toast.error('Could not read the purchase order to duplicate it.'); return; }
    if (!full) { toast.error('That purchase order no longer exists.'); return; }

    sessionStorage.setItem('po-v2-duplicate-source', JSON.stringify({
      poId: po.id,
      poNumber: po.po_number,
      header: {
        vendor_id: full.vendor_id,
        currency: full.currency,
        exchange_rate: full.exchange_rate,
        delivery_location: full.delivery_location,
        reference_no: full.reference_no,
        terms_conditions: full.terms_conditions,
        internal_notes: full.internal_notes,
        project_id: full.project_id,
        authorized_signatory_id: full.authorized_signatory_id,
        attachment_url: full.attachment_url,
      },
      items: (full.items || []).map((it: any) => ({
        item_id: it.item_id,
        variant_id: it.variant_id,
        item_name: it.item_name,
        description: it.description,
        hsn_code: it.hsn_code,
        quantity: it.quantity,
        unit: it.unit,
        rate: it.rate,
        discount_percent: it.discount_percent,
        discount_category_id: it.discount_category_id || null,
        cgst_percent: it.cgst_percent,
        sgst_percent: it.sgst_percent,
        igst_percent: it.igst_percent,
        make: it.make,
        variant: it.variant,
        notes: it.notes,
      })),
    }));
    navigate('/purchase/orders-v2/edit?duplicate=1');
  };

  const handleDelete = async () => {
    if (!deleteTarget || !orgId) return;
    setDeleting(true);
    try {
      const { data: snapshot } = await supabase
        .from('purchase_orders')
        .select('po_number, vendor_id, total_amount, status')
        .eq('id', deleteTarget.id)
        .eq('organisation_id', orgId)
        .maybeSingle();

      if (snapshot && snapshot.status !== 'Draft') {
        throw new Error(
          `Purchase Order ${snapshot.po_number} is ${snapshot.status}. Only Draft purchase orders can be deleted.`
        );
      }

      // Same link guards as V1 (useDeletePO), scoped to this org.
      const checks: Array<[string, string, string]> = [
        ['purchase_bills', 'po_id', 'bills'],
        ['goods_receipts', 'po_id', 'goods receipts'],
        ['goods_receipt_notes', 'purchase_order_id', 'GRN notes'],
        ['material_inward', 'po_id', 'material inward entries'],
        ['purchase_invoice_verifications', 'po_id', 'invoice verifications'],
      ];
      const linked: string[] = [];
      for (const [table, col, label] of checks) {
        const { count } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', orgId)
          .eq(col, deleteTarget.id);
        if ((count || 0) > 0) linked.push(label);
      }
      if (linked.length) {
        throw new Error(
          `Cannot delete ${snapshot?.po_number || 'this purchase order'}: linked ${linked.join(', ')} exist. Cancel those first.`
        );
      }

      // Record before deleting, so the timeline survives the row.
      await logPoActivity({
        organisationId: orgId,
        action: 'DELETE',
        poId: deleteTarget.id,
        description: `Deleted ${snapshot?.po_number || 'purchase order'}.`,
        details: {
          po_number: snapshot?.po_number || null,
          vendor_id: snapshot?.vendor_id || null,
          total_amount: snapshot?.total_amount ?? null,
          note: 'Text copy retained in the audit log.',
        },
      });

      const { error: itemsErr } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('po_id', deleteTarget.id)
        .eq('organisation_id', orgId);
      if (itemsErr) throw itemsErr;

      const { error: poErr } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('organisation_id', orgId);
      if (poErr) throw poErr;

      setDeleteTarget(null);
      toast.success('Purchase order deleted. A text copy remains in the activity log.');
      await invalidate();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Generate the PDF blob for a PO. `mode` decides what happens afterwards:
   *   'preview'  — show the in-app iframe preview
   *   'download' — save the file
   *   'print'    — open the browser's print dialog on the generated document
   *
   * The blob is cached per PO id so Download after Preview does not re-render.
   */
  const pdfCache = useRef<Record<string, Blob>>({});

  const buildPdf = useCallback(async (
    po: PoListRow,
    mode: 'preview' | 'download' | 'print' = 'preview',
  ) => {
    try {
      let blob = pdfCache.current[po.id];
      if (!blob) {
        const { data: full, error } = await supabase
          .from('purchase_orders')
          .select('*, items:purchase_order_items(*), vendor:purchase_vendors(*)')
          .eq('id', po.id)
          .eq('organisation_id', orgId)
          .maybeSingle();
        if (error) throw error;
        if (!full) throw new Error('That purchase order no longer exists.');
        blob = await generatePOPDF(full as any, organisation);
        pdfCache.current[po.id] = blob;
      }

      const filename = `${po.po_number || 'purchase-order'}.pdf`;

      if (mode === 'download') {
        downloadPDF(blob, filename);
        return;
      }

      if (mode === 'print') {
        // A hidden iframe carrying the PDF gives the browser a real document to
        // print. openPDFPreview would only open a tab and leave printing to the
        // reader, which is what V1 did.
        const url = URL.createObjectURL(blob);
        const frame = document.createElement('iframe');
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.border = '0';
        frame.src = url;
        frame.onload = () => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          } catch {
            // Some browsers block cross-frame print; fall back to a tab.
            openPDFPreview(blob);
          }
          setTimeout(() => {
            URL.revokeObjectURL(url);
            frame.remove();
          }, 60_000);
        };
        document.body.appendChild(frame);
        return;
      }

      setPdfTarget(po);
      setPdfLoading(true);
      setPdfBlob(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setPdfLoading(false);
    } catch (e: any) {
      console.error('[po-list] PDF generation failed', e);
      toast.error(e?.message || 'Failed to generate the PDF.');
      setPdfTarget(null);
      setPdfLoading(false);
    }
  }, [orgId, organisation]);

  const closePdf = useCallback(() => {
    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setPdfBlob(null);
    setPdfTarget(null);
  }, []);

  useEffect(() => () => {
    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  // ---- render -------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3">
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#9ca3af' }} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search PO number, reference, vendor..."
            style={{
              padding: '8px 10px 8px 30px', fontSize: 13, border: '1px solid #e5e7eb',
              borderRadius: 6, width: 280, outline: 'none',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s || 'all'} value={s}>{s || 'All statuses'}</option>
          ))}
        </select>

        <select
          value={vendorFilter}
          onChange={(e) => { setVendorFilter(e.target.value); setPage(0); }}
          style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', maxWidth: 200 }}
        >
          <option value="">All vendors</option>
          {vendors.map((v: any) => (
            <option key={v.id} value={v.id}>{v.company_name}</option>
          ))}
        </select>

        {(statusFilter || vendorFilter || debouncedSearch) && (
          <button
            type="button"
            onClick={() => { setStatusFilter(''); setVendorFilter(''); setSearchTerm(''); setPage(0); }}
            style={{ padding: '8px 10px', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <X size={12} /> Clear
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {isFetching && !isLoading && (
            <Loader2 size={13} className="animate-spin" style={{ color: '#9ca3af' }} />
          )}
          <span style={{ fontSize: 12, color: '#6b7280' }}>{total} order{total === 1 ? '' : 's'}</span>
          <button
            type="button"
            onClick={() => navigate('/purchase/orders-v2/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> New Purchase Order
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                {['PO #', 'Date', 'Vendor', 'Reference', 'Amount', 'Status', ''].map((h, i) => (
                  <th
                    key={h || i}
                    style={{
                      padding: '10px 12px', textAlign: i === 4 ? 'right' : 'left',
                      fontSize: 10, fontWeight: 700, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                  <Loader2 size={16} className="animate-spin" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                  {debouncedSearch || statusFilter || vendorFilter
                    ? 'No purchase orders match these filters.'
                    : 'No purchase orders yet.'}
                </td></tr>
              ) : rows.map((po) => (
                <tr
                  key={po.id}
                  style={{ borderTop: '1px solid #f3f4f6' }}
                  onDoubleClick={() => handleEdit(po)}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{po.po_number || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                    {po.po_date ? new Date(po.po_date).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>
                    {po.vendor?.company_name || vendorName(po.vendor_id)}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{po.reference_no || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(Number(po.total_amount_inr ?? po.total_amount ?? 0))}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={po.status || po.approval_status || 'Draft'} />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', width: 48 }}>
                    <div className="relative" ref={openMenuId === po.id ? menuRef : null}>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === po.id ? null : po.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: 6, border: 'none',
                          background: 'transparent', cursor: 'pointer',
                        }}
                        aria-label={`Actions for ${po.po_number || 'purchase order'}`}
                      >
                        <MoreHorizontal size={16} style={{ color: '#6b7280' }} />
                      </button>
                      {openMenuId === po.id && (
                        <div style={{
                          position: 'absolute', right: 0, top: '100%', zIndex: 50, minWidth: 190,
                          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                          padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', textAlign: 'left',
                        }}>
                          <MenuItem icon={<FileText size={13} />} onClick={() => { setOpenMenuId(null); buildPdf(po, 'preview'); }} label="View PDF" />
                          <MenuItem icon={<Download size={13} />} onClick={() => { setOpenMenuId(null); buildPdf(po, 'download'); }} label="Download" />
                          <MenuItem icon={<Printer size={13} />} onClick={() => { setOpenMenuId(null); buildPdf(po, 'print'); }} label="Print" />
                          <Divider />
                          <MenuItem icon={<Edit size={13} />} onClick={() => { setOpenMenuId(null); handleEdit(po); }} label="Edit PO" />
                          <MenuItem icon={<Copy size={13} />} onClick={() => handleDuplicate(po)} label="Duplicate" />
                          <MenuItem icon={<Receipt size={13} />} onClick={() => { setOpenMenuId(null); navigate(`/purchase/bills?convertFromPoId=${po.id}`); }} label="Convert to Bill" />
                          <Divider />
                          <MenuItem
                            icon={<Trash2 size={13} />}
                            onClick={() => { setOpenMenuId(null); setDeleteTarget(po); }}
                            label="Delete PO"
                            danger
                            disabled={po.status !== 'Draft'}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14 }}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12,
                border: '1px solid #e5e7eb', borderRadius: 6, background: page === 0 ? '#f9fafb' : '#fff',
                color: page === 0 ? '#9ca3af' : '#374151', cursor: page === 0 ? 'default' : 'pointer',
              }}
            >
              <ChevronLeft size={13} /> Previous
            </button>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Page {page + 1} of {pageCount}</span>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12,
                border: '1px solid #e5e7eb', borderRadius: 6, background: page >= pageCount - 1 ? '#f9fafb' : '#fff',
                color: page >= pageCount - 1 ? '#9ca3af' : '#374151', cursor: page >= pageCount - 1 ? 'default' : 'pointer',
              }}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          onClick={() => !deleting && setDeleteTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: 420, maxWidth: '92vw', padding: 20 }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>Delete purchase order?</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                  <strong>{deleteTarget.po_number}</strong> from{' '}
                  {vendorName(deleteTarget.vendor_id)} will be permanently removed.
                  A text copy of the header and totals stays in the activity log.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 500, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#374151', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6,
                  background: deleting ? '#fca5a5' : '#dc2626', color: '#fff', cursor: deleting ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF preview */}
      {pdfTarget && (
        <div
          onClick={closePdf}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: '92vw', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, flex: 1 }}>
                {pdfTarget.po_number}
              </h3>
              <button
                type="button"
                onClick={() => { if (pdfBlob) openPDFPreview(pdfBlob); }}
                style={{ padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
              >
                Open in new tab
              </button>
              <button
                type="button"
                onClick={() => { if (pdfBlob) downloadPDF(pdfBlob, `${pdfTarget.po_number || 'purchase-order'}.pdf`); }}
                style={{ padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
              >
                Download
              </button>
              <button type="button" onClick={closePdf} style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={16} style={{ color: '#6b7280' }} />
              </button>
            </div>
            <div style={{ flex: 1, background: '#525659', minHeight: 0 }}>
              {pdfLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff', gap: 8 }}>
                  <Loader2 size={16} className="animate-spin" /> Generating PDF…
                </div>
              ) : pdfUrl ? (
                <iframe src={pdfUrl} title={`PDF preview ${pdfTarget.po_number}`} style={{ width: '100%', height: '100%', border: 'none' }} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon, label, onClick, danger, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const color = disabled ? '#9ca3af' : danger ? '#dc2626' : '#374151';
  const hover = disabled ? undefined : danger ? 'background:#fef2f2' : 'background:#eef2ff';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex', width: '100%', alignItems: 'center', gap: 8,
        padding: '7px 8px', fontSize: 12, color, background: 'transparent',
        border: 'none', borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = hover!; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {icon} {label}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />;
}
