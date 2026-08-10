// src/warehouse/viewer/geometry.ts
// Pure geometry builder for the Warehouse Viewer. Turns the persisted
// DB structure (floors/zones/layouts/racks/tiers/bins) into a positioned
// 2D model the SVG canvas renders. Rendering is kept dumb: this module
// decides where everything sits.
//
// Phase 1 does not persist grid rows/columns for rack arrangement, so
// racks are auto-arranged row-major in a near-square grid (deterministic).
// Per-rack dimensions (columns × levels) are always taken from the rack row.

import type { FloorRow, ZoneRow, LayoutRow, RackRow, TierRow, BinRow } from '../types';
import type { CapacityStats } from './occupancy';
import { aggregateCapacity } from './occupancy';

export interface Viewport {
  tx: number;
  ty: number;
  zoom: number;
}

export const DEFAULT_VIEWPORT: Viewport = { tx: 0, ty: 0, zoom: 0.75 };

/**
 * Compute the viewport transform that centres a model bounding box in a
 * view of viewW × viewH with padding. Pure math — unit tested.
 */
export function fitBBox(
  bbox: { x: number; y: number; w: number; h: number },
  viewW: number,
  viewH: number,
  padding = 48
): Viewport {
  const availW = Math.max(viewW - padding * 2, 1);
  const availH = Math.max(viewH - padding * 2, 1);
  const zoom = Math.min(availW / Math.max(bbox.w, 1), availH / Math.max(bbox.h, 1), 1.25);
  const z = Math.max(zoom, 0.05);
  return {
    zoom: z,
    tx: (viewW - bbox.w * z) / 2 - bbox.x * z,
    ty: (viewH - bbox.h * z) / 2 - bbox.y * z,
  };
}

export const CELL_W = 34; // bin cell width
export const CELL_H = 26; // bin cell height (level stacked top-down)
export const RACK_PAD = 6;
export const ZONE_PAD = 18;
export const FLOOR_HEADER = 34; // floor band height
export const ZONE_HEADER = 26; // zone chip height
export const GAP = 16; // zone / floor vertical gap

// ─── Rack arrangement ─────────────────────────────────────────────────────────

export interface PositionedRack {
  rack: RackRow;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  binCount: number;
}

/** Row-major arrangement of racks into a near-square grid (deterministic). */
export function arrangeRacks<T extends { name: string }>(racks: T[]): Array<{ rack: T; row: number; col: number }> {
  const n = racks.length;
  if (n === 0) return [];
  const perRow = Math.ceil(Math.sqrt(n));
  return racks.map((rack, i) => ({
    rack,
    row: Math.floor(i / perRow) + 1,
    col: (i % perRow) + 1,
  }));
}

/**
 * True when a set of racks carries persisted design-grid positions (G11).
 * Positions are stored in unit-100 grid space: rack at (row, col) has
 * position_x = (col-1)*100, position_y = (row-1)*100. Legacy racks (created
 * before positions were persisted) are all zero → auto-arrange instead.
 */
export function hasStoredPositions(racks: RackRow[]): boolean {
  return racks.some(r => Number(r.position_x ?? 0) !== 0 || Number(r.position_y ?? 0) !== 0);
}

/**
 * Grid coordinates (1-based row/col) for a rack with stored positions.
 * Falls back to (1,1) for zero positions (should not happen when
 * hasStoredPositions is true).
 */
export function storedRowCol(rack: RackRow): { row: number; col: number } {
  return {
    row: Math.round(Number(rack.position_y ?? 0) / 100) + 1,
    col: Math.round(Number(rack.position_x ?? 0) / 100) + 1,
  };
}

export function rackWidth(columnsCount: number): number {
  return columnsCount * CELL_W + RACK_PAD * 2;
}

export function rackHeight(levelsCount: number): number {
  return levelsCount * CELL_H + RACK_PAD * 2;
}

// ─── Viewer model ─────────────────────────────────────────────────────────────

export interface PositionedBin {
  bin: BinRow;
  column: number;
  tierNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  currentQty: number;
}

export interface PositionedZone {
  zone: ZoneRow;
  layout: LayoutRow | null;
  racks: PositionedRack[];
  bins: PositionedBin[];
  x: number;
  y: number;
  width: number;
  height: number;
  stats: CapacityStats;
}

export interface PositionedFloor {
  floor: FloorRow;
  zones: PositionedZone[];
  x: number;
  y: number;
  width: number;
  height: number;
  stats: CapacityStats;
}

export interface ViewerModel {
  warehouseId: string;
  warehouseName: string;
  floors: PositionedFloor[];
  totalWidth: number;
  totalHeight: number;
  stats: CapacityStats;
}

export interface ViewerStructure {
  warehouse: { id: string; warehouse_name?: string | null; name?: string | null; warehouse_code?: string | null } | null;
  floors: FloorRow[];
  zones: ZoneRow[];
  layouts: LayoutRow[];
  racks: RackRow[];
  tiers: TierRow[];
  bins: BinRow[];
}

/**
 * Build the full positioned model from DB rows.
 * quantitiesByBin (bin id → current qty) comes from warehouse_bin_items;
 * empty in Phase 2 (inventory lands in Phase 3).
 */
