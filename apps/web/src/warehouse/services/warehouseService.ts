// src/warehouse/services/warehouseService.ts
// Data access for the Warehouse Management module.
// All queries are scoped by organisation_id (multi-tenant, per TAD §4.6).
// The save pipeline persists the designer draft atomically:
//   Warehouse → Floors → Zones → Layouts → naming rules → racks/tiers/bins (RPC)

import { supabase } from '../../supabase';
import type {
  WarehouseRow,
  FloorRow,
  ZoneRow,
  LayoutRow,
  NamingRuleRow,
  RackRow,
  TierRow,
  BinRow,
  BinItemRow,
  CapacityProfileRow,
  LayoutVersionRow,
  WarehouseDraft,
  FloorDraft,
  ZoneDraft,
  LayoutDraft,
  TransferRow,
  TransferStatus,
  MovementRow,
  ReplenishmentRuleRow,
  DispatchRow,
  DispatchStatus,
  PickListRow,
  PickListStatus,
  CycleCountBatchRow,
  CycleCountItemRow,
} from '../types';
import { generationInputs, rackGridPositions } from '../namingEngine';
import { resolveBinItems, type ResolvedBinItem } from '../inventory';
import { canTransition, sortTransfersByPriority } from '../operations';
import { canDispatchTransition, sortDispatchesByPriority } from '../dispatch';
import { canPickTransition } from '../picking';

// ─── Warehouses ───────────────────────────────────────────────────────────────

export async function fetchWarehouses(organisationId: string): Promise<WarehouseRow[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('organisation_id', organisationId)
    .is('deleted_at', null)
    .order('warehouse_name');
  if (error) throw error;
  return (data ?? []) as WarehouseRow[];
}

export async function fetchWarehouse(id: string): Promise<WarehouseRow | null> {
  const { data, error } = await supabase.from('warehouses').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as WarehouseRow | null;
}

export async function createWarehouse(
  organisationId: string,
  userId: string,
  fields: Partial<WarehouseRow>
): Promise<WarehouseRow> {
  const { data, error } = await supabase
    .from('warehouses')
    .insert({
      organisation_id: organisationId,
      created_by: userId,
      updated_by: userId,
      warehouse_name: fields.warehouse_name,
      name: fields.warehouse_name,
      warehouse_code: fields.warehouse_code ?? fields.warehouse_name?.slice(0, 5).toUpperCase(),
      location: fields.location ?? fields.address ?? null,
      address: fields.address ?? null,
      city: fields.city ?? null,
      state: fields.state ?? null,
      country: fields.country ?? null,
      postal_code: fields.postal_code ?? null,
      manager: fields.manager ?? null,
      description: fields.description ?? null,
      is_active: fields.is_active ?? true,
      is_default: fields.is_default ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as WarehouseRow;
}

export async function updateWarehouse(
  id: string,
  userId: string,
  fields: Partial<WarehouseRow>
): Promise<void> {
  const { error } = await supabase
    .from('warehouses')
    .update({ ...fields, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function softDeleteWarehouse(id: string): Promise<void> {
  const { error } = await supabase
    .from('warehouses')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ─── Structure readers ────────────────────────────────────────────────────────

/**
 * Fetch rows whose FK column matches any of `ids`, chunked so `in` stays
 * well under Postgres' parameter limit even for thousands of bins.
 * `select` defaults to '*' (full rows); pass a narrow column list for
 * light lookups like the archive step.
 */
async function fetchInChunks<T extends { id: string }>(
  table: string,
  column: string,
  ids: string[],
  orderBy?: { column: string; ascending?: boolean },
  select = '*'
): Promise<T[]> {
  if (ids.length === 0) return [];
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    let q = supabase.from(table as any).select(select).in(column, chunk).is('deleted_at', null);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as T[]));
  }
  // Re-sort the merged result so global order is deterministic regardless
  // of chunk boundaries. Note: numeric columns sort numerically; timestamp
  // columns (ISO strings) are NaN → 0 for both sides, so they keep chunk
  // order — acceptable since no consumer relies on global created_at order.
  if (orderBy) {
    const asc = orderBy.ascending ?? true;
    rows.sort((a, b) => {
      const av = (a as Record<string, unknown>)[orderBy.column];
      const bv = (b as Record<string, unknown>)[orderBy.column];
      const an = typeof av === 'number' ? av : Number(av);
      const bn = typeof bv === 'number' ? bv : Number(bv);
      if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
      if (Number.isNaN(an)) return 1;
      if (Number.isNaN(bn)) return -1;
      return asc ? an - bn : bn - an;
    });
  }
  return rows;
}

/**
 * Load a warehouse's full hierarchy. Every child table is scoped by its
 * parent's ids (B3) so one warehouse's view never drags in the whole
 * organisation's bins.
 */
export async function fetchStructure(warehouseId: string) {
  const [warehouseRes, floorsRes] = await Promise.all([
    supabase.from('warehouses').select('*').eq('id', warehouseId).maybeSingle(),
    supabase.from('warehouse_floors').select('*').eq('warehouse_id', warehouseId).is('deleted_at', null).order('display_order'),
  ]);
  if (warehouseRes.error) throw warehouseRes.error;
  if (floorsRes.error) throw floorsRes.error;

  const floors = (floorsRes.data ?? []) as FloorRow[];
  const floorIds = floors.map(f => f.id);

  const zones = await fetchInChunks<ZoneRow>('warehouse_zones', 'floor_id', floorIds, { column: 'created_at' });
  const zoneIds = zones.map(z => z.id);

  const layouts = await fetchInChunks<LayoutRow>('warehouse_layouts', 'zone_id', zoneIds, { column: 'created_at' });
  const layoutIds = layouts.map(l => l.id);

  const [namingRules, racks] = await Promise.all([
    fetchInChunks<NamingRuleRow>('warehouse_naming_rules', 'layout_id', layoutIds, { column: 'created_at' }),
    fetchInChunks<RackRow>('warehouse_racks', 'layout_id', layoutIds, { column: 'created_at' }),
  ]);
  const rackIds = racks.map(r => r.id);

  const tiers = await fetchInChunks<TierRow>('warehouse_tiers', 'rack_id', rackIds, { column: 'tier_number' });
  const tierIds = tiers.map(t => t.id);

  const bins = await fetchInChunks<BinRow>('warehouse_bins', 'tier_id', tierIds, { column: 'column_number' });

  return {
    warehouse: (warehouseRes.data ?? null) as WarehouseRow | null,
    floors,
    zones,
    layouts,
    racks,
    tiers,
    bins,
    namingRules,
  };
}

// ─── Bin item locations (Phase 3-ready; viewer reads these for occupancy) ────

const IN_CHUNK = 500;

/**
 * Fetch non-deleted bin-item rows for a set of bins, chunked so the
 * `in` filter stays well under Postgres' parameter limits.
 */
export async function fetchBinItems(binIds: string[]): Promise<BinItemRow[]> {
  if (binIds.length === 0) return [];
  const rows: BinItemRow[] = [];
  for (let i = 0; i < binIds.length; i += IN_CHUNK) {
    const chunk = binIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('warehouse_bin_items')
      .select('id, bin_id, item_id, item_variant_id, quantity, is_primary, is_reserve, batch_no, lot_no, created_at')
      .in('bin_id', chunk)
      .is('deleted_at', null);
    if (error) throw error;
    rows.push(...((data ?? []) as BinItemRow[]));
  }
  return rows;
}

/**
 * Same as fetchInChunks but WITHOUT the `deleted_at IS NULL` filter — for
 * archived layout history reads, where the archived rows ARE soft-deleted
 * and must still come back (G10).
 */
async function fetchInChunksIncludingDeleted<T extends { id: string }>(
  table: string,
  column: string,
  ids: string[],
  orderBy?: { column: string; ascending?: boolean },
  select = '*'
): Promise<T[]> {
  if (ids.length === 0) return [];
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    let q = supabase.from(table as any).select(select).in(column, chunk);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as T[]));
  }
  return rows;
}

/** Chunked soft-delete update (keeps `.in()` under Postgres' param limit). */
async function updateDeletedInChunks(
  table: string,
  column: string,
  ids: string[],
  patch?: Record<string, unknown>
): Promise<void> {
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { error } = await supabase
      .from(table as any)
      .update({ deleted_at: new Date().toISOString(), ...patch })
      .in(column, chunk);
    if (error) throw error;
  }
}

// ─── Designer save pipeline ───────────────────────────────────────────────────

