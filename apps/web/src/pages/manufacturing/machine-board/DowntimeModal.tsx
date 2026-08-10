import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { X, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { EntryContainer } from '../../../components/ui/EntryContainer';
import { Button } from '../../../components/ui/button';
import { WorkCenterMachine, MachineDowntime, logMachineDowntime, resolveMachineDowntime } from '../../../api/machineBoard';

interface DowntimeModalProps {
  machine: WorkCenterMachine;
  activeDowntime?: MachineDowntime | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DowntimeModal: React.FC<DowntimeModalProps> = ({
  machine,
  activeDowntime,
  onClose,
  onSuccess,
}) => {
  const { organisation, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [reasonCategory, setReasonCategory] = useState<MachineDowntime['reason_category']>('breakdown');
  const [reasonDetail, setReasonDetail] = useState('');

  const handleLogDowntime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;
    setSubmitting(true);

    const ok = await logMachineDowntime({
      machine_id: machine.id,
      reason_category: reasonCategory,
      reason_detail: reasonDetail,
      organisation_id: organisation.id,
      raised_by: user?.id,
    });

    setSubmitting(false);
    if (ok) {
      onSuccess();
      onClose();
    }
  };

  const handleResolveDowntime = async () => {
    if (!activeDowntime) return;
    setSubmitting(true);

    const ok = await resolveMachineDowntime(activeDowntime.id, machine.id, user?.id);

    setSubmitting(false);
    if (ok) {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 font-['Inter']">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertOctagon className="text-rose-600" size={20} /> Downtime Log – {machine.name}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </Button>
        </div>

        {activeDowntime ? (
          /* Resolving open downtime */
          <div className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs space-y-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-rose-600">
                Machine Currently In Breakdown / Maintenance
              </span>
              <p className="font-bold text-sm capitalize">{activeDowntime.reason_category.replace('_', ' ')}</p>
              {activeDowntime.reason_detail && <p className="text-rose-700">Details: {activeDowntime.reason_detail}</p>}
              <p className="text-slate-500 text-[11px] pt-1">
                Started at: {new Date(activeDowntime.downtime_start).toLocaleString()}
              </p>
            </div>

            <Button
              variant="success"
              fullWidth
              onClick={handleResolveDowntime}
              disabled={submitting}
              loading={submitting}
              loadingText="Resolving..."
              leftIcon={<CheckCircle2 size={16} />}
            >
              Mark Breakdown Resolved (Machine Back Up)
            </Button>
          </div>
        ) : (
          /* Logging new downtime */
          <form onSubmit={handleLogDowntime} className="space-y-3">
            <EntryContainer label="Reason Category *">
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value as any)}
                className="w-full h-11 px-3 text-sm rounded border border-slate-300 outline-none"
              >
                <option value="breakdown">Breakdown (Unplanned Failure)</option>
                <option value="planned_maintenance">Planned Maintenance (PM)</option>
                <option value="changeover">Mould Changeover</option>
                <option value="setup_trial">Setup / Trial Run</option>
                <option value="power_cut">Power Cut / Utility Loss</option>
                <option value="no_order">No Work Order / Idle</option>
              </select>
            </EntryContainer>

            <EntryContainer label="Downtime Details / Notes">
              <textarea
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                placeholder="e.g. Hydraulic oil leak, heater band failure, tool pin broken"
                className="w-full h-20 p-3 text-sm rounded border border-slate-300 outline-none"
              />
            </EntryContainer>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
              <Button variant="destructive" type="submit" disabled={submitting} loading={submitting} loadingText="Logging...">Log Downtime</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
