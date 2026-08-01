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
  userId: string
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

  // 3. Verify that each item has sufficient stock in Finished Goods Warehouse
  for (const item of items) {
    const stockRow = await P.fetchItemStockSingle(item.material_id, fgWarehouse.id, orgId);
    const availableStock = stockRow?.current_stock || 0;
    if (availableStock < item.dispatched_qty) {
      throw new Error(
        `Insufficient stock in Finished Goods Warehouse for item ${item.materials?.name || 'material'}. ` +
        `Required: ${item.dispatched_qty} ${item.materials?.unit || ''}, Available: ${availableStock} ${item.materials?.unit || ''}`
      );
    }
  }

  // 4. Create Material Outward header record
  const outwardHeader = await P.insertMaterialOutward({
    outward_date: new Date().toISOString().split('T')[0],
    remarks: `Dispatch ${order.dispatch_no} to ${order.customer_name}`,
    organisation_id: orgId,
  });

  const outwardItemsPayload = [];

  // 5. Update stocks and format ledger outward items
  for (const item of items) {
    const qty = item.dispatched_qty;

    // Decrement Finished Goods stock
    const fgStockRow = await P.fetchItemStockSingle(item.material_id, fgWarehouse.id, orgId);
    if (fgStockRow) {
      await P.updateItemStock(fgStockRow.id!, Math.max(0, fgStockRow.current_stock - qty));
    }

    outwardItemsPayload.push({
      material_outward_id: outwardHeader.id!,
      material_id: item.material_id,
      qty,
      unit: item.unit,
      batch_no: item.batch_no || null,
      warehouse_id: fgWarehouse.id,
      organisation_id: orgId,
    });
  }

  // Insert outward logs
  if (outwardItemsPayload.length > 0) {
    await P.insertMaterialOutwardItems(outwardItemsPayload);
  }

  // 6. Update dispatch order status to dispatched
  const updatedOrder = await P.updateDispatchOrder(dispatchOrderId, {
    status: 'dispatched',
    actual_dispatch_date: new Date().toISOString().split('T')[0],
  });

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
    user_name: 'System User', // In real app, resolved from user profiles
    organisation_id: orgId,
  });

  return updatedOrder;
}
