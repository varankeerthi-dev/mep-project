import * as P from '../persistence';
import { supabase } from '../../../supabase';
import { FGQCInspection, QCParameterResult } from '../model/types';

export async function generateNextQCInspectionNumber(orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from('fg_qc_inspections')
    .select('inspection_no')
    .eq('organisation_id', orgId)
    .order('inspection_no', { ascending: false })
    .limit(1);

  if (error) throw error;
  const last = data?.[0]?.inspection_no;
  const next = last ? parseInt(last.replace('FQC-', '')) + 1 : 1;
  return `FQC-${String(next).padStart(4, '0')}`;
}

export async function createFGQCInspectionAggregate(
  inspection: Omit<FGQCInspection, 'id' | 'inspection_no' | 'created_at' | 'updated_at'>,
  results: Omit<QCParameterResult, 'id' | 'inspection_id' | 'created_at'>[],
  orgId: string,
  userId: string,
  userName: string
) {
  // 1. Generate inspection number
  const inspectionNo = await generateNextQCInspectionNumber(orgId);

  // 2. Insert parent inspection record
  const createdInspection = await P.insertFGQCInspection({
    ...inspection,
    inspection_no: inspectionNo,
    organisation_id: orgId,
  });

  const inspectionId = createdInspection.id!;

  // 3. Insert parameter results linked to inspection
  if (results.length > 0) {
    const resultsPayload = results.map(r => ({
      ...r,
      inspection_id: inspectionId
    }));
    await P.insertQCParameterResults(resultsPayload);
  }

  // 4. Update warehouses stocks based on counts
  const warehouses = await P.fetchWarehouses(orgId);

  // FG Warehouse
  const fgWh = warehouses.find(w => w.warehouse_purpose === 'fg') || warehouses.find(w => w.is_default);
  if (!fgWh) {
    throw new Error('Finished Goods (FG) Warehouse or default store not found');
  }

  // Rejection Warehouse
  let rejectionWh = warehouses.find(w => w.warehouse_purpose === 'rejection');
  if (!rejectionWh) {
    // Dynamically create a rejection warehouse for the organisation
    const { data: newWh, error: newWhErr } = await supabase
      .from('warehouses')
      .select('*')
      .eq('organisation_id', orgId)
      .eq('warehouse_purpose', 'rejection')
      .maybeSingle();

    if (newWhErr) throw newWhErr;

    if (newWh) {
      rejectionWh = newWh;
    } else {
      const { data: createdWh, error: createWhErr } = await supabase
        .from('warehouses')
        .insert([{
          name: 'QC Rejection Store',
          warehouse_code: 'REJ-01',
          warehouse_purpose: 'rejection',
          organisation_id: orgId,
          is_active: true
        }])
        .select()
        .single();
      if (createWhErr) throw createWhErr;
      rejectionWh = createdWh;
    }
  }

  // WIP Warehouse
  const wipWh = warehouses.find(w => w.warehouse_purpose === 'wip') || warehouses.find(w => w.id !== fgWh.id);
  if (!wipWh) {
    throw new Error('WIP Warehouse not found');
  }

  // A. Process accepted_qty -> FG Warehouse
  if (createdInspection.accepted_qty > 0) {
    const fgStockRow = await P.fetchItemStockSingle(createdInspection.product_id, fgWh.id, orgId);
    if (fgStockRow) {
      await P.updateItemStock(fgStockRow.id!, fgStockRow.current_stock + createdInspection.accepted_qty);
    } else {
      await P.insertItemStock({
        item_id: createdInspection.product_id,
        warehouse_id: fgWh.id,
        current_stock: createdInspection.accepted_qty,
        organisation_id: orgId
      });
    }

    // Log material inward for audit trail
    const inwardHeader = await P.insertMaterialInward({
      inward_date: createdInspection.inspection_date,
      remarks: `QC Inspection ${inspectionNo} — finished goods accepted`,
      organisation_id: orgId,
    });

    await P.insertMaterialInwardItems([{
      material_inward_id: inwardHeader.id!,
      material_id: createdInspection.product_id,
      qty: createdInspection.accepted_qty,
      unit: 'Nos', // Default fallback unit
      warehouse_id: fgWh.id,
      organisation_id: orgId
    }]);
  }

  // B. Process rejected_qty -> Rejection Warehouse
  if (createdInspection.rejected_qty > 0 && rejectionWh) {
    const rejStockRow = await P.fetchItemStockSingle(createdInspection.product_id, rejectionWh.id, orgId);
    if (rejStockRow) {
      await P.updateItemStock(rejStockRow.id!, rejStockRow.current_stock + createdInspection.rejected_qty);
    } else {
      await P.insertItemStock({
        item_id: createdInspection.product_id,
        warehouse_id: rejectionWh.id,
        current_stock: createdInspection.rejected_qty,
        organisation_id: orgId
      });
    }
  }

  // C. Process rework_qty -> WIP Warehouse
  if (createdInspection.rework_qty > 0) {
    const wipStockRow = await P.fetchItemStockSingle(createdInspection.product_id, wipWh.id, orgId);
    if (wipStockRow) {
      await P.updateItemStock(wipStockRow.id!, wipStockRow.current_stock + createdInspection.rework_qty);
    } else {
      await P.insertItemStock({
        item_id: createdInspection.product_id,
        warehouse_id: wipWh.id,
        current_stock: createdInspection.rework_qty,
        organisation_id: orgId
      });
    }
  }

  // 5. Log activity
  await P.insertActivityLog({
    entity_type: 'fg_qc_inspection',
    entity_id: inspectionId,
    action: 'created',
    action_details: {
      inspection_no: inspectionNo,
      accepted_qty: createdInspection.accepted_qty,
      rejected_qty: createdInspection.rejected_qty,
      rework_qty: createdInspection.rework_qty,
      result: createdInspection.inspection_result,
    },
    user_id: userId,
    user_name: userName,
    organisation_id: orgId,
  });

  return createdInspection;
}

export async function releaseFGAfterQC(inspectionId: string, orgId: string) {
  const { data, error } = await supabase.rpc('release_fg_after_qc', {
    p_inspection_id: inspectionId,
    p_org_id: orgId,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Failed to release QC inspection stock');
  return data;
}
