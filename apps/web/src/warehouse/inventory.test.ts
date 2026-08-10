import { describe, it, expect } from 'vitest';
import {
  validateBinCapacity,
  normaliseSearch,
  queryMatches,
  binSearchHaystack,
  searchBins,
  resolveBinItems,
  binCurrentQty,
  buildInventoryRows,
  movementEdgeForDelta,
  type BinSearchContext,
} from './inventory';
import type { BinItemRow, BinRow, RackRow, LayoutRow, ZoneRow } from './types';

// ─── Capacity validation ──────────────────────────────────────────────────────

describe('validateBinCapacity', () => {
  it('allows stock up to the cap', () => {
    const c = validateBinCapacity(100, 40, 60);
    expect(c.ok).toBe(true);
    expect(c.projectedQty).toBe(100);
    expect(c.remaining).toBe(60);
    expect(c.exceedsBy).toBe(0);
  });

  it('blocks a projection over the cap and reports the excess', () => {
    const c = validateBinCapacity(100, 90, 25);
    expect(c.ok).toBe(false);
    expect(c.projectedQty).toBe(115);
    expect(c.exceedsBy).toBe(15);
  });

  it('never blocks removals even when over capacity', () => {
    const c = validateBinCapacity(100, 120, -20);
    expect(c.ok).toBe(true);
  });

  it('treats missing/zero caps as unbounded (never blocks)', () => {
    expect(validateBinCapacity(null, 500, 9999).ok).toBe(true);
    expect(validateBinCapacity(0, 500, 9999).ok).toBe(true);
    expect(validateBinCapacity(undefined, 500, 9999).remaining).toBe(Infinity);
  });
});

// ─── Search engine ────────────────────────────────────────────────────────────

describe('normaliseSearch / queryMatches', () => {
  it('collapses separators and case so A-01 matches a01', () => {
    expect(normaliseSearch('A-01 L1')).toBe('a01l1');
    expect(queryMatches('A-01', 'a-01_l1')).toBe(true);
    expect(queryMatches('RM BULK', 'rm-bulk')).toBe(true);
  });

  it('returns false for empty queries', () => {
    expect(queryMatches('', 'anything')).toBe(false);
    expect(queryMatches('   ', 'anything')).toBe(false);
  });
});

describe('binSearchHaystack / searchBins', () => {
  const ctx = (partial: Partial<BinSearchContext>): BinSearchContext => ({
    binId: 'bin-1',
    binName: 'RM-01-L1',
    binCode: 'RM-01',
    rackName: 'Rack A',
    zoneName: 'Bulk Storage',
    items: [
      { id: 'row-1', itemId: 'it-1', itemName: 'MS Pipe 100mm', itemCode: 'MSP-100', quantity: 5, isPrimary: true, isReserve: false, batchNo: 'BATCH-2201', lotNo: null },
    ],
    ...partial,
  });

  it('matches by bin name, rack, zone, item name, code and batch', () => {
    const hay = binSearchHaystack(ctx({}));
    expect(queryMatches('RM-01', hay)).toBe(true);
    expect(queryMatches('Rack A', hay)).toBe(true);
    expect(queryMatches('bulk', hay)).toBe(true);
    expect(queryMatches('MS Pipe', hay)).toBe(true);
    expect(queryMatches('MSP-100', hay)).toBe(true);
    expect(queryMatches('BATCH-2201', hay)).toBe(true);
  });

  it('searchBins returns matching ids and ignores the rest', () => {
    const bins = [
      ctx({ binId: 'b1', binName: 'A-01' }),
      ctx({ binId: 'b2', binName: 'A-02' }),
      ctx({ binId: 'b3', binName: 'B-01' }),
    ];
    expect(searchBins('A-0', bins)).toEqual(['b1', 'b2']);
    expect(searchBins('B-01', bins)).toEqual(['b3']);
    expect(searchBins('', bins)).toEqual([]);
  });
});

// ─── Item resolution ──────────────────────────────────────────────────────────

