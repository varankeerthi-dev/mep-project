// src/warehouse/inventory.ts
// Pure helpers for Phase 3 — Inventory Location Management & Search.
// No React, no side effects → unit-testable. Covers:
//   • Capacity validation (PRD "Capacity Validation" / TAD "Quantity
//     Validation") — a projected bin quantity must not exceed max_quantity.
//   • Search index + predicate for the Warehouse Search Engine (item /
//     rack / bin / warehouse / QR / barcode / batch / lot) powering the
//     visual highlight loop in the viewer.
//   • Resolving warehouse_bin_items rows against the materials catalog so
//     the UI and search can show item names/codes instead of raw ids.

import type { BinItemRow } from './types';

// ─── Capacity validation ──────────────────────────────────────────────────────

export interface CapacityCheck {
  ok: boolean;
  currentQty: number;
  projectedQty: number;
  maxQty: number; // 0 = no cap configured
  remaining: number; // max - current (Infinity when uncapped)
  exceedsBy: number; // > 0 when the projection overflows the cap
}

/** True when the bin has a configured capacity cap. */
export function hasCapacityCap(maxQuantity?: number | null): boolean {
  return maxQuantity != null && Number(maxQuantity) > 0;
}

/**
 * Validate adding `addQty` to a bin currently holding `currentQty`.
 * Bins without a configured max_quantity are never blocked (ok always true,
 * remaining = Infinity). Negative addQty (removal) can never violate.
 */
export function validateBinCapacity(
  maxQuantity: number | null | undefined,
  currentQty: number,
  addQty: number
): CapacityCheck {
  const current = Number(currentQty) || 0;
  const delta = Number(addQty) || 0;
  const max = maxQuantity != null ? Number(maxQuantity) : 0;
  const projected = current + delta;

  if (!hasCapacityCap(max)) {
    return {
      ok: true,
      currentQty: current,
      projectedQty: projected,
      maxQty: 0,
      remaining: Infinity,
      exceedsBy: 0,
    };
  }
  const remaining = Math.max(0, max - current);
  const exceedsBy = Math.max(0, projected - max);
  return { ok: delta <= 0 || projected <= max, currentQty: current, projectedQty: projected, maxQty: max, remaining, exceedsBy };
}

// ─── Movement-Engine audit encoding (TAD §5.4 / §5.12) ───────────────────────

/**
 * One signed inventory delta expressed the way the Movement Engine records
 * it — sign-encoded so adjustments stay reversal-compatible (TAD §5.12):
 *   * delta > 0 (stock added to a bin) → destination_bin_id = bin, qty = +d
 *   * delta < 0 (stock leaves a bin)   → source_bin_id = bin, qty = d (neg)
 * delta = 0 → no movement (flag-only updates are not stock movements).
 */
export function movementEdgeForDelta(
  binId: string,
  delta: number
): { sourceBinId: string | null; destinationBinId: string | null; quantity: number } {
  const d = Number(delta) || 0;
  if (d > 0) return { sourceBinId: null, destinationBinId: binId, quantity: d };
  if (d < 0) return { sourceBinId: binId, destinationBinId: null, quantity: d };
  return { sourceBinId: null, destinationBinId: null, quantity: 0 };
}

// ─── Item name resolution ─────────────────────────────────────────────────────

export interface AssignableItem {
  id: string;
  name: string;
  code?: string;
  unit?: string;
}

export interface ResolvedBinItem {
  id: string; // warehouse_bin_items row id
  itemId: string;
  itemName: string;
  itemCode?: string;
  unit?: string;
  quantity: number;
  isPrimary: boolean;
  isReserve: boolean;
  batchNo?: string | null;
  lotNo?: string | null;
}

/** Material catalog subset used for name resolution (from fetchAssignableItems). */
export interface ItemCatalogEntry {
  id: string;
  name?: string | null;
  code?: string | null;
  unit?: string | null;
}

/**
 * Join warehouse_bin_items rows with the item catalog. Rows whose item_id
 * is missing from the catalog still resolve (name falls back to the id so
 * the UI never shows a blank). Returns items grouped by bin id.
 */
export function resolveBinItems(
  binItems: BinItemRow[],
  items: ItemCatalogEntry[]
): Map<string, ResolvedBinItem[]> {
  const byId = new Map(items.map(i => [i.id, i]));
  const out = new Map<string, ResolvedBinItem[]>();
  for (const row of binItems) {
    const item = row.item_id ? byId.get(row.item_id) : undefined;
    const resolved: ResolvedBinItem = {
      id: row.id,
      itemId: row.item_id ?? '',
      itemName: item?.name ?? item?.code ?? row.item_id ?? 'Unknown item',
      itemCode: item?.code ?? undefined,
      unit: item?.unit ?? undefined,
      quantity: Number(row.quantity) || 0,
      isPrimary: !!row.is_primary,
      isReserve: !!row.is_reserve,
      batchNo: row.batch_no ?? null,
      lotNo: row.lot_no ?? null,
    };
    const list = out.get(row.bin_id) ?? [];
    list.push(resolved);
    out.set(row.bin_id, list);
  }
  return out;
}

