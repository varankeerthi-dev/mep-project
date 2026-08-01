import * as P from '../persistence';
import { supabase } from '../../../supabase';
import { MaterialRequisition, MaterialRequisitionItem, GoodsReceiptNote, GRNItem } from '../model/types';

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
  const next = last ? parseInt(last.replace('GRN- ', '')) + 1 : 1;
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

export async function issueMaterialRequisitionAggregate(
  requisitionId: string,
  orgId: string,
  userId: string
) {
  const requisition = await P.fetchMaterialRequisitionById(requisitionId);
  if (!requisition) throw new Error('Requisition not found');
  if (requisition.status === 'issued') throw new Error('Requisition already issued');

  const items = await P.fetchMaterialRequisitionItems(requisitionId);
  if (items.length === 0) throw new Error('No items in the requisition');

  const warehouses = await P.fetchWarehouses(orgId);
  const mainStore = warehouses.find(w => w.warehouse_purpose === 'main' || w.is_default);
  const wip = warehouses.find(w => w.warehouse_purpose === 'wip') || warehouses.find(w => w.id !== mainStore?.id);

  if (!mainStore || !wip) {
    throw new Error('Required warehouses (Main Store / WIP) not found');
  }

  // 1. Verify stock is available in Main Store
  for (const item of items) {
    const stockRow = await P.fetchItemStockSingle(item.material_id, mainStore.id, orgId);
    const available = stockRow?.current_stock || 0;
    if (available < item.issued_qty) {
      throw new Error(`Insufficient stock in Main Store for material ${item.materials?.name}. Needed: ${item.issued_qty}, Available: ${available}`);
    }
  }

  // 2. Perform Stock Transfers & update statuses
  for (const item of items) {
    // Decrement Main Store stock
    const mainStock = await P.fetchItemStockSingle(item.material_id, mainStore.id, orgId);
    if (mainStock) {
      await P.updateItemStock(mainStock.id!, Math.max(0, mainStock.current_stock - item.issued_qty));
    }

    // Increment WIP stock
    const wipStock = await P.fetchItemStockSingle(item.material_id, wip.id, orgId);
    if (wipStock) {
      await P.updateItemStock(wipStock.id!, wipStock.current_stock + item.issued_qty);
    } else {
      await P.insertItemStock({
        item_id: item.material_id,
        warehouse_id: wip.id,
        current_stock: item.issued_qty,
        organisation_id: orgId
      });
    }

    // Update requisition item status
    await P.updateMaterialRequisitionItemQty(item.id!, {
      issued_qty: item.issued_qty,
      status: 'issued'
    });

    // Update original Job Card material
    if (requisition.job_card_id) {
      const jcMaterials = await P.fetchJobCardMaterials(requisition.job_card_id);
      const targetJcMaterial = jcMaterials.find(jcm => jcm.material_id === item.material_id);
      if (targetJcMaterial) {
        await P.updateJobCardMaterial(targetJcMaterial.id!, {
          issued_qty: (targetJcMaterial.issued_qty || 0) + item.issued_qty,
          status: 'issued'
        });
      }
    }
  }

  // 3. Log material outward
  const outwardHeader = await P.insertMaterialOutward({
    outward_date: new Date().toISOString().split('T')[0],
    remarks: `Material Requisition ${requisition.requisition_no} issued to production`,
    organisation_id: orgId,
  });

  const outwardItemsPayload = items.map(item => ({
    material_outward_id: outwardHeader.id!,
    material_id: item.material_id,
    qty: item.issued_qty,
    unit: item.unit,
    warehouse_id: mainStore.id,
    organisation_id: orgId
  }));

  if (outwardItemsPayload.length > 0) {
    await P.insertMaterialOutwardItems(outwardItemsPayload);
  }

  // 4. Update Requisition parent status
  const updatedRequisition = await P.updateMaterialRequisition(requisitionId, {
    status: 'issued'
  });

  // 5. Log activity
  await P.insertActivityLog({
    entity_type: 'material_requisition',
    entity_id: requisitionId,
    action: 'issued',
    action_details: {
      requisition_no: requisition.requisition_no,
      issued_items: items.map(item => ({
        material_id: item.material_id,
        qty: item.issued_qty
      }))
    },
    user_id: userId,
    user_name: 'Stores Officer',
    organisation_id: orgId
  });

  return updatedRequisition;
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
  userId: string
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

  // 1. Update stock in Main Store
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

    // Update grn item status
    await P.updateGRNItemQty(item.id!, {
      accepted_qty: qtyToAdd,
      status: 'accepted'
    });
  }

  // 2. Log material inward for auditing
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

  // 3. Update GRN status
  const updatedGrn = await P.updateGoodsReceiptNote(grnId, {
    status: 'accepted'
  });

  // 4. Log activity
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
    user_name: 'Stores Manager',
    organisation_id: orgId
  });

  return updatedGrn;
}
