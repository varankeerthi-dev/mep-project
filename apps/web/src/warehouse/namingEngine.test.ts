import { describe, it, expect } from 'vitest';
import {
  alphaLabel,
  padNumber,
  formatSequence,
  rackName,
  levelLabel,
  binName,
  binNamePreview,
  expandRacks,
  generationInputs,
  layoutGridCells,
  effectiveRackPositions,
  canPlaceRack,
  rackGridPositions,
  generatedRackCells,
  overridesFromPositions,
} from './namingEngine';
import { DEFAULT_NAMING, DEFAULT_RACKS } from './types';

describe('alphaLabel', () => {
  it('maps 1-based indexes to alphabetic labels', () => {
    expect(alphaLabel(1)).toBe('A');
    expect(alphaLabel(2)).toBe('B');
    expect(alphaLabel(26)).toBe('Z');
    expect(alphaLabel(27)).toBe('AA');
    expect(alphaLabel(28)).toBe('AB');
    expect(alphaLabel(52)).toBe('AZ');
    expect(alphaLabel(53)).toBe('BA');
  });
});

describe('layoutGridCells (PRD §5.18 drop grid)', () => {
  it('emits every cell for a grid layout', () => {
    expect(layoutGridCells(DEFAULT_RACKS, 'grid')).toHaveLength(10); // 2×5
    expect(layoutGridCells(DEFAULT_RACKS, 'grid')[0]).toEqual({ row: 1, col: 1 });
    expect(layoutGridCells(DEFAULT_RACKS, 'grid')[9]).toEqual({ row: 2, col: 5 });
  });

  it('omits removed cells for U/L shapes', () => {
    // U shape (2 rows × 5 cols): kept = row 2 (5) + row 1 col 1 + col 5 = 7
    expect(layoutGridCells(DEFAULT_RACKS, 'u_shape')).toHaveLength(7);
    // L shape: kept = row 2 (5) + row 1 col 1 = 6
    expect(layoutGridCells(DEFAULT_RACKS, 'l_shape')).toHaveLength(6);
  });
});

describe('canPlaceRack (collision detection + swap)', () => {
  const racks = expandRacks(DEFAULT_RACKS, DEFAULT_NAMING, 'grid');

  it('accepts a free in-bounds cell', () => {
    // Grid 2×5 is full, so first free a cell with an override, then move into it.
    const overrides = [{ rackIndex: 1, row: 2, col: 3 }]; // rack 1 leaves (1,1)
    expect(canPlaceRack(DEFAULT_RACKS, racks, overrides, 'grid', 8, 1, 1).ok).toBe(true);
  });

  it('returns swapWith for a cell occupied by another rack', () => {
    // Rack 2 sits at (1,2) — dropping rack 1 there is a swap.
    const r = canPlaceRack(DEFAULT_RACKS, racks, [], 'grid', 1, 1, 2);
    expect(r.ok).toBe(true);
    expect(r.swapWith).toBe(2);
  });

  it('rejects out-of-bounds cells', () => {
    expect(canPlaceRack(DEFAULT_RACKS, racks, [], 'grid', 1, 3, 1).reason).toBe('out_of_bounds');
    expect(canPlaceRack(DEFAULT_RACKS, racks, [], 'grid', 1, 0, 1).reason).toBe('out_of_bounds');
    expect(canPlaceRack(DEFAULT_RACKS, racks, [], 'grid', 1, 1, 6).reason).toBe('out_of_bounds');
  });

  it('rejects a removed cell of a U/L shape', () => {
    const shapeRacks = expandRacks(DEFAULT_RACKS, DEFAULT_NAMING, 'u_shape');
    // u_shape keeps row 2 + row 1 cols 1/5; (1,3) is removed.
    const r = canPlaceRack(DEFAULT_RACKS, shapeRacks, [], 'u_shape', 7, 1, 3);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('shape_cell');
  });

  it('occupancy accounts for existing overrides', () => {
    // Rack 1 moved to (2,3); rack 10 dropping there swaps with rack 1.
    const overrides = [{ rackIndex: 1, row: 2, col: 3 }];
    const r = canPlaceRack(DEFAULT_RACKS, racks, overrides, 'grid', 10, 2, 3);
    expect(r.ok).toBe(true);
    expect(r.swapWith).toBe(1);
  });

  it('always allows dropping on the rack\'s own generated cell', () => {
    expect(canPlaceRack(DEFAULT_RACKS, racks, [], 'grid', 3, 1, 3).ok).toBe(true);
  });
});

