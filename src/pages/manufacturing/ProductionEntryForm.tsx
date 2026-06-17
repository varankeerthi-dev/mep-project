import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';


type ProductionEntryFormProps = {
  onNavigate: (path: string) => void;
};

type MaterialEntry = {
  job_card_material_id: string;
  material_id: string;
  material_name: string;
  issued_qty: number;
  consumed_qty: number;
  wastage_qty: number;
  return_qty: number;
};

type WarehouseInfo = {
  id: string;
  name: string;
  warehouse_code: string;
  warehouse_purpose: string;
  is_default: boolean;
};

export default function ProductionEntryForm({ onNavigate }: ProductionEntryFormProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const jobCardId = searchParams.get('jobCard');

  const [formData, setFormData] = useState({
    job_card_id: jobCardId || '',
    actual_qty: 0,
    output_unit: 'nos',
    notes: '',
    production_start_time: '',
    production_end_time: '',
    operator_name: '',
    machine_name: '',
    scrap_byproducts: ''
  });

  const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── QUERIES ─────────────────────────────────────────────────────

  const { data: jobCards } = useQuery({
    queryKey: ['job-cards-for-entry', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('job_cards')
        .select('*')
        .eq('organisation_id', organisation.id)
        .in('status', ['issued', 'in_progress']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && !jobCardId
  });

  const { data: selectedJobCard } = useQuery({
    queryKey: ['selected-job-card', formData.job_card_id],
    queryFn: async () => {
      if (!formData.job_card_id) return null;
      const { data, error } = await supabase
        .from('job_cards')
        .select('*, bom_headers!inner(product_id)')
        .eq('id', formData.job_card_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!formData.job_card_id
  });

  const { data: jobMaterials } = useQuery({
    queryKey: ['job-materials-for-entry', formData.job_card_id],
    queryFn: async () => {
      if (!formData.job_card_id) return [];
      const { data, error } = await supabase
        .from('job_card_materials')
        .select('*, materials(name, unit, id)')
        .eq('job_card_id', formData.job_card_id)
        .in('status', ['issued', 'consumed']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.job_card_id
  });

  // Get production entries (filtered by job card if selected, otherwise all for organisation)
  const { data: productionEntries } = useQuery({
    queryKey: ['org-production-entries', formData.job_card_id, organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      let query = supabase
        .from('production_entries')
        .select('*, production_entry_items(*)')
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });
      
      if (formData.job_card_id) {
        query = query.eq('job_card_id', formData.job_card_id);
      }
      
      const { data: entries, error } = await query;
      if (error) throw error;
      if (!entries || entries.length === 0) return [];

      // Fetch corresponding job card details to map them manually
      const jobCardIds = [...new Set(entries.map(e => e.job_card_id).filter(Boolean))];
      if (jobCardIds.length > 0) {
        const { data: jcs, error: jcErr } = await supabase
          .from('job_cards')
          .select('id, job_card_no, product_name')
          .in('id', jobCardIds);
        if (!jcErr && jcs) {
          const jcMap = Object.fromEntries(jcs.map(jc => [jc.id, jc]));
          return entries.map(entry => ({
            ...entry,
            job_cards: jcMap[entry.job_card_id] || null
          }));
        }
      }

      return entries.map(entry => ({ ...entry, job_cards: null }));
    },
    enabled: !!organisation?.id
  });

  const { data: warehouses } = useQuery({
    queryKey: ['manufacturing-warehouses', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, warehouse_code, warehouse_purpose, is_default')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as WarehouseInfo[];
    },
    enabled: !!organisation?.id
  });

  const whIds = useMemo(() => {
    if (!warehouses) return null;
    const mainStore = warehouses.find(w => w.warehouse_purpose === 'main' || w.is_default);
    const wip = warehouses.find(w => w.warehouse_purpose === 'wip');
    const fg = warehouses.find(w => w.warehouse_purpose === 'fg');
    return { mainStore, wip, fg };
  }, [warehouses]);

  // Compute cumulative actual qty from existing entries for the selected job card
  const cumulativeActualQty = useMemo(() => {
    if (!formData.job_card_id || !productionEntries) return 0;
    return productionEntries.reduce((sum, e) => sum + (e.actual_qty || 0), 0);
  }, [productionEntries, formData.job_card_id]);

  // Compute cumulative material consumption from existing entries
  const cumulativeConsumption = useMemo(() => {
    if (!formData.job_card_id || !productionEntries) return {} as Record<string, { consumed: number; wastage: number; returned: number }>;
    const result: Record<string, { consumed: number; wastage: number; returned: number }> = {};
    for (const entry of productionEntries) {
      for (const item of entry.production_entry_items || []) {
        if (!result[item.material_id]) {
          result[item.material_id] = { consumed: 0, wastage: 0, returned: 0 };
        }
        result[item.material_id].consumed += item.consumed_qty || 0;
        result[item.material_id].wastage += item.wastage_qty || 0;
        result[item.material_id].returned += item.return_qty || 0;
      }
    }
    return result;
  }, [productionEntries, formData.job_card_id]);

  // ─── RETURN VALIDATION ───────────────────────────────────────────

  const returnValidation = useMemo(() => {
    const result: Record<string, { valid: boolean; remaining: number; error?: string }> = {};
    for (const mat of materialEntries) {
      const issued = mat.issued_qty;
      const consumed = mat.consumed_qty;
      const wastage = mat.wastage_qty;
      const returnQty = mat.return_qty;
      const total = consumed + wastage + returnQty;
      const remaining = issued - consumed - wastage - returnQty;

      let error: string | undefined;
      if (total > issued) {
        error = `Consumed (${consumed}) + Wastage (${wastage}) + Return (${returnQty}) = ${total} exceeds issued (${issued})`;
      } else if (returnQty < 0) {
        error = 'Return quantity cannot be negative';
      } else if (consumed < 0) {
        error = 'Consumed quantity cannot be negative';
      } else if (wastage < 0) {
        error = 'Wastage quantity cannot be negative';
      }

      result[mat.material_id] = {
        valid: !error && total <= issued,
        remaining: Math.max(0, remaining),
        error
      };
    }
    return result;
  }, [materialEntries]);

  const allValid = useMemo(() => {
    return Object.values(returnValidation).every(v => v.valid);
  }, [returnValidation]);

  // ─── HANDLERS ────────────────────────────────────────────────────

  const handleJobCardSelect = (jobCardId: string) => {
    const jc = jobCards?.find(j => j.id === jobCardId);
    setFormData({ ...formData, job_card_id: jobCardId, output_unit: jc?.output_unit || 'nos' });

    // Initialize material entries from job_card_materials
    if (jobMaterials) {
      setMaterialEntries(jobMaterials.map(mat => ({
        job_card_material_id: mat.id,
        material_id: mat.material_id,
        material_name: mat.materials?.name || '',
        issued_qty: mat.issued_qty || 0,
        consumed_qty: 0,
        wastage_qty: 0,
        return_qty: 0
      })));
    }
  };

  const updateMaterialEntry = (index: number, field: keyof MaterialEntry, value: number) => {
    const newEntries = [...materialEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setMaterialEntries(newEntries);
  };

  // ─── SUBMIT: Production Entry with Stock Transfers ────────────────

  const saveEntry = useMutation({
    mutationFn: async () => {
      if (!organisation?.id || !user?.id || !formData.job_card_id) throw new Error('Missing required data');
      if (!formData.actual_qty || formData.actual_qty <= 0) throw new Error('Actual quantity must be greater than 0');
      if (!allValid) throw new Error('Material quantities are invalid — consumed + wastage + return must equal issued');

      setSubmitError(null);

      const wh = whIds;
      if (!wh?.wip || !wh?.fg || !wh?.mainStore) {
        throw new Error('Required warehouses (WIP / FG / Main Store) not found');
      }

      // Generate production entry number
      const { data: entryNo, error: noError } = await supabase
        .rpc('generate_production_entry_no', { org_id: organisation.id });
      if (noError) throw noError;

      const yieldPct = selectedJobCard?.planned_qty
        ? (formData.actual_qty / selectedJobCard.planned_qty) * 100
        : 0;

      // 1. Create production entry
      const { data: entry, error: entryError } = await supabase
        .from('production_entries')
        .insert({
          entry_no: entryNo,
          job_card_id: formData.job_card_id,
          actual_qty: formData.actual_qty,
          output_unit: formData.output_unit || selectedJobCard?.output_unit,
          yield_pct: yieldPct,
          notes: formData.notes,
          created_by: user.id,
          organisation_id: organisation.id,
          production_start_time: formData.production_start_time || null,
          production_end_time: formData.production_end_time || null,
          operator_name: formData.operator_name || null,
          machine_name: formData.machine_name || null,
          scrap_byproducts: formData.scrap_byproducts || null
        })
        .select()
        .single();
      if (entryError) throw entryError;

      // 2. Create material_outward parent for WIP→consumption audit trail
      const { data: outwardRecord, error: outwardErr } = await supabase
        .from('material_outward')
        .insert({
          outward_date: new Date().toISOString().split('T')[0],
          remarks: `Production Entry ${entry.entry_no} — materials consumed from WIP`,
          organisation_id: organisation.id
        })
        .select()
        .single();
      if (outwardErr) throw outwardErr;

      // 3. Create material_inward parent for returns audit trail
      let inwardRecord: { id: string } | null = null;
      const hasReturns = materialEntries.some(m => m.return_qty > 0);
      if (hasReturns) {
        const { data: ir, error: irErr } = await supabase
          .from('material_inward')
          .insert({
            inward_date: new Date().toISOString().split('T')[0],
            vendor_name: 'Production Return',
            remarks: `Production Entry ${entry.entry_no} — unused materials returned to Main Store`,
            organisation_id: organisation.id,
            supply_type: 'WAREHOUSE'
          })
          .select()
          .single();
        if (irErr) throw irErr;
        inwardRecord = ir;
      }

      // 4. Process each material
      for (const mat of materialEntries) {
        // a. Save production_entry_items
        const { error: itemError } = await supabase
          .from('production_entry_items')
          .insert({
            production_entry_id: entry.id,
            job_card_material_id: mat.job_card_material_id,
            material_id: mat.material_id,
            issued_qty: mat.issued_qty,
            consumed_qty: mat.consumed_qty,
            wastage_qty: mat.wastage_qty,
            return_qty: mat.return_qty
          });
        if (itemError) throw itemError;

        const totalDeductFromWip = mat.consumed_qty + mat.wastage_qty;

        // b. Decrease WIP stock (consumed + wastage)
        if (totalDeductFromWip > 0) {
          const { data: wipStock } = await supabase
            .from('item_stock')
            .select('id, current_stock')
            .eq('item_id', mat.material_id)
            .eq('warehouse_id', wh.wip.id)
            .eq('organisation_id', organisation.id)
            .maybeSingle();

          if (wipStock) {
            await supabase
              .from('item_stock')
              .update({ current_stock: wipStock.current_stock - totalDeductFromWip })
              .eq('id', wipStock.id);
          }

          // Record in material_outward_items
          await supabase
            .from('material_outward_items')
            .insert({
              outward_id: outwardRecord.id,
              material_name: mat.material_name,
              quantity: totalDeductFromWip,
              unit: jobMaterials?.find(m => m.material_id === mat.material_id)?.materials?.unit || '',
              material_id: mat.material_id,
              warehouse_id: wh.wip.id,
              organisation_id: organisation.id
            });
        }

        // c. Return unused materials: WIP ↓, Main Store ↑
        if (mat.return_qty > 0 && inwardRecord) {
          const { data: wipStockForReturn } = await supabase
            .from('item_stock')
            .select('id, current_stock')
            .eq('item_id', mat.material_id)
            .eq('warehouse_id', wh.wip.id)
            .eq('organisation_id', organisation.id)
            .maybeSingle();

          if (wipStockForReturn) {
            await supabase
              .from('item_stock')
              .update({ current_stock: wipStockForReturn.current_stock - mat.return_qty })
              .eq('id', wipStockForReturn.id);
          }

          // Increase Main Store
          const { data: mainStock } = await supabase
            .from('item_stock')
            .select('id, current_stock')
            .eq('item_id', mat.material_id)
            .eq('warehouse_id', wh.mainStore.id)
            .eq('organisation_id', organisation.id)
            .maybeSingle();

          if (mainStock) {
            await supabase
              .from('item_stock')
              .update({ current_stock: mainStock.current_stock + mat.return_qty })
              .eq('id', mainStock.id);
          } else {
            await supabase
              .from('item_stock')
              .insert({
                item_id: mat.material_id,
                warehouse_id: wh.mainStore.id,
                organisation_id: organisation.id,
                current_stock: mat.return_qty
              });
          }

          // Record return in material_inward_items
          await supabase
            .from('material_inward_items')
            .insert({
              inward_id: inwardRecord.id,
              material_name: mat.material_name,
              quantity: mat.return_qty,
              unit: jobMaterials?.find(m => m.material_id === mat.material_id)?.materials?.unit || '',
              material_id: mat.material_id,
              warehouse_id: wh.mainStore.id,
              organisation_id: organisation.id
            });
        }

        // d. Update job_card_materials (consumed/return quantities)
        if (mat.job_card_material_id) {
          const cumulative = cumulativeConsumption[mat.material_id] || { consumed: 0, wastage: 0, returned: 0 };
          await supabase
            .from('job_card_materials')
            .update({
              consumed_qty: cumulative.consumed + mat.consumed_qty,
              wastage_qty: cumulative.wastage + mat.wastage_qty,
              return_qty: cumulative.returned + mat.return_qty,
              status: 'consumed'
            })
            .eq('id', mat.job_card_material_id);
        }
      }

      // 5. Look up finished product — prefer product_id FK from BOM, fall back to name match
      const bomProductId = (selectedJobCard as any)?.bom_headers?.product_id;
      const productName = selectedJobCard?.product_name;
      let finishedProductId: string | null = null;

      if (bomProductId) {
        finishedProductId = bomProductId;
      } else if (productName) {
        const { data: existingProduct } = await supabase
          .from('materials')
          .select('id')
          .eq('name', productName)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (existingProduct) {
          finishedProductId = existingProduct.id;
        } else {
          const { data: newProduct, error: prodErr } = await supabase
            .from('materials')
            .insert({
              name: productName,
              unit: formData.output_unit || selectedJobCard?.output_unit || 'nos',
              organisation_id: organisation.id,
              item_classification: 'finished_good',
              allow_purchase: false,
              allow_sales: true,
              show_in_bom: false,
              is_manufactured: true
            })
            .select('id')
            .single();
          if (prodErr) throw prodErr;
          finishedProductId = newProduct.id;
        }
      }

      // 6. Add finished goods to FG Warehouse
      if (finishedProductId && formData.actual_qty > 0) {
        const { data: fgStock } = await supabase
          .from('item_stock')
          .select('id, current_stock')
          .eq('item_id', finishedProductId)
          .eq('warehouse_id', wh.fg.id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (fgStock) {
          await supabase
            .from('item_stock')
            .update({ current_stock: fgStock.current_stock + formData.actual_qty })
            .eq('id', fgStock.id);
        } else {
          await supabase
            .from('item_stock')
            .insert({
              item_id: finishedProductId,
              warehouse_id: wh.fg.id,
              organisation_id: organisation.id,
              current_stock: formData.actual_qty
            });
        }

        // Record finished goods inward
        let fgInwardRecord = inwardRecord;
        if (!fgInwardRecord) {
          const { data: fgIr, error: fgIrErr } = await supabase
            .from('material_inward')
            .insert({
              inward_date: new Date().toISOString().split('T')[0],
              vendor_name: 'Manufacturing',
              remarks: `Production Entry ${entry.entry_no} — finished goods added to FG Warehouse`,
              organisation_id: organisation.id,
              supply_type: 'WAREHOUSE'
            })
            .select()
            .single();
          if (!fgIrErr) fgInwardRecord = fgIr;
        }

        if (fgInwardRecord) {
          await supabase
            .from('material_inward_items')
            .insert({
              inward_id: fgInwardRecord.id,
              material_name: productName || '',
              quantity: formData.actual_qty,
              unit: formData.output_unit || selectedJobCard?.output_unit || '',
              material_id: finishedProductId,
              warehouse_id: wh.fg.id,
              organisation_id: organisation.id
            });
        }
      }

      // 7. Update job card: actual_qty, yield, status
      // For partial production: accumulate actual_qty
      const totalActual = cumulativeActualQty + formData.actual_qty;
      const totalYield = selectedJobCard?.planned_qty
        ? (totalActual / selectedJobCard.planned_qty) * 100
        : 0;

      // Determine if job card is complete (actual >= planned)
      const isComplete = totalActual >= (selectedJobCard?.planned_qty || 0);
      const newStatus = isComplete ? 'completed' : 'in_progress';

      const { error: jcError } = await supabase
        .from('job_cards')
        .update({
          actual_qty: totalActual,
          yield_pct: totalYield,
          status: newStatus,
          completed_at: isComplete ? new Date().toISOString() : null
        })
        .eq('id', formData.job_card_id);
      if (jcError) throw jcError;

      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['job-card', formData.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', formData.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['production-entries', formData.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['org-production-entries'] });
      onNavigate('/manufacturing/job-cards');
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    }
  });

  // ─── RENDER ───────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    padding: '4px 12px',
    fontSize: '12px',
    height: '32px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    color: '#111827',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    width: '100%'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  };

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Record Production Entry</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Log actual consumption and output</span>
          {cumulativeActualQty > 0 && (
            <span style={{ fontSize: '11px', color: '#185FA5', marginLeft: '8px', fontWeight: 600 }}>
              (Previously produced: {cumulativeActualQty} {selectedJobCard?.output_unit})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => onNavigate('/manufacturing/job-cards')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
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
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          >
            Cancel
          </button>
          <button
            onClick={() => saveEntry.mutate()}
            disabled={!formData.job_card_id || !formData.actual_qty || saveEntry.isPending || !allValid}
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
              cursor: (!formData.job_card_id || !formData.actual_qty || saveEntry.isPending || !allValid) ? 'not-allowed' : 'pointer',
              opacity: (!formData.job_card_id || !formData.actual_qty || saveEntry.isPending || !allValid) ? 0.6 : 1,
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { if (formData.job_card_id && formData.actual_qty && !saveEntry.isPending && allValid) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
            onMouseLeave={e => { if (formData.job_card_id && formData.actual_qty && !saveEntry.isPending && allValid) { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}}
          >
            {saveEntry.isPending && <Loader2 size={13} className="animate-spin" />}
            {saveEntry.isPending ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {submitError && (
          <div style={{ marginBottom: '16px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '12px', fontWeight: 500 }}>
            {submitError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Job Card Selection Card */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>Job Card Selection</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Job Card *</label>
                  <select
                    value={formData.job_card_id}
                    onChange={(e) => handleJobCardSelect(e.target.value)}
                    disabled={!!jobCardId}
                    style={!!jobCardId ? { ...inputStyle, background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' } : inputStyle}
                  >
                    <option value="">Select job card</option>
                    {jobCards?.map((jc) => (
                      <option key={jc.id} value={jc.id}>
                        {jc.job_card_no} - {jc.product_name} ({jc.planned_qty} {jc.output_unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedJobCard && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', marginTop: '16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Product</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginTop: '2px' }}>{selectedJobCard.product_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Planned Qty</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginTop: '2px' }}>{selectedJobCard.planned_qty} {selectedJobCard.output_unit}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Cumulative Actual</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginTop: '2px' }}>{cumulativeActualQty + (formData.actual_qty || 0)} {selectedJobCard.output_unit}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Yield</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginTop: '2px' }}>
                      {(cumulativeActualQty + formData.actual_qty) > 0 && selectedJobCard?.planned_qty
                        ? `${(((cumulativeActualQty + formData.actual_qty) / selectedJobCard.planned_qty) * 100).toFixed(1)}%`
                        : '-'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {formData.job_card_id && (
              /* Production Details Card */
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>Production Details</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                  {/* Row 1: Qty & Operator */}
                  <div>
                    <label style={labelStyle}>Actual Qty Produced *</label>
                    <input
                      type="number"
                      value={formData.actual_qty || ''}
                      onChange={(e) => setFormData({ ...formData, actual_qty: Number(e.target.value) })}
                      style={inputStyle}
                      placeholder="Enter actual output qty"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Operator Name</label>
                    <input
                      type="text"
                      value={formData.operator_name}
                      onChange={(e) => setFormData({ ...formData, operator_name: e.target.value })}
                      placeholder="Enter operator name"
                      style={inputStyle}
                    />
                  </div>

                  {/* Row 2: Machine Name & Notes */}
                  <div>
                    <label style={labelStyle}>Machine Name / ID</label>
                    <input
                      type="text"
                      value={formData.machine_name}
                      onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })}
                      placeholder="Enter machine code or name"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>General Notes</label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Optional general notes"
                      style={inputStyle}
                    />
                  </div>

                  {/* Row 3: Start Time & End Time */}
                  <div>
                    <label style={labelStyle}>Production Start Time</label>
                    <input
                      type="datetime-local"
                      value={formData.production_start_time}
                      onChange={(e) => setFormData({ ...formData, production_start_time: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Production End Time</label>
                    <input
                      type="datetime-local"
                      value={formData.production_end_time}
                      onChange={(e) => setFormData({ ...formData, production_end_time: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  {/* Row 4: Scrap / Byproducts Details (span both columns) */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Scrap & Byproducts Notes</label>
                    <textarea
                      value={formData.scrap_byproducts}
                      onChange={(e) => setFormData({ ...formData, scrap_byproducts: e.target.value })}
                      placeholder="Describe any scrap generated, byproducts reclaimed, or quality inspections performed..."
                      rows={3}
                      style={{
                        ...inputStyle,
                        height: 'auto',
                        padding: '8px 12px',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {materialEntries.length > 0 && (
              /* Material Consumption Card */
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>Material Consumption</h2>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'visible' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Material</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Issued</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'center' }}>Consumed</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'center' }}>Wastage</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'center' }}>Return</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialEntries.map((mat, index) => {
                        const validation = returnValidation[mat.material_id];
                        return (
                          <tr key={mat.material_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>{mat.material_name}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12px', color: '#4b5563', textAlign: 'right' }}>{mat.issued_qty}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <input
                                type="number"
                                value={mat.consumed_qty || ''}
                                onChange={(e) => updateMaterialEntry(index, 'consumed_qty', Number(e.target.value))}
                                style={{ ...inputStyle, width: '80px', height: '26px', textAlign: 'right', margin: '0 auto' }}
                              />
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <input
                                type="number"
                                value={mat.wastage_qty || ''}
                                onChange={(e) => updateMaterialEntry(index, 'wastage_qty', Number(e.target.value))}
                                style={{ ...inputStyle, width: '80px', height: '26px', textAlign: 'right', margin: '0 auto' }}
                              />
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <input
                                type="number"
                                value={mat.return_qty || ''}
                                onChange={(e) => updateMaterialEntry(index, 'return_qty', Number(e.target.value))}
                                style={{ ...inputStyle, width: '80px', height: '26px', textAlign: 'right', margin: '0 auto' }}
                              />
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'right' }}>
                              <span style={{ fontWeight: 600 }} className={validation?.remaining === 0 ? 'text-green-600' : validation?.remaining && validation.remaining > 0 ? 'text-zinc-700' : 'text-red-500'}>
                                {validation?.remaining ?? '-'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Validation errors */}
                {Object.entries(returnValidation).map(([matId, v]) => (
                  v.error && (
                    <div key={matId} style={{ marginTop: '8px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '11px', fontWeight: 500 }}>
                      {v.error}
                    </div>
                  )
                ))}

                <div style={{ marginTop: '12px', padding: '10px', background: '#f3f4f6', borderRadius: '6px', fontSize: '11px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center' }}>
                  Validation rule: Consumed + Wastage + Return = Issued (must balance)
                </div>
              </div>
            )}

            {productionEntries && productionEntries.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', marginTop: '20px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
                  {formData.job_card_id ? 'Previous Production Logs' : 'All Production Logs'}
                </h2>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Entry No</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Date</th>
                        {!formData.job_card_id && <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Job Card / Product</th>}
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Qty Produced</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Yield</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Operator</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Machine</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionEntries.map((entry: any) => (
                        <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>{entry.entry_no}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#4b5563' }}>{new Date(entry.created_at).toLocaleDateString()}</td>
                          {!formData.job_card_id && (
                            <td style={{ padding: '10px 12px', fontSize: '12px', color: '#4b5563' }}>
                              <span style={{ fontWeight: 600, color: '#1f2937' }}>{entry.job_cards?.job_card_no || '—'}</span>
                              <div style={{ fontSize: '10px', color: '#9ca3af' }}>{entry.job_cards?.product_name || '—'}</div>
                            </td>
                          )}
                          <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#111827', textAlign: 'right' }}>{entry.actual_qty} {entry.output_unit}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#10b981', fontWeight: 500, textAlign: 'right' }}>{entry.yield_pct}%</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#4b5563' }}>{entry.operator_name || '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#4b5563' }}>{entry.machine_name || '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '11px', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.notes || entry.scrap_byproducts || ''}>
                            {entry.notes || entry.scrap_byproducts || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Summary Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Summary Card */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>Summary</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Job Card:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{selectedJobCard?.job_card_no || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Planned Qty:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{selectedJobCard?.planned_qty || '-'} {selectedJobCard?.output_unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Previous Entries:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{cumulativeActualQty} {selectedJobCard?.output_unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>This Entry:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{formData.actual_qty || 0} {formData.output_unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>Total Actual:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{cumulativeActualQty + (formData.actual_qty || 0)} {selectedJobCard?.output_unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Yield:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>
                    {(cumulativeActualQty + formData.actual_qty) > 0 && selectedJobCard?.planned_qty
                      ? `${(((cumulativeActualQty + formData.actual_qty) / selectedJobCard.planned_qty) * 100).toFixed(1)}%`
                      : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* What Happens Guide Box */}
            <div style={{ background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '16px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 8px 0' }}>What happens on save</h3>
              <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>WIP stock decreases (consumed + wastage)</li>
                <li>Unused materials return to Main Store</li>
                <li>Finished goods added to FG Warehouse</li>
                <li>Auto-created product in materials (if new)</li>
                <li>Audit trail recorded (inward/outward)</li>
              </ul>
            </div>

            {/* Warehouse Configuration Box */}
            {whIds && (
              <div style={{ background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '16px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 8px 0' }}>Warehouses</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#6b7280' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Main Store:</span>
                    <span style={{ fontWeight: 600, color: '#4b5563' }}>{whIds.mainStore?.name || 'Not found'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>WIP:</span>
                    <span style={{ fontWeight: 600, color: '#4b5563' }}>{whIds.wip?.name || 'Not found'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>FG:</span>
                    <span style={{ fontWeight: 600, color: '#4b5563' }}>{whIds.fg?.name || 'Not found'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
