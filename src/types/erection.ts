// Erection/Installation Charges Type Definitions

export interface ServiceRate {
  id: string;
  item_name: string;
  default_erection_rate: number;
  unit: string;
  gst_rate: number;
  sac_code?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuotationItemExtended {
  // Existing fields from quotation_items
  id: string;
  quotation_id: string;
  item_id?: string | null;
  variant_id?: string | null;
  description?: string | null;
  qty: number;
  uom: string;
  rate: number;
  original_discount_percent?: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
  line_total?: number;
  override_flag?: boolean;
  created_at: string;
  updated_at?: string;
  hsn_code?: string | null;
  sac_code?: string | null;
  
  // NEW FIELDS for erection charges
  section?: 'materials' | 'erection' | 'other';
  linked_material_id?: string | null;
  is_auto_quantity?: boolean;
  erection_manually_removed?: boolean;
  rate_manually_edited?: boolean;
}

export interface ErectionItem extends QuotationItemExtended {
  section: 'erection';
  linked_material_id: string;
  is_auto_quantity: true;
}

export interface MaterialItem extends QuotationItemExtended {
  section: 'materials';
  linked_material_id?: null;
}