describe('effectiveRackPositions + rackGridPositions overrides', () => {
  it('applies overrides and keeps defaults for the rest', () => {
    const racks = expandRacks(DEFAULT_RACKS, DEFAULT_NAMING, 'grid');
    const positions = effectiveRackPositions(racks, [{ rackIndex: 2, row: 2, col: 5 }]);
    expect(positions[1]).toEqual({ rackIndex: 2, row: 2, col: 5 });
    expect(positions[0]).toEqual({ rackIndex: 1, row: 1, col: 1 });
  });

  it('rackGridPositions emits moved coordinates aligned to generation order', () => {
    const positions = rackGridPositions(DEFAULT_RACKS, DEFAULT_NAMING, 'grid', [{ rackIndex: 3, row: 2, col: 1 }]);
    expect(positions[2]).toEqual({ x: 0, y: 100 }); // rack 3 → (2,1)
    expect(positions[0]).toEqual({ x: 0, y: 0 }); // rack 1 stays (1,1)
  });

  it('generatedRackCells matches expandRacks ordering without naming', () => {
    const cells = generatedRackCells(DEFAULT_RACKS, 'grid');
    expect(cells[0]).toEqual({ rackIndex: 1, row: 1, col: 1 });
    expect(cells[9]).toEqual({ rackIndex: 10, row: 2, col: 5 });
    expect(cells).toHaveLength(10);
    // U shape filters removed cells identically to the preview grid.
    expect(generatedRackCells(DEFAULT_RACKS, 'u_shape')).toHaveLength(7);
  });

  it('overridesFromPositions round-trips saved coordinates back to overrides', () => {
    // Rack 3 persisted at (2,1) → x=0, y=100; others at their defaults.
    const saved = rackGridPositions(DEFAULT_RACKS, DEFAULT_NAMING, 'grid', [{ rackIndex: 3, row: 2, col: 1 }]);
    const overrides = overridesFromPositions(
      DEFAULT_RACKS, 'grid',
      saved.map(p => ({ x: p.x, y: p.y }))
    );
    expect(overrides).toEqual([{ rackIndex: 3, row: 2, col: 1 }]);
  });

  it('overridesFromPositions returns empty when everything is at the generated grid', () => {
    const saved = rackGridPositions(DEFAULT_RACKS, DEFAULT_NAMING, 'grid');
    expect(overridesFromPositions(DEFAULT_RACKS, 'grid', saved.map(p => ({ x: p.x, y: p.y })))).toEqual([]);
  });
});

describe('padNumber', () => {
  it('zero-pads to the requested width', () => {
    expect(padNumber(1, 2)).toBe('01');
    expect(padNumber(12, 2)).toBe('12');
    expect(padNumber(1, 3)).toBe('001');
    expect(padNumber(123, 3)).toBe('123');
  });

  it('never produces empty strings even with width 0', () => {
    expect(padNumber(7, 0)).toBe('7');
  });
});

describe('formatSequence', () => {
  it('formats numeric with padding', () => {
    expect(formatSequence('numeric', 3, 2)).toBe('03');
  });

  it('formats alphabetic without padding', () => {
    expect(formatSequence('alpha', 2, 4)).toBe('B');
  });

  it('formats alphanumeric as letter + number', () => {
    expect(formatSequence('alphanumeric', 2, 2)).toBe('B2');
  });
});

