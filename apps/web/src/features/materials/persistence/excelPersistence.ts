// @ts-nocheck
import { supabase } from '../../../supabase';

export async function bulkUpdatePrices(
  updates: { id: string; sale_price: number | null; purchase_price: number | null }[]
) {
  const nowIso = new Date().toISOString();
  const results: { success: boolean; id: string; error?: string }[] = [];

  for (const { id, sale_price, purchase_price } of updates) {
    try {
      const { error } = await supabase
        .from('materials')
        .update({
          sale_price,
          purchase_price,
          updated_at: nowIso,
        })
        .eq('id', id);
      if (error) throw error;
      results.push({ success: true, id });
    } catch (err: any) {
      results.push({ success: false, id, error: err.message });
    }
  }

  return results;
}
