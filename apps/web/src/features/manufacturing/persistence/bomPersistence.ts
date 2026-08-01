import { supabase } from '../../../supabase';
import { BOMHeader, BOMItem } from '../model/types';

export async function fetchBOMHeaders(orgId: string, statusFilter?: 'active' | 'inactive' | 'all', search?: string) {
  let query = supabase.from('bom_headers').select('*').eq('organisation_id', orgId);
  if (statusFilter === 'active') {
    query = query.eq('is_active', true);
  } else if (statusFilter === 'inactive') {
    query = query.eq('is_active', false);
  }
  if (search) {
    query = query.or(`bom_code.ilike.%${search}%,product_name.ilike.%${search}%`);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchBOMHeaderById(bomId: string) {
  const { data, error } = await supabase.from('bom_headers').select('*').eq('id', bomId).single();
  if (error) throw error;
  return data as BOMHeader;
}

export async function fetchBOMItemsByHeaderId(bomId: string) {
  const { data, error } = await supabase
    .from('bom_items')
    .select('*, materials(name)')
    .eq('bom_id', bomId);
  if (error) throw error;
  return data || [];
}

export async function insertBOMHeader(header: Partial<BOMHeader>) {
  const { data, error } = await supabase.from('bom_headers').insert(header).select().single();
  if (error) throw error;
  return data as BOMHeader;
}

export async function updateBOMHeader(bomId: string, header: Partial<BOMHeader>) {
  const { data, error } = await supabase.from('bom_headers').update(header).eq('id', bomId).select().single();
  if (error) throw error;
  return data as BOMHeader;
}

export async function deleteBOMHeader(bomId: string) {
  const { error } = await supabase.from('bom_headers').delete().eq('id', bomId);
  if (error) throw error;
}

export async function deleteBOMItemsByHeaderId(bomId: string) {
  const { error } = await supabase.from('bom_items').delete().eq('bom_id', bomId);
  if (error) throw error;
}

export async function insertBOMItems(items: Partial<BOMItem>[]) {
  const { data, error } = await supabase.from('bom_items').insert(items);
  if (error) throw error;
  return data;
}

export async function checkBOMLinkedRecords(bomId: string) {
  const [jobCardsResult, schedulesResult] = await Promise.all([
    supabase.from('job_cards').select('id', { count: 'exact', head: true }).eq('bom_id', bomId),
    supabase.from('production_schedule_items').select('id', { count: 'exact', head: true }).eq('bom_id', bomId),
  ]);
  return {
    jobCardsCount: jobCardsResult.count ?? 0,
    schedulesCount: schedulesResult.count ?? 0,
  };
}
