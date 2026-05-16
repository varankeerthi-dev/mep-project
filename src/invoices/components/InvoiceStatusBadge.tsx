import { cn } from '../../lib/utils';

type InvoiceStatusBadgeProps = {
  status: 'draft' | 'final';
};

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
        status === 'final'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-zinc-200 bg-zinc-100 text-zinc-600',
      )}
    >
      {status}
    </span>
  );
}
