import { supabase } from '../../../supabase';
import { DispatchOrder, DispatchItem, DispatchPacking, DispatchCountVerification } from '../model/types';

export async function fetchDispatchOrders(orgId: string, status?: string) {
  let query = supabase
    .from('dispatch_orders')
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as DispatchOrder[];
}

export async function fetchDispatchOrderById(id: string) {
  const { data, error } = await supabase
    .from('dispatch_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as DispatchOrder;
}

export async function fetchDispatchItems(dispatchOrderId: string) {
  const { data, error } = await supabase
    .from('dispatch_items')
    .select(`
      *,
      materials:material_id (
        name,
        unit
      )
    `)
    .eq('dispatch_order_id', dispatchOrderId);

  if (error) throw error;
  return data as (DispatchItem & { materials?: { name: string; unit: string } | null })[];
}

export async function fetchDispatchPacking(dispatchOrderId: string) {
  const { data, error } = await supabase
    .from('dispatch_packing')
    .select('*')
    .eq('dispatch_order_id', dispatchOrderId)
    .order('carton_number', { ascending: true });

  if (error) throw error;
  return data as DispatchPacking[];
}

export async function fetchDispatchCountVerifications(dispatchOrderId: string) {
  const { data, error } = await supabase
    .from('dispatch_count_verification')
    .select(`
      *,
      materials:material_id (
        name,
        unit
      )
    `)
    .eq('dispatch_order_id', dispatchOrderId);

  if (error) throw error;
  return data as (DispatchCountVerification & { materials?: { name: string; unit: string } | null })[];
}

export async function insertDispatchOrder(order: Omit<DispatchOrder, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('dispatch_orders')
    .insert([order])
    .select()
    .single();

  if (error) throw error;
  return data as DispatchOrder;
}

export async function updateDispatchOrder(id: string, updates: Partial<DispatchOrder>) {
  const { data, error } = await supabase
    .from('dispatch_orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DispatchOrder;
}

export async function insertDispatchItems(items: Omit<DispatchItem, 'id' | 'created_at'>[]) {
  const { data, error } = await supabase
    .from('dispatch_items')
    .insert(items)
    .select();

  if (error) throw error;
  return data as DispatchItem[];
}

export async function updateDispatchItemQty(id: string, qtyUpdates: Partial<Pick<DispatchItem, 'picked_qty' | 'packed_qty' | 'dispatched_qty' | 'status'>>) {
  const { data, error } = await supabase
    .from('dispatch_items')
    .update(qtyUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DispatchItem;
}

export async function insertDispatchPacking(packing: Omit<DispatchPacking, 'id' | 'created_at'>[]) {
  const { data, error } = await supabase
    .from('dispatch_packing')
    .insert(packing)
    .select();

  if (error) throw error;
  return data as DispatchPacking[];
}

export async function deleteDispatchPacking(dispatchOrderId: string) {
  const { error } = await supabase
    .from('dispatch_packing')
    .delete()
    .eq('dispatch_order_id', dispatchOrderId);

  if (error) throw error;
}

export async function upsertDispatchCountVerification(verifications: Omit<DispatchCountVerification, 'id' | 'created_at'>[]) {
  const { data, error } = await supabase
    .from('dispatch_count_verification')
    .upsert(verifications, { onConflict: 'dispatch_order_id,material_id' })
    .select();

  if (error) throw error;
  return data as DispatchCountVerification[];
}