export function buildViewerModel(
  structure: ViewerStructure,
  quantitiesByBin: Map<string, number> = new Map()
): ViewerModel {
  const floors: PositionedFloor[] = [];
  let cursorY = 0;
  let totalWidth = 0;

  const floorsSorted = [...structure.floors].sort((a, b) => a.display_order - b.display_order);

  for (const floor of floorsSorted) {
    const zones = structure.zones.filter(z => z.floor_id === floor.id);
    const positionedZones: PositionedZone[] = [];
    let zoneCursorY = cursorY + FLOOR_HEADER;
    let floorWidth = 0;

    for (const zone of zones) {
      const layout = structure.layouts.find(l => l.zone_id === zone.id) ?? null;
      const zoneRacks = structure.racks.filter(r => r.layout_id === layout?.id);
      // G11: reproduce the designed layout from persisted positions when
      // available (U/L shapes etc.); otherwise auto-arrange row-major.
      const usesStored = hasStoredPositions(zoneRacks);
      const placed = usesStored
        ? zoneRacks.map(r => ({ rack: r, ...storedRowCol(r) }))
        : arrangeRacks(zoneRacks);

      // Build bins per rack, grouped by tier number then column number.
      const binsForRack = (rackId: string): BinRow[] =>
        structure.bins.filter(b => b.rack_id === rackId);
      const tierFor = (bin: BinRow): number => {
        const tier = structure.tiers.find(t => t.id === bin.tier_id);
        return tier?.tier_number ?? 1;
      };

      const positionedRacks: PositionedRack[] = placed.map(({ rack, row, col }) => {
        const width = rackWidth(Math.max(1, rack.columns_count));
        const height = rackHeight(Math.max(1, rack.levels_count));
        return { rack, row, col, x: 0, y: 0, width, height, binCount: binsForRack(rack.id).length };
      });

      // Position racks. Stored positions map 1 design unit (100) to one
      // rack cell (width + gap), so U/L shapes come out exactly as designed.
      // Auto layout: row-major with per-row height = tallest rack in it.
      const perRow = Math.max(...placed.map(p => p.row), 1);
      const rowHeights: number[] = [];
      for (let r = 1; r <= perRow; r++) {
        rowHeights.push(Math.max(...positionedRacks.filter(p => p.row === r).map(p => p.height), 0));
      }
      let zoneWidth = 0;
      let yCursor = zoneCursorY + ZONE_HEADER;
      for (const p of positionedRacks) {
        if (usesStored) {
          const sx = Number(p.rack.position_x ?? 0) / 100;
          const sy = Number(p.rack.position_y ?? 0) / 100;
          p.x = ZONE_PAD + sx * (p.width + 8);
          p.y = yCursor + sy * (p.height + 8);
        } else {
          const rowX = (p.col - 1) * (p.width + 8);
          p.x = ZONE_PAD + rowX;
          const rowTopOffset = rowHeights.slice(0, p.row - 1).reduce((s, h) => s + h + 8, 0);
          p.y = yCursor + rowTopOffset;
        }
        zoneWidth = Math.max(zoneWidth, p.x + p.width + ZONE_PAD);
      }
      const zoneHeight = ZONE_HEADER
        + (usesStored
            ? Math.max(...positionedRacks.map(p => p.y + p.height), 0)
            : rowHeights.reduce((s, h) => s + h, 0) + (rowHeights.length - 1) * 8)
        + ZONE_PAD;

      // Position bins inside each rack (columns → x, tiers → y).
      const zoneBins: PositionedBin[] = [];
      for (const p of positionedRacks) {
        const bins = binsForRack(p.rack.id);
        const byTier = new Map<number, BinRow[]>();
        for (const b of bins) {
          const tn = tierFor(b);
          if (!byTier.has(tn)) byTier.set(tn, []);
          byTier.get(tn)!.push(b);
        }
        for (const [tn, tierBins] of [...byTier.entries()].sort((a, b) => a[0] - b[0])) {
          const yOff = RACK_PAD + (tn - 1) * CELL_H;
          for (const b of tierBins) {
            const xOff = RACK_PAD + (b.column_number - 1) * CELL_W;
            zoneBins.push({
              bin: b,
              column: b.column_number,
              tierNumber: tn,
              x: p.x + xOff,
              y: p.y + yOff,
              width: CELL_W,
              height: CELL_H,
              currentQty: quantitiesByBin.get(b.id) ?? 0,
            });
          }
        }
      }

      const stats = aggregateCapacity(
        zoneBins.map(zb => zb.bin),
        quantitiesByBin
      );

      positionedZones.push({
        zone,
        layout,
        racks: positionedRacks,
        bins: zoneBins,
        x: 4,
        y: zoneCursorY,
        width: Math.max(zoneWidth, 300),
        height: zoneHeight,
        stats,
      });

      floorWidth = Math.max(floorWidth, Math.max(zoneWidth, 300));
      zoneCursorY += zoneHeight + GAP;
    }

    const floorHeight = (zoneCursorY - GAP) - cursorY;
    const positionedFloor: PositionedFloor = {
      floor,
      zones: positionedZones,
      x: 4,
      y: cursorY,
      width: Math.max(floorWidth, 300),
      height: floorHeight,
      stats: aggregateCapacity(
        positionedZones.flatMap(z => z.bins.map(b => b.bin)),
        quantitiesByBin
      ),
    };
    floors.push(positionedFloor);
    totalWidth = Math.max(totalWidth, floorWidth);
    cursorY += floorHeight + 28;
  }

  const allBins = floors.flatMap(f => f.zones.flatMap(z => z.bins.map(b => b.bin)));
  const stats = aggregateCapacity(allBins, quantitiesByBin);

  return {
    warehouseId: structure.warehouse?.id ?? '',
    warehouseName: structure.warehouse?.warehouse_name ?? structure.warehouse?.name ?? 'Untitled Warehouse',
    floors,
    totalWidth: Math.max(totalWidth, 480),
    totalHeight: cursorY,
    stats,
  };
}
