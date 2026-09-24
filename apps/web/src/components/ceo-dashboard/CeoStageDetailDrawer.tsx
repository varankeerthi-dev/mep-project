import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  ExternalLink,
  FileText,
  FileCheck2,
  HardHat,
  Receipt,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  formatCeoCurrency,
  formatCeoDate,
  formatCeoNumber,
  getHealthBadgeTone,
} from './utils/ceoFormatters';
import type { StageKey } from './CeoPipelineStrip';
import type {
  QuoteItem,
  SalesOrderItem,
  ProjectPortfolioItem,
  JobCardWipItem,
  InvoiceBillingItem,
  CeoApprovalItem,
  CeoMode,
} from './hooks/useCeoDashboardData';
import type { WorkStoppageWithReport } from '@/types/siteReportStoppage';
import type { ActionModalType } from './CeoActionModal';

interface CeoStageDetailDrawerProps {
  stage: StageKey | null;
  mode: CeoMode;
  onClose: () => void;
  data: {
    quotes: QuoteItem[];
    orders: SalesOrderItem[];
    projects: ProjectPortfolioItem[];
    jobCards: JobCardWipItem[];
    invoices: InvoiceBillingItem[];
    approvals: CeoApprovalItem[];
    stoppages: WorkStoppageWithReport[];
  };
  onNavigate: (href: string) => void;
  onOpenAction: (modal: ActionModalType) => void;
}