export interface ViewerData {
  structure: Awaited<ReturnType<typeof fetchStructure>>;
  binItems: BinItemRow[];
  /** bin id → resolved items (Phase 3 — powers occupancy, search & the panel). */
  itemsByBin: Map<string, ResolvedBinItem[]>;
}

/**
 * Everything the Warehouse Viewer needs in one call: the persisted
 * hierarchy plus the bin-item locations used to compute occupancy and
 * the resolved item names for search + the property panel.
 */
export async function fetchViewerData(warehouseId: string): Promise<ViewerData> {
  const structure = await fetchStructure(warehouseId);
  const binIds = structure.bins.map(b => b.id);
  const binItems = await fetchBinItems(binIds);
  const itemIds = [...new Set(binItems.map(b => b.item_id).filter((v): v is string => !!v))];
  const items = itemIds.length > 0 ? await fetchAssignableItems(itemIds) : [];
  return { structure, binItems, itemsByBin: resolveBinItems(binItems, items) };
}

// ─── Phase 3 — inventory location management ──────────────────────────────────

/**
 * Lightweight materials catalog subset for bin assignment + name
 * resolution. When `ids` is provided only those rows are fetched (used by
 * the viewer to resolve just the items actually in bins).
 */
export async function fetchAssignableItems(ids?: string[]): Promise<Array<{ id: string; name: string | null; code: string | null; unit: string | null }>> {
  if (ids && ids.length === 0) return [];
  let q = supabase.from('materials').select('id, name, code, unit').order('name');
  if (ids && ids.length > 0) {
    const rows: Array<{ id: string; name: string | null; code: string | null; unit: string | null }> = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const chunk = ids.slice(i, i + IN_CHUNK);
      const { data, error } = await supabase.from('materials').select('id, name, code, unit').in('id', chunk);
      if (error) throw error;
      rows.push(...((data ?? []) as typeof rows));
    }
    return rows;
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string | null; code: string | null; unit: string | null }>;
}

export interface BinItemAssignment {
  binId: string;
  itemId: string;
  quantity: number;
  isPrimary?: boolean;
  isReserve?: boolean;
  batchNo?: string | null;
  lotNo?: string | null;
}

/**
 * Assign an item to a bin (TAD §5.4 — Movement Engine). One live row per
 * (bin, item): upsert of absolute quantity + flags. All stock mutations flow
 * through the SECURITY DEFINER RPC `assign_warehouse_bin_item`, which
 * enforces capacity and writes the matching `adjust` audit row — no direct
 * bin_item writes outside the Movement Engine.
 */
