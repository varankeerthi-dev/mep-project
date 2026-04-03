import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, Eye, Loader2, Mail, MoreHorizontal, Plus, Printer, Search, Filter, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../hooks';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { downloadInvoicePDF, emailInvoicePDF, previewInvoicePDF, printInvoicePDF } from '../pdf';
import { formatCurrency, formatDate, getInvoiceDisplayNumber } from '../ui-utils';

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
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
    --accent-light: #fff4ed;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
  }
  
  .il-page {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: var(--bg-page);
    min-height: 100vh;
    padding: 2rem;
  }
  
  .il-container {
    max-width: 1400px;
    margin: 0 auto;
  }
  
  /* Header */
  .il-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 2rem;
    gap: 1rem;
  }
  
  .il-header-left {
    flex: 1;
  }
  
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
  
  .il-btn-primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }
  
  .il-btn-secondary {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  
  .il-btn-secondary:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }
  
  .il-btn-icon {
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .il-btn-icon:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  /* Filters Card */
  .il-filters {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .il-filter-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .il-filter-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    white-space: nowrap;
  }
  
  .il-select,
  .il-input {
    padding: 0.5rem 0.75rem;
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--text-primary);
    transition: all 0.15s ease;
    min-width: 140px;
  }
  
  .il-select:focus,
  .il-input:focus {
    outline: none;
    border-color: var(--accent);
    background: white;
  }
  
  .il-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    padding-right: 2rem;
  }
  
  .il-count {
    margin-left: auto;
    font-size: 0.8125rem;
    color: var(--text-muted);
    font-weight: 500;
  }
  
  /* Table Card */
  .il-table-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow: hidden;
  }
  
  .il-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  
  .il-table thead {
    background: var(--bg-muted);
    border-bottom: 1px solid var(--border);
  }
  
  .il-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    white-space: nowrap;
  }
  
  .il-table th:last-child {
    text-align: right;
  }
  
  .il-table td {
    padding: 0.625rem 1rem;
    border-bottom: 1px solid var(--border-light);
    vertical-align: middle;
  }
  
  .il-table tbody tr {
    transition: background 0.15s ease;
  }
  
  .il-table tbody tr:hover {
    background: var(--bg-hover);
  }
  
  .il-table tbody tr:last-child td {
    border-bottom: none;
  }
  
  /* Invoice Number */
  .il-invoice-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  /* Client Cell */
  .il-client {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  
  .il-client-name {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .il-client-source {
    font-size: 0.6875rem;
    color: var(--text-muted);
    text-transform: capitalize;
  }
  
  /* Amount */
  .il-amount {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--text-primary);
    text-align: right;
  }
  
  /* Date */
  .il-date {
    color: var(--text-secondary);
    font-size: 0.8125rem;
  }
  
  /* Actions */
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
  
  /* Dropdown */
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
    transition: all 0.15s ease;
  }
  
  .il-dropdown-trigger:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
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
    transition: all 0.15s ease;
    border: none;
    background: transparent;
    text-align: left;
  }
  
  .il-dropdown-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  /* Loading & Empty */
  .il-loading,
  .il-empty {
    padding: 3rem;
    text-align: center;
  }
  
  .il-loading-text,
  .il-empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
  
  .il-empty-desc {
    font-size: 0.8125rem;
    color: var(--text-muted);
  }
  
  .il-empty-icon {
    width: 3rem;
    height: 3rem;
    margin: 0 auto 1rem;
    color: var(--text-muted);
    opacity: 0.4;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .il-page {
      padding: 1rem;
    }
    
    .il-header {
      flex-direction: column;
      gap: 1rem;
    }
    
    .il-filters {
      flex-direction: column;
      align-items: stretch;
    }
    
    .il-filter-group {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }
    
    .il-select,
    .il-input {
      width: 100%;
    }
    
    .il-table th:nth-child(2),
    .il-table td:nth-child(2),
    .il-table th:nth-child(5),
    .il-table td:nth-child(5) {
      display: none;
    }
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

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'final'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [activePdfAction, setActivePdfAction] = useState<{
    invoiceId: string;
    action: 'preview' | 'download' | 'print' | 'email';
  } | null>(null);
  const [openMenuInvoiceId, setOpenMenuInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuInvoiceId) return undefined;

    const handleCloseMenu = () => setOpenMenuInvoiceId(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuInvoiceId(null);
      }
    };

    document.addEventListener('click', handleCloseMenu);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleCloseMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuInvoiceId]);

  const invoicesQuery = useInvoices({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const filteredInvoices = useMemo(() => {
    const records = invoicesQuery.data ?? [];

    return records.filter((invoice) => {
      if (!dateFilter) return true;

      const sourceDate = invoice.created_at ? new Date(invoice.created_at) : null;
      if (!sourceDate || Number.isNaN(sourceDate.getTime())) return false;

      const selectedDate = new Date(`${dateFilter}T00:00:00`);
      return sourceDate.toDateString() === selectedDate.toDateString();
    });
  }, [dateFilter, invoicesQuery.data]);

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

  return (
    <div className="il-page">
      <div className="il-container">
        {/* Header */}
        <div className="il-header">
          <div className="il-header-left">
            <div className="il-label">
              <FileText size={14} />
              Invoice Module
            </div>
            <h1 className="il-title">Invoices</h1>
            <p className="il-subtitle">
              Manage draft and final invoices across quotations, delivery challans, and client purchase orders.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/invoices/create')}
            className="il-btn il-btn-primary"
          >
            <Plus size={16} />
            Create Invoice
          </button>
        </div>

        {/* Filters */}
        <div className="il-filters">
          <div className="il-filter-group">
            <Filter size={14} className="il-filter-label" style={{ display: 'flex' }} />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'draft' | 'final')}
              className="il-select"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="final">Final</option>
            </select>
          </div>

          <div className="il-filter-group">
            <span className="il-filter-label">Date</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="il-input"
            />
          </div>

          <span className="il-count">
            {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Table */}
        <div className="il-table-card">
          <table className="il-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Client</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoicesQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="il-loading">
                    <div className="il-loading-text">Loading invoices...</div>
                  </td>
                </tr>
              )}

              {!invoicesQuery.isLoading && filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="il-empty">
                    <FileText className="il-empty-icon" />
                    <div className="il-empty-title">No invoices found</div>
                    <div className="il-empty-desc">
                      Try a different filter or create your first invoice from a source document.
                    </div>
                  </td>
                </tr>
              )}

              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <span className="il-invoice-num">{getInvoiceDisplayNumber(invoice)}</span>
                  </td>
                  <td>
                    <div className="il-client">
                      <span className="il-client-name">{invoice.client?.name ?? 'Unknown client'}</span>
                      <span className="il-client-source">{invoice.source_type}</span>
                    </div>
                  </td>
                  <td className="il-amount">{formatCurrency(invoice.total)}</td>
                  <td>
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className="il-date">{formatDate(invoice.created_at)}</td>
                  <td>
                    <div className="il-actions">
                      <button
                        type="button"
                        onClick={() => navigate(`/invoices/edit?id=${invoice.id}`)}
                        className="il-action-btn"
                      >
                        View
                        <ArrowRight size={14} />
                      </button>
                      <div
                        className="relative"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenMenuInvoiceId((current) => (current === invoice.id ? null : invoice.id ?? null))}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
