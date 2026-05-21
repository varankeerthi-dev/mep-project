import { supabase } from '../supabase';

/**
 * Interface for material_client_pricing table
 * This stores client-specific ARC (Alternate Rate for Client) pricing
 */
export interface MaterialClientPricingRow {
  id: string;
  material_id: string;
  client_id: string;
  company_variant_id: string | null;
  pricing_type: string;
  rate: number | null;
  valid_from: string | null;
  valid_to: string | null;
  status: string;
  organisation_id: string;
  created_at: string;
  updated_at: string;
}

export interface ArcPricingRow {
  item_id: string;
  arc_rate: number;
  company_variant_id: string | null;
  pricing_type: string;
  is_active: boolean;
}

/**
 * Fetch ARC rates for multiple items for a client in a single query.
 * Uses material_client_pricing table.
 * Returns all ARC rates including variant-specific ones.
 * 
 * @param clientId - The client ID
 * @param itemIds - Array of item IDs to fetch ARC rates for
 * @returns Record mapping itemId to array of ArcPricingRow (all variants)
 */
export async function fetchArcPricingForItems(
  clientId: string,
  itemIds: string[]
): Promise<Record<string, ArcPricingRow[]>> {
  if (!clientId || itemIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('material_client_pricing')
    .select('material_id, rate, company_variant_id, pricing_type, status')
    .eq('client_id', clientId)
    .in('material_id', itemIds)
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching ARC pricing:', error);
    throw error;
  }

  // Initialize result with empty arrays for all itemIds
  const result: Record<string, ArcPricingRow[]> = {};
  itemIds.forEach(id => {
    result[id] = [];
  });

  // Map data to result - collect ALL ARC rates per item
  data?.forEach(row => {
    if (row.material_id && row.rate !== null) {
      const arcRow: ArcPricingRow = {
        item_id: row.material_id,
        arc_rate: Number(row.rate),
        company_variant_id: row.company_variant_id || null,
        pricing_type: row.pricing_type || 'Fixed ARC',
        is_active: row.status === 'active',
      };
      result[row.material_id].push(arcRow);
    }
  });

  return result;
}

/**
 * Get ARC rate for a specific item + variant combination.
 * Prioritizes variant-specific rate, falls back to item-level rate.
 * 
 * @param clientId - The client ID
 * @param itemId - The item/material ID
 * @param variantId - Optional company variant ID
 * @returns The ARC rate or null if not found
 */
export async function getArcRate(
  clientId: string,
  itemId: string,
  variantId?: string | null
): Promise<number | null> {
  if (!clientId || !itemId) {
    return null;
  }

  // Fetch all ARC rates for this item
  const { data, error } = await supabase
    .from('material_client_pricing')
    .select('rate, company_variant_id')
    .eq('client_id', clientId)
    .eq('material_id', itemId)
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching ARC rate:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Try variant-specific rate first
  if (variantId) {
    const variantRate = data.find(r => r.company_variant_id === variantId);
    if (variantRate && variantRate.rate !== null) {
      return Number(variantRate.rate);
    }
  }

  // Fall back to item-level rate (where company_variant_id is null)
  const itemLevelRate = data.find(r => r.company_variant_id === null);
  if (itemLevelRate && itemLevelRate.rate !== null) {
    return Number(itemLevelRate.rate);
  }

  return null;
}

/**
 * Get variant-specific ARC rate from a pre-fetched map.
 * Use this when you already have the arcPricingMap from fetchArcPricingForItems.
 * 
 * @param arcPricingMap - Pre-fetched ARC pricing map
 * @param itemId - The item ID
 * @param variantId - Optional variant ID to check first
 * @returns The effective ARC rate (variant-specific or item-level)
 */
export function getArcRateFromMap(
  arcPricingMap: Record<string, ArcPricingRow[]>,
  itemId: string,
  variantId?: string | null
): number | null {
  const rates = arcPricingMap[itemId];
  if (!rates || rates.length === 0) {
    return null;
  }

  // Try variant-specific rate first
  if (variantId) {
    const variantRate = rates.find(r => r.company_variant_id === variantId);
    if (variantRate) {
      return variantRate.arc_rate;
    }
  }

  // Fall back to item-level rate (null company_variant_id)
  const itemLevelRate = rates.find(r => r.company_variant_id === null);
  if (itemLevelRate) {
    return itemLevelRate.arc_rate;
  }

  // If only variant-specific rates exist and no item-level, return the first variant rate
  if (rates.length > 0) {
    return rates[0].arc_rate;
  }

  return null;
}

