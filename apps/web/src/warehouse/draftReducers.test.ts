import { describe, it, expect } from 'vitest';
import {
  updateWarehouse,
  updateFloor,
  addFloor,
  removeFloor,
  reorderFloor,
  moveFloor,
  updateZone,
  addZone,
  removeZone,
  moveZone,
  duplicateZone,
  updateLayout,
  updateLayoutConfig,
  updateRacks,
  updateNaming,
  addLayout,
  removeLayout,
  duplicateLayout,
  reduceMoveRack,
  countZones,
  countLayouts,
  countRacks,
  remapDraftIds,
} from './draftReducers';
import { createEmptyWarehouse, createEmptyFloor, DEFAULT_RACKS, DEFAULT_LAYOUT_CONFIG } from './types';

function baseDraft() {
  const draft = createEmptyWarehouse();
  // Deterministic ids so assertions don't depend on crypto.randomUUID().
  draft.id = 'wh-1';
  draft.name = 'Main Warehouse';
  draft.code = 'MW';
  draft.floors[0].id = 'fl-1';
  draft.floors[0].name = 'Ground Floor';
  draft.floors[0].zones[0].id = 'zn-1';
  draft.floors[0].zones[0].name = 'RM Bulk Zone';
  draft.floors[0].zones[0].layouts[0].id = 'ly-1';
  draft.floors[0].zones[0].layouts[0].name = 'Grid Layout';
  return draft;
}

describe('updateWarehouse', () => {
  it('updates top-level fields immutably', () => {
    const draft = baseDraft();
    const next = updateWarehouse(draft, { name: 'North Warehouse', manager: 'Jane' });
    expect(next.name).toBe('North Warehouse');
    expect(next.manager).toBe('Jane');
    expect(next.code).toBe('MW'); // untouched
    expect(draft.name).toBe('Main Warehouse'); // original untouched
    expect(next).not.toBe(draft);
  });
});

describe('updateFloor', () => {
  it('updates only the target floor', () => {
    const draft = baseDraft();
    const next = updateFloor(draft, 'fl-1', { name: 'First Floor' });
    expect(next.floors[0].name).toBe('First Floor');
    expect(next.floors[0].zones).toHaveLength(1); // zones preserved
  });

  it('ignores unknown floor ids', () => {
    const draft = baseDraft();
    const next = updateFloor(draft, 'nope', { name: 'X' });
    expect(next.floors[0].name).toBe('Ground Floor');
  });
});

describe('addFloor / removeFloor', () => {
  it('adds a floor with the next display order', () => {
    const draft = baseDraft();
    const { draft: next, floor } = addFloor(draft);
    expect(next.floors).toHaveLength(2);
    expect(floor.displayOrder).toBe(2);
    expect(next.floors[1]).toBe(floor);
    expect(next.floors[1].zones).toHaveLength(1); // new floor gets a default zone
  });

  it('removes a floor', () => {
    const draft = baseDraft();
    const withTwo = addFloor(draft).draft;
    const next = removeFloor(withTwo, 'fl-1');
    expect(next.floors).toHaveLength(1);
    expect(next.floors[0].id).not.toBe('fl-1');
  });

  it('refuses to remove the last remaining floor', () => {
    const draft = baseDraft();
    const next = removeFloor(draft, 'fl-1');
    expect(next.floors).toHaveLength(1);
    expect(next.floors[0].id).toBe('fl-1');
  });
});

