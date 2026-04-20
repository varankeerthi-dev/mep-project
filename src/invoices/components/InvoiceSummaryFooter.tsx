import { cn } from '../../lib/utils';
import { formatCurrency } from '../ui-utils';

type InvoiceSummaryFooterProps = {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  interstate: boolean;
  clientState?: string | null;
  companyState?: string | null;
};

const summaryRowClass =
  'flex items-center justify-between gap-4 text-[13px] leading-5 text-slate-600';

export function InvoiceSummaryFooter({
  subtotal,
  cgst,
  sgst,
  igst,
  total,
  interstate,
  clientState,
  companyState,
}: InvoiceSummaryFooterProps) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            GST Treatment
          </div>
          <div className="text-[13px] font-medium text-slate-700">
            {interstate ? 'Interstate invoice' : 'Intrastate invoice'}
          </div>
          <div className="text-[12px] text-slate-500">
            {companyState || 'Company state not set'} to {clientState || 'Client state not set'}
          </div>
        </div>

        <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:max-w-sm">
          <div className={summaryRowClass}>
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className={summaryRowClass}>
            <span className={cn(interstate && 'text-slate-400')}>CGST</span>
            <span>{formatCurrency(cgst)}</span>
          </div>
          <div className={summaryRowClass}>
            <span className={cn(interstate && 'text-slate-400')}>SGST</span>
            <span>{formatCurrency(sgst)}</span>
          </div>
          <div className={summaryRowClass}>
            <span className={cn(!interstate && 'text-slate-400')}>IGST</span>
            <span>{formatCurrency(igst)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-[15px] font-semibold text-slate-950">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
