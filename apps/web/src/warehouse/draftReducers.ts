// src/warehouse/draftReducers.ts
// Pure reducer functions for the Warehouse Designer draft model.
// Extracted from WarehouseDesignerPage so the nested update logic is
// unit-testable without React. Every function returns a NEW draft
// (immutable updates) and never mutates the input.
//
// Since Phase 1.5 the draft supports MULTIPLE LAYOUTS PER ZONE (PRD §3.8,
// §5.9): every zone owns a `layouts` array, and layout-scoped reducers
// take a `layoutId` argument.

import type {
  WarehouseDraft,
  FloorDraft,
  ZoneDraft,
  LayoutDraft,
} from './types';
import { createEmptyFloor, createEmptyZone, createEmptyLayout } from './types';
import { expandRacks, effectiveRackPositions, canPlaceRack } from './namingEngine';

type FloorPatch = Partial<Omit<FloorDraft, 'zones'>>;
type ZonePatch = Partial<Omit<ZoneDraft, 'layouts'>>;
type LayoutPatch = Partial<LayoutDraft>;
type RacksPatch = Partial<LayoutDraft['racks']>;
type NamingPatch = Partial<LayoutDraft['naming']>;
type LayoutConfigPatch = Partial<LayoutDraft['config']>;

// ─── Warehouse ────────────────────────────────────────────────────────────────

export function updateWarehouse(draft: WarehouseDraft, patch: Partial<WarehouseDraft>): WarehouseDraft {
  return { ...draft, ...patch };
}

// ─── Floors ───────────────────────────────────────────────────────────────────

export function updateFloor(draft: WarehouseDraft, floorId: string, patch: FloorPatch): WarehouseDraft {
  return {
    ...draft,
    floors: draft.floors.map(f => (f.id === floorId ? { ...f, ...patch } : f)),
  };
}

export function addFloor(draft: WarehouseDraft): { draft: WarehouseDraft; floor: FloorDraft } {
  const floor = createEmptyFloor(draft.floors.length + 1);
  return { draft: { ...draft, floors: [...draft.floors, floor] }, floor };
}

export function removeFloor(draft: WarehouseDraft, floorId: string): WarehouseDraft {
  if (draft.floors.length <= 1) return draft;
  return { ...draft, floors: draft.floors.filter(f => f.id !== floorId) };
}

export function reorderFloor(draft: WarehouseDraft, floorId: string, dir: -1 | 1): WarehouseDraft {
  const idx = draft.floors.findIndex(f => f.id === floorId);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= draft.floors.length) return draft;
  const floors = [...draft.floors];
  const [moved] = floors.splice(idx, 1);
  floors.splice(target, 0, moved);
  return { ...draft, floors: floors.map((f, i) => ({ ...f, displayOrder: i + 1 })) };
}

/** Move a floor to an absolute index (drag & drop support). */
export function moveFloor(draft: WarehouseDraft, floorId: string, toIndex: number): WarehouseDraft {
  const idx = draft.floors.findIndex(f => f.id === floorId);
  if (idx < 0 || toIndex < 0 || toIndex >= draft.floors.length || idx === toIndex) return draft;
  const floors = [...draft.floors];
  const [moved] = floors.splice(idx, 1);
  floors.splice(toIndex, 0, moved);
  return { ...draft, floors: floors.map((f, i) => ({ ...f, displayOrder: i + 1 })) };
}

// ─── Zones ────────────────────────────────────────────────────────────────────

export function updateZone(draft: WarehouseDraft, floorId: string, zoneId: string, patch: ZonePatch): WarehouseDraft {
  return {
    ...draft,
    floors: draft.floors.map(f =>
      f.id === floorId
        ? { ...f, zones: f.zones.map(z => (z.id === zoneId ? { ...z, ...patch } : z)) }
        : f
    ),
  };
}

export function addZone(draft: WarehouseDraft, floorId: string): { draft: WarehouseDraft; zone: ZoneDraft } {
  const zone = createEmptyZone();
  return {
    draft: {
      ...draft,
      floors: draft.floors.map(f => (f.id === floorId ? { ...f, zones: [...f.zones, zone] } : f)),
    },
    zone,
  };
}

export function removeZone(draft: WarehouseDraft, floorId: string, zoneId: string): WarehouseDraft {
  return {
    ...draft,
    floors: draft.floors.map(f =>
      f.id === floorId ? { ...f, zones: f.zones.filter(z => z.id !== zoneId) } : f
    ),
  };
}

