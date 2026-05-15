import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Printer,
  Filter,
  FileText,
  RotateCcw,
  Pencil,
  Columns,
  Check,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TableColumn } from '@/lib/table-schema';
import { distinctOptions } from '@/lib/table-schema';
import { useInvoices, useDeleteInvoice } from '../hooks';
import { invoiceListTableSchema, invoiceToListRow } from '../invoice-list-table-schema';
import { downloadInvoicePDF, emailInvoicePDF, previewInvoicePDF, printInvoicePDF, generateProGridInvoicePDF, getInvoicePdfBlobUrl } from '../pdf';
import type { InvoiceWithRelations } from '../api';
import { formatCurrency, formatDate } from '../ui-utils';

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --bg-page: #f9fafb;
    --bg-card: #ffffff;
    --bg-hover: #f3f4f6;
    --bg-muted: #f9fafb;
    --border: #e5e7eb;
    --border-light: #f3f4f6;
    --border-hover: #d1d5db;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-muted: #6b7280;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
  }
  
  .il-page {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f9fafb;
    min-height: 100vh;
    padding: 1.5rem 2rem;
  }
  
  .il-container { max-width: 1600px; margin: 0 auto; }
  

  .il-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    letter-spacing: -0.01em;
    margin: 0;
  }
  
  .il-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    font-family: inherit;
    white-space: nowrap;
  }
  
  .il-btn-primary {
    background: #2563eb;
    color: white;
  }
  
  .il-btn-primary:hover { background: #1d4ed8; }
  
  .il-btn-secondary {
    background: white;
    color: #374151;
    border: 1px solid #e5e7eb;
  }
  
  .il-btn-secondary:hover { background: #f9fafb; border-color: #d1d5db; }
  
  .il-input, .il-select {
    padding: 0.5rem 0.75rem;
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--text-primary);
  }
  
  .il-input:focus, .il-select:focus {
    outline: none;
    border-color: var(--accent);
    background: white;
  }
  
  .il-checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    padding: 0.15rem 0;
  }
  
  .il-table-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 180px);
  }
  
  .il-table-card .il-table-wrapper {
    flex: 1;
    overflow: auto;
  }
  
  .il-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    min-width: 1100px;
  }
  
  .il-table thead {
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .il-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #4b5563;
    white-space: nowrap;
    vertical-align: middle;
    position: relative;
  }
  
  .il-table th.il-th-sortable {
    cursor: pointer;
    user-select: none;
  }
  
  .il-th-filter {
    padding: 0.25rem 0 0;
    margin-top: 0.25rem;
  }
  
  .il-th-filter-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid var(--border);
    background: white;
    font-size: 0.6875rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    white-space: nowrap;
  }
  
  .il-th-filter-btn:hover {
    border-color: #d1d5db;
    color: #374151;
  }
  
  .il-th-filter-btn.active {
    background: #eff6ff;
    color: #2563eb;
    border-color: #bfdbfe;
  }
  
  .il-th-filter-dropdown {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    z-index: 50;
    min-width: 180px;
    max-height: 280px;
    overflow-y: auto;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 0.5rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  }
  
  .il-table th.il-th-sortable:hover { color: #2563eb; }
  
  .il-table th.il-th-num, .il-table td.il-td-num { text-align: right; }
  
  .il-table th.il-th-actions, .il-table td.il-td-actions { text-align: right; }
  
  .il-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
    color: #374151;
  }
  
  .il-table tbody tr:hover { background: #f9fafb; }
  .il-table tbody tr:last-child td { border-bottom: none; }
  
  .il-invoice-num {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #111827;
  }
  
  .il-amount {
    font-weight: 600;
    color: #111827;
  }
  
  .il-date { color: #6b7280; font-size: 0.8125rem; }
  .il-muted { color: #9ca3af; }
  
  .il-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #374151;
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .il-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.25rem;
  }
  
  .il-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  
  .il-action-btn:hover {
    background: #f3f4f6;
    color: #374151;
  }
  
  .il-dropdown-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    color: #6b7280;
    cursor: pointer;
  }
  
  .il-dropdown-trigger:hover {
    background: #f3f4f6;
    color: #374151;
  }
  
  .il-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 0.25rem);
    z-index: 50;
    min-width: 180px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 0.375rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  }
  
  .il-dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    border: none;
    background: transparent;
    text-align: left;
  }
  
  .il-dropdown-item:hover { background: #f3f4f6; color: #111827; }
  
  .il-loading, .il-empty { padding: 3rem; text-align: center; }
  .il-loading-text, .il-empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
  }
  .il-empty-desc { font-size: 0.8125rem; color: #6b7280; }
  .il-empty-icon { width: 3rem; height: 3rem; margin: 0 auto 1rem; color: #d1d5db; }
  
  @media (max-width: 900px) {
    .il-hide-sm { display: none !important; }
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'il-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

const NUMERIC_KEYS = ['subtotal', 'taxAmount', 'totalAmount'] as const;

function mergeCheckboxOptions(columns: TableColumn[], rows: Record<string, unknown>[]): TableColumn[] {
  return columns.map((col) => {
    if (col.hidden) return col;
    if (col.filter?.type !== 'checkbox') return col;
    if (col.filter.options.length > 0) return col;
    return {
      ...col,
      filter: {
        ...col.filter,
        options: distinctOptions(rows, col.key),
      },
    };
  });
}

function applyDateRange(row: Record<string, unknown>, from: string, to: string): boolean {
  if (!from && !to) return true;
  const v = row.issueDate;
  if (v == null) return false;
  const d = new Date(String(v)).getTime();
  if (Number.isNaN(d)) return false;
  if (from) {
    const f = new Date(`${from}T00:00:00`).getTime();
    if (d < f) return false;
  }
  if (to) {
    const t = new Date(`${to}T23:59:59.999`).getTime();
    if (d > t) return false;
  }
  return true;
}

function compareRowValues(a: unknown, b: unknown, dataType: TableColumn['dataType']): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (dataType === 'number') {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na)) return 1;
    if (Number.isNaN(nb)) return -1;
    return na === nb ? 0 : na < nb ? -1 : 1;
  }
  if (dataType === 'timestamp') {
    const na = new Date(String(a)).getTime();
    const nb = new Date(String(b)).getTime();
    if (Number.isNaN(na)) return 1;
    if (Number.isNaN(nb)) return -1;
    return na === nb ? 0 : na < nb ? -1 : 1;
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

function renderCell(column: TableColumn, value: unknown): ReactNode {
  if (value == null || value === '') {
    return <span className="il-muted">—</span>;
  }

  const { type: displayType, colorMap } = column.display;

  if (displayType === 'code') {
    return <span className="il-invoice-num">{String(value)}</span>;
  }

  if (displayType === 'badge') {
    const raw = String(value);
    const color = colorMap?.[raw];
    const style = color
      ? {
          borderColor: color,
          color,
          background: `${color}14`,
        }
      : undefined;
    const label =
      column.key === 'sourceType'
        ? ({ quotation: 'Quotation', challan: 'Challan', po: 'PO' } as Record<string, string>)[raw] ?? raw
        : raw;
    return (
      <span className="il-badge" style={style} title={label}>
        {label}
      </span>
    );
  }

  if (displayType === 'timestamp') {
    return <span className="il-date">{formatDate(String(value))}</span>;
  }

  if (displayType === 'number') {
    return <span className="il-amount">{formatCurrency(Number(value))}</span>;
  }

  return <span>{String(value)}</span>;
}

const MOBILE_HIDE_KEYS = new Set(['subtotal', 'taxAmount', 'primaryDescription']);

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<string>('issueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [checkboxSelections, setCheckboxSelections] = useState<Record<string, string[]>>({});
  const [issueDateFrom, setIssueDateFrom] = useState('');
  const [issueDateTo, setIssueDateTo] = useState('');
  const [sliderFilter, setSliderFilter] = useState<Record<string, { min: number; max: number }>>({});
  const [activePdfAction, setActivePdfAction] = useState<{
    invoiceId: string;
    action: 'preview' | 'download' | 'print' | 'email';
  } | null>(null);
  const [selectedPdfTemplate, setSelectedPdfTemplate] = useState<'default' | 'progrid'>('default');
  const [openMenuInvoiceId, setOpenMenuInvoiceId] = useState<string | null>(null);
  const [openColumnsMenu, setOpenColumnsMenu] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceWithRelations | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!openMenuInvoiceId) return undefined;
    const handleCloseMenu = () => setOpenMenuInvoiceId(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuInvoiceId(null);
    };
    document.addEventListener('click', handleCloseMenu);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleCloseMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuInvoiceId]);

  useEffect(() => {
    if (!openColumnsMenu) return undefined;
    const handleCloseMenu = () => setOpenColumnsMenu(false);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenColumnsMenu(false);
    };
    document.addEventListener('click', handleCloseMenu);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleCloseMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openColumnsMenu]);

  useEffect(() => {
    if (!openFilterColumn) return undefined;
    const handleClose = () => setOpenFilterColumn(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenFilterColumn(null);
    };
    document.addEventListener('click', handleClose);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClose);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openFilterColumn]);

  const invoicesQuery = useInvoices();
  const { mutate: deleteMutate } = useDeleteInvoice();

  const paired = useMemo(
    () => (invoicesQuery.data ?? []).map((invoice) => ({ invoice, row: invoiceToListRow(invoice) })),
    [invoicesQuery.data],
  );

  const allRows = useMemo(() => paired.map((p) => p.row), [paired]);

  const visibleColumns = useMemo(() => {
    const base = invoiceListTableSchema.columns.filter((c) => !c.hidden && !hiddenColumns.has(c.key));
    return mergeCheckboxOptions(base, allRows);
  }, [allRows, hiddenColumns]);

  const dataBounds = useMemo(() => {
    const bounds: Record<string, { min: number; max: number }> = {};
    for (const k of NUMERIC_KEYS) {
      const nums = paired.map(({ row }) => Number(row[k])).filter((n) => !Number.isNaN(n));
      if (nums.length === 0) bounds[k] = { min: 0, max: 1 };
      else bounds[k] = { min: Math.min(...nums), max: Math.max(...nums) };
    }
    return bounds;
  }, [paired]);

  useEffect(() => {
    setSliderFilter((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of NUMERIC_KEYS) {
        const b = dataBounds[k];
        if (!b) continue;
        if (!next[k]) {
          next[k] = { min: b.min, max: b.max };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [dataBounds]);

  const filteredPaired = useMemo(() => {
    let list = paired;

    for (const col of visibleColumns) {
      if (col.filter?.type !== 'checkbox') continue;
      const sel = checkboxSelections[col.key];
      if (!sel?.length) continue;
      list = list.filter(({ row }) => sel.includes(String(row[col.key] ?? '')));
    }

    if (issueDateFrom || issueDateTo) {
      list = list.filter(({ row }) => applyDateRange(row, issueDateFrom, issueDateTo));
    }

    for (const col of visibleColumns) {
      if (col.filter?.type !== 'slider') continue;
      const r = sliderFilter[col.key];
      if (!r) continue;
      list = list.filter(({ row }) => {
        const n = Number(row[col.key]);
        return !Number.isNaN(n) && n >= r.min && n <= r.max;
      });
    }

    return list;
  }, [paired, visibleColumns, checkboxSelections, issueDateFrom, issueDateTo, sliderFilter]);

  const sortedPaired = useMemo(() => {
    const col = visibleColumns.find((c) => c.key === sortKey);
    if (!col) return filteredPaired;
    const dir = sortDir === 'asc' ? 1 : -1;
    const list = [...filteredPaired];
    list.sort((a, b) => dir * compareRowValues(a.row[sortKey], b.row[sortKey], col.dataType));
    return list;
  }, [filteredPaired, visibleColumns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedPaired.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedData = sortedPaired.slice(startIndex, endIndex);

  const toggleSort = (key: string) => {
    const col = visibleColumns.find((c) => c.key === key);
    if (!col?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(col.dataType === 'timestamp' || col.dataType === 'number' ? 'desc' : 'asc');
    }
  };

  const toggleCheckboxValue = (columnKey: string, value: string, checked: boolean) => {
    setCheckboxSelections((prev) => {
      const cur = new Set(prev[columnKey] ?? []);
      if (checked) cur.add(value);
      else cur.delete(value);
      return { ...prev, [columnKey]: [...cur] };
    });
  };

  const toggleColumnVisibility = (columnKey: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  };

  const saveColumnPreferences = () => {
    localStorage.setItem('invoice-table-hidden-columns', JSON.stringify([...hiddenColumns]));
    setOpenColumnsMenu(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem('invoice-table-hidden-columns');
    if (saved) {
      try {
        setHiddenColumns(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Failed to load column preferences', e);
      }
    }
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [checkboxSelections, issueDateFrom, issueDateTo, sliderFilter]);

  const resetFilters = () => {
    setCheckboxSelections({});
    setIssueDateFrom('');
    setIssueDateTo('');
    setSliderFilter({
      subtotal: { ...dataBounds.subtotal },
      taxAmount: { ...dataBounds.taxAmount },
      totalAmount: { ...dataBounds.totalAmount },
    });
    setCurrentPage(1);
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    setActivePdfAction({ invoiceId, action: 'download' });
    try {
      if (selectedPdfTemplate === 'progrid') {
        await generateProGridInvoicePDF(invoiceId);
      } else {
        await downloadInvoicePDF(invoiceId);
      }
    } finally {
      setActivePdfAction(null);
    }
  };

  const handlePreviewPdf = async (invoice: InvoiceWithRelations) => {
    setPreviewInvoice(invoice);
    setPreviewLoading(true);
    try {
      const url = await getInvoicePdfBlobUrl(invoice);
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

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  const handlePrintPdf = async (invoiceId: string) => {
    setActivePdfAction({ invoiceId, action: 'print' });
    try {
      await printInvoicePDF(invoiceId);
    } finally {
      setActivePdfAction(null);
    }
  };

  const handleEmailPdf = async (invoiceId: string) => {
    setActivePdfAction({ invoiceId, action: 'email' });
    try {
      await emailInvoicePDF(invoiceId);
    } finally {
      setActivePdfAction(null);
    }
  };

  const handleDelete = (invoice: InvoiceWithRelations) => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoice_no || invoice.id}?`)) return;
    if (!confirm('This action cannot be undone. Continue?')) return;
    deleteMutate(invoice.id!);
  };

  const colSpan = visibleColumns.length + 1;

  const renderActions = (invoice: InvoiceWithRelations) => (
    <div className="il-actions">
      <button
        type="button"
        onClick={() => void handlePreviewPdf(invoice)}
        className="il-action-btn"
      >
        View
        <Eye size={14} />
      </button>
      <button
        type="button"
        onClick={() => navigate(`/invoices/edit?id=${invoice.id}`)}
        className="il-action-btn"
      >
        Edit
        <Pencil size={14} />
      </button>
      <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setOpenMenuInvoiceId((c) => (c === invoice.id ? null : invoice.id ?? null))}
          disabled={!invoice.id || activePdfAction?.invoiceId === invoice.id}
          className="il-dropdown-trigger"
          aria-label="More actions"
        >
          {activePdfAction?.invoiceId === invoice.id ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <MoreHorizontal size={14} />
          )}
        </button>
        {openMenuInvoiceId === invoice.id && (
          <div className="il-dropdown">
            <button
              type="button"
              onClick={() => {
                setOpenMenuInvoiceId(null);
                navigate(`/invoices/create?from=${invoice.id}`);
              }}
              className="il-dropdown-item"
            >
              <Plus size={14} />
              Create from Existing
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMenuInvoiceId(null);
                void handlePreviewPdf(invoice);
              }}
              className="il-dropdown-item"
            >
              <Eye size={14} />
              Preview PDF
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMenuInvoiceId(null);
                void handleDownloadPdf(invoice.id ?? '');
              }}
              className="il-dropdown-item"
            >
              <Download size={14} />
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMenuInvoiceId(null);
                void handlePrintPdf(invoice.id ?? '');
              }}
              className="il-dropdown-item"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMenuInvoiceId(null);
                void handleEmailPdf(invoice.id ?? '');
              }}
              className="il-dropdown-item"
            >
              <Mail size={14} />
              Email
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMenuInvoiceId(null);
                handleDelete(invoice);
              }}
              className="il-dropdown-item"
              style={{ color: '#dc2626' }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="il-page">
      <div className="il-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h1 className="il-title">Invoices</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>PDF:</span>
              <select
                value={selectedPdfTemplate}
                onChange={(e) => setSelectedPdfTemplate(e.target.value as 'default' | 'progrid')}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  fontSize: 12,
                  backgroundColor: '#fff',
                  color: '#374151',
                }}
              >
                <option value="default">Default</option>
                <option value="progrid">Pro Grid</option>
              </select>
            </div>
            <button type="button" onClick={() => navigate('/invoices/create')} className="il-btn il-btn-primary" style={{ background: '#2563eb' }}>
              <Plus size={16} />
              Create Invoice
            </button>
          </div>
        </div>

        {/* Compact toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.75rem',
          padding: '0.5rem 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Filter size={12} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</span>
            <input
              type="date"
              className="il-input"
              value={issueDateFrom}
              onChange={(e) => setIssueDateFrom(e.target.value)}
              aria-label="From"
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>–</span>
            <input
              type="date"
              className="il-input"
              value={issueDateTo}
              onChange={(e) => setIssueDateTo(e.target.value)}
              aria-label="To"
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
            />
          </div>
          <button type="button" className="il-btn il-btn-secondary" onClick={resetFilters} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
            <RotateCcw size={12} />
            Reset
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            {sortedPaired.length} invoice{sortedPaired.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="il-table-card">
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setOpenColumnsMenu((c) => !c)}
                className="il-btn il-btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}
              >
                <Columns size={14} />
                Columns
              </button>
              {openColumnsMenu && (
                <div className="il-dropdown" style={{ right: 0, top: 'calc(100% + 0.5rem)', minWidth: '200px' }}>
                  <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Show Columns
                  </div>
                  {invoiceListTableSchema.columns.map((col) => (
                    <label
                      key={col.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.has(col.key)}
                        onChange={() => toggleColumnVisibility(col.key)}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                  <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border-light)', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={saveColumnPreferences}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="il-table-wrapper">
            <table className="il-table">
              <thead>
                <tr>
                  {visibleColumns.map((col) => {
                    const hideSm = MOBILE_HIDE_KEYS.has(col.key) ? ' il-hide-sm' : '';
                    const num = col.display.type === 'number' ? ' il-th-num' : '';
                    const sortable = col.sortable ? ' il-th-sortable' : '';
                    const hasCheckboxFilter = col.filter?.type === 'checkbox';
                    const isFilterOpen = openFilterColumn === col.key;
                    const selectedCount = (checkboxSelections[col.key] ?? []).length;
                    return (
                      <th
                        key={col.key}
                        className={`${hideSm}${num}${sortable}`}
                        style={{ minWidth: col.size }}
                        scope="col"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('.il-th-filter-btn, .il-th-filter-dropdown')) return;
                          col.sortable && toggleSort(col.key);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {col.label}
                          {col.sortable && sortKey === col.key ? (
                            sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : null}
                        </div>
                        {hasCheckboxFilter && (
                          <div className="il-th-filter" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`il-th-filter-btn${selectedCount > 0 ? ' active' : ''}`}
                              onClick={() => setOpenFilterColumn(isFilterOpen ? null : col.key)}
                            >
                              <Filter size={10} />
                              {selectedCount > 0 ? `${selectedCount} selected` : 'Filter'}
                            </button>
                            {isFilterOpen && (
                              <div className="il-th-filter-dropdown">
                                {(() => {
                                  const opts = col.filter?.type === 'checkbox' ? col.filter.options : [];
                                  const selected = new Set(checkboxSelections[col.key] ?? []);
                                  return (
                                    <>
                                      <div style={{ padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-light)', fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                        {col.label}
                                      </div>
                                      {opts.length === 0 ? (
                                        <span className="il-muted" style={{ fontSize: '0.75rem', padding: '0.5rem' }}>No values</span>
                                      ) : (
                                        opts.map((opt) => (
                                          <label key={opt.value} className="il-checkbox-row" style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>
                                            <input
                                              type="checkbox"
                                              checked={selected.has(opt.value)}
                                              onChange={(e) => toggleCheckboxValue(col.key, opt.value, e.target.checked)}
                                            />
                                            <span title={opt.label}>{opt.label}</span>
                                          </label>
                                        ))
                                      )}
                                      {selectedCount > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => setCheckboxSelections((prev) => ({ ...prev, [col.key]: [] }))}
                                          style={{ width: '100%', marginTop: '0.25rem', padding: '0.375rem', fontSize: '0.6875rem', color: 'var(--accent)', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-light)', cursor: 'pointer', textAlign: 'center' }}
                                        >
                                          Clear
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                  <th className="il-th-actions" scope="col">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoicesQuery.isLoading && (
                  <tr>
                    <td colSpan={colSpan} className="il-loading">
                      <div className="il-loading-text">Loading invoices...</div>
                    </td>
                  </tr>
                )}

                {!invoicesQuery.isLoading && sortedPaired.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="il-empty">
                      <FileText className="il-empty-icon" />
                      <div className="il-empty-title">No invoices found</div>
                      <div className="il-empty-desc">
                        Adjust filters or create an invoice from a source document.
                      </div>
                    </td>
                  </tr>
                )}

                {!invoicesQuery.isLoading &&
                  paginatedData.map(({ invoice, row }) => (
                    <tr
                      key={invoice.id ?? String(row.invoiceNumber)}
                      onClick={() => navigate(`/invoices/view?id=${invoice.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {visibleColumns.map((col) => {
                        const hideSm = MOBILE_HIDE_KEYS.has(col.key) ? ' il-hide-sm' : '';
                        const num = col.display.type === 'number' ? ' il-td-num' : '';
                        return (
                          <td key={col.key} className={`${hideSm}${num}`}>
                            {renderCell(col, row[col.key])}
                          </td>
                        );
                      })}
                      <td className="il-td-actions" onClick={(e) => e.stopPropagation()}>
                        {renderActions(invoice)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {sortedPaired.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                Showing {startIndex + 1}–{Math.min(endIndex, sortedPaired.length)} of {sortedPaired.length}
              </span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  style={{ padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', background: safeCurrentPage === 1 ? '#f3f4f6' : '#fff', color: safeCurrentPage === 1 ? '#9ca3af' : '#374151', fontSize: '0.75rem', cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) { page = i + 1; }
                  else if (safeCurrentPage <= 3) { page = i + 1; }
                  else if (safeCurrentPage >= totalPages - 2) { page = totalPages - 4 + i; }
                  else { page = safeCurrentPage - 2 + i; }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        padding: '0.375rem 0.625rem',
                        border: page === safeCurrentPage ? '1px solid #2563eb' : '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        background: page === safeCurrentPage ? '#eff6ff' : '#fff',
                        color: page === safeCurrentPage ? '#2563eb' : '#374151',
                        fontSize: '0.75rem',
                        fontWeight: page === safeCurrentPage ? 600 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  style={{ padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', background: safeCurrentPage === totalPages ? '#f3f4f6' : '#fff', color: safeCurrentPage === totalPages ? '#9ca3af' : '#374151', fontSize: '0.75rem', cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PDF Preview Modal */}
      {previewInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
          }}
          onClick={closePreview}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '90vw',
              maxWidth: '1200px',
              height: '95vh',
              background: '#fff',
              borderRadius: '0.75rem',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.625rem 1rem',
              background: '#fff',
              borderBottom: '1px solid #e5e7eb',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: '#111827', fontSize: '0.875rem', fontWeight: 600 }}>
                  {previewInvoice.invoice_no || `Invoice ${previewInvoice.id?.slice(0, 8)}`}
                </span>
                {previewLoading && (
                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Loading...</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => navigate(`/invoices/edit?id=${previewInvoice.id}`)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.375rem 0.75rem',
                    background: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    color: '#374151',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (previewInvoice.id) {
                      await downloadInvoicePDF(previewInvoice);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.375rem 0.75rem',
                    background: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    color: '#374151',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (previewInvoice.id) {
                      await printInvoicePDF(previewInvoice);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.375rem 0.75rem',
                    background: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    color: '#374151',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Printer size={14} />
                  Print
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '2rem',
                    height: '2rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  ×
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div style={{ flex: 1, overflow: 'hidden', background: '#f3f4f6' }}>
              {previewPdfUrl ? (
                <iframe
                  src={previewPdfUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Invoice PDF Preview"
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
                  <Loader2 className="animate-spin" size={24} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
