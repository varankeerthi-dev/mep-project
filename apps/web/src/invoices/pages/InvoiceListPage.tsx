import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../ui-utils';
import { useAuth } from '../../App';
import { timedSupabaseQuery } from '../../utils/queryTimeout';
import {
  Plus as PlusIcon,
  Download as DownloadIcon,
  Eye as EyeIcon,
  Trash2 as Trash2Icon,
  Printer as PrinterIcon,
  X as XIcon,
  Mail as MailIcon,
  Pencil as PencilIcon,
  FileText as FileTextIcon,
  CreditCard as CreditCardIcon,
  Loader2
} from 'lucide-react';
import { useInvoices, useDeleteInvoice } from '../hooks';
import { DocumentStatusBadge } from '../../components/DocumentStatusBadge';
import { Button } from '@/components/ui/button';
import { DocumentListShell, type ShellColumn, type ShellMenuItem } from '../../components/document/DocumentListShell';

// Lazy-load action drawers on demand
const RecordPaymentDrawer = lazy(() => import('../components/RecordPaymentDrawer'));
const AddSubmittedDetailsDrawer = lazy(() => import('../components/AddSubmittedDetailsDrawer'));

const INVOICE_STATUSES = ['All', 'draft', 'sent', 'paid', 'overdue', 'cancelled', 'converted'];

const SUB_TABS = ['All Invoices', 'Drafts', 'Unpaid'];

const STATUS_FILTER_OPTIONS = ['All', 'sent', 'paid', 'overdue', 'cancelled', 'converted'];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#f3f4f6', color: '#6b7280' },
  sent:      { bg: '#fef3c7', color: '#92400e' },
  paid:      { bg: '#d1fae5', color: '#047857' },
  overdue:   { bg: '#fee2e2', color: '#dc2626' },
  cancelled: { bg: '#f3f4f6', color: '#9ca3af' },
  unpaid:    { bg: '#fee2e2', color: '#dc2626' },
  partial:   { bg: '#dcfce7', color: '#15803d' },
};

const getPaymentStatus = (invoice: any) => {
  if (invoice.status === 'draft') return 'draft';
  if (invoice.status === 'cancelled') return 'cancelled';
  
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.paid_amount || 0);
  
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
};

const getStatusColor = (status?: string) =>
  STATUS_COLORS[status ?? ''] ?? STATUS_COLORS['draft'];

