// src/warehouse/validations.ts
// Pure designer validations (PRD §5.21). Every check returns a list of
// { path, message } problems. Side-effect free and unit-testable.
// The designer calls `validateDraft` before saving.

import type { WarehouseDraft } from './types';
import { expandRacks } from './namingEngine';

export interface ValidationProblem {
  /** Stable key so the UI can highlight the exact field. */
  key: string;
  message: string;
  /** Optional reference ids for locating the offending entity. */
  floorId?: string;
  zoneId?: string;
  layoutId?: string;
}

export function validateDraft(draft: WarehouseDraft): ValidationProblem[] {
  const problems: ValidationProblem[] = [];

  if (!draft.name.trim()) problems.push({ key: 'warehouse.name', message: 'Warehouse name is required.' });
  if (!draft.code.trim()) problems.push({ key: 'warehouse.code', message: 'Warehouse code is required.' });
  if (draft.floors.length === 0) problems.push({ key: 'warehouse.floors', message: 'Add at least one floor.' });

  const warehouseRackNames = new Set<string>();
  const warehouseBinNames = new Set<string>();

  for (const floor of draft.floors) {
    if (!floor.name.trim()) {
      problems.push({ key: 'floor.name', message: 'Every floor needs a name.', floorId: floor.id });
    }
    for (const zone of floor.zones) {
      if (!zone.name.trim()) {
        problems.push({ key: 'zone.name', message: 'Every zone needs a name.', floorId: floor.id, zoneId: zone.id });
      }
      if (zone.layouts.length === 0) {
        problems.push({ key: 'zone.layouts', message: `Zone "${zone.name || 'unnamed'}" needs at least one layout.`, floorId: floor.id, zoneId: zone.id });
      }
      for (const layout of zone.layouts) {
        const lKey = { floorId: floor.id, zoneId: zone.id, layoutId: layout.id };
        const { rows, columns, levels } = layout.racks;
        if (rows < 1 || columns < 1 || levels < 1) {
          problems.push({ key: 'layout.racks.dims', message: `Layout "${layout.name}" needs rows, columns and levels ≥ 1.`, ...lKey });
        }
        if (rows * columns > 200) {
          problems.push({ key: 'layout.racks.too_many', message: `Layout "${layout.name}" would generate ${rows * columns} racks (max 200 per layout).`, ...lKey });
        }
        // Invalid naming conflicts (empty prefix + no numbering would collide).
        if (!layout.naming.prefix && layout.naming.numberingStyle !== 'numeric') {
          problems.push({ key: 'layout.naming.conflict', message: `Layout "${layout.name}" needs a prefix when numbering is not numeric.`, ...lKey });
        }

        // Duplicate rack names across the whole warehouse (PRD §5.21).
        for (const rack of expandRacks(layout.racks, layout.naming, layout.layoutType)) {
          if (warehouseRackNames.has(rack.name)) {
            problems.push({ key: 'racks.duplicate', message: `Duplicate rack name "${rack.name}" in layout "${layout.name}".`, ...lKey });
          } else {
            warehouseRackNames.add(rack.name);
          }
        }

        // Duplicate bin names across the whole warehouse.
        for (let col = 1; col <= columns; col++) {
          for (let lvl = 1; lvl <= levels; lvl++) {
            const name = `${layout.naming.prefix || ''}${layout.naming.separator}${String(col).padStart(Math.max(1, layout.naming.padding), '0')}${layout.naming.separator}${(layout.naming.levelFormat || 'L{n}').replace(/\{n\}/g, String(lvl))}`;
            if (warehouseBinNames.has(name)) {
              problems.push({ key: 'bins.duplicate', message: `Duplicate bin name "${name}" across layouts. Rename one layout's prefix.`, ...lKey });
            } else {
              warehouseBinNames.add(name);
            }
          }
        }
      }
    }
  }

  return problems;
}

export function hasProblems(problems: ValidationProblem[]): boolean {
  return problems.length > 0;
}
