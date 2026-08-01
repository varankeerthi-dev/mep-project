import * as P from '../persistence';
import { ProductionEntry, ProductionEntryItem } from '../model/types';

export async function createProductionEntryAggregate(
  entry: Partial<ProductionEntry>,
  items: {
    job_card_material_id: string;
    material_id: string;
    issued_qty: number;
    consumed_qty: number;
    wastage_qty: number;
    return_qty: number;
  }[],
  orgId: string,
  userId: string,
  userEmail: string
) {
  const warehouses = await P.fetchWarehouses(orgId);
  const mainStore = warehouses.find((w) => w.warehouse_purpose === 'main' || w.is_default);
  const wip = warehouses.find((w) => w.warehouse_purpose === 'wip') || warehouses.find((w) => w.id !== mainStore?.id);
  const fg = warehouses.find((w) => w.warehouse_purpose === 'fg') || warehouses.find((w) => w.id !== mainStore?.id && w.id !== wip?.id);

  if (!mainStore || !wip || !fg) {
    throw new Error('Required warehouses (Main Store / WIP / FG Store) not found');
  }

  // 1. Insert Production Entry Header
  const insertedEntry = await P.insertProductionEntry({
    ...entry,
    organisation_id: orgId,
    created_by: userId,
  });
  const entryId = insertedEntry.id!;

  // 2. Insert Entry Items and adjust Raw Materials stock
  const itemPayloads: Partial<ProductionEntryItem>[] = [];
  for (const item of items) {
    itemPayloads.push({
      production_entry_id: entryId,
      job_card_material_id: item.job_card_material_id,
      material_id: item.material_id,
      issued_qty: item.issued_qty,
      consumed_qty: item.consumed_qty,
      wastage_qty: item.wastage_qty,
      return_qty: item.return_qty,
    });

    const consumedWastage = item.consumed_qty + item.wastage_qty;
    if (consumedWastage > 0) {
      // Deduct from WIP stock
      const wipStock = await P.fetchItemStockSingle(item.material_id, wip.id, orgId);
      if (wipStock) {
        await P.updateItemStock(wipStock.id!, Math.max(0, wipStock.current_stock - consumedWastage));
      }
    }

    if (item.return_qty > 0) {
      // Add back to Main Store stock
      const mainStock = await P.fetchItemStockSingle(item.material_id, mainStore.id, orgId);
      if (mainStock) {
        await P.updateItemStock(mainStock.id!, mainStock.current_stock + item.return_qty);
      } else {
        await P.insertItemStock({
          item_id: item.material_id,
          warehouse_id: mainStore.id,
          current_stock: item.return_qty,
          organisation_id: orgId,
        });
      }
    }

    // Update totals in job_card_materials
    const materials = await P.fetchJobCardMaterials(entry.job_card_id!);
    const jcm = materials.find((m) => m.id === item.job_card_material_id);
    if (jcm) {
      await P.updateJobCardMaterial(item.job_card_material_id, {
        consumed_qty: (jcm.consumed_qty || 0) + item.consumed_qty,
        wastage_qty: (jcm.wastage_qty || 0) + item.wastage_qty,
        return_qty: (jcm.return_qty || 0) + item.return_qty,
      });
    }
  }

  if (itemPayloads.length > 0) {
    await P.insertProductionEntryItems(itemPayloads);
  }

  // 3. QC Gate Requirement: Do not directly add finished good to FG Warehouse stock here.
  // Instead, the stock will be added to the FG Warehouse during the QC Inspection confirmation step.
  /*
  if (insertedEntry.actual_qty > 0) {
    const jobCard = await P.fetchJobCardById(entry.job_card_id!);
    const productId = jobCard?.bom_headers?.product_id;
    if (productId) {
      const fgStock = await P.fetchItemStockSingle(productId, fg.id, orgId);
      if (fgStock) {
        await P.updateItemStock(fgStock.id!, fgStock.current_stock + insertedEntry.actual_qty);
      } else {
        await P.insertItemStock({
          item_id: productId,
          warehouse_id: fg.id,
          current_stock: insertedEntry.actual_qty,
          organisation_id: orgId,
        });
      }
    }
  }
  */

  // 4. Recalculate Job Card status
  await recalculateJobCardStatus(entry.job_card_id!);

  // 5. Activity Logging
  await P.insertActivityLog({
    entity_type: 'production_entry',
    entity_id: entryId,
    action: 'created',
    action_details: {
      entry_no: insertedEntry.entry_no,
      actual_qty: insertedEntry.actual_qty,
      job_card_id: entry.job_card_id,
    },
    user_id: userId,
    user_name: userEmail || 'Unknown',
    organisation_id: orgId,
  });

  return entryId;
}

