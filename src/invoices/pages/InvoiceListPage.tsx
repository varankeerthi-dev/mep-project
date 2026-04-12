import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TableColumn } from '@/lib/table-schema';
import { distinctOptions } from '@/lib/table-schema';
import { useInvoices } from '../hooks';
import { invoiceListTableSchema, invoiceToListRow } from '../invoice-list-table-schema';
import { downloadInvoicePDF, emailInvoicePDF, previewInvoicePDF, printInvoicePDF } from '../pdf';
import type { InvoiceWithRelations } from '../api';
import { formatCurrency, formatDate } from '../ui-utils';

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --bg-page: #faf9f7;
    --bg-card: #ffffff;
    --bg-hover: #f5f3f0;
    --bg-muted: #f8f7f5;
    --border: #e8e5e1;
    --border-light: #f0eeeb;
    --border-hover: #d4d0ca;
    --text-primary: #1a1a1a;
    --text-secondary: #6b6b6b;
    --text-muted: #9ca3af;
    --accent: #e85d04;
    --accent-hover: #dc4c00;
  }
  
  .il-page {
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg-page);
    min-height: 100vh;
    padding: 2rem;
  }
  
  .il-container { max-width: 1600px; margin: 0 auto; }
  
  .il-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 2rem;
    gap: 1rem;
  }
  
  .il-header-left { flex: 1; }
  
  .il-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }
  
  .il-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    margin: 0 0 0.5rem 0;
  }
  
  .il-subtitle {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
    max-width: 600px;
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
    background: var(--accent);
    color: white;
  }
  
  .il-btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); }
  
  .il-btn-secondary {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  
  .il-btn-secondary:hover { background: var(--bg-hover); border-color: var(--border-hover); }
  
  .il-filters-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
  }
  
  .il-filters-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem 1.5rem;
    margin-bottom: 1rem;
  }
  
  .il-filters-row:last-child { margin-bottom: 0; }
  
  .il-filter-block {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }
  
  .il-filter-block-title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  
  .il-date-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
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
  
  .il-checkbox-scroll {
    max-height: 7rem;
    overflow-y: auto;
    border: 1px solid var(--border-light);
    border-radius: 0.5rem;
    padding: 0.35rem 0.5rem;
    background: var(--bg-muted);
    min-width: 10rem;
    max-width: 14rem;
  }
  
  .il-checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    padding: 0.15rem 0;
  }
  
  .il-slider-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .il-slider-row input[type="number"] {
    width: 5.5rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    font-size: 0.75rem;
  }
  
  .il-count {
    margin-left: auto;
    font-size: 0.8125rem;
    color: var(--text-muted);
    font-weight: 500;
  }
  
  .il-table-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow-x: auto;
  }
  
  .il-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    min-width: 1100px;
  }
  
  .il-table thead {
    background: var(--bg-muted);
    border-bottom: 1px solid var(--border);
  }
  
  .il-table th {
    padding: 0.75rem 0.65rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    white-space: nowrap;
    vertical-align: bottom;
  }
  
  .il-table th.il-th-sortable {
    cursor: pointer;
    user-select: none;
    color: var(--text-secondary);
  }
  
  .il-table th.il-th-sortable:hover { color: var(--accent); }
  
  .il-table th.il-th-num, .il-table td.il-td-num { text-align: right; }
  
  .il-table th.il-th-actions, .il-table td.il-td-actions { text-align: right; }
  
  .il-table td {
    padding: 0.55rem 0.65rem;
    border-bottom: 1px solid var(--border-light);
    vertical-align: middle;
  }
  
  .il-table tbody tr:hover { background: var(--bg-hover); }
  .il-table tbody tr:last-child td { border-bottom: none; }
  
  .il-invoice-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .il-amount {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .il-date { color: var(--text-secondary); font-size: 0.8125rem; }
  .il-muted { color: var(--text-muted); }
  
  .il-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: capitalize;
    border: 1px solid var(--border);
    background: var(--bg-muted);
    color: var(--text-secondary);
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .il-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.375rem;
  }
  
  .il-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  
  .il-action-btn:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
    color: var(--text-primary);
  }
  
  .il-dropdown-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    color: var(--text-muted);
    cursor: pointer;
  }
  
  .il-dropdown-trigger:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .il-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 0.25rem);
    z-index: 50;
    min-width: 180px;
    background: var(--bg-card);
    border: 1px solid var(--border);
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
    color: var(--text-secondary);
    cursor: pointer;
    border: none;
    background: transparent;
    text-align: left;
  }
  
  .il-dropdown-item:hover { background: var(--bg-hover); color: var(--text-primary); }
  
  .il-loading, .il-empty { padding: 3rem; text-align: center; }
  .il-loading-text, .il-empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
  .il-empty-desc { font-size: 0.8125rem; color: var(--text-muted); }
  .il-empty-icon { width: 3rem; height: 3rem; margin: 0 auto 1rem; color: var(--text-muted); opacity: 0.4; }
  
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

