import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { StatusBadge } from './StatusBadge';
import { useDeleteAdvanceExpense, useSubmitForApproval, useMarkAsPaid } from '../hooks/useAdvanceExpense';
import type { AdvanceExpense } from '../types';

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  padding: '10px 0',
  borderBottom: '1px solid #f0f0f0',
};

const LBL_STYLE: React.CSSProperties = {
  width: '140px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  flexShrink: 0,
};

const VAL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: '#18181b',
};

interface Props {
  id: string;
  onClose: () => void;
  onEdit: (id: string) => void;
}

export const AdvanceExpenseDetail: React.FC<Props> = ({ id, onClose, onEdit }) => {
  const [record, setRecord] = useState<AdvanceExpense | null>(null);
  const deleteMutation = useDeleteAdvanceExpense();
  const submitMutation = useSubmitForApproval();
  const paidMutation = useMarkAsPaid();

  useEffect(() => {
    supabase.from('advances_expenses').select('*').eq('id', id).single().then(({ data }) => {
      setRecord(data);
    });
  }, [id]);

  if (!record) return <div style={{ padding: 24, color: '#71717a', fontSize: 12 }}>Loading...</div>;

  const handleDelete = () => {
    if (window.confirm('Delete this record?')) {
      deleteMutation.mutate(id, { onSuccess: onClose });
    }
  };

  const handleSubmit = () => {
    submitMutation.mutate(id, { onSuccess: onClose });
  };

  const handlePaid = () => {
    if (window.confirm('Mark as paid?')) {
      paidMutation.mutate(id);
    }
  };

  const fields = [
    { label: 'Transaction No', value: record.transaction_no },
    { label: 'Type', value: record.type },
    { label: 'Request Type', value: record.request_type },
    { label: 'Employee', value: record.employee_name },
    { label: 'Project', value: record.project_name },
    { label: 'Category', value: record.category_name },
    { label: 'Amount', value: `₹${Number(record.amount).toLocaleString('en-IN')}` },
    { label: 'Payout Method', value: record.payout_method },
    { label: 'Status', value: <StatusBadge status={record.status} /> },
    { label: 'Narration', value: record.narration },
    { label: 'Remarks', value: record.remarks },
    { label: 'Created By', value: record.created_by_name },
    { label: 'Created At', value: new Date(record.created_at).toLocaleDateString() },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '600px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#18181b' }}>Detail</h2>
        <button onClick={onClose} style={{
          padding: '6px 14px', fontSize: '12px', fontWeight: 600,
          color: '#374151', background: '#fff', border: '1px solid #d1d5db',
          borderRadius: '6px', cursor: 'pointer',
        }}>Close</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '16px 20px' }}>
        {fields.map((f) => (
          <div key={f.label} style={ROW_STYLE}>
            <div style={LBL_STYLE}>{f.label}</div>
            <div style={VAL_STYLE}>{f.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
        {record.status === 'DRAFT' && (
          <>
            <ActionBtn label="Edit" onClick={() => onEdit(id)} />
            <ActionBtn label="Submit" onClick={handleSubmit} color="#059669" />
            <ActionBtn label="Delete" onClick={handleDelete} color="#EF4444" />
          </>
        )}
        {record.status === 'APPROVED' && (
          <ActionBtn label="Mark Paid" onClick={handlePaid} />
        )}
      </div>
    </div>
  );
};

const ActionBtn: React.FC<{ label: string; onClick: () => void; color?: string }> = ({ label, onClick, color }) => (
  <button onClick={onClick} style={{
    padding: '8px 16px', fontSize: '12px', fontWeight: 600,
    color: color || '#185FA5', background: '#fff',
    border: `1px solid ${color || '#185FA5'}`, borderRadius: '6px', cursor: 'pointer',
  }}>{label}</button>
);
