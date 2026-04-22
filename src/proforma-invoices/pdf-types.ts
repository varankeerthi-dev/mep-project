import type { ProformaWithRelations } from './api';

export interface ProformaPdfCompany {
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

export interface ProformaPdfData {
  proforma: ProformaWithRelations;
  company: ProformaPdfCompany | null;
  template?: any | null;
}

export interface ProformaPdfOptions {
  company?: ProformaPdfCompany | null;
  organisationId?: string;
  template?: any | null;
  fileName?: string;
}
