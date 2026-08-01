import { supabase } from '../../../supabase';
import { ProductionPlan, ProductionPlanItem } from '../model/types';

export async function fetchProductionPlans(orgId: string, status?: string) {
  let query = supabase
    .from('production_plans')
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ProductionPlan[];
}

export async function fetchProductionPlanById(id: string) {
  const { data, error } = await supabase
    .from('production_plans')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as ProductionPlan;
}

export async function fetchProductionPlanItems(planId: string) {
  const { data, error } = await supabase
    .from('production_plan_items')
    .select(`
      *,
      materials:product_id (
        name,
        unit
      )
    `)
    .eq('plan_id', planId);

  if (error) throw error;
  return data as (ProductionPlanItem & { materials?: { name: string; unit: string } | null })[];
}

export async function insertProductionPlan(plan: Omit<ProductionPlan, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('production_plans')
    .insert([plan])
    .select()
    .single();

  if (error) throw error;
  return data as ProductionPlan;
}

export async function insertProductionPlanItems(items: Omit<ProductionPlanItem, 'id' | 'created_at'>[]) {
  const { data, error } = await supabase
    .from('production_plan_items')
    .insert(items)
    .select();

  if (error) throw error;
  return data as ProductionPlanItem[];
}

export async function updateProductionPlan(id: string, updates: Partial<ProductionPlan>) {
  const { data, error } = await supabase
    .from('production_plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProductionPlan;
}

export async function updateProductionPlanItem(id: string, updates: Partial<ProductionPlanItem>) {
  const { data, error } = await supabase
    .from('production_plan_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProductionPlanItem;
}

// Fetch open Sales Orders containing materials to Net against
export async function fetchOpenSalesOrders(orgId: string) {
  // Query sales_orders and nested items that are not fully delivered/dispatched
  const { data, error } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_no,
      customer_name,
      delivery_date,
      status,
      sales_order_items (
        id,
        material_id,
        quantity,
        delivered_qty,
        materials:material_id (
          name,
          unit
        )
      )
    `)
    .eq('organisation_id', orgId)
    .neq('status', 'fulfilled')
    .neq('status', 'cancelled');

  if (error) throw error;
  return data || [];
}

export async function insertSalesOrderProductionLink(links: { sales_order_item_id: string; job_card_id: string; allocated_qty: number; organisation_id: string }[]) {
  const { data, error } = await supabase
    .from('sales_order_production_link')
    .insert(links)
    .select();

  if (error) throw error;
  return data;
}
