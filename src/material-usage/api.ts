/**
 * API functions for material usage tracking
 */

import { supabase } from '../supabase';

// Types
export interface ProjectMaterialList {
  id: string;
  project_id: string;
  organisation_id: string;
  item_id: string;
  variant_id: string | null;
  planned_qty: number;
  unit: string;
  rate: number;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyMaterialUsage {
  id: string;
  project_id: string;
  organisation_id: string;
  usage_date: string;
  item_id: string;
  variant_id: string | null;
  quantity_used: number;
  unit: string;
  activity: string | null;
  logged_by: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialConsumptionSummary {
  id: string;
  project_id: string;
  organisation_id: string;
  item_id: string;
  variant_id: string | null;
  planned_qty: number;
  received_qty: number;
  used_qty: number;
  remaining_qty: number;
  variance_qty: number;
  unit: string;
  rate: number;
  planned_cost: number;
  actual_cost: number;
  cost_variance: number;
  last_updated: string;
}

// Project Material List API

export async function getProjectMaterialList(projectId: string) {
  const { data, error } = await supabase
    .from('project_material_list')
    .select(`
      *,
      materials (
        id,
        name,
        unit
      ),
      company_variants (
        id,
        variant_name
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function addMaterialToProjectList(material: {
  project_id: string;
  organisation_id: string;
  item_id: string;
  variant_id?: string;
  planned_qty: number;
  unit: string;
  rate: number;
  remarks?: string;
}) {
  const { data, error } = await supabase
    .from('project_material_list')
    .insert(material)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectMaterialList(
  id: string,
  updates: Partial<ProjectMaterialList>
) {
  const { data, error } = await supabase
    .from('project_material_list')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFromProjectMaterialList(id: string) {
  const { error } = await supabase
    .from('project_material_list')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Daily Material Usage API

export async function getDailyUsageByDate(projectId: string, date: string) {
  const { data, error } = await supabase
    .from('daily_material_usage')
    .select(`
      *,
      materials (
        id,
        name,
        display_name,
        item_code,
        unit
      ),
      company_variants (
        id,
        variant_name
      )
    `)
    .eq('project_id', projectId)
    .eq('usage_date', date)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getDailyUsageByProject(projectId: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from('daily_material_usage')
    .select(`
      *,
      materials (
        id,
        name,
        display_name,
        item_code,
        unit
      ),
      company_variants (
        id,
        variant_name
      )
    `)
    .eq('project_id', projectId);

  if (startDate) {
    query = query.gte('usage_date', startDate);
  }
  if (endDate) {
    query = query.lte('usage_date', endDate);
  }

  const { data, error } = await query.order('usage_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function logDailyUsage(usage: {
  project_id: string;
  organisation_id: string;
  usage_date: string;
  item_id: string;
  variant_id?: string;
  quantity_used: number;
  unit: string;
  activity?: string;
  remarks?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('daily_material_usage')
    .insert({
      ...usage,
      logged_by: user?.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDailyUsage(
  id: string,
  updates: Partial<DailyMaterialUsage>
) {
  const { data, error } = await supabase
    .from('daily_material_usage')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDailyUsage(id: string) {
  const { error } = await supabase
    .from('daily_material_usage')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Material Consumption Summary API

export async function getMaterialConsumptionSummary(projectId: string) {
  const { data, error } = await supabase
    .from('material_consumption_summary')
    .select(`
      *,
      materials (
        id,
        name,
        display_name,
        item_code,
        unit
      ),
      company_variants (
        id,
        variant_name
      )
    `)
    .eq('project_id', projectId)
    .order('last_updated', { ascending: false });

  if (error) throw error;
  return data;
}

export async function refreshConsumptionSummary(projectId: string) {
  // This function manually triggers the consumption summary update
  // by calling the database function
  const { data, error } = await supabase.rpc('update_material_consumption_summary', {
    p_project_id: projectId
  });

  if (error) throw error;
  return data;
}
