import { supabase } from '../../../supabase';
import { JobCard, JobCardMaterial } from '../model/types';

export async function fetchJobCards(orgId: string, statusFilters?: string[]) {
  let query = supabase.from('job_cards').select('*').eq('organisation_id', orgId);
  if (statusFilters && statusFilters.length > 0) {
    query = query.in('status', statusFilters);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchJobCardById(id: string) {
  const { data, error } = await supabase.from('job_cards').select('*, bom_headers!inner(product_id)').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function fetchJobCardMaterials(jobCardId: string) {
  const { data, error } = await supabase
    .from('job_card_materials')
    .select('*, materials(name, unit)')
    .eq('job_card_id', jobCardId);
  if (error) throw error;
  return data || [];
}

export async function insertJobCard(jobCard: Partial<JobCard>) {
  const { data, error } = await supabase.from('job_cards').insert(jobCard).select().single();
  if (error) throw error;
  return data as JobCard;
}

export async function updateJobCard(id: string, updates: Partial<JobCard>) {
  const { data, error } = await supabase.from('job_cards').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as JobCard;
}

export async function insertJobCardMaterials(materials: Partial<JobCardMaterial>[]) {
  const { data, error } = await supabase.from('job_card_materials').insert(materials);
  if (error) throw error;
  return data;
}

export async function updateJobCardMaterial(id: string, updates: Partial<JobCardMaterial>) {
  const { data, error } = await supabase.from('job_card_materials').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as JobCardMaterial;
}

export async function fetchFinishedGoods(orgId: string) {
  const { data, error } = await supabase
    .from('materials')
    .select('id, name, item_code')
    .eq('organisation_id', orgId)
    .eq('item_classification', 'finished_good')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchRawMaterialsForBom(orgId: string) {
  const { data, error } = await supabase
    .from('materials')
    .select('id, name, unit, make, uses_variant')
    .eq('organisation_id', orgId)
    .eq('item_classification', 'raw_material')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchCompanyVariants(orgId: string) {
  const { data, error } = await supabase
    .from('company_variants')
    .select('id, variant_name')
    .eq('organisation_id', orgId)
    .eq('is_active', true);
  if (error) throw error;
  return data || [];
}

export async function fetchItemVariantPricing(orgId: string) {
  const { data: mats } = await supabase
    .from('materials')
    .select('id')
    .eq('organisation_id', orgId)
    .eq('item_classification', 'raw_material');
  const ids = (mats || []).map(m => m.id);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('item_variant_pricing')
    .select('item_id, company_variant_id')
    .in('item_id', ids);
  if (error) throw error;
  return data || [];
}

export async function deleteJobCardAndMaterials(id: string) {
  await supabase.from('job_card_materials').delete().eq('job_card_id', id);
  const { error } = await supabase.from('job_cards').delete().eq('id', id);
  if (error) throw error;
}
