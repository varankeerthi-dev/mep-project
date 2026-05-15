import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, X, ChevronLeft, ChevronRight, Eye, Pencil, Trash2, FileText } from 'lucide-react';
import { useCreditNotes, useDeleteCreditNote } from '../../credit-notes/hooks';
import { CNStatusBadge } from '../../credit-notes/components/StatusBadge';
import { formatCurrency, formatDate } from '../../credit-notes/ui-utils';
import { CN_TYPE_LABELS } from '../../credit-notes/schemas';
import type { CreditNote } from '../../credit-notes/types';
import { useAuth } from '../../App';

const PAGE_SIZE = 25;

const styles = `
  .cnl-page { padding: 24px 32px; max-width: 1400px; margin: 0 auto; }
  .cnl-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .cnl-title { font-size: 22px; font-weight: 700; color: #171717; margin: 0; }
  .cnl-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: 6px; background: #2563eb; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
  .cnl-btn-primary:hover { background: #1d4ed8; }
  .cnl-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .cnl-search-box { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #d4d4d4; border-radius: 6px; background: #fff; min-width: 240px; }
  .cnl-search-box input { border: none; outline: none; font-size: 13px; width: 100%; background: transparent; }
  .cnl-filter-select { padding: 6px 12px; border: 1px solid #d4d4d4; border-radius: 6px; font-size: 13px; background: #fff; cursor: pointer; }
  .cnl-date-input { padding: 6px 12px; border: 1px solid #d4d4d4; border-radius: 6px; font-size: 13px; background: #fff; }
  .cnl-btn-reset { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px solid #d4d4d4; border-radius: 6px; background: #fff; font-size: 12px; color: #525252; cursor: pointer; }
  .cnl-btn-reset:hover { background: #f5f5f5; }
  .cnl-table-card { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; background: #fff; }
  .cnl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cnl-table thead { background: #fafafa; }
  .cnl-table th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: #737373; border-bottom: 2px solid #e5e5e5; white-space: nowrap; }
  .cnl-table td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; color: #404040; }
  .cnl-table tbody tr { cursor: pointer; transition: background 0.1s; }
  .cnl-table tbody tr:hover { background: #f9fafb; }
  .cnl-actions-cell { display: flex; align-items: center; gap: 4px; }
  .cnl-action-btn { display: inline-flex; align-items: center; justify-content: center; padding: 4px; border: none; border-radius: 4px; background: transparent; cursor: pointer; color: #737373; }
  .cnl-action-btn:hover { background: #f3f4f6; color: #171717; }
  .cnl-action-btn.delete:hover { background: #fef2f2; color: #dc2626; }
  .cnl-pagination { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-top: 1px solid #e5e5e5; background: #fafafa; }
  .cnl-pagination-info { font-size: 12px; color: #737373; }
  .cnl-pagination-buttons { display: flex; align-items: center; gap: 4px; }
  .cnl-page-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; padding: 0 8px; border: 1px solid #d4d4d4; border-radius: 6px; background: #fff; font-size: 12px; color: #525252; cursor: pointer; }
  .cnl-page-btn:hover { background: #f5f5f5; }
  .cnl-page-btn.active { background: #2563eb; border-color: #2563eb; color: #fff; }
  .cnl-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .cnl-empty { text-align: center; padding: 48px 24px; color: #a3a3a3; }
  .cnl-empty-icon { margin: 0 auto 12px; opacity: 0.4; }
  .cnl-empty-text { font-size: 14px; margin-bottom: 4px; color: #737373; }
  .cnl-empty-sub { font-size: 12px; }
  .cnl-loading { text-align: center; padding: 48px; color: #a3a3a3; font-size: 14px; }
`;

