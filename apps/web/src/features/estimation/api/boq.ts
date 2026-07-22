import { supabase } from '@/supabase';
import type { BOQHeaderInput, BOQSectionInput, BOQItemInput } from '../model';

const TABLE = {
  headers: 'est_boq_headers',
  sections: 'est_boq_sections',
  items: 'est_boq_items',
};

export type BOQFilterParams = {
  search?: string;
  status?: string;
  organisation_id: string;
};

export async function listBOQs(filters: BOQFilterParams) {
  let query = supabase
    .from(TABLE.headers)
    .select('*, client:clients(id, client_name), project:projects(id, project_name)')
    .eq('organisation_id', filters.organisation_id)
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.search) {
    query = query.or(`boq_no.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getBOQById(id: string) {
  const { data, error } = await supabase
    .from(TABLE.headers)
    .select('*, client:clients(id, client_name), project:projects(id, project_name)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getBOQWithSections(id: string) {
  const header = await getBOQById(id);
  const sections = await listSections(id);
  const sectionsWithItems = await Promise.all(
    sections.map(async (s) => ({
      ...s,
      items: await listItems(s.id!),
    }))
  );
  return { ...header, sections: sectionsWithItems };
}

export async function createBOQ(input: BOQHeaderInput) {
  const { data, error } = await supabase
    .from(TABLE.headers)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBOQ(id: string, input: Partial<BOQHeaderInput>) {
  const { data, error } = await supabase
    .from(TABLE.headers)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBOQ(id: string) {
  const { error } = await supabase.from(TABLE.headers).delete().eq('id', id);
  if (error) throw error;
}

export async function generateBOQNumber(orgId: string) {
  try {
    const { data, error } = await supabase.rpc('generate_est_boq_number', { org_id: orgId });
    if (error) throw error;
    if (data) return data as string;
  } catch {
    // RPC not available, fallback
  }
  try {
    const { data: existing } = await supabase
      .from('est_boq_headers')
      .select('boq_no')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1);
    const lastNum = existing?.[0]?.boq_no || 'BOQ-0000';
    const num = parseInt(lastNum.replace('BOQ-', '')) || 0;
    return `BOQ-${String(num + 1).padStart(4, '0')}`;
  } catch {
    return `BOQ-${String(Date.now()).slice(-4)}`;
  }
}

export async function getPriceMap(variantId?: string) {
  const [variantPrices, allPrices] = await Promise.all([
    variantId
      ? supabase
          .from('item_variant_pricing')
          .select('item_id, sale_price, make')
          .eq('company_variant_id', variantId)
          .eq('is_active', true)
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('item_variant_pricing')
      .select('item_id, sale_price, make, company_variant_id')
      .eq('is_active', true),
  ]);
  const map = new Map<string, number>();
  (allPrices.data || []).forEach((p: any) => {
    map.set(`${p.item_id}__${p.company_variant_id}__${p.make || ''}`, parseFloat(p.sale_price) || 0);
  });
  return map;
}

export async function getClientDiscountProfile(clientId: string) {
  const { data: client } = await supabase
    .from('clients')
    .select('id, discount_profile_id, custom_discounts')
    .eq('id', clientId)
    .single();
  if (!client) return { discountMap: {}, variantDiscounts: {} };
  if (client.discount_profile_id) {
    const { data: settings } = await supabase
      .from('discount_variant_settings')
      .select('variant_id, max_discount, variant:company_variants(variant_name)')
      .eq('structure_id', client.discount_profile_id);
    const map: Record<string, { discount: number; variantName: string }> = {};
    (settings || []).forEach((s: any) => {
      if (!s.variant_id) return;
      map[s.variant_id] = { discount: s.max_discount || 0, variantName: s.variant?.variant_name || '' };
    });
    return { discountMap: map, variantDiscounts: {} };
  }
  if (client.custom_discounts && typeof client.custom_discounts === 'object') {
    const map: Record<string, { discount: number; variantName: string }> = {};
    Object.entries(client.custom_discounts).forEach(([variantId, discount]) => {
      map[variantId] = {
        discount: typeof discount === 'number' ? discount : parseFloat(String(discount)) || 0,
        variantName: '',
      };
    });
    return { discountMap: map, variantDiscounts: {} };
  }
  return { discountMap: {}, variantDiscounts: {} };
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export async function listSections(boqId: string) {
  const { data, error } = await supabase
    .from(TABLE.sections)
    .select('*')
    .eq('boq_id', boqId)
    .order('section_order');
  if (error) throw error;
  return data || [];
}

export async function createSection(input: BOQSectionInput) {
  const { data, error } = await supabase
    .from(TABLE.sections)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSection(id: string, input: Partial<BOQSectionInput>) {
  const { data, error } = await supabase
    .from(TABLE.sections)
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSection(id: string) {
  const { error } = await supabase.from(TABLE.sections).delete().eq('id', id);
  if (error) throw error;
}

// ─── Items ─────────────────────────────────────────────────────────────────────

export async function listItems(sectionId: string) {
  const { data, error } = await supabase
    .from(TABLE.items)
    .select('*')
    .eq('section_id', sectionId)
    .order('item_order');
  if (error) throw error;
  return data || [];
}

export async function listAllItems(boqId: string) {
  const sections = await listSections(boqId);
  const sectionIds = sections.map((s) => s.id).filter(Boolean) as string[];
  if (sectionIds.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLE.items)
    .select('*, section:est_boq_sections(id, name)')
    .in('section_id', sectionIds)
    .order('item_order');
  if (error) throw error;
  return data || [];
}

export async function createItem(input: BOQItemInput) {
  const { data, error } = await supabase
    .from(TABLE.items)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createItems(inputs: BOQItemInput[]) {
  if (inputs.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLE.items)
    .insert(inputs)
    .select();
  if (error) throw error;
  return data || [];
}

export async function replaceSectionItems(sectionId: string, inputs: BOQItemInput[]) {
  await supabase.from(TABLE.items).delete().eq('section_id', sectionId);
  if (inputs.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLE.items)
    .insert(inputs.map((item, i) => ({ ...item, section_id: sectionId, item_order: i + 1 })))
    .select();
  if (error) throw error;
  return data || [];
}

export async function updateItem(id: string, input: Partial<BOQItemInput>) {
  const { data, error } = await supabase
    .from(TABLE.items)
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from(TABLE.items).delete().eq('id', id);
  if (error) throw error;
}
