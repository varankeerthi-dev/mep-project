import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useVariants } from '@/hooks/useVariants';
import { useInvoiceTemplates } from '../../hooks';
import { fetchArcPricingForItems } from '@/lib/arc-pricing';
import type {
  ClientShippingAddress,
  InvoiceClientOption,
  InvoiceMaterialOption,
} from '../../ui-utils';

export async function loadClientOptions(organisationId: string): Promise<InvoiceClientOption[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, gst_number, state, city, address1, address2, pincode, contact, email, discount_type, discount_profile_id, standard_pricelist_id, custom_discounts, default_template_id')
    .eq('organisation_id', organisationId)
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((client: any) => ({
    id: String(client.id),
    name: String(client.name ?? 'Unnamed client'),
    gst_number: client.gst_number ?? null,
    state: client.state ?? null,
    city: client.city ?? null,
    address1: client.address1 ?? null,
    address2: client.address2 ?? null,
    pincode: client.pincode ?? null,
    contact: client.contact ?? null,
    email: client.email ?? null,
    discount_type: client.discount_type ?? null,
    discount_profile_id: client.discount_profile_id ?? null,
    standard_pricelist_id: client.standard_pricelist_id ?? null,
    custom_discounts: client.custom_discounts ?? {},
    default_template_id: client.default_template_id ?? null,
  }));
}

