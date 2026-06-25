export interface CreditNoteClient {
  id: string;
  name: string | null;
  gstin: string | null;
  state: string | null;
  email: string | null;
}

export interface CreditNoteItem {
  id: string;
  cn_id: string;
  organisation_id: string;
  description: string;
  hsn_code: string | null;
  quantity: number;
  rate: number;
  discount_amount: number;
  taxable_value: number;
  cgst_percent: number;
  cgst_amount: number;
  sgst_percent: number;
  sgst_amount: number;
  igst_percent: number;
  igst_amount: number;
  total_amount: number;
  created_at: string | null;
}

export interface CreditNote {
  id: string;
  organisation_id: string;
  client_id: string;
  invoice_id: string | null;
  cn_number: string;
  cn_date: string;
  cn_type: string;
  reason: string | null;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  approval_status: string;
  authorized_signatory_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  client: CreditNoteClient | null;
  items: CreditNoteItem[];
}

export interface CreditNoteFilters {
  organisationId?: string;
  status?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}
