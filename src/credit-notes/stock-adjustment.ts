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

    const { data: stockRec, error: stockError } = await supabase
      .from('item_stock')
      .select('id, current_stock')
      .eq('item_id', item.material_id)
      .eq('warehouse_id', item.warehouse_id)
      .eq('organisation_id', orgId)
      .single();

    if (stockError && stockError.code !== 'PGRST116') {
      console.error('Stock lookup error:', stockError);
      continue;
    }

    const currentStock = stockRec?.current_stock ?? 0;
    const newStock = action === 'restore'
      ? currentStock + item.quantity
      : Math.max(0, currentStock - item.quantity);

    if (stockRec) {
      const { error: updateError } = await supabase
        .from('item_stock')
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', stockRec.id);

      if (updateError) {
        console.error('Stock update error:', updateError);
        continue;
      }
    } else {
      const { error: insertError } = await supabase
        .from('item_stock')
        .insert({
          item_id: item.material_id,
          warehouse_id: item.warehouse_id,
          organisation_id: orgId,
          current_stock: newStock,
        });

      if (insertError) {
        console.error('Stock insert error:', insertError);
        continue;
      }
    }

    results.push({
      item_id: item.material_id,
      warehouse_id: item.warehouse_id,
      qty: item.quantity,
      previous_stock: currentStock,
      new_stock,
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
