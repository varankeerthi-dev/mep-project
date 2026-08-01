import { supabase } from '../../../supabase';
import { ProductionEntry, ProductionEntryItem, ActivityLog } from '../model/types';

export async function fetchProductionEntries(jobCardId?: string, orgId?: string) {
  let query = supabase.from('production_entries').select('*, production_entry_items(*)');
  if (jobCardId) {
    query = query.eq('job_card_id', jobCardId);
  }
  if (orgId) {
    query = query.eq('organisation_id', orgId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchProductionEntryById(id: string) {
  const { data, error } = await supabase.from('production_entries').select('*, production_entry_items(*)').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function fetchProductionEntryItems(entryId: string) {
  const { data, error } = await supabase
    .from('production_entry_items')
    .select('*, materials(name, unit, id)')
    .eq('production_entry_id', entryId);
  if (error) throw error;
  return data || [];
}

export async function insertProductionEntry(entry: Partial<ProductionEntry>) {
  const { data, error } = await supabase.from('production_entries').insert(entry).select().single();
  if (error) throw error;
  return data as ProductionEntry;
}

export async function updateProductionEntry(id: string, updates: Partial<ProductionEntry>) {
  const { data, error } = await supabase.from('production_entries').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as ProductionEntry;
}

export async function deleteProductionEntry(id: string) {
  const { error } = await supabase.from('production_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function insertProductionEntryItems(items: Partial<ProductionEntryItem>[]) {
  const { data, error } = await supabase.from('production_entry_items').insert(items);
  if (error) throw error;
  return data;
}

export async function deleteProductionEntryItems(entryId: string) {
  const { error } = await supabase.from('production_entry_items').delete().eq('production_entry_id', entryId);
  if (error) throw error;
}

export async function insertActivityLog(log: Partial<ActivityLog>) {
  const { data, error } = await supabase.from('manufacturing_activity_log').insert(log);
  if (error) throw error;
  return data;
}

export async function fetchActivityLogs(orgId: string) {
  const { data, error } = await supabase
    .from('manufacturing_activity_log')
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}
