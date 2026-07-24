import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { timedSupabaseQuery } from '../../utils/queryTimeout';
import { ensureValidSession } from '../../queryClient';
import { useMaterials } from '../../hooks/useMaterials';
import { useClients } from '../../hooks/useClients';
import { useProjects } from '../../hooks/useProjects';
import { useVariants } from '../../hooks/useVariants';
import { useConvertDocument, useConversionStatus, getSourceTableName } from '../../conversions/hooks';
import type { ConversionType } from '../../conversions/types';
import ItemCreateDrawer from '../../components/ItemCreateDrawer';
import { TermsConditionsDrawer } from '../../components/TermsConditionsDrawer';
import { FileText, Plus, RotateCcw } from 'lucide-react';
import { AiDocumentParserModal } from '../../components/AiDocumentParserModal';
import { ErectionSection } from '../../components/ErectionSection';
import { ApprovalIntegration } from '../../approvals/integration';
import { toast } from '../../lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { ArcConfirmationDialog } from '../../components/ArcConfirmationDialog';
import { fetchArcPricingForItems, getArcRateFromMap } from '../../lib/arc-pricing';
import { useLastDocumentRates } from '../../hooks/useLastDocumentRates';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadQuickQuoteConfig, normalizeQuickQuoteConfig } from '../../quotation/quick-quote/api';
import type { QuickQuoteConfig } from '../../quotation/quick-quote/types';
import { useQuotationCalculations } from './hooks/useQuotationCalculations';
import { QuotationActions } from './components/QuotationActions';
import { QuotationHeaderForm } from './components/QuotationHeaderForm';
import { QuotationItemsTable } from './components/QuotationItemsTable';
import { ErectionItemsSection } from './components/ErectionItemsSection';
import { saveItemsDiff } from './utils/itemDiff';
import { useAutosave } from './hooks/useAutosave';
import { usePresence } from './hooks/usePresence';
import { PresenceBanner } from './components/PresenceBanner';
import { autoCreateOrUpdateErection } from '../../utils/erectionUtils';

const DEFAULT_PAYMENT_TERMS = 'Net 30 Days';

// Pre-flight session checks
const withTimeout = async <T,>(promise: Promise<T>, desc: string, ms = 8000): Promise<T> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout: ${desc} after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

const isTimeoutError = (err: any, desc: string) => {
  return err instanceof Error && err.message.includes(`Timeout: ${desc}`);
};

