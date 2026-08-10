import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, ArrowLeft, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { supabase } from '../../../supabase';
import {
  useIPQCCheckpointsQuery,
  useCreateIPQCCheckpointMutation,
  useDeleteIPQCCheckpointMutation
} from '../../../features/manufacturing';

type IPQCCheckpointConfigProps = {
  onCancel: () => void;
};

export default function IPQCCheckpointConfig({ onCancel }: IPQCCheckpointConfigProps) {
  const { organisation } = useAuth();
  
  // Selected BOM for checkpoints mapping
  const [selectedBomId, setSelectedBomId] = useState<string | null>(null);

  // Form states for creating checkpoint
  const [sequence, setSequence] = useState<number>(1);
  const [checkpointName, setCheckpointName] = useState('');
  const [checkpointType, setCheckpointType] = useState<'mandatory' | 'optional'>('mandatory');

  // Form states for custom parameters (attributes list)
  const [paramName, setParamName] = useState('');
  const [paramSpec, setParamSpec] = useState('');
  const [paramUnit, setParamUnit] = useState('');
  const [paramSeverity, setParamSeverity] = useState('major');
  const [parameters, setParameters] = useState<Array<{ name: string; spec: string; unit?: string; severity?: string }>>([]);

  // Queries
  const { data: boms = [], isLoading: bomLoading } = useQuery({
    queryKey: ['active-bom-headers-for-ipqc', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('bom_headers')
        .select('id, product_name, bom_code')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const { data: checkpoints = [], isLoading: checkpointsLoading } = useIPQCCheckpointsQuery(selectedBomId || undefined);

  const createCheckpoint = useCreateIPQCCheckpointMutation();
  const deleteCheckpoint = useDeleteIPQCCheckpointMutation();

  const handleAddParam = () => {
    if (!paramName.trim() || !paramSpec.trim()) {
      alert('Please enter parameter name and specification');
      return;
    }
    setParameters(prev => [...prev, {
      name: paramName,
      spec: paramSpec,
      unit: paramUnit || undefined,
      severity: paramSeverity
    }]);
    setParamName('');
    setParamSpec('');
    setParamUnit('');
    setParamSeverity('major');
  };

  const handleRemoveParam = (index: number) => {
    setParameters(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBomId) {
      alert('Please select a BOM first');
      return;
    }
    if (!checkpointName.trim()) {
      alert('Please enter checkpoint name');
      return;
    }
    if (parameters.length === 0) {
      alert('Please add at least one quality parameter attribute check');
      return;
    }

    createCheckpoint.mutate({
      bom_id: selectedBomId,
      sequence: sequence || 1,
      checkpoint_name: checkpointName,
      checkpoint_type: checkpointType,
      parameter_definitions: parameters,
      organisation_id: organisation?.id || ''
    }, {
      onSuccess: () => {
        setCheckpointName('');
        setSequence(prev => prev + 1);
        setParameters([]);
      }
    });
  };

  const inputClass = "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none";

  const selectedBomName = boms.find(b => b.id === selectedBomId)?.product_name;

  return (
    <div style={{ minHeight: '100%', background: '#fafafa', paddingBottom: '40px' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <Button variant="secondary" size="icon-sm" onClick={onCancel} aria-label="Back">
          <ArrowLeft size={14} />
        </Button>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>In-Process QC Checkpoints Config</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Define step-wise quality parameters and tolerances per product line</span>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '24px' }}>
        
        {/* Left Side: Select BOM and view checkpoints list */}
        <div style={{ flex: '1.5 1 450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* BOM Selector */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Select Finished Good Product BOM</label>
            {bomLoading ? (
              <Loader2 className="animate-spin text-zinc-400" size={16} />
            ) : (
              <select
                value={selectedBomId || ''}
                onChange={e => { setSelectedBomId(e.target.value || null); setSequence(1); setParameters([]); }}
                className={inputClass}
              >
                <option value="">-- Choose BOM --</option>
                {boms.map((bom: any) => (
                  <option key={bom.id} value={bom.id}>{bom.product_name} ({bom.bom_code})</option>
                ))}
              </select>
            )}
          </div>

          {/* Checkpoints Timeline */}
          {selectedBomId && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
                Configured Checkpoints Timeline
              </h3>

              {checkpointsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
              ) : checkpoints.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
                  No checkpoints configured yet for this BOM. Set up checkpoints on the right to enforce shop floor inspections.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {checkpoints.map(cp => (
                    <div key={cp.id} style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #f9fafb', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: '50%', color: '#3b82f6', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                        {cp.sequence}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                            {cp.checkpoint_name}
                            <span style={{ marginLeft: '6px', fontSize: '9px', fontWeight: 500 }} className={cp.checkpoint_type === 'mandatory' ? 'text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded' : 'text-zinc-600 bg-zinc-50 border border-zinc-200 px-1 py-0.5 rounded'}>
                              {cp.checkpoint_type.toUpperCase()}
                            </span>
                          </span>
                          <Button variant="ghost" size="icon-xs" onClick={() => deleteCheckpoint.mutate({ id: cp.id!, bomId: cp.bom_id })} aria-label="Delete checkpoint" className="text-red-500 hover:text-red-600">
                            <Trash2 size={12} />
                          </Button>
                        </div>
                        
                        {/* Parameters checklist */}
                        <div style={{ marginTop: '8px', background: '#f9fafb', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {cp.parameter_definitions.map((pd, pidx) => (
                            <div key={pidx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#4b5563' }}>
                              <span>• {pd.name}</span>
                              <span style={{ fontWeight: 500 }}>Spec: {pd.spec} {pd.unit || ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Setup new Checkpoint Form */}
        <div style={{ flex: '1.5 1 450px' }}>
          {!selectedBomId ? (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              Select a BOM on the left to add quality checkpoints.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '8px' }}>
                Add Checkpoint to {selectedBomName}
              </h3>

              <form onSubmit={handleCreateCheckpoint} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="grid grid-cols-3 gap-3">
                  <div style={{ gridColumn: 'span 1' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Seq No *</label>
                    <input
                      type="number"
                      value={sequence}
                      onChange={e => setSequence(parseInt(e.target.value) || 1)}
                      className={inputClass}
                      required
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Checkpoint Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Mold Dimensions Check"
                      value={checkpointName}
                      onChange={e => setCheckpointName(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Requirement Type</label>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="radio"
                        name="checkpoint_type"
                        checked={checkpointType === 'mandatory'}
                        onChange={() => setCheckpointType('mandatory')}
                      />
                      Mandatory (Halts production if fails)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="radio"
                        name="checkpoint_type"
                        checked={checkpointType === 'optional'}
                        onChange={() => setCheckpointType('optional')}
                      />
                      Optional
                    </label>
                  </div>
                </div>

                {/* Sub-Form: Add Parameters (Attributes) */}
                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', border: '1px dashed #d1d5db', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#374151' }}>Define Parameter Checks</span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        placeholder="Parameter Name (e.g. Wall Thickness)"
                        value={paramName}
                        onChange={e => setParamName(e.target.value)}
                        className={inputClass}
                        style={{ height: '26px' }}
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Specification (e.g. 2.0 ± 0.1)"
                        value={paramSpec}
                        onChange={e => setParamSpec(e.target.value)}
                        className={inputClass}
                        style={{ height: '26px' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div style={{ gridColumn: 'span 1' }}>
                      <input
                        type="text"
                        placeholder="Unit (e.g. mm)"
                        value={paramUnit}
                        onChange={e => setParamUnit(e.target.value)}
                        className={inputClass}
                        style={{ height: '26px' }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <select
                        value={paramSeverity}
                        onChange={e => setParamSeverity(e.target.value)}
                        className={inputClass}
                        style={{ height: '26px', padding: '0 8px' }}
                      >
                        <option value="minor">Minor Defect</option>
                        <option value="major">Major Defect</option>
                        <option value="critical">Critical Defect</option>
                      </select>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="xs"
                    type="button"
                    onClick={handleAddParam}
                    className="self-start"
                  >
                    Add Parameter check
                  </Button>

                  {/* Added parameters list preview */}
                  {parameters.length > 0 && (
                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {parameters.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', background: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #f3f4f6' }}>
                          <span>{p.name} (Spec: {p.spec} {p.unit || ''})</span>
                          <Button variant="ghost" size="icon-xs" type="button" onClick={() => handleRemoveParam(idx)} aria-label="Remove parameter" className="text-red-500 hover:text-red-600">
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={createCheckpoint.isPending || parameters.length === 0}
                  loading={createCheckpoint.isPending}
                  loadingText="Saving..."
                >
                  Add Checkpoint Sequence
                </Button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
