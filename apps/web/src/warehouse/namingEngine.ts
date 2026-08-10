// src/warehouse/namingEngine.ts
// Pure naming engine — generates rack + bin names from configuration.
// Used by the Designer preview (live) and by the save flow (same output
// persisted to the DB). No React, no side effects → trivially testable.

import type { NamingConfig, RackGenerationConfig, LayoutType, RackOverride } from './types';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Convert a 1-based index to an alpha label (1 → A, 27 → AA). */
export function alphaLabel(index: number): string {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = ALPHA[rem] + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Pad a number with zeroes to a given width (clamped to ≥1). */
export function padNumber(value: number, width: number): string {
  const w = Math.max(1, Math.floor(width || 1));
  return String(value).padStart(w, '0');
}

/** Format a sequence number per the numbering style. */
export function formatSequence(style: NamingConfig['numberingStyle'], index: number, padding: number): string {
  switch (style) {
    case 'alpha':
      return alphaLabel(index);
    case 'alphanumeric':
      return `${alphaLabel(index)}${index}`;
    case 'numeric':
    default:
      return padNumber(index, padding);
  }
}

/**
 * Build the complete rack name for a given rack index (1-based, in
 * generation order). Format: `{prefix}{separator}{sequence}{separator}{suffix}`
 */
export function rackName(rackIndex: number, cfg: NamingConfig): string {
  const seq = formatSequence(cfg.numberingStyle, rackIndex, cfg.padding);
  return joinParts([cfg.prefix, seq, cfg.suffix], cfg.separator);
}

/** Replace `{n}` in the level format with the tier number. */
export function levelLabel(tierNumber: number, levelFormat: string): string {
  return (levelFormat || 'L{n}').replace(/\{n\}/g, String(tierNumber));
}

/**
 * Build the bin name for a given rack + column + tier.
 * Format: `{rackName}{separator}{column padded}{separator}{levelLabel}`
 * Mirrors the PRD example: Rack A, columns 10, levels 3 → A-01-L1 …
 */
export function binName(
  rackIndex: number,
  columnIndex: number,
  tierNumber: number,
  cfg: NamingConfig
): string {
  const rack = rackName(rackIndex, cfg);
  const col = padNumber(columnIndex, cfg.padding);
  const level = levelLabel(tierNumber, cfg.levelFormat);
  return joinParts([rack, col, level], cfg.separator);
}

/**
 * Sample bin names for the live preview (first few of rack 1).
 * Order matches the PRD §5.15 example: A-01-L1, A-01-L2, A-01-L3, A-02-L1 …
 * (column-major, tier varies fastest).
 */
export function binNamePreview(cfg: NamingConfig, columns: number, levels: number, count = 12): string[] {
  const out: string[] = [];
  for (let col = 1; col <= columns && out.length < count; col++) {
    for (let lvl = 1; lvl <= levels && out.length < count; lvl++) {
      out.push(binName(1, col, lvl, cfg));
    }
  }
  return out;
}

/**
 * Shape-based rack inclusion (PRD §5.8 layout shapes):
 *   • grid / parallel_rows / double_aisle / single_aisle / open_yard / custom
 *     → full rows × columns grid
 *   • u_shape → perimeter only (bottom row + first & last columns)
 *   • l_shape → bottom row + first column
 * Shared by the designer preview AND the save generator so what you
 * preview is exactly what gets generated.
 */
export function isRackCellKept(layoutType: LayoutType, row: number, col: number, rows: number, columns: number): boolean {
  if (layoutType === 'u_shape') return row === rows || col === 1 || col === columns;
  if (layoutType === 'l_shape') return row === rows || col === 1;
  return true;
}

/**
 * Expand a rack generation config into explicit per-rack columns/levels.
 * Returns an array of { row, col, columns, levels } in generation order.
 * Racks are numbered row-major (row 1 left→right, then row 2 …). For
 * U/L-shaped layouts only the kept cells are emitted (shared with the
 * preview), so rackIndex is the generation index over the real racks.
 */
export interface GeneratedRackDescriptor {
  row: number;
  col: number; // position within row (1-based)
  rackIndex: number; // generation index (1-based, over kept racks only)
  columns: number;
  levels: number;
  name: string;
}

export function expandRacks(
  cfg: RackGenerationConfig,
  naming: NamingConfig,
  layoutType: LayoutType = 'grid'
): GeneratedRackDescriptor[] {
  const out: GeneratedRackDescriptor[] = [];
  let index = 0;
  for (let row = 1; row <= cfg.rows; row++) {
    for (let col = 1; col <= cfg.columns; col++) {
      if (!isRackCellKept(layoutType, row, col, cfg.rows, cfg.columns)) continue;
      index += 1;
      out.push({
        row,
        col,
        rackIndex: index,
        columns: cfg.columns,
        levels: cfg.levels,
        name: rackName(index, naming),
      });
    }
  }
  return out;
}

/** Deterministic rack list used for DB generation (names + columns + levels). */
export function generationInputs(
  cfg: RackGenerationConfig,
  naming: NamingConfig,
  layoutType: LayoutType = 'grid'
) {
  const racks = expandRacks(cfg, naming, layoutType);
  return {
    rackNames: racks.map(r => r.name),
    columns: racks.map(() => cfg.columns),
    levels: racks.map(() => cfg.levels),
    count: racks.length,
  };
}

/**
 * Generated (row, col) per rack in generation order (row-major, U/L-filtered),
 * without needing the naming config. Aligned 1:1 with expandRacks.
 */
export function generatedRackCells(
  cfg: RackGenerationConfig,
  layoutType: LayoutType = 'grid'
): Array<{ rackIndex: number; row: number; col: number }> {
  const out: Array<{ rackIndex: number; row: number; col: number }> = [];
  let index = 0;
  for (let row = 1; row <= cfg.rows; row++) {
    for (let col = 1; col <= cfg.columns; col++) {
      if (!isRackCellKept(layoutType, row, col, cfg.rows, cfg.columns)) continue;
      index += 1;
      out.push({ rackIndex: index, row, col });
    }
  }
  return out;
}

/**
 * Reverse-map persisted design-grid coordinates (unit 100, as written by
 * `rackGridPositions`) back into drag-placement overrides. `positions` must be
 * in generation order (rack 1..n). Used when loading a published warehouse so
 * re-publishing preserves manual placements (PRD §5.18 round-trip).
 */
export function overridesFromPositions(
  cfg: RackGenerationConfig,
  layoutType: LayoutType,
  positions: Array<{ x: number | null; y: number | null }>
): RackOverride[] {
  const gen = generatedRackCells(cfg, layoutType);
  const out: RackOverride[] = [];
  positions.forEach((p, i) => {
    const g = gen[i];
    if (!g) return;
    const row = Math.round(Number(p.y ?? 0) / 100) + 1;
    const col = Math.round(Number(p.x ?? 0) / 100) + 1;
    if (row !== g.row || col !== g.col) out.push({ rackIndex: g.rackIndex, row, col });
  });
  return out;
}

/**
 * Every kept grid cell of a layout, 1-based (row-major). Shared by the preview
 * drop overlay and by placement validation so the two always agree (PRD §5.18).
 */
export function layoutGridCells(
  cfg: RackGenerationConfig,
  layoutType: LayoutType = 'grid'
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (let row = 1; row <= cfg.rows; row++) {
    for (let col = 1; col <= cfg.columns; col++) {
      if (isRackCellKept(layoutType, row, col, cfg.rows, cfg.columns)) cells.push({ row, col });
    }
  }
  return cells;
}

/**
 * Effective grid position per rack after applying manual overrides (PRD §5.18).
 * Aligned 1:1 with `expandRacks` order — rackIndex is the 1-based generation
 * index. Racks without an override keep their generated row/col.
 */
export function effectiveRackPositions(
  racks: GeneratedRackDescriptor[],
  overrides: RackOverride[] = []
): Array<{ rackIndex: number; row: number; col: number }> {
  const byIndex = new Map(overrides.map(o => [o.rackIndex, o]));
  return racks.map(r => {
    const ov = byIndex.get(r.rackIndex);
    return ov ? { rackIndex: r.rackIndex, row: ov.row, col: ov.col } : { rackIndex: r.rackIndex, row: r.row, col: r.col };
  });
}

/**
 * Collision-aware placement check (PRD §5.18). A move is valid when the target
 * is inside the grid and on a kept cell of the shape (U/L). Dropping onto a
 * cell occupied by another rack is ALSO valid — it is a swap (swapWith carries
 * the occupant's rackIndex), since a fully-populated grid leaves no free cells.
 * Dropping on the rack's own current cell is always valid (clears the override).
 */
export function canPlaceRack(
  cfg: RackGenerationConfig,
  racks: GeneratedRackDescriptor[],
  overrides: RackOverride[],
  layoutType: LayoutType,
  rackIndex: number,
  targetRow: number,
  targetCol: number
): { ok: boolean; reason?: 'out_of_bounds' | 'shape_cell'; swapWith?: number } {
  if (targetRow < 1 || targetRow > cfg.rows || targetCol < 1 || targetCol > cfg.columns) {
    return { ok: false, reason: 'out_of_bounds' };
  }
  if (!isRackCellKept(layoutType, targetRow, targetCol, cfg.rows, cfg.columns)) {
    return { ok: false, reason: 'shape_cell' };
  }
  if (!racks.some(r => r.rackIndex === rackIndex)) return { ok: false, reason: 'out_of_bounds' };
  // Occupancy is computed over effective positions (overrides applied).
  for (const pos of effectiveRackPositions(racks, overrides)) {
    if (pos.rackIndex === rackIndex) continue;
    if (pos.row === targetRow && pos.col === targetCol) {
      return { ok: true, swapWith: pos.rackIndex };
    }
  }
  return { ok: true };
}

/**
 * Normalized design-grid coordinates (unit 100) per rack, aligned 1:1 with
 * `expandRacks`/`generationInputs` order (row-major, U/L-filtered). Persisted
 * to `warehouse_racks.position_x/y` on save so the Viewer can reproduce the
 * designed layout instead of auto-arranging (G11). Consumers scale the unit
 * to their own cell sizes. Manual `overrides` (drag & drop) win over the
 * generated positions.
 */
export function rackGridPositions(
  cfg: RackGenerationConfig,
  naming: NamingConfig,
  layoutType: LayoutType = 'grid',
  overrides: RackOverride[] = []
): { x: number; y: number }[] {
  return effectiveRackPositions(expandRacks(cfg, naming, layoutType), overrides).map(p => ({
    x: (p.col - 1) * 100,
    y: (p.row - 1) * 100,
  }));
}

function joinParts(parts: string[], separator: string): string {
  return parts.filter(Boolean).join(separator || '-');
}
