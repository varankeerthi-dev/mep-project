// src/warehouse/types.ts
// TypeScript domain types for the Warehouse Management module.
// Mirrors the Phase 0 database schema (see src/supabase/migrations/003_warehouse_management.sql).

export type StorageRole =
  | 'bulk_storage'
  | 'picking'
  | 'receiving'
  | 'dispatch'
  | 'returns'
  | 'quality_hold'
  | 'overflow'
  | 'maintenance'
  | 'custom';

export const STORAGE_ROLES: { code: StorageRole; name: string; color: string; description: string }[] = [
  { code: 'bulk_storage', name: 'Bulk Storage', color: '#2563eb', description: 'High-volume reserve storage' },
  { code: 'picking', name: 'Picking', color: '#16a34a', description: 'Forward picking locations' },
  { code: 'receiving', name: 'Receiving', color: '#d97706', description: 'Inbound goods staging' },
  { code: 'dispatch', name: 'Dispatch', color: '#dc2626', description: 'Outbound order staging' },
  { code: 'returns', name: 'Returns', color: '#7c3aed', description: 'Customer / vendor returns' },
  { code: 'quality_hold', name: 'Quality Hold', color: '#db2777', description: 'Quarantine / inspection hold' },
  { code: 'overflow', name: 'Overflow', color: '#64748b', description: 'Temporary overflow storage' },
  { code: 'maintenance', name: 'Maintenance', color: '#0d9488', description: 'Assets under maintenance' },
  { code: 'custom', name: 'Custom', color: '#6b7280', description: 'Custom user-defined storage role' },
];

export type LayoutType =
  | 'grid'
  | 'parallel_rows'
  | 'double_aisle'
  | 'single_aisle'
  | 'u_shape'
  | 'l_shape'
  | 'open_yard'
  | 'custom';

export const LAYOUT_TYPES: { value: LayoutType; name: string; description: string }[] = [
  { value: 'grid', name: 'Grid', description: 'Uniform rows & columns' },
  { value: 'parallel_rows', name: 'Parallel Rows', description: 'Long parallel rack rows' },
  { value: 'double_aisle', name: 'Double Aisle', description: 'Aisles on both sides of racks' },
  { value: 'single_aisle', name: 'Single Aisle', description: 'One central aisle' },
  { value: 'u_shape', name: 'U Shape', description: 'Racks around a U-shaped aisle' },
  { value: 'l_shape', name: 'L Shape', description: 'Racks around an L-shaped aisle' },
  { value: 'open_yard', name: 'Open Yard', description: 'Open outdoor storage' },
  { value: 'custom', name: 'Custom', description: 'User-defined layout' },
];

export type RackType =
  | 'pallet_rack'
  | 'shelf_rack'
  | 'double_rack'
  | 'wall_rack'
  | 'island_rack'
  | 'cantilever'
  | 'open_storage'
  | 'custom';

export const RACK_TYPES: { value: RackType; name: string }[] = [
  { value: 'pallet_rack', name: 'Pallet Rack' },
  { value: 'shelf_rack', name: 'Shelf Rack' },
  { value: 'double_rack', name: 'Double Rack' },
  { value: 'wall_rack', name: 'Wall Rack' },
  { value: 'island_rack', name: 'Island Rack' },
  { value: 'cantilever', name: 'Cantilever' },
  { value: 'open_storage', name: 'Open Storage' },
  { value: 'custom', name: 'Custom' },
];

export type BinStatus =
  | 'available'
  | 'occupied'
  | 'nearly_full'
  | 'full'
  | 'reserved'
  | 'blocked'
  | 'maintenance'
  | 'quality_hold'
  | 'cycle_count'
  | 'returns'
  | 'inactive';

// ─── DB row shapes (subset of columns used by the UI) ─────────────────────────

