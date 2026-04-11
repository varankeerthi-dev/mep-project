export interface POItem {
  sr: number;
  description: string;
  hsn_code?: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_percent?: number;
  discount_amount?: number;
  cgst_percent: number;
  cgst_amount: number;
  sgst_percent: number;
  sgst_amount: number;
  igst_percent?: number;
  igst_amount?: number;
  total_amount: number;
}

export interface PurchaseOrderData {
  company_name: string;
  company_address: string;
  company_gstin: string;
  company_phone: string;
  company_logo?: string;
  po_number: string;
  po_date: string;
  vendor_name: string;
  vendor_address: string;
  vendor_gstin: string;
  vendor_contact: string;
  delivery_location: string;
  currency: string;
  exchange_rate: number;
  terms: string;
  items: POItem[];
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  total_amount_inr: number;
  notes?: string;
}