/**
 * Get all ARC rates for a specific client.
 * Used in client settings to display all ARC rates.
 * 
 * @param clientId - The client ID
 * @returns Array of material client pricing rows
 */
export async function getArcRatesForClient(
  clientId: string
): Promise<MaterialClientPricingRow[]> {
  if (!clientId) {
    return [];
  }

  const { data, error } = await supabase
    .from('material_client_pricing')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching ARC rates for client:', error);
    throw error;
  }

  return (data as MaterialClientPricingRow[]) || [];
}

/**
 * Get all ARC rates for a specific item.
 * Used in item/material settings to display all client ARC rates.
 * 
 * @param itemId - The item/material ID
 * @returns Array of material client pricing rows
 */
export async function getArcRatesForItem(
  itemId: string
): Promise<MaterialClientPricingRow[]> {
  if (!itemId) {
    return [];
  }

  const { data, error } = await supabase
    .from('material_client_pricing')
    .select('*')
    .eq('material_id', itemId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching ARC rates for item:', error);
    throw error;
  }

  return (data as MaterialClientPricingRow[]) || [];
}

/**
 * Upsert ARC rate for a client-item pair.
 * Used in settings/client management.
 * 
 * @param clientId - The client ID
 * @param itemId - The item/material ID  
 * @param arcRate - The ARC rate value
 * @param variantId - Optional company variant ID
 * @returns True if upserted successfully
 */
export async function upsertArcRate(
  clientId: string,
  itemId: string,
  arcRate: number,
  variantId?: string | null,
  organisationId?: string
): Promise<boolean> {
  if (!clientId || !itemId) {
    console.error('Client ID and Item ID are required for upsertArcRate');
    return false;
  }

  // Check if record exists
  let existingRecord = null;
  if (variantId) {
    const { data } = await supabase
      .from('material_client_pricing')
      .select('id')
      .eq('client_id', clientId)
      .eq('material_id', itemId)
      .eq('company_variant_id', variantId)
      .limit(1);
    existingRecord = data?.[0];
  }

  if (!existingRecord) {
    const { data } = await supabase
      .from('material_client_pricing')
      .select('id')
      .eq('client_id', clientId)
      .eq('material_id', itemId)
      .is('company_variant_id', null)
      .limit(1);
    existingRecord = data?.[0];
  }

  const payload = {
    material_id: itemId,
    client_id: clientId,
    company_variant_id: variantId ?? null,
    pricing_type: 'Fixed ARC',
    rate: arcRate,
    status: 'active',
    organisation_id: organisationId,
    updated_at: new Date().toISOString(),
  };

  if (existingRecord) {
    const { error } = await supabase
      .from('material_client_pricing')
      .update(payload)
      .eq('id', existingRecord.id);

    if (error) {
      console.error('Error updating ARC rate:', error);
      return false;
    }
  } else {
    const { error } = await supabase
      .from('material_client_pricing')
      .insert(payload);

    if (error) {
      console.error('Error inserting ARC rate:', error);
      return false;
    }
  }

  return true;
}

/**
 * Delete ARC rate.
 * 
 * @param id - The material_client_pricing row ID
 * @returns True if deleted successfully
 */
export async function deleteArcRate(id: string): Promise<boolean> {
  if (!id) {
    console.error('ID is required for deleteArcRate');
    return false;
  }

  const { error } = await supabase
    .from('material_client_pricing')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting ARC rate:', error);
    return false;
  }

  return true;
}

/**
 * Calculate effective rate for an item.
 * Returns ARC rate if available and active, otherwise returns standard rate.
 * 
 * @param arcRate - The ARC rate (or null if not set)
 * @param standardRate - The standard sale price
 * @returns The effective rate to use
 */
export function getEffectiveRate(
  arcRate: number | null,
  standardRate: number
): number {
  return arcRate !== null ? arcRate : standardRate;
}

/**
 * Check if ARC pricing is available for an item.
 * 
 * @param arcPricingMap - Record of item IDs to ARC pricing rows
 * @param itemId - The item ID to check
 * @returns True if ARC pricing exists for the item
 */
export function hasArcPricing(
  arcPricingMap: Record<string, ArcPricingRow | null>,
  itemId: string
): boolean {
  return arcPricingMap[itemId] !== null && arcPricingMap[itemId] !== undefined;
}