export interface WarehouseRow {
  id: string;
  organisation_id?: string;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  name?: string | null;
  location?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  manager?: string | null;
  is_default?: boolean;
  is_active?: boolean;
  warehouse_purpose?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FloorRow {
  id: string;
  organisation_id?: string;
  warehouse_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  display_order: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ZoneRow {
  id: string;
  organisation_id?: string;
  floor_id: string;
  name: string;
  code?: string | null;
  storage_role: string;
  description?: string | null;
  color?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LayoutRow {
  id: string;
  organisation_id?: string;
  zone_id: string;
  name: string;
  code?: string | null;
  layout_type: string;
  description?: string | null;
  orientation?: string | null;
  spacing_m?: number | null;
  rotation_deg?: number | null;
  aisle_width_m?: number | null;
  walkway_width_m?: number | null;
  scale?: number | null;
  default_rack_direction?: string | null;
  status?: string | null;
  version?: number | null;
  parent_version_id?: string | null;
  published_by?: string | null;
  published_on?: string | null;
  archived_by?: string | null;
  archived_on?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RackRow {
  id: string;
  organisation_id?: string;
  layout_id: string;
  name: string;
  code?: string | null;
  rack_type?: string | null;
  columns_count: number;
  levels_count: number;
  width_m?: number | null;
  depth_m?: number | null;
  height_m?: number | null;
  max_weight_kg?: number | null;
  max_volume_m3?: number | null;
  orientation?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  rotation_deg?: number | null;
  status?: string | null;
  qr_code?: string | null;
  barcode?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TierRow {
  id: string;
  organisation_id?: string;
  rack_id: string;
  tier_number: number;
  name: string;
  height_m?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface BinRow {
  id: string;
  organisation_id?: string;
  tier_id: string;
  rack_id: string;
  column_number: number;
  name: string;
  code?: string | null;
  width_m?: number | null;
  depth_m?: number | null;
  height_m?: number | null;
  max_quantity?: number | null;
  max_weight_kg?: number | null;
  max_volume_m3?: number | null;
  max_pallets?: number | null;
  current_quantity?: number | null;
  reserved_quantity?: number | null;
  status?: string | null;
  notes?: string | null;
  qr_code?: string | null;
  barcode?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NamingRuleRow {
  id: string;
  organisation_id?: string;
  layout_id: string;
  entity_type: 'rack' | 'bin';
  prefix: string;
  separator: string;
  numbering_style: 'numeric' | 'alpha' | 'alphanumeric';
  padding: number;
  level_format: string;
  suffix: string;
  sample?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BinItemRow {
  id: string;
  organisation_id?: string;
  bin_id: string;
  item_id?: string | null;
  item_variant_id?: string | null;
  quantity: number | null;
  is_primary?: boolean;
  is_reserve?: boolean;
  batch_no?: string | null;
  lot_no?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Phase 4 — Warehouse Operations (transfers / movements / replenishment) ──

export type TransferPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';

export type TransferStatus =
  | 'draft'
  | 'requested'
  | 'approved'
  | 'picking'
  | 'in_transit'
  | 'received'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export type MovementType =
  | 'receive'
  | 'transfer_out'
  | 'transfer_in'
  | 'dispatch'
  | 'consolidate'
  | 'overflow'
  | 'replenish'
  | 'adjust'
  | 'pick'
  | 'other'
  | 'reversal';

export interface TransferRow {
  id: string;
  organisation_id?: string;
  transfer_no: string;
  item_id?: string | null;
  quantity: number | null;
  source_bin_id: string;
  destination_bin_id: string;
  priority: TransferPriority;
  status: TransferStatus;
  requested_by?: string | null;
  requested_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  picked_by?: string | null;
  picked_at?: string | null;
  moved_by?: string | null;
  in_transit_at?: string | null;
  received_by?: string | null;
  received_at?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MovementRow {
  id: string;
  organisation_id?: string;
  movement_type: MovementType;
  reference_type: string;
  reference_id?: string | null;
  item_id?: string | null;
  source_bin_id?: string | null;
  destination_bin_id?: string | null;
  quantity: number | null;
  operator_id?: string | null;
  device?: string | null;
  remarks?: string | null;
  created_at?: string;
  // TAD §5.12 — reversal metadata (migration 007).
  reversal_of?: string | null;
  reversed_at?: string | null;
  reversed_by?: string | null;
}

export interface ReplenishmentRuleRow {
  id: string;
  organisation_id?: string;
  bin_id: string;
  item_id?: string | null;
  min_qty: number | null;
  max_qty: number | null;
  enabled?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Phase 4 — Dispatch workflow (PRD §4.13 / TAD §3.13) ──────────────────────

export type DispatchStatus =
  | 'draft'
  | 'reserved'
  | 'picking'
  | 'packing'
  | 'ready'
  | 'loaded'
  | 'completed'
  | 'cancelled';

export interface DispatchRow {
  id: string;
  organisation_id?: string;
  dispatch_no: string;
  sales_order_ref?: string | null;
  item_id?: string | null;
  quantity: number | null;
  reserved_qty: number | null;
  source_bin_id: string;
  priority: TransferPriority;
  status: DispatchStatus;
  reserved_at?: string | null;
  picked_at?: string | null;
  packed_at?: string | null;
  ready_at?: string | null;
  loaded_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  vehicle_no?: string | null;
  driver_name?: string | null;
  shipment_notes?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type PickListStatus = 'queued' | 'picking' | 'completed' | 'cancelled';

export interface PickListRow {
  id: string;
  organisation_id?: string;
  pick_no: string;
  source_ref?: string | null;
  priority: TransferPriority;
  status: PickListStatus;
  assigned_to?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
}

export interface PickListItemRow {
  id: string;
  pick_list_id: string;
  item_id?: string | null;
  source_bin_id: string;
  quantity_requested: number | null;
  quantity_picked: number | null;
  status: 'pending' | 'picked';
  picked_by?: string | null;
  picked_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Phase 7 — Cycle Count (Inventory Accuracy) ──────────────────────────────

export type CycleCountBatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type CycleCountItemStatus = 'pending' | 'counted' | 'matched' | 'variance' | 'investigated' | 'adjusted';

export interface CycleCountBatchRow {
  id: string;
  organisation_id?: string;
  batch_no: string;
  name: string;
  abc_class: 'A' | 'B' | 'C';
  scope_type: 'warehouse' | 'zone' | 'bin';
  scope_id?: string | null;
  status: CycleCountBatchStatus;
  planned_for?: string | null;
  started_at?: string | null;
  started_by?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  frozen_bins?: number;
  item_count?: number;
  variance_count?: number;
  approval_status?: 'none' | 'pending' | 'approved' | 'rejected';
  approved_at?: string | null;
  approved_by?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CycleCountItemRow {
  id: string;
  organisation_id?: string;
  batch_id: string;
  bin_id: string;
  item_id?: string | null;
  expected_qty: number | null;
  counted_qty?: number | null;
  variance?: number | null;
  status: CycleCountItemStatus;
  investigation_note?: string | null;
  adjusted_at?: string | null;
  adjusted_by?: string | null;
  counted_at?: string | null;
  counted_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CapacityProfileRow {
  id: string;
  organisation_id?: string;
  name: string;
  description?: string | null;
  max_quantity?: number | null;
  max_weight_kg?: number | null;
  max_volume_m3?: number | null;
  max_pallets?: number | null;
  is_active?: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** One archived layout version + enough context to restore it (G10). */
export interface LayoutVersionRow {
  layout: LayoutRow;
  zone: ZoneRow;
  floor: FloorRow;
  /** First rack of the layout (carries columns/levels/naming dims). */
  rack: RackRow | null;
  /** Total racks generated for this version (used to infer rows on restore). */
  rackCount: number;
  /** Bins of the first rack's first tier (column count = columns per rack). */
  bins: BinRow[];
  namingRule: NamingRuleRow | null;
}

// ─── Designer draft model (client-side working state before save) ─────────────

export interface RackGenerationConfig {
  rows: number;
  columns: number;
  levels: number;
  rackPrefix: string;
  rackType: RackType;
  maxQuantity: number;
  spacingM: number;
}

/** Full layout configuration (PRD §5.10) — all fields persistable. */
export interface LayoutConfigFields {
  scale: number;
  rotationDeg: number;
  aisleWidthM: number;
  walkwayWidthM: number;
  rackDirection: string;
}

export interface NamingConfig {
  prefix: string;
  separator: string;
  numberingStyle: 'numeric' | 'alpha' | 'alphanumeric';
  padding: number;
  levelFormat: string;
  suffix: string;
}

/** A rack that was manually moved off its generated grid position (PRD §5.18).
 *  `rackIndex` is the 1-based generation index from expandRacks (row-major,
 *  U/L-filtered). `row`/`col` are 1-based grid coordinates. */
export interface RackOverride {
  rackIndex: number;
  row: number;
  col: number;
}

export interface LayoutDraft {
  id: string;
  name: string;
  layoutType: LayoutType;
  orientation: 'horizontal' | 'vertical';
  description?: string;
  config: LayoutConfigFields;
  naming: NamingConfig;
  racks: RackGenerationConfig;
  /** Manual rack repositioning (drag & drop). Optional — empty = generated grid. */
  rackOverrides?: RackOverride[];
}

export interface ZoneDraft {
  id: string;
  name: string;
  code: string;
  storageRole: StorageRole;
  color: string;
  description?: string;
  /** A zone may contain multiple independent layouts (PRD §3.8, §5.9). */
  layouts: LayoutDraft[];
}

export interface FloorDraft {
  id: string;
  name: string;
  code: string;
  description?: string;
  displayOrder: number;
  zones: ZoneDraft[];
}

export interface WarehouseDraft {
  id: string; // temp id ('' for new)
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  manager?: string;
  description?: string;
  floors: FloorDraft[];
}

export const DEFAULT_NAMING: NamingConfig = {
  prefix: '',
  separator: '-',
  numberingStyle: 'numeric',
  padding: 2,
  levelFormat: 'L{n}',
  suffix: '',
};

export const DEFAULT_RACKS: RackGenerationConfig = {
  rows: 2,
  columns: 5,
  levels: 3,
  rackPrefix: 'A',
  rackType: 'pallet_rack',
  maxQuantity: 500,
  spacingM: 1,
};

export const DEFAULT_LAYOUT_CONFIG: LayoutConfigFields = {
  scale: 1,
  rotationDeg: 0,
  aisleWidthM: 3,
  walkwayWidthM: 2,
  rackDirection: 'north',
};

export function createEmptyLayout(layoutType: LayoutType = 'grid'): LayoutDraft {
  return {
    id: crypto.randomUUID(),
    name: layoutType === 'grid' ? 'Grid Layout' : `${LAYOUT_TYPES.find(l => l.value === layoutType)?.name ?? 'Layout'} Layout`,
    layoutType,
    orientation: 'horizontal',
    config: { ...DEFAULT_LAYOUT_CONFIG },
    naming: { ...DEFAULT_NAMING },
    racks: { ...DEFAULT_RACKS },
  };
}

export function createEmptyZone(storageRole: StorageRole = 'bulk_storage'): ZoneDraft {
  const role = STORAGE_ROLES.find(r => r.code === storageRole) ?? STORAGE_ROLES[0];
  return {
    id: crypto.randomUUID(),
    name: `${role.name} Zone`,
    code: role.code.toUpperCase().slice(0, 4),
    storageRole,
    color: role.color,
    layouts: [createEmptyLayout()],
  };
}

export function createEmptyFloor(displayOrder = 1): FloorDraft {
  return {
    id: crypto.randomUUID(),
    name: displayOrder === 1 ? 'Ground Floor' : `Floor ${displayOrder}`,
    code: `FL${displayOrder}`,
    displayOrder,
    zones: [createEmptyZone()],
  };
}

export function createEmptyWarehouse(): WarehouseDraft {
  return {
    id: '',
    name: '',
    code: '',
    floors: [createEmptyFloor(1)],
  };
}