describe('reorderFloor / moveFloor', () => {
  it('moves a floor up and renumbers display orders', () => {
    const draft = baseDraft();
    const f2 = createEmptyFloor(2);
    f2.id = 'fl-2';
    f2.name = 'Second Floor';
    const two = { ...draft, floors: [draft.floors[0], f2] };

    const next = reorderFloor(two, 'fl-2', -1);
    expect(next.floors.map(f => f.id)).toEqual(['fl-2', 'fl-1']);
    expect(next.floors.map(f => f.displayOrder)).toEqual([1, 2]);
  });

  it('moves a floor down', () => {
    const draft = baseDraft();
    const f2 = createEmptyFloor(2);
    f2.id = 'fl-2';
    const two = { ...draft, floors: [draft.floors[0], f2] };
    const next = reorderFloor(two, 'fl-1', 1);
    expect(next.floors.map(f => f.id)).toEqual(['fl-2', 'fl-1']);
  });

  it('is a no-op at the boundaries and for unknown ids', () => {
    const draft = baseDraft();
    expect(reorderFloor(draft, 'fl-1', -1).floors.map(f => f.id)).toEqual(['fl-1']);
    expect(reorderFloor(draft, 'fl-1', 1).floors.map(f => f.id)).toEqual(['fl-1']);
    expect(reorderFloor(draft, 'ghost', 1).floors.map(f => f.id)).toEqual(['fl-1']);
  });

  it('moveFloor supports drag & drop absolute indexing', () => {
    const draft = baseDraft();
    const f2 = createEmptyFloor(2);
    f2.id = 'fl-2';
    const two = { ...draft, floors: [draft.floors[0], f2] };
    const next = moveFloor(two, 'fl-2', 0);
    expect(next.floors.map(f => f.id)).toEqual(['fl-2', 'fl-1']);
    expect(next.floors[0].displayOrder).toBe(1);
    expect(next.floors[1].displayOrder).toBe(2);
  });
});

describe('addZone / removeZone / updateZone / moveZone / duplicateZone', () => {
  it('adds a zone to the correct floor only', () => {
    const draft = baseDraft();
    const f2 = createEmptyFloor(2);
    f2.id = 'fl-2';
    const two = { ...draft, floors: [draft.floors[0], f2] };

    const { draft: next, zone } = addZone(two, 'fl-2');
    expect(next.floors[1].zones).toHaveLength(2); // default + new
    expect(next.floors[1].zones[1]).toBe(zone);
    expect(next.floors[0].zones).toHaveLength(1); // untouched floor
  });

  it('removes a zone', () => {
    const draft = baseDraft();
    const { draft: withTwo, zone } = addZone(draft, 'fl-1');
    expect(countZones(withTwo)).toBe(2);
    const next = removeZone(withTwo, 'fl-1', zone.id);
    expect(countZones(next)).toBe(1);
    expect(next.floors[0].zones[0].id).toBe('zn-1');
  });

  it('updates zone metadata immutably', () => {
    const draft = baseDraft();
    const next = updateZone(draft, 'fl-1', 'zn-1', { name: 'FG Dispatch Zone', storageRole: 'dispatch' });
    expect(next.floors[0].zones[0].name).toBe('FG Dispatch Zone');
    expect(next.floors[0].zones[0].storageRole).toBe('dispatch');
    expect(draft.floors[0].zones[0].name).toBe('RM Bulk Zone');
  });

  it('moveZone supports drag & drop within a floor', () => {
    const draft = baseDraft();
    const { draft: two, zone } = addZone(draft, 'fl-1');
    const next = moveZone(two, 'fl-1', zone.id, 0);
    expect(next.floors[0].zones.map(z => z.id)).toEqual([zone.id, 'zn-1']);
  });

  it('duplicateZone deep-copies a zone and all its layouts (G5)', () => {
    const draft = baseDraft();
    const { draft: next, zone } = duplicateZone(draft, 'fl-1', 'zn-1');
    expect(next.floors[0].zones).toHaveLength(2);
    expect(zone.name).toBe('RM Bulk Zone (copy)');
    expect(zone.id).not.toBe('zn-1');
    expect(zone.layouts).toHaveLength(1);
    expect(zone.layouts[0].id).not.toBe('ly-1');
    expect(zone.layouts[0].name).toBe('Grid Layout (copy)');
    // Original untouched.
    expect(draft.floors[0].zones[0].name).toBe('RM Bulk Zone');
  });
});

