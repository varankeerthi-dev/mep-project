import React from 'react';
import {
  FileText,
  FileCheck2,
  HardHat,
  Factory,
  Receipt,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCeoCurrency, formatCeoNumber } from './utils/ceoFormatters';
import type { CeoMode, CeoPipelineMetrics } from './hooks/useCeoDashboardData';

export type StageKey = 'quotes' | 'orders' | 'execution' | 'billing' | 'escalations';

interface CeoPipelineStripProps {
  metrics: CeoPipelineMetrics;
  mode: CeoMode;
  activeDrawerStage: StageKey | null;
  onSelectStage: (stage: StageKey) => void;
}

export const CeoPipelineStrip: React.FC<CeoPipelineStripProps> = ({
  metrics,
  mode,
  activeDrawerStage,
  onSelectStage,
}) => {
  const isMfg = mode === 'manufacturing';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Executive Value Pipeline
          </span>
          <span className="text-[11px] text-zinc-400">&bull; Click any stage to inspect detailed breakdown</span>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
          <span>Quote</span>
          <ArrowRight className="w-3 h-3 text-zinc-300" />
          <span>Order</span>
          <ArrowRight className="w-3 h-3 text-zinc-300" />
          <span>Execute</span>
          <ArrowRight className="w-3 h-3 text-zinc-300" />
          <span>Bill</span>
          <ArrowRight className="w-3 h-3 text-zinc-300" />
          <span className="text-rose-600 font-semibold">Triage</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Stage 1: Quotes */}
        <button
          type="button"
          onClick={() => onSelectStage('quotes')}
          className={cn(
            'group relative flex flex-col p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer bg-white',
            activeDrawerStage === 'quotes'
              ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
              : 'border-zinc-200/90 hover:border-indigo-300 hover:shadow-sm'
          )}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-semibold text-zinc-500 tracking-wide">1. QUOTES</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-left">
            <span
              className="block text-2xl font-bold tracking-tight text-zinc-900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatCeoCurrency(metrics.quotes.totalValue, true)}
            </span>
            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
              <span>{formatCeoNumber(metrics.quotes.count)} open proposals</span>
              <span>&bull;</span>
              <span>Avg {formatCeoCurrency(metrics.quotes.avgValue, true)}</span>
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Won/Approved</span>
            <span className="font-semibold text-emerald-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCeoCurrency(metrics.quotes.approvedValue, true)}
            </span>
          </div>
        </button>

        {/* Stage 2: Sales Orders */}
        <button
          type="button"
          onClick={() => onSelectStage('orders')}
          className={cn(
            'group relative flex flex-col p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer bg-white',
            activeDrawerStage === 'orders'
              ? 'border-cyan-600 ring-2 ring-cyan-500/20 shadow-md'
              : 'border-zinc-200/90 hover:border-cyan-300 hover:shadow-sm'
          )}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-semibold text-zinc-500 tracking-wide">2. SALES ORDERS</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-left">
            <span
              className="block text-2xl font-bold tracking-tight text-zinc-900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatCeoCurrency(metrics.orders.totalBookedValue, true)}
            </span>
            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
              <span>{formatCeoNumber(metrics.orders.count)} client POs</span>
              <span>&bull;</span>
              <span>{formatCeoCurrency(metrics.orders.utilizedValue, true)} billed</span>
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Unbilled Backlog</span>
            <span className="font-semibold text-cyan-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCeoCurrency(metrics.orders.availableBacklog, true)}
            </span>
          </div>
        </button>

        {/* Stage 3: Execution (Projects / Manufacturing) */}
        <button
          type="button"
          onClick={() => onSelectStage('execution')}
          className={cn(
            'group relative flex flex-col p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer bg-white',
            activeDrawerStage === 'execution'
              ? 'border-amber-600 ring-2 ring-amber-500/20 shadow-md'
              : 'border-zinc-200/90 hover:border-amber-300 hover:shadow-sm'
          )}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-semibold text-zinc-500 tracking-wide">
              {isMfg ? '3. MANUFACTURING' : '3. SITE DELIVERY'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              {isMfg ? <Factory className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
            </div>
          </div>
          <div className="text-left">
            <span
              className="block text-2xl font-bold tracking-tight text-zinc-900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {isMfg
                ? `${formatCeoNumber(metrics.execution.activeJobCardsCount)} Job Cards`
                : `${formatCeoNumber(metrics.execution.activeProjectsCount)} Projects`}
            </span>
            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
              {isMfg ? (
                <span>{metrics.execution.totalJobUnitsDone} / {metrics.execution.totalJobUnitsPlanned} units produced</span>
              ) : (
                <span>
                  {metrics.execution.onTrackCount} on track &bull; {metrics.execution.atRiskCount + metrics.execution.delayedCount} at risk
                </span>
              )}
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Completion Health</span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-zinc-800" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {metrics.execution.avgCompletion}%
              </span>
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  metrics.execution.delayedCount > 0
                    ? 'bg-rose-500'
                    : metrics.execution.atRiskCount > 0
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                )}
              />
            </div>
          </div>
        </button>

        {/* Stage 4: Billing & Cash Velocity */}
        <button
          type="button"
          onClick={() => onSelectStage('billing')}
          className={cn(
            'group relative flex flex-col p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer bg-white',
            activeDrawerStage === 'billing'
              ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
              : 'border-zinc-200/90 hover:border-emerald-300 hover:shadow-sm'
          )}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-semibold text-zinc-500 tracking-wide">4. BILLING & CASH</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-left">
            <span
              className="block text-2xl font-bold tracking-tight text-zinc-900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatCeoCurrency(metrics.billing.totalBilled, true)}
            </span>
            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
              <span>{formatCeoNumber(metrics.billing.invoicesCount)} invoices</span>
              <span>&bull;</span>
              <span>Collected {formatCeoCurrency(metrics.billing.totalCollected, true)}</span>
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Overdue AR</span>
            <span
              className={cn(
                'font-semibold',
                metrics.billing.totalOverdueAR > 0 ? 'text-rose-600' : 'text-emerald-700'
              )}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {metrics.billing.totalOverdueAR > 0
                ? formatCeoCurrency(metrics.billing.totalOverdueAR, true)
                : 'Zero overdue'}
            </span>
          </div>
        </button>

        {/* Stage 5: Critical Escalations */}
        <button
          type="button"
          onClick={() => onSelectStage('escalations')}
          className={cn(
            'group relative flex flex-col p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer',
            metrics.escalations.totalEscalations > 0
              ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
              : 'bg-white border-zinc-200/90 hover:border-zinc-300',
            activeDrawerStage === 'escalations' && 'ring-2 ring-rose-500/30 border-rose-500 shadow-md'
          )}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span
              className={cn(
                'text-xs font-semibold tracking-wide',
                metrics.escalations.totalEscalations > 0 ? 'text-rose-700' : 'text-zinc-500'
              )}
            >
              5. ESCALATIONS
            </span>
            <div
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                metrics.escalations.totalEscalations > 0
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-50 text-emerald-600'
              )}
            >
              {metrics.escalations.totalEscalations > 0 ? (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
            </div>
          </div>
          <div className="text-left">
            <span
              className={cn(
                'block text-2xl font-bold tracking-tight',
                metrics.escalations.totalEscalations > 0 ? 'text-rose-700' : 'text-zinc-900'
              )}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {metrics.escalations.totalEscalations > 0
                ? `${metrics.escalations.totalEscalations} Needs Action`
                : 'All Clear'}
            </span>
            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
              <span>{metrics.escalations.criticalStoppagesCount} stoppages</span>
              <span>&bull;</span>
              <span>{metrics.escalations.highPriorityApprovalsCount} approvals</span>
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-rose-100/80 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Overruns</span>
            <span
              className={cn(
                'font-semibold',
                metrics.escalations.budgetOverrunsCount > 0 ? 'text-rose-600' : 'text-zinc-600'
              )}
            >
              {metrics.escalations.budgetOverrunsCount > 0
                ? `${metrics.escalations.budgetOverrunsCount} over budget`
                : 'No budget breach'}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
