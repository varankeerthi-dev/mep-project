import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, Users, Building, Briefcase, 
  FileText, CheckCircle2, ShieldCheck, AlertCircle, Wrench, Flame 
} from 'lucide-react';
import { useClients } from '../../../hooks/useClients';
import { useProjects } from '../../../hooks/useProjects';
import type { SitePlan, SitePlanStatus, ClientConfirmationStatus, WorkType } from '../types';

interface SitePlanFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<SitePlan>) => Promise<void>;
  initialData?: SitePlan | null;
  defaultDate?: string;
}

const MEP_TRADES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Firefighting',
  'Ductman',
  'Insulation',
  'Fabrication / Welder',
  'Helper',
  'Multi-skilled MEP',
  'General',
];

function getTodayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const SitePlanForm: React.FC<SitePlanFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  defaultDate,
}) => {
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();

  const [planName, setPlanName] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [trade, setTrade] = useState('Electrical');
  const [workType, setWorkType] = useState<WorkType>('erection_project');
  const [headcountRequired, setHeadcountRequired] = useState(2);
  const [planStatus, setPlanStatus] = useState<SitePlanStatus>('approved');
  const [confirmationStatus, setConfirmationStatus] = useState<ClientConfirmationStatus>('not_confirmed');
  
  // 4-Point Site Readiness Checklist
  const [siteAccessCleared, setSiteAccessCleared] = useState(false);
  const [permitsApproved, setPermitsApproved] = useState(false);
  const [materialsStaged, setMaterialsStaged] = useState(false);
  const [toolsDispatched, setToolsDispatched] = useState(false);

  // Operational Specs
  const [ptwNotes, setPtwNotes] = useState('');
  const [toolsRequired, setToolsRequired] = useState('');
  const [emergencySlaDeadline, setEmergencySlaDeadline] = useState('');
  const [repeatDays, setRepeatDays] = useState(1);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setPlanName(initialData.plan_name || '');
      setClientId(initialData.client_id || '');
      setProjectId(initialData.project_id || '');
      setPlanDate(initialData.plan_date || '');
      setStartTime(initialData.start_time ? initialData.start_time.slice(0, 5) : '09:00');
      setEndTime(initialData.end_time ? initialData.end_time.slice(0, 5) : '18:00');
      setTrade(initialData.trade || 'Electrical');
      setWorkType(initialData.work_type || 'erection_project');
      setHeadcountRequired(initialData.headcount_required || 1);
      setPlanStatus(initialData.plan_status || 'approved');
      setConfirmationStatus(initialData.client_confirmation_status || 'not_confirmed');
      setSiteAccessCleared(Boolean(initialData.site_access_cleared));
      setPermitsApproved(Boolean(initialData.permits_approved));
      setMaterialsStaged(Boolean(initialData.materials_staged));
      setToolsDispatched(Boolean(initialData.tools_dispatched));
      setPtwNotes(initialData.ptw_notes || '');
      setToolsRequired(initialData.tools_required || '');
      setEmergencySlaDeadline(initialData.emergency_sla_deadline ? initialData.emergency_sla_deadline.slice(0, 16) : '');
      setNotes(initialData.notes || '');
      setRepeatDays(1);
    } else {
      setPlanName('');
      setClientId('');
      setProjectId('');
      setPlanDate(defaultDate || getTodayLocalDate());
      setStartTime('09:00');
      setEndTime('18:00');
      setTrade('Electrical');
      setWorkType('erection_project');
      setHeadcountRequired(2);
      setPlanStatus('approved');
      setConfirmationStatus('not_confirmed');
      setSiteAccessCleared(false);
      setPermitsApproved(false);
      setMaterialsStaged(false);
      setToolsDispatched(false);
      setPtwNotes('');
      setToolsRequired('');
      setEmergencySlaDeadline('');
      setNotes('');
      setRepeatDays(1);
    }
    setError(null);
  }, [initialData, defaultDate, isOpen]);

  // Filter projects by selected client if applicable
  const filteredProjects = projects.filter((p: any) => !clientId || p.client_id === clientId);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) {
      setError('Please provide a plan title or work description');
      return;
    }
    if (!planDate) {
      setError('Please select a target work date');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const daysToCreate = !initialData && repeatDays > 1 ? repeatDays : 1;
      const baseDate = new Date(planDate);

      for (let i = 0; i < daysToCreate; i++) {
        const currentDate = new Date(baseDate);
        currentDate.setDate(baseDate.getDate() + i);
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const targetDateStr = `${y}-${m}-${d}`;

        await onSubmit({
          plan_name: daysToCreate > 1 ? `${planName.trim()} (Day ${i + 1}/${daysToCreate})` : planName.trim(),
          client_id: clientId || null,
          project_id: projectId || null,
          plan_date: targetDateStr,
          start_time: startTime || null,
          end_time: endTime || null,
          trade,
          work_type: workType,
          headcount_required: Number(headcountRequired) || 1,
          plan_status: planStatus,
          client_confirmation_status: confirmationStatus,
          site_access_cleared: siteAccessCleared,
          permits_approved: permitsApproved,
          materials_staged: materialsStaged,
          tools_dispatched: toolsDispatched,
          ptw_notes: ptwNotes.trim() || null,
          tools_required: toolsRequired.trim() || null,
          emergency_sla_deadline: workType === 'service_breakdown' && emergencySlaDeadline ? new Date(emergencySlaDeadline).toISOString() : null,
          notes: notes.trim() || null,
        });
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save site plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {initialData ? 'Edit Site Plan' : 'Schedule New Site Plan'}
            </h2>
            <p className="text-xs text-slate-500">
              Establish site workforce requirements, dates, client confirmation, and trade assignments.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {/* Plan Name / Scope */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Plan Title / Work Scope <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., AHU Duct Installation & Cable Tray Laying"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent"
            />
          </div>

          {/* Work Activity Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Work Activity Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: 'erection_project', label: 'EPC Erection', desc: 'Project Milestone', color: 'border-blue-400 bg-blue-50/50 text-blue-900' },
                { id: 'service_breakdown', label: 'Emergency Service', desc: 'SLA Breakdown', color: 'border-red-400 bg-red-50/50 text-red-900' },
                { id: 'amc_ppm', label: 'AMC Maintenance', desc: 'Preventive PPM', color: 'border-emerald-400 bg-emerald-50/50 text-emerald-900' },
                { id: 'other', label: 'Other Activity', desc: 'Audit / Survey', color: 'border-slate-300 bg-slate-50 text-slate-800' },
              ].map((wt) => (
                <button
                  key={wt.id}
                  type="button"
                  onClick={() => setWorkType(wt.id as WorkType)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    workType === wt.id
                      ? `${wt.color} ring-2 ring-[var(--brand)] font-bold shadow-xs`
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="text-xs font-semibold">{wt.label}</div>
                  <div className="text-[10px] text-slate-500">{wt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Client & Project Linkage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>Client</span>
              </label>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setProjectId('');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option value="">-- Optional / Internal MEP --</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.client_name || c.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>Project (Optional)</span>
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option value="">-- No Linked Project --</option>
                {filteredProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name || p.name} {p.project_code ? `(${p.project_code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Time Window */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Target Date <span className="text-red-500">*</span></span>
              </label>
              <input
                type="date"
                required
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Shift Start</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Shift End</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>
          </div>

          {workType === 'service_breakdown' && (
            <div className="p-3 bg-red-50/70 border border-red-200 rounded-lg">
              <label className="block text-xs font-bold text-red-800 mb-1 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-red-600" />
                <span>Emergency SLA Resolution Deadline</span>
              </label>
              <input
                type="datetime-local"
                value={emergencySlaDeadline}
                onChange={(e) => setEmergencySlaDeadline(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-red-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500"
              />
              <p className="text-[10px] text-red-600 mt-1">
                Contractual penalty or breach threshold for customer resolution.
              </p>
            </div>
          )}

          {/* 4-Point Site Readiness Checklist */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Site Readiness Checklist (4 Gates)</span>
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                Score: {[siteAccessCleared, permitsApproved, materialsStaged, toolsDispatched].filter(Boolean).length}/4
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={siteAccessCleared}
                  onChange={(e) => setSiteAccessCleared(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Site Access & Gate Pass</span>
                  <span className="text-[10px] text-slate-500">Security clearance / inductions done</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={permitsApproved}
                  onChange={(e) => setPermitsApproved(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Permits to Work (PTW)</span>
                  <span className="text-[10px] text-slate-500">Hot work / Height permit approved</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={materialsStaged}
                  onChange={(e) => setMaterialsStaged(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Materials Staged on Site</span>
                  <span className="text-[10px] text-slate-500">Ducts, pipes, wires physically at site</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={toolsDispatched}
                  onChange={(e) => setToolsDispatched(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Tools & Plant (T&P) Ready</span>
                  <span className="text-[10px] text-slate-500">Vacuum pumps, brazing kits assigned</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Permit Numbers / Safety Protocols
                </label>
                <input
                  type="text"
                  placeholder="e.g. HW-409 (Hot Work valid till 6 PM)"
                  value={ptwNotes}
                  onChange={(e) => setPtwNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Machinery & Instruments Required
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2-stage vacuum pump, 410A gauges"
                  value={toolsRequired}
                  onChange={(e) => setToolsRequired(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {!initialData && (
            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Multi-Day EPC Repeat</span>
                <span className="text-[10px] text-slate-500">
                  Automatically create consecutive daily plans for long installations.
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-slate-600">Repeat for:</span>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={repeatDays}
                  onChange={(e) => setRepeatDays(Math.min(14, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-16 px-2 py-1 text-xs border border-blue-300 rounded bg-white font-bold text-center"
                />
                <span className="text-xs text-slate-600">days</span>
              </div>
            </div>
          )}

          {/* Trade & Headcount Demand */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Trade Required
              </label>
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              >
                {MEP_TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Required Headcount <span className="text-red-500">*</span></span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={headcountRequired}
                onChange={(e) => setHeadcountRequired(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>
          </div>

          {/* Status Dimensions: Approval vs Client Confirmation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Plan Status
              </label>
              <select
                value={planStatus}
                onChange={(e) => setPlanStatus(e.target.value as SitePlanStatus)}
                className="w-full px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
              >
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client Confirmation
              </label>
              <select
                value={confirmationStatus}
                onChange={(e) => setConfirmationStatus(e.target.value as ClientConfirmationStatus)}
                className="w-full px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
              >
                <option value="not_confirmed">Not Confirmed (Tentative)</option>
                <option value="confirmed">Confirmed by Client</option>
                <option value="postponement_requested">Postponement Requested</option>
                <option value="cancelled">Client Cancelled</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Site Access Instructions / PPE & Tooling Notes</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Gate pass required; Safety boots and helmets mandatory; Welding generator on-site."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-[var(--brand)] rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{initialData ? 'Update Plan' : 'Create Site Plan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