export async function loadMaterialOptions(organisationId: string): Promise<InvoiceMaterialOption[]> {
  const { data: materialsData, error: materialsError } = await supabase
    .from('materials')
    .select('id, name, display_name, hsn_code, make, unit, sale_price, material, size, item_classification, discount_category_id, material_units(unit_name, conversion_factor)')
    .eq('organisation_id', organisationId);
  if (materialsError) throw materialsError;

  const { data: variantPricingData, error: pricingError } = await supabase
    .from('item_variant_pricing')
    .select('item_id, company_variant_id, make, sale_price')
    .in('item_id', (materialsData ?? []).map(m => m.id));

  if (pricingError) {
    console.warn('Failed to fetch variant pricing:', pricingError);
  }

  const variantIds = Array.from(
    new Set((variantPricingData ?? []).map((row: any) => row.company_variant_id).filter(Boolean))
  );

  const variantNameMap: Record<string, string> = {};
  if (variantIds.length > 0) {
    const { data: variantRows } = await supabase
      .from('company_variants')
      .select('id, variant_name')
      .in('id', variantIds);
    (variantRows ?? []).forEach((row: any) => {
      variantNameMap[row.id] = row.variant_name || '';
    });
  }

  const pricingMap: Record<string, { variant_id: string | null; make: string; sale_price: number; variant_name: string | null }[]> = {};
  (variantPricingData ?? []).forEach((row: any) => {
    if (!pricingMap[row.item_id]) {
      pricingMap[row.item_id] = [];
    }
    pricingMap[row.item_id].push({
      variant_id: row.company_variant_id || null,
      make: row.make || '',
      sale_price: row.sale_price || 0,
      variant_name: row.company_variant_id ? (variantNameMap[row.company_variant_id] || null) : null,
    });
  });

  return (materialsData ?? [])
    .map((material: any) => {
      const materialVariants = pricingMap[material.id] || [];
      if (materialVariants.length === 0) {
        return {
          id: String(material.id),
          name: String(material.display_name ?? material.name ?? 'Unnamed material'),
          display_name: material.display_name,
          hsn_code: material.hsn_code ?? null,
          make: material.make || material.material || null,
          unit: material.unit || 'nos',
          sale_price: material.sale_price || null,
          item_classification: material.item_classification || null,
          discount_category_id: material.discount_category_id ?? null,
          variants: [],
          material_units: material.material_units || [],
        };
      }

      const firstVariant = materialVariants[0];
      return {
        id: String(material.id),
        name: String(material.display_name ?? material.name ?? 'Unnamed material'),
        display_name: material.display_name,
        hsn_code: material.hsn_code ?? null,
        make: firstVariant.make || null,
        unit: material.unit || 'nos',
        sale_price: firstVariant.sale_price || null,
        item_classification: material.item_classification || null,
        discount_category_id: material.discount_category_id ?? null,
        variants: materialVariants,
        material_units: material.material_units || [],
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name)) as InvoiceMaterialOption[];
}

export async function loadClientShippingAddresses(clientId: string, organisationId: string): Promise<ClientShippingAddress[]> {
  const { data, error } = await supabase
    .from('client_shipping_addresses')
    .select('*')
    .eq('client_id', clientId)
    .eq('organisation_id', organisationId)
    .order('is_default', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((addr: any) => ({
    id: String(addr.id),
    address_line1: addr.address_line1,
    address_line2: addr.address_line2,
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
    contact_person: addr.contact_person,
    contact_phone: addr.contact_phone,
    is_default: addr.is_default,
  }));
}

export async function loadClientDetails(clientId: string, organisationId: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, gst_number, state, city, address1, address2, pincode, contact, email')
    .eq('id', clientId)
    .eq('organisation_id', organisationId)
    .single();

  if (error) throw error;
  return data;
}

async function loadOrganisationStock(organisationId: string) {
  const { data, error } = await supabase
    .from('item_stock')
    .select('item_id, warehouse_id, company_variant_id, current_stock')
    .eq('organisation_id', organisationId);

  if (error) throw error;
  return data || [];
}

async function loadItemVariantIdsMap(organisationId: string) {
  const { data: orgMaterials } = await supabase
    .from('materials')
    .select('id')
    .eq('organisation_id', organisationId);
  const orgMaterialIds = new Set((orgMaterials ?? []).map((m: any) => m.id));

  const { data, error } = await supabase
    .from('item_variant_pricing')
    .select('item_id, company_variant_id, make');

  if (error) throw error;

  const variantIdsMap: Record<string, string[]> = {};
  const makesMap: Record<string, string[]> = {};
  (data ?? []).forEach((row: any) => {
    if (!row?.item_id) return;
    if (!orgMaterialIds.has(row.item_id)) return;

    if (row.company_variant_id) {
      if (!variantIdsMap[row.item_id]) variantIdsMap[row.item_id] = [];
      if (!variantIdsMap[row.item_id].includes(row.company_variant_id)) {
        variantIdsMap[row.item_id].push(row.company_variant_id);
      }
    }

    const make = (row.make || '').trim();
    if (make) {
      if (!makesMap[row.item_id]) makesMap[row.item_id] = [];
      if (!makesMap[row.item_id].includes(make)) {
        makesMap[row.item_id].push(make);
      }
    }
  });
  return { variantIdsMap, makesMap };
}

export type InvoiceEditorData = ReturnType<typeof useInvoiceEditorData>;

/**
 * Central data layer for the V2 invoice editor: reference data queries,
 * client-discount resolution, stock/variant lookups and ARC pricing.
 */
export function useInvoiceEditorData(params: {
  organisationId?: string;
  selectedClientId?: string;
  selectedShippingAddressId?: string | null;
  watchedItems: any[];
  useArcPricing: boolean;
}) {
  const {
    organisationId,
    selectedClientId,
    selectedShippingAddressId,
    watchedItems,
    useArcPricing,
  } = params;

  const clientsQuery = useQuery({
    queryKey: ['invoice-clients', organisationId],
    queryFn: () => loadClientOptions(organisationId!),
    enabled: Boolean(organisationId),
  });

  const materialsQuery = useQuery({
    queryKey: ['invoice-materials', organisationId],
    queryFn: () => loadMaterialOptions(organisationId!),
    enabled: Boolean(organisationId),
  });

  const templatesQuery = useInvoiceTemplates();

  const warehousesQuery = useWarehouses();
  const { data: variantRows = [] } = useVariants();

  const shippingAddressesQuery = useQuery({
    queryKey: ['invoice-ui', 'shipping-addresses', selectedClientId, organisationId],
    queryFn: () => loadClientShippingAddresses(selectedClientId!, organisationId!),
    enabled: Boolean(selectedClientId && organisationId),
    staleTime: 5 * 60 * 1000,
  });

  const clientDetailsQuery = useQuery({
    queryKey: ['invoice-ui', 'client-details', selectedClientId, organisationId],
    queryFn: () => loadClientDetails(selectedClientId!, organisationId!),
    enabled: Boolean(selectedClientId && organisationId),
    staleTime: 5 * 60 * 1000,
  });

  const selectedShippingAddress = useMemo(() => {
    if (selectedShippingAddressId === '' && clientDetailsQuery.data) {
      const client = clientDetailsQuery.data;
      return {
        id: 'same-as-billing',
        address_line1: client.address1 || '',
        address_line2: client.address2 || '',
        city: client.city || '',
        state: client.state || '',
        pincode: client.pincode || '',
        contact_person: client.contact || '',
        contact_phone: client.email || '',
        is_default: false,
      };
    }

    if (!selectedShippingAddressId || !shippingAddressesQuery.data) return null;
    return shippingAddressesQuery.data.find(addr => addr.id === selectedShippingAddressId) || null;
  }, [selectedShippingAddressId, shippingAddressesQuery.data, clientDetailsQuery.data]);

  const itemVariantIdsMapQuery = useQuery({
    queryKey: ['invoice-ui', 'item-variant-ids', organisationId],
    queryFn: () => loadItemVariantIdsMap(organisationId!),
    enabled: Boolean(organisationId),
    staleTime: 5 * 60 * 1000,
  });

  const stockQuery = useQuery({
    queryKey: ['item-stock', organisationId],
    queryFn: () => loadOrganisationStock(organisationId!),
    enabled: Boolean(organisationId),
    staleTime: 2 * 60 * 1000,
  });

  const arcPricingQuery = useQuery({
    queryKey: ['arc-pricing', 'items', selectedClientId, watchedItems],
    queryFn: async () => {
      if (!useArcPricing || !selectedClientId) return {};

      const itemIds = watchedItems
        .map((item: any) => item.meta_json?.material_id)
        .filter(Boolean);

      if (itemIds.length === 0) return {};

      return fetchArcPricingForItems(selectedClientId, itemIds as string[]);
    },
    enabled: useArcPricing && Boolean(selectedClientId) && watchedItems.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const [arcPricingMap, setArcPricingMap] = useState<Record<string, any>>({});

  const discountCategoriesQuery = useQuery({
    queryKey: ['discount-categories', organisationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_categories')
        .select('id, name, default_discount_percent, min_discount_percent, max_discount_percent')
        .or(`organisation_id.eq.${organisationId},organisation_id.is.null`)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(organisationId),
    staleTime: 5 * 60 * 1000,
  });

  const discountCategoryMap = useMemo(() => {
    const map: Record<string, {
      name?: string | null;
      default_discount_percent?: number | string | null;
      min_discount_percent?: number | string | null;
      max_discount_percent?: number | string | null;
    }> = {};
    (discountCategoriesQuery.data ?? []).forEach((c: any) => {
      map[String(c.id)] = {
        name: c.name ?? null,
        default_discount_percent: c.default_discount_percent ?? null,
        min_discount_percent: c.min_discount_percent ?? null,
        max_discount_percent: c.max_discount_percent ?? null,
      };
    });
    return map;
  }, [discountCategoriesQuery.data]);

  useEffect(() => {
    if (arcPricingQuery.data) {
      setArcPricingMap(arcPricingQuery.data);
    }
  }, [arcPricingQuery.data]);

  // ── Client header discounts (pricelist / discount structure) ──
  const [headerDiscounts, setHeaderDiscounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadDiscounts() {
      if (!selectedClientId) {
        setHeaderDiscounts({});
        return;
      }

      const client = clientsQuery.data?.find(c => c.id === selectedClientId);
      if (!client) return;

      const newDiscounts: Record<string, number> = {};
      const customDiscounts = client.custom_discounts || {};

      try {
        if (client.discount_type === 'Standard' && client.standard_pricelist_id) {
          const { data: pl } = await supabase
            .from('standard_discount_pricelists')
            .select('discount_percent')
            .eq('id', client.standard_pricelist_id)
            .single();

          if (pl) {
            const flatDisc = parseFloat(pl.discount_percent) || 0;
            variantRows.forEach((v: any) => {
              newDiscounts[v.id] = flatDisc;
            });
          }
        } else {
          let structId = client.discount_profile_id;

          if (!structId) {
            const structName = client.discount_type || 'Special';
            const { data } = await supabase
              .from('discount_structures')
              .select('id')
              .eq('structure_name', structName)
              .eq('organisation_id', organisationId)
              .maybeSingle();
            if (data) structId = data.id;
          }

          if (structId) {
            const { data: varSettings } = await supabase
              .from('discount_variant_settings')
              .select('variant_id, default_discount_percent')
              .eq('structure_id', structId)
              .eq('organisation_id', organisationId);

            varSettings?.forEach((s: any) => {
              const variantId = s.variant_id;
              const customDisc = customDiscounts[variantId] !== undefined
                ? customDiscounts[variantId]
                : (parseFloat(s.default_discount_percent) || 0);
              newDiscounts[variantId] = customDisc;
            });
          }
        }
      } catch (err) {
        console.error('Error loading client discounts:', err);
      }

      setHeaderDiscounts(newDiscounts);
    }

    loadDiscounts();
  }, [selectedClientId, clientsQuery.data, variantRows, organisationId]);

  return {
    clientsQuery,
    materialsQuery,
    templatesQuery,
    warehousesQuery,
    variantRows,
    shippingAddressesQuery,
    clientDetailsQuery,
    selectedShippingAddress,
    itemVariantIdsMapQuery,
    stockQuery,
    arcPricingMap,
    setArcPricingMap,
    headerDiscounts,
    setHeaderDiscounts,
    discountCategoriesQuery,
    discountCategoryMap,
  };
}