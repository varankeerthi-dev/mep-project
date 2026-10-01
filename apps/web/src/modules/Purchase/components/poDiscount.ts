/**
 * Purchase-order discount categories and variant pricing.
 *
 * Mirrors the CreateQuotation pattern (pages/CreateQuotation/index.tsx:283-303,
 * components/QuotationHeaderForm.tsx:513-541) so the two documents behave the
 * same way when a user moves between them:
 *
 *   - `discount_categories` rows drive a "Pricing Rules" panel in the header.
 *     Each row sets a header-level discount percentage that is applied to every
 *     line whose material carries that category.
 *   - A line's own discount cell is a manual OVERRIDE of the category discount.
 *     It starts at the category value and only diverges once edited, which is
 *     what `is_override` records.
 *
 * Live schema verified 2026-09-30:
 *   discount_categories: id, name, default_discount_percent, min_discount_percent,
 *                        max_discount_percent, is_active, organisation_id
 *   2 active rows live ("Distributor" 20%, "PIPE-GREEN" 58%), one org-scoped and
 *   one global — so the query must accept both, like CreateQuotation does.
 *   materials.discount_category_id exists; 2 of 13 materials are categorised.
 *   vendor_material_pricing has a variant_id column, so vendor pricing is
 *   variant-aware and the Variant column has real data behind it.
 *
 * Note: there is no `variants` table (confirmed live). CreateQuotation's
 * useVariants hook points elsewhere; here the variant set is derived from the
 * variant_id values that actually exist in vendor_material_pricing for the
 * materials on this order, which is the only variant source this module owns.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../supabase';

export interface DiscountCategory {
  id: string;
  name: string;
  default_discount_percent: number | null;
  min_discount_percent: number | null;
  max_discount_percent: number | null;
  is_active: boolean | null;
  organisation_id: string | null;
}

export interface MaterialCategory {
  materialId: string;
  discountCategoryId: string | null;
  discountCategoryName: string | null;
}

export interface VariantOption {
  id: string;
  label: string;
  base_rate: number | null;
  discount_percent: number | null;
  make: string | null;
}

/**
 * Active discount categories for an org, including global (organisation_id IS
 * NULL) rows. Ordering by name, matching CreateQuotation.
 */
export function useDiscountCategories(orgId: string | null | undefined) {
  const [categories, setCategories] = useState<DiscountCategory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) { setCategories([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('discount_categories')
        .select('id, name, default_discount_percent, min_discount_percent, max_discount_percent, is_active, organisation_id')
        .or(`organisation_id.eq.${orgId},organisation_id.is.null`)
        .eq('is_active', true)
        .order('name');
      if (error) console.error('[poDiscount] categories:', error);
      if (!cancelled) {
        setCategories((data || []) as DiscountCategory[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  // name + bounds lookup for the line-item badge and the header rules panel
  const byId = useMemo(() => {
    const m: Record<string, DiscountCategory> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  return { categories, categoryById: byId, loading };
}

/**
 * Map every material to its discount category, so a line can show the badge and
 * inherit the category discount the moment a material is picked.
 */
export function useMaterialCategories(
  orgId: string | null | undefined,
  materialIds: string[],
) {
  const [map, setMap] = useState<Record<string, MaterialCategory>>({});

  const key = materialIds.slice().sort().join(',');
  useEffect(() => {
    if (!orgId || materialIds.length === 0) { setMap({}); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, discount_category_id, discount_categories(name)')
        .eq('organisation_id', orgId)
        .in('id', materialIds);
      if (error) console.error('[poDiscount] material categories:', error);
      if (cancelled) return;
      const next: Record<string, MaterialCategory> = {};
      for (const m of (data || []) as any[]) {
        const dc = Array.isArray(m.discount_categories) ? m.discount_categories[0] : m.discount_categories;
        next[m.id] = {
          materialId: m.id,
          discountCategoryId: m.discount_category_id || null,
          discountCategoryName: dc?.name || null,
        };
      }
      setMap(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, key]);

  return map;
}

/**
 * Variant options for the materials on this order, derived from
 * vendor_material_pricing. There is no `variants` table in this database, so
 * the vendor's own priced variants are the authoritative list — and they are
 * the only ones that affect the rate anyway.
 *
 * Also returns the distinct makes this vendor prices for these materials, so a
 * header-level "Default make" can re-tag every line the same way
 * CreateQuotation's default-variant control re-prices them.
 */
export function useVendorVariants(
  orgId: string | null | undefined,
  vendorId: string | null | undefined,
  materialIds: string[],
) {
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [pricingByVariant, setPricingByVariant] = useState<Record<string, Record<string, any>>>({});
  const [loading, setLoading] = useState(false);

  const key = materialIds.slice().sort().join(',');
  useEffect(() => {
    if (!orgId || !vendorId || materialIds.length === 0) {
      setVariants([]);
      setMakes([]);
      setPricingByVariant({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('vendor_material_pricing')
        .select('material_id, variant_id, base_rate, discount_percent, make')
        .eq('organisation_id', orgId)
        .eq('vendor_id', vendorId)
        .in('material_id', materialIds);
      if (error) console.error('[poDiscount] variants:', error);
      if (cancelled) return;

      // variant_id -> display label. vendor_material_pricing stores no name, so
      // the id is the label; a real name would need a catalogue join.
      const seen = new Map<string, VariantOption>();
      const makeSet = new Set<string>();
      const byMat: Record<string, Record<string, any>> = {};
      for (const row of (data || []) as any[]) {
        if (row.make) makeSet.add(String(row.make));
        if (!row.variant_id) continue;
        if (!seen.has(row.variant_id)) {
          seen.set(row.variant_id, {
            id: row.variant_id,
            label: row.variant_id,
            base_rate: row.base_rate ?? null,
            discount_percent: row.discount_percent ?? null,
            make: row.make ?? null,
          });
        }
        if (!byMat[row.material_id]) byMat[row.material_id] = {};
        if (!byMat[row.material_id][row.variant_id]) {
          byMat[row.material_id][row.variant_id] = row;
        }
      }
      setVariants([...seen.values()]);
      setMakes([...makeSet].sort());
      setPricingByVariant(byMat);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, vendorId, key]);

  return { variants, makes, pricingByVariant, loading };
}

/** Clamp a category discount into the category's own min/max band. */
export function clampCategoryDiscount(category: DiscountCategory | undefined, value: number): number {
  const v = Number.isFinite(value) ? value : 0;
  const min = category?.min_discount_percent != null ? Number(category.min_discount_percent) : 0;
  const max = category?.max_discount_percent != null ? Number(category.max_discount_percent) : 100;
  return Math.max(0, Math.min(max, Math.max(min, v)));
}
