/** Domain entity for a warehouse. Mirrors the `warehouses` DB table. */
export interface Warehouse {
  id: string;
  organisation_id: string;
  warehouse_code: string;
  warehouse_name: string;
  name?: string;
  location: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
