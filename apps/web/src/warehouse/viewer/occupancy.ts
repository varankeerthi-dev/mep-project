// src/warehouse/viewer/occupancy.ts
// Pure occupancy/capacity helpers for the Warehouse Viewer.
// Implements PRD §6.8 (Bin Capacity) and §6.9 (Capacity Indicators):
//   • Occupancy % = current qty / max qty
//   • Green 0–50% · Yellow 51–75% · Orange 76–90% · Red 91–100%
//   • Purple = over capacity · Grey = empty / no capacity
// Pure and side-effect free so the viewer (and tests) can rely on it.

import type { BinRow } from '../types';

export const OCCUPANCY_COLORS = {
  empty: '#e4e4e7', // grey — no capacity configured or zero qty
  low: '#86efac', // green — 0–50%
  mid: '#fde047', // yellow — 51–75%
  high: '#fdba74', // orange — 76–90%
  full: '#fca5a5', // red — 91–100%
  over: '#c084fc', // purple — >100%
} as const;

export type OccupancyLevel = 'empty' | 'low' | 'mid' | 'high' | 'full' | 'over';

export interface Occupancy {
  /** Current quantity across all items in the bin. */
  currentQty: number;
  /** Maximum quantity the bin can hold (0 when unconfigured). */
  maxQty: number;
  /** Remaining capacity (max − current), clamped at 0. */
  remaining: number;
  /** 0–100+ occupancy percentage. */
  pct: number;
  /** Colour-key level per PRD §6.9. */
  level: OccupancyLevel;
  /** Display colour for the level. */
  color: string;
  /** Human label, e.g. "76–90%". */
  label: string;
}

/** Classify an occupancy percentage into its PRD §6.9 indicator level. */
export function levelForPct(pct: number, hasCapacity: boolean): OccupancyLevel {
  if (!hasCapacity) return 'empty';
  if (pct <= 0) return 'empty';
  if (pct <= 50) return 'low';
  if (pct <= 75) return 'mid';
  if (pct <= 90) return 'high';
  if (pct <= 100) return 'full';
  return 'over';
}

const LEVEL_LABELS: Record<OccupancyLevel, string> = {
  empty: 'Empty',
  low: '0–50%',
  mid: '51–75%',
  high: '76–90%',
  full: '91–100%',
  over: 'Over',
};

/** Compute occupancy for one bin from a raw current quantity. */
export function computeBinOccupancy(currentQty: number, maxQty: number | null | undefined): Occupancy {
  const max = Number(maxQty ?? 0);
  const qty = Math.max(0, Number(currentQty) || 0);
  const hasCapacity = max > 0;
  const pct = hasCapacity ? (qty / max) * 100 : 0;
  const level = levelForPct(pct, hasCapacity);
  return {
    currentQty: qty,
    maxQty: max,
    remaining: hasCapacity ? Math.max(0, max - qty) : 0,
    pct: Number(pct.toFixed(1)),
    level,
    color: OCCUPANCY_COLORS[level],
    label: LEVEL_LABELS[level],
  };
}

/** Build a bin → current quantity map from bin-item rows (sums per bin). */
export function sumQuantitiesByBin(
  items: Array<{ bin_id: string; quantity: number | null }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    map.set(item.bin_id, (map.get(item.bin_id) ?? 0) + qty);
  }
  return map;
}

export interface CapacityStats {
  binCount: number;
  configuredBinCount: number;
  currentQty: number;
  maxQty: number;
  remaining: number;
  pct: number;
  level: OccupancyLevel;
  color: string;
  label: string;
}

/** Aggregate occupancy across many bins (warehouse / floor / zone / rack). */
export function aggregateCapacity(
  bins: Array<Pick<BinRow, 'id' | 'max_quantity' | 'current_quantity'>>,
  quantitiesByBin: Map<string, number>
): CapacityStats {
  const binCount = bins.length;
  let configured = 0;
  let current = 0;
  let max = 0;
  for (const bin of bins) {
    const qty = quantitiesByBin.get(bin.id) ?? (Number(bin.current_quantity) || 0);
    const cap = Number(bin.max_quantity) || 0;
    if (cap > 0) {
      configured++;
      max += cap;
    }
    current += qty;
  }
  const pct = max > 0 ? (current / max) * 100 : 0;
  const level = levelForPct(pct, configured > 0);
  return {
    binCount,
    configuredBinCount: configured,
    currentQty: current,
    maxQty: max,
    remaining: Math.max(0, max - current),
    pct: Number(pct.toFixed(1)),
    level,
    color: OCCUPANCY_COLORS[level],
    label: LEVEL_LABELS[level],
  };
}