export default function CreateQuotation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const duplicateId = searchParams.get('duplicateId');
  const convertFrom = searchParams.get('convertFrom') as ConversionType | null;
  const sourceId = searchParams.get('sourceId');
  const dcIdsParam = searchParams.get('dcIds');
  const multiDCModeParam = searchParams.get('multiDCMode') as any;
  const isConverting = Boolean(convertFrom && sourceId && !editId && !duplicateId);
  const isMultiDC = convertFrom === 'multi-dc-to-quotation' && dcIdsParam;
  const conversionInfoRef = useRef<{ type: ConversionType; sourceId: string } | null>(null);

  const isInitiallyLoadedRef = useRef(false);
  const ignoreDirtyRef = useRef(false);
  const itemsTableRef = useRef<HTMLDivElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastLoadedUpdatedAt, setLastLoadedUpdatedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'conflict' | 'error'>('saved');

  useEffect(() => {
    if (isDirty) {
      setSaveStatus('unsaved');
    }
  }, [isDirty]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !saving) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
      return undefined;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, saving]);

  const { organisation } = useAuth();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const fetchProfile = async () => {
      const { data: attemptA } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (attemptA?.id) {
        setUserProfileId(attemptA.id);
        return;
      }
      const { data: attemptB } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (attemptB?.id) {
        setUserProfileId(attemptB.id);
      }
    };
    fetchProfile();
  }, [user?.id]);
  
  const { data: materials = [] } = useMaterials();
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();
  const { data: variants = [] } = useVariants();

  const [activeTab, setActiveTab] = useState<'items' | 'approvals'>('items');
  const [activeSection, setActiveSection] = useState<'materials' | 'erection'>('materials');
  const [isSigDropdownOpen, setIsSigDropdownOpen] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showCustomLabelEditor, setShowCustomLabelEditor] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [showTermsDrawer, setShowTermsDrawer] = useState(false);
  const [isParserOpen, setIsParserOpen] = useState(false);
  const [activeImportSessionId, setActiveImportSessionId] = useState<string | null>(null);
  
  const [variantPricing, setVariantPricing] = useState({});
  const [itemMakes, setItemMakes] = useState({});
  const [companyState, setCompanyState] = useState(organisation?.state || 'Maharashtra');
  const [quoteNoPreview, setQuoteNoPreview] = useState('');
  const [defaultTemplate, setDefaultTemplate] = useState(null);
  const [draggingItemId, setDraggingItemId] = useState<string | number | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | number | null>(null);
  const [activeStockPopoverId, setActiveStockPopoverId] = useState<string | number | null>(null);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [moveToDialog, setMoveToDialog] = useState<{
    open: boolean;
    itemId: string | number | null;
    currentSNo: number;
    section: 'materials' | 'erection';
    value: string;
    error: string;
  } | null>(null);
  
  const [headerDiscounts, _setHeaderDiscounts] = useState<Record<string, number>>({});
  const setHeaderDiscounts = useCallback((val: any) => {
    _setHeaderDiscounts(val);
    if (isInitiallyLoadedRef.current && !ignoreDirtyRef.current) {
      setIsDirty(true);
    }
  }, []);
  const [discountPopup, setDiscountPopup] = useState<any>(null);
  const [customiseModal, setCustomiseModal] = useState<any>(null);
  const [useArcPricing, setUseArcPricing] = useState(false);
  const [arcPricingMap, setArcPricingMap] = useState<Record<string, any>>({});
  const [arcPricingConfirmOpen, setArcPricingConfirmOpen] = useState(false);
  
  const [discountSettings, setDiscountSettings] = useState<Record<string, any>>({});
  const [discountCategoryMap, setDiscountCategoryMap] = useState<Record<string, any>>({});
  const [clientShippingAddresses, setClientShippingAddresses] = useState<any[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [approvalConfig, setApprovalConfig] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<any>(null);
  const [inputDialog, setInputDialog] = useState<{
    open: boolean;
    title: string;
    placeholder: string;
    defaultValue?: string;
    onSubmit: (value: string) => void;
    suggestions?: string[];
    allowEmpty?: boolean;
  } | null>(null);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [templateSettings, setTemplateSettings] = useState<any>(null);
  
  const [quickQuoteConfig, setQuickQuoteConfig] = useState<QuickQuoteConfig | null>(null);
  const [quickQuoteTemplateId, setQuickQuoteTemplateId] = useState('');
  const [quickQuoteVariantId, setQuickQuoteVariantId] = useState('');
  const [quickQuoteMake, setQuickQuoteMake] = useState('');
  const [quickQuoteSpec, setQuickQuoteSpec] = useState('');
  const [quickQuoteIncludeValves, setQuickQuoteIncludeValves] = useState(true);
  const [quickQuoteIncludeThreadItems, setQuickQuoteIncludeThreadItems] = useState(true);
  const [quickQuoteCustomLengthMap, setQuickQuoteCustomLengthMap] = useState<Record<string, number>>({});

  const [dcAllocations, setDcAllocations] = useState<Array<{
    dc_id: string;
    dc_number: string;
    dc_date: string;
    total_amount: number;
    allocated_amount: number;
  }>>([]);
  const [multiDCError, setMultiDCError] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const [clientSearch, setClientSearch] = useState<string | null>(null);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  const [formData, _setFormData] = useState<any>({
    id: '',
    quotation_no: '',
    revision_no: 1,
    revision_history: [],
    client_id: '',
    project_id: '',
    billing_address: '',
    shipping_address: '',
    gstin: '',
    state: '',
    date: new Date().toISOString().split('T')[0],
    valid_till: '',
    payment_terms: DEFAULT_PAYMENT_TERMS,
    client_contact: '',
    variant_id: '',
    reference: '',
    prepared_by: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
    extra_discount_percent: 0,
    extra_discount_amount: 0,
    round_off: 0,
    remarks: '',
    round_off_enabled: true,
    status: 'Draft',
    negotiation_mode: false,
    authorized_signatory_id: '',
    include_erection_charges: false
  });

  const setFormData = useCallback((val: any) => {
    _setFormData(val);
    if (isInitiallyLoadedRef.current && !ignoreDirtyRef.current) {
      setIsDirty(true);
    }
  }, []);

  const [items, _setItems] = useState<any[]>([]);
  const [originalItems, setOriginalItems] = useState<any[]>([]);
  const setItems = useCallback((val: any) => {
    _setItems(val);
    if (isInitiallyLoadedRef.current && !ignoreDirtyRef.current) {
      setIsDirty(true);
    }
  }, []);

  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});

  const calculations = useQuotationCalculations({
    items,
    extraDiscountPercent: formData.extra_discount_percent,
    extraDiscountAmount: formData.extra_discount_amount,
    roundOffEnabled: formData.round_off_enabled,
    roundOff: formData.round_off,
    state: formData.state,
    companyState,
  });



  const activePresenceUsers = usePresence(editId, user);

  const initQuery = useQuery({
    queryKey: ['quotationInit', organisation?.id],
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    queryFn: async () => {
      const [pricing, settings, template, discountCatsRes, quickQuoteConfigRes, orgDetails] = await Promise.all([
        timedSupabaseQuery(
          supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price, make'),
          'Quotation pricing',
        ),
        timedSupabaseQuery(
          supabase
            .from('discount_settings')
            .select('variant_id, default_discount_percent, min_discount_percent, max_discount_percent')
            .eq('is_active', true),
          'Quotation discount settings',
        ),
        timedSupabaseQuery(
          supabase
            .from('document_templates')
            .select('id, column_settings')
            .eq('document_type', 'Quotation')
            .eq('is_default', true)
            .limit(1)
            .single(),
          'Quotation template',
        ),
        organisation?.id ? timedSupabaseQuery(
          supabase.from('discount_categories').select('*').or(`organisation_id.eq.${organisation.id},organisation_id.is.null`).eq('is_active', true).order('name'),
          'Discount categories',
        ) : Promise.resolve([]),
        organisation?.id ? loadQuickQuoteConfig(organisation.id) : Promise.resolve(null),
        organisation?.id ? timedSupabaseQuery(
          supabase.from('organisations').select('*').eq('id', organisation.id).single(),
          'Organisation details'
        ) : Promise.resolve(null),
      ]);

      return {
        pricing: pricing || [],
        settings: settings || [],
        template: template || null,
        discountCategories: discountCatsRes || [],
        quickQuoteConfig: quickQuoteConfigRes || null,
        orgFullDetails: orgDetails || null
      };
    },
  });

  const initLoading = initQuery.isPending && !initQuery.data;
  const initErrorMessage = initQuery.error instanceof Error ? initQuery.error.message : 'Unable to load quotation setup data.';

  const conversionQuery = useConvertDocument(convertFrom!, sourceId!);

  const arcItemIds = useMemo(() => {
    return items.map((item: any) => item.item_id).filter(Boolean);
  }, [items]);

  const arcPricingQuery = useQuery({
    queryKey: ['arc-pricing', 'items', formData.client_id, arcItemIds],
    queryFn: async () => {
      if (!useArcPricing || !formData.client_id || arcItemIds.length === 0) return {};
      return fetchArcPricingForItems(formData.client_id, arcItemIds);
    },
    enabled: useArcPricing && Boolean(formData.client_id) && arcItemIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (arcPricingQuery.data) {
      setArcPricingMap(arcPricingQuery.data);
    }
  }, [arcPricingQuery.data]);

  const quotationItemIds = useMemo(() => {
    const ids = items.map((item: any) => item.item_id).filter(Boolean);
    return Array.from(new Set(ids)) as string[];
  }, [items]);

  const { data: lastRatesMap = {} } = useLastDocumentRates(formData.client_id, quotationItemIds);

  const initializedRef = useRef<string | null>(null);

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

    setVariantPricing(pricingMap);
    setItemMakes(finalMakesMap);
  }, [initQuery.data, materials]);

  useEffect(() => {
    if (!formData.client_id) {
      setClientShippingAddresses([]);
      return;
    }
    const fetchShippingAddresses = async () => {
      try {
        const { data, error } = await supabase
          .from('client_shipping_addresses')
          .select('*')
          .eq('client_id', formData.client_id)
          .eq('organisation_id', organisation?.id || '00000000-0000-0000-0000-000000000000')
          .order('is_default', { ascending: false });
        if (!error && data) {
          setClientShippingAddresses(data);
        }
      } catch (err) {
        console.error('Error fetching client shipping addresses:', err);
      }
    };
    fetchShippingAddresses();
  }, [formData.client_id, organisation?.id]);

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
            .or(`organisation_id.eq.${organisation?.id},organisation_id.is.null`)
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
            .eq('organisation_id', organisation?.id)
            .maybeSingle();
          struct = data;
        }

        // Load all active discount categories
        const { data: dcList } = await supabase
          .from('discount_categories')
          .select('id, default_discount_percent')
          .or(`organisation_id.eq.${organisation?.id},organisation_id.is.null`)
          .eq('is_active', true);

        // Pre-populate with global default or client custom override
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
            .eq('organisation_id', organisation?.id)
            .not('discount_category_id', 'is', null);
          
          dcSettings?.forEach(s => {
            const dcId = s.discount_category_id;
            if (!dcId) return;
            // Use structure default if no client custom override exists
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
  }, [clients, organisation?.id]);

  const loadVariantDiscounts = async (quotationId: string) => {
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
        setHeaderDiscounts(prev => ({ ...prev, ...discMap }));
      }
    } catch (err) {
      console.error('Error loading variant discounts:', err);
    }
  };

  const loadApprovalData = async (quotationId: string) => {
    try {
      const hist = await ApprovalIntegration.getQuotationApprovalHistory(quotationId);
      setApprovalHistory(hist);
      const conf = await ApprovalIntegration.getQuotationApprovalConfig(quotationId);
      setApprovalConfig(conf);
    } catch (err) {
      console.error('Error loading approval data:', err);
    }
  };

  const isMissingColumnError = (error: any, columnName?: string) => {
    const code = (error as any)?.code;
    const message = ((error as any)?.message || String(error || '')).toLowerCase();
    if (code === '42703') return true;
    if (!columnName) return message.includes('does not exist') && message.includes('column');
    return message.includes(String(columnName).toLowerCase()) && message.includes('does not exist');
  };

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

  async function fetchDefaultSeriesRow() {
    const tryFetch = async (buildQuery: any, label: string) => {
      try {
        const { data } = await withTimeout(buildQuery(), label, 20000);
        return data || null;
      } catch (error) {
        const missingIsDefault = isMissingColumnError(error, 'is_default');
        const missingOrganisationId = isMissingColumnError(error, 'organisation_id');
        if (
          isTimeoutError(error, label) ||
          missingIsDefault ||
          missingOrganisationId
        ) {
          return null;
        }
        throw error;
      }
    };

    const organizationId = organisation?.id;

    const primary = await tryFetch(
      () =>
        supabase
          .from('document_series')
          .select('id, configs, current_number, created_at')
          .eq('is_default', true)
          .eq('organisation_id', organizationId)
          .limit(1)
          .maybeSingle(),
      'loading document series'
    );
    if (primary) return primary;

    const byOrgLatestRows = await tryFetch(
      () =>
        supabase
          .from('document_series')
          .select('id, configs, current_number, created_at')
          .eq('organisation_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(1),
      'loading fallback document series by organisation'
    );
    if (Array.isArray(byOrgLatestRows) && byOrgLatestRows[0]) return byOrgLatestRows[0];

    const byDefaultLatestRows = await tryFetch(
      () =>
        supabase
          .from('document_series')
          .select('id, configs, current_number, created_at')
          .eq('is_default', true)
          .order('created_at', { ascending: false })
          .limit(1),
      'loading fallback default document series'
    );
    if (Array.isArray(byDefaultLatestRows) && byDefaultLatestRows[0]) return byDefaultLatestRows[0];

    const globalLatestRows = await tryFetch(
      () =>
        supabase
          .from('document_series')
          .select('id, configs, current_number, created_at')
          .order('created_at', { ascending: false })
          .limit(1),
      'loading fallback global document series'
    );
    return Array.isArray(globalLatestRows) ? globalLatestRows[0] || null : null;
  }

  const loadQuoteNoPreview = useCallback(async () => {
    if (editId) return;
    try {
      const defaultSeries = await fetchDefaultSeriesRow();

      if (defaultSeries) {
        const seriesNo = buildQuoteNoFromSeries(defaultSeries);
        setQuoteNoPreview(seriesNo);
        setFormData((prev: any) => ({ ...prev, quotation_no: seriesNo }));
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
      setQuoteNoPreview(fallbackNo);
      setFormData((prev: any) => ({ ...prev, quotation_no: fallbackNo }));
    } catch (err) {
      setQuoteNoPreview('QT-0001');
      setFormData((prev: any) => ({ ...prev, quotation_no: 'QT-0001' }));
    }
  }, [buildQuoteNoFromSeries, editId, organisation?.id, setFormData]);

  const loadQuotation = async (id: string, isDuplicate = false) => {
    let data: any;
    try {
      data = await timedSupabaseQuery(
        supabase
          .from('quotation_header')
          .select('*, items:quotation_items(*, item:materials(id, item_code, display_name, name, hsn_code, sale_price, unit, gst_rate, mappings:material_client_mappings(*)))')
          .eq('id', id)
          .eq('organisation_id', organisation?.id || '00000000-0000-0000-0000-000000000000')
          .single(),
        'Quotation details',
      );
    } catch (error) {
      toast.error('Error loading quotation', { description: (error as Error)?.message || 'Unknown error' });
      return;
    }

    if (data) {
      if (!isDuplicate) {
        setLastLoadedUpdatedAt(data.updated_at || null);
      }
      setFormData({
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
        
        setItems(mappedItems);
        if (!isDuplicate) {
          setOriginalItems(JSON.parse(JSON.stringify(mappedItems)));
        } else {
          setOriginalItems([]);
        }

        const erectionItems = mappedItems.filter((item: any) => item.section === 'erection');
        if (erectionItems.length > 0) {
          const erectionDiscount = parseFloat(erectionItems[0].discount_percent) || 0;
          setHeaderDiscounts(prev => ({ ...prev, erection: erectionDiscount }));
        }
      }
      
      const portfolio = await loadClientDiscountPortfolio(data.client_id);
      if (portfolio.settings && Object.keys(portfolio.settings).length > 0) {
        setDiscountSettings(prev => ({ ...prev, ...portfolio.settings }));
      }
      setHeaderDiscounts(prev => ({ ...portfolio.discounts, ...prev }));
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
          setDcAllocations(dcLinks.map((link: any) => {
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
      setQuickQuoteConfig(normalizedQuickQuote);
      setQuickQuoteTemplateId((prev) => prev || (normalizedQuickQuote.templates && normalizedQuickQuote.templates.length > 0 ? normalizedQuickQuote.templates[0]?.id : ''));
      setQuickQuoteVariantId((prev) => prev || normalizedQuickQuote.settings?.default_variant || '');
      setQuickQuoteMake((prev) => prev || normalizedQuickQuote.settings?.default_make || '');
      setQuickQuoteSpec((prev) => prev || normalizedQuickQuote.settings?.default_spec || '');
      setQuickQuoteIncludeValves(normalizedQuickQuote.settings?.enable_valves ?? true);
      setQuickQuoteIncludeThreadItems(normalizedQuickQuote.settings?.enable_thread_items ?? true);
    } else {
      setQuickQuoteConfig(null);
    }

    const settingsMap: any = {};
    (settings || []).forEach((row) => {
      settingsMap[row.variant_id] = {
        default: parseFloat(row.default_discount_percent) || 0,
        min: parseFloat(row.min_discount_percent) || 0,
        max: parseFloat(row.max_discount_percent) || 0
      };
    });
    setDiscountSettings(settingsMap);

    const dcMap: any = {};
    (initQuery.data.discountCategories || []).forEach((dc) => {
      dcMap[dc.id] = dc;
    });
    setDiscountCategoryMap(dcMap);

    if (template) {
      setTemplateSettings(template);
    } else {
      setTemplateSettings({
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
      setItems([{
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
  }, [initQuery.data, editId, duplicateId]);

  useEffect(() => {
    if (!isConverting || !conversionQuery.data) return;

    conversionInfoRef.current = {
      type: convertFrom!,
      sourceId: sourceId!,
    };

    const convertedData = conversionQuery.data.data as any;

    setFormData((prev: any) => ({
      ...prev,
      client_id: convertedData.client_id || '',
      project_id: convertedData.project_id || '',
      state: convertedData.state || '',
      date: convertedData.date || new Date().toISOString().split('T')[0],
      reference: convertedData.reference || '',
      remarks: convertedData.remarks || '',
    }));

    if (convertedData.items && convertedData.items.length > 0) {
      const newItems = convertedData.items.map((item: any, index: number) => ({
        id: `temp-${Date.now()}-${index}`,
        item_id: item.item_id || null,
        description: item.description,
        qty: item.qty,
        rate: item.rate,
        tax_percent: item.tax_percent || 0,
        uom: item.uom,
        discount_percent: 0,

        line_total: item.qty * item.rate,
      }));
      setItems(newItems);
    }
  }, [isConverting, conversionQuery.data, convertFrom, sourceId]);

  useEffect(() => {
    if (!initLoading) {
      isInitiallyLoadedRef.current = true;
    }
  }, [initLoading]);

  // Background session refresh to prevent JWT expiry during long editing sessions
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Session refresh warning:', error);
        } else if (data?.session) {
          if (import.meta.env.DEV) console.log('Session refreshed successfully');
        }
      } catch (err) {
        console.error('Session refresh error:', err);
      }
    }, 1000 * 60 * 10); // Refresh every 10 minutes

    return () => clearInterval(intervalId);
  }, []);

  const buildClientContacts = (client: any) => {
    const list: Array<{ label: string; value: string }> = [];
    if (client.contact_person) list.push({ label: 'Primary Contact', value: client.contact_person });
    if (client.mobile) list.push({ label: 'Mobile', value: client.mobile });
    if (client.email) list.push({ label: 'Email', value: client.email });
    return list;
  };

  const handleClientChange = async (clientId: string) => {
    setUseArcPricing(false);
    setArcPricingMap({});

    if (!clientId) {
      setFormData({ ...formData, client_id: '', billing_address: '', shipping_address: '', gstin: '', state: '', client_contact: '' });
      setHeaderDiscounts({});
      return;
    }

    const client = clients.find(c => c.id === clientId);
    if (client) {
      const billingAddress = [client.address1, client.address2, client.city, client.state, client.pincode]
        .filter(Boolean)
        .join(', ');

      const contacts = buildClientContacts(client);
      
      let defaultShipAddr = '';
      try {
        const { data: shipAddrs } = await supabase
          .from('client_shipping_addresses')
          .select('*')
          .eq('client_id', clientId)
          .eq('is_default', true)
          .limit(1);

        if (shipAddrs && shipAddrs.length > 0) {
          const addr = shipAddrs[0];
          defaultShipAddr = [addr.address_line1, addr.address_line2, addr.city, addr.state, addr.pincode]
            .filter(Boolean)
            .join(', ');
        }
      } catch (err) {
        console.error('Error loading default shipping address:', err);
      }

      setFormData({
        ...formData,
        client_id: clientId,
        billing_address: billingAddress,
        shipping_address: defaultShipAddr,
        gstin: client.gstin || '',
        state: client.state || '',
        client_contact: contacts[0]?.value || ''
      });

      const portfolio = await loadClientDiscountPortfolio(clientId);
      if (portfolio.settings && Object.keys(portfolio.settings).length > 0) {
        setDiscountSettings(prev => ({ ...prev, ...portfolio.settings }));
      }
      setHeaderDiscounts(portfolio.discounts);

      if (items.length > 0) {
        setItems(items.map(item => {
          if (item.is_header || item.is_subtotal) return item;
          let disc = 0;
          if (item.section === 'erection') {
            disc = portfolio.discounts['erection'] || 0;
          } else {
            const mat = item.material || materials.find(m => m.id === item.item_id);
            const dcId = item.discount_category_id || mat?.discount_category_id;
            disc = dcId ? (portfolio.discounts[dcId] || 0) : 0;
          }
          const baseRate = parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0;
          const finalRate = calculateVariantDiscountedRate(baseRate, disc);
          return {
            ...item,
            discount_percent: disc,
            applied_discount_percent: disc,
            final_rate_snapshot: finalRate,
            rate: finalRate,
            is_override: false
          };
        }));
        toast.success("client discount applied to the client");
      }
    }
  };

  const getRateForMaterialVariant = useCallback((material: any, variantId: string | null, make: string) => {
    if (!material) return 0;
    if (useArcPricing && arcPricingMap[material.id]) {
      const arcRate = getArcRateFromMap(arcPricingMap, material.id, variantId);
      if (arcRate !== null) {
        return arcRate;
      }
    }

    const vId = variantId || 'no_variant';
    const mName = make || '';
    
    if ((variantPricing as any)[material.id]?.[vId]?.[mName] !== undefined) {
      return (variantPricing as any)[material.id][vId][mName];
    }
    
    if (mName) {
      const itemPricing = (variantPricing as any)[material.id] || {};
      for (const v in itemPricing) {
        if (itemPricing[v][mName] !== undefined) {
          return itemPricing[v][mName];
        }
      }
    }
    
    if ((variantPricing as any)[material.id]?.[vId]?.[''] !== undefined) {
      return (variantPricing as any)[material.id][vId][''];
    }

    return parseFloat(material.sale_price) || 0;
  }, [useArcPricing, arcPricingMap, variantPricing]);

  const calculateVariantDiscountedRate = useCallback((baseRate: number, discountPercent: number) => {
    return Math.max(0, baseRate - (baseRate * discountPercent) / 100);
  }, []);

  const getTableMinWidth = useCallback(() => {
    let width = 750;
    if (templateSettings?.column_settings?.optional?.hsn_code !== false) width += 80;
    if (templateSettings?.column_settings?.optional?.make !== false) width += 100;
    if (templateSettings?.column_settings?.optional?.variant !== false) width += 120;
    if (templateSettings?.column_settings?.optional?.client_part_no === true) width += 110;
    if (templateSettings?.column_settings?.optional?.client_description === true) width += 160;
    if (templateSettings?.column_settings?.optional?.custom1 !== false) width += 90;
    if (templateSettings?.column_settings?.optional?.custom2 !== false) width += 90;
    return `${width}px`;
  }, [templateSettings]);

  const getVisibleColumnCount = useCallback(() => {
    let count = 10;
    if (templateSettings?.column_settings?.optional?.hsn_code !== false) count++;
    if (templateSettings?.column_settings?.optional?.make !== false) count++;
    if (templateSettings?.column_settings?.optional?.variant !== false) count++;
    if (templateSettings?.column_settings?.optional?.client_part_no === true) count++;
    if (templateSettings?.column_settings?.optional?.client_description === true) count++;
    if (templateSettings?.column_settings?.optional?.custom1 !== false) count++;
    if (templateSettings?.column_settings?.optional?.custom2 !== false) count++;
    return count;
  }, [templateSettings]);

  const getColsBeforeQty = useCallback(() => {
    let count = 2;
    if (templateSettings?.column_settings?.optional?.hsn_code !== false) count++;
    if (templateSettings?.column_settings?.optional?.client_part_no === true) count++;
    if (templateSettings?.column_settings?.optional?.client_description === true) count++;
    if (templateSettings?.column_settings?.optional?.make !== false) count++;
    if (templateSettings?.column_settings?.optional?.variant !== false) count++;
    return count;
  }, [templateSettings]);

  const getColsBeforeAmount = useCallback(() => {
    return getVisibleColumnCount() - 2;
  }, [getVisibleColumnCount]);

  const getColsBeforeGst = () => {
    return getColsBeforeAmount() - 2;
  };

  const openMoveToDialog = useCallback((itemId: string | number, currentSNo: number, section: 'materials' | 'erection') => {
    setMoveToDialog({
      open: true,
      itemId,
      currentSNo,
      section,
      value: '',
      error: ''
    });
  }, []);

  const confirmMoveTo = useCallback(() => {
    if (!moveToDialog || !moveToDialog.itemId) return;
    const targetSNo = parseInt(moveToDialog.value);
    if (isNaN(targetSNo) || targetSNo <= 0) {
      setMoveToDialog(prev => prev ? { ...prev, error: 'Enter a valid serial number' } : null);
      return;
    }
    const sectionItems = items.filter(item => 
      moveToDialog.section === 'materials' ? item.section !== 'erection' : item.section === 'erection'
    );
    const maxSNo = sectionItems.filter(i => !i.is_header && !i.is_subtotal).length;
    if (targetSNo > maxSNo) {
      setMoveToDialog(prev => prev ? { ...prev, error: `S.No cannot exceed ${maxSNo}` } : null);
      return;
    }
    moveToSerialNo(moveToDialog.itemId, targetSNo, moveToDialog.section);
    setMoveToDialog(null);
  }, [moveToDialog, items]);

  const handleDragStart = useCallback((e: React.DragEvent, itemId: string | number) => {
    setDraggingItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDropOnRow = useCallback((e: React.DragEvent, targetId: string | number) => {
    e.preventDefault();
    if (!draggingItemId || draggingItemId === targetId) return;
    setItems((prev) => {
      const fromIndex = prev.findIndex((r) => r.id === draggingItemId);
      const toIndex = prev.findIndex((r) => r.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setDraggingItemId(null);
  }, [draggingItemId]);

  const handleDragEnd = useCallback(() => {
    setDraggingItemId(null);
  }, []);

  const moveToSerialNo = useCallback((itemId: string | number, targetSNo: number, section: 'materials' | 'erection') => {
    setItems((prev) => {
      const inSection = (item: any) =>
        section === 'materials' ? item.section !== 'erection' : item.section === 'erection';

      let regularCount = 0;
      let targetItemId: string | number | null = null;
      let lastIndexInSection = -1;

      for (let i = 0; i < prev.length; i++) {
        if (!inSection(prev[i])) continue;
        lastIndexInSection = i;
        if (prev[i].is_header || prev[i].is_subtotal) continue;
        regularCount++;
        if (regularCount === targetSNo) {
          targetItemId = prev[i].id;
          break;
        }
      }

      const fromIndex = prev.findIndex((item) => item.id === itemId);
      if (fromIndex < 0) return prev;

      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);

      let insertIndex: number;
      if (targetItemId !== null) {
        insertIndex = updated.findIndex((item) => item.id === targetItemId);
      } else {
        insertIndex = lastIndexInSection >= 0 ? lastIndexInSection : updated.length;
      }

      updated.splice(insertIndex, 0, movedItem);
      return updated;
    });
  }, []);

  const getStockTotalForItem = (item: any) => {
    return 0;
  };

  const getStockRowsForItem = (item: any) => {
    return [];
  };

  const updateItem = useCallback((itemId: string | number, fieldOrUpdates: any, value?: any) => {
    const isBulk = typeof fieldOrUpdates === 'object' && fieldOrUpdates !== null;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        let updates: any = {};
        if (typeof fieldOrUpdates === 'string') {
          updates[fieldOrUpdates] = value;
        } else {
          updates = { ...fieldOrUpdates };
        }

        const updatedItem = { ...item, ...updates };

        if ('qty' in updates || 'rate' in updates || 'discount_percent' in updates || 'tax_percent' in updates || 'variant_id' in updates || 'make' in updates) {
          const qty = 'qty' in updates ? parseFloat(updates.qty) || 0 : parseFloat(item.qty) || 0;
          let rate = item.rate || 0;

          if ('rate' in updates) {
            rate = parseFloat(updates.rate) || 0;
            updatedItem.is_override = true;
          } else {
            const variantId = 'variant_id' in updates ? updates.variant_id : item.variant_id;
            const make = 'make' in updates ? updates.make : item.make;
            const mat = materials.find(m => m.id === item.item_id);
            const baseRate = getRateForMaterialVariant(mat, variantId, make);
            updatedItem.base_rate_snapshot = baseRate;

            let headerDiscount = 0;
            const dcId = item.discount_category_id || mat?.discount_category_id;
            if (item.section === 'erection') {
              headerDiscount = headerDiscounts['erection'] || 0;
            } else if (dcId) {
              headerDiscount = headerDiscounts[dcId] || 0;
            }

            const discountPercent = 'discount_percent' in updates ? parseFloat(updates.discount_percent) || 0 : (item.is_override ? item.discount_percent : headerDiscount);
            if ('discount_percent' in updates) {
              if (discountPercent !== headerDiscount) {
                updatedItem.is_override = true;
              } else {
                updatedItem.is_override = false;
              }
            }

            rate = calculateVariantDiscountedRate(baseRate, discountPercent);
            updatedItem.discount_percent = discountPercent;
            updatedItem.applied_discount_percent = discountPercent;
          }

          updatedItem.rate = rate;
          const taxPercent = 'tax_percent' in updates ? parseFloat(updates.tax_percent) || 0 : parseFloat(item.tax_percent) || 0;
          const taxable = qty * rate;
          const taxAmount = (taxable * taxPercent) / 100;
          updatedItem.line_total = taxable + taxAmount;
          updatedItem.tax_amount = taxAmount;
        }

        // negotiation_mode override tracking
        if (formData.negotiation_mode) {
          if ('discount_percent' in updates) {
            const original = item.original_discount_percent || 0;
            updatedItem.override_flag = updates.discount_percent !== original;
          }
          if ('rate' in updates) {
            updatedItem.override_flag = true;
          }
        }

        // Trigger erection charge creation/update for material changes
        const triggerFields = ['qty', 'uom', 'description', 'item_id'];
        const hasTrigger = isBulk 
          ? triggerFields.some(f => f in fieldOrUpdates)
          : triggerFields.includes(fieldOrUpdates);

        if (hasTrigger) {
          // Only trigger if this is a material item (not erection)
          if (item.section !== 'erection') {
            autoCreateOrUpdateErection({
              ...updatedItem,
              section: 'materials',
              quotation_id: formData.id
            }).catch((err: any) => {
              console.warn('Erection auto-creation warning:', err.message);
            });
          }
        }

        return updatedItem;
      })
    );
  }, [materials, headerDiscounts, getRateForMaterialVariant, calculateVariantDiscountedRate, formData.negotiation_mode, formData.id]);

  const removeItem = useCallback((itemId: string | number) => {
    const linkedErection = items.find(item => item.section === 'erection' && String(item.linked_material_id) === String(itemId));

    if (linkedErection) {
      setConfirmDialog({
        title: 'Delete Material & Erection Charges',
        description: `This material has a linked erection charge: "${linkedErection.description || 'Erection charge'}". Deleting this material will also delete the linked erection charge. Do you want to proceed?`,
        confirmLabel: 'Delete Both',
        onConfirm: () => {
          setItems((prev) => prev.filter((item) => item.id !== itemId && item.id !== linkedErection.id));
          setConfirmDialog(null);
        }
      });
    } else {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    }
  }, [items]);

  const addEmptyItemRow = useCallback((section?: 'materials' | 'erection') => {
    const rowId = Date.now() + Math.random();
    const headerVariantId = formData.variant_id || null;
    const headerVariantDiscount = headerVariantId ? (headerDiscounts[headerVariantId] || 0) : 0;
    
    setItems((prev) => [
      ...prev,
      {
        id: rowId,
        item_id: '',
        variant_id: headerVariantId,
        material: null,
        hsn_code: '',
        description: '',
        qty: null,
        uom: '',
        rate: 0,
        discount_percent: headerVariantDiscount,
        discount_amount: 0,

        tax_percent: 0,
        tax_amount: 0,
        line_total: 0,
        override_flag: false,
        original_discount_percent: headerVariantDiscount,
        base_rate_snapshot: 0,
        applied_discount_percent: headerVariantDiscount,
        is_override: false,
        final_rate_snapshot: 0,
        display_order: prev.length,
        is_header: false,
        custom1: '',
        custom2: '',
        section: section || 'materials'
      }
    ]);
  }, [formData, headerDiscounts]);

  const handleHeaderDiscountChange = async (categoryId: string, discountVal: number, type: string) => {
    if (items.length === 0) return;
    setItems(prev => prev.map(item => {
      if (item.is_header || item.is_subtotal) return item;
      const isMatch = type === 'erection' ? item.section === 'erection' : item.discount_category_id === categoryId;
      if (!isMatch || item.is_override) return item;
      const baseRate = item.base_rate_snapshot || item.rate || 0;
      const finalRate = calculateVariantDiscountedRate(baseRate, discountVal);
      const qty = parseFloat(item.qty) || 0;
      const taxPercent = parseFloat(item.tax_percent) || 0;
      const taxable = qty * finalRate;
      const taxAmount = (taxable * taxPercent) / 100;
      return {
        ...item,
        discount_percent: discountVal,
        applied_discount_percent: discountVal,
        rate: finalRate,
        line_total: taxable + taxAmount,
        tax_amount: taxAmount
      };
    }));
  };

  const handleBulkDelete = () => {
    const linkedErections = items.filter(item => 
      item.section === 'erection' && 
      item.linked_material_id && 
      selectedItemIds.includes(String(item.linked_material_id))
    );

    const unselectedLinkedErections = linkedErections.filter(item => 
      !selectedItemIds.includes(String(item.id))
    );

    if (unselectedLinkedErections.length > 0) {
      setConfirmDialog({
        title: 'Delete Selected Materials & Linked Erection Charges',
        description: `Some of the selected materials have linked erection charges. Deleting these materials will also delete their linked erection charges (${unselectedLinkedErections.length} item(s)). Do you want to proceed?`,
        confirmLabel: 'Delete All',
        onConfirm: () => {
          const idsToDelete = [...selectedItemIds, ...linkedErections.map(e => String(e.id))];
          setItems(prev => prev.filter(item => !idsToDelete.includes(String(item.id))));
          setSelectedItemIds([]);
          setConfirmDialog(null);
          toast.success('Deleted selected items and linked erection charges');
        }
      });
    } else {
      setItems(prev => prev.filter(item => !selectedItemIds.includes(String(item.id))));
      setSelectedItemIds([]);
      toast.success('Deleted selected items');
    }
  };

  const handleBulkSetDiscount = (pct: number) => {
    setItems(prev => prev.map(item => {
      if (selectedItemIds.includes(String(item.id)) && !item.is_header && !item.is_subtotal) {
        const baseRate = item.base_rate_snapshot || 0;
        const finalRate = calculateVariantDiscountedRate(baseRate, pct);
        return {
          ...item,
          discount_percent: pct,
          applied_discount_percent: pct,
          rate: finalRate,
          is_override: true
        };
      }
      return item;
    }));
    setSelectedItemIds([]);
    toast.success(`Applied ${pct}% discount to selected items`);
  };

  const handleBulkSetMake = (make: string) => {
    setItems(prev => prev.map(item => {
      if (selectedItemIds.includes(String(item.id)) && !item.is_header && !item.is_subtotal && item.item_id) {
        const mat = materials.find(m => m.id === item.item_id);
        if (mat) {
          const newRate = getRateForMaterialVariant(mat, item.variant_id || null, make);
          const finalRate = calculateVariantDiscountedRate(newRate, item.discount_percent || 0);
          return {
            ...item,
            make,
            base_rate_snapshot: newRate,
            rate: finalRate,
            final_rate_snapshot: finalRate
          };
        }
      }
      return item;
    }));
    setSelectedItemIds([]);
    toast.success(`Set make to "${make || 'No Make'}" for selected items`);
  };

  const getApprovalDisplayStatus = (categoryId: string) => {
    return 'none';
  };

  const handleUndoImport = () => {
    setItems([{
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
    setActiveImportSessionId(null);
  };

  const DEFAULT_CLASSIFICATIONS = ['finished_good', 'goods_sold', 'consumable'];

  const filteredMaterials = useMemo(() => {
    const search = itemSearch.toLowerCase();
    const base = search
      ? materials
      : materials.filter((m: any) => DEFAULT_CLASSIFICATIONS.includes(m.item_classification));
    return base.filter((m: any) =>
      !search ||
      m.name?.toLowerCase().includes(search) ||
      m.item_code?.toLowerCase().includes(search) ||
      m.display_name?.toLowerCase().includes(search)
    );
  }, [materials, itemSearch]);

  const handleAddItemToPicker = (material: any) => {
    const existing = pickerItems.find(i => i.item_id === material.id && (i.variant_id || null) === null);
    if (existing) {
      setPickerItems(pickerItems.map(i => 
        i.item_id === material.id && (i.variant_id || null) === null ? { ...i, qty: i.qty + 1 } : i
      ));
    } else {
      setPickerItems([...pickerItems, {
        item_id: material.id,
        variant_id: null,
        material: material,
        qty: 1,
        rate: getRateForMaterialVariant(material, null, ''),
        uom: material.unit,
        tax_percent: material.gst_rate || 0,
        discount_percent: 0,

        description: ''
      }]);
    }
  };

  const handlePickerQtyChange = (itemId: string | number, value: string) => {
    const num = parseFloat(value) || 1;
    setPickerItems(pickerItems.map(i => {
      if (i.item_id === itemId) {
        return { ...i, qty: Math.max(1, num) };
      }
      return i;
    }));
  };

  const handleRemoveFromPicker = (itemId: string | number) => {
    setPickerItems(pickerItems.filter(i => i.item_id !== itemId));
  };

  const handleAddItemsToQuotation = () => {
    const currentItemsLength = items.length;
    const newItems = pickerItems.map((p, idx) => {
      const baseRate = p.rate;
      const variantId = p.variant_id || null;
      const dcId = p.material?.discount_category_id || null;
      const headerDiscount = dcId ? (headerDiscounts[dcId] || 0) : 0;
      const finalRate = calculateVariantDiscountedRate(baseRate, headerDiscount);
      
      return {
        id: Date.now() + idx,
        item_id: p.item_id,
        variant_id: variantId,
        discount_category_id: dcId,
        material: p.material,
        hsn_code: p.material?.hsn_code || null,
        description: p.description || p.material?.display_name || p.material?.name || '',
        qty: p.qty,
        uom: p.uom,
        rate: finalRate,
        discount_percent: headerDiscount,
        discount_amount: 0,

        tax_percent: p.tax_percent,
        tax_amount: 0,
        line_total: 0,
        override_flag: false,
        original_discount_percent: headerDiscount,
        base_rate_snapshot: baseRate,
        applied_discount_percent: headerDiscount,
        is_override: false,
        final_rate_snapshot: finalRate,
        display_order: currentItemsLength + idx,
        custom1: '',
        custom2: ''
      };
    });

    setItems([...items, ...newItems]);
    setPickerItems([]);
    setShowItemPicker(false);
    setItemSearch('');
    setTimeout(() => {
      itemsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  // Calculate erection charges immediately (without saving to DB)
  const calculateErectionCharges = async () => {
    if (!formData.include_erection_charges) {
      setItems((prevItems: any[]) => prevItems.filter(item => item.section !== 'erection'));
      return;
    }
    
    const materialItems = items.filter(item => !item.is_header && item.section !== 'erection');
    console.log('[Erection] materialItems found:', materialItems.length, materialItems.map(i => i.description));
    const newErectionItems = [];
    
    for (const item of materialItems) {
      const itemName = item.description || item.material?.display_name || item.material?.name || '';
      if (!itemName) continue;
      
      let lookupServiceRate: any;
      try {
        const mod = await import('../../hooks/useErectionCharges');
        lookupServiceRate = mod.lookupServiceRate;
      } catch (err) {
        console.error('[Erection] dynamic import failed:', err);
        continue;
      }
      
      let serviceRate: any;
      try {
        serviceRate = await lookupServiceRate(itemName);
      } catch (err) {
        console.error(`[Erection] lookupServiceRate failed for "${itemName}":`, err);
        continue;
      }
      if (!serviceRate) {
        console.log(`[Erection] No service rate found for "${itemName}"`);
        // Preserve existing DB-saved erection item if one exists
        const existingDbErection = items.find(e => 
          e.section === 'erection' && 
          e.linked_material_id === item.id
        );
        if (existingDbErection) {
          console.log(`[Erection] Preserving existing erection for "${itemName}"`);
          newErectionItems.push(existingDbErection);
        }
        continue;
      }
      console.log(`[Erection] Rate found for "${itemName}":`, serviceRate.default_erection_rate);
      
      // Check if erection item already exists for this material
      const existingErection = items.find(e => 
        e.section === 'erection' && 
        e.linked_material_id === item.id
      );
      
      if (existingErection) {
        // Evaluate rate taking manual edits or base rate into account
        const baseRate = existingErection.rate_manually_edited 
          ? parseFloat(existingErection.base_rate_snapshot || existingErection.rate || 0) 
          : serviceRate.default_erection_rate;
        
        // Preserve any previously applied discount for this row
        const discountToApply = existingErection.discount_percent || headerDiscounts['erection'] || 0;
        const finalRate = calculateVariantDiscountedRate(baseRate, discountToApply);

        // Update existing erection
        const updatedErection = {
          ...existingErection,
          description: `${itemName} - Erection`,
          qty: item.qty,
          uom: item.uom,
          rate: finalRate,
          base_rate_snapshot: baseRate,
          discount_percent: discountToApply,
          applied_discount_percent: discountToApply,
          tax_percent: item.tax_percent || 0,
          line_total: (item.qty || 0) * finalRate,
          sac_code: serviceRate.sac_code || null
        };
        newErectionItems.push(updatedErection);
      } else {
        // Create new erection item
        const baseRate = serviceRate.default_erection_rate;
        const discountToApply = headerDiscounts['erection'] || 0;
        const finalRate = calculateVariantDiscountedRate(baseRate, discountToApply);

        const newErection = {
          id: Date.now() + Math.random(), // Temporary ID
          section: 'erection',
          description: `${itemName} - Erection`,
          qty: item.qty,
          uom: item.uom,
          rate: finalRate,
          tax_percent: item.tax_percent || 0,
          line_total: (item.qty || 0) * finalRate,
          linked_material_id: item.id,
          is_auto_quantity: true,
          rate_manually_edited: false,
          sac_code: serviceRate.sac_code || null,
          is_header: false,
          hsn_code: null,
          item_id: null,
          variant_id: null,
          make: null,
          original_discount_percent: 0,
          discount_percent: discountToApply,
          discount_amount: 0,
          tax_amount: 0,
          override_flag: false,
          base_rate_snapshot: baseRate,
          applied_discount_percent: discountToApply,
          is_override: false,
          final_rate_snapshot: finalRate,
          display_order: 0,
          custom1: '',
          custom2: ''
        };
        newErectionItems.push(newErection);
      }
    }
    
    console.log('[Erection] newErectionItems created:', newErectionItems.length);
    setItems((prevItems: any[]) => {
      const nonErectionItems = prevItems.filter(item => item.section !== 'erection');
      const result = [...nonErectionItems, ...newErectionItems];
      console.log('[Erection] setItems result length:', result.length, 'erection count:', result.filter((i: any) => i.section === 'erection').length);
      return result;
    });
  };

  // Effect to calculate erection charges when checkbox is toggled
  useEffect(() => {
    if (formData.include_erection_charges) {
      calculateErectionCharges();
    } else {
      // Remove erection items if unchecked
      setItems((prevItems: any[]) => prevItems.filter(item => item.section !== 'erection'));
    }
  }, [formData.include_erection_charges]); // Only depend on checkbox state

  // Also recalculate when materials change (qty, description, etc.)
  useEffect(() => {
    if (formData.include_erection_charges && items.length > 0) {
      // Debounce to avoid excessive recalculations
      const timer = setTimeout(() => {
        calculateErectionCharges();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [items.filter(item => !item.is_header && item.section !== 'erection').map(item => `${item.id}-${item.qty}-${item.description}`).join(',')]);

  const saveCurrentRevision = useCallback(async () => {
    if (!formData.id || !editId) return null;
    const currentRevisionNo = formData.revision_no || 1;
    const newRevisionNo = currentRevisionNo + 1;
    const revisionSnapshot = {
      revision_no: currentRevisionNo,
      saved_at: new Date().toISOString(),
      items: items.map(item => ({
        ...item,
        id: item.id || Date.now() + Math.random()
      })),
      header: {
        subtotal: calculations.subtotal,
        total_item_discount: calculations.totalItemDiscount,
        extra_discount_percent: formData.extra_discount_percent,
        extra_discount_amount: formData.extra_discount_amount,
        total_tax: calculations.totalTax,
        round_off: calculations.roundOff,
        grand_total: calculations.grandTotal,
        variant_id: formData.variant_id,
        remarks: formData.remarks
      },
      header_discounts: { ...headerDiscounts }
    };
    const newHistory = [...(formData.revision_history || []), revisionSnapshot];
    try {
      const { error } = await supabase
        .from('quotation_header')
        .update({
          revision_no: newRevisionNo,
          revision_history: newHistory
        })
        .eq('id', formData.id);
      if (error) throw error;
      return { newRevisionNo, newHistory };
    } catch (err) {
      console.error('Error saving revision:', err);
      return null;
    }
  }, [formData, items, calculations, headerDiscounts, editId]);

  const handleSave = async (saveAndNew = false, isAutosave = false) => {
    if (saving) return;
    if (!organisation?.id) {
      setSaveStatus('error');
      if (!isAutosave) {
        toast.error('Validation error', { description: 'Organisation ID is missing. Please refresh and try again.' });
      }
      return;
    }
    if (!user?.id) {
      setSaveStatus('error');
      if (!isAutosave) {
        toast.error('Validation error', { description: 'User session is missing. Please refresh and log in again.' });
      }
      return;
    }
    if (!formData.client_id) {
      if (!isAutosave) {
        toast.error('Validation error', { description: 'Please select a client.' });
      }
      return;
    }

    // Zod validation for date range (Valid Till cannot be before/below Quote Date)
    const dateValidationSchema = z.object({
      date: z.string().min(1, 'Quote date is required'),
      valid_till: z.string().nullable().optional(),
    }).refine((data) => {
      if (!data.date || !data.valid_till) return true;
      return new Date(data.valid_till) > new Date(data.date);
    }, {
      message: 'Valid Till date must be after the Quote date',
      path: ['valid_till'],
    });

    const dateResult = dateValidationSchema.safeParse({
      date: formData.date,
      valid_till: formData.valid_till,
    });

    if (!dateResult.success) {
      const errorMsg = dateResult.error.errors[0]?.message || 'Invalid date range';
      if (!isAutosave) {
        toast.error(errorMsg);
      }
      return;
    }
    const cleanItems = items.filter(item => item.item_id || item.is_header || item.is_subtotal || item.section === 'erection');
    if (cleanItems.length === 0) {
      if (!isAutosave) {
        toast.error('Validation error', { description: 'Please add at least one item.' });
      }
      return;
    }

    setSaving(true);
    setSaveStatus('saving');
    ignoreDirtyRef.current = true;
    try {
      let sessionValid = true;
      try {
        sessionValid = await withTimeout(ensureValidSession(), 'checking active session', 8000);
      } catch (sessionCheckErr) {
        if (isTimeoutError(sessionCheckErr, 'checking active session')) {
          sessionValid = true;
        } else {
          throw sessionCheckErr;
        }
      }

      if (!sessionValid) {
        setSaveStatus('error');
        if (!isAutosave) {
          toast.error('Session expired', { description: 'Please refresh the page and log in again.' });
        }
        ignoreDirtyRef.current = false;
        setSaving(false);
        return;
      }

      const needsApproval = !editId;
      let quotationId = editId;

      const quotationData = {
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        billing_address: formData.billing_address,
        shipping_address: formData.shipping_address || null,
        gstin: formData.gstin,
        state: formData.state,
        date: formData.date,
        valid_till: formData.valid_till || null,
        payment_terms: formData.payment_terms,
        client_contact: formData.client_contact,
        variant_id: formData.variant_id || null,
        reference: formData.reference || null,
        prepared_by: formData.prepared_by || user?.user_metadata?.full_name || user?.email?.split('@')[0] || null,
        subtotal: calculations.subtotal,
        total_item_discount: calculations.totalItemDiscount,
        extra_discount_percent: parseFloat(formData.extra_discount_percent) || 0,
        extra_discount_amount: parseFloat(formData.extra_discount_amount) || 0,
        total_tax: calculations.totalTax,
        round_off: calculations.roundOff,
        grand_total: calculations.grandTotal,
        status: editId ? formData.status || 'Draft' : 'Draft',
        negotiation_mode: formData.negotiation_mode,
        authorized_signatory_id: (() => {
          const val = formData.authorized_signatory_id;
          if (val && val.length > 0 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
            return String(val);
          }
          return null;
        })(),
        revision_no: formData.revision_no || 1,
        revision_history: formData.revision_history || [],
      };

      if (editId) {
        let updateQuery = supabase
          .from('quotation_header')
          .update({
            ...quotationData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editId)
          .eq('organisation_id', organisation?.id);

        if (lastLoadedUpdatedAt) {
          updateQuery = updateQuery.eq('updated_at', lastLoadedUpdatedAt);
        }

        const { data: updatedHeader, error: updateError } = await withTimeout(
          updateQuery.select('id, updated_at'),
          'updating quotation header'
        );
        if (updateError) throw updateError;
        if (!updatedHeader || updatedHeader.length === 0) {
          setSaveStatus('conflict');
          if (!isAutosave) {
            toast.error('Save conflict', {
              description: 'This quotation was modified by someone else. Please reload to see the latest version before saving again.'
            });
          }
          ignoreDirtyRef.current = false;
          setSaving(false);
          return;
        }
        quotationId = updatedHeader[0].id;
        setLastLoadedUpdatedAt(updatedHeader[0].updated_at);
        setFormData(prev => ({ ...prev, id: quotationId }));
      } else {
        const MAX_RETRIES = 3;
        let data = null;
        let error = null;

        for (let retry = 0; retry < MAX_RETRIES; retry++) {
          let defaultSeries = null;
          try {
            defaultSeries = await fetchDefaultSeriesRow();
          } catch (seriesError) {
            if (!isTimeoutError(seriesError, 'loading document series') && !isMissingColumnError(seriesError, 'is_default')) {
              throw seriesError;
            }
          }
          
          let quotationNo = '';
          if (defaultSeries) {
            const baseNo = buildQuoteNoFromSeries(defaultSeries);
            quotationNo = retry > 0 ? `${baseNo}-${Date.now().toString().slice(-4)}` : baseNo;
          } else {
            quotationNo = 'QT-0001';
            try {
              const { data: existing } = await withTimeout(
                supabase
                  .from('quotation_header')
                  .select('quotation_no')
                  .eq('organisation_id', organisation?.id)
                  .order('created_at', { ascending: false })
                  .limit(1),
                'loading latest quotation number',
                20000
              );

              if (existing && existing.length > 0) {
                const lastNum = parseInt((existing[0].quotation_no || '').replace(/[^0-9]/g, ''), 10) || 0;
                quotationNo = `QT-${String(lastNum + 1 + retry).padStart(4, '0')}`;
              }
            } catch (noSeriesFallbackErr) {
              if (!isTimeoutError(noSeriesFallbackErr, 'loading latest quotation number')) {
                throw noSeriesFallbackErr;
              }
              quotationNo = `QT-${Date.now().toString().slice(-6)}${retry}`;
            }
          }

          const createHeader = () =>
            supabase
              .from('quotation_header')
              .insert({ 
                ...quotationData, 
                quotation_no: quotationNo, 
                organisation_id: organisation.id,
                prepared_by: user?.user_metadata?.full_name || user?.email?.split('@')[0] || null,
                created_by: userProfileId || user.id
              })
              .select();

          data = null;
          error = null;
          try {
            const result = await withTimeout(createHeader(), 'creating quotation header');
            data = result?.data ?? null;
            error = result?.error ?? null;
          } catch (createHeaderErr) {
            if (!isTimeoutError(createHeaderErr, 'creating quotation header')) {
              throw createHeaderErr;
            }

            await ensureValidSession({ strict: false, timeoutMs: 7000 });
            const retryResult = await withTimeout(
              createHeader(),
              'creating quotation header',
              60000
            );
            data = retryResult?.data ?? null;
            error = retryResult?.error ?? null;
          }

          if (error && error.code === '23505') {
            if (retry < MAX_RETRIES - 1) {
              continue;
            }
            throw new Error(`Quotation number ${quotationNo} already exists. Please try saving again.`);
          }
          if (error) throw error;
          
          if (!data || data.length === 0) {
            throw new Error('Failed to create quotation header. No data returned.');
          }
          
          quotationId = data[0].id;
          setFormData((prev: any) => ({ ...prev, id: quotationId }));

          if (formData.terms_conditions || formData.terms_text) {
            supabase.from('quotation_terms_conditions').insert({
              quotation_id: quotationId,
              organisation_id: organisation?.id,
              custom_content: JSON.stringify(formData.terms_conditions || { text: formData.terms_text }),
              template_id: formData.terms_conditions?.id || null,
              is_custom: true
            }).then().catch(err => console.error('Error saving terms:', err));
          }

          // Increment series atomically with optimistic lock
          if (defaultSeries) {
            const nextNo = getQuoteSeriesNumber(defaultSeries) + 1;
            const cfg = defaultSeries?.configs || {};
            const quoteCfg = cfg.quote || {};
            const updatedCfg = { ...cfg, quote: { ...quoteCfg, start_number: nextNo } };
            await supabase.from('document_series').update({ current_number: nextNo, configs: updatedCfg }).eq('id', defaultSeries.id);
          }

          break;
        }
      }

      const rawItems = cleanItems.map((item, index) => {
        const isErection = item.section === 'erection';
        return {
          id: item.id,
          quotation_id: quotationId,
          organisation_id: organisation.id,
          item_id: isErection ? null : (item.item_id || null),
          sac_code: isErection ? (item.sac_code || '995419') : null,
          description: isErection ? (item.description || 'Erection Charges') : (item.description || ''),
          qty: item.qty === null ? null : (parseFloat(item.qty as any) || 0),
          rate: parseFloat(item.rate) || 0,
          tax_percent: parseFloat(item.tax_percent) || 0,
          uom: item.uom || '',
          discount_percent: parseFloat(item.discount_percent) || 0,
  
          line_total: parseFloat(item.line_total) || 0,
          display_order: index,
          custom1: item.custom1 || '',
          custom2: item.custom2 || '',
          variant_id: item.variant_id || null,
          base_rate_snapshot: parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0,
          applied_discount_percent: parseFloat(item.applied_discount_percent) || 0,
          is_override: item.is_override || false,
          final_rate_snapshot: parseFloat(item.final_rate_snapshot) || parseFloat(item.rate) || 0,
          is_header: !!item.is_header,
          is_subtotal: !!item.is_subtotal,
          subtotal_label: item.subtotal_label || null
        };
      });

      const savedItems = await saveItemsDiff(quotationId, rawItems, originalItems);

      // Build temp-ID → DB-ID map so erection items' linked_material_id stays correct after save
      const idMap = new Map<string, string>();
      cleanItems.forEach((item, index) => {
        const saved = savedItems[index];
        if (saved && String(item.id) !== String(saved.id)) {
          idMap.set(String(item.id), String(saved.id));
        }
      });

      const mappedSavedItems = savedItems.map((saved, index) => {
        const originalItem = cleanItems[index];
        const mapped: any = {
          ...originalItem,
          id: saved.id,
          created_at: saved.created_at,
          updated_at: saved.updated_at
        };
        // Update linked_material_id if the parent material's ID changed
        if (mapped.linked_material_id && idMap.has(String(mapped.linked_material_id))) {
          mapped.linked_material_id = idMap.get(String(mapped.linked_material_id));
        }
        return mapped;
      });
      setItems(mappedSavedItems);
      setOriginalItems(JSON.parse(JSON.stringify(mappedSavedItems)));

      // Save custom variant discounts
      const varDiscounts = Object.entries(headerDiscounts)
        .filter(([id]) => id !== 'erection')
        .map(([variantId, discPercent]) => ({
          quotation_id: quotationId,
          variant_id: variantId,
          discount_percent: parseFloat(discPercent as any) || 0
        }));

      try {
        await supabase.from('quotation_variant_discounts').delete().eq('quotation_id', quotationId);
        if (varDiscounts.length > 0) {
          const { error: vdError } = await supabase.from('quotation_variant_discounts').insert(varDiscounts);
          if (vdError) throw vdError;
        }
      } catch (vdErr: any) {
        console.warn('Could not save variant discounts (table may not exist):', vdErr?.message || vdErr);
      }

      if (isMultiDC && quotationId && dcAllocations.length > 0) {
        // Validate allocated amount matches quotation total (₹1 tolerance)
        const totalAllocated = dcAllocations.reduce((sum, dc) => sum + dc.allocated_amount, 0);
        const quotationTotal = calculations.grandTotal || 0;
        if (Math.abs(totalAllocated - quotationTotal) > 1) {
          throw new Error(`Allocated amount (₹${totalAllocated.toFixed(2)}) does not match quotation total (₹${quotationTotal.toFixed(2)}). Please adjust allocations.`);
        }

        const links = dcAllocations.map(dc => ({
          quotation_id: quotationId,
          delivery_challan_id: dc.dc_id,
          allocated_amount: dc.allocated_amount
        }));

        await supabase.from('quotation_dc_links').delete().eq('quotation_id', quotationId);
        const { error: linkError } = await supabase.from('quotation_dc_links').insert(links);
        if (linkError) throw linkError;

        const dcIdArray = dcAllocations.map(dc => dc.dc_id);
        await supabase
          .from('delivery_challans')
          .update({ conversion_status: 'quoted' })
          .in('id', dcIdArray)
          .in('conversion_status', ['active', 'pending_conversion']);
      }

      if (conversionInfoRef.current && quotationId && !editId) {
        const { type, sourceId: srcId } = conversionInfoRef.current;
        const { status } = useConversionStatus(type);
        const tableName = getSourceTableName(type);

        await supabase
          .from(tableName)
          .update({
            status,
            converted_to_id: quotationId,
            converted_to_type: 'quotation',
          })
          .eq('id', srcId);
      }

      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotations', organisation?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotation', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotation_items', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotation-terms', quotationId] });

      if (!isAutosave && needsApproval && !editId && quotationId) {
        try {
          const approvalResult = await ApprovalIntegration.createQuotationApproval(
            quotationId,
            formData.client_name || 'Unknown Client',
            formData.quotation_no || 'QT-' + quotationId.slice(0, 8),
            calculations.grandTotal,
            'NORMAL'
          );
          if (approvalResult.success) {
            if (import.meta.env.DEV) console.log('Quotation approval created:', approvalResult.approvalId);
          } else if (approvalResult.error && !approvalResult.error.includes('No approval required')) {
            console.error('Failed to create approval request:', approvalResult.error);
            toast.error('Quotation saved but approval request failed', { description: approvalResult.error });
          }
        } catch (approvalError) {
          console.error('Error creating approval request:', approvalError);
          toast.error('Quotation saved but approval creation failed', { description: 'Approval can be requested later.' });
        }
      }

      setIsDirty(false);
      setSaveStatus('saved');

      if (isAutosave) {
        if (!editId && quotationId) {
          navigate(`/quotation/edit?id=${quotationId}`, { replace: true });
        }
        ignoreDirtyRef.current = false;
        setSaving(false);
        return;
      }

      if (saveAndNew) {
        toast.success('Quotation saved as draft!');
        ignoreDirtyRef.current = false;
        setSaving(false);
        return;
      } else {
        navigate(`/quotation/view?id=${quotationId}`);
      }
    } catch (err) {
      console.error('Error saving quotation:', err);
      const errMsg = (err as any)?.message || String(err || '');
      
      if (errMsg.includes('Save conflict') || /conflict/i.test(errMsg) || (err as any)?.code === '409') {
        setSaveStatus('conflict');
        if (!isAutosave) {
          toast.error('Save conflict', {
            description: 'This quotation was modified by someone else. Please reload to see the latest version before saving again.'
          });
        }
      } else {
        setSaveStatus('error');
        if (!isAutosave) {
          if (/session|jwt|token|refresh_token|invalid_grant|not authenticated|auth/i.test(errMsg)) {
            toast.error('Session expired', { description: 'Please refresh the page and log in again.' });
          } else {
            toast.error('Save failed', { description: errMsg });
          }
        }
      }
    } finally {
      ignoreDirtyRef.current = false;
      setSaving(false);
    }
  };

  useAutosave({
    isDirty,
    saving,
    items,
    formData,
    handleSave,
  });

  const updateTemplateSettingsInDb = async (newSettings: any) => {
    if (!newSettings?.id) return;
    try {
      const { error } = await supabase
        .from('document_templates')
        .update({ column_settings: newSettings.column_settings })
        .eq('id', newSettings.id);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error updating template settings:', err);
    }
  };

  const handleArcPricingConfirm = () => {
    setArcPricingConfirmOpen(false);
    setUseArcPricing(true);
    // Apply ARC pricing to items
    setItems(prev => prev.map(item => {
      if (item.is_header || item.is_subtotal || item.section === 'erection') return item;
      if (!item.item_id) return item;
      const arcRate = getArcRateFromMap(arcPricingMap, item.item_id, item.variant_id);
      if (arcRate === null) return item;
      
      const qty = parseFloat(item.qty) || 0;
      const taxPercent = parseFloat(item.tax_percent) || 0;
      const taxable = qty * arcRate;
      const taxAmount = (taxable * taxPercent) / 100;
      return {
        ...item,
        base_rate_snapshot: arcRate,
        rate: arcRate,
        final_rate_snapshot: arcRate,
        line_total: taxable + taxAmount,
        tax_amount: taxAmount,
        is_override: false,
        discount_percent: 0,
        applied_discount_percent: 0
      };
    }));
  };

  const handleSigChange = (sigId: string) => {
    setFormData({ ...formData, authorized_signatory_id: sigId });
    setIsSigDropdownOpen(false);
  };

  const materialItems = useMemo(() => items.filter(item => item.section !== 'erection'), [items]);
  const erectionItems = useMemo(() => items.filter(item => item.section === 'erection'), [items]);
  const materialCount = useMemo(() => materialItems.filter(i => !i.is_header && !i.is_subtotal).length, [materialItems]);

  if (initLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  if (initQuery.isError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontWeight: 600, color: '#b91c1c', marginBottom: '12px' }}>{initErrorMessage}</div>
        <button type="button" className="btn btn-primary" onClick={() => initQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 24px 0', marginTop: '-48px', background: '#f8fafc', minHeight: '100%' }}>
      <QuotationActions
        editId={editId}
        formData={formData}
        setFormData={setFormData}
        saving={saving}
        handleSave={handleSave}
        saveCurrentRevision={saveCurrentRevision}
        setConfirmDialog={setConfirmDialog}
        setRevisionDialogOpen={setRevisionDialogOpen}
        setIsParserOpen={setIsParserOpen}
        activeImportSessionId={activeImportSessionId}
        handleUndoImport={handleUndoImport}
        toast={toast}
        saveStatus={saveStatus}
      />

      <div style={{ background: '#f8fafc', padding: '56px 16px 16px 16px', minHeight: 'calc(100vh - 64px)' }}>
        <PresenceBanner users={activePresenceUsers} />
        {activeImportSessionId && (
          <div className="bg-indigo-900/40 border border-indigo-800/60 text-indigo-200 px-6 py-3 rounded-lg flex items-center justify-between text-xs font-semibold mb-4 animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">AI Imported</span>
              <span>All line items and header values were filled using the AI Document Parser.</span>
            </div>
            <button 
              type="button"
              onClick={handleUndoImport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700/50 hover:bg-indigo-650 border border-indigo-600 text-white rounded font-bold transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo Import
            </button>
          </div>
        )}

        <QuotationHeaderForm
          formData={formData}
          setFormData={setFormData}
          clients={clients}
          clientSearch={clientSearch}
          setClientSearch={setClientSearch}
          isClientDropdownOpen={isClientDropdownOpen}
          setIsClientDropdownOpen={setIsClientDropdownOpen}
          handleClientChange={handleClientChange}
          clientShippingAddresses={clientShippingAddresses}
          variants={variants}
          variantPricing={variantPricing}
          items={items}
          setItems={setItems}
          getRateForMaterialVariant={getRateForMaterialVariant}
          calculateVariantDiscountedRate={calculateVariantDiscountedRate}
          materials={materials}
          headerDiscounts={headerDiscounts}
          setHeaderDiscounts={setHeaderDiscounts}
          handleHeaderDiscountChange={handleHeaderDiscountChange}
          quoteNoPreview={quoteNoPreview}
          projects={projects}
          useArcPricing={useArcPricing}
          setUseArcPricing={setUseArcPricing}
          arcPricingMap={arcPricingMap}
          setArcPricingMap={setArcPricingMap}
          setArcPricingConfirmOpen={setArcPricingConfirmOpen}
          discountCategoryMap={discountCategoryMap}
          activeTab={activeTab}
          getApprovalDisplayStatus={getApprovalDisplayStatus}
          arcPricingQuery={arcPricingQuery}
        />

        {isMultiDC && dcAllocations.length > 0 && (
          <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-8">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-none"></div>
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Multi-DC Value Allocation</h3>
              </div>
              {multiDCError && (
                <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded">{multiDCError}</span>
              )}
            </div>
            <div className="p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 font-semibold text-xs uppercase text-left">
                    <th className="py-2">DC Number</th>
                    <th className="py-2">DC Date</th>
                    <th className="py-2 text-right">DC Total Amount</th>
                    <th className="py-2 text-right">Allocated Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {dcAllocations.map(dc => (
                    <tr key={dc.dc_id} className="text-zinc-700">
                      <td className="py-3 font-semibold text-indigo-600">{dc.dc_number}</td>
                      <td className="py-3 text-zinc-500">{dc.dc_date}</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(dc.total_amount)}</td>
                      <td className="py-3 text-right">
                        <input
                          type="number"
                          className="form-input text-right font-bold text-indigo-600 bg-indigo-50/30 border-indigo-200 max-w-[120px] ml-auto h-8 px-2 text-xs"
                          value={dc.allocated_amount}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setDcAllocations(prev => prev.map(p => p.dc_id === dc.dc_id ? { ...p, allocated_amount: val } : p));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-none border border-zinc-200 shadow-sm overflow-hidden mb-6">
          <div className="flex border-b border-zinc-200 bg-zinc-50/50 justify-between items-center pr-4">
            <div className="flex">
              <button 
                type="button" 
                onClick={() => {
                  document.getElementById('materials-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }} 
                className="px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 border-sky-600 text-sky-600 transition-all hover:text-sky-700"
              >
                Materials List ({materialItems.length})
              </button>
              {formData.include_erection_charges && (
                <button 
                  type="button" 
                  onClick={() => {
                    document.getElementById('erection-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }} 
                  className="px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-zinc-500 hover:text-zinc-800 transition-all"
                >
                  Erection Charges ({erectionItems.length})
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-zinc-200">
            {/* Materials Table Section */}
            <div id="materials-table-section" className="p-4 scroll-mt-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Materials List</h3>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 flex items-center transition-all bg-white" 
                    onClick={() => {
                      setItems(prev => [
                        ...prev,
                        {
                          id: Date.now() + Math.random(),
                          section: 'materials',
                          is_header: true,
                          description: ''
                        }
                      ]);
                    }}
                  >
                    <Plus size={12} className="mr-1" /> Add Section Header
                  </button>
                  <button 
                    type="button" 
                    className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 flex items-center transition-all bg-white" 
                    onClick={() => {
                      setItems(prev => [
                        ...prev,
                        {
                          id: Date.now() + Math.random(),
                          section: 'materials',
                          is_subtotal: true,
                          subtotal_label: 'Sub-total:',
                          description: 'Sub-total:'
                        }
                      ]);
                    }}
                  >
                    <Plus size={12} className="mr-1" /> Add Sub-total Row
                  </button>
                  <button 
                    type="button" 
                    className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 flex items-center transition-all bg-white" 
                    onClick={() => addEmptyItemRow('materials')}
                  >
                    <Plus size={12} className="mr-1" /> Add Materials
                  </button>
                  <button 
                    type="button" 
                    className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 flex items-center transition-all bg-white" 
                    onClick={() => setShowItemPicker(true)}
                  >
                    <Plus size={12} className="mr-1" /> Add Multiple Items
                  </button>
                  <button 
                    type="button" 
                    className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 flex items-center transition-all bg-white" 
                    onClick={() => setShowCustomLabelEditor(true)}
                  >
                    <Plus size={12} className="mr-1" /> Columns
                  </button>
                </div>
              </div>

              <QuotationItemsTable
                items={materialItems}
                materials={materials}
                variants={variants}
                variantPricing={variantPricing}
                itemMakes={itemMakes}
                headerDiscounts={headerDiscounts}
                discountCategoryMap={discountCategoryMap}
                templateSettings={templateSettings}
                qtyDrafts={qtyDrafts}
                setQtyDrafts={setQtyDrafts}
                updateItem={updateItem}
                removeItem={removeItem}
                addEmptyItemRow={() => addEmptyItemRow('materials')}
                setItems={setItems}
                hoveredItemId={hoveredItemId}
                setHoveredItemId={setHoveredItemId}
                setItemSearch={setItemSearch}
                setShowItemPicker={setShowItemPicker}
                activeStockPopoverId={activeStockPopoverId}
                setActiveStockPopoverId={setActiveStockPopoverId}
                getStockTotalForItem={getStockTotalForItem}
                getStockRowsForItem={getStockRowsForItem}
                getVisibleColumnCount={getVisibleColumnCount}
                getColsBeforeQty={getColsBeforeQty}
                getColsBeforeAmount={getColsBeforeAmount}
                getColsBeforeGst={getColsBeforeGst}
                openMoveToDialog={openMoveToDialog}
                moveToDialog={moveToDialog}
                confirmMoveTo={confirmMoveTo}
                setMoveToDialog={setMoveToDialog}
                draggingItemId={draggingItemId}
                handleDragStart={handleDragStart}
                handleDragOver={handleDragOver}
                handleDropOnRow={handleDropOnRow}
                handleDragEnd={handleDragEnd}
                calculations={calculations}
                clientId={formData.client_id}
                getRateForMaterialVariant={getRateForMaterialVariant}
                calculateVariantDiscountedRate={calculateVariantDiscountedRate}
                getTableMinWidth={getTableMinWidth}
                selectedItemIds={selectedItemIds}
                setSelectedItemIds={setSelectedItemIds}
              />
            </div>

            {/* Erection Table Section */}
            {formData.include_erection_charges && (
              <div id="erection-table-section" className="p-4 scroll-mt-6 bg-zinc-50/10">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Erection Charges</h3>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 flex items-center transition-all bg-white" 
                      onClick={() => {
                        setItems(prev => [
                          ...prev,
                          {
                            id: Date.now() + Math.random(),
                            section: 'erection',
                            is_header: true,
                            description: ''
                          }
                        ]);
                      }}
                    >
                      <Plus size={12} className="mr-1" /> Add Section Header
                    </button>
                    <button 
                      type="button" 
                      className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 flex items-center transition-all bg-white" 
                      onClick={() => {
                        setItems(prev => [
                          ...prev,
                          {
                            id: Date.now() + Math.random(),
                            section: 'erection',
                            is_subtotal: true,
                            subtotal_label: 'Sub-total:',
                            description: 'Sub-total:'
                          }
                        ]);
                      }}
                    >
                      <Plus size={12} className="mr-1" /> Add Sub-total Row
                    </button>
                    <button 
                      type="button" 
                      className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 flex items-center transition-all bg-white" 
                      onClick={() => addEmptyItemRow('erection')}
                    >
                      <Plus size={12} className="mr-1" /> Add Row
                    </button>
                  </div>
                </div>

                <ErectionItemsSection
                  items={erectionItems}
                  materials={materials}
                  variants={variants}
                  variantPricing={variantPricing}
                  itemMakes={itemMakes}
                  headerDiscounts={headerDiscounts}
                  discountCategoryMap={discountCategoryMap}
                  templateSettings={templateSettings}
                  qtyDrafts={qtyDrafts}
                  setQtyDrafts={setQtyDrafts}
                  updateItem={updateItem}
                  removeItem={removeItem}
                  addEmptyItemRow={() => addEmptyItemRow('erection')}
                  setItems={setItems}
                  hoveredItemId={hoveredItemId}
                  setHoveredItemId={setHoveredItemId}
                  setItemSearch={setItemSearch}
                  setShowItemPicker={setShowItemPicker}
                  getVisibleColumnCount={getVisibleColumnCount}
                  openMoveToDialog={openMoveToDialog}
                  moveToDialog={moveToDialog}
                  confirmMoveTo={confirmMoveTo}
                  setMoveToDialog={setMoveToDialog}
                  draggingItemId={draggingItemId}
                  handleDragStart={handleDragStart}
                  handleDragOver={handleDragOver}
                  handleDropOnRow={handleDropOnRow}
                  handleDragEnd={handleDragEnd}
                  calculations={calculations}
                  clientId={formData.client_id}
                  getRateForMaterialVariant={getRateForMaterialVariant}
                  calculateVariantDiscountedRate={calculateVariantDiscountedRate}
                  getTableMinWidth={getTableMinWidth}
                  materialCount={materialCount}
                  selectedItemIds={selectedItemIds}
                  setSelectedItemIds={setSelectedItemIds}
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-4 p-6">
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-4">
              <div className="flex justify-between text-[13px] text-zinc-500">
                <span>Subtotal</span>
                <span className="font-bold text-zinc-900">{formatCurrency(calculations.subtotal)}</span>
              </div>
              {calculations.totalItemDiscount > 0 && (
                <div className="flex justify-between text-[13px] text-zinc-500">
                  <span>Total Item Discount</span>
                  <span className="text-red-500 font-bold">- {formatCurrency(calculations.totalItemDiscount)}</span>
                </div>
              )}
              {calculations.extraDiscountAmount > 0 && (
                <div className="flex justify-between text-[13px] text-zinc-500">
                  <span>Extra Discount ({formData.extra_discount_percent}%)</span>
                  <span className="text-red-500 font-bold">- {formatCurrency(calculations.extraDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px] text-zinc-500">
                <span>Taxable Value</span>
                <span className="font-bold text-zinc-900">{formatCurrency(calculations.subtotal - calculations.extraDiscountAmount)}</span>
              </div>
              {calculations.isInterState ? (
                <div className="flex justify-between text-[13px] text-zinc-500">
                  <span>IGST</span>
                  <span className="font-bold text-zinc-900">{formatCurrency(calculations.igst)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-[13px] text-zinc-500">
                    <span>CGST</span>
                    <span className="font-bold text-zinc-900">{formatCurrency(calculations.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-[13px] text-zinc-500">
                    <span>SGST</span>
                    <span className="font-bold text-zinc-900">{formatCurrency(calculations.sgst)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-[13px] text-zinc-500">
                <span>Round Off</span>
                <span className="font-bold text-zinc-900">{formatCurrency(calculations.roundOff)}</span>
              </div>
              <div className="pt-4 border-t-2 border-zinc-900 flex justify-between items-center">
                <span className="text-[15px] font-bold text-zinc-900 uppercase">Grand Total</span>
                <span className="text-2xl font-black text-zinc-900">{formatCurrency(calculations.grandTotal)}</span>
              </div>
              <div className="text-right text-sm text-zinc-500">
                INR {calculations.amountInWords}
              </div>
            </div>
          </div>
        </div>

        {activeSection === 'materials' && (
          <ErectionSection
            quotationId={formData.id || ''}
            items={items}
            onItemUpdate={(itemId, field, value) => {
              updateItem(itemId, field, value);
            }}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_300px] gap-4">
          <div>
            <div className="card" style={{ padding: '12px', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContainer: 'space-between', marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Notes & Remarks:</label>
              </div>
              <textarea 
                className="form-input text-zinc-700" 
                style={{ width: '100%', minHeight: '36px', fontSize: '13px', resize: 'none' }}
                placeholder="Enter internal notes or additional instructions..."
                value={formData.remarks || ''}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>
          </div>
          <div>
            <div className="card" style={{ padding: '12px', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Terms & Conditions:</label>
                <button
                  onClick={() => setShowTermsDrawer(true)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#525252',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FileText size={12} />
                  {formData.terms_text ? 'Edit' : 'Add'}
                </button>
              </div>
              <textarea
                className="form-input text-zinc-700"
                style={{ width: '100%', minHeight: '36px', fontSize: '13px', resize: 'none' }}
                placeholder="Type terms & conditions here, or use the drawer to add from a template..."
                value={formData.terms_text || ''}
                onChange={(e) => setFormData({ ...formData, terms_text: e.target.value })}
              />
            </div>
          </div>
          <div className="card" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
              <div style={{ fontWeight: 600, fontSize: '11px', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px', marginBottom: '4px' }}>Adjustments</div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#4b5563' }}>Extra Discount %</span>
                <input type="number" className="form-input text-zinc-700" style={{ width: '80px', textAlign: 'right', height: '32px', padding: '4px 8px', fontSize: '13px' }} value={formData.extra_discount_percent} onChange={(e) => setFormData({ ...formData, extra_discount_percent: e.target.value })} min="0" max="100" step="0.01" />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#4b5563' }}>Extra Discount Amt</span>
                <input type="number" className="form-input text-zinc-700" style={{ width: '100px', textAlign: 'right', height: '32px', padding: '4px 8px', fontSize: '13px' }} value={formData.extra_discount_amount} onChange={(e) => setFormData({ ...formData, extra_discount_amount: e.target.value })} min="0" step="0.01" />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input 
                    type="checkbox" 
                    id="roundOffToggle"
                    style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                    checked={formData.round_off_enabled} 
                    onChange={(e) => setFormData({ ...formData, round_off_enabled: e.target.checked })} 
                  />
                  <label htmlFor="roundOffToggle" style={{ fontSize: '13px', cursor: 'pointer', userSelect: 'none', fontWeight: 500, color: '#4b5563' }}>Round Off</label>
                </div>
                <input 
                  type="number" 
                  className="form-input text-zinc-700" 
                  style={{ 
                    width: '100px', 
                    textAlign: 'right', 
                    height: '32px', 
                    padding: '4px 8px', 
                    fontSize: '13px',
                    backgroundColor: formData.round_off_enabled ? '#f8fafc' : 'white',
                    color: formData.round_off_enabled ? '#64748b' : '#1e293b'
                  }} 
                  value={calculations.roundOff.toFixed(2)} 
                  readOnly={formData.round_off_enabled}
                  onChange={(e) => !formData.round_off_enabled && setFormData({ ...formData, round_off: e.target.value })} 
                  step="0.01" 
                />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '2px solid #e5e7eb' }}>
                <span style={{ fontWeight: 700, color: '#1f2937', fontSize: '13px' }}>Grand Total</span>
                <span style={{ fontWeight: 800, color: '#185FA5', fontSize: '15px' }}>{formatCurrency(calculations.grandTotal)}</span>
              </div>

              <div style={{ marginTop: '12px', padding: '12px', borderTop: '1px solid #e5e7eb', fontFamily: 'Inter, sans-serif' }}>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-2">Authorized Signatory</div>
                <div 
                  className="sig-dropdown-container relative cursor-pointer flex items-center justify-between px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 text-xs font-medium hover:bg-zinc-50 hover:border-zinc-400 transition-all shadow-sm"
                  onClick={() => setIsSigDropdownOpen(!isSigDropdownOpen)}
                >
                  <span>
                    {formData.authorized_signatory_id
                      ? ((organisation as any)?.signatures || []).find((s: any) => String(s.id) === String(formData.authorized_signatory_id))?.name || 'Select Signatory...'
                      : 'Select Signatory...'}
                  </span>
                  <svg className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isSigDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>

                  {isSigDropdownOpen && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px',
                      zIndex: 50, background: 'white', border: '1px solid #d1d5db', borderRadius: '6px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                      maxHeight: '200px', overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                      <div 
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        onClick={() => {
                          setFormData({ ...formData, authorized_signatory_id: '' });
                          setIsSigDropdownOpen(false);
                        }}
                      >
                        Select Signatory...
                      </div>
                      {((organisation as any)?.signatures || []).length > 0 ? (
                        ((organisation as any)?.signatures || []).map((sig: any) => (
                          <div 
                            key={String(sig.id)} 
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            onClick={() => handleSigChange(String(sig.id))}
                          >
                            {sig.name}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '8px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No signatures uploaded</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirmDialog !== null} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={confirmDialog?.onConfirm}>{confirmDialog?.confirmLabel || 'Confirm'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {inputDialog && (
        <Dialog open={inputDialog.open} onOpenChange={(open) => { if (!open) setInputDialog(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{inputDialog.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <input
                type="text"
                className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:border-blue-500 focus:outline-none"
                placeholder={inputDialog.placeholder}
                defaultValue={inputDialog.defaultValue || ''}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value;
                    if (val.trim() || inputDialog.allowEmpty) {
                      inputDialog.onSubmit(val);
                    }
                  }
                }}
                id="input-dialog-field"
              />
              {inputDialog.suggestions && inputDialog.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {inputDialog.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="px-2.5 py-1 text-xs font-medium text-zinc-600 bg-zinc-100 border border-zinc-200 rounded-md"
                      onClick={() => inputDialog.onSubmit(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md"
                onClick={() => setInputDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-blue-600 rounded-md hover:text-blue-700"
                onClick={() => {
                  const input = document.getElementById('input-dialog-field') as HTMLInputElement;
                  const val = input?.value || '';
                  if (val.trim() || inputDialog.allowEmpty) {
                    inputDialog.onSubmit(val);
                  }
                }}
              >
                Add
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {arcPricingConfirmOpen && (
        <ArcConfirmationDialog
          open={arcPricingConfirmOpen}
          onClose={() => setArcPricingConfirmOpen(false)}
          onConfirm={handleArcPricingConfirm}
        />
      )}

      {showCustomLabelEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCustomLabelEditor(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#18181b' }}>Column Settings</h3>
              <button onClick={() => setShowCustomLabelEditor(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 4px', color: '#71717a' }}>×</button>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
              Toggle columns to show/hide on the printed document. You can also customize their display labels.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
              {[
                { key: 'item', label: 'Item Name' },
                { key: 'item_code', label: 'Internal Part No' },
                { key: 'client_part_no', label: 'Client Part No' },
                { key: 'hsn_code', label: 'HSN/SAC' },
                { key: 'make', label: 'Make/Brand' },
                { key: 'variant', label: 'Category Details' },
                { key: 'description', label: 'Description' },
                { key: 'client_description', label: 'Client Description' },
                { key: 'custom1', label: 'Custom Column 1' },
                { key: 'custom2', label: 'Custom Column 2' }
              ].map(col => {
                const isEnabled = templateSettings?.column_settings?.optional?.[col.key] !== false;
                const customLabel = templateSettings?.column_settings?.labels?.[col.key] || '';
                
                return (
                  <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={isEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTemplateSettings((prev: any) => {
                          const updated = {
                            ...prev,
                            column_settings: {
                              ...prev.column_settings,
                              optional: {
                                ...prev.column_settings?.optional,
                                [col.key]: checked
                              }
                            }
                          };
                          updateTemplateSettingsInDb(updated);
                          return updated;
                        });
                      }}
                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#18181b', minWidth: '100px' }}>{col.label}</div>
                    <input 
                      type="text"
                      placeholder="Custom label"
                      className="form-input"
                      style={{ flex: 1, height: '28px', fontSize: '11px', padding: '2px 6px', border: '1px solid #d4d4d8', borderRadius: '4px' }}
                      value={customLabel}
                      onChange={(e) => {
                        const newLabel = e.target.value;
                        setTemplateSettings((prev: any) => {
                          const updated = {
                            ...prev,
                            column_settings: {
                              ...prev.column_settings,
                              labels: {
                                ...prev.column_settings?.labels,
                                [col.key]: newLabel
                              }
                            }
                          };
                          updateTemplateSettingsInDb(updated);
                          return updated;
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button style={{ padding: '6px 14px', background: '#185FA5', border: '1px solid #185FA5', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
                onClick={() => setShowCustomLabelEditor(false)}
              >Done</button>
            </div>
          </div>
        </div>
      )}

      {showItemPicker && (
        <div className="modal-overlay open" onClick={() => setShowItemPicker(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Add Multiple Items</h3>
              <button className="btn-close" onClick={() => setShowItemPicker(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '4px 8px' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                  <input 
                    type="text" 
                    className="form-input w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:border-blue-500 focus:outline-none" 
                    placeholder="Search items..." 
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    autoFocus
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>Item Name</th>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', width: '90px', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>Stock</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', width: '60px', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaterials.map(material => {
                        const itemId = material.id;
                        const isSelected = itemId && pickerItems.some(p => p.item_id === itemId);
                        return (
                          <tr 
                            key={material.id}
                            style={{ cursor: isSelected ? 'default' : 'pointer', background: isSelected ? '#f0fdf4' : '#fff' }}
                            onClick={() => {
                              if (itemId && !isSelected) {
                                handleAddItemToPicker(material);
                              }
                            }}
                          >
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ fontWeight: 500, color: '#1e293b' }}>{material.display_name || material.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{material.item_code}</div>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#64748b' }}>
                              {material.stock_on_hand ?? '-'}
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                              {isSelected ? (
                                <span style={{ color: '#16a34a', fontSize: '14px' }}>✓</span>
                              ) : (
                                <button style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 500 }}>+</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: '#334155' }}>Selected Items ({pickerItems.length})</h4>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
                  {pickerItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '13px' }}>
                      No items selected. Click items on the left to add them here.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pickerItems.map(p => (
                        <div key={p.item_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.material?.display_name || p.material?.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{p.material?.item_code}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input 
                              type="number" 
                              value={p.qty}
                              onChange={(e) => handlePickerQtyChange(p.item_id, e.target.value)}
                              min="0.01"
                              step="0.01"
                              style={{ width: '60px', padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }}
                            />
                            <button 
                              onClick={() => handleRemoveFromPicker(p.item_id)} 
                              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary px-4 py-2 border border-zinc-300 rounded-md text-sm font-medium hover:bg-zinc-50" onClick={() => setShowItemPicker(false)}>Cancel</button>
              <button className="btn btn-primary px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50" onClick={handleAddItemsToQuotation} disabled={pickerItems.length === 0}>Add to Quotation ({pickerItems.length})</button>
            </div>
          </div>
        </div>
      )}

      {showTermsDrawer && (
        <TermsConditionsDrawer
          isOpen={showTermsDrawer}
          onClose={() => setShowTermsDrawer(false)}
          onSelect={(terms) => {
            setFormData({
              ...formData,
              terms_conditions: terms.id,
              terms_text: terms.terms_text
            });
            setShowTermsDrawer(false);
          }}
          documentType="Quotation"
        />
      )}

      {isParserOpen && (
        <AiDocumentParserModal
          isOpen={isParserOpen}
          onClose={() => setIsParserOpen(false)}
          documentType="Quotation"
          onImportComplete={async (data) => {
            ignoreDirtyRef.current = true;
            try {
              if (data.header) {
                setFormData((prev: any) => ({
                  ...prev,
                  client_id: data.header.client_id || prev.client_id,
                  billing_address: data.header.billing_address || prev.billing_address,
                  shipping_address: data.header.shipping_address || prev.shipping_address,
                  gstin: data.header.gstin || prev.gstin,
                  state: data.header.state || prev.state,
                  date: data.header.date || prev.date,
                  valid_till: data.header.valid_till || prev.valid_till,
                  remarks: data.header.remarks || prev.remarks,
                }));
                if (data.header.client_id) {
                  const client = clients.find(c => c.id === data.header.client_id);
                  if (client) setClientSearch(client.client_name);
                }
              }

              if (data.items && data.items.length > 0) {
                const parsedItems = data.items.map((it: any, idx: number) => {
                  let mat = null;
                  if (it.item_id) {
                    mat = materials.find(m => m.id === it.item_id);
                  }
                  return {
                    id: `parser-${Date.now()}-${idx}`,
                    section: it.section || 'materials',
                    item_id: it.item_id || '',
                    material: mat,
                    hsn_code: it.hsn_code || mat?.hsn_code || '',
                    description: it.description || '',
                    qty: parseFloat(it.qty) || null,
                    uom: it.uom || mat?.unit || '',
                    rate: parseFloat(it.rate) || 0,
                    discount_percent: parseFloat(it.discount_percent) || 0,
                    discount_amount: 0,
        
                    tax_percent: parseFloat(it.tax_percent) || mat?.gst_rate || 0,
                    tax_amount: 0,
                    line_total: 0,
                    is_override: false,
                    is_header: it.is_header || false,
                    is_subtotal: it.is_subtotal || false,
                    display_order: idx
                  };
                });
                setItems(parsedItems);
              }
              setActiveImportSessionId(data.session_id || 'parsed');
              setIsParserOpen(false);
              toast.success('AI Import completed successfully!');
            } finally {
              ignoreDirtyRef.current = false;
            }
          }}
        />
      )}

      {selectedItemIds.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: '#0f172a',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          border: '1px solid #334155'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 605, color: '#94a3b8' }}>
            <strong style={{ color: 'white' }}>{selectedItemIds.length}</strong> items selected
          </span>
          <div style={{ width: '1px', height: '20px', background: '#334155' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Discount:</span>
            <input 
              type="number" 
              placeholder="%" 
              style={{ width: '55px', background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', color: 'white', fontWeight: 'bold', textAlign: 'right' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseFloat((e.target as HTMLInputElement).value);
                  if (!isNaN(val)) {
                    handleBulkSetDiscount(val);
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Make:</span>
            <input 
              type="text" 
              placeholder="Manufacturer..." 
              style={{ width: '100px', background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', color: 'white' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  handleBulkSetMake(val);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>

          <div style={{ width: '1px', height: '20px', background: '#334155' }} />

          <button 
            type="button" 
            onClick={handleBulkDelete}
            style={{ padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Delete Selected
          </button>

          <button 
            type="button" 
            onClick={() => setSelectedItemIds([])}
            style={{ padding: '6px 12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
