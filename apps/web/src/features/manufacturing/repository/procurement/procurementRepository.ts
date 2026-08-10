import * as P from '../../persistence';
import { supabase } from '@/lib/supabase';
import { MaterialRequisition, MaterialRequisitionItem, GoodsReceiptNote, GRNItem } from '../../model/types';

export async function generateNextRequisitionNumber(orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from('material_requisitions')
    .select('requisition_no')
    .eq('organisation_id', orgId)
    .order('requisition_no', { ascending: false })
    .limit(1);

  if (error) throw error;
  const last = data?.[0]?.requisition_no;
  const next = last ? parseInt(last.replace('MR-', '')) + 1 : 1;
  return `MR-${String(next).padStart(4, '0')}`;
}

export async function generateNextGRNNumber(orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from('goods_receipt_notes')
    .select('grn_no')
    .eq('organisation_id', orgId)
    .order('grn_no', { ascending: false })
    .limit(1);

  if (error) throw error;
  const last = data?.[0]?.grn_no;
  const next = last ? parseInt(last.replace('GRN-', '')) + 1 : 1;
  return `GRN-${String(next).padStart(4, '0')}`;
}

export async function createMaterialRequisitionAggregate(
  requisition: Omit<MaterialRequisition, 'id' | 'requisition_no' | 'created_at' | 'updated_at'>,
  items: Omit<MaterialRequisitionItem, 'id' | 'requisition_id' | 'created_at'>[],
  orgId: string
) {
  const code = await generateNextRequisitionNumber(orgId);
  const createdRequisition = await P.insertMaterialRequisition({
    ...requisition,
    requisition_no: code,
    organisation_id: orgId
  });

  const itemsPayload = items.map(item => ({
    ...item,
    requisition_id: createdRequisition.id!,
    organisation_id: orgId
  }));

  const createdItems = await P.insertMaterialRequisitionItems(itemsPayload);

  return {
    requisition: createdRequisition,
    items: createdItems
  };
}

export async function createGoodsReceiptNoteAggregate(
  grn: Omit<GoodsReceiptNote, 'id' | 'grn_no' | 'created_at' | 'updated_at'>,
  items: Omit<GRNItem, 'id' | 'grn_id' | 'created_at'>[],
  orgId: string
) {
  const code = await generateNextGRNNumber(orgId);
  const createdGrn = await P.insertGoodsReceiptNote({
    ...grn,
    grn_no: code,
    organisation_id: orgId
  });

  const itemsPayload = items.map(item => ({
    ...item,
    grn_id: createdGrn.id!,
    organisation_id: orgId
  }));

  const createdItems = await P.insertGRNItems(itemsPayload);

  return {
    grn: createdGrn,
    items: createdItems
  };
}

export async function confirmGRNAcceptanceAggregate(
  grnId: string,
  orgId: string,
  userId: string,
  userName: string
) {
  const grn = await P.fetchGoodsReceiptNoteById(grnId);
  if (!grn) throw new Error('GRN not found');
  if (grn.status === 'accepted') throw new Error('GRN already accepted');

  const items = await P.fetchGRNItems(grnId);
  if (items.length === 0) throw new Error('No items in the GRN');

  const warehouses = await P.fetchWarehouses(orgId);
  const mainStore = warehouses.find(w => w.warehouse_purpose === 'main' || w.is_default);

  if (!mainStore) {
    throw new Error('Main Store warehouse not found');
  }

  for (const item of items) {
    const qtyToAdd = item.accepted_qty > 0 ? item.accepted_qty : item.received_qty;

    const mainStock = await P.fetchItemStockSingle(item.material_id, mainStore.id, orgId);
    if (mainStock) {
      await P.updateItemStock(mainStock.id!, mainStock.current_stock + qtyToAdd);
    } else {
      await P.insertItemStock({
        item_id: item.material_id,
        warehouse_id: mainStore.id,
        current_stock: qtyToAdd,
        organisation_id: orgId
      });
    }

    await P.updateGRNItemQty(item.id!, {
      accepted_qty: qtyToAdd,
      status: 'accepted'
    });
  }

  const inwardHeader = await P.insertMaterialInward({
    inward_date: new Date().toISOString().split('T')[0],
    remarks: `GRN ${grn.grn_no} — raw goods received and inwarded`,
    organisation_id: orgId
  });

  const inwardItemsPayload = items.map(item => ({
    material_inward_id: inwardHeader.id!,
    material_id: item.material_id,
    qty: item.accepted_qty > 0 ? item.accepted_qty : item.received_qty,
    unit: item.unit,
    warehouse_id: mainStore.id,
    organisation_id: orgId
  }));

  if (inwardItemsPayload.length > 0) {
    await P.insertMaterialInwardItems(inwardItemsPayload);
  }

  const updatedGrn = await P.updateGoodsReceiptNote(grnId, {
    status: 'accepted'
  });

  await P.insertActivityLog({
    entity_type: 'goods_receipt_note',
    entity_id: grnId,
    action: 'accepted',
    action_details: {
      grn_no: grn.grn_no,
      inwarded_items: items.map(item => ({
        material_id: item.material_id,
        qty: item.accepted_qty > 0 ? item.accepted_qty : item.received_qty
      }))
    },
    user_id: userId,
    user_name: userName,
    organisation_id: orgId
  });

  return updatedGrn;
}
