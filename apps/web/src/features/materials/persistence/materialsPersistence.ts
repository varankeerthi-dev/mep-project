// @ts-nocheck
import { supabase } from '../../../supabase';
import { timedSupabaseQuery } from '../../../utils/queryTimeout';

// ─── Materials CRUD ──────────────────────────────────────────

export async function fetchMaterials(orgId: string) {
  const { data, error } = await supabase
    .from('materials')
    .select('*, discount_category:discount_categories(id, name, default_discount_percent), material_units(*)')
    .eq('organisation_id', orgId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchMaterialById(id: string) {
  const { data, error } = await supabase
    .from('materials')
    .select('*, material_units(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function insertMaterial(data: Record<string, any>) {
  const { data: result, error } = await supabase.from('materials').insert(data).select().single();
  if (error) throw error;
  return result;
}

export async function updateMaterial(id: string, data: Record<string, any>) {
  const { error } = await supabase
    .from('materials')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMaterial(id: string) {
  // Fetch pricing IDs first so we can delete history records by pricing_id
  const { data: pricingRows } = await supabase
    .from('material_client_pricing')
    .select('id')
    .eq('material_id', id);

  if (pricingRows && pricingRows.length > 0) {
    const pricingIds = pricingRows.map((r) => r.id);
    await supabase
      .from('material_client_pricing_history')
      .delete()
      .in('pricing_id', pricingIds);
  }

  // Delete related records
  await supabase.from('material_client_pricing').delete().eq('material_id', id);
  await supabase.from('material_client_mappings').delete().eq('material_id', id);
  await supabase.from('vendor_material_pricing').delete().eq('material_id', id);
  await supabase.from('material_units').delete().eq('material_id', id);
  await supabase.from('item_variant_pricing').delete().eq('item_id', id);
  await supabase.from('item_stock').delete().eq('item_id', id);
  // Delete the material
  const { error } = await supabase.from('materials').delete().eq('id', id);
  if (error) throw error;
}

export async function archiveMaterial(id: string) {
  const { error } = await supabase
    .from('materials')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function checkDuplicateName(name: string, orgId: string, excludeId?: string) {
  let query = supabase
    .from('materials')
    .select('id, name')
    .eq('organisation_id', orgId)
    .ilike('name', name.trim());
  if (excludeId) query = query.neq('id', excludeId);
  const { data } = await query.maybeSingle();
  return !!data;
}

// ─── Related data management ─────────────────────────────────

export async function saveAlternativeUnits(itemId: string, units: { unit_name: string; conversion_factor: number }[]) {
  await supabase.from('material_units').delete().eq('material_id', itemId);
  if (units.length > 0) {
    const { error } = await supabase.from('material_units').insert(
      units.map((u) => ({ material_id: itemId, ...u }))
    );
    if (error) throw error;
  }
}

export async function saveVariantPricing(
  itemId: string,
  pricing: { company_variant_id: string | null; make: string; sale_price: number; purchase_price: number }[]
) {
  await supabase.from('item_variant_pricing').delete().eq('item_id', itemId);
  if (pricing.length > 0) {
    const { error } = await supabase.from('item_variant_pricing').insert(
      pricing.map((p) => ({ item_id: itemId, ...p, updated_at: new Date().toISOString() }))
    );
    if (error) throw error;
  }
}

export async function fetchVariantPricing(itemId: string) {
  try {
    return await timedSupabaseQuery(
      supabase.from('item_variant_pricing').select('*').eq('item_id', itemId),
      'Item variant pricing'
    );
  } catch {
    return [];
  }
}

export async function saveWarehouseStock(
  itemId: string,
  stockInserts: { warehouse_id: string; company_variant_id: string | null; current_stock: number; updated_at: string }[]
) {
  if (stockInserts.length > 0) {
    const { error } = await supabase.from('item_stock').upsert(stockInserts, {
      onConflict: 'item_id, company_variant_id, warehouse_id',
    });
    if (error) console.error('Error saving warehouse stock:', error);
  }
}

export async function deleteWarehouseStock(
  itemId: string,
  warehouseId: string,
  variantId: string | null
) {
  if (variantId) {
    await supabase
      .from('item_stock')
      .delete()
      .eq('item_id', itemId)
      .eq('warehouse_id', warehouseId)
      .eq('company_variant_id', variantId);
  } else {
    await supabase
      .from('item_stock')
      .delete()
      .eq('item_id', itemId)
      .eq('warehouse_id', warehouseId)
      .is('company_variant_id', null);
  }
}

export async function saveVendorMappings(itemId: string, mappings: any[]) {
  await supabase.from('vendor_material_pricing').delete().eq('material_id', itemId);
  const toInsert = mappings
    .filter((m) => m.vendor_id)
    .map((m) => ({
      material_id: itemId,
      variant_id: m.variant_id || null,
      make: m.make || null,
      vendor_id: m.vendor_id,
      base_rate: parseFloat(m.base_rate) || 0,
      discount_percent: parseFloat(m.discount_percent) || 0,
      is_preferred: m.is_preferred || false,
      organisation_id: m.organisation_id,
      updated_at: new Date().toISOString(),
    }));
  if (toInsert.length > 0) {
    const { error } = await supabase.from('vendor_material_pricing').insert(toInsert);
    if (error) throw error;
  }
}

export async function fetchVendorMappings(itemId: string) {
  const { data, error } = await supabase
    .from('vendor_material_pricing')
    .select('*')
    .eq('material_id', itemId);
  if (error) throw error;
  return data || [];
}

export async function saveClientMappings(itemId: string, mappings: any[], orgId: string) {
  await supabase.from('material_client_mappings').delete().eq('material_id', itemId);
  const toInsert = mappings
    .filter((m) => m.client_id)
    .map((m) => ({
      material_id: itemId,
      client_id: m.client_id,
      company_variant_id: m.company_variant_id || null,
      client_part_no: m.client_part_no,
      client_description: m.client_description,
      organisation_id: orgId,
      updated_at: new Date().toISOString(),
    }));
  if (toInsert.length > 0) {
    const { error } = await supabase.from('material_client_mappings').insert(toInsert);
    if (error) throw error;
  }
}

export async function fetchClientMappings(itemId: string) {
  const { data } = await supabase.from('material_client_mappings').select('*').eq('material_id', itemId);
  return data || [];
}

export async function saveClientPricing(itemId: string, pricing: any[], orgId: string) {
  await supabase.from('material_client_pricing').delete().eq('material_id', itemId);
  const toInsert = pricing
    .filter((p) => p.client_id)
    .map((p) => ({
      material_id: itemId,
      client_id: p.client_id,
      company_variant_id: p.company_variant_id || null,
      pricing_type: p.pricing_type || 'Fixed ARC',
      rate: p.rate ? parseFloat(p.rate) : null,
      valid_from: p.valid_from || null,
      valid_to: p.valid_to || null,
      status: p.status || 'active',
      organisation_id: orgId,
      updated_at: new Date().toISOString(),
    }));
  if (toInsert.length > 0) {
    const { error } = await supabase.from('material_client_pricing').insert(toInsert);
    if (error) throw error;
  }
}

export async function fetchClientPricing(itemId: string) {
  const { data } = await supabase
    .from('material_client_pricing')
    .select('*, clients(client_name)')
    .eq('material_id', itemId)
    .order('created_at', { ascending: true });
  return data || [];
}

export async function fetchPricingHistory(itemId: string) {
  const { data } = await supabase
    .from('material_client_pricing_history')
    .select('*')
    .eq('material_id', itemId)
    .order('changed_at', { ascending: false })
    .limit(50);
  return data || [];
}

export async function checkLinkedRecords(itemId: string): Promise<string[]> {
  const checks = [
    { table: 'quotation_items', key: 'item_id', name: 'Quotations' },
    { table: 'delivery_challan_items', key: 'material_id', name: 'Delivery Challans' },
    { table: 'material_inward_items', key: 'material_id', name: 'Material Inward' },
    { table: 'material_outward_items', key: 'material_id', name: 'Material Outward' },
    { table: 'invoice_items', key: 'material_id', name: 'Invoices' },
    { table: 'purchase_order_items', key: 'material_id', name: 'Purchase Orders' },
    { table: 'purchase_bill_items', key: 'material_id', name: 'Purchase Bills' },
    { table: 'stock_transfer_items', key: 'material_id', name: 'Stock Transfers' },
    { table: 'quick_check_items', key: 'item_id', name: 'Quick Check' },
    { table: 'boq_items', key: 'material_id', name: 'BOQ' },
    { table: 'bom_items', key: 'material_id', name: 'Bills of Materials (BOM)' },
  ];
  const linkedTables: string[] = [];
  for (const { table, key, name } of checks) {
    const { data } = await supabase.from(table).select('id').eq(key, itemId).limit(1);
    if (data?.length) linkedTables.push(name);
  }
  return linkedTables;
}

export async function checkVariantRecords(itemId: string) {
  const [stockRes, pricingRes] = await Promise.all([
    supabase.from('item_stock').select('id').eq('item_id', itemId).not('company_variant_id', 'is', null),
    supabase.from('item_variant_pricing').select('id').eq('item_id', itemId),
  ]);
  return {
    hasStock: (stockRes.data?.length || 0) > 0,
    hasPricing: (pricingRes.data?.length || 0) > 0,
  };
}

export async function fetchVendors(orgId: string) {
  const { data, error } = await supabase
    .from('purchase_vendors')
    .select('id, company_name')
    .eq('organisation_id', orgId)
    .eq('status', 'Active');
  if (error) throw error;
  return data || [];
}

export async function fetchStock(orgId: string) {
  const { data, error } = await supabase
    .from('item_stock')
    .select('id, item_id, warehouse_id, company_variant_id, current_stock, updated_at')
    .eq('organisation_id', orgId);
  if (error) throw error;
  return data || [];
}