/** Deep-copy a zone (and all its layouts) — G5 duplicate zone. */
export function duplicateZone(draft: WarehouseDraft, floorId: string, zoneId: string): { draft: WarehouseDraft; zone: ZoneDraft } {
  const floor = draft.floors.find(f => f.id === floorId);
  const source = floor?.zones.find(z => z.id === zoneId);
  if (!floor || !source) return { draft, zone: createEmptyZone() };
  const copy: ZoneDraft = {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name} (copy)`,
    color: source.color,
    layouts: source.layouts.map(l => ({
      ...l,
      id: crypto.randomUUID(),
      name: `${l.name} (copy)`,
      naming: { ...l.naming },
      racks: { ...l.racks },
      config: { ...l.config },
    })),
  };
  return {
    draft: {
      ...draft,
      floors: draft.floors.map(f =>
        f.id === floorId ? { ...f, zones: [...f.zones, copy] } : f
      ),
    },
    zone: copy,
  };
}

/** Move a zone to an absolute index within its floor (drag & drop). */
export function moveZone(draft: WarehouseDraft, floorId: string, zoneId: string, toIndex: number): WarehouseDraft {
  const floor = draft.floors.find(f => f.id === floorId);
  if (!floor) return draft;
  const idx = floor.zones.findIndex(z => z.id === zoneId);
  if (idx < 0 || toIndex < 0 || toIndex >= floor.zones.length || idx === toIndex) return draft;
  const zones = [...floor.zones];
  const [moved] = zones.splice(idx, 1);
  zones.splice(toIndex, 0, moved);
  return {
    ...draft,
    floors: draft.floors.map(f => (f.id === floorId ? { ...f, zones } : f)),
  };
}

// ─── Layouts (multiple per zone) ──────────────────────────────────────────────

function zoneOf(draft: WarehouseDraft, floorId: string, zoneId: string): ZoneDraft | undefined {
  return draft.floors.find(f => f.id === floorId)?.zones.find(z => z.id === zoneId);
}

function mapZoneLayouts(
  draft: WarehouseDraft,
  floorId: string,
  zoneId: string,
  fn: (layouts: LayoutDraft[]) => LayoutDraft[]
): WarehouseDraft {
  const zone = zoneOf(draft, floorId, zoneId);
  if (!zone) return draft;
  return {
    ...draft,
    floors: draft.floors.map(f =>
      f.id === floorId
        ? { ...f, zones: f.zones.map(z => (z.id === zoneId ? { ...z, layouts: fn(z.layouts) } : z)) }
        : f
    ),
  };
}

export function addLayout(draft: WarehouseDraft, floorId: string, zoneId: string, layoutType?: LayoutDraft['layoutType']): { draft: WarehouseDraft; layout: LayoutDraft } {
  const layout = createEmptyLayout(layoutType);
  return {
    draft: mapZoneLayouts(draft, floorId, zoneId, layouts => [...layouts, layout]),
    layout,
  };
}

export function removeLayout(draft: WarehouseDraft, floorId: string, zoneId: string, layoutId: string): WarehouseDraft {
  const zone = zoneOf(draft, floorId, zoneId);
  if (!zone || zone.layouts.length <= 1) return draft;
  return mapZoneLayouts(draft, floorId, zoneId, layouts => layouts.filter(l => l.id !== layoutId));
}

export function duplicateLayout(draft: WarehouseDraft, floorId: string, zoneId: string, layoutId: string): { draft: WarehouseDraft; layout: LayoutDraft } {
  const zone = zoneOf(draft, floorId, zoneId);
  const source = zone?.layouts.find(l => l.id === layoutId);
  if (!zone || !source) return { draft, layout: createEmptyLayout() };
  const copy: LayoutDraft = {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name} (copy)`,
    naming: { ...source.naming },
    racks: { ...source.racks },
    config: { ...source.config },
  };
  return {
    draft: mapZoneLayouts(draft, floorId, zoneId, layouts => [...layouts, copy]),
    layout: copy,
  };
}

export function updateLayout(draft: WarehouseDraft, floorId: string, zoneId: string, layoutId: string, patch: LayoutPatch): WarehouseDraft {
  return mapZoneLayouts(draft, floorId, zoneId, layouts =>
    layouts.map(l => (l.id === layoutId ? { ...l, ...patch } : l))
  );
}

export function updateLayoutConfig(draft: WarehouseDraft, floorId: string, zoneId: string, layoutId: string, patch: LayoutConfigPatch): WarehouseDraft {
  return mapZoneLayouts(draft, floorId, zoneId, layouts =>
    layouts.map(l => (l.id === layoutId ? { ...l, config: { ...l.config, ...patch } } : l))
  );
}

export function updateRacks(draft: WarehouseDraft, floorId: string, zoneId: string, layoutId: string, patch: RacksPatch): WarehouseDraft {
  return mapZoneLayouts(draft, floorId, zoneId, layouts =>
    layouts.map(l => (l.id === layoutId ? { ...l, racks: { ...l.racks, ...patch } } : l))
  );
}

export function updateNaming(draft: WarehouseDraft, floorId: string, zoneId: string, layoutId: string, patch: NamingPatch): WarehouseDraft {
  return mapZoneLayouts(draft, floorId, zoneId, layouts =>
    layouts.map(l => (l.id === layoutId ? { ...l, naming: { ...l.naming, ...patch } } : l))
  );
}