let stylesInjected = false;
function injectStyles() {
  if (typeof document !== 'undefined' && !stylesInjected) {
    const el = document.createElement('style');
    el.id = 'cnl-styles';
    el.textContent = styles;
    document.head.appendChild(el);
    stylesInjected = true;
  }
}

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

  useEffect(() => { injectStyles(); }, []);

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
    navigate(`/credit-notes/edit?id=${id}`);
  };

  const handleActionClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
  };

  const pageNumbers: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (currentPage > 3) pageNumbers.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pageNumbers.push(i);
    if (currentPage < totalPages - 2) pageNumbers.push('...');
    pageNumbers.push(totalPages);
  }

  if (isLoading) {
    return <div className="cnl-loading">Loading credit notes...</div>;
  }

  if (error) {
    return (
      <div className="cnl-page">
        <div style={{ textAlign: 'center', padding: '48px', color: '#dc2626' }}>
          Error loading credit notes: {(error as Error).message}
          <button onClick={() => refetch()} style={{ marginLeft: '12px', padding: '6px 12px' }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cnl-page">
      <div className="cnl-header">
        <h1 className="cnl-title">Credit Notes</h1>
        <button className="cnl-btn-primary" onClick={() => navigate('/credit-notes/create')}>
          <Plus size={16} />
          New Credit Note
        </button>
      </div>

      <div className="cnl-toolbar">
        <div className="cnl-search-box">
          <Search size={16} style={{ color: '#a3a3a3', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by CN#, client, reason..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setCurrentPage(1); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a3a3a3' }}>
              <X size={14} />
            </button>
          )}
        </div>

        <select className="cnl-filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
          <option value="All">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>

        <select className="cnl-filter-select" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}>
          <option value="All">All Types</option>
          {Object.entries(CN_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <input className="cnl-date-input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} />
        <input className="cnl-date-input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} />

        {hasActiveFilters && (
          <button className="cnl-btn-reset" onClick={resetFilters}>
            <X size={12} />
            Reset
          </button>
        )}
      </div>

      <div className="cnl-table-card">
        {paginatedData.length === 0 ? (
          <div className="cnl-empty">
            <div className="cnl-empty-icon">
              <FileText size={48} />
            </div>
            <div className="cnl-empty-text">
              {creditNotes.length === 0 ? 'No credit notes yet' : 'No matching credit notes'}
            </div>
            <div className="cnl-empty-sub">
              {creditNotes.length === 0 ? 'Click "New Credit Note" to create one' : 'Try adjusting your filters'}
            </div>
          </div>
        ) : (
          <>
            <table className="cnl-table">
              <thead>
                <tr>
                  <th>CN Number</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Taxable Amount</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th style={{ width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((cn) => {
                  const taxAmount = cn.cgst_amount + cn.sgst_amount + cn.igst_amount;
                  return (
                    <tr key={cn.id} onClick={() => handleRowClick(cn.id)}>
                      <td style={{ fontWeight: 600, color: '#171717' }}>{cn.cn_number}</td>
                      <td>{formatDate(cn.cn_date)}</td>
                      <td>{cn.client?.name ?? '—'}</td>
                      <td>{CN_TYPE_LABELS[cn.cn_type as keyof typeof CN_TYPE_LABELS] ?? cn.cn_type}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cn.taxable_amount)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#737373' }}>{formatCurrency(taxAmount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cn.total_amount)}</td>
                      <td><CNStatusBadge status={cn.approval_status} /></td>
                      <td>
                        <div className="cnl-actions-cell" onClick={(e) => { e.stopPropagation(); }}>
                          <button className="cnl-action-btn" title="View" onClick={() => handleRowClick(cn.id)}>
                            <Eye size={15} />
                          </button>
                          <button className="cnl-action-btn" title="Edit" onClick={() => navigate(`/credit-notes/edit?id=${cn.id}`)}>
                            <Pencil size={15} />
                          </button>
                          <button
                            className="cnl-action-btn delete"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(cn.id);
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="cnl-pagination">
                <div className="cnl-pagination-info">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredNotes.length)} of {filteredNotes.length}
                </div>
                <div className="cnl-pagination-buttons">
                  <button className="cnl-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft size={14} />
                  </button>
                  {pageNumbers.map((pn, idx) =>
                    pn === '...' ? (
                      <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#a3a3a3' }}>…</span>
                    ) : (
                      <button
                        key={pn}
                        className={`cnl-page-btn ${pn === currentPage ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pn)}
                      >
                        {pn}
                      </button>
                    )
                  )}
                  <button className="cnl-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>Delete Credit Note</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#525252' }}>
              Are you sure you want to delete this credit note? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
