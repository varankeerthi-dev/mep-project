import type { InvoiceFollowUp } from '@/types/followup';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import { AssigneeSelect } from './assignee-select';
import { useInvoiceEscalation } from '@/hooks/use-invoice-escalation';
import { EscalationBadge } from './escalation-badge';
import { formatFollowUpCurrency } from '@/lib/followup/currency-format';
import { formatAgingLabel, formatFollowUpDate } from '@/lib/followup/date-format';
import { cn } from '@/lib/utils';
import { Phone, MessageCircle } from 'lucide-react';

type InvoiceEscalationCardProps = {
  invoice: InvoiceFollowUp;
  assignees: FollowUpAssigneeOption[];
  disabled?: boolean;
  selected?: boolean;
  onSelect: () => void;
  onReminder: () => void;
  onAssigneeChange: (id: string, userId: string | null) => void;
};

export function InvoiceEscalationCard({
  invoice,
  assignees,
  disabled,
  selected,
  onSelect,
  onReminder,
  onAssigneeChange,
}: InvoiceEscalationCardProps) {
  const { meta, rowClass } = useInvoiceEscalation(invoice);
  if (!meta) return null;

  const riskClass =
    invoice.collection_risk === 'critical'
      ? 'text-red-700'
      : invoice.collection_risk === 'high'
        ? 'text-amber-700'
        : invoice.collection_risk === 'medium'
          ? 'text-amber-700'
          : 'text-slate-600';

  return (
    <div
      className={cn(
        'cursor-pointer border-b border-slate-200 px-3 py-2 transition-colors duration-150 hover:bg-slate-50',
        rowClass,
        selected && 'ring-2 ring-inset ring-blue-600 bg-[#f0f7ff]'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-900">{invoice.invoice_no}</span>
            <EscalationBadge meta={meta} />
            <span className={cn('text-[10px] font-medium uppercase', riskClass)}>
              {invoice.collection_risk} risk
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-800">{invoice.client_name}</p>
          <p className="truncate text-[11px] text-slate-500">{invoice.project_name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums text-slate-900">
            {formatFollowUpCurrency(invoice.balance_due)}
          </p>
          <p className="text-[10px] text-slate-500">{formatAgingLabel(invoice.days_overdue)}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-slate-500">Due {formatFollowUpDate(invoice.due_date)}</span>
        <div onClick={(e) => e.stopPropagation()}>
          <AssigneeSelect
            value={invoice.assignee_user_id}
            options={assignees}
            disabled={disabled}
            compact
            onChange={(userId) => onAssigneeChange(invoice.id, userId)}
          />
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={disabled}
            onClick={onReminder}
            className="inline-flex h-6 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[10px] font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.96] transition duration-150 relative after:absolute after:-inset-1 after:content-['']"
          >
            <MessageCircle className="h-3 w-3" />
            Remind
          </button>
          {meta.stage >= 4 && (
            <button
              type="button"
              className="inline-flex h-6 items-center gap-1 rounded border border-red-200 bg-red-50 px-2 text-[10px] font-medium text-red-800"
            >
              <Phone className="h-3 w-3" />
              Call
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const invoiceTableHeader = (
  <div className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 leading-normal select-none">
    Invoice escalation queue — select row for detail panel
  </div>
);
