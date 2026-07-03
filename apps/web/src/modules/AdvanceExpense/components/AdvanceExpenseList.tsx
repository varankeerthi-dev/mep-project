import React, { useState, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAdvanceExpenses, useAeKpis } from '../hooks/useAdvanceExpense';
import { useDeleteAdvanceExpense, useSubmitForApproval, useMarkAsPaid } from '../hooks/useAdvanceExpense';
import { StatusBadge } from './StatusBadge';
import { KpiCards } from './KpiCards';
import type { AdvanceExpense, AeFilters, AeType, AeStatus } from '../types';

const TYPE_LABELS: Record<string, string> = {
  ADVANCE: 'Advance',
  EXPENSE: 'Expense',
  REIMBURSEMENT: 'Reimbursement',
};

const TABLE_HEADER_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  borderBottom: '1px solid #e4e4e7',
  background: '#fafafa',
};

const CELL_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '12px',
  color: '#18181b',
  borderBottom: '1px solid #f0f0f0',
};

interface Props {
  typeFilter?: AeType;
  onCreate: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

export const AdvanceExpenseList: React.FC<Props> = ({ typeFilter, onCreate, onView, onEdit }) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const [filters, setFilters] = useState<AeFilters>({ type: typeFilter || 'ALL' });
  const [search, setSearch] = useState('');

  const { data: records = [], isLoading } = useAdvanceExpenses(orgId, { ...filters, type: typeFilter || filters.type });
  const { data: kpis } = useAeKpis(orgId);
  const deleteMutation = useDeleteAdvanceExpense();
  const submitMutation = useSubmitForApproval();
 const paidMutation = useMarkAsPaid();

  const filtered = useMemo(() => {
    if (!search) return records;
    const q = search.toLowerCase();
    return records.filter(
      (r) =>
        r.transaction_no?.toLowerCase().includes(q) ||
        r.employee_name?.toLowerCase().includes(q) ||
        r.category_name?.toLowerCase().includes(q) ||
        r.project_name?.toLowerCase().includes(q) ||
        r.narration?.toLowerCase().includes(q)
    );
  }, [records, search]);

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this record? It will be soft-deleted and can be restored within 30 days.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (id: string) => {
    submitMutation.mutate(id);
  };

  const handlePaid = (id: string) => {
    if (window.confirm('Mark this as paid?')) {
      paidMutation.mutate(id);
    }
  };

  return (
    <div style={{ padding: '16px 24px' }}>
      {kpis && <KpiCards data={kpis} />}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <input
          placeholder="Search transaction no, employee, category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            outline: 'none',
          }}
        />
        <select
          value={filters.status || 'ALL'}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as AeStatus | 'ALL' })}
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            outline: 'none',
            background: '#fff',
          }}
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TABLE_HEADER_STYLE}>TXN No.</th>
              <th style={TABLE_HEADER_STYLE}>Type</th>
              <th style={TABLE_HEADER_STYLE}>Employee</th>
              <th style={TABLE_HEADER_STYLE}>Project</th>
              <th style={TABLE_HEADER_STYLE}>Category</th>
              <th style={{ ...TABLE_HEADER_STYLE, textAlign: 'right' }}>Amount</th>
              <th style={TABLE_HEADER_STYLE}>Status</th>
              <th style={TABLE_HEADER_STYLE}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} style={{ ...CELL_STYLE, textAlign: 'center', color: '#71717a' }}>Loading...</td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...CELL_STYLE, textAlign: 'center', color: '#71717a' }}>No records found</td>
              </tr>
            )}
            {filtered.map((r: AdvanceExpense) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => onView(r.id)}>
                <td style={CELL_STYLE}>{r.transaction_no || '-'}</td>
                <td style={CELL_STYLE}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: r.type === 'ADVANCE' ? '#DBEAFE' : r.type === 'EXPENSE' ? '#FEF3C7' : '#D1FAE5',
                    color: r.type === 'ADVANCE' ? '#1D4ED8' : r.type === 'EXPENSE' ? '#B45309' : '#047857',
                  }}>
                    {TYPE_LABELS[r.type] || r.type}
                  </span>
                </td>
                <td style={CELL_STYLE}>{r.employee_name || '-'}</td>
                <td style={CELL_STYLE}>{r.project_name || '-'}</td>
                <td style={CELL_STYLE}>{r.category_name || '-'}</td>
                <td style={{ ...CELL_STYLE, textAlign: 'right', fontWeight: 600 }}>
                  ₹{Number(r.amount).toLocaleString('en-IN')}
                </td>
                <td style={CELL_STYLE}><StatusBadge status={r.status} /></td>
                <td style={CELL_STYLE}>
                  <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                    {r.status === 'DRAFT' && (
                      <>
                        <ActionBtn label="Edit" onClick={() => onEdit(r.id)} />
                        <ActionBtn label="Submit" onClick={() => handleSubmit(r.id)} />
                        <ActionBtn label="Delete" onClick={() => handleDelete(r.id)} color="#EF4444" />
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <ActionBtn label="Mark Paid" onClick={() => handlePaid(r.id)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ActionBtn: React.FC<{ label: string; onClick: () => void; color?: string }> = ({ label, onClick, color }) => (
  <button
    onClick={onClick}
    style={{
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: 600,
      color: color || '#185FA5',
      background: '#fff',
      border: `1px solid ${color || '#185FA5'}`,
      borderRadius: '4px',
      cursor: 'pointer',
    }}
  >
    {label}
  </button>
);