describe('rackName', () => {
  it('produces the PRD-style sequential rack names', () => {
    const cfg = { ...DEFAULT_NAMING, prefix: 'A' };
    expect(rackName(1, cfg)).toBe('A-01');
    expect(rackName(2, cfg)).toBe('A-02');
    expect(rackName(10, cfg)).toBe('A-10');
  });

  it('supports alphabetic rack numbering', () => {
    const cfg = { ...DEFAULT_NAMING, prefix: 'R', numberingStyle: 'alpha' as const };
    expect(rackName(1, cfg)).toBe('R-A');
    expect(rackName(2, cfg)).toBe('R-B');
  });

  it('omits prefix when empty', () => {
    expect(rackName(1, DEFAULT_NAMING)).toBe('01');
  });

  it('appends a suffix', () => {
    const cfg = { ...DEFAULT_NAMING, prefix: 'FG', suffix: 'X' };
    expect(rackName(3, cfg)).toBe('FG-03-X');
  });
});

describe('levelLabel', () => {
  it('replaces {n} with the tier number', () => {
    expect(levelLabel(1, 'L{n}')).toBe('L1');
    expect(levelLabel(2, 'L{n}')).toBe('L2');
    expect(levelLabel(3, 'T{n}')).toBe('T3');
  });

  it('falls back to L{n} when format is empty', () => {
    expect(levelLabel(4, '')).toBe('L4');
  });
});

describe('binName', () => {
  it('produces the PRD §5.15 example: rack A, columns 10, levels 3 → A-01-L1 …', () => {
    const cfg = { ...DEFAULT_NAMING, prefix: 'A' };
    expect(binName(1, 1, 1, cfg)).toBe('A-01-01-L1');
    expect(binName(1, 2, 1, cfg)).toBe('A-01-02-L1');
    expect(binName(1, 1, 2, cfg)).toBe('A-01-01-L2');
    expect(binName(2, 1, 1, cfg)).toBe('A-02-01-L1');
  });

  it('builds names from the full rack name, so bins are unique per rack', () => {
    const cfg = { ...DEFAULT_NAMING, prefix: 'RM' };
    // Rack RM-01 vs RM-02 must not collide on the same column/level.
    expect(binName(1, 3, 1, cfg)).not.toBe(binName(2, 3, 1, cfg));
    expect(binName(1, 3, 1, cfg)).toBe('RM-01-03-L1');
    expect(binName(2, 3, 1, cfg)).toBe('RM-02-03-L1');
  });

  it('matches the SQL generator output format (rackName + col + level)', () => {
    const cfg = { ...DEFAULT_NAMING, prefix: '' };
    expect(binName(1, 1, 1, cfg)).toBe('01-01-L1');
  });
});

describe('binNamePreview', () => {
  it('returns column-major output matching the PRD example order', () => {
    const cfg = { ...DEFAULT_NAMING, prefix: 'A' };
    const preview = binNamePreview(cfg, 3, 3, 12);
    expect(preview[0]).toBe('A-01-01-L1');
    expect(preview[1]).toBe('A-01-01-L2');
    expect(preview[2]).toBe('A-01-01-L3');
    expect(preview[3]).toBe('A-01-02-L1');
    expect(preview.length).toBe(9); // 3 cols × 3 levels, no more needed
  });

  it('respects the count limit', () => {
    const cfg = { ...DEFAULT_NAMING, prefix: 'A' };
    expect(binNamePreview(cfg, 10, 3, 5).length).toBe(5);
  });
});

