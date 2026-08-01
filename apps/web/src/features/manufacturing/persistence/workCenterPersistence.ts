import { supabase } from '../../../supabase';
import { WorkCenter, BomWorkCenter } from '../model/types';

export async function fetchWorkCenters(orgId: string) {
  const { data, error } = await supabase
    .from('work_centers')
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as WorkCenter[];
}

export async function fetchWorkCenterById(id: string) {
  const { data, error } = await supabase
    .from('work_centers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as WorkCenter;
}

export async function insertWorkCenter(wc: Omit<WorkCenter, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('work_centers')
    .insert([wc])
    .select()
    .single();

  if (error) throw error;
  return data as WorkCenter;
}

export async function updateWorkCenter(id: string, updates: Partial<WorkCenter>) {
  const { data, error } = await supabase
    .from('work_centers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as WorkCenter;
}

export async function fetchBomWorkCenters(bomId: string) {
  const { data, error } = await supabase
    .from('bom_work_centers')
    .select(`
      *,
      work_center:work_center_id (
        name,
        code,
        capacity_per_hour,
        capacity_uom
      )
    `)
    .eq('bom_id', bomId);

  if (error) throw error;
  return data as (BomWorkCenter & { work_center?: { name: string; code: string; capacity_per_hour: number; capacity_uom: string } | null })[];
}

export async function insertBomWorkCenter(mapping: Omit<BomWorkCenter, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('bom_work_centers')
    .insert([mapping])
    .select()
    .single();

  if (error) throw error;
  return data as BomWorkCenter;
}

export async function deleteBomWorkCenter(id: string) {
  const { error } = await supabase
    .from('bom_work_centers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
