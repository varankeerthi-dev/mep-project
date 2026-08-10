import * as P from '../persistence';
import { supabase } from '../../../supabase';
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
  const { data, error } = await supabase.rpc('create_production_entry', {
    p_entry: entry,
    p_items: items,
    p_org_id: orgId,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Failed to create production entry');
  return data.entry_id;
}

export async function deleteProductionEntryAggregate(
  entryId: string,
  orgId: string,
  userId: string,
  userEmail: string
) {
  const { data, error } = await supabase.rpc('delete_production_entry', {
    p_entry_id: entryId,
    p_org_id: orgId,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Failed to delete production entry');
}

async function recalculateJobCardStatus(jobCardId: string, orgId: string) {
  const entries = await P.fetchProductionEntries(jobCardId, orgId);
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

  await recalculateJobCardStatus(updatedEntry.job_card_id, orgId);

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
