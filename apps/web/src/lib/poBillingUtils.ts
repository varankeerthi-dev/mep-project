/**
 * Utility functions for updating PO line item billing after invoice/proforma save.
 *
 * After an invoice or proforma is finalized, call `updatePoLineItemBilling` with
 * the items that reference PO line items (via meta_json.po_line_item_id).
 *
 * This function:
 * 1. Increments `billed_qty` and `billed_amount` on the `po_line_items` table
 * 2. Logs any over-billing to the `billing_overage_log` table
 */

import { supabase } from '../supabase';

interface PoBillingItem {
  po_line_item_id: string;
  po_id?: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  original_qty?: number;
  original_rate?: number;
  overbilling_reason?: {
    reason: string;
    reference?: string;
    approved_by?: string;
  };
}

interface UpdatePoBillingParams {
  organisationId: string;
  sourceType: 'invoice' | 'proforma';
  sourceId: string;
  sourceNumber?: string;
  items: PoBillingItem[];
}

export async function updatePoLineItemBilling(params: UpdatePoBillingParams): Promise<void> {
  const { organisationId, sourceType, sourceId, sourceNumber, items } = params;

  // Filter items that reference a PO line item
  const poItems = items.filter(item => item.po_line_item_id);
  if (poItems.length === 0) return;

  // First, get the PO line items to know their original values
  const poLineItemIds = poItems.map(item => item.po_line_item_id);
  const { data: poLineItems, error: fetchError } = await supabase
    .from('po_line_items')
    .select('id, po_id, quantity, rate_per_unit, billed_qty, billed_amount, description')
    .in('id', poLineItemIds);

  if (fetchError) {
    console.error('Failed to fetch PO line items for billing update:', fetchError);
    return;
  }

  const poLineItemMap = new Map((poLineItems ?? []).map(li => [li.id, li]));

  for (const item of poItems) {
    const poLineItem = poLineItemMap.get(item.po_line_item_id);
    if (!poLineItem) {
      console.warn(`PO line item ${item.po_line_item_id} not found, skipping billing update`);
      continue;
    }

    const poId = item.po_id || poLineItem.po_id;

    // 1. Update billed_qty and billed_amount on the PO line item
    const { error: updateError } = await supabase
      .rpc('update_po_line_item_billed', {
        p_line_item_id: item.po_line_item_id,
        p_qty: item.qty,
        p_amount: item.amount,
      });

    if (updateError) {
      console.error(`Failed to update billed_qty for PO line item ${item.po_line_item_id}:`, updateError);
    }

    // 2. Check if overbilling and log it
    const originalQty = item.original_qty ?? poLineItem.quantity;
    const originalRate = item.original_rate ?? poLineItem.rate_per_unit;
    const isOverage = item.qty > originalQty || item.rate > originalRate;

    if (isOverage && item.overbilling_reason?.reason) {
      const overageQty = Math.max(0, item.qty - originalQty);

      const { error: logError } = await supabase
        .rpc('insert_billing_overage_log', {
          p_organisation_id: organisationId,
          p_po_line_item_id: item.po_line_item_id,
          p_po_id: poId,
          p_source_type: sourceType,
          p_source_id: sourceId,
          p_source_number: sourceNumber ?? null,
          p_item_description: item.description || poLineItem.description,
          p_original_qty: originalQty,
          p_billed_qty: item.qty,
          p_overage_qty: overageQty,
          p_original_rate: originalRate,
          p_billed_rate: item.rate,
          p_reason: item.overbilling_reason.reason,
          p_reference: item.overbilling_reason.reference ?? null,
          p_approved_by: item.overbilling_reason.approved_by ?? null,
        });

      if (logError) {
        console.error(`Failed to log billing overage for PO line item ${item.po_line_item_id}:`, logError);
      }
    }
  }

  // 3. Recalculate PO header's utilized/available values
  // After updating billed_qty on individual line items, refresh the PO header
  if (poItems.length > 0) {
    const firstItem = poLineItemMap.get(poItems[0].po_line_item_id);
    const poId = poItems[0].po_id || firstItem?.po_id;
    if (poId) {
      // Sum up all line item billed_amounts to update PO header
      const { data: lineItemsData } = await supabase
        .from('po_line_items')
        .select('id, billed_qty, billed_amount, amount')
        .eq('po_id', poId);

      if (lineItemsData) {
        const totalBilledAmount = lineItemsData.reduce(
          (sum, li) => sum + Number(li.billed_amount || 0),
          0
        );
        const poTotalValue = lineItemsData.reduce(
          (sum, li) => sum + Number(li.amount || 0),
          0
        );

        await supabase
          .from('client_purchase_orders')
          .update({
            po_utilized_value: totalBilledAmount,
            po_available_value: Math.max(0, poTotalValue - totalBilledAmount),
            updated_at: new Date().toISOString(),
          })
          .eq('id', poId);
      }
    }
  }
}

/**
 * Extract PO billing items from invoice items (meta_json.po_line_item_id).
 */
export function extractInvoicePoItems(items: any[]): PoBillingItem[] {
  return items
    .filter(item => item.meta_json?.po_line_item_id)
    .map(item => ({
      po_line_item_id: item.meta_json.po_line_item_id,
      po_id: item.meta_json.po_id,
      description: item.description || '',
      qty: Number(item.qty) || 0,
      rate: Number(item.rate) || 0,
      amount: Number(item.amount) || 0,
      original_qty: item.meta_json?.original_quantity
        ? Number(item.meta_json.original_quantity)
        : undefined,
      original_rate: item.meta_json?.base_rate
        ? Number(item.meta_json.base_rate)
        : undefined,
      overbilling_reason: item.meta_json?.overbilling_reason,
    }));
}