const MOBILE_HIDE_KEYS = new Set(['clientId', 'subtotal', 'taxAmount', 'primaryDescription']);

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
  const [openMenuInvoiceId, setOpenMenuInvoiceId] = useState<string | null>(null);

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

  const invoicesQuery = useInvoices({});

  const paired = useMemo(
    () => (invoicesQuery.data ?? []).map((invoice) => ({ invoice, row: invoiceToListRow(invoice) })),
    [invoicesQuery.data],
  );

  const allRows = useMemo(() => paired.map((p) => p.row), [paired]);

  const visibleColumns = useMemo(() => {
    const base = invoiceListTableSchema.columns.filter((c) => !c.hidden);
    return mergeCheckboxOptions(base, allRows);
  }, [allRows]);

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

  const resetFilters = () => {
    setCheckboxSelections({});
    setIssueDateFrom('');
    setIssueDateTo('');
    setSliderFilter({
      subtotal: { ...dataBounds.subtotal },
      taxAmount: { ...dataBounds.taxAmount },
      totalAmount: { ...dataBounds.totalAmount },
    });
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    setActivePdfAction({ invoiceId, action: 'download' });
    try {
      await downloadInvoicePDF(invoiceId);
    } finally {
      setActivePdfAction(null);
    }
  };

  const handlePreviewPdf = async (invoiceId: string) => {
    setActivePdfAction({ invoiceId, action: 'preview' });
    try {
      await previewInvoicePDF(invoiceId);
    } finally {
      setActivePdfAction(null);
    }
  };

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

  const checkboxFilterColumns = visibleColumns.filter((c) => c.filter?.type === 'checkbox');
  const sliderFilterColumns = visibleColumns.filter((c) => c.filter?.type === 'slider');
  const colSpan = visibleColumns.length + 1;

  const renderActions = (invoice: InvoiceWithRelations) => (
    <div className="il-actions">
      <button
        type="button"
        onClick={() => navigate(`/invoices/edit?id=${invoice.id}`)}
        className="il-action-btn"
      >
        View
        <ArrowRight size={14} />
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
                void handlePreviewPdf(invoice.id ?? '');
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
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="il-page">
      <div className="il-container">
        <div className="il-header">
          <div className="il-header-left">
            <div className="il-label">
              <FileText size={14} />
              Invoice Module
            </div>
            <h1 className="il-title">Invoices</h1>
            <p className="il-subtitle">
              Manage draft and final invoices across quotations, delivery challans, and client purchase orders. Columns and
              filters follow the shared table schema.
            </p>
          </div>
          <button type="button" onClick={() => navigate('/invoices/create')} className="il-btn il-btn-primary">
            <Plus size={16} />
            Create Invoice
          </button>
        </div>

        <div className="il-filters-card">
          <div className="il-filters-row">
            <div className="il-filter-block">
              <span className="il-filter-block-title">
                <Filter size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Issue date range
              </span>
              <div className="il-date-row">
                <input
                  type="date"
                  className="il-input"
                  value={issueDateFrom}
                  onChange={(e) => setIssueDateFrom(e.target.value)}
                  aria-label="Issue date from"
                />
                <span className="il-muted" style={{ fontSize: '0.75rem' }}>
                  to
                </span>
                <input
                  type="date"
                  className="il-input"
                  value={issueDateTo}
                  onChange={(e) => setIssueDateTo(e.target.value)}
                  aria-label="Issue date to"
                />
              </div>
            </div>

            {sliderFilterColumns.map((col) => {
              const b = dataBounds[col.key] ?? { min: 0, max: 1 };
              const r = sliderFilter[col.key] ?? { min: b.min, max: b.max };
              return (
                <div key={col.key} className="il-filter-block">
                  <span className="il-filter-block-title">{col.label}</span>
                  <div className="il-slider-row">
                    <input
                      type="number"
                      step="0.01"
                      value={Number.isFinite(r.min) ? r.min : b.min}
                      min={b.min}
                      max={b.max}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setSliderFilter((prev) => ({
                          ...prev,
                          [col.key]: { min: v, max: Math.max(v, prev[col.key]?.max ?? b.max) },
                        }));
                      }}
                      aria-label={`${col.label} min`}
                    />
                    <span>–</span>
                    <input
                      type="number"
                      step="0.01"
                      value={Number.isFinite(r.max) ? r.max : b.max}
                      min={b.min}
                      max={b.max}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setSliderFilter((prev) => ({
                          ...prev,
                          [col.key]: { min: Math.min(v, prev[col.key]?.min ?? b.min), max: v },
                        }));
                      }}
                      aria-label={`${col.label} max`}
                    />
                  </div>
                </div>
              );
            })}

            <button type="button" className="il-btn il-btn-secondary" onClick={resetFilters}>
              <RotateCcw size={14} />
              Reset filters
            </button>

            <span className="il-count">
              {sortedPaired.length} invoice{sortedPaired.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="il-filters-row" style={{ alignItems: 'flex-start' }}>
            {checkboxFilterColumns.map((col) => {
              const opts = col.filter?.type === 'checkbox' ? col.filter.options : [];
              const selected = new Set(checkboxSelections[col.key] ?? []);
              return (
                <div key={col.key} className="il-filter-block">
                  <span className="il-filter-block-title">{col.label}</span>
                  <div className="il-checkbox-scroll">
                    {opts.length === 0 ? (
                      <span className="il-muted" style={{ fontSize: '0.75rem' }}>
                        No values
                      </span>
                    ) : (
                      opts.map((opt) => (
                        <label key={opt.value} className="il-checkbox-row">
                          <input
                            type="checkbox"
                            checked={selected.has(opt.value)}
                            onChange={(e) => toggleCheckboxValue(col.key, opt.value, e.target.checked)}
                          />
                          <span title={opt.label}>{opt.label}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="il-table-card">
          <table className="il-table">
            <thead>
              <tr>
                {visibleColumns.map((col) => {
                  const hideSm = MOBILE_HIDE_KEYS.has(col.key) ? ' il-hide-sm' : '';
                  const num = col.display.type === 'number' ? ' il-th-num' : '';
                  const sortable = col.sortable ? ' il-th-sortable' : '';
                  return (
                    <th
                      key={col.key}
                      className={`${hideSm}${num}${sortable}`}
                      style={{ minWidth: col.size }}
                      onClick={() => col.sortable && toggleSort(col.key)}
                      scope="col"
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {col.label}
                        {col.sortable && sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          )
                        ) : null}
                      </span>
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
                sortedPaired.map(({ invoice, row }) => (
                  <tr key={invoice.id ?? String(row.invoiceNumber)}>
                    {visibleColumns.map((col) => {
                      const hideSm = MOBILE_HIDE_KEYS.has(col.key) ? ' il-hide-sm' : '';
                      const num = col.display.type === 'number' ? ' il-td-num' : '';
                      return (
                        <td key={col.key} className={`${hideSm}${num}`}>
                          {renderCell(col, row[col.key])}
                        </td>
                      );
                    })}
                    <td className="il-td-actions">{renderActions(invoice)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
