/** Domain entity for a vendor. Mirrors the `purchase_vendors` DB table. */
export interface Vendor {
  id: string;
  company_name: string;
  organisation_id: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}
