import { supabase } from '../../../supabase';
import { ItemStock, Warehouse } from '../model/types';

export async function fetchWarehouses(orgId: string) {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name, warehouse_code, warehouse_purpose, is_default')
    .eq('organisation_id', orgId)
    .eq('is_active', true);
  if (error) {
    // If warehouse_purpose doesn't exist, fallback to is_default checking
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('warehouses')
      .select('id, name, warehouse_code, is_default')
      .eq('organisation_id', orgId)
      .eq('is_active', true);
    if (fallbackError) throw fallbackError;
    return (fallbackData || []).map((w: any) => ({
      ...w,
      warehouse_purpose: w.is_default ? 'main' : 'general',
      is_active: true,
    })) as Warehouse[];
  }
  return data as Warehouse[];
}

export async function fetchStockByMaterials(materialIds: string[], orgId: string) {
  if (materialIds.length === 0) return [];
  const { data, error } = await supabase
    .from('item_stock')
    .select('id, item_id, company_variant_id, current_stock, warehouse_id')
    .eq('organisation_id', orgId)
    .in('item_id', materialIds);
  if (error) {
    // Try fetching without organisation filter if it fails (legacy support)
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('item_stock')
      .select('id, item_id, company_variant_id, current_stock, warehouse_id')
      .in('item_id', materialIds);
    if (fallbackError) throw fallbackError;
    return fallbackData || [];
  }
  return data || [];
}

export async function fetchItemStockSingle(itemId: string, warehouseId: string, orgId: string) {
  const { data, error } = await supabase
    .from('item_stock')
    .select('id, current_stock')
    .eq('item_id', itemId)
    .eq('warehouse_id', warehouseId)
    .eq('organisation_id', orgId)
    .maybeSingle();
  if (error) {
    // Try without organization filter as fallback
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('item_stock')
      .select('id, current_stock')
      .eq('item_id', itemId)
      .eq('warehouse_id', warehouseId)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    return fallbackData;
  }
  return data;
}

export async function updateItemStock(id: string, currentStock: number) {
  const { error } = await supabase
    .from('item_stock')
    .update({ current_stock: currentStock, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function insertItemStock(stock: Partial<ItemStock>) {
  const { data, error } = await supabase.from('item_stock').insert(stock).select().single();
  if (error) throw error;
  return data;
}

export async function insertMaterialOutward(outward: { outward_date: string; remarks: string; organisation_id: string }) {
  const { data, error } = await supabase
    .from('material_outward')
    .insert(outward)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertMaterialOutwardItems(items: { outward_id: string; material_name: string; quantity: number; unit: string; material_id: string; warehouse_id: string; organisation_id: string }[]) {
  const { data, error } = await supabase.from('material_outward_items').insert(items);
  if (error) throw error;
  return data;
}

export async function insertMaterialInward(inward: { inward_date: string; vendor_name: string; remarks: string; organisation_id: string; supply_type: string }) {
  const { data, error } = await supabase
    .from('material_inward')
    .insert(inward)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertMaterialInwardItems(items: { inward_id: string; material_name: string; quantity: number; unit: string; material_id: string; warehouse_id: string; organisation_id: string }[]) {
  const { data, error } = await supabase.from('material_inward_items').insert(items);
  if (error) throw error;
  return data;
}
