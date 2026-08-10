// src/warehouse/components/viewer/CapacityBar.tsx
// Shared capacity presentation per PRD §6.8 — numeric + graphical.
// Reused by the viewer page header (whole-warehouse strip) and the
// property panel (floor/zone/rack/bin level).

import { computeBinOccupancy } from '../../viewer/occupancy';

export interface CapacityBarProps {
  currentQty: number;
  maxQty: number;
  remaining: number;
  pct: number;
  /** Optional override for the bar colour (falls back to level colour). */
  color?: string;
  /** Header label, e.g. "Overall" or "Bin". */
  label: string;
  compact?: boolean;
}

export default function CapacityBar({ currentQty, maxQty, remaining, pct, color, label, compact = false }: CapacityBarProps) {
  const barColor = color ?? computeBinOccupancy(currentQty, maxQty).color;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-500">{label} capacity</span>
        <span className="font-bold tabular-nums text-zinc-800">{pct}%</span>
      </div>
      <div className={compact ? 'h-1.5 rounded-full bg-zinc-100 overflow-hidden' : 'h-2 rounded-full bg-zinc-100 overflow-hidden'}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
      </div>
      {!compact && (
        <div className="grid grid-cols-3 gap-1 text-[10px] text-zinc-500">
          <span className="tabular-nums">Current <b className="text-zinc-800">{fmt(currentQty)}</b></span>
          <span className="tabular-nums">Max <b className="text-zinc-800">{fmt(maxQty)}</b></span>
          <span className="tabular-nums">Remaining <b className="text-zinc-800">{fmt(remaining)}</b></span>
        </div>
      )}
    </div>
  );
}
