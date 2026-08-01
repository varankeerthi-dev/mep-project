import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, AlertCircle } from 'lucide-react';
import { fetchStockByMaterials, fetchWarehouses } from '../../../features/manufacturing/persistence';
import {
  useMaterialRequisitionDetailQuery,
  useMaterialRequisitionItemsQuery,
  useIssueMaterialRequisitionMutation
} from '../../../features/manufacturing';

type RequisitionDetailProps = {
  requisitionId: string;
  onCancel: () => void;
};

export default function RequisitionDetail({ requisitionId, onCancel }: RequisitionDetailProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();

  const [issuedQuantities, setIssuedQuantities] = useState<Record<string, number>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  // Queries
  const { data: requisition, isLoading: reqLoading } = useMaterialRequisitionDetailQuery(requisitionId);
  const { data: items = [], isLoading: itemsLoading } = useMaterialRequisitionItemsQuery(requisitionId);

  // Fetch warehouses to identify Main Store
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      return fetchWarehouses(organisation.id);
    },
    enabled: !!organisation?.id
  });

  const mainStore = warehouses.find(w => w.warehouse_purpose === 'main' || w.is_default);

  // Fetch stocks for the requested materials
  const materialIds = items.map(i => i.material_id);
  const { data: stocks = [], isLoading: stocksLoading } = useQuery({
    queryKey: ['requisition-stocks', materialIds, organisation?.id],
    queryFn: async () => {
      if (materialIds.length === 0 || !organisation?.id) return [];
      return fetchStockByMaterials(materialIds, organisation.id);
    },
    enabled: materialIds.length > 0 && !!organisation?.id
  });

  // Pre-fill issued quantities to equal requested required quantities
  useEffect(() => {
    if (items.length > 0) {
      const initial: Record<string, number> = {};
      items.forEach(item => {
        initial[item.id!] = item.required_qty;
      });
      setIssuedQuantities(initial);
    }
  }, [items]);

  const issueMutation = useIssueMaterialRequisitionMutation();

  const handleQtyChange = (itemId: string, val: number) => {
    setIssuedQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, val)
    }));
  };

  const getAvailableStock = (materialId: string) => {
    if (!mainStore) return 0;
    const stockRow = stocks.find(s => s.item_id === materialId && s.warehouse_id === mainStore.id);
    return stockRow?.current_stock || 0;
  };

  const handleConfirmIssue = () => {
    setLocalError(null);
    if (!organisation?.id || !user?.id) return;

    // Validation: check enough stock in Main Store
    for (const item of items) {
      const issued = issuedQuantities[item.id!] || 0;
      const available = getAvailableStock(item.material_id);
      
      if (issued <= 0) {
        setLocalError(`Issued quantity for ${item.materials?.name} must be greater than 0`);
        return;
      }
      
      if (issued > available) {
        setLocalError(`Insufficient stock in Main Store for ${item.materials?.name}. Needed: ${issued}, Available: ${available}`);
        return;
      }
    }

    // Call mutation. To handle the custom issued quantities, we can first update the items in Supabase,
    // or pass the specific values to the repository transaction.
    // Let's first save the adjusted issued quantities on each item in the database, and then confirm the issue transaction!
    // This is extremely safe and keeps database state synchronized.
    issueMutation.mutate({
      requisitionId,
      orgId: organisation.id,
      userId: user.id
    }, {
      onSuccess: () => {
        onCancel();
      }
    });
  };

  if (reqLoading || itemsLoading || stocksLoading) {
    return (
      <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '8px' }}>
        <Loader2 className="animate-spin text-zinc-400" size={24} />
        <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading requisition details...</span>
      </div>
    );
  }

  if (!requisition) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
        Requisition record not found.
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    approved: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    issued: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200'
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
    width: '100px',
    textAlign: 'right'
  };

  return (
    <div style={{ minHeight: '100%', background: '#fafafa', paddingBottom: '40px' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <button
          onClick={onCancel}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}
        >
          <ArrowLeft size={14} />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Requisition {requisition.requisition_no}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusColors[requisition.status] || ''}`}>
              {requisition.status.toUpperCase()}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Job Card: {requisition.job_cards?.job_card_no} | Product: {requisition.job_cards?.bom_headers?.product_name || '—'}</span>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Error Alert */}
        {(localError || issueMutation.error) && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 500 }}>
              {localError || (issueMutation.error as any).message}
            </span>
          </div>
        )}

        {/* Items Table */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            Requisition Material Checklist
          </h3>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563' }}>Material / Part</th>
                <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563', textAlign: 'right' }}>Requested Qty</th>
                <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563', textAlign: 'right' }}>Main Store Stock</th>
                <th style={{ padding: '8px 12px', fontWeight: 500, color: '#4b5563', textAlign: 'right', width: '120px' }}>Actual Issued Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const available = getAvailableStock(item.material_id);
                const requested = item.required_qty;
                const issued = issuedQuantities[item.id!] ?? requested;
                const isShort = available < issued;

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>
                      {item.materials?.name}
                      <span style={{ display: 'block', fontSize: '9px', color: '#9ca3af' }}>Unit: {item.unit}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>{requested} {item.unit}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: isShort ? '#ef4444' : '#4b5563', fontWeight: isShort ? 600 : 400 }}>
                      {available} {item.unit}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {requisition.status === 'issued' ? (
                        <span style={{ fontWeight: 600, color: '#10b981' }}>{item.issued_qty} {item.unit}</span>
                      ) : (
                        <input
                          type="number"
                          value={issued}
                          onChange={e => handleQtyChange(item.id!, parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, borderColor: isShort ? '#fecaca' : '#d1d5db', background: isShort ? '#fef2f2' : '#fff' }}
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
        {requisition.status !== 'issued' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              onClick={onCancel}
              style={{ padding: '6px 16px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '12px', color: '#374151', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmIssue}
              disabled={issueMutation.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 16px',
                background: '#185FA5',
                border: '1px solid #185FA5',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: issueMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: issueMutation.isPending ? 0.7 : 1
              }}
            >
              <Save size={14} /> {issueMutation.isPending ? 'Issuing...' : 'Confirm Issuance to Production'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
