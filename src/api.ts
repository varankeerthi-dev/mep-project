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

export interface Material {
  id?: string
  name?: string
  unit?: string
  default_rate?: number
  created_at?: string
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

export interface BOQHeader {
  id?: string
  boq_no?: string
  revision_no?: number
  boq_date?: string
  client_id?: string
  project_id?: string
  variant_id?: string
  status?: string
  terms_conditions?: string
  preface?: string
  created_at?: string
  updated_at?: string
  client?: { id: string; client_name: string }
  project?: { id: string; project_name: string }
  sheets?: BOQSheet[]
  [key: string]: unknown
}

export interface BOQSheet {
  id?: string
  boq_header_id?: string
  sheet_name?: string
  sheet_order?: number
  is_default?: boolean
  items?: BOQItem[]
  [key: string]: unknown
}

export interface BOQItem {
  id?: string
  boq_sheet_id?: string
  row_order?: number
  is_header_row?: boolean
  header_text?: string
  item_id?: string
  variant_id?: string
  make?: string
  quantity?: number
  rate?: number
  discount_percent?: number
  specification?: string
  remarks?: string
  pressure?: string
  thickness?: string
  schedule?: string
  material?: string
  updated_at?: string
  [key: string]: unknown
}

export interface DCFilters {
  projectId?: string
  startDate?: string
  endDate?: string
  status?: string
  dc_type?: string
}

export interface QuotationFilters {
  clientId?: string
  projectId?: string
  status?: string
  startDate?: string
  endDate?: string
}

export interface BOQFilters {
  clientId?: string
  projectId?: string
  status?: string
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
  let query: ReturnType<SupabaseClient['from']> = supabase
    .from('delivery_challans')
    .select(`
      *,
      project:projects(project_name),
      items:delivery_challan_items(*)
    `)
    .order('dc_date', { ascending: false });

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

export async function deleteDeliveryChallan(id: string): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('delivery_challans')
    .delete()
    .eq('id', id);
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
  let query: ReturnType<SupabaseClient['from']> = supabase
    .from('delivery_challans')
    .select(`
      id,
      dc_number,
      dc_date,
      client_name,
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
  let query: ReturnType<SupabaseClient['from']> = supabase
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

  const itemsQuery: ReturnType<SupabaseClient['from']> = supabase
    .from('delivery_challan_items')
    .select(`
      *,
      delivery_challan:delivery_challans(dc_number, dc_date, client_name)
    `)
    .in('delivery_challan_id', challanIds);

  const { data, error } = await itemsQuery;

  if (error) throw error;
  return data as DeliveryChallanItem[];
}

export async function fetchQuotations(filters: QuotationFilters = {}): Promise<QuotationHeader[]> {
  let query: ReturnType<SupabaseClient['from']> = supabase
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

export async function createQuotation(quotation: Partial<QuotationHeader>): Promise<QuotationHeader> {
  const { data: existing } = await supabase
    .from('quotation_header')
    .select('quotation_no')
    .order('created_at', { ascending: false })
    .limit(1);
  
  let quotationNo = 'QT-0001';
  if (existing && existing.length > 0) {
    const lastNum = parseInt(existing[0].quotation_no.replace(/[^0-9]/g, ''));
    quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
  }

  const { data, error } = await supabase
    .from('quotation_header')
    .insert({ ...quotation, quotation_no: quotationNo })
    .select()
    .single();
  
  if (error) throw error;
  return data as QuotationHeader;
}

export async function updateQuotation(id: string, updates: Partial<QuotationHeader>): Promise<QuotationHeader> {
  const { data, error } = await supabase
    .from('quotation_header')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as QuotationHeader;
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
): Promise<QuotationItem[]> {
  const itemsWithQuotationId = items.map(item => ({
    ...item,
    quotation_id: quotationId,
    line_total: calculateLineTotal(item)
  }));

  const { data, error } = await supabase
    .from('quotation_items')
    .insert(itemsWithQuotationId)
    .select();
  
  if (error) throw error;
  return data as QuotationItem[];
}

export async function updateQuotationItems(
  quotationId: string,
  items: Partial<QuotationItem>[]
): Promise<QuotationItem[]> {
  await supabase
    .from('quotation_items')
    .delete()
    .eq('quotation_id', quotationId);

  const itemsWithQuotationId = items.map(item => ({
    ...item,
    quotation_id: quotationId,
    line_total: calculateLineTotal(item)
  }));

  const { data, error } = await supabase
    .from('quotation_items')
    .insert(itemsWithQuotationId)
    .select();
  
  if (error) throw error;
  return data as QuotationItem[];
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
  
  const { data: existing } = await supabase
    .from('quotation_header')
    .select('quotation_no')
    .order('created_at', { ascending: false })
    .limit(1);
  
  let quotationNo = 'QT-0001';
  if (existing && existing.length > 0) {
    const lastNum = parseInt(existing[0].quotation_no.replace(/[^0-9]/g, ''));
    quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
  }

  const newQuotation = {
    quotation_no: quotationNo,
    client_id: original.client_id,
    project_id: original.project_id,
    billing_address: original.billing_address,
    gstin: original.gstin,
    state: original.state,
    date: new Date().toISOString().split('T')[0],
    valid_till: original.valid_till,
    payment_terms: original.payment_terms,
    contact_no: original.contact_no || null,
    remarks: original.remarks || original.reference || null,
    reference: original.reference,
    subtotal: original.subtotal,
    total_item_discount: original.total_item_discount,
    extra_discount_percent: original.extra_discount_percent,
    extra_discount_amount: original.extra_discount_amount,
    total_tax: original.total_tax,
    round_off: original.round_off,
    grand_total: original.grand_total,
    status: 'Draft',
    negotiation_mode: false,
    revised_from_id: id
  };

  const { data, error } = await supabase
    .from('quotation_header')
    .insert(newQuotation)
    .select()
    .single();
  
  if (error) throw error;

  if (original.items && original.items.length > 0) {
    const itemsToInsert = original.items.map(item => ({
      quotation_id: data.id,
      item_id: item.item_id,
      variant_id: item.variant_id,
      description: item.description,
      qty: item.qty,
      uom: item.uom,
      rate: item.rate,
      original_discount_percent: item.original_discount_percent,
      discount_percent: item.discount_percent,
      discount_amount: item.discount_amount,
      tax_percent: item.tax_percent,
      tax_amount: item.tax_amount,
      line_total: item.line_total,
      override_flag: false
    }));

    await supabase.from('quotation_items').insert(itemsToInsert);
  }

  return data as QuotationHeader;
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

export async function fetchBOQList(filters: BOQFilters = {}): Promise<BOQHeader[]> {
  let query: ReturnType<SupabaseClient['from']> = supabase
    .from('boq_headers')
    .select(`
      *,
      client:clients(id, client_name),
      project:projects(id, project_name),
      sheets:boq_sheets(*)
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

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as BOQHeader[];
}

export async function fetchBOQById(id: string): Promise<BOQHeader> {
  const { data: header, error } = await supabase
    .from('boq_headers')
    .select(`
      *,
      client:clients(*),
      project:projects(*),
      sheets:boq_sheets(*, items:boq_items(*))
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return header as BOQHeader;
}

export async function createBOQ(boq: Partial<BOQHeader>): Promise<BOQHeader> {
  const { data: header, error } = await supabase
    .from('boq_headers')
    .insert(boq)
    .select()
    .single();

  if (error) throw error;
  return header as BOQHeader;
}

export async function updateBOQ(id: string, updates: Partial<BOQHeader>): Promise<BOQHeader> {
  const { data, error } = await supabase
    .from('boq_headers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as BOQHeader;
}

export async function deleteBOQ(id: string): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('boq_headers')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function createBOQSheets(
  boqHeaderId: string,
  sheets: Partial<BOQSheet>[]
): Promise<BOQSheet[]> {
  const sheetsWithHeaderId = sheets.map((sheet, index) => ({
    ...sheet,
    boq_header_id: boqHeaderId,
    sheet_order: index + 1
  }));

  const { data, error } = await supabase
    .from('boq_sheets')
    .insert(sheetsWithHeaderId)
    .select();

  if (error) throw error;
  return data as BOQSheet[];
}

export async function updateBOQItems(
  boqSheetId: string,
  items: Partial<BOQItem>[]
): Promise<BOQItem[]> {
  await supabase
    .from('boq_items')
    .delete()
    .eq('boq_sheet_id', boqSheetId);

  const itemsWithSheetId = items.map((item, index) => {
    const description = item.description || '';
    const material = item.material || description || null;
    const specification = item.specification || '';
    return {
      boq_sheet_id: boqSheetId,
      row_order: index + 1,
      is_header_row: !!item.is_header_row,
      header_text: item.header_text || null,
      item_id: item.item_id || null,
      variant_id: item.variant_id || null,
      make: item.make || null,
      quantity: item.quantity || 0,
      rate: item.rate || 0,
      discount_percent: item.discount_percent || 0,
      specification: specification || null,
      remarks: item.remarks || null,
      pressure: item.pressure || null,
      thickness: item.thickness || null,
      schedule: item.schedule || null,
      material,
      updated_at: new Date().toISOString()
    };
  }).filter(item => !item.is_header_row || item.header_text);

  if (itemsWithSheetId.length > 0) {
    const { data, error } = await supabase
      .from('boq_items')
      .insert(itemsWithSheetId)
      .select();
    if (error) throw error;
    return data as BOQItem[];
  }
  return [];
}

export interface BOQData {
  id?: string
  boqNo: string
  revisionNo?: number
  date: string
  clientId?: string
  projectId?: string
  variantId?: string
  status?: string
  termsConditions?: string
  preface?: string
}

export interface SheetData {
  id?: string
  name: string
  isDefault?: boolean
}

export interface BOQItemData {
  description?: string
  material?: string
  specification?: string
  isHeaderRow?: boolean
  headerText?: string
  itemId?: string
  variantId?: string
  make?: string
  quantity?: number
  rate?: number
  discountPercent?: number
  remarks?: string
  pressure?: string
  thickness?: string
  schedule?: string
}

export async function saveBOQ(boqData: BOQData): Promise<string> {
  const { id, boqNo, revisionNo, date, clientId, projectId, variantId, status, termsConditions, preface } = boqData;

  let headerId = id;
  const safeClientId = clientId || null;
  const safeProjectId = projectId || null;
  const safeVariantId = variantId || null;

  if (!id) {
    const header = await createBOQ({
      boq_no: boqNo,
      revision_no: revisionNo || 1,
      boq_date: date,
      client_id: safeClientId,
      project_id: safeProjectId,
      variant_id: safeVariantId,
      status: status || 'Draft',
      terms_conditions: termsConditions,
      preface: preface
    });
    headerId = header.id;
  } else {
    await updateBOQ(id, {
      boq_no: boqNo,
      revision_no: revisionNo,
      boq_date: date,
      client_id: safeClientId,
      project_id: safeProjectId,
      variant_id: safeVariantId,
      status: status,
      terms_conditions: termsConditions,
      preface: preface
    });
  }

  return headerId as string;
}

export async function saveBOQWithItems(
  boqData: BOQData,
  sheets: SheetData[],
  itemsMap: Record<string, BOQItemData[]>
): Promise<string> {
  const headerId = await saveBOQ(boqData);
  const isUuid = (value: string | undefined): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));

  // OPTIMIZED: Process sheets in parallel batches
  const sheetOperations = sheets.map(async (sheet, index) => {
    if (!sheet.id || sheet.id.startsWith('temp-') || !isUuid(sheet.id)) {
      const newSheet = {
        boq_header_id: headerId,
        sheet_name: sheet.name,
        sheet_order: index + 1,
        is_default: sheet.isDefault || false
      };
      const { data: createdSheet } = await supabase
        .from('boq_sheets')
        .insert(newSheet)
        .select()
        .single();
      
      if (createdSheet && itemsMap[sheet.id || '']) {
        await updateBOQItems(createdSheet.id, itemsMap[sheet.id || '']);
      }
      return createdSheet;
    } else if (itemsMap[sheet.id]) {
      await updateBOQItems(sheet.id, itemsMap[sheet.id]);
    }
    return null;
  });

  await Promise.all(sheetOperations);
  return headerId;
}
