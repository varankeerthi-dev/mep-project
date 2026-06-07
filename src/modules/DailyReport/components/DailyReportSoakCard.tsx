// ============================================
// DailyReportSoakCard — Phase 6.3 (soak telemetry)
// ============================================
// Renders the three daily-report ↔ task integration
// adoption KPIs during the 2-week soak window.
//
// Mounted in Reports.tsx (so the /reports page surfaces
// it to PMs) and inside the rollup page header (so the
// data is visible where the data is consumed).
//
// Each KPI is a card with:
//   - the metric name (1 line)
//   - the % value (giant, font-display, tabular-nums)
//   - the absolute ratio (e.g. "47 / 53")
//   - a tooltip with the metric description
//   - loading / error / empty states
// ============================================

import { RefreshCw, TrendingUp, Plus, Eye, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDailyReportSoakMetrics,
  type SoakMetric,
} from '@/hooks/useDailyReportSoakMetrics';

// ============================================
// PROPS
// ============================================

export interface DailyReportSoakCardProps {
  /** Override the default window (default 14 days). */
  windowDays?: number;
  /** Compact mode (used inside other dashboards). */
  compact?: boolean;
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function DailyReportSoakCard({
  windowDays = 14,
  compact = false,
  className,
}: DailyReportSoakCardProps) {
  const metrics = useDailyReportSoakMetrics({ windowDays });
  const isAnyLoading =
    metrics.linkageRate.isLoading ||
    metrics.inlineCreateRate.isLoading ||
    metrics.rollupAdoption.isLoading;

  return (
    <section
      className={cn(
        'rounded-2xl border border-whisper bg-pure p-5 shadow-sm',
        compact ? 'space-y-3' : 'space-y-4',
        className
      )}
      aria-label="Daily report v2 soak metrics"
    >
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">
            Daily report v2 — soak metrics
          </h2>
          <p className="text-xs text-steel">
            Last {windowDays} days · {formatDate(metrics.windowStart)} – {formatDate(metrics.windowEnd)}
          </p>
        </div>
        {isAnyLoading && (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-steel" aria-hidden="true" />
        )}
      </header>

      <div
        className={cn(
          'grid gap-3',
          compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'
        )}
      >
        <KpiTile metric={metrics.linkageRate} icon={TrendingUp} />
        <KpiTile metric={metrics.inlineCreateRate} icon={Plus} />
        <KpiTile metric={metrics.rollupAdoption} icon={Eye} />
      </div>

      <footer className="text-[10px] uppercase tracking-wide text-steel">
        Adoption signals during the 2-week rollout window. PMs and engineers can use these to gauge
        whether the v2 flow is sticking.
      </footer>
    </section>
  );
}

// ============================================
// KPI TILE
// ============================================

interface KpiTileProps {
  metric: SoakMetric;
  icon: typeof TrendingUp;
}

function KpiTile({ metric, icon: Icon }: KpiTileProps) {
  return (
    <div
      className="group relative flex flex-col gap-1.5 rounded-xl border border-whisper bg-canvas/40 p-3 transition-colors hover:border-ink/15"
      title={metric.description}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-steel">
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span>{metric.label}</span>
      </div>

      <div className="flex items-baseline gap-1">
        {metric.isError ? (
          <span className="inline-flex items-center gap-1 text-xs text-critical">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            Unavailable
          </span>
        ) : metric.value === null ? (
          <span className="font-display text-2xl text-steel/60">—</span>
        ) : (
          <>
            <span className="font-display text-2xl font-semibold tabular-nums text-ink">
              {Math.round(metric.value * 100)}
            </span>
            <span className="font-display text-base text-steel">%</span>
          </>
        )}
      </div>

      <div className="text-[10px] tabular-nums text-steel">
        {metric.raw ? (
          <>
            {metric.raw.numerator} / {metric.raw.denominator}
          </>
        ) : (
          <span className="opacity-60">no data yet</span>
        )}
      </div>

      {/* tiny bar — fills the ratio */}
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-canvas" aria-hidden="true">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            metric.value === null ? 'w-0' : metric.value >= 0.5 ? 'bg-success' : 'bg-warning'
          )}
          style={{ width: `${metric.value !== null ? metric.value * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

export default DailyReportSoakCard;