/** Total quantity of items currently in a bin (sums all resolved rows). */
export function binCurrentQty(itemsByBin: Map<string, ResolvedBinItem[]>, binId: string): number {
  return (itemsByBin.get(binId) ?? []).reduce((sum, it) => sum + it.quantity, 0);
}

// ─── Search engine (visual highlight loop) ───────────────────────────────────

export interface BinSearchContext {
  binId: string;
  binName: string;
  binCode?: string | null;
  qrCode?: string | null;
  barcode?: string | null;
  rackName?: string;
  zoneName?: string;
  items?: ResolvedBinItem[];
}

/**
 * Normalise a search haystack: lowercase, trim, collapse whitespace and
 * dashes so "A-01" matches "a01" and vice versa.
 */
export function normaliseSearch(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[-_\s]+/g, '')
    .trim();
}

/** Build the per-bin searchable haystack (item / rack / bin / QR / batch / lot). */
export function binSearchHaystack(ctx: BinSearchContext): string {
  const parts = [
    ctx.binName,
    ctx.binCode,
    ctx.qrCode,
    ctx.barcode,
    ctx.rackName,
    ctx.zoneName,
  ];
  for (const item of ctx.items ?? []) {
    parts.push(item.itemName, item.itemCode, item.batchNo, item.lotNo);
  }
  return normaliseSearch(parts.filter(Boolean).join(' '));
}

/** Case/format-insensitive substring predicate for one haystack. */
export function queryMatches(query: string, haystack: string): boolean {
  const q = normaliseSearch(query);
  if (!q) return false;
  return normaliseSearch(haystack).includes(q);
}

/**
 * Filter bin search contexts by a query. Returns the matching bin ids in
 * order (insertion order of `contexts`). Empty/whitespace query → empty set
 * (no highlight). Pure — the caller owns the model/itemsByBin wiring.
 */
export function searchBins(query: string, contexts: BinSearchContext[]): string[] {
  const q = normaliseSearch(query);
  if (!q) return [];
  const out: string[] = [];
  for (const ctx of contexts) {
    if (binSearchHaystack(ctx).includes(q)) out.push(ctx.binId);
  }
  return out;
}

// ─── Inventory grid rows ──────────────────────────────────────────────────────

export interface InventoryRow {
  binId: string;
  binName: string;
  binCode?: string | null;
  binMaxQty: number;
  rackName: string;
  zoneName: string;
  storageRole: string;
  items: ResolvedBinItem[];
  currentQty: number;
}

interface StructureLite {
  bins: Array<{ id: string; name: string; code?: string | null; rack_id: string; max_quantity?: number | null }>;
  racks: Array<{ id: string; name: string; layout_id: string }>;
  layouts: Array<{ id: string; zone_id: string }>;
  zones: Array<{ id: string; name: string; storage_role: string }>;
}

/**
 * Flatten a warehouse hierarchy into one row per bin with the rack/zone
 * context and resolved items — the data shape of the Inventory grid
 * (Excel-style bulk editor) and of the viewer's search index.
 * Racks reach their zone through their layout (rack.layout_id → layout.zone_id).
 */
export function buildInventoryRows(structure: StructureLite, itemsByBin: Map<string, ResolvedBinItem[]>): InventoryRow[] {
  const rackById = new Map(structure.racks.map(r => [r.id, r]));
  const layoutById = new Map(structure.layouts.map(l => [l.id, l]));
  const zoneById = new Map(structure.zones.map(z => [z.id, z]));
  const rows: InventoryRow[] = [];
  for (const bin of structure.bins) {
    const rack = rackById.get(bin.rack_id);
    const zone = rack ? zoneById.get(layoutById.get(rack.layout_id)?.zone_id ?? '') : undefined;
    rows.push({
      binId: bin.id,
      binName: bin.name,
      binCode: bin.code ?? null,
      binMaxQty: bin.max_quantity != null ? Number(bin.max_quantity) : 0,
      rackName: rack?.name ?? '—',
      zoneName: zone?.name ?? '—',
      storageRole: zone?.storage_role ?? '',
      items: itemsByBin.get(bin.id) ?? [],
      currentQty: binCurrentQty(itemsByBin, bin.id),
    });
  }
  return rows;
}

/**
 * Search index for the Inventory grid: each row's haystack includes the
 * bin, rack, zone and all item names/codes/batch/lot.
 */
export function inventoryRowHaystack(row: InventoryRow): string {
  return binSearchHaystack({
    binId: row.binId,
    binName: row.binName,
    binCode: row.binCode,
    rackName: row.rackName,
    zoneName: row.zoneName,
    items: row.items,
  });
}
