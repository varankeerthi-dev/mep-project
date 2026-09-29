import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../../../supabase';
import { toast } from 'sonner';
import { timedSupabaseQuery } from '../../../utils/queryTimeout';
import { withTimeout, isTimeoutError } from '../utils/promiseTimeout';
import { useConvertDocument } from '../../../conversions/hooks';
import { useLastDocumentRates } from '../../../hooks/useLastDocumentRates';
import { normalizeQuickQuoteConfig } from '../../../quotation/quick-quote/api';
import type { QuickQuoteConfig } from '../../../quotation/quick-quote/types';
import { ApprovalIntegration } from '../../../approvals/integration';
import { useConversionStatus, getSourceTableName } from '../../../conversions/hooks';

const DEFAULT_PAYMENT_TERMS = 'Net 30 Days';

type QuoteSeriesCfg = {
  source: 'document_settings' | 'document_series';
  prefix: string;
  suffix: string;
  padding: number;
  nextNumber: number;
  legacyRow?: any;
};

type UseQuotationLoaderOptions = {
  organisationId?: string;
  editId?: string | null;
  duplicateId?: string | null;
  convertFrom?: string | null;
  sourceId?: string | null;
  clientId?: string | null;
  materials: any[];
  clients: any[];
  onSetVariantPricing: (v: Record<string, any>) => void;
  onSetItemMakes: (v: Record<string, any>) => void;
  onSetQuoteNoPreview: (v: string) => void;
  onSetFormData: (v: any) => void;
  onSetItems: (v: any[]) => void;
  onSetOriginalItems: (v: any[]) => void;
  onSetHeaderDiscounts: (v: Record<string, number>) => void;
  onSetDiscountSettings: (v: Record<string, any>) => void;
  onSetDiscountCategoryMap: (v: Record<string, any>) => void;
  onSetTemplateSettings: (v: any) => void;
  onSetQuickQuoteConfig: (v: QuickQuoteConfig | null) => void;
  onSetQuickQuoteTemplateId: (v: string) => void;
  onSetQuickQuoteVariantId: (v: string) => void;
  onSetQuickQuoteMake: (v: string) => void;
  onSetQuickQuoteSpec: (v: string) => void;
  onSetQuickQuoteIncludeValves: (v: boolean) => void;
  onSetQuickQuoteIncludeThreadItems: (v: boolean) => void;
  onSetDcAllocations: (v: any[]) => void;
  onSetApprovalHistory: (v: any[]) => void;
  onSetApprovalConfig: (v: any) => void;
  onSetClientShippingAddresses: (v: any[]) => void;
  onSetLastLoadedUpdatedAt: (v: string | null) => void;
};

type UseQuotationLoaderResult = {
  initQuery: ReturnType<typeof useQuery>;
  stockQuery: ReturnType<typeof useQuery>;
  warehousesQuery: ReturnType<typeof useQuery>;
  conversionQuery: ReturnType<typeof useConvertDocument>;
  arcPricingQuery: ReturnType<typeof useQuery>;
  lastRatesQuery: ReturnType<typeof useLastDocumentRates>;
  initLoading: boolean;
  initErrorMessage: string;
  warehouseNameById: Record<string, string>;
  stockRowsByItemId: Record<string, any[]>;
  loadQuotation: (id: string, isDuplicate?: boolean) => Promise<void>;
  fetchQuoteSeriesCfg: () => Promise<QuoteSeriesCfg | null>;
  fetchDefaultSeriesRow: () => Promise<any>;
  buildQuoteNoFromCfg: (cfg: QuoteSeriesCfg) => string;
  loadQuoteNoPreview: () => Promise<void>;
  loadClientDiscountPortfolio: (clientId: string) => Promise<{ discounts: Record<string, number>; settings: Record<string, any> }>;
  loadVariantDiscounts: (quotationId: string) => Promise<void>;
  loadApprovalData: (quotationId: string) => Promise<void>;
  refreshClientShippingAddresses: (clientId: string, orgId?: string) => Promise<void>;
  initializedRef: React.MutableRefObject<string | null>;
};