export async function upsertBinItem(
  organisationId: string,
  userId: string,
  assignment: BinItemAssignment
): Promise<{ ok: boolean; error?: string; delta?: number }> {
  const { data, error } = await supabase.rpc('assign_warehouse_bin_item', {
    p_organisation_id: organisationId,
    p_bin_id: assignment.binId,
    p_item_id: assignment.itemId,
    p_quantity: assignment.quantity,
    p_is_primary: assignment.isPrimary ?? false,
    p_is_reserve: assignment.isReserve ?? false,
    p_batch_no: assignment.batchNo ?? null,
    p_lot_no: assignment.lotNo ?? null,
    p_operator_id: userId,
    p_device: 'web',
    p_remarks: null,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string; delta?: number };
  return { ok: !!res.ok, error: res.error, delta: res.delta };
}

/**
 * Change a bin-item row's quantity by a signed delta (TAD §5.4 — Movement
 * Engine). When the resulting quantity is ≤ 0 the row is soft-deleted and
 * the audit records the full removal. All via the RPC `adjust_warehouse_bin_item_qty`.
 */
export async function adjustBinItemQty(
  rowId: string,
  delta: number,
  operatorId?: string | null
): Promise<{ ok: boolean; error?: string; appliedDelta?: number }> {
  const { data, error } = await supabase.rpc('adjust_warehouse_bin_item_qty', {
    p_row_id: rowId,
    p_delta: delta,
    p_operator_id: operatorId ?? null,
    p_device: 'web',
    p_remarks: null,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string; applied_delta?: number };
  return { ok: !!res.ok, error: res.error, appliedDelta: res.applied_delta };
}

/**
 * Soft-delete a bin-item row (removes the item from the bin, TAD §5.4 —
 * Movement Engine). Audits the full removal via `remove_warehouse_bin_item`.
 */
export async function deleteBinItem(
  rowId: string,
  operatorId?: string | null
): Promise<{ ok: boolean; error?: string; removedQty?: number }> {
  const { data, error } = await supabase.rpc('remove_warehouse_bin_item', {
    p_row_id: rowId,
    p_operator_id: operatorId ?? null,
    p_device: 'web',
    p_remarks: null,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string; removed_qty?: number };
  return { ok: !!res.ok, error: res.error, removedQty: res.removed_qty };
}

/** Toggle picking-location flags on a bin-item row. */
export async function setBinItemFlags(
  rowId: string,
  flags: { isPrimary?: boolean; isReserve?: boolean }
): Promise<void> {
  const { error } = await supabase
    .from('warehouse_bin_items')
    .update({ ...flags, updated_at: new Date().toISOString() })
    .eq('id', rowId);
  if (error) throw error;
}

export interface SaveDraftResult {
  warehouseId: string;
  layoutCount: number;
  rackCount: number;
  binCount: number;
  layoutIds: string[];
  /** draft zone id → persisted zone id (so the designer can remap on re-save) */
  zoneIdMap: Record<string, string>;
  /** draft layout id → persisted layout id */
  layoutIdMap: Record<string, string>;
}

/**
 * Persist a full designer draft. Returns counts so the UI can confirm
 * what was generated. Uses the server-side generator RPC for atomic
 * rack/tier/bin creation.
 */
export async function saveWarehouseDraft(
  draft: WarehouseDraft,
  organisationId: string,
  userId: string,
  existingWarehouseId?: string
): Promise<SaveDraftResult> {
  // 1. Warehouse
  let warehouseId = existingWarehouseId;
  if (warehouseId) {
    await updateWarehouse(warehouseId, userId, {
      warehouse_name: draft.name,
      name: draft.name,
      warehouse_code: draft.code,
      address: draft.address ?? null,
      city: draft.city ?? null,
      state: draft.state ?? null,
      manager: draft.manager ?? null,
      description: draft.description ?? null,
    });
  } else {
    const created = await createWarehouse(organisationId, userId, {
      warehouse_name: draft.name,
      warehouse_code: draft.code,
      address: draft.address,
      city: draft.city,
      state: draft.state,
      manager: draft.manager,
      description: draft.description,
    });
    warehouseId = created.id;
  }

  // 2. Archive the previous structure so re-saving never duplicates it AND
  // publishes a new version (TAD §4.9: duplicate → modify → validate →
  // publish → archive). archiveStructure() returns the old layouts per zone
  // so the new layout rows chain version+1 / parent_version_id.
  // Only needed when a structure already exists (fresh warehouses skip it).
  const oldLayouts = existingWarehouseId ? await archiveStructure(warehouseId, userId) : new Map<string, OldLayout>();

  let rackCount = 0;
  let binCount = 0;
  const layoutIds: string[] = [];
  const zoneIdMap: Record<string, string> = {};
  const layoutIdMap: Record<string, string> = {};

  // 3. Floors → zones → layouts → racks/tiers/bins.
  for (const floor of draft.floors) {
    const floorRow = await upsertFloor(floor, warehouseId, organisationId, userId);

    for (const zone of floor.zones) {
      const zoneRow = await upsertZone(zone, floorRow.id, organisationId, userId);
      zoneIdMap[zone.id] = zoneRow.id;
      for (const layout of zone.layouts) {
        const old = oldLayouts.get(zone.id);
        const layoutRow = await insertLayout(layout, zoneRow.id, organisationId, userId, {
          version: (old?.version ?? 0) + 1,
          parentVersionId: old?.layoutId ?? null,
        });
        layoutIdMap[layout.id] = layoutRow.id;
        layoutIds.push(layoutRow.id);

      // Naming rules
      await upsertNamingRules(layoutRow.id, organisationId, layout);

        // Racks + tiers + bins (layoutType keeps U/L shapes in sync with the preview)
        const inputs = generationInputs(layout.racks, layout.naming, layout.layoutType);
        // Persist design-grid coordinates so the Viewer reproduces the
        // designed layout (G11). Aligned with inputs order by construction.
        // Manual drag placements (rackOverrides) win over generated cells.
        const positions = rackGridPositions(layout.racks, layout.naming, layout.layoutType, layout.rackOverrides);
        const { data, error } = await supabase.rpc('generate_warehouse_bins', {
          p_layout_id: layoutRow.id,
          p_organisation_id: organisationId,
          p_rack_names: inputs.rackNames,
          p_columns: inputs.columns,
          p_levels: inputs.levels,
          p_rack_type: layout.racks.rackType,
          p_max_qty: layout.racks.maxQuantity,
          p_bin_prefix: layout.naming.prefix,
          p_separator: layout.naming.separator,
          p_padding: layout.naming.padding,
          p_level_format: layout.naming.levelFormat,
          p_pos_x: positions.map(p => p.x),
          p_pos_y: positions.map(p => p.y),
        });
        if (error) throw error;
        rackCount += inputs.count;
        binCount += Number(data ?? 0);
      }
    }
  }

  return { warehouseId, layoutCount: layoutIds.length, rackCount, binCount, layoutIds, zoneIdMap, layoutIdMap };
}

interface OldLayout {
  layoutId: string;
  version: number;
}

/**
 * Archive every structural row for a warehouse (children first so nothing
 * is left dangling). Superseded layouts are marked `status='archived'` with
 * archived_by/on audit (TAD §4.8–4.9: published layouts are immutable, never
 * hard-deleted). Returns the archived layouts keyed by zone id so the save
 * pipeline can chain version + 1 and parent_version_id on the new ones.
 */
async function archiveStructure(warehouseId: string, userId: string): Promise<Map<string, OldLayout>> {
  const now = new Date().toISOString();
  const oldLayouts = new Map<string, OldLayout>();

  // Floors are keyed by warehouse_id (not an FK list), so fetch directly.
  const floorRows = (await supabase.from('warehouse_floors').select('id').eq('warehouse_id', warehouseId).is('deleted_at', null)).data ?? [];
  const floorIdArr = floorRows.map(f => f.id);
  if (floorIdArr.length === 0) return oldLayouts;

  const zoneIds = (await fetchInChunks<{ id: string }>('warehouse_zones', 'floor_id', floorIdArr, undefined, 'id')).map(z => z.id);
  if (zoneIds.length === 0) {
    await updateDeletedInChunks('warehouse_floors', 'id', floorIdArr);
    return oldLayouts;
  }

  const layoutRows = await fetchInChunks<{ id: string; zone_id: string; version: number | null }>(
    'warehouse_layouts', 'zone_id', zoneIds, undefined, 'id, zone_id, version'
  );
  const layoutIds = layoutRows.map(l => l.id);
  if (layoutIds.length === 0) {
    await updateDeletedInChunks('warehouse_zones', 'id', zoneIds);
    await updateDeletedInChunks('warehouse_floors', 'id', floorIdArr);
    return oldLayouts;
  }

  const rackIds = (await fetchInChunks<{ id: string }>('warehouse_racks', 'layout_id', layoutIds, undefined, 'id')).map(r => r.id);
  if (rackIds.length > 0) {
    const tierIds = (await fetchInChunks<{ id: string }>('warehouse_tiers', 'rack_id', rackIds, undefined, 'id')).map(t => t.id);
    if (tierIds.length > 0) {
      await updateDeletedInChunks('warehouse_bins', 'tier_id', tierIds);
    }
    await updateDeletedInChunks('warehouse_tiers', 'rack_id', rackIds);
  }
  await updateDeletedInChunks('warehouse_racks', 'layout_id', layoutIds);
  await updateDeletedInChunks('warehouse_naming_rules', 'layout_id', layoutIds);

  // Archive (soft-delete + status + audit) the superseded layouts.
  await updateDeletedInChunks('warehouse_layouts', 'id', layoutIds, {
    status: 'archived',
    archived_by: userId,
    archived_on: now,
  });
  await updateDeletedInChunks('warehouse_zones', 'id', zoneIds);
  await updateDeletedInChunks('warehouse_floors', 'id', floorIdArr);

  // Note: with multiple layouts per zone the map keeps ONE entry per zone
  // (the last row wins) — all new layouts in that zone then chain their
  // version/parent from it. Lineage is per-zone (approximate), which is the
  // documented behaviour; each layout still gets a monotonic version bump.
  for (const l of layoutRows) {
    oldLayouts.set(l.zone_id, { layoutId: l.id, version: l.version ?? 1 });
  }
  return oldLayouts;
}

async function upsertFloor(
  floor: FloorDraft,
  warehouseId: string,
  organisationId: string,
  userId: string
): Promise<FloorRow> {
  const { data, error } = await supabase
    .from('warehouse_floors')
    .insert({
      organisation_id: organisationId,
      warehouse_id: warehouseId,
      name: floor.name,
      code: floor.code || null,
      description: floor.description || null,
      display_order: floor.displayOrder,
      created_by: userId,
      updated_by: userId,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as FloorRow;
}

async function upsertZone(
  zone: ZoneDraft,
  floorId: string,
  organisationId: string,
  userId: string
): Promise<ZoneRow> {
  const { data, error } = await supabase
    .from('warehouse_zones')
    .insert({
      organisation_id: organisationId,
      floor_id: floorId,
      name: zone.name,
      code: zone.code || null,
      storage_role: zone.storageRole,
      color: zone.color,
      description: zone.description || null,
      created_by: userId,
      updated_by: userId,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ZoneRow;
}

async function insertLayout(
  layout: LayoutDraft,
  zoneId: string,
  organisationId: string,
  userId: string,
  versioning: { version: number; parentVersionId: string | null }
): Promise<LayoutRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('warehouse_layouts')
    .insert({
      organisation_id: organisationId,
      zone_id: zoneId,
      name: layout.name,
      layout_type: layout.layoutType,
      orientation: layout.orientation,
      description: layout.description || null,
      spacing_m: layout.racks.spacingM,
      scale: layout.config.scale,
      rotation_deg: layout.config.rotationDeg,
      aisle_width_m: layout.config.aisleWidthM,
      walkway_width_m: layout.config.walkwayWidthM,
      default_rack_direction: layout.config.rackDirection,
      created_by: userId,
      updated_by: userId,
      status: 'published',
      version: versioning.version,
      parent_version_id: versioning.parentVersionId,
      published_by: userId,
      published_on: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as LayoutRow;
}

async function upsertNamingRules(
  layoutId: string,
  organisationId: string,
  layout: LayoutDraft
): Promise<void> {
  const rackRule = {
    organisation_id: organisationId,
    layout_id: layoutId,
    entity_type: 'rack' as const,
    prefix: layout.naming.prefix,
    separator: layout.naming.separator,
    numbering_style: layout.naming.numberingStyle,
    padding: layout.naming.padding,
    level_format: layout.naming.levelFormat,
    suffix: layout.naming.suffix,
  };
  const binRule = { ...rackRule, entity_type: 'bin' as const };

  const { error } = await supabase.from('warehouse_naming_rules').insert([rackRule, binRule]);
  if (error) throw error;
}

// ─── Capacity profiles (G9 — config, PRD §5.17 / TAD §4.4) ───────────────────

export async function fetchCapacityProfiles(organisationId: string): Promise<CapacityProfileRow[]> {
  const { data, error } = await supabase
    .from('warehouse_capacity_profiles')
    .select('*')
    .eq('organisation_id', organisationId)
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []) as CapacityProfileRow[];
}

export async function createCapacityProfile(
  organisationId: string,
  userId: string,
  fields: Partial<CapacityProfileRow>
): Promise<CapacityProfileRow> {
  const { data, error } = await supabase
    .from('warehouse_capacity_profiles')
    .insert({
      organisation_id: organisationId,
      name: fields.name,
      description: fields.description ?? null,
      max_quantity: fields.max_quantity ?? null,
      max_weight_kg: fields.max_weight_kg ?? null,
      max_volume_m3: fields.max_volume_m3 ?? null,
      max_pallets: fields.max_pallets ?? null,
      is_active: fields.is_active ?? true,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CapacityProfileRow;
}

export async function updateCapacityProfile(
  id: string,
  userId: string,
  fields: Partial<CapacityProfileRow>
): Promise<void> {
  const { error } = await supabase
    .from('warehouse_capacity_profiles')
    .update({ ...fields, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function softDeleteCapacityProfile(id: string): Promise<void> {
  const { error } = await supabase
    .from('warehouse_capacity_profiles')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ─── Layout version history (G10, TAD §4.9) ───────────────────────────────────

/**
 * Archived layout versions for a warehouse, newest first, with enough
 * context (zone, floor, naming rule, first rack, its bins) to restore a
 * version into the designer. Archived layouts are immutable (never hard-
 * deleted), so history is lossless.
 */
export async function fetchLayoutHistory(warehouseId: string): Promise<LayoutVersionRow[]> {
  const floorsRes = await supabase
    .from('warehouse_floors')
    .select('*')
    .eq('warehouse_id', warehouseId)
    .is('deleted_at', null)
    .order('display_order');
  if (floorsRes.error) throw floorsRes.error;
  const floors = (floorsRes.data ?? []) as FloorRow[];
  const floorIds = floors.map(f => f.id);
  if (floorIds.length === 0) return [];

  const zones = await fetchInChunks<ZoneRow>('warehouse_zones', 'floor_id', floorIds, { column: 'created_at' });
  const zoneIds = zones.map(z => z.id);
  if (zoneIds.length === 0) return [];

  // All layouts including archived ones. Archived layouts are soft-deleted
  // (archiveStructure sets deleted_at), so NO deleted_at filter here — the
  // status='archived' filter selects them.
  const allLayouts = await fetchInChunksIncludingDeleted<LayoutRow>(
    'warehouse_layouts', 'zone_id', zoneIds, { column: 'created_at' }
  );
  const archived = allLayouts
    .filter(l => l.status === 'archived')
    .sort((a, b) => new Date(b.archived_on ?? b.created_at ?? 0).getTime() - new Date(a.archived_on ?? a.created_at ?? 0).getTime());
  if (archived.length === 0) return [];

  const archivedIds = archived.map(l => l.id);
  const [racks, namingRules] = await Promise.all([
    fetchInChunksIncludingDeleted<RackRow>('warehouse_racks', 'layout_id', archivedIds, { column: 'created_at' }),
    fetchInChunksIncludingDeleted<NamingRuleRow>('warehouse_naming_rules', 'layout_id', archivedIds, { column: 'created_at' }),
  ]);

  const zoneById = new Map(zones.map(z => [z.id, z]));
  const floorById = new Map(floors.map(f => [f.id, f]));
  const rackByLayout = new Map<string, RackRow[]>();
  for (const r of racks) {
    const list = rackByLayout.get(r.layout_id) ?? [];
    list.push(r);
    rackByLayout.set(r.layout_id, list);
  }

  const versionRows: LayoutVersionRow[] = [];
  for (const layout of archived) {
    const zone = zoneById.get(layout.zone_id);
    if (!zone) continue;
    const floor = floorById.get(zone.floor_id);
    if (!floor) continue;
    const rackList = rackByLayout.get(layout.id) ?? [];
    const firstRack = rackList[0] ?? null;
    const firstTierId = firstRack
      ? (await fetchInChunksIncludingDeleted<{ id: string }>('warehouse_tiers', 'rack_id', [firstRack.id], undefined, 'id')).map(t => t.id)[0]
      : undefined;
    const bins = firstTierId
      ? await fetchInChunksIncludingDeleted<BinRow>('warehouse_bins', 'tier_id', [firstTierId], { column: 'column_number' })
      : [];
    versionRows.push({
      layout,
      zone,
      floor,
      rack: firstRack,
      rackCount: rackList.length,
      bins,
      namingRule: namingRules.find(n => n.layout_id === layout.id && n.entity_type === 'bin') ?? null,
    });
  }
  return versionRows;
}

// ─── Phase 4 — Warehouse Operations (transfers / movements / replenishment) ──

/** Transfer enriched with bin/item names for display. */
export interface TransferView extends TransferRow {
  sourceBinName?: string | null;
  destinationBinName?: string | null;
  itemName?: string | null;
}

/**
 * All transfers for an organisation, enriched with bin/item names and
 * sorted by priority (critical first) then age. Open transfers surface
 * before completed/cancelled ones.
 */
export async function fetchTransfers(organisationId: string): Promise<TransferView[]> {
  const { data, error } = await supabase
    .from('warehouse_transfers')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const transfers = (data ?? []) as TransferRow[];
  if (transfers.length === 0) return [];

  const binIds = [...new Set(transfers.flatMap(t => [t.source_bin_id, t.destination_bin_id]))];
  const itemIds = [...new Set(transfers.map(t => t.item_id).filter((v): v is string => !!v))];
  const [bins, items] = await Promise.all([
    fetchInChunks<{ id: string; name: string }>('warehouse_bins', 'id', binIds, undefined, 'id, name'),
    itemIds.length > 0 ? fetchAssignableItems(itemIds) : Promise.resolve([]),
  ]);
  const binName = new Map(bins.map(b => [b.id, b.name]));
  const itemName = new Map(items.map(i => [i.id, i.name]));

  const views: TransferView[] = transfers.map(t => ({
    ...t,
    sourceBinName: binName.get(t.source_bin_id) ?? null,
    destinationBinName: binName.get(t.destination_bin_id) ?? null,
    itemName: t.item_id ? itemName.get(t.item_id) ?? null : null,
  }));

  return sortTransfersByPriority(views);
}

export interface CreateTransferInput {
  itemId: string;
  quantity: number;
  sourceBinId: string;
  destinationBinId: string;
  priority: TransferRow['priority'];
  remarks?: string | null;
}

/** Create a transfer (status 'requested'). Number is generated server-side. */
export async function createTransfer(
  organisationId: string,
  userId: string,
  input: CreateTransferInput
): Promise<TransferRow> {
  const { data: noData, error: noError } = await supabase.rpc('next_warehouse_transfer_no', {
    p_organisation_id: organisationId,
  });
  if (noError) throw noError;
  const transferNo = (noData as string) || `TRF-${Date.now()}`;

  const { data, error } = await supabase
    .from('warehouse_transfers')
    .insert({
      organisation_id: organisationId,
      transfer_no: transferNo,
      item_id: input.itemId,
      quantity: input.quantity,
      source_bin_id: input.sourceBinId,
      destination_bin_id: input.destinationBinId,
      priority: input.priority,
      remarks: input.remarks ?? null,
      status: 'requested',
      requested_by: userId,
      requested_at: new Date().toISOString(),
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TransferRow;
}

/**
 * Advance a transfer's status (validate against the state machine first).
 * Records the operator + timestamp for the target step. Returns the error
 * message when the transition is illegal.
 */
export async function advanceTransferStatus(
  transferId: string,
  to: TransferStatus,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('warehouse_transfers')
    .select('status')
    .eq('id', transferId)
    .maybeSingle();
  if (error) throw error;
  const current = (data?.status ?? 'draft') as TransferStatus;
  if (!canTransition(current, to)) {
    return { ok: false, error: `Cannot move a ${current} transfer to ${to}` };
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: to, updated_at: now };
  if (to === 'approved') { patch.approved_by = userId; patch.approved_at = now; }
  if (to === 'picking') { patch.picked_by = userId; patch.picked_at = now; }
  if (to === 'in_transit') { patch.moved_by = userId; patch.in_transit_at = now; }
  if (to === 'received') { patch.received_by = userId; patch.received_at = now; }
  if (to === 'completed') { patch.completed_by = userId; patch.completed_at = now; }
  if (to === 'cancelled' || to === 'rejected') { patch.cancelled_by = userId; patch.cancelled_at = now; }

  const { error: err } = await supabase.from('warehouse_transfers').update(patch).eq('id', transferId);
  if (err) throw err;
  return { ok: true };
}

/** Execute a transfer via the atomic RPC (validates stock + capacity, moves qty, writes audit). */
export async function executeTransfer(
  transferId: string,
  operatorId: string,
  device?: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('execute_warehouse_transfer', {
    p_transfer_id: transferId,
    p_operator_id: operatorId,
    p_device: device ?? null,
    p_remarks: null,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  return { ok: !!res.ok, error: res.error };
}

/** Movement audit trail for an org, optionally filtered by bin / item / type. */
export async function fetchMovements(
  organisationId: string,
  filter?: { binId?: string; itemId?: string; limit?: number }
): Promise<MovementRow[]> {
  let q = supabase
    .from('warehouse_movements')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .limit(filter?.limit ?? 200);
  if (filter?.binId) q = q.or(`source_bin_id.eq.${filter.binId},destination_bin_id.eq.${filter.binId}`);
  if (filter?.itemId) q = q.eq('item_id', filter.itemId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MovementRow[];
}

/** Replenishment rules for an org, enriched with bin + item names. */
export async function fetchReplenishmentRules(organisationId: string): Promise<ReplenishmentRuleRow[]> {
  const { data, error } = await supabase
    .from('warehouse_replenishment_rules')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReplenishmentRuleRow[];
}

export async function upsertReplenishmentRule(
  organisationId: string,
  userId: string,
  rule: {
    binId: string;
    itemId: string;
    minQty: number;
    maxQty: number;
  }
): Promise<ReplenishmentRuleRow> {
  const existing = await supabase
    .from('warehouse_replenishment_rules')
    .select('id')
    .eq('organisation_id', organisationId)
    .eq('bin_id', rule.binId)
    .eq('item_id', rule.itemId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const payload = {
    bin_id: rule.binId,
    item_id: rule.itemId,
    min_qty: rule.minQty,
    max_qty: rule.maxQty,
    enabled: true,
    updated_by: userId,
  };
  const { data, error } = existing.data
    ? await supabase.from('warehouse_replenishment_rules').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', existing.data.id).select().single()
    : await supabase.from('warehouse_replenishment_rules').insert({ ...payload, organisation_id: organisationId, created_by: userId }).select().single();
  if (error) throw error;
  return data as ReplenishmentRuleRow;
}

export async function setReplenishmentRuleEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('warehouse_replenishment_rules')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteReplenishmentRule(id: string): Promise<void> {
  const { error } = await supabase.from('warehouse_replenishment_rules').delete().eq('id', id);
  if (error) throw error;
}

/** Execute a replenishment via the atomic RPC (Bulk → Picking, PRD §9.14). */
export async function executeReplenishment(args: {
  organisationId: string;
  sourceBinId: string;
  destinationBinId: string;
  itemId: string;
  quantity: number;
  operatorId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('replenish_bin', {
    p_organisation_id: args.organisationId,
    p_source_bin_id: args.sourceBinId,
    p_destination_bin_id: args.destinationBinId,
    p_item_id: args.itemId,
    p_quantity: args.quantity,
    p_operator_id: args.operatorId,
    p_device: 'web',
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  return { ok: !!res.ok, error: res.error };
}

/** Receive stock into a bin via the atomic RPC (put-away execution). */
export async function receiveStock(args: {
  organisationId: string;
  binId: string;
  itemId: string;
  quantity: number;
  operatorId: string;
  remarks?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('receive_warehouse_stock', {
    p_organisation_id: args.organisationId,
    p_bin_id: args.binId,
    p_item_id: args.itemId,
    p_quantity: args.quantity,
    p_operator_id: args.operatorId,
    p_device: 'web',
    p_remarks: args.remarks ?? null,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  return { ok: !!res.ok, error: res.error };
}

/**
 * Bins usable as put-away / overflow candidates: storage role from the
 * zone chain (bin → tier → rack → layout → zone), current qty + free
 * capacity computed from live bin_items. All non-deleted bins in the org.
 */
export async function fetchBinCandidates(organisationId: string) {
  const [structure, binItems] = await Promise.all([
    fetchOrgStructure(organisationId),
    fetchAllBinItems(organisationId),
  ]);

  const zoneById = new Map(structure.zones.map(z => [z.id, z]));
  const warehouseByFloor = new Map(structure.floors.map(f => [f.id, f.warehouse_id]));

  const qtyByBin = new Map<string, number>();
  for (const bi of binItems) {
    qtyByBin.set(bi.bin_id, (qtyByBin.get(bi.bin_id) ?? 0) + (bi.quantity ?? 0));
  }

  return structure.bins.map(bin => {
    const tier = structure.tiers.find(t => t.id === bin.tier_id);
    const rack = tier ? structure.racks.find(r => r.id === tier.rack_id) : undefined;
    const layout = rack ? structure.layouts.find(l => l.id === rack.layout_id) : undefined;
    const zone = layout ? zoneById.get(layout.zone_id) : undefined;
    const currentQty = qtyByBin.get(bin.id) ?? 0;
    const maxQty = bin.max_quantity ?? 0;
    const status = bin.status ?? 'available';
    return {
      id: bin.id,
      name: bin.name,
      warehouseId: zone ? warehouseByFloor.get(zone.floor_id) ?? null : null,
      storageRole: zone?.storage_role ?? null,
      maxQuantity: maxQty > 0 ? maxQty : null,
      maxWeightKg: bin.max_weight_kg ?? null,
      currentQty,
      freeCapacity: maxQty > 0 ? Math.max(0, maxQty - currentQty) : Infinity,
      blocked: status === 'blocked' || status === 'maintenance' || status === 'inactive',
      reserved: status === 'reserved',
      qualityHold: status === 'quality_hold',
      zoneName: zone?.name ?? null,
    };
  });
}

export type BinCandidate = Awaited<ReturnType<typeof fetchBinCandidates>>[number];

/** All non-deleted bin-item rows for an org (unscoped to a warehouse). */
async function fetchAllBinItems(organisationId: string): Promise<BinItemRow[]> {
  const { data, error } = await supabase
    .from('warehouse_bin_items')
    .select('bin_id, quantity')
    .eq('organisation_id', organisationId)
    .is('deleted_at', null);
  if (error) throw error;
  return (data ?? []) as BinItemRow[];
}

/**
 * All non-deleted bin-item rows for an org (bin_id, item_id, quantity).
 * Consumers (replenishment rules, consolidation) only need the stock facts —
 * warehouse scoping happens upstream in fetchBinCandidates when a warehouse
 * context is required.
 */
export async function fetchOrgBinItems(organisationId: string) {
  const { data, error } = await supabase
    .from('warehouse_bin_items')
    .select('bin_id, item_id, quantity, is_primary, is_reserve')
    .eq('organisation_id', organisationId)
    .is('deleted_at', null);
  if (error) throw error;
  return (data ?? []).map(bi => ({
    bin_id: bi.bin_id,
    item_id: bi.item_id ?? null,
    quantity: bi.quantity ?? 0,
    is_primary: !!bi.is_primary,
    is_reserve: !!bi.is_reserve,
  }));
}

// ─── Phase 4 — Dispatch workflow (PRD §4.13 / TAD §3.13) ─────────────────────

/** Dispatch enriched with bin + item names for display. */
export interface DispatchView extends DispatchRow {
  sourceBinName?: string | null;
  itemName?: string | null;
}

/** All dispatches for an org, enriched + priority-sorted. */
export async function fetchDispatches(organisationId: string): Promise<DispatchView[]> {
  const { data, error } = await supabase
    .from('warehouse_dispatches')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const dispatches = (data ?? []) as DispatchRow[];
  if (dispatches.length === 0) return [];

  const binIds = [...new Set(dispatches.map(d => d.source_bin_id))];
  const itemIds = [...new Set(dispatches.map(d => d.item_id).filter((v): v is string => !!v))];
  const [bins, items] = await Promise.all([
    fetchInChunks<{ id: string; name: string }>('warehouse_bins', 'id', binIds, undefined, 'id, name'),
    itemIds.length > 0 ? fetchAssignableItems(itemIds) : Promise.resolve([]),
  ]);
  const binName = new Map(bins.map(b => [b.id, b.name]));
  const itemName = new Map(items.map(i => [i.id, i.name]));

  const views: DispatchView[] = dispatches.map(d => ({
    ...d,
    sourceBinName: binName.get(d.source_bin_id) ?? null,
    itemName: d.item_id ? itemName.get(d.item_id) ?? null : null,
  }));
  return sortDispatchesByPriority(views);
}

export interface CreateDispatchInput {
  salesOrderRef?: string | null;
  itemId: string;
  quantity: number;
  sourceBinId: string;
  priority: DispatchRow['priority'];
  remarks?: string | null;
}

/** Create a dispatch record (status 'draft' — pending sales order). */
export async function createDispatch(
  organisationId: string,
  userId: string,
  input: CreateDispatchInput
): Promise<DispatchRow> {
  const { data: noData, error: noError } = await supabase.rpc('next_warehouse_dispatch_no', {
    p_organisation_id: organisationId,
  });
  if (noError) throw noError;
  const dispatchNo = (noData as string) || `DSP-${Date.now()}`;

  const { data, error } = await supabase
    .from('warehouse_dispatches')
    .insert({
      organisation_id: organisationId,
      dispatch_no: dispatchNo,
      sales_order_ref: input.salesOrderRef ?? null,
      item_id: input.itemId,
      quantity: input.quantity,
      source_bin_id: input.sourceBinId,
      priority: input.priority,
      remarks: input.remarks ?? null,
      status: 'draft',
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DispatchRow;
}

/** Advance a dispatch's status (state-machine guarded) with step timestamps. */
export async function advanceDispatchStatus(
  dispatchId: string,
  to: DispatchStatus,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('warehouse_dispatches')
    .select('status')
    .eq('id', dispatchId)
    .maybeSingle();
  if (error) throw error;
  const current = (data?.status ?? 'draft') as DispatchStatus;
  if (!canDispatchTransition(current, to)) {
    return { ok: false, error: `Cannot move a ${current} dispatch to ${to}` };
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: to, updated_at: now };
  if (to === 'picking') patch.picked_at = now;
  if (to === 'packing') patch.packed_at = now;
  if (to === 'ready') patch.ready_at = now;
  if (to === 'loaded') patch.loaded_at = now;
  if (to === 'cancelled') patch.cancelled_at = now;

  const { error: err } = await supabase.from('warehouse_dispatches').update(patch).eq('id', dispatchId);
  if (err) throw err;
  return { ok: true };
}

/** Reserve stock for a dispatch via the atomic RPC (TAD §5.11). */
export async function reserveDispatch(
  dispatchId: string,
  operatorId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('reserve_for_dispatch', {
    p_dispatch_id: dispatchId,
    p_operator_id: operatorId,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  return { ok: !!res.ok, error: res.error };
}

/** Cancel a dispatch and release its reservation (RPC). */
export async function releaseDispatchReserve(
  dispatchId: string,
  operatorId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('release_dispatch_reserve', {
    p_dispatch_id: dispatchId,
    p_operator_id: operatorId,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  return { ok: !!res.ok, error: res.error };
}

/** Execute dispatch — shipment confirmation + movement posting (RPC). */
export async function executeDispatch(args: {
  dispatchId: string;
  operatorId: string;
  vehicleNo?: string | null;
  driverName?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('execute_warehouse_dispatch', {
    p_dispatch_id: args.dispatchId,
    p_vehicle_no: args.vehicleNo ?? null,
    p_driver_name: args.driverName ?? null,
    p_operator_id: args.operatorId,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  return { ok: !!res.ok, error: res.error };
}

/**
 * Reverse a completed movement (TAD §5.12). The RPC reverses the whole
 * reference group (a transfer pair reverses as one), restores stock,
 * releases active reservations, and writes reversal audit rows.
 */
export async function reverseMovement(
  movementId: string,
  operatorId: string
): Promise<{ ok: boolean; error?: string; reversed?: number }> {
  const { data, error } = await supabase.rpc('reverse_warehouse_movement', {
    p_movement_id: movementId,
    p_operator_id: operatorId,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string; reversed?: number };
  return { ok: !!res.ok, error: res.error, reversed: res.reversed };
}

// ─── Phase 5 — Dashboard Engine data (TAD §2.15) ────────────────────────────

/**
 * One aggregated fetch feeding the Dashboard Engine (TAD §2.15: the
 * dashboard never queries every module independently). Returns raw rows;
 * the pure engine in dashboard.ts computes the ViewModel.
 */
export async function fetchDashboardData(organisationId: string) {
  const [warehouses, binItems, movements, transfers, dispatches, pickLists, rulesRes, binCandidates, cycleCounts] = await Promise.all([
    fetchWarehouses(organisationId),
    fetchOrgBinItems(organisationId),
    fetchMovements(organisationId, { limit: 300 }),
    fetchTransfers(organisationId),
    fetchDispatches(organisationId),
    fetchPickLists(organisationId),
    fetchReplenishmentRules(organisationId),
    fetchBinCandidates(organisationId),
    fetchCycleCounts(organisationId),
  ]);

  // Item names for activity + insights (resolved once, keyed by id).
  const itemIds = [...new Set([
    ...movements.map(m => m.item_id).filter((v): v is string => !!v),
    ...binItems.map(b => b.item_id).filter((v): v is string => !!v),
    ...rulesRes.map(r => r.item_id).filter((v): v is string => !!v),
  ])];
  const items = itemIds.length > 0 ? await fetchAssignableItems(itemIds) : [];
  const itemNames = new Map(items.map(i => [i.id, i.name ?? i.id]));

  // Live quantity per (bin,item) for the replenishment rules + slow movers.
  const qtyByBin = new Map<string, number>();
  for (const bi of binItems) {
    if (!bi.item_id) continue;
    qtyByBin.set(bi.bin_id, (qtyByBin.get(bi.bin_id) ?? 0) + Number(bi.quantity) || 0);
  }

  return {
    warehouses: warehouses.map(w => ({ id: w.id, name: w.warehouse_name ?? w.name })),
    bins: binCandidates.map(c => ({
      id: c.id,
      name: c.name,
      warehouseId: c.warehouseId ?? null,
      zoneName: c.zoneName ?? null,
      storageRole: c.storageRole ?? null,
      maxQuantity: c.maxQuantity,
      currentQty: c.currentQty,
      freeCapacity: c.freeCapacity,
      blocked: c.blocked,
      reserved: c.reserved,
      qualityHold: c.qualityHold,
    })),
    binItems: binItems.map(b => ({
      bin_id: b.bin_id,
      item_id: b.item_id,
      quantity: b.quantity,
      is_primary: b.is_primary,
      is_reserve: b.is_reserve,
    })),
    movements: movements.map(m => ({
      id: m.id,
      movement_type: m.movement_type,
      reference_type: m.reference_type,
      reference_id: m.reference_id,
      item_id: m.item_id ?? null,
      source_bin_id: m.source_bin_id ?? null,
      destination_bin_id: m.destination_bin_id ?? null,
      quantity: m.quantity,
      remarks: m.remarks,
      created_at: m.created_at,
    })),
    transfers,
    dispatches,
    pickLists,
    replenishmentRules: rulesRes.map(r => {
      const bin = binCandidates.find(c => c.id === r.bin_id);
      return {
        ruleId: r.id,
        binId: r.bin_id,
        binName: bin?.name ?? r.bin_id,
        itemId: r.item_id ?? null,
        itemName: r.item_id ? itemNames.get(r.item_id) ?? null : undefined,
        minQty: Number(r.min_qty) || 0,
        maxQty: Number(r.max_qty) || 0,
        currentQty: qtyByBin.get(r.bin_id) ?? 0,
        enabled: !!r.enabled,
      };
    }),
    // Phase 7 — cycle counts: queue + due alerts (PRD §4.21 / §4.16).
    cycleCounts: cycleCounts.map(c => ({
      id: c.id,
      label: `${c.batch_no} · ${c.scopeLabel ?? c.name}`,
      status: c.status,
      itemCount: c.items.length,
      countedCount: c.items.filter(i => i.counted_qty != null).length,
      varianceCount: c.items.filter(i => i.counted_qty != null && Number(i.counted_qty) !== Number(i.expected_qty)).length,
      scheduledFor: c.planned_for ?? null,
    })),
    itemNames,
  };
}

// ─── Phase 7 — Cycle Count (PRD §4.21 / Phase 7) ─────────────────────────────

/** Cycle batch enriched with item/bin names + scope label for display. */
export interface CycleCountBatchView extends CycleCountBatchRow {
  scopeLabel?: string | null;
  items: Array<CycleCountItemRow & {
    binName?: string | null;
    itemName?: string | null;
  }>;
}

/** Create a cycle-count batch via the RPC (snapshots scope stock). */
export async function createCycleCountBatch(args: {
  organisationId: string;
  name: string;
  abcClass: 'A' | 'B' | 'C';
  scopeType: 'warehouse' | 'zone' | 'bin';
  scopeId: string;
  plannedFor?: string | null;
  operatorId: string;
  notes?: string | null;
}): Promise<{ ok: boolean; error?: string; batchId?: string; batchNo?: string; itemCount?: number }> {
  const { data, error } = await supabase.rpc('create_cycle_count_batch', {
    p_organisation_id: args.organisationId,
    p_name: args.name,
    p_abc_class: args.abcClass,
    p_scope_type: args.scopeType,
    p_scope_id: args.scopeId,
    p_planned_for: args.plannedFor ?? null,
    p_operator_id: args.operatorId,
    p_notes: args.notes ?? null,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string; batch_id?: string; batch_no?: string; item_count?: number };
  return { ok: !!res.ok, error: res.error, batchId: res.batch_id, batchNo: res.batch_no, itemCount: res.item_count };
}

/** Freeze the batch scope (bins → cycle_count status). */
export async function freezeCycleScope(
  batchId: string,
  operatorId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('freeze_cycle_scope', { p_batch_id: batchId, p_operator_id: operatorId });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  return { ok: !!res.ok, error: res.error };
}

/** Release the freeze after count/approve. */
export async function unfreezeCycleScope(batchId: string, operatorId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('unfreeze_cycle_scope', { p_batch_id: batchId, p_operator_id: operatorId });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  return { ok: !!res.ok, error: res.error };
}

/** Submit a blind count for one line. `lineId` is the cycle-count ITEM row id
 *  (warehouse_cycle_count_items.id), not the stock item id — the RPC resolves
 *  expected qty + variance from that line. */
export async function submitCycleCountItem(args: {
  lineId: string;
  countedQty: number;
  operatorId: string;
  note?: string | null;
}): Promise<{ ok: boolean; error?: string; variance?: number; status?: string }> {
  const { data, error } = await supabase.rpc('submit_cycle_count_item', {
    p_item_id: args.lineId,
    p_counted_qty: args.countedQty,
    p_operator_id: args.operatorId,
    p_investigation_note: args.note ?? null,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string; variance?: number; status?: string };
  return { ok: !!res.ok, error: res.error, variance: res.variance, status: res.status };
}

/** Approve a batch — adjustments execute through the Movement Engine. */
export async function approveCycleCountBatch(
  batchId: string,
  operatorId: string
): Promise<{ ok: boolean; error?: string; adjusted?: number; matched?: number }> {
  const { data, error } = await supabase.rpc('approve_cycle_count_batch', {
    p_batch_id: batchId,
    p_operator_id: operatorId,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string; adjusted?: number; matched?: number };
  return { ok: !!res.ok, error: res.error, adjusted: res.adjusted, matched: res.matched };
}

/** Cancel a batch (releases freeze, no adjustments). */
export async function cancelCycleCountBatch(
  batchId: string,
  operatorId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('cancel_cycle_count_batch', { p_batch_id: batchId, p_operator_id: operatorId });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  return { ok: !!res.ok, error: res.error };
}

/** All cycle batches for an org, enriched with line items + names. */
export async function fetchCycleCounts(organisationId: string): Promise<CycleCountBatchView[]> {
  const [batchesRes, itemsRes, structure, warehouses] = await Promise.all([
    supabase.from('warehouse_cycle_count_batches').select('*').eq('organisation_id', organisationId).order('created_at', { ascending: false }),
    supabase.from('warehouse_cycle_count_items').select('*').eq('organisation_id', organisationId).order('created_at'),
    fetchOrgStructure(organisationId),
    fetchWarehouses(organisationId),
  ]);
  if (batchesRes.error) throw batchesRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const binById = new Map(structure.bins.map(b => [b.id, b.name]));
  const items = itemsRes.data ?? [];
  const itemIds = [...new Set(items.map(i => i.item_id).filter((v): v is string => !!v))];
  const assignable = itemIds.length > 0 ? await fetchAssignableItems(itemIds) : [];
  const itemNameById = new Map(assignable.map(i => [i.id, i.name]));
  const itemsByBatch = new Map<string, CycleCountBatchView['items']>();
  for (const it of items) {
    const batchId = (it as CycleCountItemRow).batch_id;
    const list = itemsByBatch.get(batchId) ?? [];
    list.push({
      ...(it as CycleCountItemRow),
      binName: binById.get((it as CycleCountItemRow).bin_id) ?? null,
      itemName: (it as CycleCountItemRow).item_id ? itemNameById.get((it as CycleCountItemRow).item_id as string) ?? null : null,
    });
    itemsByBatch.set(batchId, list);
  }

  const zonesById = new Map(structure.zones.map(z => [z.id, z.name]));
  const warehouseNameById = new Map(warehouses.map(w => [w.id, w.warehouse_name ?? w.name]));

  return (batchesRes.data ?? []).map(b => {
    const row = b as CycleCountBatchRow;
    let scopeLabel: string | null = null;
    if (row.scope_type === 'zone' && row.scope_id) scopeLabel = zonesById.get(row.scope_id) ?? null;
    else if (row.scope_type === 'bin') scopeLabel = binById.get(row.scope_id ?? '') ?? null;
    else if (row.scope_type === 'warehouse' && row.scope_id) scopeLabel = warehouseNameById.get(row.scope_id) ?? `Warehouse ${row.scope_id.slice(0, 8)}…`;
    return {
      ...row,
      scopeLabel,
      items: itemsByBatch.get(row.id) ?? [],
    };
  });
}

/** Cycle batches that are due (scheduled/overdue) — drives dashboard alerts. */
export async function fetchCycleCountsDue(organisationId: string): Promise<Array<{ id: string; label: string }>> {
  const rows = await fetchCycleCounts(organisationId);
  return rows
    .filter(b => b.status === 'scheduled' || b.status === 'in_progress')
    .map(b => ({ id: b.id, label: `${b.batch_no} · ${b.scopeLabel ?? b.name}` }));
}

// ─── PO / Receiving integration (PRD §4.12) ──────────────────────────────────

/** One line of an open purchase order, mapped to the warehouse item master
 *  via `material_id` (both reference the `materials` table). */
export interface OpenPurchaseOrderLine {
  id: string;
  materialId: string | null;
  itemName: string | null;
  quantity: number | null;
  unit: string | null;
}

export interface OpenPurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string | null;
  poDate: string | null;
  status: string | null;
  items: OpenPurchaseOrderLine[];
}

/** Purchase orders that can still receive stock (PRD §4.12). Status casing
 *  varies across the app ('Approved' vs 'APPROVED') so filtering is done
 *  client-side over the 30 most recent POs — robust to both spellings. */
export async function fetchOpenPurchaseOrders(organisationId: string): Promise<OpenPurchaseOrder[]> {
  const OPEN = new Set(['Approved', 'APPROVED', 'Sent', 'Acknowledged', 'Partially Received', 'PARTIALLY RECEIVED']);
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      po_date,
      status,
      approval_status,
      vendor:purchase_vendors(company_name),
      items:purchase_order_items(id, material_id, item_name, quantity, unit)
    `)
    .eq('organisation_id', organisationId)
    .order('po_date', { ascending: false })
    .limit(30);
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter(po => {
      const status = String(po.status ?? po.approval_status ?? '');
      return OPEN.has(status);
    })
    .map(po => {
      const vendor = (po.vendor ?? null) as { company_name?: string | null } | null;
      return {
        id: String(po.id),
        poNumber: String(po.po_number ?? po.id),
        vendorName: vendor?.company_name ?? null,
        poDate: (po.po_date as string | null) ?? null,
        status: String(po.status ?? po.approval_status ?? ''),
        items: ((po.items ?? []) as Array<Record<string, unknown>>).map(it => ({
          id: String(it.id),
          materialId: (it.material_id as string | null) ?? null,
          itemName: (it.item_name as string | null) ?? null,
          quantity: it.quantity != null ? Number(it.quantity) : null,
          unit: (it.unit as string | null) ?? null,
        })),
      };
    });
}

// ─── Phase 4 — Picking Module (TAD §3.12) ────────────────────────────────────

/** Pick list enriched with item + bin names for display. */
export interface PickListView extends PickListRow {
  itemName?: string | null;
  sourceBinName?: string | null;
  quantityRequested?: number | null;
  quantityPicked?: number | null;
  items: Array<{
    id: string;
    itemId: string | null;
    itemName?: string | null;
    sourceBinId: string;
    sourceBinName?: string | null;
    quantityRequested: number;
    quantityPicked: number;
    status: 'pending' | 'picked';
    pickedAt?: string | null;
  }>;
}

export interface CreatePickListInput {
  sourceRef?: string | null;
  priority: PickListRow['priority'];
  assignedTo?: string | null;
  items: Array<{
    itemId: string;
    sourceBinId: string;
    quantityRequested: number;
  }>;
}

/** Create a pick list (status 'queued') with its lines. */
export async function createPickList(
  organisationId: string,
  userId: string,
  input: CreatePickListInput
): Promise<PickListRow> {
  const { data: noData, error: noError } = await supabase.rpc('next_warehouse_pick_no', {
    p_organisation_id: organisationId,
  });
  if (noError) throw noError;
  const pickNo = (noData as string) || `PK-${Date.now()}`;

  const { data, error } = await supabase
    .from('warehouse_pick_lists')
    .insert({
      organisation_id: organisationId,
      pick_no: pickNo,
      source_ref: input.sourceRef ?? null,
      priority: input.priority,
      status: 'queued',
      assigned_to: input.assignedTo ?? null,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  const list = data as PickListRow;

  const { error: itemsError } = await supabase
    .from('warehouse_pick_list_items')
    .insert(
      input.items.map(it => ({
        pick_list_id: list.id,
        item_id: it.itemId,
        source_bin_id: it.sourceBinId,
        quantity_requested: it.quantityRequested,
        quantity_picked: 0,
        status: 'pending',
      }))
    );
  // Header + items are two calls; if the items fail, remove the header so
  // a queued pick list is never orphaned with zero lines (atomicity).
  if (itemsError) {
    await supabase.from('warehouse_pick_lists').delete().eq('id', list.id).maybeSingle();
    throw itemsError;
  }

  return list;
}

/**
 * Advance a pick list status (state machine in picking.ts, guarded server-
 * side like transfers/dispatches so direct calls can't skip steps).
 */
export async function advancePickListStatus(
  pickListId: string,
  to: PickListStatus,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('warehouse_pick_lists')
    .select('status')
    .eq('id', pickListId)
    .maybeSingle();
  if (error) throw error;
  const current = (data?.status ?? 'queued') as PickListStatus;
  if (!canPickTransition(current, to)) {
    return { ok: false, error: `Cannot move a ${current} pick list to ${to}` };
  }
  const patch: Record<string, unknown> = { status: to, updated_at: new Date().toISOString() };
  if (to === 'completed') patch.completed_at = new Date().toISOString();
  if (to === 'cancelled') patch.cancelled_at = new Date().toISOString();
  const { error: err } = await supabase
    .from('warehouse_pick_lists')
    .update(patch)
    .eq('id', pickListId);
  if (err) throw err;
  return { ok: true };
}

/** Update a pick line's picked quantity before completing (TAD §3.12). */
export async function updatePickLineQty(
  lineId: string,
  quantityPicked: number
): Promise<void> {
  const { error } = await supabase
    .from('warehouse_pick_list_items')
    .update({ quantity_picked: quantityPicked, updated_at: new Date().toISOString() })
    .eq('id', lineId);
  if (error) throw error;
}

/** Fetch pick lists enriched with item + bin names (oldest open first). */
export async function fetchPickLists(organisationId: string): Promise<PickListView[]> {
  const [lists, items, structure, binItems] = await Promise.all([
    supabase.from('warehouse_pick_lists').select('*').eq('organisation_id', organisationId).order('created_at', { ascending: false }),
    supabase.from('warehouse_pick_list_items').select('*').eq('pick_list_id', () => supabase.from('warehouse_pick_lists').select('id').eq('organisation_id', organisationId)),
    fetchOrgStructure(organisationId),
    fetchAllBinItems(organisationId),
  ]);
  if (lists.error) throw lists.error;
  if (items.error) throw items.error;

  // Resolve item names from the assignable catalog via the viewer data path.
  const itemNames = new Map<string, string>();
  try {
    const assignable = await fetchAssignableItems();
    for (const it of assignable) itemNames.set(it.id, it.name);
  } catch { /* names are cosmetic */ }

  const binName = new Map(structure.bins.map(b => [b.id, b.name]));
  const rows = lists.data ?? [];

  return rows.map(list => {
    const listItems = (items.data ?? []).filter(i => i.pick_list_id === list.id);
    const lineId = listItems[0];
    return {
      ...(list as PickListRow),
      itemName: lineId ? itemNames.get(lineId.item_id ?? '') ?? null : null,
      sourceBinName: lineId ? binName.get(lineId.source_bin_id) ?? null : null,
      quantityRequested: lineId ? lineId.quantity_requested : null,
      quantityPicked: lineId ? lineId.quantity_picked : null,
      items: listItems.map(i => ({
        id: i.id,
        itemId: i.item_id ?? null,
        itemName: itemNames.get(i.item_id ?? '') ?? null,
        sourceBinId: i.source_bin_id,
        sourceBinName: binName.get(i.source_bin_id) ?? null,
        quantityRequested: Number(i.quantity_requested) || 0,
        quantityPicked: Number(i.quantity_picked) || 0,
        status: i.status as 'pending' | 'picked',
        pickedAt: i.picked_at ?? null,
      })),
    } as PickListView;
  });
}

/** Complete a pick list via the RPC — Movement Engine executes each line. */
export async function completePickList(
  pickListId: string,
  userId: string
): Promise<{ ok: boolean; error?: string; picked?: number; skipped?: number }> {
  const { data, error } = await supabase.rpc('complete_pick_list', {
    p_pick_list_id: pickListId,
    p_operator_id: userId,
  });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string; picked?: number; skipped?: number };
  return { ok: !!res.ok, error: res.error, picked: res.picked, skipped: res.skipped };
}

/** All structure rows for an org (bin → tier → rack → layout → zone chain). */
export async function fetchOrgStructure(organisationId: string) {
  const [floors, zones, layouts, racks, tiers, bins] = await Promise.all([
    supabase.from('warehouse_floors').select('id, name, warehouse_id').eq('organisation_id', organisationId).is('deleted_at', null),
    supabase.from('warehouse_zones').select('id, name, floor_id, storage_role').eq('organisation_id', organisationId).is('deleted_at', null),
    supabase.from('warehouse_layouts').select('id, zone_id').eq('organisation_id', organisationId),
    supabase.from('warehouse_racks').select('id, layout_id, name, position_x, position_y').eq('organisation_id', organisationId).is('deleted_at', null),
    supabase.from('warehouse_tiers').select('id, rack_id').eq('organisation_id', organisationId).is('deleted_at', null),
    supabase.from('warehouse_bins').select('id, tier_id, name, max_quantity, max_weight_kg, status').eq('organisation_id', organisationId).is('deleted_at', null),
  ]);
  if ([floors, zones, layouts, racks, tiers, bins].some(r => r.error)) {
    throw floors.error ?? zones.error ?? layouts.error ?? racks.error ?? tiers.error ?? bins.error;
  }
  return {
    floors: (floors.data ?? []) as { id: string; name: string; warehouse_id: string }[],
    zones: (zones.data ?? []) as { id: string; name: string; floor_id: string; storage_role: string | null }[],
    layouts: (layouts.data ?? []) as { id: string; zone_id: string }[],
    racks: (racks.data ?? []) as { id: string; layout_id: string; name: string; position_x: number | null; position_y: number | null }[],
    tiers: (tiers.data ?? []) as { id: string; rack_id: string }[],
    bins: (bins.data ?? []) as { id: string; tier_id: string; name: string; max_quantity: number | null; max_weight_kg: number | null; status: string | null }[],
  };
}

/** Lightweight org-wide search index for the universal search bar (PRD §2.8).
 *  Bins + zones + racks come from the structure/candidate queries; stocked
 *  item names are resolved once from the materials master. */
export interface WarehouseSearchIndex {
  bins: Array<{ id: string; name: string; zoneName: string | null; warehouseId: string | null; storageRole: string | null }>;
  zones: Array<{ id: string; name: string; floorId: string }>;
  racks: Array<{ id: string; name: string }>;
  items: Array<{ id: string; name: string; code: string | null }>;
}

export async function fetchSearchIndex(organisationId: string): Promise<WarehouseSearchIndex> {
  const [candidates, structure, binItemsRes] = await Promise.all([
    fetchBinCandidates(organisationId),
    fetchOrgStructure(organisationId),
    supabase
      .from('warehouse_bin_items')
      .select('item_id')
      .eq('organisation_id', organisationId)
      .is('deleted_at', null)
      .not('item_id', 'is', null),
  ]);
  const itemIds = [
    ...new Set(
      ((binItemsRes.data ?? []) as Array<{ item_id: string | null }>)
        .map(r => r.item_id)
        .filter((v): v is string => !!v)
    ),
  ];
  const items = itemIds.length > 0 ? await fetchAssignableItems(itemIds) : [];
  return {
    bins: candidates.map(c => ({
      id: c.id,
      name: c.name,
      zoneName: c.zoneName ?? null,
      warehouseId: c.warehouseId ?? null,
      storageRole: c.storageRole ?? null,
    })),
    zones: structure.zones.map(z => ({ id: z.id, name: z.name, floorId: z.floor_id })),
    racks: structure.racks.map(r => ({ id: r.id, name: r.name ?? r.id })),
    items: items.map(i => ({ id: i.id, name: i.name ?? i.id, code: i.code })),
  };
}
