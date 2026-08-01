import { supabase } from '../../../supabase';
import {
  MaterialRequisition,
  MaterialRequisitionItem,
  GoodsReceiptNote,
  GRNItem,
  RMQCInspection
} from '../model/types';

// =========================================================================
// Material Requisition Persistence
// =========================================================================

export async function fetchMaterialRequisitions(orgId: string, status?: string) {
  let query = supabase
    .from('material_requisitions')
    .select(`
      *,
      job_cards (
        job_card_no,
        bom_headers (
          product_name
        )
      )
    `)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (MaterialRequisition & { job_cards?: { job_card_no: string; bom_headers?: { product_name: string } | null } | null })[];
}

export async function fetchMaterialRequisitionById(id: string) {
  const { data, error } = await supabase
    .from('material_requisitions')
    .select(`
      *,
      job_cards (
        job_card_no,
        bom_headers (
          product_name
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as (MaterialRequisition & { job_cards?: { job_card_no: string; bom_headers?: { product_name: string } | null } | null });
}

export async function fetchMaterialRequisitionItems(requisitionId: string) {
  const { data, error } = await supabase
    .from('material_requisition_items')
    .select(`
      *,
      materials:material_id (
        name,
        unit
      )
    `)
    .eq('requisition_id', requisitionId);

  if (error) throw error;
  return data as (MaterialRequisitionItem & { materials?: { name: string; unit: string } | null })[];
}

export async function insertMaterialRequisition(requisition: Omit<MaterialRequisition, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('material_requisitions')
    .insert([requisition])
    .select()
    .single();

  if (error) throw error;
  return data as MaterialRequisition;
}

export async function insertMaterialRequisitionItems(items: Omit<MaterialRequisitionItem, 'id' | 'created_at'>[]) {
  const { data, error } = await supabase
    .from('material_requisition_items')
    .insert(items)
    .select();

  if (error) throw error;
  return data as MaterialRequisitionItem[];
}

export async function updateMaterialRequisition(id: string, updates: Partial<MaterialRequisition>) {
  const { data, error } = await supabase
    .from('material_requisitions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as MaterialRequisition;
}

export async function updateMaterialRequisitionItemQty(id: string, qtyUpdates: Partial<Pick<MaterialRequisitionItem, 'issued_qty' | 'status'>>) {
  const { data, error } = await supabase
    .from('material_requisition_items')
    .update(qtyUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as MaterialRequisitionItem;
}

// =========================================================================
// Goods Receipt Notes (GRN) Persistence
// =========================================================================

export async function fetchGoodsReceiptNotes(orgId: string, status?: string) {
  let query = supabase
    .from('goods_receipt_notes')
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as GoodsReceiptNote[];
}

export async function fetchGoodsReceiptNoteById(id: string) {
  const { data, error } = await supabase
    .from('goods_receipt_notes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as GoodsReceiptNote;
}

export async function fetchGRNItems(grnId: string) {
  const { data, error } = await supabase
    .from('grn_items')
    .select(`
      *,
      materials:material_id (
        name,
        unit
      )
    `)
    .eq('grn_id', grnId);

  if (error) throw error;
  return data as (GRNItem & { materials?: { name: string; unit: string } | null })[];
}

export async function insertGoodsReceiptNote(grn: Omit<GoodsReceiptNote, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('goods_receipt_notes')
    .insert([grn])
    .select()
    .single();

  if (error) throw error;
  return data as GoodsReceiptNote;
}

export async function insertGRNItems(items: Omit<GRNItem, 'id' | 'created_at'>[]) {
  const { data, error } = await supabase
    .from('grn_items')
    .insert(items)
    .select();

  if (error) throw error;
  return data as GRNItem[];
}

export async function updateGoodsReceiptNote(id: string, updates: Partial<GoodsReceiptNote>) {
  const { data, error } = await supabase
    .from('goods_receipt_notes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as GoodsReceiptNote;
}

export async function updateGRNItemQty(id: string, qtyUpdates: Partial<Pick<GRNItem, 'received_qty' | 'accepted_qty' | 'rejected_qty' | 'status'>>) {
  const { data, error } = await supabase
    .from('grn_items')
    .update(qtyUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as GRNItem;
}

export async function insertRMQCInspection(inspection: Omit<RMQCInspection, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('rm_qc_inspections')
    .insert([inspection])
    .select()
    .single();

  if (error) throw error;
  return data as RMQCInspection;
}

export async function fetchRMQCInspections(grnId: string) {
  const { data, error } = await supabase
    .from('rm_qc_inspections')
    .select('*')
    .eq('grn_id', grnId);

  if (error) throw error;
  return data as RMQCInspection[];
}