const MANDATORY_COLUMNS = ['issueDate', 'invoice_no', 'client', 'totalAmount'];
const ALL_COLUMNS = [
  { id: 'issueDate', label: 'Date', width: '120px' },
  { id: 'invoice_no', label: 'Invoice No', width: '140px' },
  { id: 'client', label: 'Client', width: '300px' },
  { id: 'sourceType', label: 'Source Type', width: '120px' },
  { id: 'prepared_by', label: 'Created By', width: '150px' },
  { id: 'submission', label: 'Submission', width: '160px' },
  { id: 'status', label: 'Status', width: '110px' },
  { id: 'subtotal', label: 'Sub-total', width: '110px' },
  { id: 'taxAmount', label: 'Tax Amount', width: '110px' },
  { id: 'totalAmount', label: 'Amount', width: '110px' },
];

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [subTab, setSubTab] = useState('All Invoices');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('invoice_list_columns_v4');
    return saved ? JSON.parse(saved) : ALL_COLUMNS.map(c => c.id);
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // PDF Preview state
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Payment state
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any | null>(null);

  // Submission state
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [selectedInvoiceForSubmission, setSelectedInvoiceForSubmission] = useState<any | null>(null);

  const { data: invoices = [], isLoading } = useInvoices();
  const { mutate: deleteMutate } = useDeleteInvoice();

  const toggleSelectAll = () => {
    if (selectedIds.size === paginationData.currentItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginationData.currentItems.map((i: any) => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Reset status filter when switching sub-tabs
  useEffect(() => {
    if (subTab === 'Drafts') {
      setStatusFilter('draft');
    } else if (subTab === 'Unpaid') {
      setStatusFilter('sent'); 
    } else {
      setStatusFilter('All');
    }
    setCurrentPage(1);
  }, [subTab]);

  // Reset to first page when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const filteredInvoices = useMemo(() => {
    const q = searchTerm.toLowerCase();
    let items = invoices.filter((inv: any) => {
      const matchesSearch = (inv.invoice_no?.toLowerCase().includes(q) || 
                             inv.client?.client_name?.toLowerCase().includes(q) ||
                             inv.client?.name?.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (sortOrder) {
      items.sort((a: any, b: any) => {
        const dateA = new Date(a.invoice_date || a.created_at).getTime();
        const dateB = new Date(b.invoice_date || b.created_at).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }

    return items;
  }, [invoices, searchTerm, statusFilter, sortOrder]);

  const paginationData = useMemo(() => {
    const totalItems = filteredInvoices.length;
    const totalValue = filteredInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = filteredInvoices.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalValue,
      totalPages,
      startIndex,
      endIndex,
      currentItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  }, [filteredInvoices, currentPage, itemsPerPage]);

  const stats = useMemo(() => {
    return {
      draft: invoices.filter((i: any) => getPaymentStatus(i) === 'draft').length,
      paid: invoices.filter((i: any) => getPaymentStatus(i) === 'paid').length,
      partial: invoices.filter((i: any) => getPaymentStatus(i) === 'partial').length,
      unpaid: invoices.filter((i: any) => getPaymentStatus(i) === 'unpaid').length,
    };
  }, [invoices]);

  const toggleSort = () => {
    if (sortOrder === null) setSortOrder('desc');
    else if (sortOrder === 'desc') setSortOrder('asc');
    else setSortOrder(null);
  };

  const handleBulkPrint = async () => {
    if (selectedIds.size === 0) return;
    alert(`Bulk Print Merge for ${selectedIds.size} Invoices initialized.`);
    setSelectedIds(new Set());
  };

  const handleDownloadPdf = async (invoice: any) => {
    const { downloadInvoicePDF } = await import('../pdf');
    downloadInvoicePDF(invoice);
  };

  const handlePrintPdf = async (invoice: any) => {
    const { printInvoicePDF } = await import('../pdf');
    printInvoicePDF(invoice);
  };

  const handleEmailPdf = async (invoice: any) => {
    const { emailInvoicePDF } = await import('../pdf');
    emailInvoicePDF(invoice);
  };

  const handlePreviewPdf = async (invoice: any) => {
    setPreviewInvoice(invoice);
    setPreviewLoading(true);
    try {
      const { getInvoicePdfBlobUrl } = await import('../pdf');
      const url = await getInvoicePdfBlobUrl(invoice);
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewInvoice(null);
    setPreviewPdfUrl(null);
    setPreviewLoading(false);
  };

  // ── Shared-shell adapters (single list standard) ──
  const invShellColumns: ShellColumn[] = ALL_COLUMNS.map(col => ({
    id: col.id,
    label: col.label,
    width: col.width,
    mandatory: MANDATORY_COLUMNS.includes(col.id),
    // Project table rule: monetary columns stay left-aligned.
    align: 'left' as const,
  }));
  const invVisibleIds = Array.from(new Set([...MANDATORY_COLUMNS, ...visibleColumns]));

  const renderInvoiceCell = (col: ShellColumn, i: any) => {
    if (col.id === 'issueDate') return <span className="font-medium text-zinc-900 whitespace-nowrap">{formatDate(i.invoice_date || i.created_at)}</span>;
    if (col.id === 'invoice_no') return <span className="font-medium text-zinc-900 whitespace-nowrap">{i.invoice_no}</span>;
    if (col.id === 'client') return <div className="max-w-[350px] truncate" title={i.client?.client_name || i.client?.name || '-'}>{i.client?.client_name || i.client?.name || '-'}</div>;
    if (col.id === 'sourceType') return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-500 uppercase">{i.source_type || '-'}</span>
    );
    if (col.id === 'prepared_by') return <div className="truncate" title={i.creator?.full_name || i.prepared_by || '-'}>{i.creator?.full_name || i.prepared_by || '-'}</div>;
    if (col.id === 'submission') {
      if (!i.submitted_date) return <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Not Submitted</span>;
      return (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium text-zinc-900">{formatDate(i.submitted_date)}</div>
          <div className="text-[10px] text-zinc-500 truncate max-w-[120px]" title={i.submitted_by}>By {i.submitted_by || 'Unknown'}</div>
          {i.submitted_file_url && (
            <a
              href={i.submitted_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <FileTextIcon size={10} /> View Proof
            </a>
          )}
        </div>
      );
    }
    if (col.id === 'status') return <DocumentStatusBadge status={getPaymentStatus(i)} />;
    if (col.id === 'subtotal') return <span className="font-medium tabular-nums whitespace-nowrap">{formatCurrency(i.subtotal)}</span>;
    if (col.id === 'taxAmount') return <span className="font-medium tabular-nums whitespace-nowrap">{formatCurrency(i.cgst + i.sgst + i.igst)}</span>;
    if (col.id === 'totalAmount') return <span className="font-medium tabular-nums whitespace-nowrap">{formatCurrency(i.total)}</span>;
    return null;
  };

  const invRowMenuItems = (i: any): ShellMenuItem[] => [
    { label: 'View Details', icon: EyeIcon, onClick: () => navigate(`/invoices/view?id=${i.id}`) },
    { label: 'Edit Invoice', icon: PencilIcon, onClick: () => navigate(`/invoices/edit?id=${i.id}`) },
    { label: 'Add Submitted details', icon: PlusIcon, onClick: () => { setSelectedInvoiceForSubmission(i); setSubmissionOpen(true); } },
    { label: 'Record Payment', icon: CreditCardIcon, onClick: () => { setSelectedInvoiceForPayment(i); setRecordPaymentOpen(true); } },
    { label: 'Download PDF', icon: DownloadIcon, onClick: () => handleDownloadPdf(i) },
    { label: 'Print', icon: PrinterIcon, onClick: () => handlePrintPdf(i) },
    { label: 'Email', icon: MailIcon, onClick: () => handleEmailPdf(i) },
    { label: 'Delete', icon: Trash2Icon, danger: true, dividerBefore: true, onClick: () => { if (confirm('Delete invoice?')) deleteMutate(i.id!); } },
  ];

  const renderInvoiceBulkBar = (ids: Set<string>, clear: () => void) => (
    <>
      <button
        onClick={() => setSelectedIds(new Set())}
        className="text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors px-3 py-2"
      >
        {ids.size} items selected — Clear
      </button>
      <button
        onClick={handleBulkPrint}
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 bg-white text-zinc-900 hover:bg-zinc-100 transition-all active:scale-[0.98]"
      >
        <PrinterIcon className="w-3.5 h-3.5" />Print Selected
      </button>
      <button
        onClick={() => { if (confirm(`Delete ${ids.size} selected invoices?`)) { ids.forEach(id => deleteMutate(id)); clear(); } }}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-700 transition-all active:scale-[0.98]"
      >
        <Trash2Icon className="w-3.5 h-3.5" />Delete All
      </button>
    </>
  );

  const invCreateButton = (
    <button
      onClick={() => navigate('/invoices/create')}
      className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]"
      style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
    >
      Create Invoice
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-white relative">
      <DocumentListShell
        title="Invoices"
        count={paginationData.totalItems}
        stats={[
          { label: 'Draft', value: stats.draft },
          { label: 'Paid', value: stats.paid, labelClass: 'text-emerald-400', valueClass: 'text-emerald-700' },
          { label: 'Partial', value: stats.partial, labelClass: 'text-blue-400', valueClass: 'text-blue-700' },
          { label: 'Unpaid', value: stats.unpaid, labelClass: 'text-rose-400', valueClass: 'text-rose-700' },
        ]}
        totalValue={{ label: 'Total Receivables', value: formatCurrency(paginationData.totalValue) }}
        search={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search invoices..."
        subTabs={SUB_TABS}
        activeSubTab={subTab}
        onSubTab={setSubTab}
        statusOptions={subTab === 'All Invoices' ? STATUS_FILTER_OPTIONS : []}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        sort={{ value: sortOrder, onToggle: toggleSort, columnId: 'issueDate' }}
        columns={invShellColumns}
        visibleIds={Array.from(new Set([...MANDATORY_COLUMNS, ...visibleColumns]))}
        onVisibleChange={(ids) => {
          setVisibleColumns(ids);
          try { localStorage.setItem('invoice_list_columns_v4', JSON.stringify(ids)); } catch { /* ignore */ }
        }}
        columnStorageKey="invoice_list_columns_v4"
        createButton={invCreateButton}
        rowDensity="compact"
        rows={paginationData.currentItems}
        getRowId={(i) => i.id}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onClearSelection={() => setSelectedIds(new Set())}
        onRowClick={(i) => navigate(`/invoices/view?id=${i.id}`)}
        renderCell={renderInvoiceCell}
        eyeButton={(i) => ({ onPreview: () => handlePreviewPdf(i), loading: previewInvoice?.id === i.id && previewLoading })}
        rowMenuItems={invRowMenuItems}
        bulkBar={{ threshold: 2, render: renderInvoiceBulkBar }}
        pagination={{
          page: currentPage,
          totalPages: paginationData.totalPages,
          onPage: setCurrentPage,
          totalItems: paginationData.totalItems,
        }}
        loading={isLoading}
        loadingText="Loading invoices..."
        emptyTitle="No invoices found"
      />
      {/* PDF Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closePreview}>
          <div className="flex flex-col w-[90vw] max-w-[1200px] h-[95vh] bg-white rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 bg-white">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-zinc-900">{previewInvoice.invoice_no || `Invoice ${previewInvoice.id?.slice(0, 8)}`}</span>
                {previewLoading && <span className="text-xs text-zinc-500 animate-pulse">Loading preview...</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" onClick={() => navigate(`/invoices/edit?id=${previewInvoice.id}`)} className="inline-flex items-center gap-2 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"><PencilIcon className="w-3.5 h-3.5" />Edit</Button>
                <Button variant="default" size="sm" onClick={() => handleDownloadPdf(previewInvoice)} className="inline-flex items-center gap-2 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"><DownloadIcon className="w-3.5 h-3.5" />Download</Button>
                <Button variant="secondary" size="icon-xs" onClick={closePreview}><XIcon className="w-4 h-4 text-zinc-500" /></Button>
              </div>
            </div>
            <div className="flex-1 bg-zinc-100 overflow-hidden relative">
              {previewPdfUrl ? (
                <iframe src={previewPdfUrl} className="w-full h-full border-none" title="Invoice Preview" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm font-medium">Generating PDF Preview...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Drawer */}
      {selectedInvoiceForPayment && (
        <Suspense fallback={null}>
          <RecordPaymentDrawer
            open={recordPaymentOpen}
            onClose={() => {
              setRecordPaymentOpen(false);
              setSelectedInvoiceForPayment(null);
            }}
            invoice={selectedInvoiceForPayment}
            onSuccess={() => {
              setRecordPaymentOpen(false);
              setSelectedInvoiceForPayment(null);
              queryClient.invalidateQueries({ queryKey: ['invoices'] });
            }}
          />
        </Suspense>
      )}

      {/* Submission Details Drawer */}
      {selectedInvoiceForSubmission && (
        <Suspense fallback={null}>
          <AddSubmittedDetailsDrawer
            open={submissionOpen}
            onClose={() => {
              setSubmissionOpen(false);
              setSelectedInvoiceForSubmission(null);
            }}
            invoice={selectedInvoiceForSubmission}
          />
        </Suspense>
      )}
    </div>
  );
}
