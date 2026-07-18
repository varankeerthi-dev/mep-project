import type { Material } from '../model/entities';

/** Normalize material fields before save or display. */
export function normalizeMaterial(material: Partial<Material>): Partial<Material> {
  return {
    ...material,
    name: material.name?.trim() || '',
    display_name: material.display_name?.trim() || material.name?.trim() || '',
    item_code: material.item_code?.toUpperCase() || '',
  };
}
