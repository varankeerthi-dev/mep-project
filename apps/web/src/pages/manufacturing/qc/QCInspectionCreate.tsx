import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { supabase } from '../../../supabase';
import {
  useQCParametersQuery,
  useCreateFGQCInspectionMutation,
  useJobCardDetailQuery
} from '../../../features/manufacturing';

type QCInspectionCreateProps = {
  onCancel: () => void;
  onSuccess: () => void;
};

export default function QCInspectionCreate({ onCancel, onSuccess }: QCInspectionCreateProps) {
  const { organisation, user } = useAuth();
  
  // Read query params for entryId
  const urlParams = new URLSearchParams(window.location.search);
  const entryId = urlParams.get('entry') || '';

  const [selectedEntryId, setSelectedEntryId] = useState(entryId);
  const [sampleSize, setSampleSize] = useState<number>(0);
  const [acceptedQty, setAcceptedQty] = useState<number>(0);
  const [rejectedQty, setRejectedQty] = useState<number>(0);
  const [reworkQty, setReworkQty] = useState<number>(0);
  const [inspectionResult, setInspectionResult] = useState<'pending' | 'accepted' | 'partially_accepted' | 'rejected'>('accepted');
  const [remarks, setRemarks] = useState('');

  // States for parameter measurements
  const [paramMeasuredValues, setParamMeasuredValues] = useState<Record<string, string>>({});
  const [paramPassStates, setParamPassStates] = useState<Record<string, boolean>>({});

  // 1. Fetch pending production entries that need QC (no inspection recorded yet)
  const { data: pendingEntries = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-qc-production-entries', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      // Select entries
      const { data: entries, error } = await supabase
        .from('production_entries')
        .select(`
          *,
          job_cards (
            bom_headers (
              product_id,
              product_name
            )
          )
        `)
        .eq('organisation_id', organisation.id);

      if (error) throw error;

      // Select already inspected entries IDs
      const { data: inspected, error: insErr } = await supabase
        .from('fg_qc_inspections')
        .select('production_entry_id')
        .eq('organisation_id', organisation.id);

      if (insErr) throw insErr;
      const inspectedIds = new Set(inspected.map((i: any) => i.production_entry_id).filter(Boolean));

      // Filter out already inspected ones
      return (entries || []).filter((e: any) => !inspectedIds.has(e.id));
    },
    enabled: !!organisation?.id
  });

  const selectedEntry = pendingEntries.find((e: any) => e.id === selectedEntryId);

  // Fetch job card
  const { data: jobCard } = useJobCardDetailQuery(selectedEntry?.job_card_id);
  const productId = selectedEntry?.job_cards?.bom_headers?.product_id || jobCard?.bom_headers?.product_id;
  const productName = selectedEntry?.job_cards?.bom_headers?.product_name || jobCard?.bom_headers?.product_name;

  // 2. Fetch parameters
  const { data: parameters = [], isLoading: parametersLoading } = useQCParametersQuery(
    organisation?.id,
    productId || undefined
  );

  // Auto populate produced quantity
  useEffect(() => {
    if (selectedEntry) {
      const qty = selectedEntry.actual_qty || 0;
      setAcceptedQty(qty);
      setRejectedQty(0);
      setReworkQty(0);
    }
  }, [selectedEntry]);

  // Handle quantity changes and auto-calculate overall result
  useEffect(() => {
    if (!selectedEntry) return;
    const total = acceptedQty + rejectedQty + reworkQty;
    const produced = selectedEntry.actual_qty || 0;

    if (total > 0) {
      if (acceptedQty === produced) {
        setInspectionResult('accepted');
      } else if (rejectedQty === produced) {
        setInspectionResult('rejected');
      } else {
        setInspectionResult('partially_accepted');
      }
    }
  }, [acceptedQty, rejectedQty, reworkQty, selectedEntry]);

  const createInspection = useCreateFGQCInspectionMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntryId) {
      alert('Please select a production entry');
      return;
    }

    const produced = selectedEntry.actual_qty || 0;
    const totalInput = acceptedQty + rejectedQty + reworkQty;
    if (totalInput !== produced) {
      alert(`Invalid quantities! Total quantities (Accepted: ${acceptedQty} + Rejected: ${rejectedQty} + Rework: ${reworkQty} = ${totalInput}) must equal produced quantity (${produced})`);
      return;
    }

    const resultsPayload = parameters.map(p => ({
      parameter_id: p.id!,
      measured_value: paramMeasuredValues[p.id!] || '',
      is_pass: paramPassStates[p.id!] ?? true,
      remarks: ''
    }));

    createInspection.mutate({
      inspection: {
        production_entry_id: selectedEntryId,
        job_card_id: selectedEntry.job_card_id,
        product_id: productId!,
        batch_no: selectedEntry.entry_no, // Use production entry number as batch/lot reference
        produced_qty: produced,
        sample_size: sampleSize || undefined,
        accepted_qty: acceptedQty,
        rejected_qty: rejectedQty,
        rework_qty: reworkQty,
        inspection_date: new Date().toISOString().split('T')[0],
        inspector_id: user?.id || null,
        inspection_result: inspectionResult,
        defect_categories: [],
        remarks: remarks || undefined
      },
      results: resultsPayload,
      orgId: organisation?.id || '',
      userId: user?.id || '',
      userName: user?.name || user?.email || 'Unknown'
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
        <Button variant="secondary" size="icon-sm" onClick={onCancel} aria-label="Back">
          <ArrowLeft size={14} />
        </Button>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Record QC Inspection</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Select production entry run and log inspection counts</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Core settings */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>Inspection Run Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Production Run Entry *</label>
              {pendingLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px' }}><Loader2 size={12} className="animate-spin text-zinc-400" /></div>
              ) : (
                <select
                  value={selectedEntryId}
                  onChange={e => setSelectedEntryId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">-- Choose Production Run --</option>
                  {pendingEntries.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.entry_no} (Product: {e.job_cards?.bom_headers?.product_name || 'Loading...'}, Qty: {e.actual_qty})</option>
                  ))}
                </select>
              )}
            </div>

            {selectedEntry && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Product Name</label>
                <input
                  type="text"
                  value={productName || ''}
                  className={inputClass}
                  disabled
                />
              </div>
            )}
          </div>
        </div>

        {selectedEntry && (
          <>
            {/* Quantities entry */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>Inspection Outcomes</h3>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>Produced Run Quantity: <b>{selectedEntry.actual_qty}</b></span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Sample Size Inspected</label>
                  <input
                    type="number"
                    value={sampleSize || ''}
                    onChange={e => setSampleSize(parseFloat(e.target.value) || 0)}
                    className={inputClass}
                    min={0}
                    placeholder="AQL Sample Count"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#10b981', marginBottom: '4px' }}>Accepted Qty (to FG Store)</label>
                  <input
                    type="number"
                    value={acceptedQty}
                    onChange={e => setAcceptedQty(parseFloat(e.target.value) || 0)}
                    className={inputClass}
                    min={0}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#ef4444', marginBottom: '4px' }}>Rejected Qty (to Rejection)</label>
                  <input
                    type="number"
                    value={rejectedQty}
                    onChange={e => setRejectedQty(parseFloat(e.target.value) || 0)}
                    className={inputClass}
                    min={0}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#3b82f6', marginBottom: '4px' }}>Rework Qty (to WIP)</label>
                  <input
                    type="number"
                    value={reworkQty}
                    onChange={e => setReworkQty(parseFloat(e.target.value) || 0)}
                    className={inputClass}
                    min={0}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', padding: '10px 16px', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: '#4b5563' }}>Overall Result Classification:</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: inspectionResult === 'accepted' ? '#10b981' : inspectionResult === 'rejected' ? '#ef4444' : '#f59e0b'
                }}>
                  {inspectionResult.split('_').map(w => w.toUpperCase()).join(' ')}
                </span>
              </div>
            </div>

            {/* Test specification parameter checklist */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
                Quality Parameter Checklist
              </h3>

              {parametersLoading ? (
                <div style={{ padding: '12px', display: 'flex', justifyContent: 'center' }}><Loader2 size={14} className="animate-spin text-zinc-400" /></div>
              ) : parameters.length === 0 ? (
                <div style={{ padding: '12px', background: '#fffbeb', color: '#b45309', borderRadius: '6px', fontSize: '11px', border: '1px solid #fde68a' }}>
                  No parameter specifications found for this product. You can log inspection outcomes and record summary remarks directly.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '6px 12px', fontWeight: 500 }}>Parameter Specification</th>
                      <th style={{ padding: '6px 12px', fontWeight: 500 }}>Target Threshold</th>
                      <th style={{ padding: '6px 12px', fontWeight: 500, width: '150px' }}>Measured value</th>
                      <th style={{ padding: '6px 12px', fontWeight: 500, width: '80px', textAlign: 'center' }}>Pass / Fail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parameters.map(param => (
                      <tr key={param.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111827' }}>
                          {param.parameter_name}
                          <span style={{ fontSize: '9px', color: '#9ca3af', display: 'block', textTransform: 'capitalize' }}>
                            Severity: {param.severity}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#4b5563' }}>{param.specification} {param.measurement_unit}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            placeholder="e.g. 10.2"
                            value={paramMeasuredValues[param.id!] || ''}
                            onChange={e => setParamMeasuredValues({ ...paramMeasuredValues, [param.id!]: e.target.value })}
                            className={inputClass}
                            style={{ height: '24px' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={paramPassStates[param.id!] ?? true}
                            onChange={e => setParamPassStates({ ...paramPassStates, [param.id!]: e.target.checked })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Remarks / Defect Details</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className={inputClass}
                placeholder="Details of inspections, categorisation of failures or action required..."
                rows={3}
                style={{ resize: 'none' }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
              <Button
                type="submit"
                disabled={createInspection.isPending}
                loading={createInspection.isPending}
                loadingText="Saving..."
                leftIcon={<Save size={14} />}
              >
                Confirm QC Result
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
