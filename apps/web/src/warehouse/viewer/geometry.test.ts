import { describe, it, expect } from 'vitest';
import { arrangeRacks, fitBBox, buildViewerModel, rackWidth, rackHeight, hasStoredPositions, storedRowCol } from './geometry';
import type { RackRow, TierRow, BinRow } from '../types';

function rack(id: string, name: string, columns = 4, levels = 3): RackRow {
  return {
    id,
    layout_id: 'lay-1',
    name,
    columns_count: columns,
    levels_count: levels,
    status: 'available',
  } as RackRow;
}

// Shared fixture used by both the auto-arrange and stored-position tests.
const structure = {
  warehouse: { id: 'wh-1', warehouse_name: 'Main', warehouse_code: 'MW' },
  floors: [{ id: 'fl-1', warehouse_id: 'wh-1', name: 'Ground', display_order: 1 } as any],
  zones: [{ id: 'zn-1', floor_id: 'fl-1', name: 'Bulk', storage_role: 'bulk_storage', code: 'BULK' } as any],
  layouts: [{ id: 'lay-1', zone_id: 'zn-1', layout_type: 'grid', name: 'Grid A' } as any],
  racks: [rack('r1', 'A-01', 2, 2), rack('r2', 'A-02', 2, 2)],
  tiers: [
    { id: 't1', rack_id: 'r1', tier_number: 1, name: 'L1' } as TierRow,
    { id: 't2', rack_id: 'r1', tier_number: 2, name: 'L2' } as TierRow,
    { id: 't3', rack_id: 'r2', tier_number: 1, name: 'L1' } as TierRow,
    { id: 't4', rack_id: 'r2', tier_number: 2, name: 'L2' } as TierRow,
  ],
  bins: [
    { id: 'b1', tier_id: 't1', rack_id: 'r1', column_number: 1, name: 'A-01-01-L1', max_quantity: 100 } as BinRow,
    { id: 'b2', tier_id: 't2', rack_id: 'r1', column_number: 1, name: 'A-01-01-L2', max_quantity: 100 } as BinRow,
    { id: 'b3', tier_id: 't3', rack_id: 'r2', column_number: 1, name: 'A-02-01-L1', max_quantity: 100 } as BinRow,
    { id: 'b4', tier_id: 't4', rack_id: 'r2', column_number: 1, name: 'A-02-01-L2', max_quantity: 100 } as BinRow,
  ],
};

/** Legacy structure: racks with NO stored positions (all zero). */
const legacyStructure = JSON.parse(JSON.stringify(structure));

describe('arrangeRacks', () => {
  it('arranges racks row-major in a near-square grid', () => {
    const racks = [rack('r1', 'A-01'), rack('r2', 'A-02'), rack('r3', 'A-03'), rack('r4', 'A-04')];
    const placed = arrangeRacks(racks);
    expect(placed).toHaveLength(4);
    expect(placed[0]).toMatchObject({ row: 1, col: 1 });
    expect(placed[1]).toMatchObject({ row: 1, col: 2 });
    expect(placed[2]).toMatchObject({ row: 2, col: 1 });
    expect(placed[3]).toMatchObject({ row: 2, col: 2 });
  });

  it('is deterministic for a non-square count', () => {
    const placed = arrangeRacks([rack('r1', 'A-01'), rack('r2', 'A-02'), rack('r3', 'A-03')]);
    // ceil(sqrt(3)) = 2 → rows of 2
    expect(placed.map(p => `${p.row}:${p.col}`)).toEqual(['1:1', '1:2', '2:1']);
  });

  it('returns empty for no racks', () => {
    expect(arrangeRacks([])).toHaveLength(0);
  });

  it('keeps a single rack in row 1 col 1', () => {
    expect(arrangeRacks([rack('r1', 'A-01')])[0]).toMatchObject({ row: 1, col: 1 });
  });
});

describe('rackWidth / rackHeight', () => {
  it('scales with columns and levels', () => {
    expect(rackWidth(4)).toBe(4 * 34 + 12);
    expect(rackHeight(3)).toBe(3 * 26 + 12);
  });
});

