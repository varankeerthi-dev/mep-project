// @ts-nocheck
import * as P from '../persistence';
import { buildStockKey, variantStockCombos, NO_VARIANT_KEY } from '../model/aggregates/WarehouseStock';

/** Save a material with all its related data (alternative units, variants, stock, vendors, clients) */
export async function saveMaterialAggregate(
  data: {
    material: Record<string, any>;
    formData: { has_alternative_unit: boolean; alternative_units: { unit_name: string; conversion_factor: string }[]; uses_variant: boolean; track_inventory: boolean };
    variantPricing: any[];
    warehouseStock: Record<string, { exclude: boolean; current_stock: number }>;
    vendorMappings: any[];
    clientMappings: any[];
    clientPricing: any[];
    warehouses: any[];
    organisationId: string;
  }
) {
  const { material, formData, variantPricing, warehouseStock, vendorMappings, clientMappings, clientPricing, warehouses, organisationId } = data;
  const isEditing = !!material.id;
  const nowIso = new Date().toISOString();
  let itemId: string;

  // Save material header
  if (isEditing) {
    await P.updateMaterial(material.id, material);
    itemId = material.id;
  } else {
    const created = await P.insertMaterial(material);
    itemId = created.id;
  }

  // Alternative units
  const altUnits = formData.has_alternative_unit && formData.alternative_units.length > 0
    ? formData.alternative_units
        .map((u) => ({ unit_name: u.unit_name, conversion_factor: parseFloat(u.conversion_factor) }))
        .filter((u) => u.unit_name && !isNaN(u.conversion_factor))
    : [];
  await P.saveAlternativeUnits(itemId, altUnits);

  // Variant pricing
  if (formData.uses_variant && variantPricing.length > 0) {
    const pricingData = variantPricing
      .filter((p) => p.sale_price || p.purchase_price)
      .map((p) => ({
        company_variant_id: p.company_variant_id || null,
        make: p.make || '',
        sale_price: p.sale_price ? parseFloat(p.sale_price) : 0,
        purchase_price: p.purchase_price ? parseFloat(p.purchase_price) : null,
      }));
    await P.saveVariantPricing(itemId, pricingData);
  }

  // Warehouse stock
  if (formData.track_inventory && warehouses) {
    const rawCombos = formData.uses_variant ? variantStockCombos(variantPricing) : [];
    const stockCombos = rawCombos.length > 0 ? rawCombos : [{ variantId: NO_VARIANT_KEY, make: '' }];

    const stockInserts = [];
    for (const combo of stockCombos) {
      const dbVariantId = combo.variantId === NO_VARIANT_KEY ? null : combo.variantId;
      const dbMake = combo.make || null;
      for (const wh of warehouses) {
        const key = buildStockKey(wh.id, dbVariantId, dbMake);
        const ws = warehouseStock[key] || { exclude: false, current_stock: 0 };
        if (ws.exclude) {
          await P.deleteWarehouseStock(itemId, wh.id, dbVariantId, dbMake);
        } else {
          stockInserts.push({
            item_id: itemId,
            warehouse_id: wh.id,
            company_variant_id: dbVariantId,
            make: dbMake,
            current_stock: ws.current_stock || 0,
            updated_at: nowIso,
          });
        }
      }
    }
    await P.saveWarehouseStock(itemId, stockInserts);
  }

  // Vendor mappings
  await P.saveVendorMappings(itemId, vendorMappings.map((m) => ({ ...m, organisation_id: organisationId })));

  // Client mappings
  await P.saveClientMappings(itemId, clientMappings, organisationId);

  // Client pricing
  await P.saveClientPricing(itemId, clientPricing, organisationId);

  return itemId;
}

/** Delete a material or archive it if linked to other records */
export async function deleteOrArchiveMaterial(id: string) {
  const linkedTables = await P.checkLinkedRecords(id);
  if (linkedTables.length > 0) {
    await P.archiveMaterial(id);
    return { archived: true, linkedTables };
  }
  await P.deleteMaterialPersistence(id);
  return { deleted: true };
}

/** Toggle material active state */
export async function toggleMaterialActive(material: { id: string; is_active: boolean }) {
  await P.updateMaterial(material.id, { is_active: !material.is_active });
}
