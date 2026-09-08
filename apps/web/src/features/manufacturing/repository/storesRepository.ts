import * as P from '../persistence';
import { supabase } from '../../../supabase';
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

  const itemsPayload = items.map(item => ({
    item_id: item.id,
    material_id: item.material_id,
    issued_qty: item.issued_qty > 0 ? item.issued_qty : item.required_qty,
  }));

  const { error: rpcError } = await supabase.rpc('issue_stores_requisition_atomic', {
    p_requisition_id: requisitionId,
    p_main_warehouse_id: mainStore.id,
    p_wip_warehouse_id: wip.id,
    p_items: itemsPayload,
  });

  if (rpcError) throw rpcError;

  const updatedRequisition = await P.fetchMaterialRequisitionById(requisitionId);

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

  return updatedRequisition || requisition;
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
