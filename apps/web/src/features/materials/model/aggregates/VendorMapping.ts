/** Vendor mapping row in the editor */
export interface VendorMappingRow {
  id: string;
  variant_id: string | null;
  make: string;
  vendor_id: string;
  base_rate: number;
  discount_percent: number;
  is_preferred: boolean;
}