describe('layouts per zone (PRD §3.8/§5.9)', () => {
  it('addLayout appends a new layout and returns it', () => {
    const draft = baseDraft();
    const { draft: next, layout } = addLayout(draft, 'fl-1', 'zn-1', 'u_shape');
    expect(next.floors[0].zones[0].layouts).toHaveLength(2);
    expect(layout.layoutType).toBe('u_shape');
    expect(countLayouts(next)).toBe(2);
  });

  it('removeLayout keeps at least one layout per zone', () => {
    const draft = baseDraft();
    const withTwo = addLayout(draft, 'fl-1', 'zn-1').draft;
    expect(removeLayout(withTwo, 'fl-1', 'zn-1', 'ly-1').floors[0].zones[0].layouts).toHaveLength(1);
    // Refuses to remove the last one.
    expect(removeLayout(draft, 'fl-1', 'zn-1', 'ly-1').floors[0].zones[0].layouts).toHaveLength(1);
  });

  it('duplicateLayout copies the source layout with fresh ids (G5)', () => {
    const draft = baseDraft();
    const { draft: next, layout } = duplicateLayout(draft, 'fl-1', 'zn-1', 'ly-1');
    expect(next.floors[0].zones[0].layouts).toHaveLength(2);
    expect(layout.name).toBe('Grid Layout (copy)');
    expect(layout.id).not.toBe('ly-1');
    expect(layout.naming).toEqual(draft.floors[0].zones[0].layouts[0].naming);
    expect(layout.racks).toEqual(draft.floors[0].zones[0].layouts[0].racks);
  });

  it('updateLayout targets only the given layout id', () => {
    const draft = baseDraft();
    const withTwo = addLayout(draft, 'fl-1', 'zn-1', 'u_shape').draft;
    const otherId = withTwo.floors[0].zones[0].layouts[1].id;
    const next = updateLayout(withTwo, 'fl-1', 'zn-1', otherId, { layoutType: 'l_shape' });
    const layouts = next.floors[0].zones[0].layouts;
    expect(layouts[0].layoutType).toBe('grid'); // untouched
    expect(layouts[1].layoutType).toBe('l_shape');
  });

  it('updateLayoutConfig updates only config fields (PRD §5.10)', () => {
    const draft = baseDraft();
    const next = updateLayoutConfig(draft, 'fl-1', 'zn-1', 'ly-1', { aisleWidthM: 4.5, rackDirection: 'east' });
    const cfg = next.floors[0].zones[0].layouts[0].config;
    expect(cfg.aisleWidthM).toBe(4.5);
    expect(cfg.rackDirection).toBe('east');
    expect(cfg.scale).toBe(DEFAULT_LAYOUT_CONFIG.scale); // untouched
    expect(cfg.walkwayWidthM).toBe(DEFAULT_LAYOUT_CONFIG.walkwayWidthM); // untouched
  });
});

describe('updateRacks / updateNaming (layout-scoped)', () => {
  it('updates rack generation config', () => {
    const draft = baseDraft();
    const next = updateRacks(draft, 'fl-1', 'zn-1', 'ly-1', { rows: 4, columns: 10, levels: 5 });
    const racks = next.floors[0].zones[0].layouts[0].racks;
    expect(racks.rows).toBe(4);
    expect(racks.columns).toBe(10);
    expect(racks.levels).toBe(5);
    // Unrelated config preserved.
    expect(racks.rackType).toBe(DEFAULT_RACKS.rackType);
  });

  it('updates naming config without clobbering racks', () => {
    const draft = baseDraft();
    const next = updateNaming(draft, 'fl-1', 'zn-1', 'ly-1', { prefix: 'FG', padding: 3 });
    const layout = next.floors[0].zones[0].layouts[0];
    expect(layout.naming.prefix).toBe('FG');
    expect(layout.naming.padding).toBe(3);
    expect(layout.naming.separator).toBe('-'); // untouched
    expect(layout.racks.rows).toBe(DEFAULT_RACKS.rows); // racks untouched
  });

  it('is a no-op for unknown floor/zone/layout ids', () => {
    const draft = baseDraft();
    expect(updateRacks(draft, 'nope', 'zn-1', 'ly-1', { rows: 9 }).floors[0].zones[0].layouts[0].racks.rows).toBe(DEFAULT_RACKS.rows);
    expect(updateNaming(draft, 'fl-1', 'nope', 'ly-1', { prefix: 'X' }).floors[0].zones[0].layouts[0].naming.prefix).toBe('');
    expect(updateRacks(draft, 'fl-1', 'zn-1', 'ghost', { rows: 9 }).floors[0].zones[0].layouts[0].racks.rows).toBe(DEFAULT_RACKS.rows);
  });
});

