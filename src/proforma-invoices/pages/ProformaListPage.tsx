import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Filter,
  FileText,
  Send,
  CheckCircle,
  XCircle,
  FileCheck,
  Download,
  Copy,
  Mail,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { withSessionCheck } from '../../queryClient';
import { getProformaInvoices, convertToInvoice, type ProformaWithRelations } from '../api';
import { formatCurrency, formatDate } from '../../invoices/ui-utils';
import type { ProformaStatus } from '../types';
import { downloadProformaPdf, emailProformaInvoice } from '../pdf';
import { useProformaInvoices, useCloneProforma, useSendProforma, useMarkAccepted, useMarkRejected, useDeleteProforma } from '../hooks';
import { useClients } from '../../hooks/useClients';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --pi-bg-page: #faf9f7;
    --pi-bg-card: #ffffff;
    --pi-bg-hover: #f5f3f0;
    --pi-bg-muted: #f8f7f5;
    --pi-border: #e8e5e1;
    --pi-border-light: #f0eeeb;
    --pi-border-hover: #d4d0ca;
    --pi-text-primary: #1a1a1a;
    --pi-text-secondary: #6b6b6b;
    --pi-text-muted: #9ca3af;
    --pi-accent: #0a7661;
    --pi-accent-hover: #065d4f;
  }
  
  .pi-page {
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--pi-bg-page);
    min-height: 100vh;
    padding: 2rem;
  }
  
  .pi-container { max-width: 1600px; margin: 0 auto; }
  
  .pi-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 2rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .pi-header-left { flex: 1; min-width: 200px; }
  
  .pi-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--pi-text-muted);
    margin-bottom: 0.75rem;
  }
  
  .pi-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--pi-text-primary);
    letter-spacing: -0.02em;
    margin: 0 0 0.5rem 0;
  }
  
  .pi-subtitle {
    font-size: 0.9375rem;
    color: var(--pi-text-secondary);
    line-height: 1.5;
    max-width: 600px;
  }
  
  .pi-btn {
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
  
  .pi-btn-primary {
    background: var(--pi-accent);
    color: white;
  }
  
  .pi-btn-primary:hover { background: var(--pi-accent-hover); transform: translateY(-1px); }
  
  .pi-stats-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  
  .pi-stat-card {
    background: var(--pi-bg-card);
    border: 1px solid var(--pi-border);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    min-width: 140px;
    flex: 1;
  }
  
  .pi-stat-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--pi-text-muted);
    margin-bottom: 0.5rem;
  }
  
  .pi-stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--pi-text-primary);
  }
  
  .pi-filters-card {
    background: var(--pi-bg-card);
    border: 1px solid var(--pi-border);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
  }
  
  .pi-filters-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem;
  }
  
  .pi-filter-block {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .pi-filter-block-title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--pi-text-muted);
  }
  
  .pi-input, .pi-select {
    padding: 0.5rem 0.75rem;
    background: var(--pi-bg-muted);
    border: 1px solid var(--pi-border);
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--pi-text-primary);
  }
  
  .pi-input:focus, .pi-select:focus {
    outline: none;
    border-color: var(--pi-accent);
    background: white;
  }
  
  .pi-table-card {
    background: var(--pi-bg-card);
    border: 1px solid var(--pi-border);
    border-radius: 0.75rem;
    overflow-x: auto;
  }
  
  .pi-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    min-width: 900px;
  }
  
  .pi-table thead {
    background: var(--pi-bg-muted);
    border-bottom: 1px solid var(--pi-border);
  }
  
  .pi-table th {
    padding: 0.75rem 0.65rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--pi-text-muted);
    white-space: nowrap;
  }
  
  .pi-table td {
    padding: 0.55rem 0.65rem;
    border-bottom: 1px solid var(--pi-border-light);
    vertical-align: middle;
  }
  
  .pi-table tbody tr:hover { background: var(--pi-bg-hover); }
  .pi-table tbody tr:last-child td { border-bottom: none; }
  
  .pi-number {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--pi-text-primary);
  }
  
  .pi-amount {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
  }
  
  .pi-date { color: var(--pi-text-secondary); }
  .pi-muted { color: var(--pi-text-muted); }
  
  .pi-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: capitalize;
  }
  
  .pi-badge-draft { background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; }
  .pi-badge-sent { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .pi-badge-accepted { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
  .pi-badge-rejected { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  
  .pi-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.375rem;
  }
  
  .pi-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px solid var(--pi-border);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--pi-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  
  .pi-action-btn:hover {
    background: var(--pi-bg-hover);
    border-color: var(--pi-border-hover);
    color: var(--pi-text-primary);
  }
  
  .pi-dropdown-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    background: transparent;
    border: 1px solid var(--pi-border);
    border-radius: 0.375rem;
    color: var(--pi-text-muted);
    cursor: pointer;
  }
  
  .pi-dropdown-trigger:hover {
    background: var(--pi-bg-hover);
    color: var(--pi-text-primary);
  }
  
  .pi-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 0.25rem);
    z-index: 50;
    min-width: 180px;
    background: var(--pi-bg-card);
    border: 1px solid var(--pi-border);
    border-radius: 0.5rem;
    padding: 0.375rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  }
  
  .pi-dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--pi-text-secondary);
    cursor: pointer;
    border: none;
    background: transparent;
    text-align: left;
  }
  
  .pi-dropdown-item:hover { background: var(--pi-bg-hover); color: var(--pi-text-primary); }
  
  .pi-loading, .pi-empty { padding: 3rem; text-align: center; }
  .pi-empty-icon { width: 3rem; height: 3rem; margin: 0 auto 1rem; color: var(--pi-text-muted); opacity: 0.4; }
  
  .pi-checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
  
  .pi-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-top: 1px solid var(--pi-border);
  }
  
  .pi-pagination-info {
    font-size: 0.8125rem;
    color: var(--pi-text-secondary);
  }
  
  .pi-pagination-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .pi-page-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: var(--pi-bg-card);
    border: 1px solid var(--pi-border);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    color: var(--pi-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .pi-page-btn:hover:not(:disabled) {
    background: var(--pi-bg-hover);
    border-color: var(--pi-border-hover);
    color: var(--pi-text-primary);
  }
  
  .pi-page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .pi-bulk-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--pi-accent);
    border-radius: 0.5rem;
    align-items: center;
  }
  
  .pi-bulk-actions-text {
    color: white;
    font-size: 0.8125rem;
    font-weight: 500;
  }
  
  .pi-bulk-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--pi-accent);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .pi-bulk-btn:hover {
    background: var(--pi-bg-hover);
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'pi-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

const statusColors: Record<string, string> = {
  draft: 'draft',
  sent: 'sent',
  accepted: 'accepted',
  rejected: 'rejected',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

import { useQuery, useMutation } from '@tanstack/react-query';

export default function ProformaListPage() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [statusFilter, setStatusFilter] = useState<ProformaStatus | ''>('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: clients = [] } = useClients();

  const filters = useMemo(() => ({
    organisationId: organisation?.id,
    status: statusFilter || undefined,
    search: searchTerm || undefined,
    clientId: clientFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    minAmount: minAmount ? Number(minAmount) : undefined,
    maxAmount: maxAmount ? Number(maxAmount) : undefined,
    page,
    pageSize,
  }), [organisation?.id, statusFilter, searchTerm, clientFilter, dateFrom, dateTo, minAmount, maxAmount, page, pageSize]);

  const { data: proformas, isLoading } = useProformaInvoices(filters);

  const { mutate: cloneMutate } = useCloneProforma();
  const { mutate: sendMutate } = useSendProforma();
  const { mutate: acceptMutate } = useMarkAccepted();
  const { mutate: rejectMutate } = useMarkRejected();
  const { mutate: deleteMutate } = useDeleteProforma();

  useEffect(() => {
    if (!openMenuId) return undefined;
    const handleCloseMenu = () => setOpenMenuId(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('click', handleCloseMenu);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleCloseMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuId]);

  const { mutate: convertMutate } = useMutation({
    mutationFn: async ({ proformaId }: { proformaId: string }) => {
      if (!organisation?.id) throw new Error('No organisation');
      const invoice = await convertToInvoice(proformaId, organisation.id);
      return invoice;
    },
    onSuccess: (invoice) => {
      navigate(`/invoices/edit?id=${invoice.id}`);
    },
  });

  const handleDownloadPdf = async (proforma: ProformaWithRelations) => {
    if (!organisation?.id) return;
    try {
      await downloadProformaPdf(proforma, { organisationId: organisation.id });
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const handleEmail = async (proforma: ProformaWithRelations) => {
    if (!organisation?.id || !proforma.client?.email) {
      alert('Client email not available');
      return;
    }
    try {
      await emailProformaInvoice(proforma.id, organisation.id, proforma.client.email);
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email. Please try again.');
    }
  };

  const handleClone = (proforma: ProformaWithRelations) => {
    if (!organisation?.id) return;
    cloneMutate(
      { id: proforma.id!, organisationId: organisation.id },
      {
        onSuccess: (newProforma) => {
          navigate(`/proforma-invoices/edit?id=${newProforma.id}`);
        },
      },
    );
  };

  const handleBulkDelete = () => {
    if (!organisation?.id || selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} proforma invoice(s)?`)) return;

    selectedIds.forEach((id) => {
      deleteMutate({ id, organisationId: organisation.id });
    });
    setSelectedIds(new Set());
  };

  const handleBulkSend = () => {
    if (!organisation?.id || selectedIds.size === 0) return;
    selectedIds.forEach((id) => {
      sendMutate({ id, organisationId: organisation.id });
    });
    setSelectedIds(new Set());
  };

  const handleExportCsv = () => {
    if (!proformas || proformas.length === 0) return;

    const headers = ['PI Number', 'Client', 'Status', 'Subtotal', 'GST', 'Total', 'Created Date', 'Valid Until'];
    const rows = proformas.map((p) => [
      p.pi_number || p.id,
      p.client?.name || '',
      p.status,
      p.subtotal,
      p.cgst + p.sgst + p.igst,
      p.total,
      p.created_at ? formatDate(p.created_at) : '',
      p.valid_until ? formatDate(p.valid_until) : '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'proforma-invoices.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(proformas?.map((p) => p.id!) || []));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const totalPages = Math.ceil((proformas?.length || 0) / pageSize);

  const stats = useMemo(() => {
    const list = proformas ?? [];
    return {
      draft: list.filter(p => p.status === 'draft').length,
      sent: list.filter(p => p.status === 'sent').length,
      accepted: list.filter(p => p.status === 'accepted').length,
      total: list.reduce((sum, p) => sum + Number(p.total), 0),
    };
  }, [proformas]);

  const handleConvert = (proformaId: string) => {
    convertMutate({ proformaId });
  };

  const renderActions = (proforma: ProformaWithRelations) => (
    <div className="pi-actions">
      <button
        type="button"
        onClick={() => navigate(`/proforma-invoices/edit?id=${proforma.id}`)}
        className="pi-action-btn"
      >
        View
        <ArrowRight size={14} />
      </button>
      <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setOpenMenuId((c) => (c === proforma.id ? null : proforma.id ?? null))}
          className="pi-dropdown-trigger"
          aria-label="More actions"
        >
          <MoreHorizontal size={14} />
        </button>
        {openMenuId === proforma.id && (
          <div className="pi-dropdown">
            <button
              type="button"
              onClick={() => handleDownloadPdf(proforma)}
              className="pi-dropdown-item"
            >
              <Download size={14} />
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => handleEmail(proforma)}
              className="pi-dropdown-item"
            >
              <Mail size={14} />
              Send Email
            </button>
            <button
              type="button"
              onClick={() => handleClone(proforma)}
              className="pi-dropdown-item"
            >
              <Copy size={14} />
              Clone
            </button>
            {proforma.status === 'draft' && (
              <button
                type="button"
                onClick={() => sendMutate({ id: proforma.id!, organisationId: organisation?.id! })}
                className="pi-dropdown-item"
              >
                <Send size={14} />
                Send to Client
              </button>
            )}
            {proforma.status === 'sent' && (
              <>
                <button
                  type="button"
                  onClick={() => acceptMutate({ id: proforma.id!, organisationId: organisation?.id! })}
                  className="pi-dropdown-item"
                >
                  <CheckCircle size={14} />
                  Mark Accepted
                </button>
                <button
                  type="button"
                  onClick={() => rejectMutate({ id: proforma.id!, organisationId: organisation?.id! })}
                  className="pi-dropdown-item"
                >
                  <XCircle size={14} />
                  Mark Rejected
                </button>
              </>
            )}
            {!proforma.converted_invoice_id && proforma.status === 'accepted' && (
              <button
                type="button"
                onClick={() => handleConvert(proforma.id!)}
                className="pi-dropdown-item"
              >
                <FileCheck size={14} />
                Convert to Invoice
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="pi-page">
      <div className="pi-container">
        <div className="pi-header">
          <div className="pi-header-left">
            <div className="pi-label">
              <FileText size={14} />
              Proforma Invoice Module
            </div>
            <h1 className="pi-title">Proforma Invoices</h1>
            <p className="pi-subtitle">
              Manage preliminary invoices before final billing. Send to clients for approval, then convert to final invoice.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleExportCsv}
              className="pi-btn"
            >
              <FileSpreadsheet size={16} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => navigate('/proforma-invoices/create')}
              className="pi-btn pi-btn-primary"
            >
              <Plus size={16} />
              Create Proforma
            </button>
          </div>
        </div>

        <div className="pi-stats-row">
          <div className="pi-stat-card">
            <div className="pi-stat-label">Draft</div>
            <div className="pi-stat-value">{stats.draft}</div>
          </div>
          <div className="pi-stat-card">
            <div className="pi-stat-label">Sent</div>
            <div className="pi-stat-value">{stats.sent}</div>
          </div>
          <div className="pi-stat-card">
            <div className="pi-stat-label">Accepted</div>
            <div className="pi-stat-value">{stats.accepted}</div>
          </div>
          <div className="pi-stat-card">
            <div className="pi-stat-label">Total Value</div>
            <div className="pi-stat-value">{formatCurrency(stats.total)}</div>
          </div>
        </div>

        <div className="pi-filters-card">
          <div className="pi-filters-row">
            <div className="pi-filter-block">
              <span className="pi-filter-block-title">Search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="PI number, notes..."
                className="pi-input"
              />
            </div>
            <div className="pi-filter-block">
              <span className="pi-filter-block-title">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ProformaStatus | '')}
                className="pi-select"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="pi-filter-block">
              <span className="pi-filter-block-title">Client</span>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="pi-select"
              >
                <option value="">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.client_name || client.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="pi-filter-block">
              <span className="pi-filter-block-title">Date From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pi-input"
              />
            </div>
            <div className="pi-filter-block">
              <span className="pi-filter-block-title">Date To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="pi-input"
              />
            </div>
            <div className="pi-filter-block">
              <span className="pi-filter-block-title">Min Amount</span>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0"
                className="pi-input"
              />
            </div>
            <div className="pi-filter-block">
              <span className="pi-filter-block-title">Max Amount</span>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="0"
                className="pi-input"
              />
            </div>
            <div className="pi-filter-block">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setClientFilter('');
                  setDateFrom('');
                  setDateTo('');
                  setMinAmount('');
                  setMaxAmount('');
                  setPage(1);
                }}
                className="pi-action-btn"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="pi-bulk-actions">
            <span className="pi-bulk-actions-text">{selectedIds.size} selected</span>
            <button type="button" onClick={handleBulkSend} className="pi-bulk-btn">
              <Send size={12} />
              Send
            </button>
            <button type="button" onClick={handleBulkDelete} className="pi-bulk-btn">
              <Trash2 size={12} />
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="pi-bulk-btn"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="pi-table-card">
          <table className="pi-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    className="pi-checkbox"
                    checked={selectedIds.size === proformas?.length && proformas?.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th>Proforma #</th>
                <th>Client</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>GST</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="pi-loading">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && (proformas?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={9} className="pi-empty">
                    <FileText className="pi-empty-icon" />
                    <div>No proforma invoices found</div>
                  </td>
                </tr>
              )}
              {!isLoading &&
                proformas?.map((proforma) => (
                  <tr key={proforma.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="pi-checkbox"
                        checked={selectedIds.has(proforma.id!)}
                        onChange={(e) => handleSelectOne(proforma.id!, e.target.checked)}
                      />
                    </td>
                    <td>
                      <span className="pi-number">{proforma.pi_number ?? proforma.id?.slice(0, 8)}</span>
                    </td>
                    <td>{proforma.client?.name ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="pi-amount">{formatCurrency(proforma.subtotal)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="pi-amount">
                        {formatCurrency(proforma.cgst + proforma.sgst + proforma.igst)}
                      </span>
                    </td>
                    <td>
                      <span className={`pi-badge pi-badge-${statusColors[proforma.status]}`}>
                        {statusLabels[proforma.status]}
                      </span>
                    </td>
                    <td className="pi-date">
                      {proforma.valid_until ? formatDate(proforma.valid_until) : '—'}
                    </td>
                    <td className="pi-date">
                      {proforma.created_at ? formatDate(proforma.created_at) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>{renderActions(proforma)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="pi-pagination">
          <div className="pi-pagination-info">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, proformas?.length || 0)} of {proformas?.length || 0} proforma invoices
          </div>
          <div className="pi-pagination-controls">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="pi-page-btn"
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--pi-text-secondary)', minWidth: '40px', textAlign: 'center' }}>
              {page}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="pi-page-btn"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}