export const CeoStageDetailDrawer: React.FC<CeoStageDetailDrawerProps> = ({
  stage,
  mode,
  onClose,
  data,
  onNavigate,
  onOpenAction,
}) => {
  const [search, setSearch] = useState('');

  if (!stage) return null;

  const stageTitles: Record<StageKey, { title: string; subtitle: string; icon: React.ReactNode }> = {
    quotes: {
      title: 'Quotation Pipeline Breakdown',
      subtitle: 'Active quotes ranked by contract value & win probability',
      icon: <FileText className="w-5 h-5 text-indigo-600" />,
    },
    orders: {
      title: 'Booked Sales Orders & Backlog',
      subtitle: 'Confirmed Client Purchase Orders and unexecuted value',
      icon: <FileCheck2 className="w-5 h-5 text-cyan-600" />,
    },
    execution: {
      title: mode === 'manufacturing' ? 'Manufacturing Throughput' : 'Projects Execution Portfolio',
      subtitle: 'Active delivery milestones, schedule variances, and progress',
      icon: <HardHat className="w-5 h-5 text-amber-600" />,
    },
    billing: {
      title: 'Billing Velocity & Receivables (AR)',
      subtitle: 'Tax invoices, cash collected, and overdue exposures',
      icon: <Receipt className="w-5 h-5 text-emerald-600" />,
    },
    escalations: {
      title: 'Executive Triage & Interventions',
      subtitle: 'Active work stoppages, high-priority approvals, and alerts',
      icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
    },
  };

  const meta = stageTitles[stage];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col font-sans">
          {/* Drawer Header */}
          <div className="p-5 border-b border-zinc-200/90 flex items-start justify-between bg-zinc-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 shadow-xs flex items-center justify-center shrink-0">
                {meta.icon}
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 tracking-tight">{meta.title}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{meta.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar inside drawer */}
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2 bg-white">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                type="text"
                placeholder="Filter entries in this stage..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-zinc-50 border-zinc-200/80 rounded-lg w-full"
              />
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {/* Stage 1: Quotes */}
            {stage === 'quotes' && (
              <div className="space-y-2.5">
                {data.quotes
                  .filter((q) => !search || q.quotation_no.toLowerCase().includes(search.toLowerCase()) || q.client_name.toLowerCase().includes(search.toLowerCase()))
                  .map((q) => (
                    <div
                      key={q.id}
                      className="p-3.5 bg-white border border-zinc-200/80 rounded-xl hover:border-indigo-300 transition-all text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-zinc-900 text-sm block">{q.quotation_no}</span>
                          <span className="text-zinc-600 font-medium">{q.client_name} &bull; {q.project_name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700">
                          {q.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                        {/* Monetary column strictly left-aligned */}
                        <div className="text-left">
                          <span className="text-[10px] text-zinc-400 block">Proposal Value</span>
                          <span className="text-sm font-bold text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCeoCurrency(q.grand_total)}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">Date: {formatCeoDate(q.date)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Stage 2: Orders */}
            {stage === 'orders' && (
              <div className="space-y-2.5">
                {data.orders
                  .filter((o) => !search || o.po_number.toLowerCase().includes(search.toLowerCase()) || o.client_name.toLowerCase().includes(search.toLowerCase()))
                  .map((o) => (
                    <div
                      key={o.id}
                      className="p-3.5 bg-white border border-zinc-200/80 rounded-xl hover:border-cyan-300 transition-all text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-zinc-900 text-sm block">{o.po_number}</span>
                          <span className="text-zinc-600 font-medium">{o.client_name} &bull; {o.project_name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
                          {o.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 text-left">
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Total PO Value</span>
                          <span className="font-bold text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCeoCurrency(o.po_total_value)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Executed</span>
                          <span className="font-semibold text-zinc-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCeoCurrency(o.po_utilized_value)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Backlog</span>
                          <span className="font-semibold text-cyan-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCeoCurrency(o.po_available_value)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Stage 3: Execution */}
            {stage === 'execution' && (
              <div className="space-y-2.5">
                {data.projects
                  .filter((p) => !search || p.project_name.toLowerCase().includes(search.toLowerCase()) || p.client_name.toLowerCase().includes(search.toLowerCase()))
                  .map((p) => {
                    const tone = getHealthBadgeTone(p.health);
                    return (
                      <div
                        key={p.id}
                        className="p-3.5 bg-white border border-zinc-200/80 rounded-xl hover:border-amber-300 transition-all text-xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-zinc-900 text-sm block">{p.project_name}</span>
                            <span className="text-zinc-600 font-medium">{p.client_name}</span>
                          </div>
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', tone.bg, tone.text, tone.border)}>
                            {p.health}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-zinc-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, p.completion_percentage)}%` }}
                            />
                          </div>
                          <span className="font-bold text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {p.completion_percentage}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-100">
                          {/* Monetary amount left-aligned */}
                          <span className="text-left font-semibold text-zinc-800">
                            Est: {formatCeoCurrency(p.project_estimated_value)}
                          </span>
                          <span>Target: {formatCeoDate(p.expected_end_date)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Stage 4: Billing */}
            {stage === 'billing' && (
              <div className="space-y-2.5">
                {data.invoices
                  .filter((inv) => !search || inv.invoice_no.toLowerCase().includes(search.toLowerCase()) || inv.client_name.toLowerCase().includes(search.toLowerCase()))
                  .map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3.5 bg-white border border-zinc-200/80 rounded-xl hover:border-emerald-300 transition-all text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-zinc-900 text-sm block">{inv.invoice_no}</span>
                          <span className="text-zinc-600 font-medium">{inv.client_name}</span>
                        </div>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                            inv.daysOverdue > 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-800'
                          )}
                        >
                          {inv.daysOverdue > 0 ? `${inv.daysOverdue}d Overdue` : inv.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 text-left">
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Total Invoiced</span>
                          <span className="font-bold text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCeoCurrency(inv.total)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Collected</span>
                          <span className="font-semibold text-emerald-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCeoCurrency(inv.paid_amount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Balance Due</span>
                          <span
                            className={cn('font-bold', inv.outstanding > 0 ? 'text-rose-600' : 'text-zinc-600')}
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {formatCeoCurrency(inv.outstanding)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Stage 5: Escalations */}
            {stage === 'escalations' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Work Stoppages ({data.stoppages.length})
                  </h4>
                  {data.stoppages.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-rose-50/50 border border-rose-200 rounded-lg text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-zinc-900">{s.category}</span>
                        <Button
                          type="button"
                          size="sm"
                          className="h-6 text-[11px] px-2 bg-zinc-900 text-white"
                          onClick={() => onOpenAction({ kind: 'stoppage', item: s })}
                        >
                          Resolve
                        </Button>
                      </div>
                      <p className="text-zinc-600">{s.reason_detail || s.affected_work}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-200">
                  <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Pending Approvals ({data.approvals.length})
                  </h4>
                  {data.approvals.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 bg-amber-50/40 border border-amber-200 rounded-lg text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-zinc-900 block">{a.title}</span>
                          <span className="text-[11px] text-zinc-500">{a.approval_type} &bull; {a.priority}</span>
                        </div>
                        {a.amount !== null && (
                          <span className="font-bold text-zinc-900 text-left" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCeoCurrency(a.amount)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-100">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] px-2 text-rose-700 border-rose-300"
                          onClick={() => onOpenAction({ kind: 'approval', item: a, action: 'REJECTED' })}
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-6 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => onOpenAction({ kind: 'approval', item: a, action: 'APPROVED' })}
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
