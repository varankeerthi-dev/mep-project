import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, RefreshCw, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';


type JobCardDetailProps = {
  jobCardId: string;
  onNavigate: (path: string) => void;
};

type WarehouseInfo = {
  id: string;
  name: string;
  warehouse_code: string;
  warehouse_purpose: string;
  is_default: boolean;
};

type JobMaterial = {
  id: string;
  material_id: string;
  planned_qty: number;
  issued_qty: number;
  consumed_qty: number;
  wastage_qty: number;
  return_qty: number;
  status: string;
  warehouse_id: string | null;
  materials: { name: string; unit: string } | null;
};

export default function JobCardDetail({ jobCardId, onNavigate }: JobCardDetailProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [issueError, setIssueError] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  const { data: jobCard, isLoading } = useQuery({
    queryKey: ['job-card', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return null;
      const { data, error } = await supabase
        .from('job_cards')
        .select('*')
        .eq('id', jobCardId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!jobCardId
  });

  const { data: materials } = useQuery({
    queryKey: ['job-card-materials', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return [];
      const { data, error } = await supabase
        .from('job_card_materials')
        .select('*, materials(name, unit)')
        .eq('job_card_id', jobCardId);
      if (error) throw error;
      return (data || []) as JobMaterial[];
    },
    enabled: !!jobCardId
  });

  const materialIds = useMemo(() => {
    if (!materials) return [];
    return [...new Set(materials.map(m => m.material_id).filter(Boolean))];
  }, [materials]);

  const { data: stockByMaterial } = useQuery<Record<string, { warehouse_id: string; warehouse_name: string; warehouse_purpose: string; current_stock: number }[]>>({
    queryKey: ['job-card-stock', materialIds, organisation?.id],
    queryFn: async () => {
      if (!organisation?.id || materialIds.length === 0) return {};
      let stockRows: any[] = [];
      const { data: withOrg, error: err1 } = await supabase
        .from('item_stock')
        .select('item_id, company_variant_id, current_stock, warehouse_id')
        .eq('organisation_id', organisation.id)
        .in('item_id', materialIds);
      if (err1 || !withOrg || withOrg.length === 0) {
        const { data: withoutOrg } = await supabase
          .from('item_stock')
          .select('item_id, company_variant_id, current_stock, warehouse_id')
          .in('item_id', materialIds);
        stockRows = withoutOrg || [];
      } else {
        stockRows = withOrg || [];
      }
      const whIds = [...new Set(stockRows.map(r => r.warehouse_id).filter(Boolean))];
      let whMap: Record<string, string> = {};
      if (whIds.length > 0) {
        const { data: whRows } = await supabase.from('warehouses').select('id, name').in('id', whIds);
        for (const w of whRows || []) whMap[w.id] = w.name;
      }
      const map: Record<string, { warehouse_id: string; warehouse_name: string; warehouse_purpose: string; current_stock: number }[]> = {};
      for (const row of stockRows) {
        if (!map[row.item_id]) map[row.item_id] = [];
        map[row.item_id].push({
          warehouse_id: row.warehouse_id,
          warehouse_name: whMap[row.warehouse_id] || 'Store',
          warehouse_purpose: 'general',
          current_stock: row.current_stock || 0,
        });
      }
      return map;
    },
    enabled: !!organisation?.id && materialIds.length > 0
  });



  const totalStockByMaterial = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [matId, entries] of Object.entries(stockByMaterial || {})) {
      map[matId] = entries.reduce((sum, e) => sum + e.current_stock, 0);
    }
    return map;
  }, [stockByMaterial]);

  const { data: productionEntries } = useQuery({
    queryKey: ['production-entries', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return [];
      const { data, error } = await supabase
        .from('production_entries')
        .select('*')
        .eq('job_card_id', jobCardId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobCardId
  });

  const { data: warehouses } = useQuery({
    queryKey: ['manufacturing-warehouses', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      let whData: any[] = [];
      const { data: withPurpose, error: err1 } = await supabase
        .from('warehouses')
        .select('id, name, warehouse_code, warehouse_purpose, is_default')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true);
      if (err1) {
        const { data: withoutPurpose } = await supabase
          .from('warehouses')
          .select('id, name, warehouse_code, is_default')
          .eq('organisation_id', organisation.id)
          .eq('is_active', true);
        whData = (withoutPurpose || []).map((w: any) => ({ ...w, warehouse_purpose: w.is_default ? 'main' : 'general' }));
      } else {
        whData = withPurpose || [];
      }
      return whData as WarehouseInfo[];
    },
    enabled: !!organisation?.id
  });

  const whIds = useMemo(() => {
    if (!warehouses) return null;
    const mainStore = warehouses.find(w => w.warehouse_purpose === 'main' || w.is_default);
    const wip = warehouses.find(w => w.warehouse_purpose === 'wip');
    const fg = warehouses.find(w => w.warehouse_purpose === 'fg');
    const fallbackWip = wip || warehouses.find(w => w.id !== mainStore?.id);
    const fallbackFg = fg || warehouses.find(w => w.id !== mainStore?.id && w.id !== fallbackWip?.id);
    return { mainStore, wip: fallbackWip, fg: fallbackFg };
  }, [warehouses]);

  const mainStoreStockByMaterial = useMemo(() => {
    const map: Record<string, number> = {};
    if (!stockByMaterial || !whIds?.mainStore) return map;
    for (const [matId, entries] of Object.entries(stockByMaterial)) {
      const mainEntry = entries.find(e => e.warehouse_id === whIds.mainStore?.id);
      map[matId] = mainEntry ? mainEntry.current_stock : 0;
    }
    return map;
  }, [stockByMaterial, whIds]);

  const hasShortage = useMemo(() => {
    if (jobCard?.status !== 'draft' || !materials) return false;
    return materials.some(mat => (mainStoreStockByMaterial[mat.material_id] || 0) < mat.planned_qty);
  }, [jobCard?.status, materials, mainStoreStockByMaterial]);

  const issueMaterials = useMutation({
    mutationFn: async () => {
      if (!organisation?.id || !user?.id) throw new Error('Not authenticated');
      if (!whIds?.mainStore || !whIds?.wip) throw new Error('Required warehouses (Main Store / WIP) not found');

      setIssueError(null);

      const reservedMaterials = (materials || []).filter(m => m.status === 'reserved');
      if (reservedMaterials.length === 0) throw new Error('No reserved materials to issue');

      for (const mat of reservedMaterials) {
        let stockRows: any[] = [];
        const { data: withOrg, error: err1 } = await supabase
          .from('item_stock')
          .select('current_stock')
          .eq('item_id', mat.material_id)
          .eq('warehouse_id', whIds.mainStore.id)
          .eq('organisation_id', organisation.id);
        if (err1 || !withOrg || withOrg.length === 0) {
          const { data: withoutOrg } = await supabase
            .from('item_stock')
            .select('current_stock')
            .eq('item_id', mat.material_id)
            .eq('warehouse_id', whIds.mainStore.id);
          stockRows = withoutOrg || [];
        } else {
          stockRows = withOrg || [];
        }

        const available = (stockRows || []).reduce((sum, r) => sum + (r.current_stock || 0), 0);
        if (available < mat.planned_qty) {
          throw new Error(
            `Insufficient stock in Raw Materials Warehouse (Main Store) for ${mat.materials?.name || 'material'}: ` +
            `available ${available} ${mat.materials?.unit || ''}, needed ${mat.planned_qty} ${mat.materials?.unit || ''}`
          );
        }
      }

      const { data: outwardRecord, error: outwardErr } = await supabase
        .from('material_outward')
        .insert({
          outward_date: new Date().toISOString().split('T')[0],
          remarks: `Job Card ${jobCard?.job_card_no} — materials issued to production`,
          organisation_id: organisation.id
        })
        .select()
        .single();
      if (outwardErr) throw outwardErr;

      for (const mat of reservedMaterials) {
        const qty = mat.planned_qty;

        const { data: mainStock } = await supabase
          .from('item_stock')
          .select('id, current_stock')
          .eq('item_id', mat.material_id)
          .eq('warehouse_id', whIds.mainStore.id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (mainStock) {
          await supabase
            .from('item_stock')
            .update({ current_stock: mainStock.current_stock - qty })
            .eq('id', mainStock.id);
        }

        const { data: wipStock } = await supabase
          .from('item_stock')
          .select('id, current_stock')
          .eq('item_id', mat.material_id)
          .eq('warehouse_id', whIds.wip.id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (wipStock) {
          await supabase
            .from('item_stock')
            .update({ current_stock: wipStock.current_stock + qty })
            .eq('id', wipStock.id);
        } else {
          await supabase
            .from('item_stock')
            .insert({
              item_id: mat.material_id,
              warehouse_id: whIds.wip.id,
              organisation_id: organisation.id,
              current_stock: qty
            });
        }

        await supabase
          .from('material_outward_items')
          .insert({
            outward_id: outwardRecord.id,
            material_name: mat.materials?.name || '',
            quantity: qty,
            unit: mat.materials?.unit || '',
            material_id: mat.material_id,
            warehouse_id: whIds.mainStore.id,
            organisation_id: organisation.id
          });

        await supabase
          .from('job_card_materials')
          .update({
            issued_qty: qty,
            status: 'issued',
            warehouse_id: whIds.wip.id
          })
          .eq('id', mat.id);
      }

      const { error: jcErr } = await supabase
        .from('job_cards')
        .update({
          status: 'issued',
          issued_at: new Date().toISOString(),
          issued_to: user?.id
        })
        .eq('id', jobCardId);
      if (jcErr) throw jcErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-card', jobCardId] });
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', jobCardId] });
    },
    onError: (err: Error) => {
      setIssueError(err.message);
    }
  });

  const handleReturn = useMutation({
    mutationFn: async () => {
      if (!organisation?.id || !user?.id) throw new Error('Not authenticated');
      if (!whIds?.mainStore || !whIds?.wip) throw new Error('Required warehouses not found');

      setReturnError(null);

      const issuedMaterials = (materials || []).filter(m => m.status === 'issued');
      const returnItems: { material: JobMaterial; returnQty: number }[] = [];

      for (const mat of issuedMaterials) {
        const returnQty = returnQuantities[mat.id] || 0;
        if (returnQty > 0) {
          if (returnQty > (mat.issued_qty || 0)) {
            throw new Error(
              `Cannot return more than issued for ${mat.materials?.name}: ` +
              `issued ${mat.issued_qty}, requested return ${returnQty}`
            );
          }
          returnItems.push({ material: mat, returnQty });
        }
      }

      if (returnItems.length === 0) return;

      const { data: inwardRecord, error: inwardErr } = await supabase
        .from('material_inward')
        .insert({
          inward_date: new Date().toISOString().split('T')[0],
          vendor_name: 'Production Return',
          remarks: `Job Card ${jobCard?.job_card_no} — materials returned from production`,
          organisation_id: organisation.id,
          supply_type: 'WAREHOUSE'
        })
        .select()
        .single();
      if (inwardErr) throw inwardErr;

      for (const { material: mat, returnQty } of returnItems) {
        const { data: wipStockForDec } = await supabase
          .from('item_stock')
          .select('id, current_stock')
          .eq('item_id', mat.material_id)
          .eq('warehouse_id', whIds.wip.id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (wipStockForDec) {
          await supabase
            .from('item_stock')
            .update({ current_stock: wipStockForDec.current_stock - returnQty })
            .eq('id', wipStockForDec.id);
        }

        const { data: mainStock } = await supabase
          .from('item_stock')
          .select('id, current_stock')
          .eq('item_id', mat.material_id)
          .eq('warehouse_id', whIds.mainStore.id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (mainStock) {
          await supabase
            .from('item_stock')
            .update({ current_stock: mainStock.current_stock + returnQty })
            .eq('id', mainStock.id);
        } else {
          await supabase
            .from('item_stock')
            .insert({
              item_id: mat.material_id,
              warehouse_id: whIds.mainStore.id,
              organisation_id: organisation.id,
              current_stock: returnQty
            });
        }

        await supabase
          .from('material_inward_items')
          .insert({
            inward_id: inwardRecord.id,
            material_name: mat.materials?.name || '',
            quantity: returnQty,
            unit: mat.materials?.unit || '',
            material_id: mat.material_id,
            warehouse_id: whIds.mainStore.id,
            organisation_id: organisation.id
          });

        await supabase
          .from('job_card_materials')
          .update({
            return_qty: returnQty,
            status: 'returned'
          })
          .eq('id', mat.id);
      }

      setShowReturnModal(false);
      setReturnQuantities({});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', jobCardId] });
      queryClient.invalidateQueries({ queryKey: ['job-card', jobCardId] });
    },
    onError: (err: Error) => {
      setReturnError(err.message);
    }
  });

  const returnValidation = useMemo(() => {
    if (!materials) return {};
    const result: Record<string, { valid: boolean; remaining: number }> = {};
    for (const mat of materials) {
      if (mat.status === 'issued' || mat.status === 'returned') {
        const returnQty = returnQuantities[mat.id] || 0;
        const issued = mat.issued_qty || 0;
        const consumed = mat.consumed_qty || 0;
        const wastage = mat.wastage_qty || 0;
        const existingReturn = mat.return_qty || 0;
        const totalReturn = existingReturn + returnQty;
        const remaining = issued - consumed - wastage - totalReturn;
        result[mat.id] = {
          valid: remaining >= 0 && returnQty <= issued,
          remaining: Math.max(0, remaining)
        };
      }
    }
    return result;
  }, [materials, returnQuantities]);

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-150 text-zinc-700 border-zinc-300',
    issued: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200'
  };

  // ─── Design System style tokens ───
  const sectionHeaderStyle: React.CSSProperties = { fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };
  const headerFieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle: React.CSSProperties = { minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' };
  const fieldColStyle: React.CSSProperties = { flex: 1 };
  const inputStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '12px', width: '100%', height: '28px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#111827', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' };

  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={{ ...fieldColStyle, fontSize: '12px', color: '#111827', fontWeight: 500 }}>{field}</div>
    </div>
  );

  if (isLoading) {
    return (
      <div style={{ padding: '24px', background: '#fafafa', minHeight: '100%' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
          Loading Job Card specifications...
        </div>
      </div>
    );
  }

  if (!jobCard) {
    return (
      <div style={{ padding: '24px', background: '#fafafa', minHeight: '100%' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
          Job Card not found.
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => onNavigate('/manufacturing/job-cards')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: '#fff',
              border: '1px solid #d1d5db',
              color: '#374151',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          >
            <ArrowLeft size={13} /> Back
          </button>
          <div style={{ width: '1px', height: '20px', background: '#e5e7eb' }} />
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{jobCard.job_card_no}</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>{jobCard.product_name}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {jobCard.status === 'draft' && (
            <button onClick={() => issueMaterials.mutate()} disabled={issueMaterials.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                background: '#185FA5',
                border: '1px solid #185FA5',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: issueMaterials.isPending ? 'not-allowed' : 'pointer',
                opacity: issueMaterials.isPending ? 0.6 : 1,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { if (!issueMaterials.isPending) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
              onMouseLeave={e => { if (!issueMaterials.isPending) { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}}
            >
              {issueMaterials.isPending && <Loader2 size={13} className="animate-spin" />}
              {issueMaterials.isPending ? 'Issuing...' : 'Issue Materials'}
            </button>
          )}
          {jobCard.status === 'issued' && (
            <button onClick={() => onNavigate(`/manufacturing/production/create?jobCard=${jobCardId}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                background: '#185FA5',
                border: '1px solid #185FA5',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
            >
              Record Production
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1200px' }}>
        
        {issueError && (
          <div style={{ marginBottom: '16px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '12px', fontWeight: 500 }}>
            {issueError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '24px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {hasShortage && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
                <AlertTriangle size={20} color="#dc2626" style={{ marginTop: '2px' }} />
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: '#991b1b' }}>Material Shortage Detected</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c' }}>
                    There is insufficient stock in the Main Store to issue this job card. Check the materials list below for items marked in red.
                  </p>
                </div>
              </div>
            )}

            {/* Card 1: Job Card Details */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#93c5fd'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                
                {/* Column 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={sectionHeaderStyle}>Job Specifications</div>
                  {renderHeaderField('Status:', (
                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${statusColors[jobCard.status] || 'bg-zinc-100 text-zinc-600'}`}>
                      {jobCard.status.replace('_', ' ')}
                    </span>
                  ))}
                  {renderHeaderField('Planned Qty:', `${jobCard.planned_qty} ${jobCard.output_unit}`)}
                  {jobCard.issued_at && renderHeaderField('Issued At:', new Date(jobCard.issued_at).toLocaleString())}
                </div>

                {/* Column 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={sectionHeaderStyle}>Production Outputs</div>
                  {renderHeaderField('Actual Qty:', jobCard.actual_qty ? `${jobCard.actual_qty} ${jobCard.output_unit}` : '—')}
                  {renderHeaderField('Yield Factor:', jobCard.yield_pct ? `${jobCard.yield_pct}%` : '—')}
                  {jobCard.completed_at && renderHeaderField('Completed At:', new Date(jobCard.completed_at).toLocaleString())}
                </div>
              </div>
            </div>

            {/* Card 2: Materials List */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Material Requirements</h2>
              
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'visible' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Material Name</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Planned</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Issued</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Consumed</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Wastage</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Return</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials?.map((mat) => (
                      <tr key={mat.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px', fontSize: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#1f2937' }}>{mat.materials?.name}</div>
                          {stockByMaterial?.[mat.material_id] && stockByMaterial[mat.material_id].length > 0 && (
                            <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600 }} className={(mainStoreStockByMaterial[mat.material_id] || 0) >= mat.planned_qty ? 'text-green-600' : 'text-red-500'}>
                                Raw Materials (Main Store) Stock: {mainStoreStockByMaterial[mat.material_id] || 0} {mat.materials?.unit}
                              </span>
                              <span>•</span>
                              {stockByMaterial[mat.material_id].map((s, i) => (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: s.current_stock > 0 ? '#10b981' : '#d1d5db' }} />
                                  {s.warehouse_name}: {s.current_stock}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#4b5563', textAlign: 'right' }}>{mat.planned_qty} {mat.materials?.unit}</td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#4b5563', textAlign: 'right' }}>{mat.issued_qty || '—'}</td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#4b5563', textAlign: 'right' }}>{mat.consumed_qty || '—'}</td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#4b5563', textAlign: 'right' }}>{mat.wastage_qty || '—'}</td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#4b5563', textAlign: 'right' }}>{mat.return_qty || '—'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '4px', color: '#4b5563', textTransform: 'uppercase' }}>
                            {mat.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Production Entries log */}
            {productionEntries && productionEntries.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Production Logs</h2>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Entry No</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Date</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Qty Produced</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Yield</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Operator</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Machine</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Notes / Scrap</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', width: '60px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionEntries.map((entry) => (
                        <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>{entry.entry_no}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#4b5563' }}>{new Date(entry.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#111827', textAlign: 'right' }}>{entry.actual_qty} {entry.output_unit}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#10b981', fontWeight: 500, textAlign: 'right' }}>{entry.yield_pct}%</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#4b5563' }}>{entry.operator_name || '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#4b5563' }}>{entry.machine_name || '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '11px', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.notes || entry.scrap_byproducts || ''}>
                            {entry.notes || entry.scrap_byproducts || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            {(!entry.status || entry.status === 'active') && (
                              <button
                                onClick={() => onNavigate(`/manufacturing/production/create?edit=${entry.id}`)}
                                style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 500, color: '#185FA5', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                            )}
                            {entry.status === 'edited' && <span style={{ fontSize: '10px', color: '#9ca3af', fontStyle: 'italic' }}>Edited</span>}
                            {entry.status === 'reversal' && <span style={{ fontSize: '10px', color: '#ef4444', fontStyle: 'italic' }}>Reversal</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Actions Panel */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>Execution Actions</h2>
              {jobCard.status === 'issued' ? (
                <button onClick={() => setShowReturnModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#374151',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}>
                  Return Unused Materials
                </button>
              ) : (
                <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>
                  No actions available for current status ({jobCard.status})
                </div>
              )}
            </div>

            {/* Warehouse Configuration Details */}
            {whIds && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' }}>
                <h3 style={{ ...sectionHeaderStyle, margin: '0 0 12px 0' }}>Warehouses</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#374151' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Main Store:</span>
                    <span style={{ fontWeight: 600 }}>{whIds.mainStore?.name || 'Not found'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>WIP (Production):</span>
                    <span style={{ fontWeight: 600 }}>{whIds.wip?.name || 'Not found'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Finished Goods (FG):</span>
                    <span style={{ fontWeight: 600 }}>{whIds.fg?.name || 'Not found'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Guide Info */}
            <div style={{ background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '16px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 8px 0' }}>Job Card Lifecycle</h3>
              <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong>Draft</strong>: Raw materials are reserved. Click "Issue Materials" to start production.</li>
                <li><strong>Issued</strong>: Materials are transferred from Main Store to the WIP Warehouse.</li>
                <li><strong>In Progress / Completed</strong>: Record yields and finished goods to update stock.</li>
              </ul>
            </div>

          </div>
        </div>
      </div>

      {/* Return Materials Modal (using Confirmation Modal styles from design.md) */}
      {showReturnModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#185FA5' }}>
                <RotateCcw size={20} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: 0 }}>Return Materials</h3>
            </div>
            
            <p style={{ fontSize: '12px', color: '#4b5563', lineHeight: '18px', margin: '0 0 12px 0' }}>
              Specify the quantity of unused raw materials to return back from WIP to the Main Store.
            </p>

            {returnError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '11px', fontWeight: 500, marginBottom: '12px' }}>
                {returnError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px', marginBottom: '20px' }}>
              {materials?.filter(m => m.status === 'issued').map((mat) => {
                const validation = returnValidation[mat.id];
                const maxReturn = validation?.remaining ?? (mat.issued_qty || 0);
                return (
                  <div key={mat.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                      {mat.materials?.name} ({mat.materials?.unit})
                    </label>
                    <input
                      type="number"
                      value={returnQuantities[mat.id] || ''}
                      onChange={(e) => setReturnQuantities({ ...returnQuantities, [mat.id]: Number(e.target.value) })}
                      placeholder="Qty to return"
                      max={mat.issued_qty}
                      style={inputStyle}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af' }}>
                      <span>Issued: {mat.issued_qty}</span>
                      <span>Max returnable: {maxReturn}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', height: '36px' }}>
              <button onClick={() => { setShowReturnModal(false); setReturnError(null); }}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#4b5563',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}>
                Cancel
              </button>
              <button onClick={() => handleReturn.mutate()} disabled={handleReturn.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '36px',
                  padding: '0 16px',
                  background: '#185FA5',
                  border: '1px solid #185FA5',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: handleReturn.isPending ? 'not-allowed' : 'pointer',
                  opacity: handleReturn.isPending ? 0.6 : 1,
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!handleReturn.isPending) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
                onMouseLeave={e => { if (!handleReturn.isPending) { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}}>
                {handleReturn.isPending && <Loader2 size={14} className="animate-spin" />}
                {handleReturn.isPending ? 'Returning...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
