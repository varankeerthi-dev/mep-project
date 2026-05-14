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
  is_boq: boolean;
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

export async function getProjectMaterialList(projectId: string, organisationId?: string) {
  let query = supabase
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
    .eq('project_id', projectId);

  if (organisationId) query = query.eq('organisation_id', organisationId);

  const { data, error } = await query.order('created_at', { ascending: true });

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

// Check if material exists in BOQ for a project
export async function checkMaterialInBOQ(projectId: string, itemId: string, variantId: string | null = null) {
  let query = supabase
    .from('project_material_list')
    .select('id')
    .eq('project_id', projectId)
    .eq('item_id', itemId)
    .eq('is_boq', true);

  if (variantId) {
    query = query.eq('variant_id', variantId);
  } else {
    query = query.is('variant_id', null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data !== null;
}

// Add material as non-BOQ item
export async function addNonBOQMaterial(material: {
  project_id: string;
  organisation_id: string;
  item_id: string;
  variant_id?: string;
  unit: string;
  rate?: number;
  remarks?: string;
}) {
  const { data, error } = await supabase
    .from('project_material_list')
    .insert({
      ...material,
      planned_qty: 0,
      is_boq: false,
      rate: material.rate || null  // Allow null rate for non-BOQ items
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Daily Material Usage API

export async function getDailyUsageByDate(projectId: string, date: string) {
  // Use SECURITY DEFINER function to bypass RLS issues
  const { data, error } = await supabase.rpc('get_daily_usage_by_date', {
    p_project_id: projectId,
    p_usage_date: date
  });

  if (error) {
    console.error('getDailyUsageByDate RPC error:', error);
    // Fallback to direct query
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('daily_material_usage')
      .select('*')
      .eq('project_id', projectId)
      .eq('usage_date', date)
      .order('created_at', { ascending: true });
    if (fallbackError) throw fallbackError;
    return fallbackData || [];
  }
  return data || [];
}

export async function getDailyUsageByProject(projectId: string, startDate?: string, endDate?: string) {
  // Use SECURITY DEFINER function to bypass RLS issues
  const { data, error } = await supabase.rpc('get_daily_usage_by_project', {
    p_project_id: projectId
  });

  if (error) {
    console.error('getDailyUsageByProject RPC error:', error);
    // Fallback
    let query = supabase
      .from('daily_material_usage')
      .select('*')
      .eq('project_id', projectId);

    if (startDate) query = query.gte('usage_date', startDate);
    if (endDate) query = query.lte('usage_date', endDate);

    const { data: fallbackData, error: fallbackError } = await query.order('usage_date', { ascending: false });
    if (fallbackError) throw fallbackError;
    return fallbackData || [];
  }

  let result = data || [];
  if (startDate) result = result.filter((r: any) => r.usage_date >= startDate);
  if (endDate) result = result.filter((r: any) => r.usage_date <= endDate);
  return result;
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
  const { error, data } = await supabase.rpc('log_daily_usage', {
    p_project_id: usage.project_id,
    p_organisation_id: usage.organisation_id,
    p_usage_date: usage.usage_date,
    p_item_id: usage.item_id,
    p_variant_id: usage.variant_id || null,
    p_quantity_used: usage.quantity_used,
    p_unit: usage.unit,
    p_activity: usage.activity || null,
    p_remarks: usage.remarks || null
  });

  if (error) throw error;
  return data;
}

export async function logDailyUsageBatch(
  projectId: string,
  organisationId: string,
  usageDate: string,
  items: Array<{
    item_id: string;
    variant_id?: string;
    quantity_used: number;
    unit: string;
    activity?: string;
    remarks?: string;
  }>
) {
  const { data, error } = await supabase.rpc('log_daily_usage_batch', {
    p_project_id: projectId,
    p_organisation_id: organisationId,
    p_usage_date: usageDate,
    p_items: items.map(item => ({
      item_id: item.item_id,
      variant_id: item.variant_id || null,
      quantity_used: item.quantity_used,
      unit: item.unit,
      activity: item.activity || null,
      remarks: item.remarks || null,
    }))
  });

  if (error) throw error;
  return data;
}

export async function updateDailyUsage(
  id: string,
  updates: Partial<DailyMaterialUsage>,
  organisationId?: string
) {
  let query = supabase
    .from('daily_material_usage')
    .update(updates)
    .eq('id', id);

  if (organisationId) query = query.eq('organisation_id', organisationId);

  const { data, error } = await query.select().single();

  if (error) throw error;
  return data;
}

export async function deleteDailyUsage(id: string, organisationId?: string) {
  let query = supabase
    .from('daily_material_usage')
    .delete()
    .eq('id', id);

  if (organisationId) query = query.eq('organisation_id', organisationId);

  const { error } = await query;

  if (error) throw error;
}

// Material Consumption Summary API

export async function getMaterialConsumptionSummary(projectId: string, organisationId?: string) {
  let query = supabase
    .from('material_consumption_summary')
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
    .eq('project_id', projectId);

  if (organisationId) query = query.eq('organisation_id', organisationId);

  const { data, error } = await query.order('last_updated', { ascending: false });

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
