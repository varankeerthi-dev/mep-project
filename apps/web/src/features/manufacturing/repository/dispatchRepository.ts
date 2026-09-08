import * as P from '../persistence';
import { supabase } from '../../../supabase';
import { DispatchOrder, DispatchItem } from '../model/types';

export async function generateNextDispatchNumber(orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from('dispatch_orders')
    .select('dispatch_no')
    .eq('organisation_id', orgId)
    .order('dispatch_no', { ascending: false })
    .limit(1);

  if (error) throw error;
  const last = data?.[0]?.dispatch_no;
  const next = last ? parseInt(last.replace('DO-', '')) + 1 : 1;
  return `DO-${String(next).padStart(4, '0')}`;
}

export async function createDispatchOrderAggregate(
  order: Omit<DispatchOrder, 'id' | 'dispatch_no' | 'created_at' | 'updated_at'>,
  items: Omit<DispatchItem, 'id' | 'dispatch_order_id' | 'created_at'>[],
  orgId: string
) {
  // 1. Generate dispatch number
  const dispatchNo = await generateNextDispatchNumber(orgId);

  // 2. Create parent dispatch order
  const createdOrder = await P.insertDispatchOrder({
    ...order,
    dispatch_no: dispatchNo,
    organisation_id: orgId,
  });

  // 3. Create items linked to the dispatch order
  const itemsPayload = items.map((item) => ({
    ...item,
    dispatch_order_id: createdOrder.id!,
    organisation_id: orgId,
  }));

  const createdItems = await P.insertDispatchItems(itemsPayload);

  return {
    order: createdOrder,
    items: createdItems,
  };
}

export async function confirmDispatchAggregate(
  dispatchOrderId: string,
  orgId: string,
  userId: string,
  userName: string
) {
  // 1. Load dispatch order and items
  const order = await P.fetchDispatchOrderById(dispatchOrderId);
  if (!order) {
    throw new Error('Dispatch order not found');
  }
  if (order.status === 'dispatched') {
    throw new Error('Dispatch order is already confirmed and dispatched');
  }
  if (order.status === 'cancelled') {
    throw new Error('Cannot confirm a cancelled dispatch order');
  }

  const items = await P.fetchDispatchItems(dispatchOrderId);
  if (items.length === 0) {
    throw new Error('No items in the dispatch order');
  }

  // 2. Find Finished Goods (FG) Warehouse
  const warehouses = await P.fetchWarehouses(orgId);
  const fgWarehouse = warehouses.find((w) => w.warehouse_purpose === 'fg') || warehouses.find((w) => w.is_default);
  if (!fgWarehouse) {
    throw new Error('Finished Goods (FG) Warehouse or default store not found');
  }

  const itemsPayload = items.map(item => ({
    material_id: item.material_id,
    variant_id: null,
    dispatched_qty: item.dispatched_qty,
  }));

  const { error: rpcError } = await supabase.rpc('dispatch_manufacturing_order_atomic', {
    p_dispatch_order_id: dispatchOrderId,
    p_fg_warehouse_id: fgWarehouse.id,
    p_items: itemsPayload,
  });

  if (rpcError) throw rpcError;

  const updatedOrder = await P.fetchDispatchOrderById(dispatchOrderId);

  // 7. Insert to Activity Log
  await P.insertActivityLog({
    entity_type: 'dispatch_order',
    entity_id: dispatchOrderId,
    action: 'confirm_dispatch',
    action_details: {
      dispatch_no: order.dispatch_no,
      dispatched_items: items.map((item) => ({
        material_id: item.material_id,
        qty: item.dispatched_qty,
      })),
    },
    user_id: userId,
    user_name: userName,
    organisation_id: orgId,
  });

  return updatedOrder;
}