describe('expandRacks', () => {
  it('generates racks row-major with global indexes', () => {
    const cfg = { ...DEFAULT_RACKS, rows: 2, columns: 3, levels: 4 };
    const racks = expandRacks(cfg, { ...DEFAULT_NAMING, prefix: 'A' });
    expect(racks).toHaveLength(6);
    expect(racks[0]).toMatchObject({ row: 1, col: 1, rackIndex: 1, columns: 3, levels: 4 });
    expect(racks[1]).toMatchObject({ row: 1, col: 2, rackIndex: 2 });
    expect(racks[2]).toMatchObject({ row: 1, col: 3, rackIndex: 3 });
    expect(racks[3]).toMatchObject({ row: 2, col: 1, rackIndex: 4 });
    expect(racks[5]).toMatchObject({ row: 2, col: 3, rackIndex: 6 });
  });

  it('names racks sequentially', () => {
    const cfg = { ...DEFAULT_RACKS, rows: 2, columns: 2 };
    const racks = expandRacks(cfg, { ...DEFAULT_NAMING, prefix: 'A' });
    expect(racks.map(r => r.name)).toEqual(['A-01', 'A-02', 'A-03', 'A-04']);
  });

  it('returns empty for zero rows or columns', () => {
    expect(expandRacks({ ...DEFAULT_RACKS, rows: 0, columns: 5 }, DEFAULT_NAMING)).toHaveLength(0);
    expect(expandRacks({ ...DEFAULT_RACKS, rows: 3, columns: 0 }, DEFAULT_NAMING)).toHaveLength(0);
  });

  it('omits interior racks for u_shape layouts (perimeter only)', () => {
    const cfg = { ...DEFAULT_RACKS, rows: 3, columns: 4 };
    const racks = expandRacks(cfg, DEFAULT_NAMING, 'u_shape');
    // 3×4 grid = 12 cells; u_shape keeps bottom row (4) + first/last columns of rows 1–2 (4) = 8.
    expect(racks).toHaveLength(8);
    const coords = racks.map(r => `${r.row},${r.col}`).sort();
    expect(coords).toEqual(['1,1', '1,4', '2,1', '2,4', '3,1', '3,2', '3,3', '3,4']);
    // Names are sequential over the kept racks only.
    expect(racks.map(r => r.name)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08']);
  });

  it('omits interior racks for l_shape layouts (bottom row + first column)', () => {
    const cfg = { ...DEFAULT_RACKS, rows: 3, columns: 3 };
    const racks = expandRacks(cfg, DEFAULT_NAMING, 'l_shape');
    // 3×3 grid = 9 cells; l_shape keeps bottom row (3) + first column rows 1–2 (2) = 5.
    expect(racks).toHaveLength(5);
    const coords = racks.map(r => `${r.row},${r.col}`).sort();
    expect(coords).toEqual(['1,1', '2,1', '3,1', '3,2', '3,3']);
  });

  it('keeps the full grid for non-shaped layout types', () => {
    const cfg = { ...DEFAULT_RACKS, rows: 2, columns: 3 };
    expect(expandRacks(cfg, DEFAULT_NAMING, 'grid')).toHaveLength(6);
    expect(expandRacks(cfg, DEFAULT_NAMING, 'parallel_rows')).toHaveLength(6);
    expect(expandRacks(cfg, DEFAULT_NAMING, 'open_yard')).toHaveLength(6);
  });
});

describe('generationInputs', () => {
  it('produces parallel arrays consumable by generate_warehouse_bins', () => {
    const cfg = { ...DEFAULT_RACKS, rows: 2, columns: 4, levels: 3 };
    const inputs = generationInputs(cfg, { ...DEFAULT_NAMING, prefix: 'A' });
    expect(inputs.count).toBe(8);
    expect(inputs.rackNames).toHaveLength(8);
    expect(inputs.columns).toHaveLength(8);
    expect(inputs.levels).toHaveLength(8);
    // All racks share the configured columns/levels.
    expect(inputs.columns.every(c => c === 4)).toBe(true);
    expect(inputs.levels.every(l => l === 3)).toBe(true);
    expect(inputs.rackNames[0]).toBe('A-01');
    expect(inputs.rackNames[7]).toBe('A-08');
  });

  it('emits only the shaped racks for u_shape — matches the preview count (B1)', () => {
    const cfg = { ...DEFAULT_RACKS, rows: 3, columns: 4, levels: 3 };
    const inputs = generationInputs(cfg, { ...DEFAULT_NAMING, prefix: 'A' }, 'u_shape');
    expect(inputs.count).toBe(8);
    expect(inputs.rackNames).toEqual(['A-01', 'A-02', 'A-03', 'A-04', 'A-05', 'A-06', 'A-07', 'A-08']);
    expect(inputs.columns).toHaveLength(8);
    expect(inputs.levels).toHaveLength(8);
  });

  it('emits only the shaped racks for l_shape (B1)', () => {
    const cfg = { ...DEFAULT_RACKS, rows: 3, columns: 3, levels: 3 };
    const inputs = generationInputs(cfg, { ...DEFAULT_NAMING, prefix: 'A' }, 'l_shape');
    expect(inputs.count).toBe(5);
    expect(inputs.rackNames[4]).toBe('A-05');
  });
});
