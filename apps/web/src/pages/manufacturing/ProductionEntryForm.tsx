import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Trash2, Edit2 } from 'lucide-react';
import {
  useJobCardsListQuery,
  useJobCardDetailQuery,
  useJobCardMaterialsQuery,
  useProductionEntriesQuery,
  useWarehousesQuery,
  useCreateProductionEntryMutation,
  useDeleteProductionEntryMutation,
  useUpdateProductionEntryMutation
} from '../../features/manufacturing';

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

export default function ProductionEntryForm({ onNavigate }: ProductionEntryFormProps) {
  const { organisation, user } = useAuth();
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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const loadEntryForEdit = useCallback(async (entry: any) => {
    const { data: items } = await supabase
      .from('production_entry_items')
      .select('*, materials(name, unit, id)')
      .eq('production_entry_id', entry.id);
    if (items) {
      setMaterialEntries(items.map((item: any) => ({
        job_card_material_id: item.job_card_material_id,
        material_id: item.material_id,
        material_name: item.materials?.name || '',
        issued_qty: item.issued_qty || 0,
        consumed_qty: item.consumed_qty || 0,
        wastage_qty: item.wastage_qty || 0,
        return_qty: item.return_qty || 0
      })));
    }
  }, []);

  const deleteEntry = useDeleteProductionEntryMutation(() => {
    setDeleteTarget(null);
  });

  // Queries
  const { data: jobCards } = useJobCardsListQuery(organisation?.id, ['issued', 'in_progress']);
  const { data: selectedJobCard } = useJobCardDetailQuery(formData.job_card_id || undefined);
  const { data: allJobMaterials } = useJobCardMaterialsQuery(formData.job_card_id || undefined);

  const jobMaterials = useMemo(() => {
    if (!allJobMaterials) return [];
    return allJobMaterials.filter(m => m.status === 'issued' || m.status === 'consumed');
  }, [allJobMaterials]);

  const { data: productionEntries } = useProductionEntriesQuery(
    formData.job_card_id || undefined,
    organisation?.id
  );

  const { data: warehouses } = useWarehousesQuery(organisation?.id);

  const whIds = useMemo(() => {
    if (!warehouses) return null;
    const mainStore = warehouses.find(w => w.warehouse_purpose === 'main' || w.is_default);
    const wip = warehouses.find(w => w.warehouse_purpose === 'wip');
    const fg = warehouses.find(w => w.warehouse_purpose === 'fg');
    return { mainStore, wip, fg };
  }, [warehouses]);

  const cumulativeActualQty = useMemo(() => {
    if (!formData.job_card_id || !productionEntries) return 0;
    // Exclude the currently editing entry if editing
    return productionEntries
      .filter(e => e.id !== editingEntryId)
      .reduce((sum, e) => sum + (e.actual_qty || 0), 0);
  }, [productionEntries, formData.job_card_id, editingEntryId]);

  const cumulativeConsumption = useMemo(() => {
    const result: Record<string, { consumed: number; wastage: number; returned: number }> = {};
    if (!formData.job_card_id || !productionEntries) return result;
    for (const entry of productionEntries) {
      if (entry.id === editingEntryId) continue;
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
  }, [productionEntries, formData.job_card_id, editingEntryId]);

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

  const handleJobCardSelect = (jId: string) => {
    const jc = jobCards?.find(j => j.id === jId);
    setFormData(prev => ({ ...prev, job_card_id: jId, output_unit: jc?.output_unit || 'nos' }));

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
    setMaterialEntries(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const createMutation = useCreateProductionEntryMutation();

  const updateMutation = useUpdateProductionEntryMutation(() => {
    setEditingEntryId(null);
    setFormData({
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
    setMaterialEntries([]);
  });

  const handleSave = () => {
    if (!organisation?.id || !user?.id || !formData.job_card_id) {
      setSubmitError('Missing required data');
      return;
    }
    if (!formData.actual_qty || formData.actual_qty <= 0) {
      setSubmitError('Actual quantity must be greater than 0');
      return;
    }

    setSubmitError(null);

    const yieldPct = selectedJobCard?.planned_qty
      ? (formData.actual_qty / selectedJobCard.planned_qty) * 100
      : 0;

    if (editingEntryId) {
      const entryUpdates = {
        actual_qty: formData.actual_qty,
        output_unit: formData.output_unit || selectedJobCard?.output_unit,
        yield_pct: yieldPct,
        notes: formData.notes,
        production_start_time: formData.production_start_time || null,
        production_end_time: formData.production_end_time || null,
        operator_name: formData.operator_name || null,
        machine_name: formData.machine_name || null,
        scrap_byproducts: formData.scrap_byproducts || null
      };
      updateMutation.mutate({
        entryId: editingEntryId,
        entryUpdates,
        orgId: organisation.id,
        userId: user.id,
        userEmail: user.email || 'Unknown'
      });
    } else {
      if (!allValid) {
        setSubmitError('Material quantities are invalid — consumed + wastage + return must equal issued');
        return;
      }
      const entryPayload = {
        job_card_id: formData.job_card_id,
        actual_qty: formData.actual_qty,
        output_unit: formData.output_unit || selectedJobCard?.output_unit,
        yield_pct: yieldPct,
        notes: formData.notes,
        production_start_time: formData.production_start_time || null,
        production_end_time: formData.production_end_time || null,
        operator_name: formData.operator_name || null,
        machine_name: formData.machine_name || null,
        scrap_byproducts: formData.scrap_byproducts || null
      };
      createMutation.mutate({
        entry: entryPayload,
        items: materialEntries,
        orgId: organisation.id,
        userId: user.id,
        userEmail: user.email || 'Unknown'
      }, {
        onSuccess: (data) => {
          onNavigate(`/manufacturing/qc/create?entry=${data.id}`);
        }
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

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
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', position: 'sticky', top: 0, zIndex: 40 }} className="flex justify-between">
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>
            {editingEntryId ? 'Edit Production Entry' : 'Record Production Entry'}
          </h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            {editingEntryId ? 'Update entry details' : 'Log actual consumption and output'}
          </span>
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
            onClick={handleSave}
            disabled={!formData.job_card_id || !formData.actual_qty || isPending || (!editingEntryId && !allValid)}
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
              cursor: (!formData.job_card_id || !formData.actual_qty || isPending || (!editingEntryId && !allValid)) ? 'not-allowed' : 'pointer',
              opacity: (!formData.job_card_id || !formData.actual_qty || isPending || (!editingEntryId && !allValid)) ? 0.6 : 1,
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { if (formData.job_card_id && formData.actual_qty && !isPending && (editingEntryId || allValid)) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
            onMouseLeave={e => { if (formData.job_card_id && formData.actual_qty && !isPending && (editingEntryId || allValid)) { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}}
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            {isPending ? 'Saving...' : (editingEntryId ? 'Update Entry' : 'Save Entry')}
          </button>
          {editingEntryId && (
            <button
              onClick={() => { setEditingEntryId(null); setFormData({ job_card_id: jobCardId || '', actual_qty: 0, output_unit: 'nos', notes: '', production_start_time: '', production_end_time: '', operator_name: '', machine_name: '', scrap_byproducts: '' }); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
                border: '1px solid #d1d5db', background: '#fff', color: '#374151',
                borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              type="button"
            >
              Cancel Edit
            </button>
          )}
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
                                disabled={!!editingEntryId}
                                style={!!editingEntryId ? { ...inputStyle, width: '80px', height: '26px', textAlign: 'right', margin: '0 auto', background: '#f3f4f6', cursor: 'not-allowed' } : { ...inputStyle, width: '80px', height: '26px', textAlign: 'right', margin: '0 auto' }}
                              />
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <input
                                type="number"
                                value={mat.wastage_qty || ''}
                                onChange={(e) => updateMaterialEntry(index, 'wastage_qty', Number(e.target.value))}
                                disabled={!!editingEntryId}
                                style={!!editingEntryId ? { ...inputStyle, width: '80px', height: '26px', textAlign: 'right', margin: '0 auto', background: '#f3f4f6', cursor: 'not-allowed' } : { ...inputStyle, width: '80px', height: '26px', textAlign: 'right', margin: '0 auto' }}
                              />
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <input
                                type="number"
                                value={mat.return_qty || ''}
                                onChange={(e) => updateMaterialEntry(index, 'return_qty', Number(e.target.value))}
                                disabled={!!editingEntryId}
                                style={!!editingEntryId ? { ...inputStyle, width: '80px', height: '26px', textAlign: 'right', margin: '0 auto', background: '#f3f4f6', cursor: 'not-allowed' } : { ...inputStyle, width: '80px', height: '26px', textAlign: 'right', margin: '0 auto' }}
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
                        <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', width: '70px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionEntries.map((entry: any) => (
                        <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>{entry.entry_no}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#4b5563' }}>{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '—'}</td>
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
                          <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              onClick={() => {
                                setFormData({
                                  job_card_id: entry.job_card_id || '',
                                  actual_qty: entry.actual_qty || 0,
                                  output_unit: entry.output_unit || 'nos',
                                  notes: entry.notes || '',
                                  production_start_time: entry.production_start_time?.split('T')[0] || '',
                                  production_end_time: entry.production_end_time?.split('T')[0] || '',
                                  operator_name: entry.operator_name || '',
                                  machine_name: entry.machine_name || '',
                                  scrap_byproducts: entry.scrap_byproducts || ''
                                });
                                setEditingEntryId(entry.id);
                                loadEntryForEdit(entry);
                              }}
                              title="Edit entry"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', borderRadius: '4px', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#185FA5'; e.currentTarget.style.background = '#eff6ff'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent'; }}
                              type="button"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(entry.id)}
                              title="Delete entry"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', borderRadius: '4px', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#e11d48'; e.currentTarget.style.background = '#fef2f2'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent'; }}
                              type="button"
                            >
                              <Trash2 size={13} />
                            </button>
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
                <div style={{ display: 'flex', justifyContent: 'space-between' }} className="flex justify-between">
                  <span style={{ color: '#6b7280' }}>Job Card:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{selectedJobCard?.job_card_no || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }} className="flex justify-between">
                  <span style={{ color: '#6b7280' }}>Planned Qty:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{selectedJobCard?.planned_qty || '-'} {selectedJobCard?.output_unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }} className="flex justify-between">
                  <span style={{ color: '#6b7280' }}>Previous Entries:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{cumulativeActualQty} {selectedJobCard?.output_unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }} className="flex justify-between">
                  <span style={{ color: '#6b7280' }}>This Entry:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{formData.actual_qty || 0} {formData.output_unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }} className="flex justify-between">
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>Total Actual:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{cumulativeActualQty + (formData.actual_qty || 0)} {selectedJobCard?.output_unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }} className="flex justify-between">
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

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => !deleteEntry.isPending && setDeleteTarget(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 8px 0' }}>Delete Production Entry?</h3>
            <p style={{ fontSize: '12px', color: '#4b5563', lineHeight: '18px', margin: '0 0 20px 0' }}>
              This will remove the entry and all associated material consumption records. 
              Stock movements already recorded will be automatically reversed. 
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', height: '36px' }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleteEntry.isPending}
                style={{
                  height: '36px', padding: '0 16px', border: '1px solid #d1d5db',
                  background: '#fff', color: '#4b5563', borderRadius: '8px',
                  fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
                }}
                type="button"
              >
                Cancel
              </button>
              <button onClick={() => deleteEntry.mutate({ entryId: deleteTarget, orgId: organisation?.id || '', userId: user?.id || '', userEmail: user?.email || 'Unknown' })} disabled={deleteEntry.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  height: '36px', padding: '0 16px', background: '#e11d48',
                  border: '1px solid #e11d48', color: '#fff', borderRadius: '8px',
                  fontSize: '12px', fontWeight: 600,
                  cursor: deleteEntry.isPending ? 'not-allowed' : 'pointer',
                  opacity: deleteEntry.isPending ? 0.6 : 1, transition: 'all 0.15s'
                }}
                type="button"
              >
                {deleteEntry.isPending && <Loader2 size={13} className="animate-spin" />}
                {deleteEntry.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
