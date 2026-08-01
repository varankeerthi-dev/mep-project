import * as P from '../persistence';
import { JobCardMaterial, Warehouse, JobCard } from '../model/types';
import { supabase } from '../../../supabase';

export async function issueJobCardMaterials(
  jobCardId: string,
  orgId: string,
  userId: string,
  jobCardNo: string
) {
  const warehouses = await P.fetchWarehouses(orgId);
  const mainStore = warehouses.find((w) => w.warehouse_purpose === 'main' || w.is_default);
  const wip = warehouses.find((w) => w.warehouse_purpose === 'wip') || warehouses.find((w) => w.id !== mainStore?.id);

  if (!mainStore || !wip) {
    throw new Error('Required warehouses (Main Store / WIP) not found');
  }

  const materials = await P.fetchJobCardMaterials(jobCardId);
  const reservedMaterials = materials.filter((m) => m.status === 'reserved');
  if (reservedMaterials.length === 0) {
    throw new Error('No reserved materials to issue');
  }

  // 1. Validate Stock Levels
  for (const mat of reservedMaterials) {
    const stockRow = await P.fetchItemStockSingle(mat.material_id, mainStore.id, orgId);
    const available = stockRow?.current_stock || 0;
    if (available < mat.planned_qty) {
      throw new Error(
        `Insufficient stock in Raw Materials Warehouse (Main Store) for ${mat.materials?.name || 'material'}: ` +
        `available ${available} ${mat.materials?.unit || ''}, needed ${mat.planned_qty} ${mat.materials?.unit || ''}`
      );
    }
  }

  // 2. Create Material Outward Record
  const outwardRecord = await P.insertMaterialOutward({
    outward_date: new Date().toISOString().split('T')[0],
    remarks: `Job Card ${jobCardNo} — materials issued to production`,
    organisation_id: orgId,
  });

  const outwardItemsPayload = [];

  // 3. Process stock transfer & status update for each material
  for (const mat of reservedMaterials) {
    const qty = mat.planned_qty;

    // Decrement Main Store stock
    const mainStock = await P.fetchItemStockSingle(mat.material_id, mainStore.id, orgId);
    if (mainStock) {
      await P.updateItemStock(mainStock.id!, Math.max(0, mainStock.current_stock - qty));
    }

    // Increment WIP stock
    const wipStock = await P.fetchItemStockSingle(mat.material_id, wip.id, orgId);
    if (wipStock) {
      await P.updateItemStock(wipStock.id!, wipStock.current_stock + qty);
    } else {
      await P.insertItemStock({
        item_id: mat.material_id,
        warehouse_id: wip.id,
        current_stock: qty,
        organisation_id: orgId,
      });
    }

    // Prepare outward item payload
    outwardItemsPayload.push({
      outward_id: outwardRecord.id!,
      material_name: mat.materials?.name || '',
      quantity: qty,
      unit: mat.materials?.unit || '',
      material_id: mat.material_id,
      warehouse_id: mainStore.id,
      organisation_id: orgId,
    });

    // Update job card material row
    await P.updateJobCardMaterial(mat.id!, {
      status: 'issued',
      issued_qty: qty,
      warehouse_id: wip.id,
    });
  }

  if (outwardItemsPayload.length > 0) {
    await P.insertMaterialOutwardItems(outwardItemsPayload);
  }

  // 4. Update Job Card status
  await P.updateJobCard(jobCardId, {
    status: 'issued',
    completed_at: null,
  });
}

