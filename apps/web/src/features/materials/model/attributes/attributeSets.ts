import type { MaterialCustomAttribute } from '../entities/Material';

export interface AttributeSetLine {
  attribute_name: string;
  attribute_value: string;
  attribute_unit: string;
  data_type?: string;
  attribute_definition_id?: string | null;
}

export interface AttributeSet {
  id: string;
  organisation_id: string;
  name: string;
  lines: AttributeSetLine[];
}

export interface AttributeSetMergeResult {
  merged: MaterialCustomAttribute[];
  applied: AttributeSetLine[];
  skipped: AttributeSetLine[];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Applies a reusable attribute set to an item's attribute rows.
 *
 * Rules, chosen so applying a set to a partially-filled item is safe:
 * - A line whose name (case-insensitive, trimmed) the item already has is
 *   skipped. Applying a set never duplicates and never overwrites a value the
 *   user already typed.
 * - Rows keep their existing sort_order; new rows continue from the current
 *   max so ordering stays stable across repeated applies.
 * - A line with a blank name is dropped rather than creating an unusable row.
 */
export function mergeAttributeSet(
  existing: MaterialCustomAttribute[],
  lines: AttributeSetLine[],
): AttributeSetMergeResult {
  const present = new Set(existing.map((row) => normalizeName(row.attribute_name)).filter(Boolean));

  const applied: AttributeSetLine[] = [];
  const skipped: AttributeSetLine[] = [];

  for (const line of lines) {
    const name = line.attribute_name?.trim() ?? '';
    if (!name) continue;
    if (present.has(normalizeName(name))) {
      skipped.push(line);
      continue;
    }
    present.add(normalizeName(name));
    applied.push(line);
  }

  const nextOrder = existing.reduce((max, row) => Math.max(max, row.sort_order ?? 0), -1) + 1;

  const additions: MaterialCustomAttribute[] = applied.map((line, i) => ({
    attribute_name: line.attribute_name.trim(),
    attribute_value: line.attribute_value || '',
    attribute_unit: line.attribute_unit || '',
    data_type: (line.data_type as MaterialCustomAttribute['data_type']) || 'text',
    attribute_definition_id: line.attribute_definition_id || null,
    sort_order: nextOrder + i,
  }));

  return { merged: [...existing, ...additions], applied, skipped };
}

/**
 * Normalizes a set's lines for persistence: trims names, drops blank ones,
 * and caps the count. Mirrors the guard the save path applies so what is
 * stored matches what the merge would actually add.
 */
export function normalizeAttributeSetLines(lines: AttributeSetLine[], maxLines = 50): AttributeSetLine[] {
  return lines
    .filter((line) => (line.attribute_name ?? '').trim().length > 0)
    .slice(0, maxLines)
    .map((line) => ({
      attribute_name: line.attribute_name.trim(),
      attribute_value: line.attribute_value || '',
      attribute_unit: line.attribute_unit || '',
      data_type: line.data_type || 'text',
      attribute_definition_id: line.attribute_definition_id || null,
    }));
}
