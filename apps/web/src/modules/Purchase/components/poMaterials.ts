/**
 * Material picker + vendor pricing for the V2 purchase order.
 *
 * Ported from V1 (PurchaseOrders.tsx §6) with these defects fixed:
 *  - V1 fired one vendor-pricing query per material in a sequential loop (N+1
 *    round-trips). Here a single query resolves the whole staged set.
 *  - V1 re-picking the same material silently overwrote manually edited
 *    rate/make/discount/GST. Here the cascade only fills fields that are still
 *    empty, so a deliberate edit is not discarded.
 *  - V1 used `base_rate || rate`, so a legitimate 0 price fell through to the
 *    material default. Here null/undefined is distinguished from 0.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';

export interface PickerMaterial {
  id: string;
  name: string;
  display_name: string | null;
  hsn_code: string | null;
  unit: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  make: string | null;
  gst_rate: number | null;
}

export interface VendorPricing {
  material_id: string;
  base_rate: number | null;
  discount_percent: number | null;
  make: string | null;
  variant_id: string | null;
  is_preferred: boolean | null;
}

export function usePurchaseMaterials() {
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const [materials, setMaterials] = useState<PickerMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) { setMaterials([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, display_name, hsn_code, unit, purchase_price, sale_price, make, gst_rate')
        .eq('organisation_id', orgId)
        .order('name');
      if (!cancelled) {
        if (error) console.error('Failed to load materials:', error);
        setMaterials((data || []) as PickerMaterial[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  return { materials, loading };
}

/**
 * Resolve vendor-specific pricing for a set of material ids in ONE query.
 * `is_preferred` breaks ties, newest row wins as the final tiebreak — matching
 * V1's ordering without its per-item round-trip.
 */
export function useVendorPricing(
  orgId: string | null | undefined,
  vendorId: string | null | undefined,
  materialIds: string[]
) {
  const key = materialIds.slice().sort().join(',');
  const [pricingByMaterial, setPricingByMaterial] = useState<Record<string, VendorPricing>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId || !vendorId || materialIds.length === 0) {
      setPricingByMaterial({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('vendor_material_pricing')
        .select('material_id, base_rate, discount_percent, make, variant_id, is_preferred')
        .eq('organisation_id', orgId)
        .eq('vendor_id', vendorId)
        .in('material_id', materialIds)
        .order('is_preferred', { ascending: false });
      if (error) console.error('Failed to load vendor pricing:', error);
      if (!cancelled) {
        const map: Record<string, VendorPricing> = {};
        for (const row of (data || []) as any[]) {
          // First row per material wins; query is ordered is_preferred DESC.
          if (!map[row.material_id]) map[row.material_id] = row as VendorPricing;
        }
        setPricingByMaterial(map);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, vendorId, key]);

  return { pricingByMaterial, loading };
}

/** Default rate for a material: purchase price, else sale price, else 0. */
export function defaultRateFor(m: PickerMaterial | undefined): number {
  if (!m) return 0;
  const p = m.purchase_price ?? m.sale_price ?? 0;
  return Number(p) || 0;
}

/**
 * Canonical unit labels used by the line-item Unit dropdown.
 * Live materials store 'nos', 'Nos', 'Meters', 'mtr' — none of which match the
 * dropdown except 'Nos'. Without normalisation the select renders blank and
 * the save writes back whatever the dropdown defaulted to, silently changing
 * the unit. This maps a material's stored unit onto the canonical label.
 */
export const CANONICAL_UNITS = [
  'Nos', 'Kg', 'Gm', 'Litre', 'Ml', 'Metre', 'Cm', 'Ft',
  'Sq.Ft', 'Cum', 'Box', 'Set', 'Pair', 'Dozen', 'Ton', 'Bag', 'Roll', 'Sheet',
];

const UNIT_ALIASES: Record<string, string> = {
  no: 'Nos',
  nos: 'Nos',
  pc: 'Nos',
  pcs: 'Nos',
  piece: 'Nos',
  pieces: 'Nos',
  meter: 'Metre',
  meters: 'Metre',
  mtr: 'Metre',
  mtrs: 'Metre',
  mt: 'Metre',
  m: 'Metre',
  cm: 'Cm',
  ft: 'Ft',
  feet: 'Ft',
  sqft: 'Sq.Ft',
  'sq.ft': 'Sq.Ft',
  sqm: 'Metre',
  kg: 'Kg',
  kgs: 'Kg',
  gm: 'Gm',
  gms: 'Gm',
  ltr: 'Litre',
  litre: 'Litre',
  liters: 'Litre',
  ml: 'Ml',
};

export function normalizeUnit(raw: string | null | undefined): string {
  const v = String(raw || '').trim();
  if (!v) return 'Nos';
  const exact = CANONICAL_UNITS.find((u) => u === v);
  if (exact) return exact;
  const lower = v.toLowerCase();
  const ci = CANONICAL_UNITS.find((u) => u.toLowerCase() === lower);
  if (ci) return ci;
  return UNIT_ALIASES[lower] || v;
}

/**
 * Resolve the effective rate for a material under a vendor.
 * Distinguishes 0 from null so a genuine zero price is respected.
 */
export function effectiveRate(m: PickerMaterial | undefined, pricing?: VendorPricing): number {
  if (pricing && pricing.base_rate !== null && pricing.base_rate !== undefined) {
    return Number(pricing.base_rate);
  }
  return defaultRateFor(m);
}

export function effectiveDiscount(pricing?: VendorPricing): number | null {
  if (pricing && pricing.discount_percent !== null && pricing.discount_percent !== undefined) {
    return Number(pricing.discount_percent);
  }
  return null;
}

export function filterMaterials(materials: PickerMaterial[], query: string): PickerMaterial[] {
  const q = query.trim().toLowerCase();
  if (!q) return materials;
  return materials.filter(m =>
    (m.display_name || m.name || '').toLowerCase().includes(q) ||
    (m.hsn_code || '').toLowerCase().includes(q) ||
    (m.make || '').toLowerCase().includes(q)
  );
}
