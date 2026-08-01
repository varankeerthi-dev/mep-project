import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, AlertTriangle, AlertCircle, Plus, Eye } from 'lucide-react';
import { supabase } from '../../../supabase';
import {
  useIPQCCheckpointsQuery,
  useIPQCInspectionsQuery,
  useCreateIPQCInspectionMutation
} from '../../../features/manufacturing';

type IPQCDashboardProps = {
  onNavigate?: (path: string) => void;
};

export default function IPQCDashboard({ onNavigate }: IPQCDashboardProps) {
  const { organisation, user } = useAuth();
  
  // Selected Job Card
  const [selectedJcId, setSelectedJcId] = useState<string | null>(null);
  
  // Inspection recording modal state
  const [activeCheckpointId, setActiveCheckpointId] = useState<string | null>(null);
  const [sampledQty, setSampledQty] = useState<number>(0);
  const [batchNo, setBatchNo] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Measured actuals state
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  // 1. Fetch active Job Cards
  const { data: jobCards = [], isLoading: jcLoading } = useQuery({
    queryKey: ['active-job-cards-ipqc', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('job_cards')
        .select(`
          id,
          job_card_no,
          status,
          bom_id,
          planned_qty,
          bom_headers (
            product_name,
            bom_code
          )
        `)
        .eq('organisation_id', organisation.id)
        .in('status', ['issued', 'in_progress']);

      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const selectedJc = jobCards.find(jc => jc.id === selectedJcId);

  // 2. Fetch Checkpoints
  const { data: checkpoints = [], isLoading: checkpointsLoading } = useIPQCCheckpointsQuery(selectedJc?.bom_id || undefined);

  // 3. Fetch Recorded Inspections
  const { data: inspections = [], isLoading: inspectionsLoading } = useIPQCInspectionsQuery(selectedJcId || undefined);

  const logInspectionMutation = useCreateIPQCInspectionMutation();

  const handleOpenLogModal = (cpId: string) => {
    setActiveCheckpointId(cpId);
    setSampledQty(0);
    setBatchNo(selectedJc?.job_card_no || '');
    setRemarks('');
    
    // Clear custom parameter inputs
    const cp = checkpoints.find(c => c.id === cpId);
    const initialValues: Record<string, string> = {};
    cp?.parameter_definitions.forEach(p => {
      initialValues[p.name] = '';
    });
    setParamValues(initialValues);
  };

  const handleParamValChange = (pname: string, val: string) => {
    setParamValues(prev => ({ ...prev, [pname]: val }));
  };

  const handleSubmitInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJcId || !activeCheckpointId || !organisation?.id) return;

    const cp = checkpoints.find(c => c.id === activeCheckpointId);
    if (!cp) return;

    // Verify parameter checks. If any is_pass is false, we can mark failed
    let allPassed = true;
    const parameterResults = cp.parameter_definitions.map(pd => {
      const val = paramValues[pd.name] || '';
      // A simple heuristic for specification matches (e.g. if target matches, or user can override)
      // For simplicity, we flag as pass if user enters a value. They can also check it manually.
      const isPass = val.trim().length > 0; // Customize validation based on tolerances
      if (!isPass) allPassed = false;

      return {
        name: pd.name,
        measured_value: val,
        is_pass: isPass
      };
    });

    // Determine final status
    const resultStatus = allPassed ? 'passed' : 'failed';

    logInspectionMutation.mutate({
      job_card_id: selectedJcId,
      checkpoint_id: activeCheckpointId,
      inspector_id: user?.id || null,
      result: resultStatus,
      parameter_results: parameterResults,
      sampled_qty: sampledQty || undefined,
      total_batch_qty: selectedJc?.planned_qty || undefined,
      remarks: remarks || undefined,
      organisation_id: organisation.id
    }, {
      onSuccess: () => {
        setActiveCheckpointId(null);
      }
    });
  };

  const inputClass = "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none";

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>In-Process Quality Control (IPQC)</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Record measurements against quality check sequences for active batches</span>
        </div>
        <div>
          <button
            onClick={() => onNavigate?.('/manufacturing/qc/ipqc/checkpoints')}
            style={{
              padding: '6px 12px',
              background: '#185FA5',
              border: 'none',
              color: '#fff',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Configure Checkpoints
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '24px' }}>
        
        {/* Left Panel: Active Job Cards */}
        <div style={{ flex: '1.2 1 350px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            Active Shop Floor Batches
          </h3>

          {jcLoading ? (
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
          ) : jobCards.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              No active job cards currently in progress on the shop floor.
            </div>
          ) : (
            <div className="space-y-2">
              {jobCards.map(jc => {
                const isSelected = selectedJcId === jc.id;
                return (
                  <div
                    key={jc.id}
                    onClick={() => { setSelectedJcId(jc.id); setActiveCheckpointId(null); }}
                    style={{
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : '#fff',
                      borderColor: isSelected ? '#3b82f6' : '#e5e7eb'
                    }}
                    className="hover:border-blue-400 transition-colors"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{jc.job_card_no}</span>
                      <span style={{ fontSize: '10px', textTransform: 'capitalize', color: '#6b7280' }}>{jc.status.replace('_', ' ')}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginTop: '4px' }}>
                      {jc.bom_headers?.product_name}
                    </span>
                    <span style={{ fontSize: '10px', color: '#9ca3af', display: 'block', marginTop: '2px' }}>
                      Batch Size: {jc.planned_qty}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel: Checkpoint checklist & inspection history */}
        <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!selectedJcId ? (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              Select an active production batch on the left to record quality inspections.
            </div>
          ) : (
            <>
              {/* Checkpoints Checklist */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
                  IPQC Checks Checklist
                </h3>

                {checkpointsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
                ) : checkpoints.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
                    No quality checkpoints configured for this product's BOM. Please configure checkpoints first.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 12px', width: '40px' }}>Seq</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500 }}>Checkpoint Step</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500 }}>Requirement</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500, width: '120px', textAlign: 'center' }}>QC Status</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500, width: '100px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkpoints.map(cp => {
                        const inspectionLog = inspections.find(ins => ins.checkpoint_id === cp.id);
                        
                        let statusTag = <span className="text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded text-[10px]">PENDING</span>;
                        if (inspectionLog) {
                          if (inspectionLog.result === 'passed') {
                            statusTag = <span className="text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1"><CheckCircle2 size={10} /> PASSED</span>;
                          } else if (inspectionLog.result === 'failed') {
                            statusTag = <span className="text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1"><AlertCircle size={10} /> FAILED</span>;
                          } else {
                            statusTag = <span className="text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1"><AlertTriangle size={10} /> CONDITIONAL</span>;
                          }
                        }

                        return (
                          <tr key={cp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>{cp.sequence}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>{cp.checkpoint_name}</td>
                            <td style={{ padding: '10px 12px', textTransform: 'uppercase', fontSize: '9px' }}>{cp.checkpoint_type}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>{statusTag}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleOpenLogModal(cp.id!)}
                                style={{
                                  padding: '4px 8px',
                                  border: '1px solid #d1d5db',
                                  background: '#fff',
                                  color: '#374151',
                                  fontSize: '10px',
                                  fontWeight: 500,
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Log check
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Side log Form if active */}
              {activeCheckpointId && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
                    Record Measurements — {checkpoints.find(c => c.id === activeCheckpointId)?.checkpoint_name}
                  </h3>

                  <form onSubmit={handleSubmitInspection} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Sampled Qty *</label>
                        <input
                          type="number"
                          value={sampledQty || ''}
                          onChange={e => setSampledQty(parseFloat(e.target.value) || 0)}
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Batch / Lot Reference *</label>
                        <input
                          type="text"
                          value={batchNo}
                          onChange={e => setBatchNo(e.target.value)}
                          className={inputClass}
                          required
                        />
                      </div>
                    </div>

                    {/* Custom defined parameters actuals input */}
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '8px' }}>Checkpoint Parameter Actuals:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {checkpoints.find(c => c.id === activeCheckpointId)?.parameter_definitions.map((pd, pidx) => (
                          <div key={pidx} className="grid grid-cols-2 gap-4 items-center">
                            <span style={{ fontSize: '11px', color: '#111827' }}>
                              {pd.name} (Spec: <b>{pd.spec} {pd.unit || ''}</b>)
                            </span>
                            <input
                              type="text"
                              placeholder="Enter measured value..."
                              value={paramValues[pd.name] || ''}
                              onChange={e => handleParamValChange(pd.name, e.target.value)}
                              className={inputClass}
                              style={{ height: '28px' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Inspection Remarks / Defects details</label>
                      <textarea
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        className={inputClass}
                        rows={2}
                        placeholder="Log any surface defects, bubble counts, or temperature tolerance deviations..."
                        style={{ resize: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setActiveCheckpointId(null)}
                        style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', fontSize: '11px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={logInspectionMutation.isPending}
                        style={{ padding: '6px 16px', background: '#185FA5', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {logInspectionMutation.isPending ? 'Saving...' : 'Save Inspection log'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
