import * as P from '../persistence';
import { BOMHeader, BOMItem } from '../model/types';
import { supabase } from '../../../supabase';

export async function saveBOMAggregate(
  header: Partial<BOMHeader>,
  items: Partial<BOMItem>[]
) {
  const isEditing = !!header.id;
  let bomId: string;
  let bomCode = header.bom_code;

  if (!bomCode) {
    try {
      const { data, error } = await supabase.rpc('generate_bom_code', { org_id: header.organisation_id });
      if (error || !data) throw error;
      bomCode = data as string;
    } catch {
      const { data } = await supabase
        .from('bom_headers')
        .select('bom_code')
        .eq('organisation_id', header.organisation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const last = data?.bom_code;
      const next = last ? parseInt(last.replace('BOM-', '')) + 1 : 1;
      bomCode = `BOM-${String(next).padStart(4, '0')}`;
    }
  }

  const headerData = {
    ...header,
    bom_code: bomCode,
  };

  if (isEditing && header.id) {
    const updated = await P.updateBOMHeader(header.id, headerData);
    bomId = updated.id!;
    await P.deleteBOMItemsByHeaderId(bomId);
  } else {
    const inserted = await P.insertBOMHeader(headerData);
    bomId = inserted.id!;
  }

  const payload = items
    .filter((item) => item.material_id && item.required_qty > 0)
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      bom_id: bomId,
      material_id: item.material_id,
      required_qty: item.required_qty,
      unit: item.unit,
      wastage_pct: item.wastage_pct,
      company_variant_id: item.company_variant_id || null,
      make: item.make || null,
      notes: item.notes || null,
      lead_time_days: item.lead_time_days || 0,
      parent_material_id: item.parent_material_id || null,
      custom_attributes: item.custom_attributes || {},
      unit_cost: item.unit_cost || 0,
      sequence_no: item.sequence_no || 0,
      work_center_id: item.work_center_id || null,
      is_critical: item.is_critical || false,
      alternate_material_id: item.alternate_material_id || null,
      drawing_reference: item.drawing_reference || null,
      inspection_required: item.inspection_required || false,
      shelf_life_days: item.shelf_life_days || null,
      warehouse_id: item.warehouse_id || null,
      scrap_factor: item.scrap_factor || null,
      yield_pct: item.yield_pct || null,
    }));

  if (payload.length > 0) {
    await P.insertBOMItems(payload);

    const totalCost = payload.reduce(
      (sum, item) => sum + item.required_qty * (item.unit_cost || 0),
      0
    );

    await P.updateBOMHeader(bomId, {
      total_estimated_cost: totalCost,
      estimated_production_minutes: 0,
    });
  }

  return bomId;
}

export async function deleteBOM(bomId: string) {
  const { jobCardsCount, schedulesCount } = await P.checkBOMLinkedRecords(bomId);
  if (jobCardsCount > 0 || schedulesCount > 0) {
    const parts: string[] = [];
    if (jobCardsCount > 0) {
      parts.push(`${jobCardsCount} job card${jobCardsCount !== 1 ? 's' : ''}`);
    }
    if (schedulesCount > 0) {
      parts.push(`${schedulesCount} production schedule${schedulesCount !== 1 ? 's' : ''}`);
    }
    throw new Error(`Cannot delete: this BOM is used by ${parts.join(' and ')}. Remove them first.`);
  }

  await P.deleteBOMItemsByHeaderId(bomId);
  await P.deleteBOMHeader(bomId);
}

export async function cloneBOM(sourceBomId: string, orgId: string) {
  const source = await P.fetchBOMHeaderById(sourceBomId);
  if (!source) throw new Error('Source BOM not found');

  const sourceItems = await P.fetchBOMItemsByHeaderId(sourceBomId);

  let newBomCode: string;
  try {
    const { data, error } = await supabase.rpc('generate_bom_code', { org_id: orgId });
    if (error || !data) throw error;
    newBomCode = data as string;
  } catch {
    const { data } = await supabase
      .from('bom_headers')
      .select('bom_code')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = data?.bom_code;
    const next = last ? parseInt(last.replace('BOM-', '')) + 1 : 1;
    newBomCode = `BOM-${String(next).padStart(4, '0')}`;
  }

  const newHeader = await P.insertBOMHeader({
    bom_code: newBomCode,
    product_name: source.product_name,
    product_id: source.product_id,
    output_qty: source.output_qty,
    output_unit: source.output_unit,
    description: source.description,
    is_active: true,
    batch_no: source.batch_no,
    approval_status: 'draft',
    organisation_id: orgId,
    revision: 'A',
    product_code: source.product_code,
    bom_type: source.bom_type || 'assembly',
    product_category: source.product_category,
    priority: source.priority,
    effective_date: new Date().toISOString().split('T')[0],
    parent_bom_id: sourceBomId,
  });

  if (sourceItems.length > 0) {
    const payload = sourceItems.map((item) => ({
      id: crypto.randomUUID(),
      bom_id: newHeader.id!,
      material_id: item.material_id,
      required_qty: item.required_qty,
      unit: item.unit,
      wastage_pct: item.wastage_pct,
      company_variant_id: item.company_variant_id,
      make: item.make,
      notes: item.notes,
      lead_time_days: item.lead_time_days,
      parent_material_id: item.parent_material_id,
      custom_attributes: item.custom_attributes || {},
      unit_cost: item.unit_cost || 0,
      sequence_no: item.sequence_no || 0,
      work_center_id: item.work_center_id,
      is_critical: item.is_critical || false,
      alternate_material_id: item.alternate_material_id,
      drawing_reference: item.drawing_reference,
      inspection_required: item.inspection_required || false,
      shelf_life_days: item.shelf_life_days,
      warehouse_id: item.warehouse_id,
      scrap_factor: item.scrap_factor,
      yield_pct: item.yield_pct,
    }));
    await P.insertBOMItems(payload);
  }

  return newHeader.id!;
}
