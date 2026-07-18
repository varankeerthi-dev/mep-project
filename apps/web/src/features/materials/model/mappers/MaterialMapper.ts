import type { Material, MaterialUnit } from '../entities/Material';
import type { MaterialEditorFormData } from '../aggregates/MaterialEditor';
import type { VariantPricingRow } from '../aggregates/MaterialPricing';
import type { WarehouseStockMap, WarehouseStockEntry } from '../aggregates/WarehouseStock';
import type { VendorMappingRow } from '../aggregates/VendorMapping';
import type { ClientMappingRow } from '../aggregates/ClientMapping';
import type { MaterialEditorFormData as FormData } from '../aggregates/MaterialEditor';
import { generateItemCode } from '../../lib/generateItemCode';

/** Map editor form data to a DB-ready material payload */
export function editorToMaterial(
  formData: FormData,
  organisationId: string,
  existingMaterial?: Material | null
): Partial<Material> {
  return {
    ...(existingMaterial ? { id: existingMaterial.id } : {}),
    item_code: formData.item_code || generateItemCode(),
    name: formData.item_name,
    display_name: formData.display_name || formData.item_name,
    main_category: formData.main_category || null,
    sub_category: formData.sub_category || null,
    size: formData.size || null,
    pressure_class: formData.pressure_class || null,
    make: formData.make || null,
    material: formData.material || null,
    end_connection: formData.end_connection || null,
    unit: formData.unit,
    sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
    purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
    hsn_code: formData.hsn_code || null,
    gst_rate: formData.gst_rate || null,
    is_active: formData.is_active,
    uses_variant: formData.uses_variant,
    discount_category_id: formData.discount_category_id || null,
    dimension: formData.dimension || null,
    dimension_unit: formData.dimension_unit || 'cm',
    weight: formData.weight ? parseFloat(formData.weight) : null,
    weight_unit: formData.weight_unit || 'kg',
    item_type: 'product',
    item_classification: formData.item_classification,
    allow_purchase: formData.allow_purchase,
    allow_sales: formData.allow_sales,
    show_in_bom: formData.show_in_bom,
    is_manufactured: formData.is_manufactured,
    organisation_id: organisationId,
  };
}

/** Map a Material entity back to editor form data */
export function materialToEditor(
  material: Material,
  hasStock: boolean
): FormData {
  return {
    item_code: material.item_code || '',
    item_name: material.name || '',
    display_name: material.display_name || '',
    main_category: material.main_category || '',
    sub_category: material.sub_category || '',
    size: material.size || '',
    pressure_class: material.pressure_class || '',
    make: material.make || '',
    material: material.material || '',
    end_connection: material.end_connection || '',
    unit: material.unit || 'nos',
    has_alternative_unit: !!(material.material_units && material.material_units.length > 0),
    alternative_units: material.material_units
      ? material.material_units.map((u: MaterialUnit) => ({
          unit_name: u.unit_name,
          conversion_factor: u.conversion_factor.toString(),
        }))
      : [],
    sale_price: material.sale_price ? String(material.sale_price) : '',
    purchase_price: material.purchase_price ? String(material.purchase_price) : '',
    hsn_code: material.hsn_code || '',
    gst_rate: material.gst_rate || 18,
    is_active: material.is_active !== false,
    uses_variant: material.uses_variant || false,
    discount_category_id: material.discount_category_id || null,
    track_inventory: hasStock,
    dimension: material.dimension || '',
    dimension_unit: material.dimension_unit || 'cm',
    weight: material.weight ? String(material.weight) : '',
    weight_unit: material.weight_unit || 'kg',
    item_classification: material.item_classification || 'goods_sold',
    allow_purchase: material.allow_purchase !== false,
    allow_sales: material.allow_sales !== false,
    show_in_bom: material.show_in_bom !== false,
    is_manufactured: material.is_manufactured === true,
  };
}

/** Build warehouse stock map from stock records */
export function buildWarehouseStockMap(
  materialId: string,
  stock: { item_id: string; warehouse_id: string; company_variant_id: string | null; current_stock: number }[]
): WarehouseStockMap {
  const stockMap: WarehouseStockMap = {};
  const itemRecords = stock.filter((s) => s.item_id === materialId);
  itemRecords.forEach((record) => {
    const vId = record.company_variant_id || 'no_variant';
    stockMap[`${record.warehouse_id}_${vId}`] = {
      exclude: false,
      current_stock: record.current_stock || 0,
    };
  });
  return stockMap;
}

/** Map from DB row to VariantPricingRow for editor */
export function variantPricingFromDb(rows: any[]): VariantPricingRow[] {
  return rows.map((r) => ({
    id: r.id || Date.now() + Math.random(),
    company_variant_id: r.company_variant_id || '',
    make: r.make || '',
    sale_price: r.sale_price ? String(r.sale_price) : '',
    purchase_price: r.purchase_price ? String(r.purchase_price) : '',
  }));
}
