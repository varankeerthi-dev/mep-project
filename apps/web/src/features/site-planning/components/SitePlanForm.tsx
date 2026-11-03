import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Users, Building, Briefcase, FileText, CheckCircle2 } from 'lucide-react';
import { useClients } from '../../../hooks/useClients';
import { useProjects } from '../../../hooks/useProjects';
import type { SitePlan, SitePlanStatus, ClientConfirmationStatus } from '../types';

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
  const [headcountRequired, setHeadcountRequired] = useState(2);
  const [planStatus, setPlanStatus] = useState<SitePlanStatus>('approved');
  const [confirmationStatus, setConfirmationStatus] = useState<ClientConfirmationStatus>('not_confirmed');
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
      setHeadcountRequired(initialData.headcount_required || 1);
      setPlanStatus(initialData.plan_status || 'approved');
      setConfirmationStatus(initialData.client_confirmation_status || 'not_confirmed');
      setNotes(initialData.notes || '');
    } else {
      setPlanName('');
      setClientId('');
      setProjectId('');
      setPlanDate(defaultDate || new Date().toISOString().split('T')[0]);
      setStartTime('09:00');
      setEndTime('18:00');
      setTrade('Electrical');
      setHeadcountRequired(2);
      setPlanStatus('approved');
      setConfirmationStatus('not_confirmed');
      setNotes('');
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
      await onSubmit({
        plan_name: planName.trim(),
        client_id: clientId || null,
        project_id: projectId || null,
        plan_date: planDate,
        start_time: startTime || null,
        end_time: endTime || null,
        trade,
        headcount_required: Number(headcountRequired) || 1,
        plan_status: planStatus,
        client_confirmation_status: confirmationStatus,
        notes: notes.trim() || null,
      });
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