describe('resolveBinItems', () => {
  const binItems: BinItemRow[] = [
    { id: 'r1', bin_id: 'bin-1', item_id: 'it-1', quantity: 10, is_primary: true } as BinItemRow,
    { id: 'r2', bin_id: 'bin-1', item_id: 'it-2', quantity: 4, batch_no: 'B-9' } as BinItemRow,
    { id: 'r3', bin_id: 'bin-2', item_id: 'missing', quantity: 2 } as BinItemRow,
  ];

  it('joins item names and groups by bin', () => {
    const map = resolveBinItems(binItems, [
      { id: 'it-1', name: 'MS Pipe 100mm', code: 'MSP-100', unit: 'm' },
      { id: 'it-2', name: 'Elbow 50mm', code: 'ELB-50', unit: 'no' },
    ]);
    expect(map.get('bin-1')).toHaveLength(2);
    expect(map.get('bin-1')![0].itemName).toBe('MS Pipe 100mm');
    expect(map.get('bin-1')![0].isPrimary).toBe(true);
    expect(map.get('bin-1')![1].batchNo).toBe('B-9');
    // Unknown item id falls back to the id so the UI never shows a blank.
    expect(map.get('bin-2')![0].itemName).toBe('missing');
    expect(map.get('bin-9')).toBeUndefined();
  });

  it('binCurrentQty sums all items in a bin', () => {
    const map = resolveBinItems(binItems, [{ id: 'it-1', name: 'A', code: null, unit: null }]);
    expect(binCurrentQty(map, 'bin-1')).toBe(14);
    expect(binCurrentQty(map, 'bin-2')).toBe(2);
    expect(binCurrentQty(map, 'nope')).toBe(0);
  });
});

// ─── Movement-Engine audit encoding (TAD §5.4 / §5.12) ───────────────────────

describe('movementEdgeForDelta', () => {
  it('positive delta is a destination-side movement (stock added to the bin)', () => {
    expect(movementEdgeForDelta('B-01', 7)).toEqual({
      sourceBinId: null,
      destinationBinId: 'B-01',
      quantity: 7,
    });
  });

  it('negative delta is a source-side movement (stock leaves the bin)', () => {
    expect(movementEdgeForDelta('B-01', -4)).toEqual({
      sourceBinId: 'B-01',
      destinationBinId: null,
      quantity: -4,
    });
  });

  it('zero delta produces no movement edge (flag-only updates are not stock movements)', () => {
    expect(movementEdgeForDelta('B-01', 0)).toEqual({
      sourceBinId: null,
      destinationBinId: null,
      quantity: 0,
    });
  });

  it('the edge is reversal-compatible: reversing the audit row undoes the delta', () => {
    // Adding 5 to a bin → audit records dest +5. The reversal model says a
    // destination-gaining row reverses to a destination loss — the inverse.
    const add = movementEdgeForDelta('B-01', 5);
    expect(add.destinationBinId).toBe('B-01');
    expect(add.sourceBinId).toBeNull();
    const remove = movementEdgeForDelta('B-01', -5);
    expect(remove.sourceBinId).toBe('B-01');
    expect(remove.destinationBinId).toBeNull();
  });
});

// ─── Inventory rows ───────────────────────────────────────────────────────────

describe('buildInventoryRows', () => {
  const structure = {
    bins: [
      { id: 'bin-1', name: 'A-01-L1', rack_id: 'rack-1', max_quantity: 100 } as BinRow,
      { id: 'bin-2', name: 'A-02-L1', rack_id: 'rack-1', max_quantity: 50 } as BinRow,
    ],
    racks: [{ id: 'rack-1', name: 'A-01', layout_id: 'lay-1' } as RackRow],
    layouts: [{ id: 'lay-1', zone_id: 'zone-1' } as LayoutRow],
    zones: [{ id: 'zone-1', name: 'Bulk Storage', storage_role: 'bulk_storage' } as ZoneRow],
  };

  it('flattens bins with rack + zone context and current qty', () => {
    const map = resolveBinItems(
      [{ id: 'r1', bin_id: 'bin-1', item_id: 'it-1', quantity: 30 } as BinItemRow],
      [{ id: 'it-1', name: 'MS Pipe', code: 'MSP', unit: null }]
    );
    const rows = buildInventoryRows(structure, map);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      binId: 'bin-1',
      binName: 'A-01-L1',
      rackName: 'A-01',
      zoneName: 'Bulk Storage',
      storageRole: 'bulk_storage',
      binMaxQty: 100,
      currentQty: 30,
    });
    expect(rows[1].currentQty).toBe(0);
  });
});
