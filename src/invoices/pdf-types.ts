import type { InvoiceTemplateRecord, InvoiceWithRelations } from './api';
import type { InvoiceSourceDocument } from './types';

export interface InvoicePdfCompany {
  id?: string;
  name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  tan?: string | null;
  msme_no?: string | null;
  website?: string | null;
  state?: string | null;
  bank_details?: {
    bank_name?: string | null;
    account_no?: string | null;
    ifsc?: string | null;
    branch?: string | null;
  } | null;
}

export interface InvoicePdfMaterialLine {
  product_id: string;
  product_name: string;
  qty_used: number;
}

export interface InvoicePdfData {
  invoice: InvoiceWithRelations;
  company: InvoicePdfCompany | null;
  template: InvoiceTemplateRecord | null;
  source: InvoiceSourceDocument | null;
  materials: InvoicePdfMaterialLine[];
}

export interface InvoicePdfOptions {
  company?: InvoicePdfCompany | null;
  organisationId?: string;
  template?: InvoiceTemplateRecord | null;
  source?: InvoiceSourceDocument | null;
  fileName?: string;
}
