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
  roundOff?: number;
  enableRoundOff?: boolean;
  onToggleRoundOff?: () => void;
};

const summaryRowClass =
  'flex items-center justify-between gap-4 text-[13px] leading-5 text-zinc-600';

export function InvoiceSummaryFooter({
  subtotal,
  cgst,
  sgst,
  igst,
  total,
  interstate,
  clientState,
  companyState,
  roundOff = 0,
  enableRoundOff = false,
  onToggleRoundOff,
}: InvoiceSummaryFooterProps) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
            GST Treatment
          </div>
          <div className="text-[13px] font-medium text-zinc-700">
            {interstate ? 'Interstate invoice' : 'Intrastate invoice'}
          </div>
          <div className="text-[12px] text-zinc-500">
            {companyState || 'Company state not set'} to {clientState || 'Client state not set'}
          </div>
        </div>

        <div className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 md:max-w-sm">
          <div className={summaryRowClass}>
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className={summaryRowClass}>
            <span className={cn(interstate && 'text-zinc-400')}>CGST</span>
            <span>{formatCurrency(cgst)}</span>
          </div>
          <div className={summaryRowClass}>
            <span className={cn(interstate && 'text-zinc-400')}>SGST</span>
            <span>{formatCurrency(sgst)}</span>
          </div>
          <div className={summaryRowClass}>
            <span className={cn(!interstate && 'text-zinc-400')}>IGST</span>
            <span>{formatCurrency(igst)}</span>
          </div>
          {enableRoundOff && (
            <div className={summaryRowClass}>
              <span>Round Off</span>
              <span className={cn(roundOff >= 0 ? 'text-green-600' : 'text-red-600')}>
                {roundOff >= 0 ? '+' : ''}{formatCurrency(roundOff)}
              </span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3 text-[15px] font-semibold text-zinc-950">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          {onToggleRoundOff && (
            <div className="mt-3 flex items-center justify-between pt-2">
              <span className="text-[12px] text-zinc-500">Round off to nearest rupee</span>
              <button
                type="button"
                onClick={onToggleRoundOff}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                  enableRoundOff ? 'bg-zinc-900' : 'bg-zinc-300'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    enableRoundOff ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