export async function deleteProductionEntryAggregate(
  entryId: string,
  orgId: string,
  userId: string,
  userEmail: string
) {
  const entry = await P.fetchProductionEntryById(entryId);
  if (!entry) throw new Error('Entry not found');

  const warehouses = await P.fetchWarehouses(orgId);
  const mainStore = warehouses.find((w) => w.warehouse_purpose === 'main' || w.is_default);
  const wip = warehouses.find((w) => w.warehouse_purpose === 'wip') || warehouses.find((w) => w.id !== mainStore?.id);
  const fg = warehouses.find((w) => w.warehouse_purpose === 'fg') || warehouses.find((w) => w.id !== mainStore?.id && w.id !== wip?.id);

  if (!mainStore || !wip || !fg) {
    throw new Error('Required warehouses (Main Store / WIP / FG Store) not found');
  }

  // 1. Reverse FG Stock
  if (entry.actual_qty > 0) {
    const jobCard = await P.fetchJobCardById(entry.job_card_id);
    const productId = jobCard?.bom_headers?.product_id;
    if (productId) {
      const fgStock = await P.fetchItemStockSingle(productId, fg.id, orgId);
      if (fgStock) {
        await P.updateItemStock(fgStock.id!, Math.max(0, fgStock.current_stock - entry.actual_qty));
      }
    }
  }

  // 2. Reverse Stock for each raw material item
  const entryItems = await P.fetchProductionEntryItems(entryId);
  const materials = await P.fetchJobCardMaterials(entry.job_card_id);
  for (const item of entryItems) {
    const consumedWastage = (item.consumed_qty || 0) + (item.wastage_qty || 0);
    if (consumedWastage > 0) {
      // Add back to WIP
      const wipStock = await P.fetchItemStockSingle(item.material_id, wip.id, orgId);
      if (wipStock) {
        await P.updateItemStock(wipStock.id!, wipStock.current_stock + consumedWastage);
      }
    }

    if (item.return_qty > 0) {
      // Subtract from Main Store
      const mainStock = await P.fetchItemStockSingle(item.material_id, mainStore.id, orgId);
      if (mainStock) {
        await P.updateItemStock(mainStock.id!, Math.max(0, mainStock.current_stock - item.return_qty));
      }
    }

    // Subtract totals from job_card_materials
    const jcm = materials.find((m) => m.id === item.job_card_material_id);
    if (jcm) {
      await P.updateJobCardMaterial(item.job_card_material_id, {
        consumed_qty: Math.max(0, (jcm.consumed_qty || 0) - (item.consumed_qty || 0)),
        wastage_qty: Math.max(0, (jcm.wastage_qty || 0) - (item.wastage_qty || 0)),
        return_qty: Math.max(0, (jcm.return_qty || 0) - (item.return_qty || 0)),
      });
    }
  }

  // 3. Delete DB rows
  await P.deleteProductionEntryItems(entryId);
  await P.deleteProductionEntry(entryId);

  // 4. Recalculate Job Card Status
  await recalculateJobCardStatus(entry.job_card_id);

  // 5. Activity Log Deletion
  const jobCard = await P.fetchJobCardById(entry.job_card_id);
  await P.insertActivityLog({
    entity_type: 'production_entry',
    entity_id: entryId,
    action: 'deleted',
    action_details: {
      entry_no: entry.entry_no,
      actual_qty: entry.actual_qty,
      job_card: jobCard?.job_card_no || entry.job_card_id?.slice(0, 8),
    },
    user_id: userId,
    user_name: userEmail || 'Unknown',
    organisation_id: orgId,
  });
}

async function recalculateJobCardStatus(jobCardId: string) {
  const entries = await P.fetchProductionEntries(jobCardId);
  const remainingQty = entries.reduce((sum, e) => sum + (e.actual_qty || 0), 0);
  const jobCard = await P.fetchJobCardById(jobCardId);
  const plannedQty = jobCard?.planned_qty || 0;

  let jcStatus = 'issued';
  let jcCompletedAt: string | null = null;

  if (remainingQty >= plannedQty) {
    jcStatus = 'completed';
    jcCompletedAt = new Date().toISOString();
  } else if (remainingQty > 0) {
    jcStatus = 'in_progress';
    jcCompletedAt = null;
  }

  await P.updateJobCard(jobCardId, { status: jcStatus, completed_at: jcCompletedAt });
}

export async function updateProductionEntryAggregate(
  entryId: string,
  entryUpdates: Partial<ProductionEntry>,
  orgId: string,
  userId: string,
  userEmail: string
) {
  const updatedEntry = await P.updateProductionEntry(entryId, entryUpdates);

  await recalculateJobCardStatus(updatedEntry.job_card_id);

  await P.insertActivityLog({
    entity_type: 'production_entry',
    entity_id: entryId,
    action: 'updated',
    action_details: {
      entry_no: updatedEntry.entry_no,
      actual_qty: updatedEntry.actual_qty,
      job_card_id: updatedEntry.job_card_id,
      notes: updatedEntry.notes,
      operator_name: updatedEntry.operator_name,
      machine_name: updatedEntry.machine_name,
    },
    user_id: userId,
    user_name: userEmail || 'Unknown',
    organisation_id: orgId,
  });

  return updatedEntry;
}
