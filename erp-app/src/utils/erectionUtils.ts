import { supabase } from '../supabase';
import { QuotationItemExtended } from '../types/erection';
import { lookupServiceRate } from '../hooks/useErectionCharges';

/**
 * Auto-creates or updates an erection charge when a material is added/modified.
 *
 * @param materialItem - The material item that was added/updated
 * @returns Promise<void>
 */
export async function autoCreateOrUpdateErection(materialItem: QuotationItemExtended): Promise<void> {
  console.log('autoCreateOrUpdateErection called with:', materialItem);

  // EDGE CASE: Skip if this IS an erection item
  if (materialItem.section === 'erection') {
    console.log('Skipping - this is an erection item');
    return;
  }

  // EDGE CASE: Skip if user previously deleted erection for this material
  if (materialItem.erection_manually_removed) {
    console.log('Skipping - erection was manually removed');
    return;
  }

  // EDGE CASE: Skip if no quotation_id
  if (!materialItem.quotation_id) {
    console.log('Skipping - no quotation_id (quotation not saved yet)');
    return;
  }

  // Get the material name for lookup
  const itemName = materialItem.description || materialItem.item_id || '';
  if (!itemName) {
    console.log('Skipping - no material name');
    return;
  }

  console.log('Looking up service rate for:', itemName);

  // EDGE CASE: Look up service rate - if not found, don't create erection
  const serviceRate = await lookupServiceRate(itemName);
  if (!serviceRate) {
    console.log('No service rate found for:', itemName);
    return; // Silent - no error
  }

  console.log('Service rate found:', serviceRate);

  // Check if erection already exists for this material
  const { data: existingErection } = await supabase
    .from('quotation_items')
    .select('*')
    .eq('section', 'erection')
    .eq('linked_material_id', String(materialItem.id))
    .single();

  if (existingErection) {
    // UPDATE existing erection (qty/uom sync)
    const updateData: any = {
      qty: materialItem.qty,
      uom: materialItem.uom,
      description: `${itemName} - Erection`,
      updated_at: new Date().toISOString()
    };

    // Only update rate if user hasn't manually edited it
    if (!existingErection.rate_manually_edited) {
      updateData.rate = serviceRate.default_erection_rate;
    }

    console.log('Updating existing erection:', updateData);
    await supabase
      .from('quotation_items')
      .update(updateData)
      .eq('id', existingErection.id);
  } else {
    // CREATE new erection item
    const newErection = {
      quotation_id: materialItem.quotation_id,
      section: 'erection',
      description: `${itemName} - Erection`,
      qty: materialItem.qty,
      uom: materialItem.uom,
      rate: serviceRate.default_erection_rate,
      tax_percent: materialItem.tax_percent || 0,
      line_total: (materialItem.qty || 0) * serviceRate.default_erection_rate,
      linked_material_id: String(materialItem.id),
      is_auto_quantity: true,
      rate_manually_edited: false,
      sac_code: serviceRate.sac_code || null,
      created_at: new Date().toISOString()
    };

    console.log('Creating new erection:', newErection);
    const { error } = await supabase
      .from('quotation_items')
      .insert(newErection);

    if (error) {
      console.error('Error creating erection:', error);
    } else {
      console.log('Erection created successfully');
    }
  }
}

/**
 * Updates the erection item name when the linked material name changes.
 * 
 * @param erectionId - The erection item ID
 * @param newMaterialName - The new material name
 */
export async function updateErectionName(erectedId: string, newMaterialName: string): Promise<void> {
  await supabase
    .from('quotation_items')
    .update({
      description: `${newMaterialName} - Erection`,
      updated_at: new Date().toISOString()
    })
    .eq('id', erectedId);
}

/**
 * Checks if a material has a linked erection item.
 * 
 * @param materialId - The material item ID
 * @returns Promise<boolean>
 */
export async function hasLinkedErection(materialId: string): Promise<boolean> {
  const { data } = await supabase
    .from('quotation_items')
    .select('id')
    .eq('section', 'erection')
    .eq('linked_material_id', String(materialId))
    .single();
  
  return !!data;
}

/**
 * Gets the linked erection item for a material.
 * 
 * @param materialId - The material item ID
 * @returns Promise<QuotationItemExtended | null>
 */
export async function getLinkedErection(materialId: string): Promise<QuotationItemExtended | null> {
  const { data, error } = await supabase
    .from('quotation_items')
    .select('*')
    .eq('section', 'erection')
    .eq('linked_material_id', String(materialId))
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  
  return data;
}
