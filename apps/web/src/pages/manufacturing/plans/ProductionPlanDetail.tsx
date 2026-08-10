import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Play, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../supabase';
import { Button } from '../../../components/ui/button';
import { fetchStockByMaterials, fetchWarehouses } from '../../../features/manufacturing/persistence';
import {
  useProductionPlanDetailQuery,
  useProductionPlanItemsQuery,
  useConvertPlanToJobCardsMutation
} from '../../../features/manufacturing';

type ProductionPlanDetailProps = {
  planId: string;
  onCancel: () => void;
};

interface MaterialRequirementSummary {
  material_id: string;
  material_name: string;
  required_qty: number;
  available_stock: number;
  unit: string;
}

export default function ProductionPlanDetail({ planId, onCancel }: ProductionPlanDetailProps) {
  const { organisation, user } = useAuth();
  
  // Selected items tracking for Job Card conversion
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Queries
  const { data: plan, isLoading: planLoading } = useProductionPlanDetailQuery(planId);
  const { data: items = [], isLoading: itemsLoading } = useProductionPlanItemsQuery(planId);

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      return fetchWarehouses(organisation.id);
    },
    enabled: !!organisation?.id
  });

  const mainStore = warehouses.find(w => w.warehouse_purpose === 'main' || w.is_default);

  // Fetch BOM items for selected products to calculate total material requirements
  const selectedPlanItems = items.filter(item => selectedItemIds.has(item.id!));
  const bomIds = selectedPlanItems.map(item => item.bom_id).filter(Boolean) as string[];

  const { data: bomItems = [], isLoading: bomItemsLoading } = useQuery({
    queryKey: ['plan-bom-items', bomIds],
    queryFn: async () => {
      if (bomIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('bom_items')
        .select(`
          bom_id,
          material_id,
          qty,
          unit,
          materials:material_id (
            name
          )
        `)
        .in('bom_id', bomIds);

      if (error) throw error;
      return data || [];
    },
    enabled: bomIds.length > 0
  });

  // Calculate raw material requirements for selected products
  const materialRequirements = React.useMemo(() => {
    const map: Record<string, { name: string; qty: number; unit: string }> = {};

    selectedPlanItems.forEach(planItem => {
      if (!planItem.bom_id) return;
      const productBomItems = bomItems.filter(bi => bi.bom_id === planItem.bom_id);
      
      productBomItems.forEach(bi => {
        if (!map[bi.material_id]) {
          map[bi.material_id] = {
            name: bi.materials?.name || 'Unknown',
            qty: 0,
            unit: bi.unit || 'Nos'
          };
        }
        map[bi.material_id].qty += bi.qty * (planItem.planned_qty || planItem.net_to_produce);
      });
    });

    return map;
  }, [selectedPlanItems, bomItems]);

  const ingredientIds = Object.keys(materialRequirements);

  // Fetch stocks for the aggregated ingredients
  const { data: stocks = [] } = useQuery({
    queryKey: ['plan-ingredients-stocks', ingredientIds, organisation?.id],
    queryFn: async () => {
      if (ingredientIds.length === 0 || !organisation?.id) return [];
      return fetchStockByMaterials(ingredientIds, organisation.id);
    },
    enabled: ingredientIds.length > 0 && !!organisation?.id
  });

  const materialSummaries = React.useMemo(() => {
    const list: MaterialRequirementSummary[] = [];

    Object.keys(materialRequirements).forEach(matId => {
      const req = materialRequirements[matId];
      const stockRow = mainStore ? stocks.find(s => s.item_id === matId && s.warehouse_id === mainStore.id) : null;
      
      list.push({
        material_id: matId,
        material_name: req.name,
        required_qty: req.qty,
        available_stock: stockRow?.current_stock || 0,
        unit: req.unit
      });
    });

    return list;
  }, [materialRequirements, stocks, mainStore]);

  const convertMutation = useConvertPlanToJobCardsMutation();

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) {
        copy.delete(id);
      } else {
        copy.add(id);
      }
      return copy;
    });
  };

  const handleBatchSchedule = () => {
    if (selectedItemIds.size === 0) return;
    if (!organisation?.id || !user?.id) return;

    // Warning check for raw material shortfalls
    const hasShortfalls = materialSummaries.some(m => m.available_stock < m.required_qty);
    if (hasShortfalls) {
      const proceed = window.confirm('Warning: Some raw material ingredients are short in the Main Store warehouse! Do you still want to schedule Job Cards?');
      if (!proceed) return;
    }

    convertMutation.mutate({
      planId,
      itemIds: Array.from(selectedItemIds),
      orgId: organisation.id,
      userId: user.id
    }, {
      onSuccess: () => {
        setSelectedItemIds(new Set());
      }
    });
  };

  if (planLoading || itemsLoading) {
    return (
      <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '8px' }}>
        <Loader2 className="animate-spin text-zinc-400" size={24} />
        <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading plan details...</span>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
        Production plan not found.
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    approved: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-green-50 text-green-700 border-green-200'
  };

  const itemStatusColors: Record<string, string> = {
    pending: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    in_production: 'bg-amber-50 text-amber-700 border-amber-200',
    fulfilled: 'bg-green-50 text-green-700 border-green-200'
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
            <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Plan {plan.plan_no}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[plan.status] || ''}`}>
              {plan.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Horizon: {plan.plan_period_start} to {plan.plan_period_end}</span>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '24px' }}>
        
        {/* Left Side: Plan items & Net requirements list */}
        <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>Required Product Quantities</h3>
              {selectedItemIds.size > 0 && (
                <Button size="xs" onClick={handleBatchSchedule} disabled={convertMutation.isPending} loading={convertMutation.isPending} loadingText="Scheduling..." leftIcon={<Play size={12} />}>
                  {`Schedule selected (${selectedItemIds.size})`}
                </Button>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 12px', width: '30px' }}></th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Product</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right' }}>SO Net Demand</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right' }}>Planned Qty</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'center', width: '100px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isChecked = selectedItemIds.has(item.id!);
                  const isPending = item.status === 'pending';

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectItem(item.id!)}
                          disabled={!isPending}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111827' }}>
                        {item.product_name}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563' }}>{item.net_to_produce} {item.materials?.unit}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{item.planned_qty} {item.materials?.unit}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${itemStatusColors[item.status] || ''}`}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Raw material ingredient checks */}
        <div style={{ flex: '1 1 350px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            MRP Ingredients Check
          </h3>

          {bomItemsLoading ? (
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}><Loader2 size={14} className="animate-spin text-zinc-400" /></div>
          ) : selectedItemIds.size === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              Select one or more pending production lines on the left to analyze raw material ingredient availability in the Main Store.
            </div>
          ) : (
            <div className="space-y-4">
              <span style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '8px' }}>
                Requirements checklist for selected products:
              </span>
              <div className="space-y-3" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {materialSummaries.map(m => {
                  const isShort = m.available_stock < m.required_qty;
                  return (
                    <div key={m.material_id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid #f9fafb', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: '#374151' }}>{m.material_name}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                        <span style={{ color: '#6b7280' }}>Needed: <b>{m.required_qty.toFixed(1)} {m.unit}</b></span>
                        {isShort ? (
                          <span style={{ color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <AlertTriangle size={10} /> Short: {(m.required_qty - m.available_stock).toFixed(1)} {m.unit}
                          </span>
                        ) : (
                          <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <CheckCircle size={10} /> Available: {m.available_stock} {m.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
