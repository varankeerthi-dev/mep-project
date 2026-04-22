export const proformaStatuses = ['draft', 'sent', 'accepted', 'rejected'] as const;
export const proformaSourceTypes = ['quotation', 'challan', 'po', 'manual'] as const;

export type ProformaStatus = (typeof proformaStatuses)[number];
export type ProformaSourceType = (typeof proformaSourceTypes)[number];

export interface ProformaFilters {
  clientId?: string;
  status?: ProformaStatus;
  sourceType?: ProformaSourceType;
  limit?: number;
  organisationId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
}

export interface ProformaSourceLine {
  id?: string;
  item_id?: string | null;
  product_id?: string | null;
  description: string;
  hsn_code?: string | null;
  qty: number;
  rate: number;
  amount?: number | null;
  tax_percent?: number | null;
  meta_json?: Record<string, unknown> | null;
}

export interface ProformaClientSummary {
  id: string;
  name: string | null;
  gst_number: string | null;
  state: string | null;
  default_template_id: string | null;
  email: string | null;
}