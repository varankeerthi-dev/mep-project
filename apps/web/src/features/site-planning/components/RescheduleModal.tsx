import React, { useState } from 'react';
import { X, Calendar, AlertTriangle, CheckSquare, Clock } from 'lucide-react';
import { useRescheduleSitePlan } from '../hooks/useSitePlans';
import type { SitePlan } from '../types';

interface RescheduleModalProps {
  plan: SitePlan | null;
  isOpen: boolean;
  onClose: () => void;
}

const RESCHEDULE_REASONS = [
  'Client requested postponement',
  'Materials / equipment delivery delayed',
  'Site not ready / access denied by client',
  'Manpower shortage / crew reassignment',
  'Weather / safety stoppage',
  'Prior shutdown conflict',
  'Other operational constraint',
];

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  plan,
  isOpen,
  onClose,
}) => {
  const reschedule = useRescheduleSitePlan();
  const [newDate, setNewDate] = useState('');
  const [reasonCategory, setReasonCategory] = useState(RESCHEDULE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [clientAgreed, setClientAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !plan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) {
      setError('Please select a new target date');
      return;
    }
    if (newDate === plan.plan_date) {
      setError('New date must be different from current date');
      return;
    }

    const finalReason = reasonCategory === 'Other operational constraint'
      ? customReason.trim() || 'Other operational constraint'
      : `${reasonCategory}${customReason.trim() ? ` - ${customReason.trim()}` : ''}`;

    try {
      setError(null);
      await reschedule.mutateAsync({
        planId: plan.id,
        previousDate: plan.plan_date,
        newDate,
        reason: finalReason,
        clientAgreed,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to reschedule plan');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-xs p-4 sm:p-6 flex justify-center items-start pt-14 pb-14">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[calc(100vh-4.5rem)] animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Reschedule Site Plan</h2>
            <p className="text-xs text-slate-500">
              Shift scheduled date while recording audit reason and client agreement.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

          <div className="p-3 bg-slate-100 rounded-lg text-xs space-y-1">
            <div className="text-slate-500">Plan: <strong className="text-slate-900">{plan.plan_name}</strong></div>
            <div className="text-slate-500">Current Scheduled Date: <strong className="text-slate-900">{plan.plan_date}</strong></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>New Target Date <span className="text-red-500">*</span></span>
            </label>
            <input
              type="date"
              required
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Rescheduling <span className="text-red-500">*</span>
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            >
              {RESCHEDULE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Details / Root Cause
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Client plant manager confirmed delay due to civil works postponement."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start gap-2.5">
            <input
              type="checkbox"
              id="clientAgreed"
              checked={clientAgreed}
              onChange={(e) => setClientAgreed(e.target.checked)}
              className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="clientAgreed" className="text-xs text-blue-900 cursor-pointer">
              <strong>Client has confirmed and agreed to this new date</strong>
              <div className="text-[11px] text-blue-700/80 mt-0.5">
                If checked, client status marks Confirmed. If unchecked, status marks Postponement Requested.
              </div>
            </label>
          </div>

          </div>

          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reschedule.isPending}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {reschedule.isPending && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>Confirm & Record Reschedule</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