export function useQuotationLoader({
  organisationId,
  editId,
  duplicateId,
  convertFrom,
  sourceId,
  clientId,
  materials,
  clients,
  onSetVariantPricing,
  onSetItemMakes,
  onSetQuoteNoPreview,
  onSetFormData,
  onSetItems,
  onSetOriginalItems,
  onSetHeaderDiscounts,
  onSetDiscountSettings,
  onSetDiscountCategoryMap,
  onSetTemplateSettings,
  onSetQuickQuoteConfig,
  onSetQuickQuoteTemplateId,
  onSetQuickQuoteVariantId,
  onSetQuickQuoteMake,
  onSetQuickQuoteSpec,
  onSetQuickQuoteIncludeValves,
  onSetQuickQuoteIncludeThreadItems,
  onSetDcAllocations,
  onSetApprovalHistory,
  onSetApprovalConfig,
  onSetClientShippingAddresses,
  onSetLastLoadedUpdatedAt,
}: UseQuotationLoaderOptions): UseQuotationLoaderResult {
  const queryClient = useQueryClient();
  const initializedRef = useRef<string | null>(null);

  const initQuery = useQuery({
    queryKey: ['quotationInit', organisationId],
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async () => {
      const orgId = organisationId;
      const [pricing, settings, template, discountCatsRes] = await Promise.all([
        timedSupabaseQuery(
          orgId
            ? supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price, make').eq('organisation_id', orgId)
            : supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price, make'),
          'Quotation pricing',
        ),
        timedSupabaseQuery(
          orgId
            ? supabase.from('discount_settings').select('variant_id, default_discount_percent, min_discount_percent, max_discount_percent').eq('organisation_id', orgId).eq('is_active', true)
            : supabase.from('discount_settings').select('variant_id, default_discount_percent, min_discount_percent, max_discount_percent').eq('is_active', true),
          'Quotation discount settings',
        ),
        timedSupabaseQuery(
          orgId
            ? supabase.from('document_templates').select('id, column_settings').eq('document_type', 'Quotation').eq('is_default', true).or(`organisation_id.eq.${orgId},organisation_id.is.null`).limit(1).maybeSingle()
            : supabase.from('document_templates').select('id, column_settings').eq('document_type', 'Quotation').eq('is_default', true).limit(1).maybeSingle(),
          'Quotation template',
        ),
        orgId ? timedSupabaseQuery(
          supabase.from('discount_categories').select('*').or(`organisation_id.eq.${orgId},organisation_id.is.null`).eq('is_active', true).order('name'),
          'Discount categories',
        ) : Promise.resolve([]),
      ]);

      return {
        pricing: pricing || [],
        settings: settings || [],
        template: template || null,
        discountCategories: discountCatsRes || [],
        quickQuoteConfig: null,
        orgFullDetails: null
      };
    },
  });

  const stockQuery = useQuery({
    queryKey: ['quotation-item-stock', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      try {
        const { data, error } = await supabase
          .from('item_stock')
          .select('id, item_id, warehouse_id, company_variant_id, current_stock')
          .eq('organisation_id', organisationId);
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('Unable to load item stock:', err);
        return [];
      }
    },
    enabled: !!organisationId,
    staleTime: 60 * 1000,
  });

  const warehousesQuery = useQuery({
    queryKey: ['quotation-warehouses', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      try {
        const { data, error } = await supabase
          .from('warehouses')
          .select('id, warehouse_code, warehouse_name, name')
          .eq('organisation_id', organisationId)
          .eq('is_active', true)
          .order('warehouse_name');
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('Unable to load warehouses:', err);
        return [];
      }
    },
    enabled: !!organisationId,
    staleTime: 5 * 60 * 1000,
  });

  const conversionQuery = useConvertDocument(convertFrom!, sourceId!);

  const arcItemIds = useMemo(() => {
    return materials.map((item: any) => item.item_id).filter(Boolean);
  }, [materials]);

  const [useArcPricing, setUseArcPricing] = useState(false);
  const [arcPricingMap, setArcPricingMap] = useState<Record<string, any>>({});

  const arcPricingQuery = useQuery({
    queryKey: ['arc-pricing', 'items', materials, clientId, arcItemIds],
    queryFn: async () => {
      if (!useArcPricing || !clientId || arcItemIds.length === 0) return {};
      // @ts-ignore
      return fetchArcPricingForItems(clientId, arcItemIds);
    },
    enabled: useArcPricing && Boolean(clientId) && arcItemIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: lastRatesMap = {} } = useLastDocumentRates(clientId, arcItemIds);

  const initLoading = initQuery.isPending && !initQuery.data;
  const initErrorMessage = initQuery.error instanceof Error ? initQuery.error.message : 'Unable to load quotation setup data.';

  const warehouseNameById = useMemo(() => {
    const map: Record<string, string> = {};
    (warehousesQuery.data || []).forEach((w: any) => {
      map[w.id] = w.warehouse_name || w.name || w.warehouse_code || 'Warehouse';
    });
    return map;
  }, [warehousesQuery.data]);

  const stockRowsByItemId = useMemo(() => {
    const map: Record<string, any[]> = {};
    (stockQuery.data || []).forEach((r: any) => {
      if (!r?.item_id) return;
      (map[r.item_id] = map[r.item_id] || []).push(r);
    });
    return map;
  }, [stockQuery.data]);

  useEffect(() => {
    if (!initQuery.data) return;
    const { pricing } = initQuery.data;
    const pricingMap: any = {};
    const makesMap: any = {};
    
    (pricing || []).forEach((row) => {
      const itemId = row.item_id;
      const variantId = row.company_variant_id || 'no_variant';
      const make = row.make || '';
      
      if (!pricingMap[itemId]) pricingMap[itemId] = {};
      if (!pricingMap[itemId][variantId]) pricingMap[itemId][variantId] = {};
      pricingMap[itemId][variantId][make] = parseFloat(row.sale_price) || 0;
      
      if (make) {
        if (!makesMap[itemId]) makesMap[itemId] = new Set();
        makesMap[itemId].add(make);
      }
    });
    
    materials.forEach(m => {
      if (m.make) {
        if (!makesMap[m.id]) makesMap[m.id] = new Set();
        makesMap[m.id].add(m.make);
      }
    });

    const finalMakesMap: any = {};
    for (const id in makesMap) {
      finalMakesMap[id] = Array.from(makesMap[id]).sort();
    }

    onSetVariantPricing(pricingMap);
    onSetItemMakes(finalMakesMap);
  }, [initQuery.data, materials, onSetVariantPricing, onSetItemMakes]);

  useEffect(() => {
    if (arcPricingQuery.data) {
      onSetArcPricingMap?.(arcPricingQuery.data);
    }
  }, [arcPricingQuery.data]);

  useEffect(() => {
    if (!initQuery.data) return;
    
    const currentId = `${editId || ''}-${duplicateId || ''}`;
    if (initializedRef.current === currentId) return;

    const { settings, template, quickQuoteConfig: quickQuoteConfigRes } = initQuery.data;

    const materialsWithService = materials.map(item => ({
      ...item,
      isService: item.item_type === 'service'
    }));

    if (quickQuoteConfigRes) {
      const normalizedQuickQuote = normalizeQuickQuoteConfig(quickQuoteConfigRes, materialsWithService, initQuery.data.pricing || []);
      onSetQuickQuoteConfig(normalizedQuickQuote);
      onSetQuickQuoteTemplateId((prev) => prev || (normalizedQuickQuote.templates && normalizedQuickQuote.templates.length > 0 ? normalizedQuickQuote.templates[0]?.id : ''));
      onSetQuickQuoteVariantId((prev) => prev || normalizedQuickQuote.settings?.default_variant || '');
      onSetQuickQuoteMake((prev) => prev || normalizedQuickQuote.settings?.default_make || '');
      onSetQuickQuoteSpec((prev) => prev || normalizedQuickQuote.settings?.default_spec || '');
      onSetQuickQuoteIncludeValves(normalizedQuickQuote.settings?.enable_valves ?? true);
      onSetQuickQuoteIncludeThreadItems(normalizedQuickQuote.settings?.enable_thread_items ?? true);
    } else {
      onSetQuickQuoteConfig(null);
    }

    const settingsMap: any = {};
    (settings || []).forEach((row) => {
      settingsMap[row.variant_id] = {
        default: parseFloat(row.default_discount_percent) || 0,
        min: parseFloat(row.min_discount_percent) || 0,
        max: parseFloat(row.max_discount_percent) || 0
      };
    });
    onSetDiscountSettings(settingsMap);

    const dcMap: any = {};
    (initQuery.data.discountCategories || []).forEach((dc) => {
      dcMap[dc.id] = dc;
    });
    onSetDiscountCategoryMap(dcMap);

    if (template) {
      onSetTemplateSettings(template);
    } else {
      onSetTemplateSettings({
        column_settings: {
          mandatory: ['sno', 'item', 'qty', 'uom'],
          optional: {
            item_code: true,
            variant: true,
            description: true,
            hsn_code: true,
            rate: true,
            discount_percent: true,
            rate_after_discount: true,
            tax_percent: true,
            line_total: true,
            custom1: false,
            custom2: false
          },
          labels: {
            custom1: 'Custom 1',
            custom2: 'Custom 2',
            rate_after_discount: 'Rate/Unit'
          }
        }
      });
    }

    if (editId) {
      loadQuotation(editId);
    } else if (duplicateId) {
      loadQuotation(duplicateId, true);
    } else {
      loadQuoteNoPreview();
      onSetItems([{
        id: Date.now() + Math.random(),
        item_id: '',
        variant_id: null,
        material: null,
        hsn_code: '',
        description: '',
        qty: 1,
        uom: '',
        rate: 0,
        discount_percent: 0,
        discount_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        line_total: 0,
        override_flag: false,
        original_discount_percent: 0,
        base_rate_snapshot: 0,
        applied_discount_percent: 0,
        is_override: false,
        final_rate_snapshot: 0,
        display_order: 0,
        is_header: false,
        custom1: '',
        custom2: ''
      }]);
    }
    initializedRef.current = currentId;
  }, [initQuery.data, editId, duplicateId, materials]);

  const getQuoteSeriesNumber = useCallback((seriesRow: any) => {
    const cfg = seriesRow?.configs?.quote;
    if (cfg && cfg.enabled) {
      return parseInt(cfg.start_number || 1, 10);
    }
    return parseInt(seriesRow?.current_number || 1, 10);
  }, []);

  const getFyPrefix = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month < 3) return `${year - 1}-${String(year).slice(-2)}`;
    return `${year}-${String(year + 1).slice(-2)}`;
  }, []);

  const buildQuoteNoFromSeries = useCallback((seriesRow: any) => {
    if (!seriesRow) return '';
    const cfg = seriesRow?.configs?.quote || {};
    const rawPrefix = cfg.prefix || 'QT-';
    const suffix = cfg.suffix || '';
    const number = getQuoteSeriesNumber(seriesRow);
    const padded = String(number).padStart(4, '0');
    const fy = getFyPrefix();
    const prefix = String(rawPrefix).replace('{FY}', fy);
    return `${prefix}${padded}${suffix}`;
  }, [getQuoteSeriesNumber, getFyPrefix]);

  const buildQuoteNoFromCfg = useCallback((cfg: QuoteSeriesCfg) => {
    const fy = getFyPrefix();
    const prefix = String(cfg.prefix || 'QT-').replace('{FY}', fy);
    const padded = String(cfg.nextNumber || 1).padStart(cfg.padding || 4, '0');
    return `${prefix}${padded}${cfg.suffix || ''}`;
  }, [getFyPrefix]);

  async function fetchDefaultSeriesRow() {
    if (!organisationId) return null;
    try {
      let query = supabase
        .from('document_series')
        .select('id, configs, current_number, created_at, is_default, organisation_id');

      query = query.or(`organisation_id.eq.${organisationId},organisation_id.is.null`);

      const { data } = await withTimeout(
        query.order('is_default', { ascending: false }).order('created_at', { ascending: false }).limit(5),
        'loading document series',
        10000
      );

      if (Array.isArray(data) && data.length > 0) {
        const orgDefault = data.find((r: any) => r.organisation_id === organisationId && r.is_default);
        if (orgDefault) return orgDefault;
        const orgAny = data.find((r: any) => r.organisation_id === organisationId);
        if (orgAny) return orgAny;
        const globalDefault = data.find((r: any) => r.is_default);
        if (globalDefault) return globalDefault;
        return data[0];
      }
      return null;
    } catch (err) {
      console.warn('Unable to load document series:', err);
      return null;
    }
  }

  async function fetchQuoteSeriesCfg(): Promise<QuoteSeriesCfg | null> {
    if (!organisationId) return null;
    try {
      const { data: ds, error: dsErr } = await withTimeout(
        supabase
          .from('document_settings')
          .select('quotation_prefix, quotation_start_number, quotation_padding, quotation_suffix, quotation_current_number')
          .eq('organisation_id', organisationId)
          .maybeSingle(),
        'loading document settings',
        8000
      );
      if (!dsErr && ds) {
        const startNum = parseInt(ds.quotation_start_number as any, 10);
        const curNum = parseInt(ds.quotation_current_number as any, 10);
        const nextNumber = Number.isFinite(curNum) && curNum > 0
          ? curNum
          : (Number.isFinite(startNum) && startNum > 0 ? startNum : 1);
        return {
          source: 'document_settings',
          prefix: ds.quotation_prefix || 'QT-',
          suffix: ds.quotation_suffix || '',
          padding: parseInt(ds.quotation_padding as any, 10) || 4,
          nextNumber,
        };
      }
    } catch (err) {
      console.warn('Unable to load document settings:', err);
    }

    const legacyRow = await fetchDefaultSeriesRow();
    if (legacyRow) {
      return {
        source: 'document_series',
        prefix: legacyRow?.configs?.quote?.prefix || 'QT-',
        suffix: legacyRow?.configs?.quote?.suffix || '',
        padding: 4,
        nextNumber: getQuoteSeriesNumber(legacyRow),
        legacyRow,
      };
    }
    return null;
  }

  const loadQuoteNoPreview = useCallback(async () => {
    if (editId) return;
    try {
      const cfg = await fetchQuoteSeriesCfg();

      if (cfg) {
        const seriesNo = buildQuoteNoFromCfg(cfg);
        onSetQuoteNoPreview(seriesNo);
        onSetFormData((prev: any) => ({ ...prev, quotation_no: seriesNo }));
        return;
      }
    } catch (err) {
      console.warn('Unable to load default quote series:', err);
    }

    try {
      const { data: existing } = await supabase
        .from('quotation_header')
        .select('quotation_no')
        .order('created_at', { ascending: false })
        .limit(1);
      let fallbackNo = 'QT-0001';
      if (existing && existing.length > 0) {
        const lastNum = parseInt((existing[0].quotation_no || '').replace(/[^0-9]/g, ''), 10) || 0;
        fallbackNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
      }
      onSetQuoteNoPreview(fallbackNo);
      onSetFormData((prev: any) => ({ ...prev, quotation_no: fallbackNo }));
    } catch (err) {
      onSetQuoteNoPreview('QT-0001');
      onSetFormData((prev: any) => ({ ...prev, quotation_no: 'QT-0001' }));
    }
  }, [buildQuoteNoFromCfg, editId, organisationId, onSetQuoteNoPreview, onSetFormData]);

  const loadQuotation = async (id: string, isDuplicate = false) => {
    let data: any;
    try {
      data = await timedSupabaseQuery(
        supabase
          .from('quotation_header')
          .select('*, items:quotation_items(*, item:materials(id, item_code, display_name, name, hsn_code, sale_price, unit, gst_rate, mappings:material_client_mappings(*)))')
          .eq('id', id)
          .eq('organisation_id', organisationId || '00000000-0000-0000-0000-000000000000')
          .single(),
        'Quotation details',
      );
    } catch (error) {
      toast.error('Error loading quotation', { description: (error as Error)?.message || 'Unknown error' });
      return;
    }

    if (data) {
      onSetLastLoadedUpdatedAt(data.updated_at || null);
      onSetFormData({
        id: isDuplicate ? '' : (data.id || ''),
        quotation_no: isDuplicate ? '' : (data.quotation_no || ''),
        revision_no: isDuplicate ? 1 : (data.revision_no || 1),
        revision_history: isDuplicate ? [] : (data.revision_history || []),
        client_id: data.client_id || '',
        project_id: data.project_id || '',
        billing_address: data.billing_address || '',
        shipping_address: data.shipping_address || '',
        gstin: data.gstin || '',
        state: data.state || '',
        date: isDuplicate ? new Date().toISOString().split('T')[0] : (data.date || ''),
        valid_till: isDuplicate ? '' : (data.valid_till || ''),
        payment_terms: data.payment_terms || DEFAULT_PAYMENT_TERMS,
        client_contact: '',
        variant_id: data.variant_id || '',
        prepared_by: data.prepared_by || '',
        extra_discount_percent: data.extra_discount_percent || 0,
        extra_discount_amount: data.extra_discount_amount || 0,
        round_off: data.round_off || 0,
        round_off_enabled: true,
        remarks: data.remarks || '',
        reference: data.reference || '',
        status: isDuplicate ? 'Draft' : (data.status || 'Draft'),
        negotiation_mode: isDuplicate ? false : (data.negotiation_mode || false),
        authorized_signatory_id: (() => {
          const val = data.authorized_signatory_id;
          if (val && val.length > 0 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
            return String(val);
          }
          return null;
        })(),
        include_erection_charges: data.items?.some((i: any) => 
          i.section === 'erection' || 
          (i.item_id === null && i.sac_code !== null) || 
          (i.description && i.description.includes(' - Erection'))
        ) || false
      });

      if (data.items) {
        const mappedItems = data.items.map((item: any) => {
          const isErection = (item.item_id === null && item.sac_code !== null) || 
                           (item.description && item.description.includes(' - Erection'));
          let linked_material_id = null;
          if (isErection && item.description && item.description.includes(' - Erection')) {
            const baseName = item.description.replace(' - Erection', '');
            const parent = data.items.find((p: any) => (p.description || p.item_id) === baseName && p.id !== item.id);
            if (parent) linked_material_id = parent.id;
          }
          
          return {
            ...item,
            id: item.id || (Date.now() + Math.random()),
            section: isErection ? 'erection' : 'materials',
            linked_material_id,
            material: item.item,
            hsn_code: item.hsn_code || item.item?.hsn_code || null,
            sac_code: item.sac_code || null,
            uom: item.uom || item.item?.unit || '',
            base_rate_snapshot: parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0,
            applied_discount_percent: parseFloat(item.applied_discount_percent) || 0,
            is_override: item.is_override || false,
            is_header: item.is_header || false,
            is_subtotal: item.is_subtotal || false,
            subtotal_label: item.subtotal_label || null,
            final_rate_snapshot: parseFloat(item.final_rate_snapshot) || parseFloat(item.rate) || 0,
            display_order: item.display_order || 0,
            custom1: item.custom1 || '',
            custom2: item.custom2 || '',
            qty: parseFloat(item.qty) || 0,
            rate: parseFloat(item.rate) || 0,
            discount_percent: parseFloat(item.discount_percent) || 0,
            tax_percent: parseFloat(item.tax_percent) || 0,
            line_total: parseFloat(item.line_total) || 0
          };
        });
        
        let finalItems = mappedItems;
        const restoreRevParam = new URLSearchParams(window.location.search).get('restoreRev');
        const restoreRevNo = restoreRevParam ? parseInt(restoreRevParam, 10) : null;
        if (restoreRevNo && data.revision_history && Array.isArray(data.revision_history)) {
          const targetRev = data.revision_history.find((r: any) => r.revision_no === restoreRevNo);
          if (targetRev && targetRev.items?.length > 0) {
            finalItems = targetRev.items.map((item: any) => ({
              ...item,
              id: item.id || (Date.now() + Math.random()),
            }));
            if (targetRev.header_discounts) {
              onSetHeaderDiscounts(targetRev.header_discounts);
            }
            if (targetRev.header) {
              onSetFormData((prev: any) => ({
                ...prev,
                extra_discount_percent: targetRev.header?.extra_discount_percent ?? prev.extra_discount_percent,
                extra_discount_amount: targetRev.header?.extra_discount_amount ?? prev.extra_discount_amount,
                remarks: targetRev.header?.remarks ?? prev.remarks,
              }));
            }
            toast.success(`Loaded items and rates from Revision ${restoreRevNo}`);
          }
        }

        onSetItems(finalItems);
        if (!isDuplicate) {
          onSetOriginalItems(JSON.parse(JSON.stringify(finalItems)));
        } else {
          onSetOriginalItems([]);
        }

        const erectionItems = mappedItems.filter((item: any) => item.section === 'erection');
        if (erectionItems.length > 0) {
          const erectionDiscount = parseFloat(erectionItems[0].discount_percent) || 0;
          onSetHeaderDiscounts(prev => ({ ...prev, erection: erectionDiscount }));
        }
      }
      
      const portfolio = await loadClientDiscountPortfolio(data.client_id);
      if (portfolio.settings && Object.keys(portfolio.settings).length > 0) {
        onSetDiscountSettings(prev => ({ ...prev, ...portfolio.settings }));
      }
      onSetHeaderDiscounts(prev => ({ ...portfolio.discounts, ...prev }));
      await loadVariantDiscounts(id);
      
      if (isDuplicate) {
        await loadQuoteNoPreview();
      } else {
        await loadApprovalData(id);
      }

      if (data.multi_dc_mode && !isDuplicate) {
        const { data: dcLinks } = await supabase
          .from('quotation_dc_links')
          .select('delivery_challan_id, allocated_amount, dc:delivery_challans(id, dc_number, dc_date, items:delivery_challan_items(amount))')
          .eq('quotation_id', id);

        if (dcLinks && dcLinks.length > 0) {
          onSetDcAllocations(dcLinks.map((link: any) => {
            const dcTotal = link.dc?.items?.reduce((sum: number, it: any) => sum + (parseFloat(it.amount) || 0), 0) || 0;
            return {
              dc_id: link.delivery_challan_id,
              dc_number: link.dc?.dc_number || 'Unknown',
              dc_date: link.dc?.dc_date || '',
              total_amount: dcTotal,
              allocated_amount: parseFloat(link.allocated_amount) || 0
            };
          }));
        }
      }
    }
  };

  const loadClientDiscountPortfolio = useCallback(async (clientId: string) => {
    if (!clientId) return { discounts: {} as Record<string, number>, settings: {} as Record<string, any> };
    
    const client = clients.find(c => c.id === clientId);
    if (!client) return { discounts: {} as Record<string, number>, settings: {} as Record<string, any> };

    let discounts: Record<string, number> = {};
    let settings: Record<string, any> = {};
    const customDiscounts = (client as any).custom_discounts || {};

    try {
      if (client.discount_type === 'Standard' && (client as any).standard_pricelist_id) {
        const { data: pl } = await supabase
          .from('standard_discount_pricelists')
          .select('discount_percent')
          .eq('id', (client as any).standard_pricelist_id)
          .single();
        
        if (pl) {
          const flatDisc = parseFloat(pl.discount_percent) || 0;
          const { data: dcList } = await supabase
            .from('discount_categories')
            .select('id')
            .or(`organisation_id.eq.${organisationId},organisation_id.is.null`)
            .eq('is_active', true);
          (dcList || []).forEach(dc => {
            discounts[dc.id] = flatDisc;
            settings[dc.id] = {
              default: flatDisc,
              min: 0,
              max: flatDisc
            };
          });
        }
      } else {
        let struct;
        if ((client as any).discount_profile_id) {
          const { data } = await supabase
            .from('discount_structures')
            .select('id')
            .eq('id', (client as any).discount_profile_id)
            .maybeSingle();
          struct = data;
        } else {
          const structName = client.discount_type || 'Special';
          const { data } = await supabase
            .from('discount_structures')
            .select('id')
            .eq('structure_name', structName)
            .eq('organisation_id', organisationId)
            .maybeSingle();
          struct = data;
        }

        const { data: dcList } = await supabase
          .from('discount_categories')
          .select('id, default_discount_percent')
          .or(`organisation_id.eq.${organisationId},organisation_id.is.null`)
          .eq('is_active', true);

        (dcList || []).forEach(dc => {
          const customDisc = customDiscounts[dc.id];
          discounts[dc.id] = customDisc !== undefined ? parseFloat(customDisc) || 0 : 0;
          settings[dc.id] = {
            default: parseFloat(dc.default_discount_percent) || 0,
            min: 0,
            max: 100
          };
        });

        if (struct) {
          const { data: dcSettings } = await supabase
            .from('discount_variant_settings')
            .select('discount_category_id, default_discount_percent, min_discount_percent, max_discount_percent')
            .eq('structure_id', struct.id)
            .eq('organisation_id', organisationId)
            .not('discount_category_id', 'is', null);
          
          dcSettings?.forEach(s => {
            const dcId = s.discount_category_id;
            if (!dcId) return;
            if (customDiscounts[dcId] === undefined) {
              discounts[dcId] = parseFloat(s.default_discount_percent) || 0;
            }
            settings[dcId] = {
              default: parseFloat(s.default_discount_percent) || 0,
              min: parseFloat(s.min_discount_percent) || 0,
              max: parseFloat(s.max_discount_percent) || 0
            };
          });
        }
      }
    } catch (err) {
      console.error('Error loading client portfolio:', err);
    }

    return { discounts, settings };
  }, [clients, organisationId]);

  const loadVariantDiscounts = useCallback(async (quotationId: string) => {
    try {
      const { data, error } = await supabase
        .from('quotation_variant_discounts')
        .select('*')
        .eq('quotation_id', quotationId);

      if (!error && data && data.length > 0) {
        const discMap: Record<string, number> = {};
        data.forEach((row: any) => {
          discMap[row.variant_id] = parseFloat(row.discount_percent) || 0;
        });
        onSetHeaderDiscounts(prev => ({ ...prev, ...discMap }));
      }
    } catch (err) {
      console.error('Error loading variant discounts:', err);
    }
  }, [onSetHeaderDiscounts]);

  const loadApprovalData = useCallback(async (quotationId: string) => {
    try {
      const hist = await ApprovalIntegration.getQuotationApprovalHistory(quotationId);
      onSetApprovalHistory(hist);
      const conf = await ApprovalIntegration.getQuotationApprovalConfig(quotationId);
      onSetApprovalConfig(conf);
    } catch (err) {
      console.error('Error loading approval data:', err);
    }
  }, [onSetApprovalHistory, onSetApprovalConfig]);

  const refreshClientShippingAddresses = useCallback(async (clientId: string, orgId?: string) => {
    if (!clientId) {
      onSetClientShippingAddresses([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('client_shipping_addresses')
        .select('*')
        .eq('client_id', clientId)
        .eq('organisation_id', orgId || '00000000-0000-0000-0000-000000000000')
        .order('is_default', { ascending: false });
      if (!error && data) {
        onSetClientShippingAddresses(data);
      }
    } catch (err) {
      console.error('Error fetching client shipping addresses:', err);
    }
  }, [onSetClientShippingAddresses]);

  return {
    initQuery,
    stockQuery,
    warehousesQuery,
    conversionQuery,
    arcPricingQuery,
    lastRatesQuery,
    initLoading,
    initErrorMessage,
    warehouseNameById,
    stockRowsByItemId,
    loadQuotation,
    fetchQuoteSeriesCfg,
    fetchDefaultSeriesRow,
    buildQuoteNoFromCfg,
    loadQuoteNoPreview,
    loadClientDiscountPortfolio,
    loadVariantDiscounts,
    loadApprovalData,
    refreshClientShippingAddresses,
    initializedRef,
  };
}
