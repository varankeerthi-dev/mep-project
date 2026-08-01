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
    // Clear old items
    await P.deleteBOMItemsByHeaderId(bomId);
  } else {
    const inserted = await P.insertBOMHeader(headerData);
    bomId = inserted.id!;
  }

  // Insert new items
  if (items.length > 0) {
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
      }));
    if (payload.length > 0) {
      await P.insertBOMItems(payload);
    }
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
