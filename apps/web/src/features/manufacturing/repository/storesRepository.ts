import * as P from '../persistence';
import { MaterialRequisition, MaterialRequisitionItem } from '../model/types';

export async function issueMaterialRequisitionAggregate(
  requisitionId: string,
  orgId: string,
  userId: string,
  userName: string
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

  for (const item of items) {
    const stockRow = await P.fetchItemStockSingle(item.material_id, mainStore.id, orgId);
    const available = stockRow?.current_stock || 0;
    if (available < item.issued_qty) {
      throw new Error(`Insufficient stock in Main Store for material ${item.materials?.name}. Needed: ${item.issued_qty}, Available: ${available}`);
    }
  }

  for (const item of items) {
    const mainStock = await P.fetchItemStockSingle(item.material_id, mainStore.id, orgId);
    if (mainStock) {
      await P.updateItemStock(mainStock.id!, Math.max(0, mainStock.current_stock - item.issued_qty));
    }

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

    await P.updateMaterialRequisitionItemQty(item.id!, {
      issued_qty: item.issued_qty,
      status: 'issued'
    });

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

  const updatedRequisition = await P.updateMaterialRequisition(requisitionId, {
    status: 'issued'
  });

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
    user_name: userName,
    organisation_id: orgId
  });

  return updatedRequisition;
}

export async function acceptGRN(grnId: string, orgId: string) {
  const { data, error } = await P.supabase.rpc('accept_grn', {
    p_grn_id: grnId,
    p_org_id: orgId,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Failed to accept GRN');
  return data;
}
