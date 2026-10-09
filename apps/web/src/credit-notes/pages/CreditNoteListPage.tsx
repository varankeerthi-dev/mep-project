import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Eye, Pencil, Trash2, FileText, Loader2, Download, XCircle } from 'lucide-react';
import { useCreditNotes, useDeleteCreditNote } from '../../credit-notes/hooks';
import { CNStatusBadge } from '../../credit-notes/components/StatusBadge';
import { formatCurrency, formatDate } from '../../credit-notes/ui-utils';
import { CN_TYPE_LABELS } from '../../credit-notes/schemas';
import type { CreditNote } from '../../credit-notes/types';
import { useAuth } from '../../App';
import { generateProGridAdjustmentNotePdf } from '../../pdf/proGridAdjustmentNotePdf';
import { Button } from '@/components/ui/button';
import { DocumentListShell, type ShellColumn, type ShellMenuItem } from '../../components/document/DocumentListShell';

const PAGE_SIZE = 25;

export function CreditNoteListPage() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const { data: creditNotes = [], isLoading, error, refetch } = useCreditNotes({ organisationId: organisation?.id });
  const deleteCN = useDeleteCreditNote();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewCN, setPreviewCN] = useState<CreditNote | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreview = useCallback(async (cn: CreditNote) => {
    setPreviewCN(cn);
    setPreviewLoading(true);
    try {
      const items = cn.items.map(item => ({
        description: item.description,
        hsn: item.hsn_code ?? '—',
        qty: item.quantity,
        rate: item.rate,
        amount: item.total_amount,
      }));

      const pdfDoc = generateProGridAdjustmentNotePdf({
        kind: 'Credit Note',
        document_no: cn.cn_number,
        document_date: cn.cn_date,
        party_name: cn.client?.name ?? 'Unknown Client',
        party_gstin: cn.client?.gstin ?? undefined,
        party_address: undefined,
        reason: cn.reason ?? undefined,
        taxable_amount: cn.taxable_amount,
        cgst_amount: cn.cgst_amount,
        sgst_amount: cn.sgst_amount,
        igst_amount: cn.igst_amount,
        total_amount: cn.total_amount,
        items,
        organisation: organisation ?? {},
        authorized_signatory_id: cn.authorized_signatory_id,
      });

      const blob = pdfDoc.output('blob');
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  }, [organisation]);

  const closePreview = useCallback(() => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewCN(null);
    setPreviewPdfUrl(null);
  }, [previewPdfUrl]);

  const filteredNotes = useMemo(() => {
    let result = creditNotes;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(cn =>
        cn.cn_number.toLowerCase().includes(q) ||
        cn.client?.name?.toLowerCase().includes(q) ||
        cn.reason?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'All') {
      result = result.filter(cn => cn.approval_status === statusFilter);
    }

    if (typeFilter !== 'All') {
      result = result.filter(cn => cn.cn_type === typeFilter);
    }

    if (dateFrom) {
      result = result.filter(cn => cn.cn_date >= dateFrom);
    }

    if (dateTo) {
      result = result.filter(cn => cn.cn_date <= dateTo);
    }

    return result;
  }, [creditNotes, search, statusFilter, typeFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / PAGE_SIZE));
  const paginatedData = filteredNotes.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const hasActiveFilters = search || statusFilter !== 'All' || typeFilter !== 'All' || dateFrom || dateTo;

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setTypeFilter('All');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCN.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch {
      alert('Failed to delete credit note');
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/credit-notes/view?id=${id}`);
  };

  // ── Shared-shell adapters (single list standard) ──
  const cnShellColumns: ShellColumn[] = [
    { id: 'cn_number', label: 'CN Number', width: '140px', mandatory: true },
    { id: 'date', label: 'Date', width: '120px', mandatory: true },
    { id: 'client', label: 'Client', width: '260px', mandatory: true },
    { id: 'type', label: 'Type', width: '150px' },
    { id: 'taxable', label: 'Taxable Amount', width: '130px', align: 'left' },
    { id: 'tax', label: 'Tax', width: '110px', align: 'left' },
    { id: 'total', label: 'Total', width: '130px', align: 'left' },
    { id: 'status', label: 'Status', width: '120px' },
  ];

  const renderCNCell = (col: ShellColumn, cn: any) => {
    if (col.id === 'cn_number') return <span className="font-semibold text-zinc-900 whitespace-nowrap">{cn.cn_number}</span>;
    if (col.id === 'date') return <span className="font-medium text-zinc-900 whitespace-nowrap">{formatDate(cn.cn_date)}</span>;
    if (col.id === 'client') return <div className="max-w-[220px] truncate" title={cn.client?.name ?? '-'}>{cn.client?.name ?? '—'}</div>;
    if (col.id === 'type') return <span>{CN_TYPE_LABELS[cn.cn_type as keyof typeof CN_TYPE_LABELS] ?? cn.cn_type}</span>;
    if (col.id === 'taxable') return <span className="tabular-nums whitespace-nowrap">{formatCurrency(cn.taxable_amount)}</span>;
    if (col.id === 'tax') {
      const taxAmount = cn.cgst_amount + cn.sgst_amount + cn.igst_amount;
      return <span className="tabular-nums whitespace-nowrap">{formatCurrency(taxAmount)}</span>;
    }
    if (col.id === 'total') return <span className="font-semibold tabular-nums whitespace-nowrap">{formatCurrency(cn.total_amount)}</span>;
    if (col.id === 'status') return <CNStatusBadge status={cn.approval_status} />;
    return null;
  };

  const cnRowMenuItems = (cn: any): ShellMenuItem[] => [
    { label: 'Preview', icon: Eye, onClick: () => handlePreview(cn as CreditNote) },
    { label: 'Edit', icon: Pencil, onClick: () => navigate(`/credit-notes/edit?id=${cn.id}`) },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleteConfirmId(cn.id) },
  ];

  const cnFilterExtra = (
    <div className="flex items-center gap-2">
      <select
        value={typeFilter}
        onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
        className="h-[26px] text-sm font-medium text-zinc-600 border border-zinc-200 rounded-md px-2 bg-white hover:bg-zinc-50 focus:outline-none"
      >
        <option value="All">All Types</option>
        {Object.entries(CN_TYPE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label as string}</option>
        ))}
      </select>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
        className="h-[26px] text-sm text-zinc-600 border border-zinc-200 rounded-md px-2 bg-white focus:outline-none"
      />
      <input
        type="date"
        value={dateTo}
        onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
        className="h-[26px] text-sm text-zinc-600 border border-zinc-200 rounded-md px-2 bg-white focus:outline-none"
      />
      {hasActiveFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="h-[26px] px-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
        >
          <X size={14} /> Reset
        </button>
      )}
    </div>
  );

  const cnCreateButton = (
    <button
      onClick={() => navigate('/credit-notes/create')}
      className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]"
      style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
    >
      <Plus size={16} /> New Credit Note
    </button>
  );

  if (isLoading) {
    return <div className="text-center p-12 text-zinc-400 text-sm">Loading credit notes...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div style={{ textAlign: 'center', padding: '48px', color: '#dc2626' }}>
          Error loading credit notes: {(error as Error).message}
          <Button variant="default" size="sm" onClick={() => refetch()} style={{ marginLeft: '12px', padding: '6px 12px' }}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <DocumentListShell
        title="Credit Notes"
        count={filteredNotes.length}
        search={search}
        onSearch={(v) => { setSearch(v); setCurrentPage(1); }}
        searchPlaceholder="Search by CN#, client, reason..."
        statusOptions={['All', 'Pending', 'Approved', 'Rejected']}
        statusFilter={statusFilter}
        onStatusFilter={(s) => { setStatusFilter(s); setCurrentPage(1); }}
        columns={cnShellColumns}
        visibleIds={cnShellColumns.map(c => c.id)}
        onVisibleChange={() => {}}
        filterExtra={cnFilterExtra}
        createButton={cnCreateButton}
        hideSelection
        rowDensity="compact"
        rows={paginatedData}
        getRowId={(cn) => cn.id}
        selectedIds={new Set()}
        onToggleSelect={() => {}}
        onToggleSelectAll={() => {}}
        onRowClick={(cn) => handleRowClick(cn.id)}
        renderCell={renderCNCell}
        eyeButton={(cn) => ({ onPreview: () => handlePreview(cn as CreditNote), loading: false })}
        rowMenuItems={cnRowMenuItems}
        pagination={{
          page: currentPage,
          totalPages,
          onPage: setCurrentPage,
          totalItems: filteredNotes.length,
        }}
        loading={isLoading}
        loadingText="Loading credit notes..."
        emptyTitle={creditNotes.length === 0 ? 'No credit notes yet' : 'No matching credit notes'}
        emptyHint={creditNotes.length === 0 ? 'Click "New Credit Note" to create one' : 'Try adjusting your filters'}
      />
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>Delete Credit Note</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#525252' }}>
              Are you sure you want to delete this credit note? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="default" size="sm" onClick={() => setDeleteConfirmId(null)}
                style={{ padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={() => handleDelete(deleteConfirmId)}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {previewCN && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={closePreview}
        >
          <div
            style={{ width: '90vw', maxWidth: '1200px', height: '95vh', background: '#fff', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e5e5e5', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={18} style={{ color: '#2563eb' }} />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{previewCN.cn_number} — {previewCN.client?.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button variant="default" size="sm" onClick={() => {
                    const items = previewCN.items.map(item => ({
                      description: item.description, hsn: item.hsn_code ?? '—', qty: item.quantity, rate: item.rate, amount: item.total_amount,
                    }));
                    const pdfDoc = generateProGridAdjustmentNotePdf({
                      kind: 'Credit Note', document_no: previewCN.cn_number, document_date: previewCN.cn_date,
                      party_name: previewCN.client?.name ?? '', party_gstin: previewCN.client?.gstin ?? undefined,
                      reason: previewCN.reason ?? undefined,
                      taxable_amount: previewCN.taxable_amount, cgst_amount: previewCN.cgst_amount,
                      sgst_amount: previewCN.sgst_amount, igst_amount: previewCN.igst_amount, total_amount: previewCN.total_amount,
                      items,
                      organisation: organisation ?? {},
                      authorized_signatory_id: previewCN.authorized_signatory_id,
                    });
                    pdfDoc.save(`${previewCN.cn_number}.pdf`);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', background: '#fff', fontSize: '12px', cursor: 'pointer' }}
                >
                  <Download size={14} /> Download
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={closePreview}>
                  <XCircle size={20} />
                </Button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', background: '#f3f4f6' }}>
              {previewLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: '#a3a3a3' }} />
                </div>
              ) : previewPdfUrl ? (
                <iframe src={previewPdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Credit Note PDF Preview" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a3a3a3' }}>Failed to load preview</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
