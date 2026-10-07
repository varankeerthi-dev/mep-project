import { supabase } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface Project {
  id?: string
  name?: string
  project_name?: string
  client_name?: string
  description?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface MaterialUnit {
  id?: string
  material_id?: string
  unit_name?: string
  conversion_factor?: number
  created_at?: string
}

export interface Material {
  id?: string
  name?: string
  unit?: string
  default_rate?: number
  created_at?: string
  material_units?: MaterialUnit[]
  [key: string]: unknown
}

export interface DeliveryChallan {
  id?: string
  dc_number?: string
  project_id?: string
  dc_date?: string
  client_name?: string
  site_address?: string
  vehicle_number?: string
  driver_name?: string
  dc_type?: string
  rate_source?: 'base' | 'project' | 'arc' | 'manual'
  remarks?: string
  status?: string
  created_at?: string
  updated_at?: string
  project?: { project_name?: string; name?: string }
  items?: DeliveryChallanItem[]
  [key: string]: unknown
}

export interface DeliveryChallanItem {
  id?: string
  delivery_challan_id?: string
  material_id?: string
  material_name?: string
  unit?: string
  size?: string
  quantity?: number
  rate?: number
  amount?: number
  created_at?: string
  [key: string]: unknown
}

export interface QuotationHeader {
  id?: string
  quotation_no?: string
  client_id?: string
  project_id?: string
  billing_address?: string
  gstin?: string
  state?: string
  date?: string
  valid_till?: string
  payment_terms?: string
  contact_no?: string
  remarks?: string
  reference?: string
  subtotal?: number
  total_item_discount?: number
  extra_discount_percent?: number
  extra_discount_amount?: number
  total_tax?: number
  round_off?: number
  grand_total?: number
  status?: string
  negotiation_mode?: boolean
  revised_from_id?: string
  source_id?: string | null
  source_type?: string | null
  created_at?: string
  updated_at?: string
  client?: { id: string; client_name: string; gstin: string; state: string }
  project?: { id: string; project_name: string }
  items?: QuotationItem[]
  [key: string]: unknown
}

export interface QuotationItem {
  id?: string
  quotation_id?: string
  item_id?: string
  variant_id?: string
  description?: string
  qty?: number
  uom?: string
  rate?: number
  original_discount_percent?: number
  discount_percent?: number
  discount_amount?: number
  tax_percent?: number
  tax_amount?: number
  line_total?: number
  override_flag?: boolean
  created_at?: string
  [key: string]: unknown
}

export interface DiscountStructure {
  id?: string
  structure_number?: string
  structure_name?: string
  is_active?: boolean
  created_at?: string
  [key: string]: unknown
}

export interface DiscountVariantSetting {
  id?: string
  structure_id?: string
  variant_id?: string
  discount_percent?: number
  variant?: { variant_name?: string }
  [key: string]: unknown
}

export interface DocumentTemplate {
  id?: string
  document_type?: string
  template_name?: string
  template_content?: string
  is_default?: boolean
  active?: boolean
  created_at?: string
  [key: string]: unknown
}

export interface DCFilters {
  projectId?: string
  startDate?: string
  endDate?: string
  status?: string
  dc_type?: string
  organisation_id?: string
}

export interface QuotationFilters {
  clientId?: string
  projectId?: string
  status?: string
  startDate?: string
  endDate?: string
}

export interface InitResult {
  success: boolean
  message: string
}

export async function initializeDatabase(): Promise<InitResult> {
  const tables = [
    {
      name: 'projects',
      create: `
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          client_name VARCHAR(255),
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'materials',
      create: `
        CREATE TABLE IF NOT EXISTS materials (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          unit VARCHAR(50) NOT NULL,
          default_rate DECIMAL(10,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'delivery_challans',
      create: `
        CREATE TABLE IF NOT EXISTS delivery_challans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dc_number VARCHAR(50) UNIQUE NOT NULL,
          project_id UUID REFERENCES projects(id),
          dc_date DATE NOT NULL,
          client_name VARCHAR(255),
          site_address TEXT,
          vehicle_number VARCHAR(50),
          driver_name VARCHAR(100),
          dc_type VARCHAR(20) DEFAULT 'billable',
          remarks TEXT,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'delivery_challan_items',
      create: `
        CREATE TABLE IF NOT EXISTS delivery_challan_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          delivery_challan_id UUID REFERENCES delivery_challans(id) ON DELETE CASCADE,
          material_id UUID REFERENCES materials(id),
          material_name VARCHAR(255) NOT NULL,
          unit VARCHAR(50) NOT NULL,
          size VARCHAR(100),
          quantity DECIMAL(10,2) NOT NULL,
          rate DECIMAL(10,2),
          amount DECIMAL(10,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    }
  ];

  return { success: true, message: 'Database ready' };
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('project_name', { ascending: true });
  if (error) {
    const { data: fallback, error: err2 } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (err2) throw err2;
    return fallback as Project[];
  }
  return data as Project[];
}

export async function createProject(project: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function fetchMaterials(): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Material[];
}

export async function createMaterial(material: Partial<Material>): Promise<Material> {
  const { data, error } = await supabase
    .from('materials')
    .insert(material)
    .select()
    .single();
  if (error) throw error;
  return data as Material;
}

export async function fetchDeliveryChallans(filters: DCFilters = {}): Promise<DeliveryChallan[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('delivery_challans')
    .select(`
      *,
      project:projects(project_name),
      items:delivery_challan_items(*)
    `)
    .order('dc_date', { ascending: false });

  if (filters.organisation_id) {
    query = query.eq('organisation_id', filters.organisation_id);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.startDate) {
    query = query.gte('dc_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('dc_date', filters.endDate);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.dc_type) {
    query = query.eq('dc_type', filters.dc_type);
  }

  const { data, error } = await query;
  if (error) {
    const retryQuery = supabase
      .from('delivery_challans')
      .select(`
        *,
        project:projects(name),
        items:delivery_challan_items(*)
      `)
      .order('dc_date', { ascending: false });
    
    const { data: retryData, error: retryError } = await retryQuery;
    if (retryError) throw retryError;
    return retryData as DeliveryChallan[];
  }
  return data as DeliveryChallan[];
}

export async function fetchDeliveryChallanById(id: string): Promise<DeliveryChallan> {
  const { data, error } = await supabase
    .from('delivery_challans')
    .select(`
      *,
      project:projects(name),
      items:delivery_challan_items(*)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as DeliveryChallan;
}

export async function createDeliveryChallan(challan: Partial<DeliveryChallan>): Promise<DeliveryChallan> {
  const dcType = challan.dc_type || 'billable';
  const prefix = dcType === 'billable' ? 'DC-' : 'NBDC-';

  const { data: existingDCs } = await supabase
    .from('delivery_challans')
    .select('dc_number')
    .eq('dc_type', dcType)
    .order('dc_number', { ascending: false })
    .limit(1);
  
  let newDcNumber = `${prefix}0001`;
  if (existingDCs && existingDCs.length > 0) {
    const lastNumStr = existingDCs[0].dc_number.replace(prefix, '');
    const lastNum = parseInt(lastNumStr);
    if (!isNaN(lastNum)) {
      newDcNumber = `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
    }
  }

  const { data: challanData, error: challanError } = await supabase
    .from('delivery_challans')
    .insert({ ...challan, dc_number: newDcNumber, dc_type: dcType })
    .select()
    .single();
  
  if (challanError) throw challanError;
  return { ...challanData, dc_number: newDcNumber } as DeliveryChallan;
}

export async function updateDeliveryChallan(id: string, updates: Partial<DeliveryChallan>): Promise<DeliveryChallan> {
  const { data, error } = await supabase
    .from('delivery_challans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as DeliveryChallan;
}

export async function cancelDeliveryChallan(id: string, reason?: string): Promise<any> {
  // ADR-001: guarded cancel — restores stock exactly once, double-cancel raises,
  // draft cancels restore nothing. Legacy blind-restore RPC retired from this path.
  const { data, error } = await supabase.rpc('cancel_dc_atomic', {
    p_dc_id: id,
    p_reason: reason || null,
  });
  if (error) throw error;
  return data;
}

export async function deleteDeliveryChallan(id: string): Promise<{ success: boolean }> {
  // Fetch the current status so the UI can allow deletes for cancelled DCs
  // without tripping the DB delete guard (guardrails review pending).
  const { data: dc, error: dcError } = await supabase
    .from('delivery_challans')
    .select('id, status')
    .eq('id', id)
    .single();
  if (dcError) throw dcError;

  // Cancelled DCs are already dead-ended documents; normalize them to DRAFT
  // so the delete guard treats them the same as drafts. The guard keeps
  // blocking active/issued/historic rows.
  const rawStatus = String(dc?.status || '').trim().toUpperCase();
  if (dc && (rawStatus === 'CANCELLED' || rawStatus === 'CANCELED')) {
    const { data: updated, error: statusError } = await supabase
      .from('delivery_challans')
      .update({ status: 'DRAFT' })
      .eq('id', id)
      .select('id, status');
    if (statusError) throw statusError;
    if (!updated || updated.length === 0) {
      // No row was updated: the row is either gone or not visible to this
      // session (RLS). Refetch to distinguish, then proceed or throw.
      const { data: refetched } = await supabase
        .from('delivery_challans')
        .select('id, status')
        .eq('id', id)
        .single();
      if (refetched && String(refetched.status || '').trim().toUpperCase() !== 'DRAFT') {
        throw new Error('Cannot delete DC: status is not visible or update was blocked.');
      }
    }
  }

  const { error } = await supabase
    .from('delivery_challans')
    .delete()
    .eq('id', id);
  await supabase.from('approvals').delete().eq('reference_id', id);
  if (error) throw error;
  return { success: true };
}

export async function addDeliveryChallanItems(
  challanId: string,
  items: Partial<DeliveryChallanItem>[]
): Promise<DeliveryChallanItem[]> {
  const itemsWithChallanId = items.map(item => ({
    ...item,
    delivery_challan_id: challanId,
    amount: item.quantity && item.rate ? parseFloat(String(item.quantity)) * parseFloat(String(item.rate)) : 0
  }));

  const { data, error } = await supabase
    .from('delivery_challan_items')
    .insert(itemsWithChallanId)
    .select();
  if (error) throw error;
  return data as DeliveryChallanItem[];
}

export async function updateDeliveryChallanItems(
  challanId: string,
  items: Partial<DeliveryChallanItem>[]
): Promise<DeliveryChallanItem[]> {
  await supabase
    .from('delivery_challan_items')
    .delete()
    .eq('delivery_challan_id', challanId);

  const itemsWithChallanId = items.map(item => ({
    ...item,
    delivery_challan_id: challanId,
    amount: item.quantity && item.rate ? parseFloat(String(item.quantity)) * parseFloat(String(item.rate)) : 0
  }));

  const { data, error } = await supabase
    .from('delivery_challan_items')
    .insert(itemsWithChallanId)
    .select();
  if (error) throw error;
  return data as DeliveryChallanItem[];
}

export async function getConsolidationDateWise(filters: DCFilters = {}, orgId?: string): Promise<DeliveryChallan[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('delivery_challans')
    .select(`
      id,
      dc_number,
      dc_date,
      client_name,
      rate_source,
      items:delivery_challan_items(
        id,
        material_name,
        unit,
        size,
        quantity,
        rate,
        amount
      )
    `)
    .eq('status', 'active');

  if (orgId) {
    query = query.eq('organisation_id', orgId);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.startDate) {
    query = query.gte('dc_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('dc_date', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as DeliveryChallan[];
}

export async function getConsolidationMaterialWise(_filters: DCFilters = {}, orgId?: string): Promise<DeliveryChallanItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('delivery_challans')
    .select('id')
    .eq('status', 'active');

  if (orgId) {
    query = query.eq('organisation_id', orgId);
  }

  const { data: challans, error: challanError } = await query;

  if (challanError) throw challanError;

  const challanIds = challans?.map(c => c.id) || [];
  if (challanIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemsQuery: any = supabase
    .from('delivery_challan_items')
    .select(`
      *,
      delivery_challan:delivery_challans(dc_number, dc_date, client_name, rate_source)
    `)
    .in('delivery_challan_id', challanIds);

  const { data, error } = await itemsQuery;

  if (error) throw error;
  return data as DeliveryChallanItem[];
}

export async function fetchQuotations(filters: QuotationFilters = {}): Promise<QuotationHeader[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('quotation_header')
    .select(`
      *,
      client:clients(id, client_name, gstin, state),
      project:projects(id, project_name),
      items:quotation_items(*)
    `)
    .order('created_at', { ascending: false });

  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as QuotationHeader[];
}

export async function fetchQuotationById(id: string): Promise<QuotationHeader> {
  const { data, error } = await supabase
    .from('quotation_header')
    .select(`
      *,
      client:clients(*),
      project:projects(id, project_name, project_code),
      items:quotation_items(*)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as QuotationHeader;
}

export async function createQuotation(quotation: Partial<QuotationHeader> & { 
  items?: any[];
  status?: string;
  negotiation_mode?: boolean;
  extra_discount_percent?: number;
  extra_discount_amount?: number;
  round_off?: number;
  round_off_enabled?: boolean;
  include_erection_charges?: boolean;
  variant_discounts?: Record<string, number>;
  terms_conditions?: any;
  quotation_no?: string;
  series_config?: any;
}): Promise<any> {
  const { 
    items, status, negotiation_mode, extra_discount_percent, extra_discount_amount,
    round_off, round_off_enabled, include_erection_charges, variant_discounts,
    terms_conditions, quotation_no, series_config,
    ...rest 
  } = quotation;
  const { data, error } = await supabase.rpc('record_quotation', {
    p_organisation_id: rest.organisation_id,
    p_client_id: rest.client_id,
    p_project_id: rest.project_id || null,
    p_items: items || [],
    p_remarks: rest.remarks || null,
    p_payment_terms: rest.payment_terms || null,
    p_valid_till: rest.valid_till || null,
    p_billing_address: rest.billing_address || null,
    p_gstin: rest.gstin || null,
    p_state: rest.state || null,
    p_contact_no: rest.contact_no || null,
    p_reference: rest.reference || null,
    p_authorized_signatory_id: rest.authorized_signatory_id || null,
    p_revision_no: rest.revision_no || 1,
    p_revision_history: rest.revision_history || [],
    p_status: status || 'Draft',
    p_negotiation_mode: !!negotiation_mode,
    p_extra_discount_percent: extra_discount_percent || 0,
    p_extra_discount_amount: extra_discount_amount || 0,
    p_round_off: round_off || 0,
    p_round_off_enabled: round_off_enabled ?? true,
    p_include_erection_charges: !!include_erection_charges,
    p_variant_discounts: variant_discounts || {},
    p_terms_conditions: terms_conditions || null,
    p_quotation_no: quotation_no || null,
    p_series_config: series_config || null,
  });

  if (error) throw error;
  return data;
}

export async function updateQuotation(id: string, updates: Partial<QuotationHeader> & { 
  items?: any[];
  status?: string;
  negotiation_mode?: boolean;
  extra_discount_percent?: number;
  extra_discount_amount?: number;
  round_off?: number;
  round_off_enabled?: boolean;
  include_erection_charges?: boolean;
  variant_discounts?: Record<string, number>;
  terms_conditions?: any;
}): Promise<any> {
  const { 
    items, status, negotiation_mode, extra_discount_percent, extra_discount_amount,
    round_off, round_off_enabled, include_erection_charges, variant_discounts, terms_conditions,
    ...rest 
  } = updates;
  const { data, error } = await supabase.rpc('update_quotation', {
    p_quotation_id: id,
    p_organisation_id: rest.organisation_id,
    p_client_id: rest.client_id || null,
    p_project_id: rest.project_id || null,
    p_items: items || [],
    p_remarks: rest.remarks || null,
    p_payment_terms: rest.payment_terms || null,
    p_valid_till: rest.valid_till || null,
    p_billing_address: rest.billing_address || null,
    p_gstin: rest.gstin || null,
    p_state: rest.state || null,
    p_contact_no: rest.contact_no || null,
    p_reference: rest.reference || null,
    p_authorized_signatory_id: rest.authorized_signatory_id || null,
    p_revision_no: rest.revision_no || 1,
    p_revision_history: rest.revision_history || [],
    p_status: status || 'Draft',
    p_negotiation_mode: !!negotiation_mode,
    p_extra_discount_percent: extra_discount_percent || 0,
    p_extra_discount_amount: extra_discount_amount || 0,
    p_round_off: round_off || 0,
    p_round_off_enabled: round_off_enabled ?? true,
    p_include_erection_charges: !!include_erection_charges,
    p_variant_discounts: variant_discounts || {},
    p_terms_conditions: terms_conditions || null,
  });

  if (error) throw error;
  return data;
}

export async function deleteQuotation(id: string): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('quotation_header')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { success: true };
}

export async function createQuotationItems(
  quotationId: string,
  items: Partial<QuotationItem>[]
): Promise<any> {
  throw new Error('createQuotationItems is deprecated. Pass items directly to record_quotation or update_quotation RPC.');
}

export async function updateQuotationItems(
  quotationId: string,
  items: Partial<QuotationItem>[]
): Promise<any> {
  throw new Error('updateQuotationItems is deprecated. Pass items directly to update_quotation RPC.');
}

function calculateLineTotal(item: Partial<QuotationItem>): number {
  const qty = parseFloat(String(item.qty)) || 0;
  const rate = parseFloat(String(item.rate)) || 0;
  const gross = qty * rate;
  const discountPercent = parseFloat(String(item.discount_percent)) || 0;
  const discountAmount = (gross * discountPercent) / 100;
  const taxable = gross - discountAmount;
  const taxPercent = parseFloat(String(item.tax_percent)) || 0;
  const taxAmount = (taxable * taxPercent) / 100;
  return taxable + taxAmount;
}

export async function duplicateQuotation(id: string): Promise<QuotationHeader> {
  const original = await fetchQuotationById(id);
  if (!original) throw new Error('Original quotation not found');

  const formattedItems = (original.items || []).map((item) => ({
    item_id: item.item_id || null,
    variant_id: item.variant_id || null,
    description: item.description || '',
    qty: item.qty || 1,
    uom: item.uom || '',
    rate: item.rate || 0,
    discount_percent: item.discount_percent || 0,
    tax_percent: item.tax_percent || 18,
  }));

  const { data, error } = await supabase.rpc('record_quotation', {
    p_organisation_id: original.organisation_id,
    p_client_id: original.client_id,
    p_project_id: original.project_id || null,
    p_items: formattedItems,
    p_remarks: original.remarks || original.reference || null,
    p_payment_terms: original.payment_terms || null,
    p_valid_till: original.valid_till || null,
    p_billing_address: original.billing_address || null,
    p_gstin: original.gstin || null,
    p_state: original.state || null,
    p_contact_no: original.contact_no || null,
    p_reference: original.reference || null,
  });

  if (error) throw error;
  return fetchQuotationById(data.quotation_id);
}

export async function createQuotationFromDC(
  dcIds: string[],
  userId: string
): Promise<unknown> {
  try {
    const { data, error } = await supabase.rpc('create_quotation_from_dc', {
      p_dc_ids: dcIds,
      p_user_id: userId
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (err) {
    console.error('ERP API Error [QuotationFromDC]:', (err as Error).message);
    throw err;
  }
}

export async function fetchDiscountProfiles(): Promise<DiscountStructure[]> {
  const { data, error } = await supabase
    .from('discount_structures')
    .select('*')
    .eq('is_active', true)
    .order('structure_number');
  if (error) throw error;
  return data as DiscountStructure[];
}

export async function fetchDiscountProfileById(id: string): Promise<DiscountStructure> {
  const { data, error } = await supabase
    .from('discount_structures')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as DiscountStructure;
}

export async function fetchDiscountVariantSettings(profileId: string): Promise<DiscountVariantSetting[]> {
  const { data, error } = await supabase
    .from('discount_variant_settings')
    .select('*, variant:company_variants(variant_name)')
    .eq('structure_id', profileId);
  if (error) throw error;
  return data as DiscountVariantSetting[];
}

export async function updateClientPricingProfile(
  clientId: string,
  profileId: string
): Promise<{ id: string; discount_profile_id: string }> {
  const { data, error } = await supabase
    .from('clients')
    .update({ discount_profile_id: profileId })
    .eq('id', clientId)
    .select()
    .single();
  if (error) throw error;
  return data as { id: string; discount_profile_id: string };
}

export async function fetchTemplates(documentType: string): Promise<DocumentTemplate[]> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('document_type', documentType)
    .eq('active', true)
    .order('is_default', { ascending: false });

  if (error) throw error;
  return (data || []) as DocumentTemplate[];
}

export async function fetchTemplateById(id: string): Promise<DocumentTemplate> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as DocumentTemplate;
}

export async function getDefaultTemplate(documentType: string): Promise<DocumentTemplate | null> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('document_type', documentType)
    .eq('is_default', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as DocumentTemplate | null;
}

// Fetch project-specific rates for items
export async function getProjectRates(
  projectId: string,
  itemIds: string[]
): Promise<Record<string, number>> {
  if (!projectId || itemIds.length === 0) return {};

  const { data, error } = await supabase
    .from('project_rates')
    .select('item_id, rate')
    .eq('project_id', projectId)
    .in('item_id', itemIds);

  if (error) {
    console.error('Error fetching project rates:', error);
    return {};
  }

  const map: Record<string, number> = {};
  data?.forEach(r => {
    if (r.item_id && r.rate !== null && r.rate !== undefined) {
      map[r.item_id] = Number(r.rate);
    }
  });
  return map;
}
