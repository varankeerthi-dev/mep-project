/** Variant pricing row for the pricing grid */
export interface VariantPricingRow {
  id: number | string;
  company_variant_id: string;
  make: string;
  sale_price: string;
  purchase_price: string;
}

/** Client-specific pricing (ARC) */
export interface ClientPricingRow {
  id: string;
  client_id: string;
  company_variant_id: string | null;
  pricing_type: string;
  rate: string;
  valid_from: string;
  valid_to: string;
  status: string;
  client_name?: string;
}