export async function returnJobCardMaterials(
  jobCardId: string,
  orgId: string,
  returnQuantities: Record<string, number>
) {
  const warehouses = await P.fetchWarehouses(orgId);
  const mainStore = warehouses.find((w) => w.warehouse_purpose === 'main' || w.is_default);
  const wip = warehouses.find((w) => w.warehouse_purpose === 'wip') || warehouses.find((w) => w.id !== mainStore?.id);

  if (!mainStore || !wip) {
    throw new Error('Required warehouses (Main Store / WIP) not found');
  }

  const materials = await P.fetchJobCardMaterials(jobCardId);
  const returnItems: { material: any; returnQty: number }[] = [];

  for (const mat of materials) {
    const retQty = returnQuantities[mat.id!];
    if (!retQty || retQty <= 0) continue;

    // Check WIP stock level
    const wipStock = await P.fetchItemStockSingle(mat.material_id, wip.id, orgId);
    const wipAvailable = wipStock?.current_stock || 0;
    if (wipAvailable < retQty) {
      throw new Error(
        `Insufficient stock in WIP Store for ${mat.materials?.name || 'material'}: ` +
        `available ${wipAvailable} ${mat.materials?.unit || ''}, attempting to return ${retQty} ${mat.materials?.unit || ''}`
      );
    }
    returnItems.push({ material: mat, returnQty: retQty });
  }

  if (returnItems.length === 0) return;

  // Insert Material Inward Record
  const jobCard = await P.fetchJobCardById(jobCardId);
  const inwardRecord = await P.insertMaterialInward({
    inward_date: new Date().toISOString().split('T')[0],
    vendor_name: 'Production Return',
    remarks: `Job Card ${jobCard?.job_card_no} — materials returned from production`,
    organisation_id: orgId,
    supply_type: 'WAREHOUSE',
  });

  const inwardItemsPayload = [];

  for (const { material: mat, returnQty: retQty } of returnItems) {
    // Decrement WIP stock
    const wipStock = await P.fetchItemStockSingle(mat.material_id, wip.id, orgId);
    if (wipStock) {
      await P.updateItemStock(wipStock.id!, Math.max(0, wipStock.current_stock - retQty));
    }

    // Increment Main Store stock
    const mainStock = await P.fetchItemStockSingle(mat.material_id, mainStore.id, orgId);
    if (mainStock) {
      await P.updateItemStock(mainStock.id!, mainStock.current_stock + retQty);
    } else {
      await P.insertItemStock({
        item_id: mat.material_id,
        warehouse_id: mainStore.id,
        current_stock: retQty,
        organisation_id: orgId,
      });
    }

    // Prepare inward item payload
    inwardItemsPayload.push({
      inward_id: inwardRecord.id!,
      material_name: mat.materials?.name || '',
      quantity: retQty,
      unit: mat.materials?.unit || '',
      material_id: mat.material_id,
      warehouse_id: mainStore.id,
      organisation_id: orgId,
    });

    // Update job card material row
    await P.updateJobCardMaterial(mat.id!, {
      return_qty: (mat.return_qty || 0) + retQty,
      status: 'returned',
    });
  }

  if (inwardItemsPayload.length > 0) {
    await P.insertMaterialInwardItems(inwardItemsPayload);
  }
}

export async function generateNextJobCardNumber(orgId: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_job_card_no', { org_id: orgId });
    if (error || !data) throw error;
    return data as string;
  } catch {
    const { data } = await supabase
      .from('job_cards')
      .select('job_card_no')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = data?.job_card_no;
    const next = last ? parseInt(last.replace('JC-', '')) + 1 : 1;
    return `JC-${String(next).padStart(4, '0')}`;
  }
}

export async function createJobCardAggregate(
  jobCard: Partial<JobCard>,
  materials: Partial<JobCardMaterial>[]
) {
  const jobCardNo = jobCard.job_card_no || await generateNextJobCardNumber(jobCard.organisation_id!);

  const jobCardPayload = {
    ...jobCard,
    job_card_no: jobCardNo,
    status: 'draft',
  };

  const inserted = await P.insertJobCard(jobCardPayload);
  
  if (materials.length > 0) {
    const materialsPayload = materials.map((m) => ({
      job_card_id: inserted.id!,
      material_id: m.material_id,
      planned_qty: m.planned_qty,
      unit: m.unit || 'kg',
      is_additional: m.is_additional || false,
      status: 'reserved',
    }));
    await P.insertJobCardMaterials(materialsPayload);
  }

  return inserted;
}
