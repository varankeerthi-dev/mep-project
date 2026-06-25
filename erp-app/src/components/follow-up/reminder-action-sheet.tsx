import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { InvoiceFollowUp } from '@/types/followup';
import { useInvoiceEscalation } from '@/hooks/use-invoice-escalation';
import { EscalationBadge } from './escalation-badge';
import { formatFollowUpCurrency } from '@/lib/followup/currency-format';
import { formatFollowUpDate } from '@/lib/followup/date-format';

type InvoiceDetailPanelProps = {
  invoice: InvoiceFollowUp | null;
  canManage?: boolean;
  onClose: () => void;
  onSendReminder: () => void;
};

export function InvoiceDetailPanel({
  invoice,
  canManage = true,
  onClose,
  onSendReminder,
}: InvoiceDetailPanelProps) {
  const { meta } = useInvoiceEscalation(invoice);

  if (!invoice || !meta) {
    return (
      <aside className="hidden w-80 shrink-0 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 xl:block">
        <p className="text-sm text-zinc-500">Select an invoice to view escalation detail.</p>
      </aside>
    );
  }

  return (
    <aside className="hidden w-80 shrink-0 flex-col rounded-xl border border-zinc-200 bg-white xl:flex">
      <div className="border-b border-zinc-100 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase text-zinc-500">Detail</p>
        <p className="font-mono text-sm font-semibold text-zinc-900">{invoice.invoice_no}</p>
        <div className="mt-2">
          <EscalationBadge meta={meta} />
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-auto px-4 py-3 text-xs">
        <div>
          <p className="text-zinc-500">Client</p>
          <p className="font-medium text-zinc-900">{invoice.client_name}</p>
        </div>
        <div>
          <p className="text-zinc-500">Project</p>
          <p className="text-zinc-800">{invoice.project_name}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-zinc-500">Balance due</p>
            <p className="font-semibold tabular-nums">{formatFollowUpCurrency(invoice.balance_due)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Due date</p>
            <p>{formatFollowUpDate(invoice.due_date)}</p>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-[10px] font-semibold uppercase text-zinc-500">Recommended action</p>
          <p className="mt-1 text-zinc-800 leading-relaxed">{meta.recommendedAction}</p>
        </div>
        {invoice.payment_link && (
          <a
            href={invoice.payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-indigo-600 hover:underline"
          >
            Payment link
          </a>
        )}
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t border-zinc-100 bg-white p-3">
        <button
          type="button"
          disabled={!canManage}
          onClick={onSendReminder}
          className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send reminder
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Close
        </button>
      </div>
    </aside>
  );
}

type ReminderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
};

export function ReminderDialog({ open, onOpenChange, title, children }: ReminderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
