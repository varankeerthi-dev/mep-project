export interface WIPValuationSnapshot {
  id?: string;
  snapshot_date: string;
  job_card_id: string;
  material_id: string;
  wip_qty: number;
  unit_cost?: number;
  total_value?: number;
  days_in_wip?: number;
  organisation_id: string;
  created_at?: string;
}
