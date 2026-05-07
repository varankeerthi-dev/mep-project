export const conversionTypes = [
  'quotation-to-proforma',
  'quotation-to-invoice',
  'quotation-to-dc',
  'dc-to-quotation',
  'dc-to-proforma',
  'proforma-to-invoice',
] as const;

export type ConversionType = (typeof conversionTypes)[number];

export interface ConversionPayload {
  type: ConversionType;
  sourceId: string;
  organisationId: string;
}

export interface QuotationSourceData {
  id: string;
  quotation_no: string;
  client_id: string;
  client_state: string | null;
  project_id: string | null;
  billing_address: string | null;
  gstin: string | null;
  state: string | null;
  date: string;
  valid_till: string | null;
  payment_terms: string | null;
  reference: string | null;
  remarks: string | null;
  subtotal: number;
  total_tax: number;
  grand_total: number;
  items: QuotationItemData[];
}

export interface QuotationItemData {
  id: string;
  item_id: string | null;
  description: string;
  hsn_code: string | null;
  qty: number;
  rate: number;
  tax_percent: number;
  line_total: number;
}

export interface DCSourceData {
  id: string;
  dc_number: string;
  client_name: string;
  client_id: string | null;
  project_id: string | null;
  ship_to_state: string | null;
  po_no: string | null;
  remarks: string | null;
  dc_date: string;
  items: DCItemData[];
}

export interface DCItemData {
  id: string;
  material_id: string | null;
  material_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface ProformaSourceData {
  id: string;
  pi_number: string;
  client_id: string;
  client_state: string | null;
  company_state: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  po_number: string | null;
  po_date: string | null;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  payment_terms: string | null;
  items: ProformaItemData[];
}

export interface ProformaItemData {
  id: string;
  description: string;
  hsn_code: string | null;
  qty: number;
  rate: number;
  amount: number;
  tax_percent: number;
  discount_percent: number;
  discount_amount: number;
}

export type SourceDocumentData = QuotationSourceData | DCSourceData | ProformaSourceData;

export interface ConvertedInvoiceData {
  client_id: string;
  source_type: 'quotation' | 'challan' | 'po' | 'direct';
  source_id: string;
  template_type: 'standard' | 'lot' | 'client_custom';
  mode: 'itemized' | 'lot';
  invoice_no: string | null;
  invoice_date: string;
  po_number: string | null;
  po_date: string | null;
  company_state: string | null;
  client_state: string | null;
  items: ConvertedInvoiceItem[];
  materials?: ConvertedInvoiceMaterial[];
}

export interface ConvertedInvoiceItem {
  description: string;
  hsn_code: string | null;
  qty: number;
  rate: number;
  amount: number;
  tax_percent: number;
  meta_json?: Record<string, unknown>;
}

export interface ConvertedInvoiceMaterial {
  product_id: string;
  qty_used: number;
}

export interface ConvertedProformaData {
  client_id: string;
  source_type: 'quotation' | 'challan' | 'po' | 'manual';
  source_id: string | null;
  pi_number: string | null;
  company_state: string | null;
  client_state: string | null;
  valid_until: string | null;
  po_number: string | null;
  po_date: string | null;
  notes: string | null;
  terms: string | null;
  payment_terms: string | null;
  items: ConvertedProformaItem[];
}

export interface ConvertedProformaItem {
  description: string;
  hsn_code: string | null;
  qty: number;
  rate: number;
  amount: number;
  tax_percent: number;
  discount_percent: number;
  discount_amount: number;
}

export interface ConvertedQuotationData {
  client_id: string;
  project_id: string | null;
  billing_address: string | null;
  gstin: string | null;
  state: string | null;
  date: string;
  valid_till: string | null;
  payment_terms: string | null;
  reference: string | null;
  remarks: string | null;
  items: ConvertedQuotationItem[];
}

export interface ConvertedQuotationItem {
  item_id: string | null;
  description: string;
  qty: number;
  rate: number;
  tax_percent: number;
  uom: string;
}

export interface ConvertedDCData {
  client_id: string;
  project_id: string | null;
  dc_number: string | null;
  dc_date: string;
  ship_to_address: string | null;
  ship_to_state: string | null;
  po_number: string | null;
  remarks: string | null;
  items: ConvertedDCItem[];
}

export interface ConvertedDCItem {
  material_id: string | null;
  material_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export type ConvertedData = ConvertedInvoiceData | ConvertedProformaData | ConvertedQuotationData | ConvertedDCData;

export interface ConversionResult {
  data: ConvertedData;
  sourceType: string;
  sourceNumber: string;
  conversionType: ConversionType;
  targetDocumentType: 'invoice' | 'proforma' | 'quotation' | 'dc';
}
