export const invoiceSourceTypes = ['quotation', 'challan', 'po'] as const;
export const invoiceTemplateTypes = ['standard', 'lot', 'client_custom'] as const;
export const invoiceModes = ['itemized', 'lot'] as const;
export const invoiceStatuses = ['draft', 'final'] as const;

export type InvoiceSourceType = (typeof invoiceSourceTypes)[number];
export type InvoiceTemplateType = (typeof invoiceTemplateTypes)[number];
export type InvoiceMode = (typeof invoiceModes)[number];
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export interface InvoiceFilters {
  clientId?: string;
  status?: InvoiceStatus;
  sourceType?: InvoiceSourceType;
  templateType?: InvoiceTemplateType;
  limit?: number;
  organisationId?: string | null;
}

export interface InvoiceSourceMapOptions {
  companyState?: string | null;
  defaultTaxPercent?: number;
  templateType?: InvoiceTemplateType;
  mode?: InvoiceMode;
  status?: InvoiceStatus;
}

export interface InvoiceSourceLine {
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

export interface InvoiceSourceMaterial {
  product_id: string;
  qty_used: number;
}

export interface QuotationInvoiceSource {
  type: 'quotation';
  header: {
    id: string;
    client_id: string;
    client_state?: string | null;
    reference?: string | null;
  };
  items: InvoiceSourceLine[];
}

export interface ChallanInvoiceSource {
  type: 'challan';
  header: {
    id: string;
    client_id: string;
    client_state?: string | null;
    challan_number?: string | null;
    po_no?: string | null;
    remarks?: string | null;
  };
  items: InvoiceSourceLine[];
}

export interface PurchaseOrderInvoiceSource {
  type: 'po';
  header: {
    id: string;
    client_id: string;
    client_state?: string | null;
    po_number: string;
    po_total_value: number;
    remarks?: string | null;
  };
  materials?: InvoiceSourceMaterial[];
}

export type InvoiceSourceDocument =
  | QuotationInvoiceSource
  | ChallanInvoiceSource
  | PurchaseOrderInvoiceSource;

export interface InvoiceClientSummary {
  id: string;
  name: string | null;
  gst_number: string | null;
  state: string | null;
  default_template_id: string | null;
}
