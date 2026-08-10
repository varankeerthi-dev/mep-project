/** Warehouse stock entry — editor state for a specific warehouse+variant+make combination */
export interface WarehouseStockEntry {
  exclude: boolean;
  current_stock: number;
}

/**
 * Sentinel used as the variant part of a stock key when an item is not
 * tracked per-variant (i.e. a single "Default" stock column).
 */
export const NO_VARIANT_KEY = 'no_variant';

/**
 * Build a deterministic, collision-safe key for one warehouse stock cell.
 *
 * Includes `make` so the same variant in two different makes gets its own
 * stock slot instead of collapsing into one. JSON encoding makes collisions
 * impossible even if user-entered makes contain underscores or other glue
 * characters.
 */
export function buildStockKey(
  warehouseId: string,
  variantId: string | null | undefined,
  make?: string | null
): string {
  return JSON.stringify([warehouseId, variantId || NO_VARIANT_KEY, make || '']);
}

/** Key-value map: stock key (see buildStockKey) -> stock entry */
export type WarehouseStockMap = Record<string, WarehouseStockEntry>;

/**
 * Derive the unique (variant × make) combinations that get their own stock
 * columns, from the variant pricing rows. Rows without a variant selected are
 * ignored, and duplicate (variant, make) pairs are collapsed so the same
 * combination never renders twice.
 */
export function variantStockCombos(
  variantPricing: { company_variant_id?: string | null; make?: string | null }[]
): { variantId: string; make: string }[] {
  const seen = new Set<string>();
  const combos: { variantId: string; make: string }[] = [];
  for (const row of variantPricing) {
    if (!row.company_variant_id) continue;
    const make = (row.make || '').trim();
    const key = `${row.company_variant_id}\u0001${make}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combos.push({ variantId: row.company_variant_id, make });
  }
  return combos;
}

/** Normalized warehouse stock row for display */
export interface WarehouseStockRow {
  id: string;
  warehouse: string;
  variant: string;
  current_stock: number;
  low_stock_level: number;
  updated_at: string;
}