// ─── Counts (used by the designer summary + tests) ────────────────────────────

export function countZones(draft: WarehouseDraft): number {
  return draft.floors.reduce((n, f) => n + f.zones.length, 0);
}

export function countLayouts(draft: WarehouseDraft): number {
  return draft.floors.reduce((n, f) => n + f.zones.reduce((z, zo) => z + zo.layouts.length, 0), 0);
}

export function countRacks(draft: WarehouseDraft): number {
  return draft.floors.reduce(
    (n, f) => n + f.zones.reduce((z, zo) => z + zo.layouts.reduce((l, lo) => l + lo.racks.rows * lo.racks.columns, 0), 0),
    0
  );
}

/**
 * Remap draft zone/layout ids to the ids persisted by the last save.
 * Keeps subsequent saves in the same session version-chaining correctly.
 */
export function remapDraftIds(
  draft: WarehouseDraft,
  zoneIdMap: Record<string, string>,
  layoutIdMap: Record<string, string> = {}
): WarehouseDraft {
  const hasZoneMap = !!zoneIdMap && Object.keys(zoneIdMap).length > 0;
  const hasLayoutMap = !!layoutIdMap && Object.keys(layoutIdMap).length > 0;
  if (!hasZoneMap && !hasLayoutMap) return draft;
  return {
    ...draft,
    floors: draft.floors.map(f => ({
      ...f,
      zones: f.zones.map(z => {
        const newZoneId = hasZoneMap ? zoneIdMap[z.id] : undefined;
        const next = newZoneId && newZoneId !== z.id ? { ...z, id: newZoneId } : z;
        if (!hasLayoutMap) return next;
        return {
          ...next,
          layouts: next.layouts.map(l => {
            const newLayoutId = layoutIdMap[l.id];
            return newLayoutId && newLayoutId !== l.id ? { ...l, id: newLayoutId } : l;
          }),
        };
      }),
    })),
  };
}

/**
 * Drag-placement for a rack (PRD §5.18): move rack `rackIndex` to a new
 * (row, col) on the layout grid. Swap-aware — dropping onto a cell occupied
 * by another rack swaps the two racks (the only sane behaviour in a full
 * grid). Invalid targets (out of bounds, removed shape cell) are no-ops, and
 * dropping a rack back on its own cell removes its override.
 *
 * After every move the effective positions are materialised into the override
 * list, so a chain of swaps always converges to a consistent layout.
 */
export function reduceMoveRack(
  draft: WarehouseDraft,
  floorId: string,
  zoneId: string,
  layoutId: string,
  rackIndex: number,
  row: number,
  col: number
): WarehouseDraft {
  return mapZoneLayouts(draft, floorId, zoneId, layouts =>
    layouts.map(l => {
      if (l.id !== layoutId) return l;
      const racks = expandRacks(l.racks, l.naming, l.layoutType);
      const overrides = l.rackOverrides ?? [];
      const check = canPlaceRack(l.racks, racks, overrides, l.layoutType, rackIndex, row, col);
      if (!check.ok) return l; // out of bounds / removed shape cell → no-op

      const effective = effectiveRackPositions(racks, overrides);
      const moving = effective.find(p => p.rackIndex === rackIndex);
      if (!moving) return l;

      // Back on its own current cell → clear the override (return to generated).
      if (moving.row === row && moving.col === col) {
        return { ...l, rackOverrides: overrides.filter(o => o.rackIndex !== rackIndex) };
      }

      // Swap semantics: the occupant (if any) takes the mover's old cell.
      const occupant = check.swapWith != null ? effective.find(p => p.rackIndex === check.swapWith) : undefined;
      const target = new Map(effective.map(p => [p.rackIndex, { row: p.row, col: p.col }]));
      target.set(rackIndex, { row, col });
      if (occupant) target.set(occupant.rackIndex, { row: moving.row, col: moving.col });

      // Materialise overrides for every rack that differs from its generated cell.
      const nextOverrides = racks
        .map(r => ({ rackIndex: r.rackIndex, ...(target.get(r.rackIndex) ?? { row: r.row, col: r.col }) }))
        .filter(p => {
          const gen = racks.find(r => r.rackIndex === p.rackIndex);
          return !!gen && (p.row !== gen.row || p.col !== gen.col);
        })
        .map(p => ({ rackIndex: p.rackIndex, row: p.row, col: p.col }));
      return { ...l, rackOverrides: nextOverrides };
    })
  );
}

/** Flat lookup helpers for the UI (selected layout resolution). */
export function findZone(draft: WarehouseDraft, floorId: string, zoneId: string): ZoneDraft | undefined {
  return zoneOf(draft, floorId, zoneId);
}

export function findLayout(draft: WarehouseDraft, floorId: string, zoneId: string, layoutId: string): LayoutDraft | undefined {
  return zoneOf(draft, floorId, zoneId)?.layouts.find(l => l.id === layoutId);
}
