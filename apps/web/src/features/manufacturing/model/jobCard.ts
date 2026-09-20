export interface JobCard {
  id?: string;
  job_card_no: string;
  bom_id: string;
  planned_qty: number;
  actual_qty?: number;
  status: string; // 'draft' | 'issued' | 'in_progress' | 'completed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  remarks?: string;
  organisation_id: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  output_unit?: string;
  /** NOT NULL in DB — required on every insert. */
  product_name: string;
  /** Legacy hard FK to the sales-order demand line. */
  sales_order_item_id?: string | null;
  machine_id?: string | null;
  tooling_id?: string | null;
  running_cavities?: number | null;
  planned_shots?: number | null;
  planned_cycle_time_sec?: number | null;
  issued_by?: string | null;
  issued_at?: string | null;
  approval_id?: string | null;
  yield_pct?: number | null;
}

/**
 * Canonical INSERT shape for `job_cards`. See docs/GLOSSARY.md.
 *
 * ALL direct inserts into `job_cards` MUST be typed with this interface
 * (use `satisfies JobCardInsert`). The keys are locked to the live DB schema:
 * job_card_no (NOT job_card_number), planned_qty (NOT target_qty),
 * machine_id (NOT work_center_id). Supabase-js is structurally permissive
 * about unknown keys, so without this type a wrong column name only fails
 * at runtime (PGRST204). With it, the mistake fails `tsc`.
 */
export interface JobCardInsert {
  organisation_id: string;
  job_card_no: string;
  product_name: string;
  bom_id: string | null;
  planned_qty: number;
  output_unit?: string | null;
  status?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
  remarks?: string | null;
  /** Legacy hard FK to the sales-order demand line (keep in sync with source_type='sales_order_item'). */
  sales_order_item_id?: string | null;
  machine_id?: string | null;
  tooling_id?: string | null;
  running_cavities?: number | null;
  planned_shots?: number | null;
  planned_cycle_time_sec?: number | null;
  created_by?: string | null;
}

export interface JobCardMaterial {
  id?: string;
  job_card_id: string;
  material_id: string;
  planned_qty: number;
  issued_qty?: number;
  consumed_qty?: number;
  wastage_qty?: number;
  return_qty?: number;
  status: string; // 'reserved' | 'issued' | 'consumed' | 'returned'
  warehouse_id?: string | null;
  unit?: string | null;
  is_additional?: boolean;
  materials?: {
    name: string;
    unit: string;
  } | null;
}
