import { supabase } from '../supabase';

export type StockActionResult = {
  item_id: string;
  warehouse_id: string;
  qty: number;
  previous_stock: number;
  new_stock: number;
};

export async function adjustCNStock(
  cnId: string,
  orgId: string,
  items: Array<{
    material_id?: string;
    warehouse_id?: string;
    quantity: number;
  }>,
  action: 'restore' | 'deduct'
): Promise<StockActionResult[]> {
  const results: StockActionResult[] = [];

  for (const item of items) {
    if (!item.material_id || !item.warehouse_id) continue;

    const qtyChange = action === 'restore' ? item.quantity : -item.quantity;

    const { data: rpcRes, error: rpcError } = await supabase.rpc('adjust_item_stock', {
      p_item_id: item.material_id,
      p_warehouse_id: item.warehouse_id,
      p_quantity_change: qtyChange,
      p_movement_type: 'CREDIT_NOTE_RETURN',
      p_reference: cnId || 'CREDIT_NOTE',
      p_remarks: `Credit note ${action} for CN ${cnId}`,
      p_project_id: null,
    });

    if (rpcError) {
      console.error('Stock adjustment error via RPC:', rpcError);
      continue;
    }

    const resObj = rpcRes as any;
    results.push({
      item_id: item.material_id,
      warehouse_id: item.warehouse_id,
      qty: item.quantity,
      previous_stock: resObj?.previous_stock ?? 0,
      new_stock: resObj?.new_stock ?? 0,
    });
  }

  return results;
}

export async function reverseCNStock(
  orgId: string,
  items: Array<{
    material_id?: string;
    warehouse_id?: string;
    quantity: number;
  }>,
  previousAction: 'restore' | 'deduct'
): Promise<StockActionResult[]> {
  const reverseAction = previousAction === 'restore' ? 'deduct' : 'restore';
  return adjustCNStock('', orgId, items, reverseAction);
}
