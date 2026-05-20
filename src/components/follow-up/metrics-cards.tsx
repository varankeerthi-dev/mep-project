import { cn } from '@/lib/utils';
import type { FollowUpMetrics } from '@/types/followup';

type MetricsCardsProps = {
  metrics: FollowUpMetrics[];
};

const variantStyles: Record<string, string> = {
  default: 'border-zinc-200 bg-white',
  warning: 'border-amber-200 bg-amber-50/50',
  danger: 'border-red-200 bg-red-50/40',
  success: 'border-emerald-200 bg-emerald-50/40',
};

export function MetricsCards({ metrics }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-4">
      {metrics.map((m) => (
        <div
          key={m.label}
          className={cn(
            'rounded-xl border px-4 py-3 shadow-sm',
            variantStyles[m.variant ?? 'default']
          )}
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{m.label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">{m.value}</p>
          {m.sublabel && <p className="text-[11px] text-zinc-500">{m.sublabel}</p>}
        </div>
      ))}
    </div>
  );
}
