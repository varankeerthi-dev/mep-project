import { supabase } from '@/supabase';

export interface GSTReturn {
  id: string;
  organisation_id: string;
  return_type: 'GSTR1' | 'GSTR2B' | 'GSTR3B';
  period_month: number;
  period_year: number;
  filing_status: 'PENDING' | 'FILED' | 'REJECTED' | 'CANCELLED';
  filing_date: string | null;
  due_date: string | null;
  total_taxable_value: number;
  total_igst: number;
  total_cgst: number;
  total_sgst: number;
  total_tax: number;
  created_at: string;
  updated_at: string;
}

export interface GSTInwardSupply {
  id: string;
  organisation_id: string;
  supplier_id: string | null;
  invoice_number: string;
  invoice_date: string;
  invoice_type: 'REGULAR' | 'REVERSE_CHARGE' | 'EXEMPT' | 'ZERO_RATED';
  period_month: number;
  period_year: number;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  itc_eligible: boolean;
  itc_blocked: boolean;
  itc_blocked_reason: string | null;
  reconciliation_status: 'PENDING' | 'MATCHED' | 'MISMATCH' | 'MANUAL';
  source_record_id: string | null;
  source_record_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface GSTOutwardSupply {
  id: string;
  organisation_id: string;
  customer_id: string | null;
  invoice_number: string;
  invoice_date: string;
  invoice_type: 'REGULAR' | 'EXPORT' | 'EXEMPT' | 'ZERO_RATED' | 'SEZ';
  period_month: number;
  period_year: number;
  place_of_supply: string | null;
  reverse_charge: boolean;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total_value: number;
  source_record_id: string | null;
  source_record_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface GSTITCLedger {
  id: string;
  organisation_id: string;
  period_month: number;
  period_year: number;
  itc_type: 'IGST' | 'CGST' | 'SGST' | 'CESS';
  opening_balance: number;
  credit_available: number;
  credit_utilized: number;
  credit_blocked: number;
  credit_lapsed: number;
  closing_balance: number;
  created_at: string;
  updated_at: string;
}

export interface GSTRCMLiability {
  id: string;
  organisation_id: string;
  period_month: number;
  period_year: number;
  supplier_id: string | null;
  invoice_number: string;
  invoice_date: string;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  total_tax: number;
  paid: boolean;
  paid_date: string | null;
  source_record_id: string | null;
  source_record_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface GSTReconciliation {
  id: string;
  organisation_id: string;
  period_month: number;
  period_year: number;
  reconciliation_type: 'GSTR2B' | 'ITC' | 'RCM';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  total_records: number;
  matched_records: number;
  mismatched_records: number;
  manual_records: number;
  discrepancies: any;
  performed_by: string | null;
  performed_at: string | null;
  created_at: string;
  updated_at: string;
}

// GST Returns API
export const getGSTReturns = async (organisationId: string, month?: number, year?: number) => {
  let query = supabase
    .from('gst_returns')
    .select('*')
    .eq('organisation_id', organisationId);
  
  if (month) query = query.eq('period_month', month);
  if (year) query = query.eq('period_year', year);
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as GSTReturn[];
};

export const createGSTReturn = async (gstReturn: Partial<GSTReturn>) => {
  const { data, error } = await supabase
    .from('gst_returns')
    .insert(gstReturn)
    .select()
    .single();
  
  if (error) throw error;
  return data as GSTReturn;
};

// GST Inward Supply API
export const getGSTInwardSupply = async (organisationId: string, month?: number, year?: number) => {
  let query = supabase
    .from('gst_inward_supply')
    .select('*')
    .eq('organisation_id', organisationId);
  
  if (month) query = query.eq('period_month', month);
  if (year) query = query.eq('period_year', year);
  
  const { data, error } = await query.order('invoice_date', { ascending: false });
  
  if (error) throw error;
  return data as GSTInwardSupply[];
};

export const createGSTInwardSupply = async (supply: Partial<GSTInwardSupply>) => {
  const { data, error } = await supabase
    .from('gst_inward_supply')
    .insert(supply)
    .select()
    .single();
  
  if (error) throw error;
  return data as GSTInwardSupply;
};

// GST Outward Supply API
export const getGSTOutwardSupply = async (organisationId: string, month?: number, year?: number) => {
  let query = supabase
    .from('gst_outward_supply')
    .select('*')
    .eq('organisation_id', organisationId);
  
  if (month) query = query.eq('period_month', month);
  if (year) query = query.eq('period_year', year);
  
  const { data, error } = await query.order('invoice_date', { ascending: false });
  
  if (error) throw error;
  return data as GSTOutwardSupply[];
};

export const createGSTOutwardSupply = async (supply: Partial<GSTOutwardSupply>) => {
  const { data, error } = await supabase
    .from('gst_outward_supply')
    .insert(supply)
    .select()
    .single();
  
  if (error) throw error;
  return data as GSTOutwardSupply;
};

// ITC Ledger API
export const getGSTITCLedger = async (organisationId: string, month?: number, year?: number) => {
  let query = supabase
    .from('gst_itc_ledger')
    .select('*')
    .eq('organisation_id', organisationId);
  
  if (month) query = query.eq('period_month', month);
  if (year) query = query.eq('period_year', year);
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as GSTITCLedger[];
};

// RCM Liability API
export const getGSTRCMLiability = async (organisationId: string, month?: number, year?: number) => {
  let query = supabase
    .from('gst_rcm_liability')
    .select('*')
    .eq('organisation_id', organisationId);
  
  if (month) query = query.eq('period_month', month);
  if (year) query = query.eq('period_year', year);
  
  const { data, error } = await query.order('invoice_date', { ascending: false });
  
  if (error) throw error;
  return data as GSTRCMLiability[];
};

// GST Reconciliation API
export const getGSTReconciliation = async (organisationId: string, month?: number, year?: number) => {
  let query = supabase
    .from('gst_reconciliation')
    .select('*')
    .eq('organisation_id', organisationId);
  
  if (month) query = query.eq('period_month', month);
  if (year) query = query.eq('period_year', year);
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as GSTReconciliation[];
};

export const createGSTReconciliation = async (reconciliation: Partial<GSTReconciliation>) => {
  const { data, error } = await supabase
    .from('gst_reconciliation')
    .insert(reconciliation)
    .select()
    .single();
  
  if (error) throw error;
  return data as GSTReconciliation;
};