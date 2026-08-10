import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../../supabase';
import { Button } from '../../../components/ui/button';
import {
  useGoodsReceiptNoteDetailQuery,
  useGRNItemsQuery,
  useConfirmGRNAcceptanceMutation
} from '../../../features/manufacturing';

type GRNDetailProps = {
  grnId: string;
  onCancel: () => void;
};

export default function GRNDetail({ grnId, onCancel }: GRNDetailProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();

  const [acceptedQuantities, setAcceptedQuantities] = useState<Record<string, number>>({});
  const [rejectedQuantities, setRejectedQuantities] = useState<Record<string, number>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  // Queries
  const { data: grn, isLoading: grnLoading } = useGoodsReceiptNoteDetailQuery(grnId);
  const { data: items = [], isLoading: itemsLoading } = useGRNItemsQuery(grnId);

  // Pre-fill accepted quantities to match received quantities initially
  useEffect(() => {
    if (items.length > 0) {
      const initialAccepted: Record<string, number> = {};
      const initialRejected: Record<string, number> = {};
      items.forEach(item => {
        initialAccepted[item.id!] = item.received_qty;
        initialRejected[item.id!] = 0;
      });
      setAcceptedQuantities(initialAccepted);
      setRejectedQuantities(initialRejected);
    }
  }, [items]);

  const confirmMutation = useConfirmGRNAcceptanceMutation();

  const handleQtyChange = (itemId: string, field: 'accepted' | 'rejected', val: number) => {
    const value = Math.max(0, val);
    if (field === 'accepted') {
      setAcceptedQuantities(prev => ({ ...prev, [itemId]: value }));
    } else {
      setRejectedQuantities(prev => ({ ...prev, [itemId]: value }));
    }
  };

  const handleConfirmGRN = async () => {
    setLocalError(null);
    if (!organisation?.id || !user?.id) return;

    // 1. Validation check
    for (const item of items) {
      const accepted = acceptedQuantities[item.id!] ?? item.received_qty;
      const rejected = rejectedQuantities[item.id!] ?? 0;
      const total = accepted + rejected;

      if (total !== item.received_qty) {
        setLocalError(`Invalid quantities for ${item.materials?.name}! Accepted (${accepted}) + Rejected (${rejected}) must equal received quantity (${item.received_qty})`);
        return;
      }
    }

    // 2. First update item accepted/rejected values in database
    try {
      for (const item of items) {
        const accepted = acceptedQuantities[item.id!] ?? item.received_qty;
        const rejected = rejectedQuantities[item.id!] ?? 0;
        
        const { error } = await supabase
          .from('grn_items')
          .update({
            accepted_qty: accepted,
            rejected_qty: rejected,
            status: 'accepted'
          })
          .eq('id', item.id);
        
        if (error) throw error;
      }

      // 3. Confirm GRN transaction to commit stock additions to Main Store
      confirmMutation.mutate({
        grnId,
        orgId: organisation.id,
        userId: user.id,
        userName: user.name || user.email || 'Unknown'
      }, {
        onSuccess: () => {
          onCancel();
        }
      });

    } catch (err: any) {
      setLocalError(err.message || 'Failed to update GRN checklist items');
    }
  };

  if (grnLoading || itemsLoading) {
    return (
      <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '8px' }}>
        <Loader2 className="animate-spin text-zinc-400" size={24} />
        <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading GRN details...</span>
      </div>
    );
  }

  if (!grn) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
        Goods Receipt Note not found.
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    qc_pending: 'bg-amber-50 text-amber-700 border-amber-200',
    qc_passed: 'bg-green-50 text-green-700 border-green-200 border-green-200',
    accepted: 'bg-green-50 text-green-700 border-green-200'
  };

  const inputStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '12px',
    height: '28px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    background: '#fff',
    color: '#111827',
    outline: 'none',
    width: '80px',
    textAlign: 'right'
  };

  return (
    <div style={{ minHeight: '100%', background: '#fafafa', paddingBottom: '40px' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <Button variant="secondary" size="icon-sm" onClick={onCancel} aria-label="Back">
          <ArrowLeft size={14} />
        </Button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>GRN {grn.grn_no}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusColors[grn.status] || ''}`}>
              {grn.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Vendor: {grn.vendor_name} | Received date: {grn.receipt_date}</span>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Error Alert */}
        {(localError || confirmMutation.error) && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 500 }}>
              {localError || (confirmMutation.error as any).message}
            </span>
          </div>
        )}

        {/* GRN details card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', fontSize: '11px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>Receipt Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span style={{ color: '#6b7280', display: 'block' }}>Challan Number</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>{grn.challan_number || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280', display: 'block' }}>Vehicle Number</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>{grn.vehicle_number || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280', display: 'block' }}>Invoice Number</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>{grn.invoice_number || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280', display: 'block' }}>Remarks</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>{grn.remarks || '—'}</span>
            </div>
          </div>
        </div>

        {/* Checklist Verification */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            Goods Verification Checklist
          </h3>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563' }}>Material Name</th>
                <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563' }}>Batch No</th>
                <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563', textAlign: 'right' }}>Received Qty</th>
                <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563', textAlign: 'right', width: '100px' }}>Accepted Qty</th>
                <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563', textAlign: 'right', width: '100px' }}>Rejected Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const received = item.received_qty;
                const accepted = acceptedQuantities[item.id!] ?? item.accepted_qty ?? received;
                const rejected = rejectedQuantities[item.id!] ?? item.rejected_qty ?? 0;

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>
                      {item.materials?.name}
                      <span style={{ display: 'block', fontSize: '9px', color: '#9ca3af' }}>Unit: {item.unit}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#4b5563' }}>{item.batch_no || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>{received} {item.unit}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {grn.status === 'accepted' ? (
                        <span style={{ fontWeight: 600, color: '#10b981' }}>{item.accepted_qty} {item.unit}</span>
                      ) : (
                        <input
                          type="number"
                          value={accepted}
                          onChange={e => handleQtyChange(item.id!, 'accepted', parseFloat(e.target.value) || 0)}
                          style={inputStyle}
                        />
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {grn.status === 'accepted' ? (
                        <span style={{ fontWeight: 600, color: '#ef4444' }}>{item.rejected_qty} {item.unit}</span>
                      ) : (
                        <input
                          type="number"
                          value={rejected}
                          onChange={e => handleQtyChange(item.id!, 'rejected', parseFloat(e.target.value) || 0)}
                          style={inputStyle}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        {grn.status !== 'accepted' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button onClick={handleConfirmGRN} disabled={confirmMutation.isPending} loading={confirmMutation.isPending} loadingText="Accepting..." leftIcon={<Save size={14} />}>
              Verify & Inward Goods
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
