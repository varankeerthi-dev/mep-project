import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../../../supabase';
import { Button } from '../../../components/ui/button';
import {
  useWorkCentersQuery,
  useCreateWorkCenterMutation,
  useBomWorkCentersQuery,
  useInsertBomWorkCenterMutation,
  useDeleteBomWorkCenterMutation
} from '../../../features/manufacturing';

type WorkCenterListProps = {
  onCancel: () => void;
};

export default function WorkCenterList({ onCancel }: WorkCenterListProps) {
  const { organisation } = useAuth();
  
  // Selected machine for BOM mapping on the right panel
  const [selectedWcId, setSelectedWcId] = useState<string | null>(null);

  // Form states for creating work center
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [wcType, setWcType] = useState<'machine' | 'assembly_line' | 'workstation'>('machine');
  const [capacity, setCapacity] = useState<number>(0);
  const [uom, setUom] = useState('Nos');

  // Form states for linking BOM to selected work center
  const [linkBomId, setLinkBomId] = useState('');
  const [cycleTime, setCycleTime] = useState<number>(1);
  const [setupTime, setSetupTime] = useState<number>(0);
  const [isPreferred, setIsPreferred] = useState(false);

  // Queries
  const { data: workCenters = [], isLoading: wcLoading } = useWorkCentersQuery(organisation?.id);

  // Fetch active BOMs
  const { data: boms = [] } = useQuery({
    queryKey: ['active-bom-headers', organisation?.id],
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

  // Fetch linked BOMs for the selected work center
  const { data: linkedBoms = [], isLoading: linkedLoading } = useQuery({
    queryKey: ['wc-linked-boms', selectedWcId],
    queryFn: async () => {
      if (!selectedWcId) return [];
      
      const { data, error } = await supabase
        .from('bom_work_centers')
        .select(`
          *,
          bom:bom_id (
            bom_code,
            product_name
          )
        `)
        .eq('work_center_id', selectedWcId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedWcId
  });

  const createWc = useCreateWorkCenterMutation();
  const insertLink = useInsertBomWorkCenterMutation();
  const deleteLink = useDeleteBomWorkCenterMutation();

  const handleCreateWc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      alert('Please enter machine name and code');
      return;
    }
    if (capacity <= 0) {
      alert('Capacity per hour must be greater than 0');
      return;
    }

    createWc.mutate({
      name,
      code,
      work_center_type: wcType,
      capacity_per_hour: capacity,
      capacity_uom: uom,
      hours_per_shift: 8.0,
      shifts_per_day: 1,
      is_active: true,
      organisation_id: organisation?.id || ''
    }, {
      onSuccess: () => {
        setName('');
        setCode('');
        setCapacity(0);
      }
    });
  };

  const handleLinkBom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWcId) return;
    if (!linkBomId) {
      alert('Please select a BOM');
      return;
    }
    if (cycleTime <= 0) {
      alert('Cycle time per unit must be greater than 0');
      return;
    }

    insertLink.mutate({
      bom_id: linkBomId,
      work_center_id: selectedWcId,
      cycle_time_minutes: cycleTime,
      setup_time_minutes: setupTime || 0,
      is_preferred: isPreferred,
      organisation_id: organisation?.id || ''
    }, {
      onSuccess: () => {
        setLinkBomId('');
        setCycleTime(1);
        setSetupTime(0);
        setIsPreferred(false);
      }
    });
  };

  const inputClass = "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none";

  const selectedWcName = workCenters.find(w => w.id === selectedWcId)?.name;

  return (
    <div style={{ minHeight: '100%', background: '#fafafa', paddingBottom: '40px' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <Button variant="secondary" size="icon-sm" onClick={onCancel} aria-label="Back">
          <ArrowLeft size={14} />
        </Button>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Work Centers & Machine Setup</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Define production machines and map product cycle times</span>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '24px' }}>
        
        {/* Left Form: Create Machine */}
        <div style={{ flex: '1 1 300px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            New Machine / Line
          </h3>

          <form onSubmit={handleCreateWc} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Machine Name *</label>
              <input
                type="text"
                placeholder="e.g. CNC Drilling Station"
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Machine Code *</label>
              <input
                type="text"
                placeholder="e.g. CNC-01"
                value={code}
                onChange={e => setCode(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Work Center Type</label>
              <select
                value={wcType}
                onChange={e => setWcType(e.target.value as any)}
                className={inputClass}
              >
                <option value="machine">Machine</option>
                <option value="assembly_line">Assembly Line</option>
                <option value="workstation">Workstation</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Capacity / Hour *</label>
                <input
                  type="number"
                  value={capacity || ''}
                  onChange={e => setCapacity(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>UOM</label>
                <input
                  type="text"
                  value={uom}
                  onChange={e => setUom(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <Button type="submit" disabled={createWc.isPending} loading={createWc.isPending} loadingText="Saving..." className="mt-2">Add Machine</Button>
          </form>
        </div>

        {/* Center: List of machines */}
        <div style={{ flex: '1.5 1 400px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            Machines List
          </h3>

          {wcLoading ? (
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
          ) : workCenters.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              No work centers defined yet. Propose new workstations in the left panel.
            </div>
          ) : (
            <div className="space-y-2">
              {workCenters.map(wc => {
                const isSelected = selectedWcId === wc.id;
                return (
                  <div
                    key={wc.id}
                    onClick={() => setSelectedWcId(wc.id!)}
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
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{wc.name} ({wc.code})</span>
                      <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'capitalize' }}>{wc.work_center_type}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#4b5563', display: 'block', marginTop: '4px' }}>
                      Nominal Output: <b>{wc.capacity_per_hour} {wc.capacity_uom}</b> / Hr
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Map BOM links to selected Machine */}
        <div style={{ flex: '1.5 1 400px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
            BOM Throughput Mapping {selectedWcName && `— ${selectedWcName}`}
          </h3>

          {!selectedWcId ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
              Select a work center from the list to map product compatibility and cycle throughput.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Mapping Form */}
              <form onSubmit={handleLinkBom} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#f9fafb', padding: '12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#4b5563' }}>Map BOM to Machine</span>
                <div>
                  <select
                    value={linkBomId}
                    onChange={e => setLinkBomId(e.target.value)}
                    className={inputClass}
                    required
                  >
                    <option value="">-- Choose BOM Product --</option>
                    {boms.map((bom: any) => (
                      <option key={bom.id} value={bom.id}>{bom.product_name} ({bom.bom_code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 500, color: '#4b5563', marginBottom: '2px' }}>Cycle Time (Mins/Unit)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cycleTime || ''}
                      onChange={e => setCycleTime(parseFloat(e.target.value) || 1)}
                      className={inputClass}
                      style={{ height: '24px' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 500, color: '#4b5563', marginBottom: '2px' }}>Setup Time (Mins)</label>
                    <input
                      type="number"
                      value={setupTime || ''}
                      onChange={e => setSetupTime(parseInt(e.target.value) || 0)}
                      className={inputClass}
                      style={{ height: '24px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                  <input
                    type="checkbox"
                    checked={isPreferred}
                    onChange={e => setIsPreferred(e.target.checked)}
                  />
                  <span>Preferred Machine for this product</span>
                </div>

                <Button type="submit" size="xs" disabled={insertLink.isPending} loading={insertLink.isPending} loadingText="Linking...">Map BOM Link</Button>
              </form>

              {/* Linked BOM list */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px' }}>Mapped Products</span>
                {linkedLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}><Loader2 size={12} className="animate-spin text-zinc-400" /></div>
                ) : linkedBoms.length === 0 ? (
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>No products mapped to this machine yet.</span>
                ) : (
                  <div className="space-y-2">
                    {linkedBoms.map((link: any) => (
                      <div key={link.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', border: '1px solid #f3f4f6', borderRadius: '4px', fontSize: '10px' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: '#111827', display: 'block' }}>{link.bom?.product_name}</span>
                          <span style={{ color: '#6b7280' }}>
                            Cycle: {link.cycle_time_minutes} min | Setup: {link.setup_time_minutes} min
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {link.is_preferred && (
                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                              <CheckCircle size={10} /> Pref
                            </span>
                          )}
                          <Button variant="ghost" size="icon-xs" onClick={() => deleteLink.mutate({ id: link.id, bomId: link.bom_id })} aria-label="Remove BOM link" className="text-red-500 hover:text-red-600">
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