describe('remapDraftIds', () => {
  it('replaces draft zone + layout ids with the persisted ids (B2 version chaining)', () => {
    const draft = baseDraft();
    const next = remapDraftIds(draft, { 'zn-1': 'zn-100' }, { 'ly-1': 'ly-200' });
    expect(next.floors[0].zones[0].id).toBe('zn-100');
    expect(next.floors[0].zones[0].layouts[0].id).toBe('ly-200');
    // Unmapped ids stay untouched; other zone fields preserved.
    const { draft: withTwo } = addZone(draft, 'fl-1');
    const remapped = remapDraftIds(withTwo, { 'zn-1': 'zn-100' });
    expect(remapped.floors[0].zones[0].id).toBe('zn-100');
    expect(remapped.floors[0].zones[1].id).toBe(withTwo.floors[0].zones[1].id);
    expect(remapped.floors[0].zones[0].name).toBe('RM Bulk Zone');
  });

  it('is a no-op for an empty map or a fresh draft', () => {
    const draft = baseDraft();
    expect(remapDraftIds(draft, {}).floors[0].zones[0].id).toBe('zn-1');
    expect(remapDraftIds(draft, { 'ghost': 'x' }).floors[0].zones[0].id).toBe('zn-1');
  });
});

describe('moveRack (PRD §5.18 drag placement)', () => {
  it('swaps two racks when the target cell is occupied', () => {
    // Rack 1 (1,1) dropped on rack 8 (2,3) → they exchange cells.
    const next = reduceMoveRack(baseDraft(), 'fl-1', 'zn-1', 'ly-1', 1, 2, 3);
    const overrides = next.floors[0].zones[0].layouts[0].rackOverrides ?? [];
    expect(overrides).toContainEqual({ rackIndex: 1, row: 2, col: 3 });
    expect(overrides).toContainEqual({ rackIndex: 8, row: 1, col: 1 });
    expect(overrides).toHaveLength(2);
  });

  it('swapping twice converges back to the generated grid', () => {
    const once = reduceMoveRack(baseDraft(), 'fl-1', 'zn-1', 'ly-1', 1, 2, 3);
    const twice = reduceMoveRack(once, 'fl-1', 'zn-1', 'ly-1', 8, 2, 3); // 8 → 2,3 swaps back
    expect(twice.floors[0].zones[0].layouts[0].rackOverrides ?? []).toHaveLength(0);
  });

  it('removes the override when dropped back on its own generated cell', () => {
    const moved = reduceMoveRack(baseDraft(), 'fl-1', 'zn-1', 'ly-1', 1, 2, 3);
    expect(moved.floors[0].zones[0].layouts[0].rackOverrides).toHaveLength(2);
    const back = reduceMoveRack(moved, 'fl-1', 'zn-1', 'ly-1', 1, 1, 1); // swap back with 8
    expect(back.floors[0].zones[0].layouts[0].rackOverrides ?? []).toHaveLength(0);
  });

  it('is a no-op out of bounds', () => {
    const next = reduceMoveRack(baseDraft(), 'fl-1', 'zn-1', 'ly-1', 1, 3, 1);
    expect(next.floors[0].zones[0].layouts[0].rackOverrides ?? []).toHaveLength(0);
  });

  it('is a no-op on a removed U/L shape cell', () => {
    const draft = baseDraft();
    draft.floors[0].zones[0].layouts[0].layoutType = 'u_shape';
    // u_shape removes (1,3) — moving there must be ignored.
    const next = reduceMoveRack(draft, 'fl-1', 'zn-1', 'ly-1', 7, 1, 3);
    expect(next.floors[0].zones[0].layouts[0].rackOverrides ?? []).toHaveLength(0);
  });
});

describe('counts', () => {
  it('counts zones, layouts and racks across floors', () => {
    const draft = baseDraft();
    expect(countZones(draft)).toBe(1);
    expect(countLayouts(draft)).toBe(1);
    expect(countRacks(draft)).toBe(DEFAULT_RACKS.rows * DEFAULT_RACKS.columns);

    const withTwo = addFloor(draft).draft;
    expect(countZones(withTwo)).toBe(2);
    expect(countLayouts(withTwo)).toBe(2);
    expect(countRacks(withTwo)).toBe(2 * DEFAULT_RACKS.rows * DEFAULT_RACKS.columns);

    const withExtraLayout = addLayout(withTwo, 'fl-1', 'zn-1').draft;
    expect(countLayouts(withExtraLayout)).toBe(3);
  });
});
