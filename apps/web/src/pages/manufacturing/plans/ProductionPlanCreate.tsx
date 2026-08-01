import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { ArrowLeft, Loader2, Save, AlertCircle } from 'lucide-react';
import {
  useDemandRequirementsQuery,
  useCreateProductionPlanMutation
} from '../../../features/manufacturing';

type ProductionPlanCreateProps = {
  onCancel: () => void;
  onSuccess: () => void;
};

export default function ProductionPlanCreate({ onCancel, onSuccess }: ProductionPlanCreateProps) {
  const { organisation, user } = useAuth();

  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // Default to a 1-week horizon
    return d.toISOString().split('T')[0];
  });
  const [remarks, setRemarks] = useState('');

  // Selected row tracking
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  // User customized planned quantities
  const [plannedQuantities, setPlannedQuantities] = useState<Record<string, number>>({});

  const { data: demandItems = [], isLoading } = useDemandRequirementsQuery(organisation?.id);

  // Initialize selections and custom planned quantities when demand items load
  useEffect(() => {
    if (demandItems.length > 0) {
      const initialIds = new Set<string>();
      const initialQty: Record<string, number> = {};

      demandItems.forEach(item => {
        if (item.net_to_produce > 0) {
          initialIds.add(item.product_id);
        }
        initialQty[item.product_id] = item.net_to_produce;
      });

      setSelectedProductIds(initialIds);
      setPlannedQuantities(initialQty);
    }
  }, [demandItems]);

  const toggleSelectProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      const copy = new Set(prev);
      if (copy.has(productId)) {
        copy.delete(productId);
      } else {
        copy.add(productId);
      }
      return copy;
    });
  };

  const handleQtyChange = (productId: string, val: number) => {
    setPlannedQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, val)
    }));
  };

  const createPlanMutation = useCreateProductionPlanMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductIds.size === 0) {
      alert('Please select at least one product line to include in this plan');
      return;
    }

    const planItems = demandItems
      .filter(item => selectedProductIds.has(item.product_id))
      .map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        bom_id: item.bom_id,
        demand_qty: item.demand_qty,
        current_fg_stock: item.current_fg_stock,
        wip_qty: item.wip_qty,
        net_to_produce: item.net_to_produce,
        planned_qty: plannedQuantities[item.product_id] ?? item.net_to_produce,
        linked_sales_orders: item.linked_sales_orders,
        status: 'pending' as const,
        organisation_id: organisation?.id || ''
      }));

    createPlanMutation.mutate({
      plan: {
        plan_period_start: startDate,
        plan_period_end: endDate,
        remarks: remarks || undefined,
        status: 'draft',
        organisation_id: organisation?.id || ''
      },
      items: planItems,
      orgId: organisation?.id || '',
      userId: user?.id || ''
    }, {
      onSuccess: () => {
        onSuccess();
      }
    });
  };

  const inputClass = "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none";

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
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Create Production Plan (MRP Netting)</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Consolidate open customer orders and compute net shop floor requirements</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Core settings */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>Plan Horizon</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Horizon Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Horizon End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>
        </div>

        {/* Netting Spreadsheet */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            MRP Inventory Netting Worksheet
          </h3>

          {isLoading ? (
            <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '8px' }}>
              <Loader2 className="animate-spin text-zinc-400" size={16} />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Aggregating customer order demands and netting stocks...</span>
            </div>
          ) : demandItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              No open customer sales orders found. Demand is fully covered by existing Finished Goods stocks!
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 12px', width: '30px' }}></th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Finished Good Product</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right' }}>Open SO Demand</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right' }}>FG Warehouse Stock</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right' }}>Active WIP</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right', color: '#185FA5' }}>Net To Produce</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right', width: '120px' }}>Planned Qty</th>
                </tr>
              </thead>
              <tbody>
                {demandItems.map(item => {
                  const isChecked = selectedProductIds.has(item.product_id);
                  const isSuggested = item.net_to_produce > 0;
                  const planned = plannedQuantities[item.product_id] ?? item.net_to_produce;

                  return (
                    <tr key={item.product_id} style={{ borderBottom: '1px solid #f3f4f6', opacity: isSuggested ? 1 : 0.6 }} className="hover:bg-zinc-50">
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectProduct(item.product_id)}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111827' }}>
                        {item.product_name}
                        {!item.bom_id && (
                          <span style={{ display: 'block', fontSize: '9px', color: '#ef4444', fontWeight: 600 }}>Missing BOM definition!</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{item.demand_qty}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280' }}>{item.current_fg_stock}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280' }}>{item.wip_qty}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#185FA5' }}>{item.net_to_produce}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={planned}
                          onChange={e => handleQtyChange(item.product_id, parseFloat(e.target.value) || 0)}
                          disabled={!isChecked}
                          className={inputClass}
                          style={{ height: '24px', textAlign: 'right' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Planning Notes / Remarks</label>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            className={inputClass}
            placeholder="Document notes regarding machine load, raw material constraint, or customer delivery targets..."
            rows={3}
            style={{ resize: 'none' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '6px 16px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '12px', color: '#374151', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createPlanMutation.isPending || selectedProductIds.size === 0}
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
              cursor: createPlanMutation.isPending || selectedProductIds.size === 0 ? 'not-allowed' : 'pointer',
              opacity: createPlanMutation.isPending || selectedProductIds.size === 0 ? 0.7 : 1
            }}
          >
            <Save size={14} /> {createPlanMutation.isPending ? 'Generating...' : 'Save Demand Plan'}
          </button>
        </div>
      </form>
    </div>
  );
}
