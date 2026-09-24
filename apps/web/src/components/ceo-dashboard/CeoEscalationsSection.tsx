import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Flame,
  UserCheck,
  Check,
  X,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCeoCurrency, formatCeoDate } from './utils/ceoFormatters';
import type { CeoApprovalItem } from './hooks/useCeoDashboardData';
import type { WorkStoppageWithReport } from '@/types/siteReportStoppage';
import type { BudgetAlert } from '@/hooks/useBudgetAlerts';
import type { ActionModalType } from './CeoActionModal';

interface CeoEscalationsSectionProps {
  approvals: CeoApprovalItem[];
  stoppages: WorkStoppageWithReport[];
  budgetAlerts: BudgetAlert[];
  onOpenAction: (modal: ActionModalType) => void;
  onNavigate: (href: string) => void;
}

export const CeoEscalationsSection: React.FC<CeoEscalationsSectionProps> = ({
  approvals,
  stoppages,
  budgetAlerts,
  onOpenAction,
  onNavigate,
}) => {
  const highPriorityApprovals = approvals.filter(
    (a) => a.priority === 'HIGH' || a.priority === 'URGENT' || (a.amount && a.amount >= 50000)
  );

  const criticalBudgetAlerts = budgetAlerts.filter((b) => b.isOverBudget);

  const hasEscalations = stoppages.length > 0 || highPriorityApprovals.length > 0 || criticalBudgetAlerts.length > 0;

  if (!hasEscalations) {
    return (
      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-emerald-950">Executive Operations All-Clear</h3>
            <p className="text-xs text-emerald-700 mt-0.5">
              Zero active work stoppages, no critical budget overruns, and no high-priority approval bottlenecks.
            </p>
          </div>
        </div>
        <div className="text-xs text-emerald-800 font-medium">100% Operational Health</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-rose-200/90 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-rose-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              Critical Escalations & Executive Interventions
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700">
                {stoppages.length + highPriorityApprovals.length + criticalBudgetAlerts.length} Action Items
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              High-impact bottlenecks requiring CEO authorization or immediate intervention
            </p>
          </div>
        </div>
        <div className="text-[11px] text-zinc-400">Direct 1-Click Resolution Enabled</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Site Work Stoppages */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
            <span className="flex items-center gap-1.5 text-rose-700">
              <ShieldAlert className="w-3.5 h-3.5" />
              Work Stoppages ({stoppages.length})
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/site-reports')}
              className="text-[11px] text-zinc-400 hover:text-zinc-700 flex items-center gap-0.5"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {stoppages.length === 0 ? (
            <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200/60 text-xs text-zinc-400 text-center">
              No active site stoppages
            </div>
          ) : (
            stoppages.slice(0, 4).map((s) => (
              <div
                key={s.id}
                className="p-3 bg-rose-50/40 rounded-lg border border-rose-200/70 text-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-zinc-900 block">
                      {s.category || 'Site Interruption'}
                    </span>
                    <span className="text-[11px] text-zinc-500 line-clamp-1">
                      {s.affected_work || s.reason_detail || 'Work blocked on site'}
                    </span>
                  </div>
                  {s.blocking_party && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 shrink-0">
                      {s.blocking_party}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-rose-100/70">
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Target: {formatCeoDate(s.expected_resolution_date)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2 border-rose-300 text-rose-800 hover:bg-rose-100"
                    onClick={() => onOpenAction({ kind: 'stoppage', item: s })}
                  >
                    <Wrench className="w-3 h-3 mr-1" />
                    Resolve
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Column 2: High-Priority Executive Approvals */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
            <span className="flex items-center gap-1.5 text-amber-700">
              <UserCheck className="w-3.5 h-3.5" />
              Pending Sign-Offs ({highPriorityApprovals.length})
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/approvals')}
              className="text-[11px] text-zinc-400 hover:text-zinc-700 flex items-center gap-0.5"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {highPriorityApprovals.length === 0 ? (
            <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200/60 text-xs text-zinc-400 text-center">
              No high-priority approvals pending
            </div>
          ) : (
            highPriorityApprovals.slice(0, 4).map((a) => (
              <div
                key={a.id}
                className="p-3 bg-amber-50/30 rounded-lg border border-amber-200/70 text-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-zinc-900 block truncate">{a.title}</span>
                    <span className="text-[11px] text-zinc-500">
                      {a.approval_type} &bull; {a.requester_name || 'Staff'}
                    </span>
                  </div>
                  {a.amount !== null && (
                    <span
                      className="font-bold text-zinc-900 text-left shrink-0"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatCeoCurrency(a.amount, true)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-amber-100/70">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2 text-rose-700 border-rose-200 hover:bg-rose-50"
                    onClick={() => onOpenAction({ kind: 'approval', item: a, action: 'REJECTED' })}
                  >
                    <X className="w-3 h-3 mr-0.5" />
                    Reject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => onOpenAction({ kind: 'approval', item: a, action: 'APPROVED' })}
                  >
                    <Check className="w-3 h-3 mr-0.5" />
                    Approve
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Column 3: Critical Budget Overruns */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
            <span className="flex items-center gap-1.5 text-zinc-800">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Budget Overruns ({criticalBudgetAlerts.length})
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/reports')}
              className="text-[11px] text-zinc-400 hover:text-zinc-700 flex items-center gap-0.5"
            >
              Reports <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {criticalBudgetAlerts.length === 0 ? (
            <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200/60 text-xs text-zinc-400 text-center">
              All projects within allocated budget
            </div>
          ) : (
            criticalBudgetAlerts.slice(0, 4).map((b) => (
              <div
                key={b.projectId}
                className="p-3 bg-zinc-50 rounded-lg border border-rose-200 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-900 truncate">{b.projectName}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                    +{Math.round(b.utilizationPercent - 100)}% over
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Budget: {formatCeoCurrency(b.budgetAmount, true)}</span>
                  <span className="text-left font-semibold text-rose-600">
                    Spent: {formatCeoCurrency(b.actualAmount, true)}
                  </span>
                </div>
                <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, b.utilizationPercent)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
