import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { X, CheckCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { EntryContainer } from '../../../components/ui/EntryContainer';
import { Button } from '../../../components/ui/button';
import { WorkCenterMachine, ManufacturingTooling, checkToolingMachineCompatibility } from '../../../api/machineBoard';

interface MachineBoardDrawerProps {
  machine: WorkCenterMachine;
  currentTooling?: ManufacturingTooling | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const MachineBoardDrawer: React.FC<MachineBoardDrawerProps> = ({
  machine,
  currentTooling: mountedTooling,
  onClose,
  onSuccess,
}) => {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Available Products / BOMs
  const [boms, setBoms] = useState<any[]>([]);
  const [availableToolings, setAvailableToolings] = useState<ManufacturingTooling[]>([]);

  // Selected State
  const [selectedBomId, setSelectedBomId] = useState<string>('');
  const [selectedToolingId, setSelectedToolingId] = useState<string>(mountedTooling?.id || '');
  const [runningCavities, setRunningCavities] = useState<number>(mountedTooling?.no_of_cavities || 1);
  const [plannedQty, setPlannedQty] = useState<number>(1000);
  const [shiftName, setShiftName] = useState<string>('Morning Shift');

  // Compatibility Warnings
  const [compatibility, setCompatibility] = useState<{ isCompatible: boolean; warnings: string[] }>({
    isCompatible: true,
    warnings: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!organisation?.id) return;
      setLoading(true);

      // Fetch active BOMs
      const { data: bomData } = await supabase
        .from('bom_headers')
        .select('id, bom_code, product_name, product_id, output_qty, materials(id, name)')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true);

      setBoms(bomData || []);

      // Fetch available toolings
      const { data: toolingData } = await supabase
        .from('manufacturing_tooling')
        .select('*')
        .eq('organisation_id', organisation.id);

      setAvailableToolings(toolingData || []);
      setLoading(false);
    };

    fetchData();
  }, [organisation?.id]);

  // Update selected tooling cavity count and compatibility when selectedToolingId changes
  useEffect(() => {
    const selectedT = availableToolings.find((t) => t.id === selectedToolingId) || mountedTooling;
    if (selectedT) {
      if (selectedT.no_of_cavities) {
        setRunningCavities(selectedT.no_of_cavities);
      }
      const comp = checkToolingMachineCompatibility(selectedT, machine);
      setCompatibility(comp);
    }
  }, [selectedToolingId, availableToolings, mountedTooling, machine]);

  // Compute calculated metrics
  const activeTooling = availableToolings.find((t) => t.id === selectedToolingId) || mountedTooling;
  const cycleTimeSec = activeTooling?.cycle_time_seconds || 20;
  const cav = runningCavities > 0 ? runningCavities : 1;
  const plannedShots = Math.ceil(plannedQty / cav);
  const estDurationHours = ((plannedShots * Number(cycleTimeSec)) / 3600).toFixed(1);

  const handleCreateJobCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBomId) {
      alert('Please select a product / BOM');
      return;
    }

    setSubmitting(true);
    try {
      const selectedBom = boms.find((b) => b.id === selectedBomId);

      // Create new Job Card
      const jobCardPayload = {
        job_card_number: `JC-${Date.now().toString().slice(-6)}`,
        bom_id: selectedBomId,
        product_name: selectedBom?.product_name || selectedBom?.materials?.name || 'Product',
        product_id: selectedBom?.product_id || null,
        target_qty: plannedQty,
        planned_qty: plannedQty,
        work_center_id: machine.id,
        machine_id: machine.id,
        tooling_id: selectedToolingId || null,
        running_cavities: runningCavities,
        planned_shots: plannedShots,
        planned_cycle_time_sec: Number(cycleTimeSec),
        shift_name: shiftName,
        status: 'in_progress',
        organisation_id: organisation?.id,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('job_cards').insert(jobCardPayload);

      if (error) {
        if (error.message?.includes('uq_tooling_reserved')) {
          alert('This tooling is currently reserved by another active Job Card!');
        } else {
          throw error;
        }
        return;
      }

      // Update machine status to running
      await supabase
        .from('work_centers')
        .update({
          machine_status: 'running',
          current_tooling_id: selectedToolingId || null,
        })
        .eq('id', machine.id);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating job card:', err);
      alert('Failed to plan machine: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between p-6 overflow-y-auto font-['Inter']">
        <div>
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6">
            <div>
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                Plan Machine
              </span>
              <h2 className="text-lg font-bold text-slate-900">{machine.name} ({machine.code})</h2>
              <p className="text-xs text-slate-500">Tonnage: {machine.clamping_force_tonnes || 'N/A'}T</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
          ) : (
            <form onSubmit={handleCreateJobCard} className="space-y-4">
              {/* ADAPTIVE FLOW */}
              {mountedTooling ? (
                /* Branch A: Tooling Mounted */
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                  <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                    <CheckCircle size={14} /> Tooling Pre-Mounted
                  </span>
                  <p className="text-xs text-emerald-900 font-bold">{mountedTooling.tooling_name} ({mountedTooling.no_of_cavities} cavities)</p>
                  <p className="text-[11px] text-emerald-700">Machine is ready with this tooling mounted.</p>
                </div>
              ) : (
                /* Branch B: Idle Machine -> Tooling Selector */
                <EntryContainer label="Select Mould / Tooling">
                  <select
                    value={selectedToolingId}
                    onChange={(e) => setSelectedToolingId(e.target.value)}
                    className="w-full h-11 px-3 text-sm rounded border border-slate-300 outline-none"
                  >
                    <option value="">-- Choose Compatible Tooling --</option>
                    {availableToolings.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.tooling_name} ({t.no_of_cavities} cav, {t.cycle_time_seconds || 20}s)
                      </option>
                    ))}
                  </select>
                </EntryContainer>
              )}

              {/* Product / BOM Selector */}
              <EntryContainer label="Select Product / BOM *">
                <select
                  value={selectedBomId}
                  onChange={(e) => setSelectedBomId(e.target.value)}
                  className="w-full h-11 px-3 text-sm rounded border border-slate-300 outline-none"
                  required
                >
                  <option value="">-- Choose Product BOM --</option>
                  {boms.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.product_name || b.materials?.name} ({b.bom_code})
                    </option>
                  ))}
                </select>
              </EntryContainer>

              {/* Compatibility Warnings Badge */}
              {!compatibility.isCompatible && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <AlertTriangle size={14} /> Tonnage / Shot Weight Warning
                  </div>
                  {compatibility.warnings.map((w, idx) => (
                    <p key={idx} className="text-[11px]">• {w}</p>
                  ))}
                </div>
              )}

              {/* Planned Quantities & Cavity override */}
              <div className="grid grid-cols-2 gap-3">
                <EntryContainer label="Running Cavities *">
                  <input
                    type="number"
                    value={runningCavities}
                    onChange={(e) => setRunningCavities(Math.max(1, Number(e.target.value)))}
                    className="w-full h-11 px-3 text-sm rounded border border-slate-300 outline-none"
                    required
                  />
                </EntryContainer>

                <EntryContainer label="Planned Quantity *">
                  <input
                    type="number"
                    value={plannedQty}
                    onChange={(e) => setPlannedQty(Math.max(1, Number(e.target.value)))}
                    className="w-full h-11 px-3 text-sm rounded border border-slate-300 outline-none"
                    required
                  />
                </EntryContainer>
              </div>

              <EntryContainer label="Shift">
                <select
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  className="w-full h-11 px-3 text-sm rounded border border-slate-300 outline-none"
                >
                  <option value="Morning Shift">Morning Shift (06:00 - 14:00)</option>
                  <option value="General Shift">General Shift (09:00 - 17:30)</option>
                  <option value="Night Shift">Night Shift (22:00 - 06:00)</option>
                </select>
              </EntryContainer>

              {/* Auto-calculated Summary Box */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex justify-between text-indigo-900">
                  <span>Planned Shots:</span>
                  <span className="font-bold">{plannedShots.toLocaleString()} shots</span>
                </div>
                <div className="flex justify-between text-indigo-900">
                  <span>Cycle Time:</span>
                  <span className="font-bold">{cycleTimeSec}s / shot</span>
                </div>
                <div className="flex justify-between text-indigo-900 pt-1 border-t border-indigo-200 font-bold">
                  <span>Estimated Duration:</span>
                  <span>~{estDurationHours} hours</span>
                </div>
              </div>

              <Button
                type="submit"
                fullWidth
                disabled={submitting}
                loading={submitting}
                loadingText="Creating Job Card..."
                rightIcon={<ArrowRight size={16} />}
                className="mt-4 py-3"
              >
                Confirm & Generate Job Card
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
