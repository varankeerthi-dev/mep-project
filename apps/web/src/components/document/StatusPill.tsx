import { cn } from '../../lib/utils';

interface StatusPillProps {
  bg: string;
  color: string;
  label: string;
  className?: string;
}

// StatusPill - shared colored status pill used by quotation, sales order,
// and future invoice / proforma / purchase order / challan list shells.
export function StatusPill({ bg, color, label, className }: StatusPillProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', bg, color, className)}>
      {label}
    </span>
  );
}