describe('stored positions (G11)', () => {
  it('hasStoredPositions is true when any rack carries a non-zero position', () => {
    expect(hasStoredPositions([rack('r1', 'A-01'), { ...rack('r2', 'A-02'), position_x: 100 } as RackRow])).toBe(true);
  });

  it('hasStoredPositions is false for legacy racks (all zero)', () => {
    expect(hasStoredPositions([rack('r1', 'A-01'), rack('r2', 'A-02')])).toBe(false);
    expect(hasStoredPositions([])).toBe(false);
  });

  it('storedRowCol converts unit-100 positions back to 1-based row/col', () => {
    expect(storedRowCol({ ...rack('r1', 'A-01'), position_x: 200, position_y: 0 } as RackRow)).toEqual({ row: 1, col: 3 });
    expect(storedRowCol({ ...rack('r1', 'A-01'), position_x: 0, position_y: 100 } as RackRow)).toEqual({ row: 2, col: 1 });
  });

  it('buildViewerModel reproduces U-shape gaps from stored positions', () => {
    // U-shape on a 3×3 grid: bottom row (y=200) cols 1–3, plus top corners (y=0) cols 1,3.
    const uShapeStructure = {
      ...legacyStructure,
      racks: [
        { ...rack('r1', 'A-01', 2, 2), position_x: 0, position_y: 200 } as RackRow,
        { ...rack('r2', 'A-02', 2, 2), position_x: 100, position_y: 200 } as RackRow,
        { ...rack('r3', 'A-03', 2, 2), position_x: 200, position_y: 200 } as RackRow,
        { ...rack('r4', 'A-04', 2, 2), position_x: 0, position_y: 0 } as RackRow,
        { ...rack('r5', 'A-05', 2, 2), position_x: 200, position_y: 0 } as RackRow,
      ],
    };
    const model = buildViewerModel(uShapeStructure as any);
    const zone = model.floors[0].zones[0];
    const byName = new Map(zone.racks.map(p => [p.rack.name, p]));
    // Top-left corner rack must sit above the bottom row racks (y smaller).
    expect(byName.get('A-04')!.y).toBeLessThan(byName.get('A-01')!.y);
    // The U interior (row 1, col 2) is empty: no rack there.
    expect(zone.racks).toHaveLength(5);
    // Bottom row racks share the same y and are evenly spaced.
    expect(byName.get('A-01')!.y).toBe(byName.get('A-02')!.y);
    expect(byName.get('A-02')!.x).toBeGreaterThan(byName.get('A-01')!.x);
    expect(byName.get('A-03')!.x).toBeGreaterThan(byName.get('A-02')!.x);
  });
});

describe('fitBBox', () => {
  it('centres a bbox with padding and caps zoom', () => {
    const v = fitBBox({ x: 0, y: 0, w: 1000, h: 800 }, 500, 400);
    expect(v.zoom).toBeCloseTo((400 - 96) / 800, 5);
    // Centred: tx such that bbox centre maps to view centre.
    expect(v.tx).toBeCloseTo((500 - 1000 * v.zoom) / 2, 5);
    expect(v.ty).toBeCloseTo((400 - 800 * v.zoom) / 2, 5);
  });

  it('respects a bbox offset', () => {
    const v = fitBBox({ x: 100, y: 50, w: 200, h: 100 }, 400, 300);
    const cx = v.tx + (100 + 100) * v.zoom;
    expect(cx).toBeCloseTo(400 / 2, 1);
  });

  it('never returns zero zoom for degenerate boxes', () => {
    expect(fitBBox({ x: 0, y: 0, w: 0, h: 0 }, 300, 200).zoom).toBeGreaterThan(0);
  });
});

describe('buildViewerModel', () => {
  it('positions floors, zones and racks with non-zero bounds', () => {
    const model = buildViewerModel(structure);
    expect(model.floors).toHaveLength(1);
    const floor = model.floors[0];
    expect(floor.zones).toHaveLength(1);
    const zone = floor.zones[0];
    expect(zone.racks).toHaveLength(2);
    expect(zone.bins).toHaveLength(4);
    expect(model.totalWidth).toBeGreaterThan(0);
    expect(model.totalHeight).toBeGreaterThan(0);

    // Racks are side by side in row 1.
    const [r1, r2] = zone.racks;
    expect(r1.row).toBe(1);
    expect(r1.col).toBe(1);
    expect(r2.row).toBe(1);
    expect(r2.col).toBe(2);
    expect(r2.x).toBeGreaterThan(r1.x);
    expect(r1.y).toBe(r2.y);
  });

  it('attaches current quantities from the bin-item map to bins', () => {
    const qty = new Map([['b1', 40], ['b2', 80]]);
    const model = buildViewerModel(structure, qty);
    const bins = model.floors[0].zones[0].bins;
    expect(bins.find(b => b.bin.id === 'b1')?.currentQty).toBe(40);
    expect(bins.find(b => b.bin.id === 'b2')?.currentQty).toBe(80);
    expect(bins.find(b => b.bin.id === 'b3')?.currentQty).toBe(0);
  });

  it('aggregates overall capacity stats across the warehouse', () => {
    const qty = new Map([['b1', 100], ['b2', 100]]); // two bins full
    const model = buildViewerModel(structure, qty);
    expect(model.stats.binCount).toBe(4);
    expect(model.stats.maxQty).toBe(400);
    expect(model.stats.currentQty).toBe(200);
    expect(model.stats.pct).toBe(50);
    expect(model.stats.level).toBe('low');
  });

  it('handles an empty structure gracefully', () => {
    const model = buildViewerModel({ warehouse: { id: 'wh-0' }, floors: [], zones: [], layouts: [], racks: [], tiers: [], bins: [] });
    expect(model.floors).toHaveLength(0);
    expect(model.totalWidth).toBe(480);
    expect(model.stats.binCount).toBe(0);
  });

  it('sorts floors by display order', () => {
    const twoFloor = {
      ...structure,
      floors: [
        { id: 'fl-2', warehouse_id: 'wh-1', name: 'Upper', display_order: 2 } as any,
        { id: 'fl-1', warehouse_id: 'wh-1', name: 'Ground', display_order: 1 } as any,
      ],
    };
    const model = buildViewerModel(twoFloor as any);
    expect(model.floors.map(f => f.floor.name)).toEqual(['Ground', 'Upper']);
  });
});
