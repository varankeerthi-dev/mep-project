import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import { ensureValidSession } from '../queryClient';
import { useMaterials } from '../hooks/useMaterials';
import { useClients } from '../hooks/useClients';
import { useProjects } from '../hooks/useProjects';
import { useVariants } from '../hooks/useVariants';
import { generateQuickQuoteItems } from '../quotation/quick-quote/engine';
import { loadQuickQuoteConfig, normalizeQuickQuoteConfig } from '../quotation/quick-quote/api';
import type { QuickQuoteConfig } from '../quotation/quick-quote/types';
import { useConvertDocument, useConversionStatus, getSourceTableName } from '../conversions/hooks';
import type { ConversionType } from '../conversions/types';
import ItemCreateDrawer from '../components/ItemCreateDrawer';
import { FileText, Plus, Mail } from 'lucide-react';
import { autoCreateOrUpdateErection } from '../utils/erectionUtils';
import { lookupServiceRate } from '../hooks/useErectionCharges';
import { ErectionSection } from '../components/ErectionSection';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
];

const DEFAULT_PAYMENT_TERMS = 'Net 30 Days';
const APPROVAL_ROLES = ['SalesManager', 'Finance', 'Admin'];
const APPROVAL_EXPIRY_DAYS = 7;

// Helper to convert number to words for INR
function numberToWords(num) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if ((n = n.toString()).length > 9) return 'overflow';
    let nArr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr || nArr.length < 6) return '';
    let str = '';
    str += nArr[1] != 0 ? (a[Number(nArr[1])] || b[nArr[1][0]] + ' ' + a[nArr[1][1]]) + 'Crore ' : '';
    str += nArr[2] != 0 ? (a[Number(nArr[2])] || b[nArr[2][0]] + ' ' + a[nArr[2][1]]) + 'Lakh ' : '';
    str += nArr[3] != 0 ? (a[Number(nArr[3])] || b[nArr[3][0]] + ' ' + a[nArr[3][1]]) + 'Thousand ' : '';
    str += nArr[4] != 0 ? (a[Number(nArr[4])] || b[nArr[4][0]] + ' ' + a[nArr[4][1]]) + 'Hundred ' : '';
    str += nArr[5] != 0 ? ((str != '') ? 'and ' : '') + (a[Number(nArr[5])] || b[nArr[5][0]] + ' ' + a[nArr[5][1]]) : '';
    return str.trim() + ' Only';
  };
  
  return inWords(Math.round(num));
}

export default function CreateQuotation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const duplicateId = searchParams.get('duplicateId');
  const convertFrom = searchParams.get('convertFrom') as ConversionType | null;
  const sourceId = searchParams.get('sourceId');
  const isConverting = Boolean(convertFrom && sourceId && !editId && !duplicateId);
  const conversionInfoRef = useRef<{ type: ConversionType; sourceId: string } | null>(null);
  const { organisation } = useAuth();
  
  const [saving, setSaving] = useState(false);
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();
  const { data: materials = [] } = useMaterials();
  const { data: variants = [] } = useVariants();
  const [variantPricing, setVariantPricing] = useState({});
  const [itemMakes, setItemMakes] = useState({});
  const [companyState, setCompanyState] = useState(organisation?.state || 'Maharashtra');
  const [quoteNoPreview, setQuoteNoPreview] = useState('');
  const [defaultTemplate, setDefaultTemplate] = useState(null);
  const [draggingItemId, setDraggingItemId] = useState(null);
  
  const [headerDiscounts, setHeaderDiscounts] = useState({});
  const [discountPopup, setDiscountPopup] = useState({ show: false, variantId: null, variantName: '', oldValue: 0, newValue: 0, affectedRows: 0, overriddenRows: 0 });
  
  const [discountSettings, setDiscountSettings] = useState({});
  const [approvalStatus, setApprovalStatus] = useState({});
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('items');
  const [activeSection, setActiveSection] = useState('materials');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  
  const [templateSettings, setTemplateSettings] = useState(null);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showCustomLabelEditor, setShowCustomLabelEditor] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.client-dropdown-container')) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState([]);
  const [quickQuoteConfig, setQuickQuoteConfig] = useState<QuickQuoteConfig | null>(null);
  const [quickQuoteTemplateId, setQuickQuoteTemplateId] = useState('');
  const [quickQuoteSize, setQuickQuoteSize] = useState('');
  const [quickQuoteSubSize, setQuickQuoteSubSize] = useState('');
  const [quickQuoteVariantId, setQuickQuoteVariantId] = useState('');
  const [quickQuoteMake, setQuickQuoteMake] = useState('');
  const [quickQuoteSpec, setQuickQuoteSpec] = useState('');
  const [quickQuoteIncludeValves, setQuickQuoteIncludeValves] = useState(true);
  const [quickQuoteIncludeThreadItems, setQuickQuoteIncludeThreadItems] = useState(true);
  const [showItemCreateDrawer, setShowItemCreateDrawer] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    quotation_no: '',
    client_id: '',
    project_id: '',
    billing_address: '',
    gstin: '',
    state: '',
    date: new Date().toISOString().split('T')[0],
    valid_till: '',
    payment_terms: DEFAULT_PAYMENT_TERMS,
    client_contact: '',
    variant_id: '',
    reference: '',
    prepared_by: '',
    extra_discount_percent: 0,
    extra_discount_amount: 0,
    round_off: 0,
    remarks: '',
    round_off_enabled: true,
    status: 'Draft',
    negotiation_mode: false,
    authorized_signatory_id: '',
    include_erection_charges: true
  });

  const [items, setItems] = useState([]);
  const itemsTableRef = useRef(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [isDirty, setIsDirty] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState(null);

  // Calculate erection charges immediately (without saving to DB)
  const calculateErectionCharges = async () => {
    if (!formData.include_erection_charges) {
      // Remove all erection items from local state
      setItems(prevItems => prevItems.filter(item => item.section !== 'erection'));
      return;
    }
    
    const materialItems = items.filter(item => !item.is_header && item.section !== 'erection');
    const newErectionItems = [];
    
    for (const item of materialItems) {
      const itemName = item.description || item.item_id || '';
      if (!itemName) continue;
      
      // Import lookupServiceRate here to avoid scope issues
      const { lookupServiceRate } = await import('../hooks/useErectionCharges');
      const serviceRate = await lookupServiceRate(itemName);
      if (!serviceRate) continue;
      
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
        const finalRate = baseRate - (baseRate * discountToApply / 100);

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
        const finalRate = baseRate - (baseRate * discountToApply / 100);

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
    
    // Update items state: remove old erection items and add new ones
    setItems(prevItems => {
      const nonErectionItems = prevItems.filter(item => item.section !== 'erection');
      return [...nonErectionItems, ...newErectionItems];
    });
  };

  // Effect to calculate erection charges when checkbox is toggled
  useEffect(() => {
    if (formData.include_erection_charges) {
      calculateErectionCharges();
    } else {
      // Remove erection items if unchecked
      setItems(prevItems => prevItems.filter(item => item.section !== 'erection'));
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

  const initQuery = useQuery({
    queryKey: ['quotationInit', organisation?.id],
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes - user may take up to 30min to prepare quotation
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    queryFn: async () => {
      const [pricing, settings, template, quickQuoteConfig, orgDetails] = await Promise.all([
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
        organisation?.id ? loadQuickQuoteConfig(organisation.id) : Promise.resolve(null),
        organisation?.id ? timedSupabaseQuery(
          supabase.from('organisations').select('*').eq('id', organisation.id).single(),
          'Organisation details'
        ) : Promise.resolve(null),
      ]);

      return {
        clients,
        projects,
        materials,
        variants,
        pricing: pricing || [],
        settings: settings || [],
        template: template || null,
        quickQuoteConfig: quickQuoteConfig || null,
        orgFullDetails: orgDetails || null
      };
    },
  });

  const initLoading = initQuery.isPending && !initQuery.data;
  const initErrorMessage = initQuery.error instanceof Error ? initQuery.error.message : 'Unable to load quotation setup data.';

  // Conversion query
  const conversionQuery = useConvertDocument(convertFrom!, sourceId!);

  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initQuery.data) return;
    
    // Only initialize if we haven't already for this specific editId/duplicateId combination
    const currentId = `${editId || ''}-${duplicateId || ''}`;
    if (initializedRef.current === currentId) return;

    const { pricing, settings, template, quickQuoteConfig, orgFullDetails } = initQuery.data;

    const materialsWithService = materials.map(item => ({
      ...item,
      isService: item.item_type === 'service'
    }));

    const pricingMap = {};
    const makesMap = {};
    
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

    const finalMakesMap = {};
    for (const id in makesMap) {
      finalMakesMap[id] = Array.from(makesMap[id]).sort();
    }

    setVariantPricing(pricingMap);
    setItemMakes(finalMakesMap);

    if (quickQuoteConfig) {
      const normalizedQuickQuote = normalizeQuickQuoteConfig(quickQuoteConfig, materialsWithService, pricing || []);
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

    const settingsMap = {};
    (settings || []).forEach((row) => {
      settingsMap[row.variant_id] = {
        default: parseFloat(row.default_discount_percent) || 0,
        min: parseFloat(row.min_discount_percent) || 0,
        max: parseFloat(row.max_discount_percent) || 0
      };
    });
    setDiscountSettings(settingsMap);

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
      // Always start with one empty row for new quotations
      setItems([{
        id: Date.now() + Math.random(),
        item_id: '',
        variant_id: null,
        material: null,
        hsn_code: '',
        description: '',
        qty: 1,
        uom: 'Nos',
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

  // Load conversion data when converting from DC
  useEffect(() => {
    if (!isConverting || !conversionQuery.data) return;

    // Store conversion info for status update on save
    conversionInfoRef.current = {
      type: convertFrom!,
      sourceId: sourceId!,
    };

    const convertedData = conversionQuery.data.data as any;

    // Pre-fill form with converted data
    setFormData(prev => ({
      ...prev,
      client_id: convertedData.client_id || '',
      project_id: convertedData.project_id || '',
      state: convertedData.state || '',
      date: convertedData.date || new Date().toISOString().split('T')[0],
      reference: convertedData.reference || '',
      remarks: convertedData.remarks || '',
    }));

    // Pre-fill items
    if (convertedData.items && convertedData.items.length > 0) {
      const newItems = convertedData.items.map((item: any, index: number) => ({
        id: `temp-${Date.now()}-${index}`,
        item_id: item.item_id || null,
        description: item.description,
        qty: item.qty,
        rate: item.rate,
        tax_percent: item.tax_percent || 0,
        uom: item.uom || 'nos',
        discount_percent: 0,
        line_total: item.qty * item.rate,
      }));
      setItems(newItems);
    }
  }, [isConverting, conversionQuery.data, convertFrom, sourceId]);

const handleDragStart = useCallback((e, itemId) => {
  setDraggingItemId(itemId);
  e.dataTransfer.effectAllowed = 'move';
}, []);

const handleDragOver = useCallback((e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}, []);

const handleDropOnRow = useCallback((e, targetId) => {
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

useEffect(() => {
  if (!initLoading) {
    setIsDirty(true);
  }
}, [initLoading]);

useEffect(() => {
  const handleBeforeUnload = (e) => {
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

const getQuoteSeriesNumber = useCallback((seriesRow) => {
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

const buildQuoteNoFromSeries = useCallback((seriesRow) => {
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

const loadQuoteNoPreview = useCallback(async () => {
  if (editId) return;
  try {
    const defaultSeries = await fetchDefaultSeriesRow();

    if (defaultSeries) {
      const seriesNo = buildQuoteNoFromSeries(defaultSeries);
      setQuoteNoPreview(seriesNo);
      setFormData((prev) => ({ ...prev, quotation_no: seriesNo }));
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
    setFormData((prev) => ({ ...prev, quotation_no: fallbackNo }));
  } catch (err) {
    setQuoteNoPreview('QT-0001');
    setFormData((prev) => ({ ...prev, quotation_no: 'QT-0001' }));
  }
}, [buildQuoteNoFromSeries, editId, organisation?.id]);

  const loadVariantDiscounts = async (quotationId) => {
    try {
      const { data: discounts } = await supabase
        .from('quotation_revision_variant_discount')
        .select('*')
        .eq('quotation_revision_id', quotationId);
      
      if (discounts && discounts.length > 0) {
        const discountMap = {};
        discounts.forEach(d => {
          discountMap[d.variant_id] = parseFloat(d.header_discount_percent) || 0;
        });
        setHeaderDiscounts(prev => ({ ...prev, ...discountMap }));
      }
    } catch (err) {
      console.warn('Unable to load variant discounts:', err);
    }
  };

  const handleHeaderDiscountChange = useCallback((variantId, newValue) => {
    const numValue = parseFloat(newValue) || 0;
    
    const affectedItems = items.filter(item => 
      (variantId === 'erection' ? item.section === 'erection' : item.variant_id === variantId) && !item.is_override
    );
    const overriddenItems = items.filter(item => 
      (variantId === 'erection' ? item.section === 'erection' : item.variant_id === variantId) && item.is_override
    );

    const needsUpdate = affectedItems.some(item => parseFloat(item.discount_percent || 0) !== numValue);
    if (!needsUpdate) return;
    
    const variant = variants.find(v => v.id === variantId);
    const variantName = variantId === 'erection' ? 'Erection Charges' : (variant?.variant_name || 'Unknown Variant');
    
    if (affectedItems.length > 0 || overriddenItems.length > 0) {
      setDiscountPopup({
        show: true,
        variantId,
        variantName,
        oldValue: affectedItems.length > 0 ? (affectedItems[0].discount_percent || 0) : 0,
        newValue: numValue,
        affectedRows: affectedItems.length,
        overriddenRows: overriddenItems.length
      });
    } else {
      setHeaderDiscounts(prev => ({ ...prev, [variantId]: numValue }));
    }
  }, [items, variants]);

  const requestApproval = async (variantId, discountValue) => {
    if (!editId) {
      alert('Please save the quotation first before requesting approval.');
      return false;
    }
    
    const settings = discountSettings[variantId];
    if (!settings || discountValue <= settings.max) {
      return false;
    }
    
    const variant = variants.find(v => v.id === variantId);
    const variantName = variantId === 'erection' ? 'Erection Charges' : (variant?.variant_name || 'Unknown Variant');
    const roles = APPROVAL_ROLES;
    
    try {
      await supabase
        .from('discount_approval')
        .delete()
        .eq('quotation_revision_id', editId)
        .eq('variant_id', variantId);
      
      const approvalRecords = roles.map(role => ({
        quotation_revision_id: editId,
        variant_id: variantId,
        role_name: role,
        status: 'pending',
        remark: `Discount ${discountValue}% exceeds max ${settings.max}% for ${variantName}`
      }));
      
      const { error: insertError } = await supabase
        .from('discount_approval')
        .insert(approvalRecords);
      
      if (insertError) throw insertError;
      
      await supabase.from('discount_approval_log').insert({
        quotation_revision_id: editId,
        variant_id: variantId,
        event_type: 'approval_requested',
        old_value: headerDiscounts[variantId] || 0,
        new_value: discountValue,
        remark: `Approval requested for ${variantName}: ${discountValue}% (max: ${settings.max}%)`,
        organisation_id: organisation?.id
      });
      
      await loadApprovalData(editId);
      return true;
    } catch (err) {
      console.error('Error requesting approval:', err);
      alert('Failed to request approval: ' + err.message);
      return false;
    }
  };

  const hasPendingApproval = () => {
    return Object.keys(approvalStatus).some(variantId => {
      const variantApprovals = approvalStatus[variantId];
      if (!variantApprovals) return false;
      const roles = APPROVAL_ROLES;
      return roles.some(role => {
        const status = variantApprovals[role]?.status;
        return status === 'pending' || status === 'rejected';
      });
    });
  };

  const isApprovalComplete = (variantId) => {
    const variantApprovals = approvalStatus[variantId];
    if (!variantApprovals) return true;
    
    const roles = APPROVAL_ROLES;
    const allApproved = roles.every(role => variantApprovals[role]?.status === 'approved');
    
    if (!allApproved) return false;
    
    const validUntil = variantApprovals['Admin']?.valid_until;
    if (validUntil && new Date(validUntil) < new Date()) {
      return false;
    }
    
    return true;
  };

  const applyDiscountChanges = useCallback(async () => {
    const { variantId, newValue } = discountPopup;
    const settings = discountSettings[variantId];
    
    setHeaderDiscounts(prev => ({ ...prev, [variantId]: newValue }));
    
    setItems(prevItems => 
      prevItems.map(item => {
        const isMatch = variantId === 'erection' ? item.section === 'erection' : item.variant_id === variantId;
        if (isMatch && !item.is_override) {
          const appliedDiscount = newValue;
          const baseRate = parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0;
          const finalRate = baseRate - (baseRate * appliedDiscount / 100);
          
          return {
            ...item,
            applied_discount_percent: appliedDiscount,
            final_rate_snapshot: finalRate,
            discount_percent: appliedDiscount,
            rate: finalRate
          };
        }
        return item;
      })
    );
    
    if (settings && newValue > settings.max) {
      const hasVariantItems = items.some(item => variantId === 'erection' ? item.section === 'erection' : item.variant_id === variantId);
      if (hasVariantItems && editId) {
        await requestApproval(variantId, newValue);
      }
    }
    
    setDiscountPopup({ show: false, variantId: null, variantName: '', oldValue: 0, newValue: 0, affectedRows: 0, overriddenRows: 0 });
  }, [discountPopup, discountSettings, items, editId]);

  const cancelDiscountChanges = useCallback(() => {
    setDiscountPopup({ show: false, variantId: null, variantName: '', oldValue: 0, newValue: 0, affectedRows: 0, overriddenRows: 0 });
  }, []);

  const calculateVariantDiscountedRate = useCallback((baseRate, discountPercent) => {
    const base = parseFloat(baseRate) || 0;
    const discount = parseFloat(discountPercent) || 0;
    return base - (base * discount / 100);
  }, []);

  const loadClientDiscountPortfolio = useCallback(async (clientId) => {
    if (!clientId) return { discounts: {}, settings: {} };
    
    const client = clients.find(c => c.id === clientId);
    if (!client) return { discounts: {}, settings: {} };

    let discounts = {};
    let settings = {};
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
          variants.forEach(v => {
            discounts[v.id] = flatDisc;
            settings[v.id] = {
              default: flatDisc,
              min: 0,
              max: flatDisc
            };
          });
        }
      } else {
        let struct;
        if (client.discount_profile_id) {
          const { data } = await supabase
            .from('discount_structures')
            .select('id')
            .eq('id', client.discount_profile_id)
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

        if (struct) {
          const { data: varSettings } = await supabase
            .from('discount_variant_settings')
            .select('variant_id, default_discount_percent, min_discount_percent, max_discount_percent')
            .eq('structure_id', struct.id)
            .eq('organisation_id', organisation?.id);
          
          varSettings?.forEach(s => {
            const variantId = s.variant_id;
            const customDisc = customDiscounts[variantId] !== undefined ? customDiscounts[variantId] : parseFloat(s.default_discount_percent) || 0;
            discounts[variantId] = customDisc;
            settings[variantId] = {
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
  }, [clients, variants]);

  const loadQuotation = async (id, isDuplicate = false) => {
    let data;
    try {
      data = await timedSupabaseQuery(
        supabase
          .from('quotation_header')
          .select('*, items:quotation_items(*, item:materials(id, item_code, display_name, name, hsn_code, sale_price, unit, mappings:material_client_mappings(*)))')
          .eq('id', id)
          .eq('organisation_id', organisation?.id || '00000000-0000-0000-0000-000000000000')
          .single(),
        'Quotation details',
      );
    } catch (error) {
      alert('Error loading quotation: ' + ((error as Error)?.message || 'Unknown error'));
      return;
    }

    if (data) {
      setFormData({
        id: isDuplicate ? '' : (data.id || ''),
        quotation_no: isDuplicate ? '' : (data.quotation_no || ''),
        client_id: data.client_id || '',
        project_id: data.project_id || '',
        billing_address: data.billing_address || '',
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
        round_off_enabled: true, // Default to true as it's not in DB
        remarks: data.remarks || '',
        reference: data.reference || '',
        status: isDuplicate ? 'Draft' : (data.status || 'Draft'),
        negotiation_mode: isDuplicate ? false : (data.negotiation_mode || false),
        authorized_signatory_id: data.authorized_signatory_id || '',
        include_erection_charges: data.include_erection_charges !== undefined ? data.include_erection_charges : true
      });

      if (data.items) {
        const mappedItems = data.items.map(item => {
          // Better erection detection - check for sac_code or explicit section
          const isErection = item.sac_code !== null || item.item_id === null || (item.description && item.description.includes(' - Erection'));
          let linked_material_id = null;
          if (isErection && item.description && item.description.includes(' - Erection')) {
            const baseName = item.description.replace(' - Erection', '');
            const parent = data.items.find(p => (p.description || p.item_id) === baseName && p.id !== item.id);
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
            base_rate_snapshot: parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0,
            applied_discount_percent: parseFloat(item.applied_discount_percent) || 0,
            is_override: item.is_override || false,
            final_rate_snapshot: parseFloat(item.final_rate_snapshot) || parseFloat(item.rate) || 0,
            display_order: item.display_order || 0,
            custom1: item.custom1 || '',
            custom2: item.custom2 || '',
            // Ensure numeric fields are properly parsed
            qty: parseFloat(item.qty) || 0,
            rate: parseFloat(item.rate) || 0,
            discount_percent: parseFloat(item.discount_percent) || 0,
            tax_percent: parseFloat(item.tax_percent) || 0,
            line_total: parseFloat(item.line_total) || 0
          };
        });
        
        setItems(mappedItems);

        const erectionItems = mappedItems.filter(item => item.section === 'erection');
        if (erectionItems.length > 0) {
          const erectionDiscount = parseFloat(erectionItems[0].discount_percent) || 0;
          setHeaderDiscounts(prev => ({ ...prev, erection: erectionDiscount }));
        }
      }
      
      const portfolio = await loadClientDiscountPortfolio(data.client_id);
      if (portfolio.settings && Object.keys(portfolio.settings).length > 0) {
        setDiscountSettings(prev => ({ ...prev, ...portfolio.settings }));
      }
      
      // Load variant discounts for saved quotations
      if (!isDuplicate) {
        await loadVariantDiscounts(id);
      }
      
      if (isDuplicate) {
        await loadQuoteNoPreview();
      } else {
        await loadApprovalData(id);
      }
    }
  };
  
  const loadApprovalData = async (quotationId) => {
    try {
      const { data: approvals } = await supabase
        .from('discount_approval')
        .select('*')
        .eq('quotation_revision_id', quotationId);
      
      const { data: history } = await supabase
        .from('discount_approval_log')
        .select('*')
        .eq('quotation_revision_id', quotationId)
        .order('timestamp', { ascending: false });
      
      const statusMap = {};
      if (approvals && approvals.length > 0) {
        approvals.forEach(approval => {
          if (!statusMap[approval.variant_id]) {
            statusMap[approval.variant_id] = {};
          }
          statusMap[approval.variant_id][approval.role_name] = {
            status: approval.status,
            action_by: approval.action_by_email,
            action_at: approval.action_at,
            valid_until: approval.approval_valid_until,
            remark: approval.remark
          };
        });
      }
      setApprovalStatus(statusMap);
      setApprovalHistory(history || []);
    } catch (err) {
      console.warn('Unable to load approval data:', err);
    }
  };

  const checkApprovalNeeded = (variantId, discountValue) => {
    const settings = discountSettings[variantId];
    if (!settings) return false;
    return discountValue > settings.max;
  };

  const getApprovalDisplayStatus = (variantId) => {
    const variantApprovals = approvalStatus[variantId];
    if (!variantApprovals) return 'none';
    
    const roles = APPROVAL_ROLES;
    const allApproved = roles.every(role => variantApprovals[role]?.status === 'approved');
    const anyRejected = roles.some(role => variantApprovals[role]?.status === 'rejected');
    const anyPending = roles.some(role => variantApprovals[role]?.status === 'pending');
    const isExpired = roles.some(role => {
      const validUntil = variantApprovals[role]?.valid_until;
      return validUntil && new Date(validUntil) < new Date();
    });
    
    if (anyRejected || isExpired) return 'rejected';
    if (allApproved) return 'approved';
    if (anyPending) return 'pending';
    return 'none';
  };

  const buildClientContacts = (client) => {
    if (!client) return [];
    const raw = [
      { name: client.contact_person, email: client.contact_person_email },
      { name: client.contact_person_2, email: client.contact_person_2_email },
      { name: client.purchase_person, email: client.purchase_email },
      { name: client.contact, email: client.email },
    ];

    const seen = new Set();
    const contacts = [];
    raw.forEach((entry) => {
      const name = (entry.name || '').trim();
      const email = (entry.email || '').trim();
      if (!name || !email) return;
      const dedupeKey = `${name.toLowerCase()}|${email.toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      contacts.push({
        value: `${name} <${email}>`,
        label: `${name} - ${email}`,
      });
    });
    return contacts;
  };

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === formData.client_id) || null,
    [clients, formData.client_id]
  );

  const clientContactOptions = useMemo(
    () => buildClientContacts(selectedClient),
    [selectedClient]
  );

  const handleClientChange = async (clientId) => {
    if (!clientId) {
      setFormData({ ...formData, client_id: '', billing_address: '', gstin: '', state: '', client_contact: '' });
      setHeaderDiscounts({});
      return;
    }

    const client = clients.find(c => c.id === clientId);
    if (client) {
      const billingAddress = [client.address1, client.address2, client.city, client.state, client.pincode]
        .filter(Boolean)
        .join(', ');

      const contacts = buildClientContacts(client);
      setFormData({
        ...formData,
        client_id: clientId,
        billing_address: billingAddress,
        gstin: client.gstin || '',
        state: client.state || '',
        client_contact: contacts[0]?.value || ''
      });

      const portfolio = await loadClientDiscountPortfolio(clientId);
      if (portfolio.settings && Object.keys(portfolio.settings).length > 0) {
        setDiscountSettings(prev => ({ ...prev, ...portfolio.settings }));
      }
      setHeaderDiscounts(portfolio.discounts);

      if (items.length > 0 && window.confirm('Apply client discount portfolio to existing items?')) {
        setItems(items.map(item => {
          const disc = portfolio.discounts[item.variant_id] || 0;
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
      }
    }
  };

  const filteredMaterials = useMemo(() => {
    if (!itemSearch) return materials;
    const search = itemSearch.toLowerCase();
    return materials.filter(m => 
      m.name?.toLowerCase().includes(search) || 
      m.item_code?.toLowerCase().includes(search) ||
      m.display_name?.toLowerCase().includes(search)
    );
  }, [materials, itemSearch]);

  const getRateForMaterialVariant = (material, variantId, make) => {
    if (!material) return 0;
    const vId = variantId || 'no_variant';
    const mName = make || '';
    
    if (variantPricing[material.id]?.[vId]?.[mName] !== undefined) {
      return variantPricing[material.id][vId][mName];
    }
    
    if (mName) {
      const itemPricing = variantPricing[material.id] || {};
      for (const v in itemPricing) {
        if (itemPricing[v][mName] !== undefined) {
          return itemPricing[v][mName];
        }
      }
    }
    
    if (variantPricing[material.id]?.[vId]?.[''] !== undefined) {
      return variantPricing[material.id][vId][''];
    }

    return parseFloat(material.sale_price) || 0;
  };

  const handleAddItemToPicker = (material) => {
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
        rate: getRateForMaterialVariant(material, null),
        uom: material.unit || 'Nos',
        tax_percent: material.gst_rate || 0,
        discount_percent: 0,
        description: material.display_name || material.name
      }]);
    }
  };

  const handleItemCreateSuccess = useCallback((newItem) => {
    // Update local state immediately for better UX
    const updatedMaterials = [...materials, newItem];
    
    // Update itemMakes if the new item has makes
    if (newItem.make) {
      const updatedItemMakes = { ...itemMakes };
      if (!updatedItemMakes[newItem.id]) {
        updatedItemMakes[newItem.id] = [];
      }
      updatedItemMakes[newItem.id] = [...new Set([...updatedItemMakes[newItem.id], newItem.make])];
      setItemMakes(updatedItemMakes);
    }
    
    // Invalidate queries to refresh materials list and variant pricing
    queryClient.invalidateQueries({ queryKey: ['materials'] });
    queryClient.invalidateQueries({ queryKey: ['itemVariantPricing'] });
    
    // Optionally, you can add the new item to the current quotation
    // This is commented out for now, but you can enable it if needed
    /*
    const newQuotationItem = {
      id: Date.now() + Math.random(),
      item_id: newItem.id,
      material: newItem,
      qty: 1,
      rate: getRateForMaterialVariant(newItem, null),
      uom: newItem.unit || 'Nos',
      tax_percent: newItem.gst_rate || 0,
      discount_percent: 0,
      description: newItem.display_name || newItem.name,
      hsn_code: newItem.hsn_code || '',
      make: '',
      variant_id: '',
      base_rate_snapshot: getRateForMaterialVariant(newItem, null),
      applied_discount_percent: 0,
      final_rate_snapshot: getRateForMaterialVariant(newItem, null),
      is_override: false,
      display_order: items.length,
      custom1: '',
      custom2: ''
    };
    
    setItems(prev => [...prev, newQuotationItem]);
    */
  }, [queryClient, items.length, materials, itemMakes]);

  const pickerColumns = useMemo(() => [
    {
      header: 'Item',
      accessorKey: 'display_name',
      cell: ({ row }) => row.original.display_name || row.original.name
    },
    {
      header: 'Rate',
      accessorKey: 'sale_price',
      cell: ({ row }) => formatCurrency(row.original.sale_price)
    },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <button className="btn btn-sm btn-primary" onClick={() => handleAddItemToPicker(row.original)}>+</button>
      )
    }
  ], [handleAddItemToPicker]);

  const pickerTable = useReactTable({
    data: filteredMaterials,
    columns: pickerColumns,
    getCoreRowModel: getCoreRowModel()
  });

  const handlePickerQtyChange = (itemId, delta) => {
    setPickerItems(pickerItems.map(i => {
      if (i.item_id === itemId) {
        const newQty = Math.max(1, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const handleRemoveFromPicker = (itemId) => {
    setPickerItems(pickerItems.filter(i => i.item_id !== itemId));
  };

  const handleAddItemsToQuotation = () => {
    const currentItemsLength = items.length;
    const newItems = pickerItems.map((p, idx) => {
      const baseRate = p.rate;
      const variantId = p.variant_id || null;
      const headerDiscount = variantId ? (headerDiscounts[variantId] || 0) : 0;
      const finalRate = calculateVariantDiscountedRate(baseRate, headerDiscount);
      
      return {
        id: Date.now() + idx,
        item_id: p.item_id,
        variant_id: variantId,
        material: p.material,
        hsn_code: p.material?.hsn_code || null,
        description: p.description,
        qty: p.qty,
        uom: p.uom,
        rate: finalRate,
        discount_percent: headerDiscount,
        discount_amount: 0,
        tax_percent: p.tax_percent,
        tax_amount: 0,
        line_total: 0,
        override_flag: false,
        original_discount_percent: p.discount_percent,
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
      itemsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleGenerateQuickQuote = () => {
    if (!quickQuoteConfig || !quickQuoteTemplateId) {
      alert('Quick Quote template is not configured yet.');
      return;
    }
    if (!quickQuoteSize.trim()) {
      alert('Please enter a size for Quick Quote.');
      return;
    }

    const generated = generateQuickQuoteItems({
      templateId: quickQuoteTemplateId,
      input: {
        size: quickQuoteSize,
        subSize: quickQuoteSubSize,
        variantId: quickQuoteVariantId || null,
        variantName: variants.find((v) => v.id === quickQuoteVariantId)?.variant_name || null,
        make: quickQuoteMake || null,
        spec: quickQuoteSpec || null,
        includeValves: quickQuoteIncludeValves,
        includeThreadItems: quickQuoteIncludeThreadItems,
      },
      config: quickQuoteConfig,
    });

    if (generated.length === 0) {
      alert('No matching items found for the selected Quick Quote inputs.');
      return;
    }

    const currentItemsLength = items.length;
    const newItems = generated.map((row, idx) => {
      const variantId = row.variant_id || null;
      const headerDiscount = variantId ? (headerDiscounts[variantId] || 0) : 0;
      const baseRate = Number(row.rate) || 0;
      const finalRate = calculateVariantDiscountedRate(baseRate, headerDiscount);

      return {
        id: Date.now() + idx,
        item_id: row.material.id,
        variant_id: variantId,
        material: row.material,
        hsn_code: row.material.hsn_code || '',
        description: row.description,
        qty: row.qty,
        uom: row.uom,
        rate: finalRate,
        discount_percent: headerDiscount,
        discount_amount: 0,
        tax_percent: row.tax_percent,
        tax_amount: 0,
        line_total: 0,
        override_flag: false,
        original_discount_percent: headerDiscount,
        base_rate_snapshot: baseRate,
        applied_discount_percent: headerDiscount,
        is_override: false,
        final_rate_snapshot: finalRate,
        display_order: currentItemsLength + idx,
        make: row.make,
        custom1: '',
        custom2: '',
      };
    });

    setItems((prev) => [...prev, ...newItems]);
    setTimeout(() => {
      itemsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const withTimeout = async (promise, label, timeoutMs = 40000) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Timeout while ${label}. Please retry.`)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const isTimeoutError = (error, label) => {
    const message = (error as any)?.message || String(error || '');
    if (label) {
      return message.includes(`Timeout while ${label}`);
    }
    return message.startsWith('Timeout while ');
  };

  const isMissingColumnError = (error, columnName) => {
    const code = (error as any)?.code;
    const message = ((error as any)?.message || String(error || '')).toLowerCase();
    if (code === '42703') return true;
    if (!columnName) return message.includes('does not exist') && message.includes('column');
    return message.includes(String(columnName).toLowerCase()) && message.includes('does not exist');
  };

  async function fetchDefaultSeriesRow() {
    const tryFetch = async (buildQuery, label) => {
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

  const updateItem = (id, field, value) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item;
        const updates = { [field]: value };

        if (field === 'discount_percent') {
          const headerDiscount = item.variant_id ? (headerDiscounts[item.variant_id] || 0) : 0;
          const newDiscount = parseFloat(value) || 0;
          updates.is_override = newDiscount !== headerDiscount;
          updates.applied_discount_percent = newDiscount;
          const baseRate = parseFloat(item.base_rate_snapshot) || 0;
          const finalRate = calculateVariantDiscountedRate(baseRate, newDiscount);
          updates.final_rate_snapshot = finalRate;
          updates.rate = finalRate;
        }

        if (field === 'discount_percent' && formData.negotiation_mode) {
          const original = item.original_discount_percent || 0;
          updates.override_flag = value !== original;
        }
        if (field === 'rate' && formData.negotiation_mode) {
          updates.override_flag = true;
        }

        if (field === 'item_id' || field === 'variant_id') {
          const mat = field === 'item_id' 
            ? materials.find(m => m.id === value) 
            : materials.find(m => m.id === item.item_id);
          
          if (mat) {
            const nextVariant = field === 'variant_id' ? value : item.variant_id;
            const nextMake = item.make || '';
            const newRate = getRateForMaterialVariant(mat, nextVariant, nextMake);
            updates.base_rate_snapshot = newRate;
            
            const variantDiscount = nextVariant ? (headerDiscounts[nextVariant] || 0) : 0;
            updates.applied_discount_percent = variantDiscount;
            updates.discount_percent = variantDiscount;
            const finalRate = calculateVariantDiscountedRate(newRate, variantDiscount);
            updates.final_rate_snapshot = finalRate;
            updates.is_override = false;
            updates.rate = finalRate;
          }
        }

        const updatedItem = { ...item, ...updates };

        // Trigger erection charge creation/update for material changes
        if (field === 'qty' || field === 'uom' || field === 'description' || field === 'item_id') {
          // Only trigger if this is a material item (not erection)
          if (item.section !== 'erection') {
            autoCreateOrUpdateErection({
              ...updatedItem,
              section: 'materials',
              quotation_id: formData.id
            }).catch(err => {
              console.log('Erection auto-creation warning:', err.message);
            });
          }
        }

        return updatedItem;
      })
    );
  };

  const removeItem = useCallback((id) => {
    // Check if this item has linked erection charges
    const linkedErection = items.find(item => item.linked_material_id === id);
    
    if (linkedErection) {
      const erectionTotal = ((linkedErection.qty || 0) * (linkedErection.rate || 0)).toFixed(2);
      const confirmed = confirm(
        `This material has linked erection charges (₹${erectionTotal}).\n\n` +
        `Choose an option:\n` +
        `OK - Delete both material and erection charge\n` +
        `Cancel - Keep both`
      );
      
      if (!confirmed) {
        return; // User cancelled
      }
      
      // Delete both material and erection
      setItems(prev => {
        const filtered = prev.filter(item => item.id !== id && item.id !== linkedErection.id);
        return filtered.map((item, index) => ({
          ...item,
          display_order: index + 1
        }));
      });
    } else {
      // No linked erection, delete normally
      setItems(prev => {
        const filtered = prev.filter(item => item.id !== id);
        return filtered.map((item, index) => ({
          ...item,
          display_order: index + 1
        }));
      });
    }
    
    setIsDirty(true);
  }, [items]);

  const addEmptyItemRow = () => {
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
        qty: 1,
        uom: 'Nos',
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
        custom2: ''
      }
    ]);
  };

  const updateTemplateSettingsInDb = async (newSettings) => {
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

  const addSectionHeader = () => {
    const rowId = Date.now() + Math.random();
    setItems((prev) => [
      ...prev,
      {
        id: rowId,
        item_id: null,
        variant_id: null,
        description: '',
        qty: 0,
        uom: '',
        rate: 0,
        discount_percent: 0,
        discount_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        line_total: 0,
        is_header: true,
        display_order: prev.length
      }
    ]);
  };

  const calculations = useMemo(() => {
    // In this UI, `rate` is treated as the final "rate after discount".
    // So totals/tax should be computed off `qty * rate` (not applying discount_percent again).
    let subtotal = 0;
    let totalItemDiscount = 0;
    let totalTax = 0;

    // Calculate taxes by rate for mixed tax scenarios
    const taxGroups: { [key: string]: { baseAmount: number; taxAmount: number; sgst: number; cgst: number } } = {};

    items.forEach(item => {
      if (item.is_header) return;
      const qty = parseFloat(item.qty) || 0;
      const finalRate = parseFloat(item.rate) || 0;
      const baseRate = parseFloat(item.base_rate_snapshot) || finalRate;

      const grossBase = qty * baseRate;
      const net = qty * finalRate;
      const discountAmount = Math.max(0, grossBase - net);
      const taxable = net;
      const taxPercent = parseFloat(item.tax_percent) || 0;
      const taxAmount = (taxable * taxPercent) / 100;
      const lineTotal = taxable + taxAmount;

      subtotal += net;
      totalItemDiscount += discountAmount;
      totalTax += taxAmount;

      // Group taxes by rate
      if (taxPercent > 0) {
        if (!taxGroups[taxPercent]) {
          taxGroups[taxPercent] = { baseAmount: 0, taxAmount: 0, sgst: 0, cgst: 0 };
        }
        
        const sgst = taxAmount / 2;
        const cgst = taxAmount / 2;
        
        taxGroups[taxPercent].baseAmount += taxable;
        taxGroups[taxPercent].taxAmount += taxAmount;
        taxGroups[taxPercent].sgst += sgst;
        taxGroups[taxPercent].cgst += cgst;
      }

      item.line_total = lineTotal;
      item.tax_amount = taxAmount;
      item.discount_amount = discountAmount;
    });

    // `subtotal` is already after item-level discounts.
    const afterItemDiscount = subtotal;
    const extraDiscountPercent = parseFloat(formData.extra_discount_percent) || 0;
    const extraDiscountAmount = (afterItemDiscount * extraDiscountPercent) / 100;
    const extraDiscountManual = parseFloat(formData.extra_discount_amount) || 0;
    
    const isInterState = formData.state && companyState && 
                        formData.state.trim().toLowerCase() !== companyState.trim().toLowerCase();
    
    const cgst = isInterState ? 0 : totalTax / 2;
    const sgst = isInterState ? 0 : totalTax / 2;
    const igst = isInterState ? totalTax : 0;

    const subtotalAfterDiscounts = afterItemDiscount - extraDiscountAmount - extraDiscountManual;
    const baseTotal = subtotalAfterDiscounts + totalTax;
    
    let roundOffValue = 0;
    if (formData.round_off_enabled) {
      roundOffValue = Math.round(baseTotal) - baseTotal;
    } else {
      roundOffValue = parseFloat(formData.round_off) || 0;
    }

    const grandTotal = baseTotal + roundOffValue;

    return {
      subtotal,
      totalItemDiscount,
      extraDiscountAmount,
      cgst,
      sgst,
      igst,
      isInterState,
      totalTax,
      roundOff: roundOffValue,
      grandTotal,
      taxGroups,
      amountInWords: numberToWords(grandTotal)
    };
  }, [items, formData.extra_discount_percent, formData.extra_discount_amount, formData.round_off, formData.round_off_enabled, formData.state, companyState]);

  const handleSave = async (saveAndNew = false) => {
    if (saving) return;
    // --- Pre-flight validation (before setting saving=true) ---
    if (!formData.client_id) {
      alert('Please select a client');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setSaving(true);
    try {
      // Inline session check — withSessionCheck throws SESSION_EXPIRED uncaught in onClick handlers
      // which made the button appear dead after inactivity
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
        alert('Your session has expired. Please refresh the page and log in again.');
        return;
      }

      const quotationData = {
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        billing_address: formData.billing_address,
        gstin: formData.gstin,
        state: formData.state,
        date: formData.date,
        valid_till: formData.valid_till || null,
        payment_terms: formData.payment_terms,
        variant_id: formData.variant_id || null,
        remarks: formData.remarks || null,
        reference: formData.reference || null,
        prepared_by: formData.prepared_by || null,
        subtotal: calculations.subtotal,
        total_item_discount: calculations.totalItemDiscount,
        extra_discount_percent: parseFloat(formData.extra_discount_percent) || 0,
        extra_discount_amount: parseFloat(formData.extra_discount_amount) || 0,
        total_tax: calculations.totalTax,
        round_off: calculations.roundOff,
        grand_total: calculations.grandTotal,
        status: saveAndNew ? 'Draft' : (formData.status || 'Draft'),
        negotiation_mode: formData.negotiation_mode,
        authorized_signatory_id: formData.authorized_signatory_id || null
      };

      let quotationId = editId;

      if (editId) {
        const { data: updatedHeader, error: updateError } = await withTimeout(
          supabase
            .from('quotation_header')
            .update(quotationData)
            .eq('id', editId)
            .eq('organisation_id', organisation?.id)
            .select('id'),
          'updating quotation header'
        );
        if (updateError) throw updateError;
        if (!updatedHeader || updatedHeader.length === 0) {
          throw new Error('Quotation header not found for update or permission denied.');
        }
        quotationId = updatedHeader[0].id;
        setFormData(prev => ({ ...prev, id: quotationId }));
      } else {
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
          quotationNo = buildQuoteNoFromSeries(defaultSeries);
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
              quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
            }
          } catch (noSeriesFallbackErr) {
            if (!isTimeoutError(noSeriesFallbackErr, 'loading latest quotation number')) {
              throw noSeriesFallbackErr;
            }
            // Last-resort fast fallback for slow connections
            quotationNo = `QT-${Date.now().toString().slice(-6)}`;
          }
        }

        const createHeader = () =>
          supabase
            .from('quotation_header')
            .insert({ ...quotationData, quotation_no: quotationNo, organisation_id: organisation?.id })
            .select();

        let data = null;
        let error = null;
        try {
          const result = await withTimeout(createHeader(), 'creating quotation header');
          data = result?.data ?? null;
          error = result?.error ?? null;
        } catch (createHeaderErr) {
          if (!isTimeoutError(createHeaderErr, 'creating quotation header')) {
            throw createHeaderErr;
          }

          // One recovery retry after a timeout, typically needed after tab wake-up.
          await ensureValidSession({ strict: false, timeoutMs: 7000 });
          const retryResult = await withTimeout(
            createHeader(),
            'creating quotation header',
            60000
          );
          data = retryResult?.data ?? null;
          error = retryResult?.error ?? null;
        }
        
        if (error) {
          if (error.code === '23505') {
            throw new Error(`Quotation number ${quotationNo} already exists. Please try saving again.`);
          }
          throw error;
        }
        
        if (!data || data.length === 0) {
          throw new Error('Failed to create quotation header. No data returned.');
        }
        quotationId = data[0].id;
        setFormData(prev => ({ ...prev, id: quotationId }));

        // Update series after successful insert (fire and forget - don't await)
        if (defaultSeries) {
          const nextNo = getQuoteSeriesNumber(defaultSeries) + 1;
          const cfg = defaultSeries?.configs || {};
          const quoteCfg = cfg.quote || {};
          const updatedCfg = { ...cfg, quote: { ...quoteCfg, start_number: nextNo } };
          supabase.from('document_series').update({ current_number: nextNo, configs: updatedCfg }).eq('id', defaultSeries.id).then();
        }
      }

      const itemsToInsert = items
        .filter(item => (item.is_header && item.description?.trim()) || (!item.is_header && (item.item_id || item.section === 'erection')))
        .map(item => ({
          quotation_id: quotationId,
          item_id: item.item_id || null,
        variant_id: item.variant_id || null,
        make: item.make || null,
        description: item.description,
        qty: parseFloat(item.qty) || 1,
        uom: item.uom,
        rate: parseFloat(item.rate) || 0,
        original_discount_percent: parseFloat(item.original_discount_percent) || 0,
        discount_percent: parseFloat(item.discount_percent) || 0,
        discount_amount: item.discount_amount || 0,
        tax_percent: parseFloat(item.tax_percent) || 0,
        tax_amount: item.tax_amount || 0,
        line_total: item.line_total || 0,
        override_flag: item.override_flag || false,
        base_rate_snapshot: parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0,
        applied_discount_percent: parseFloat(item.applied_discount_percent) || 0,
        is_override: item.is_override || false,
        final_rate_snapshot: parseFloat(item.final_rate_snapshot) || parseFloat(item.rate) || 0,
        display_order: item.display_order || 0,
        custom1: item.custom1 || '',
        custom2: item.custom2 || '',
        hsn_code: item.hsn_code || null,
        sac_code: item.sac_code || null,
        organisation_id: organisation?.id || '00000000-0000-0000-0000-000000000000'
      }));

      const variantDiscountRecords = Object.entries(headerDiscounts)
        .filter(([variantId]) => variantId !== 'erection')
        .map(([variantId, discount]) => ({
          quotation_revision_id: quotationId,
          variant_id: variantId,
          header_discount_percent: parseFloat(discount) || 0,
          organisation_id: organisation?.id || '00000000-0000-0000-0000-000000000000'
        }));



      // OPTIMIZED: Delete and insert in single batch - run all operations in parallel
      await Promise.all([
        withTimeout(
          supabase.from('quotation_items').delete().eq('quotation_id', quotationId),
          'deleting old quotation items',
          30000
        ),
        withTimeout(
          supabase.from('quotation_revision_variant_discount').delete().eq('quotation_revision_id', quotationId),
          'deleting old quotation discounts',
          30000
        )
      ]);

      // Insert new items and discounts in parallel
      const insertPromises = [
        withTimeout(
          supabase.from('quotation_items').insert(itemsToInsert),
          'saving quotation items',
          35000
        )
      ];
      if (variantDiscountRecords.length > 0) {
        insertPromises.push(
          withTimeout(
            supabase.from('quotation_revision_variant_discount').insert(variantDiscountRecords),
            'saving quotation discount overrides',
            35000
          )
        );
      }
      await Promise.all(insertPromises);


      // Update source document status if this was a conversion
      if (conversionInfoRef.current && quotationId && !editId) {
        const { type, sourceId } = conversionInfoRef.current;
        const { status } = useConversionStatus(type);
        const tableName = getSourceTableName(type);

        await supabase
          .from(tableName)
          .update({
            status,
            converted_to_id: quotationId,
            converted_to_type: 'quotation',
          })
          .eq('id', sourceId);
      }

      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotations', organisation?.id] });

      // alert removed

      if (saveAndNew) {
        alert('Quotation saved as draft successfully!');
        setSaving(false);
        return;
      } else {
        navigate(`/quotation/view?id=${quotationId}`);
      }
    } catch (err) {
      console.error('Error saving quotation:', err);
      const errMsg = (err as any)?.message || String(err || '');
      if (/session|jwt|token|refresh_token|invalid_grant|not authenticated|auth/i.test(errMsg)) {
        alert('Your session seems expired. Please refresh the page and log in again.');
      } else {
        alert('Error: ' + errMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  const compactFieldStyle = { minHeight: '26px', padding: '2px 6px', fontSize: '11px' };
  const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '6px' };
  const labelColStyle = { minWidth: '70px', maxWidth: '70px', fontWeight: 600, fontSize: '10px', color: '#374151' };
  const fieldColStyle = { flex: 1 };

  const renderHeaderField = (label, field, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );

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
    <div>
      <div className="flex items-center justify-between mb-10 pb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {editId ? 'Edit Quotation' : duplicateId ? 'Duplicate Quotation' : 'Create New Quotation'}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Add details, items, and discounts to create your proposal.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pr-4 border-r border-gray-200">
            <label className="relative inline-flex items-center cursor-pointer group">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={formData.negotiation_mode}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  negotiation_mode: e.target.checked, 
                  status: e.target.checked ? 'Under Negotiation' : formData.status 
                })}
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              <span className="ms-3 text-sm font-medium text-gray-700 group-hover:text-sky-700 transition-colors">Negotiation Mode</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-[25px] px-10 min-w-[100px] rounded flex items-center justify-center text-[11px] font-bold text-white bg-gradient-to-b from-[#001f3f] to-[#003366] shadow-none border-none hover:opacity-90 transition-all"
              onClick={() => navigate('/quotation')}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`h-[25px] px-10 min-w-[100px] rounded flex items-center justify-center text-[11px] font-bold text-white bg-gradient-to-b from-[#001f3f] to-[#003366] shadow-none border-none hover:opacity-90 transition-all ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              className={`h-[25px] px-10 min-w-[100px] rounded flex items-center justify-center text-[11px] font-bold text-white bg-gradient-to-b from-[#001f3f] to-[#003366] shadow-none border-none hover:opacity-90 transition-all ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? 'Saving...' : editId ? 'Update Quotation' : 'Confirm & Save'}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          {/* Header with Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/quotations')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Back</span>
              </button>
              <h1 className="text-lg font-semibold text-gray-900">
                {editId ? 'Edit Quotation' : 'Create Quotation'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/quotations')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>
            </div>
          </div>
        </div>

        {/* Document Details Grid */}
        <div className="bg-white border border-gray-200 mb-6 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-600 rounded-sm"></div>
              <h2 className="text-xs font-bold text-gray-700 tracking-wider uppercase">Quotation Details</h2>
            </div>
            
            <div className="grid grid-cols-[1fr_1.5fr_1.2fr] gap-6 p-5">
              
              {/* Column 1: DOCUMENT */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Document</h3>
                
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Quotation No <span className="text-red-500">*</span></label>
                    <div className="w-full px-2 py-1.5 border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium focus:outline-none transition-colors min-h-[30px] flex items-center">
                      {formData.quotation_no || quoteNoPreview || 'Auto-generating...'}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Prepared By</label>
                    <input 
                      type="text" 
                      className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[30px]" 
                      value={formData.prepared_by || ''} 
                      onChange={(e) => setFormData({ ...formData, prepared_by: e.target.value })} 
                      placeholder="Sales executive..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Quotation Date <span className="text-red-500">*</span></label>
                    <input 
                      type="date" 
                      className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[30px]" 
                      value={formData.date} 
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Valid Till</label>
                    <input 
                      type="date" 
                      className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[30px]" 
                      value={formData.valid_till} 
                      onChange={(e) => setFormData({ ...formData, valid_till: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Variant</label>
                    <select 
                      className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[30px]" 
                      value={formData.variant_id} 
                      onChange={(e) => setFormData({ ...formData, variant_id: e.target.value })}
                    >
                      <option value="">Standard</option>
                      {variants.map(v => (
                        <option key={v.id} value={v.id}>{v.variant_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Reference</label>
                    <input 
                      type="text" 
                      className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[30px]" 
                      value={formData.reference || ''} 
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })} 
                      placeholder="Client RFQ No..."
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Terms</label>
                  <input 
                    type="text" 
                    className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[30px]" 
                    value={formData.payment_terms} 
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} 
                    placeholder="Net 30 Days"
                  />
                </div>
              </div>

              {/* Column 2: CLIENT */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Client</h3>
                
                <div className="flex flex-col client-dropdown-container">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Client <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="relative">
                      <input 
                        type="text"
                        className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none cursor-pointer transition-colors min-h-[30px]"
                        placeholder="Search or select..."
                        value={clientSearch || (formData.client_id ? clients.find(c => c.id === formData.client_id)?.client_name : '')}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setIsClientDropdownOpen(true);
                        }}
                        onFocus={() => setIsClientDropdownOpen(true)}
                      />
                      <div className="absolute right-2 top-2 pointer-events-none">
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                    {isClientDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 shadow-lg max-h-[300px] overflow-y-auto rounded-none">
                        {clients
                          .filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase()))
                          .map(c => (
                            <div 
                              key={c.id}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-100 last:border-0"
                              onClick={() => {
                                handleClientChange(c.id);
                                setClientSearch(c.client_name);
                                setIsClientDropdownOpen(false);
                              }}
                            >
                              {c.client_name}
                            </div>
                          ))}
                        {clients.filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs text-gray-500 italic text-center bg-gray-50">
                            No clients found matching "{clientSearch}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Contact</label>
                  <input 
                    type="text" 
                    className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[30px]" 
                    value={formData.client_contact} 
                    onChange={(e) => setFormData({ ...formData, client_contact: e.target.value })} 
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Billing Address</label>
                  <textarea 
                    className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[50px] resize-y" 
                    value={formData.billing_address} 
                    onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })} 
                    placeholder="Full billing address..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">GSTIN</label>
                    <input 
                      type="text" 
                      className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[30px]" 
                      value={formData.gstin} 
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} 
                      placeholder="27AABCU9603R1ZX"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">State</label>
                    <div className="relative">
                      <select 
                        className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[30px] appearance-none" 
                        value={formData.state} 
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      >
                        <option value="">Select state...</option>
                        {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <div className="absolute right-2 top-2 pointer-events-none">
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: PROJECT & DISCOUNTS */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Project</h3>
                
                <div className="flex flex-col relative">
                  <select 
                    className="w-full px-2 py-1.5 border border-gray-200 bg-white text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-colors min-h-[30px] appearance-none" 
                    value={formData.project_id} 
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  >
                    <option value="">Select project...</option>
                    {projects.filter((p) => !formData.client_id || p.client_id === formData.client_id).map((p) => (
                      <option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-2 pointer-events-none">
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Discounts</h3>
                    {variants.length > 0 && (
                      <button 
                        type="button" 
                        className="text-[9px] font-bold text-blue-500 uppercase tracking-wider hover:text-blue-700 transition-colors"
                        onClick={() => setActiveTab(activeTab === 'items' ? 'approval' : 'items')}
                      >
                        {activeTab === 'items' ? 'View Approvals' : 'Back to Discounts'}
                      </button>
                    )}
                  </div>
                  
                  {activeTab === 'items' ? (
                    <div className="space-y-2">
                      {(() => {
                        const renderVariants = [...variants];
                        if (formData.include_erection_charges) {
                          renderVariants.push({
                            id: 'erection',
                            variant_name: 'ERECTION CHARGES'
                          });
                        }
                        
                        return renderVariants.length > 0 ? renderVariants.map((variant, index) => {
                          const colors = [
                            { border: 'border-blue-500', bg: 'bg-blue-50/50', text: 'text-blue-700', percentBg: 'bg-blue-100/50', percentText: 'text-blue-600' },
                            { border: 'border-amber-400', bg: 'bg-amber-50/50', text: 'text-amber-700', percentBg: 'bg-amber-100/50', percentText: 'text-amber-600' },
                            { border: 'border-purple-400', bg: 'bg-purple-50/50', text: 'text-purple-700', percentBg: 'bg-purple-100/50', percentText: 'text-purple-600' },
                            { border: 'border-emerald-500', bg: 'bg-emerald-50/50', text: 'text-emerald-700', percentBg: 'bg-emerald-100/50', percentText: 'text-emerald-600' },
                          ];
                          const color = colors[index % colors.length];
                        
                        const settings = discountSettings[variant.id];
                        const discountValue = headerDiscounts[variant.id] || 0;
                        const isAboveMax = settings && discountValue > settings.max;
                        const approvalDisplay = getApprovalDisplayStatus(variant.id);
                        
                        return (
                          <div key={variant.id} className="flex items-center justify-between border border-gray-100 bg-white">
                            <div className={`flex items-center gap-2 px-2 py-1 flex-1 border-l-2 ${color.border} ${color.bg}`}>
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${color.text} truncate`}>
                                {variant.variant_name}
                              </span>
                              {approvalDisplay !== 'none' && (
                                <span className={`text-[8px] px-1 py-0.5 rounded-none font-bold uppercase tracking-tighter ${
                                  approvalDisplay === 'approved' ? 'bg-emerald-500 text-white' : 
                                  approvalDisplay === 'pending' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                                }`}>
                                  {approvalDisplay === 'approved' ? 'Approved' : approvalDisplay === 'pending' ? 'Pending' : 'Rejected'}
                                </span>
                              )}
                            </div>
                            <div className={`flex items-center border-l border-gray-100 focus-within:border-gray-300 transition-colors w-[60px] ${color.bg}`}>
                              <input
                                type="number"
                                className={`w-full px-2 py-1 text-right text-[11px] font-bold ${color.text} bg-transparent outline-none`}
                                value={headerDiscounts[variant.id] || 0}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                  setHeaderDiscounts(prev => ({ ...prev, [variant.id]: val }));
                                }}
                                onBlur={(e) => {
                                  const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                  handleHeaderDiscountChange(variant.id, val);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.target.blur();
                                }}
                                min="0"
                                max="100"
                                step="0.01"
                              />
                              <div className={`px-1.5 py-1 text-[10px] font-bold ${color.percentText} ${color.percentBg} border-l border-white/50`}>
                                %
                              </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="text-xs text-gray-500 italic p-2 border border-gray-100 bg-gray-50">
                          No variants available.
                        </div>
                      );
                      })()}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic p-2 border border-gray-100 bg-gray-50">
                      Approval history shown below.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Approval History Tab Content */}
            {activeTab === 'approval' && (
              <div className="px-5 pb-5 pt-2 border-t border-gray-100">
                {approvalHistory.length === 0 ? (
                  <div className="py-6 text-center text-gray-500 italic text-xs">
                    No approval history found for this document.
                  </div>
                ) : (
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-2 font-bold text-gray-500 uppercase tracking-wider">Variant</th>
                        <th className="px-3 py-2 font-bold text-gray-500 uppercase tracking-wider">Event</th>
                        <th className="px-3 py-2 font-bold text-gray-500 uppercase tracking-wider">By</th>
                        <th className="px-3 py-2 font-bold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-3 py-2 font-bold text-gray-500 uppercase tracking-wider">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {approvalHistory.map((log) => {
                        const variant = variants.find(v => v.id === log.variant_id);
                        return (
                          <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 font-bold text-gray-700">{variant?.variant_name || '-'}</td>
                            <td className="px-3 py-2 capitalize">{log.event_type}</td>
                            <td className="px-3 py-2 text-gray-500">{log.performed_by_email || '-'}</td>
                            <td className="px-3 py-2 text-gray-500">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                            <td className="px-3 py-2 text-gray-500 italic">{log.remark || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Bottom Options (Erection Charges, Round Off) */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded-none focus:ring-0 focus:ring-offset-0"
                  checked={formData.include_erection_charges}
                  onChange={(e) => setFormData({ ...formData, include_erection_charges: e.target.checked })}
                />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors">Include Erection Charges</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded-none focus:ring-0 focus:ring-offset-0"
                  checked={formData.round_off_enabled}
                  onChange={(e) => setFormData({ ...formData, round_off_enabled: e.target.checked })}
                />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors">Enable Round Off</span>
              </label>
            </div>
          </div>

      <div className="bg-white rounded-none border border-gray-200 shadow-sm overflow-hidden mb-6" ref={itemsTableRef}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-sky-600 rounded-none"></div>
            <h3 className="text-lg font-bold text-gray-900">Line Items</h3>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-none">
              {items.length} {items.length === 1 ? 'Item' : 'Items'} Total
            </span>
          </div>
          
          {/* Section Tabs */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e5e7eb', marginLeft: '20px' }}>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'materials'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
              }`}
              onClick={() => setActiveSection('materials')}
            >
              Materials
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'erection'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
              }`}
              onClick={() => setActiveSection('erection')}
            >
              Erection Charges
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setShowItemCreateDrawer(true)}
              className="h-[25px] min-w-[100px] px-4 text-[11px] font-bold text-white bg-gradient-to-r from-[#001f3f] to-[#003366] border-none rounded-none hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              Add Material
            </button>
            <div className="w-px h-6 bg-gray-200 mx-2"></div>
            <button className="h-[25px] min-w-[100px] px-4 text-[11px] font-bold text-white bg-gradient-to-r from-[#001f3f] to-[#003366] border-none rounded-none hover:opacity-90 transition-all shadow-sm" onClick={addEmptyItemRow}>+ Add Row</button>
            <button className="h-[25px] min-w-[100px] px-4 text-[11px] font-bold text-white bg-gradient-to-r from-[#001f3f] to-[#003366] border-none rounded-none hover:opacity-90 transition-all shadow-sm" onClick={addSectionHeader}>+ Add Header</button>
            <button className="h-[25px] min-w-[120px] px-4 text-[11px] font-bold text-white bg-gradient-to-r from-[#001f3f] to-[#003366] border-none rounded-none hover:opacity-90 transition-all shadow-sm flex items-center justify-center gap-1.5" onClick={() => setShowItemPicker(true)}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              Add Multiple Items
            </button>
            <button className="h-[25px] min-w-[100px] px-4 text-[11px] font-bold text-white bg-gradient-to-r from-[#001f3f] to-[#003366] border-none rounded-none hover:opacity-90 transition-all ml-2" onClick={() => setShowCustomLabelEditor(true)}>⚙ Columns</button>
          </div>
        </div>

        <div className="grid-table-container">
          <table className={`grid-table ${activeSection === 'erection' ? 'erection-section' : ''}`}>
            <thead>
              <tr>
                <th className="col-shrink">#</th>
                {(templateSettings?.column_settings?.optional?.hsn_code !== false) && (
                  <th className="col-hsn">{templateSettings?.column_settings?.labels?.hsn_code || 'HSN'}</th>
                )}
                {templateSettings?.column_settings?.optional?.item !== false && (
                  <th className="col-item" style={{ position: 'relative' }}>
                    {templateSettings?.column_settings?.labels?.item || 'ITEM'}
                  </th>
                )}
                {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
                  <th className="col-code">{templateSettings?.column_settings?.labels?.client_part_no || 'CLIENT PART NO'}</th>
                )}
                {(templateSettings?.column_settings?.optional?.client_description === true) && (
                  <th className="col-item">{templateSettings?.column_settings?.labels?.client_description || 'CLIENT DESCRIPTION'}</th>
                )}
                {(templateSettings?.column_settings?.optional?.make !== false) && (
                  <th className="col-make">{templateSettings?.column_settings?.labels?.make || 'MAKE'}</th>
                )}
                {(templateSettings?.column_settings?.optional?.variant !== false) && (
                  <th className="col-variant">{templateSettings?.column_settings?.labels?.variant || 'VARIANT'}</th>
                )}
                <th className="col-qty">QTY</th>
                <th className="col-unit">UNIT</th>
                <th className="col-rate">RATE</th>
                <th className="col-disc">DISC %</th>
                <th className="col-rate">RATE AFTER DISC</th>
                <th className="col-gst">GST %</th>
                {templateSettings?.column_settings?.optional?.custom1 && (
                  <th className="col-shrink">{templateSettings.column_settings.labels?.custom1 || 'Custom 1'}</th>
                )}
                {templateSettings?.column_settings?.optional?.custom2 && (
                  <th className="col-shrink">{templateSettings.column_settings.labels?.custom2 || 'Custom 2'}</th>
                )}
                <th className="col-amount">AMOUNT</th>
                <th className="col-shrink"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={20} className="cell-static text-center" style={{ padding: '48px', color: '#94a3b8', fontSize: '14px' }}>No items added. Click "Add Row" or "Add Multiple Items".</td>
                </tr>
              ) : (
                items
                  .filter(item => {
                    if (activeSection === 'materials') {
                      return item.section !== 'erection';
                    } else {
                      return item.section === 'erection';
                    }
                  })
                  .map((item, index) => {
                  const itemCountBefore = items.slice(0, index).filter(i => !i.is_header).length;
                  if (item.is_header) {
                    return (
                      <tr 
                        key={item.id} 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnRow(e, item.id)}
                        className={draggingItemId === item.id ? 'row-dragging' : ''}
                        style={{ background: '#f8fafc' }}
                      >
                        <td 
                          className="text-center cell-static col-shrink row-drag-handle" 
                          title="Drag to reorder"
                          draggable
                          onDragStart={(e) => handleDragStart(e, item.id)}
                          onDragEnd={handleDragEnd}
                        >
                          {item.description ? itemCountBefore + 1 : ':::'}
                        </td>
                        <td colSpan={11} style={{ padding: '4px 8px' }}>
                          <input
                            type="text"
                            className="cell-input"
                            style={{ fontWeight: 'bold', color: '#1e293b', background: 'transparent', border: 'none', borderBottom: '1px dashed #cbd5e1', fontSize: '11px' }}
                            placeholder="Enter Section Header (e.g. First Floor Piping)..."
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          />
                        </td>
                        <td className="delete-cell col-shrink">
                          <button type="button" className="btn-delete" onClick={() => removeItem(item.id)}>×</button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr 
                      key={item.id} 
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnRow(e, item.id)}
                      onFocus={() => {
                        if (index === items.length - 1) {
                          addEmptyItemRow();
                        }
                      }}
                      className={`${draggingItemId === item.id ? 'row-dragging' : ''} ${item.is_override ? 'override-indicator' : ''} ${item.section === 'erection' ? 'erection-row' : ''}`}
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                    >
                      <td 
                        className="text-center cell-static col-shrink row-drag-handle" 
                        title="Drag to reorder" 
                        style={{ fontSize: '11px' }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragEnd={handleDragEnd}
                      >
                        {itemCountBefore + 1}
                      </td>
                      {(templateSettings?.column_settings?.optional?.hsn_code !== false) && (
                        <td className="col-shrink">
                          <input
                            type="text"
                            className="cell-input text-center"
                            value={item.hsn_code || item.material?.hsn_code || ''}
                            readOnly
                            style={{ background: '#f8fafc' }}
                          />
                        </td>
                      )}
                      {templateSettings?.column_settings?.optional?.item !== false && (
                        <td className="col-item" style={{ position: 'relative' }}>
                        <select
                          className="cell-select"
                          value={item.item_id}
                          onChange={(e) => {
                            const mat = materials.find(m => m.id === e.target.value);
                            updateItem(item.id, 'item_id', e.target.value);
                            if (mat) {
                              updateItem(item.id, 'material', mat);
                              updateItem(item.id, 'hsn_code', mat.hsn_code || '');
                              updateItem(item.id, 'description', mat.display_name || mat.name);
                              updateItem(item.id, 'tax_percent', mat.gst_rate || 0);
                              const firstMake = itemMakes[mat.id]?.[0] || '';
                              updateItem(item.id, 'make', firstMake);
                              const newRate = getRateForMaterialVariant(mat, item.variant_id || null, firstMake);
                              updateItem(item.id, 'base_rate_snapshot', newRate);
                              const finalRate = calculateVariantDiscountedRate(newRate, item.applied_discount_percent || 0);
                              updateItem(item.id, 'rate', finalRate);
                            }
                          }}
                        >
                          <option value="">Select Item</option>
                          {materials.map(m => (
                            <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                          ))}
                        </select>
                        {hoveredItemId === item.id && item.item_id && (
                          <button
                            type="button"
                            className="btn-x-hover"
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              padding: '2px 6px',
                              fontSize: '12px',
                              background: '#dc2626',
                              color: 'white',
                              border: 'none',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              opacity: 0,
                              transform: 'scale(0)',
                              transition: 'all 0.2s ease-in-out'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.opacity = '1';
                              e.target.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.opacity = '0';
                              e.target.style.transform = 'scale(1)';
                            }}
                            onClick={() => {
                              // Clear item but keep row structure
                              setItems(prev => prev.map(p => 
                                p.id === item.id ? { ...p, item_id: '', material: null, description: '', hsn_code: '' } : p
                              ));
                              
                              // Open item picker for replacement after a short delay
                              setTimeout(() => {
                                setItemSearch('');
                                setShowItemPicker(true);
                              }, 200);
                            }}
                            title="Clear item and select replacement"
                          >
                            ×
                          </button>
                        )}
                      </td>
                      )}
                      {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
                        <td className="col-shrink cell-static">
                          <div style={{ fontSize: '10px', color: '#64748b', padding: '4px', textAlign: 'center' }}>
                            {(() => {
                              const clientId = formData.client_id || formData.client?.id;
                              const mapping = clientId && item.material?.mappings?.find((m: any) => m.client_id === clientId);
                              return mapping?.client_part_no || '-';
                            })()}
                          </div>
                        </td>
                      )}
                      {(templateSettings?.column_settings?.optional?.client_description === true) && (
                        <td className="col-item cell-static">
                          <div style={{ fontSize: '10px', color: '#64748b', padding: '4px' }}>
                            {(() => {
                              const clientId = formData.client_id || formData.client?.id;
                              const mapping = clientId && item.material?.mappings?.find((m: any) => m.client_id === clientId);
                              return mapping?.client_description || '-';
                            })()}
                          </div>
                        </td>
                      )}
                      {(templateSettings?.column_settings?.optional?.make !== false) && (
                        <td className="col-shrink">
                          <select
                            className="cell-select"
                            value={item.make || ''}
                            onChange={(e) => {
                              const nextMake = e.target.value;
                              updateItem(item.id, 'make', nextMake);
                              const mat = materials.find(m => m.id === item.item_id);
                              if (mat) {
                                const newRate = getRateForMaterialVariant(mat, item.variant_id || null, nextMake);
                                const variant_discount = item.variant_id ? (headerDiscounts[item.variant_id] || 0) : 0;
                                const finalRate = calculateVariantDiscountedRate(newRate, variant_discount);
                                updateItem(item.id, 'base_rate_snapshot', newRate);
                                updateItem(item.id, 'rate', finalRate);
                              }
                            }}
                          >
                            <option value="">No Make</option>
                            {(itemMakes[item.item_id] || []).map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      {(templateSettings?.column_settings?.optional?.variant !== false) && (
                        <td className="col-shrink">
                          <select
                            className="cell-select"
                            value={item.variant_id || ''}
                            onChange={(e) => {
                              const nextVariant = e.target.value || null;
                              updateItem(item.id, 'variant_id', nextVariant);
                              const mat = materials.find(m => m.id === item.item_id);
                              if (mat) {
                                const newRate = getRateForMaterialVariant(mat, nextVariant, item.make || '');
                                const variant_discount = nextVariant ? (headerDiscounts[nextVariant] || 0) : 0;
                                const finalRate = calculateVariantDiscountedRate(newRate, variant_discount);
                                updateItem(item.id, 'base_rate_snapshot', newRate);
                                updateItem(item.id, 'rate', finalRate);
                              }
                            }}
                          >
                            <option value="">No Variant</option>
                            {variants
                              .filter(v => {
                                if (!item.item_id) return true;
                                const itemVariants = variantPricing[item.item_id];
                                return itemVariants && itemVariants[v.id];
                              })
                              .map(v => (
                                <option key={v.id} value={v.id}>{v.variant_name}</option>
                              ))
                            }
                          </select>
                        </td>
                      )}
                      <td className="col-shrink">
                        <input type="number" className="cell-input text-right" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} min="0" />
                      </td>
                      <td className="col-shrink">
                        <input type="text" className="cell-input text-center" value={item.uom} onChange={(e) => updateItem(item.id, 'uom', e.target.value)} />
                      </td>
                      <td className="col-shrink">
                        <input type="number" className="cell-input text-right" value={item.base_rate_snapshot || 0} readOnly style={{ background: '#f8fafc' }} />
                      </td>
                      <td className="col-shrink">
                        <input
                          type="number"
                          className="cell-input text-right"
                          value={item.discount_percent || 0}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                            updateItem(item.id, 'discount_percent', val);
                          }}
                          style={item.is_override ? { background: '#fef3c7', border: '1px solid #f59e0b' } : {}}
                        />
                      </td>
                      <td className="col-shrink">
                        <input
                          type="number"
                          className="cell-input text-right"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                          disabled={!formData.negotiation_mode}
                          style={!formData.negotiation_mode ? { background: '#f8fafc' } : {}}
                        />
                      </td>
                      <td className="col-shrink">
                        <input type="number" className="cell-input text-right" value={item.tax_percent} onChange={(e) => updateItem(item.id, 'tax_percent', e.target.value)} />
                      </td>
                      {templateSettings?.column_settings?.optional?.custom1 && (
                        <td className="col-shrink">
                          <input type="text" className="cell-input" value={item.custom1 || ''} onChange={(e) => updateItem(item.id, 'custom1', e.target.value)} />
                        </td>
                      )}
                      {templateSettings?.column_settings?.optional?.custom2 && (
                        <td className="col-shrink">
                          <input type="text" className="cell-input" value={item.custom2 || ''} onChange={(e) => updateItem(item.id, 'custom2', e.target.value)} />
                        </td>
                      )}
                      <td className="col-shrink cell-static text-right amount-value">
                        {formatCurrency((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0))}
                      </td>
                      <td className="delete-cell col-shrink">
                        <button 
                          type="button" 
                          className="btn-delete" 
                          onClick={() => removeItem(item.id)}
                          style={{ 
                            padding: '2px 6px', 
                            fontSize: '14px',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: '4px'
                          }}
                          title="Delete entire row"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
              
              <tr className="total-row">
                <td colSpan={4} className="total-label">TOTAL</td>
                <td className="text-right cell-static" style={{ fontWeight: 'bold', textAlign: 'right', paddingRight: '14px' }}>
                  {items.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0).toFixed(2)}
                </td>
                <td colSpan={templateSettings?.column_settings?.optional?.custom1 && templateSettings?.column_settings?.optional?.custom2 ? 7 : templateSettings?.column_settings?.optional?.custom1 || templateSettings?.column_settings?.optional?.custom2 ? 6 : 5}></td>
                <td className="total-value">
                  {formatCurrency(items.reduce((sum, i) => sum + ((parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0)), 0))}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Erection Section - shown when materials tab is active */}
      {activeSection === 'materials' && (
        <ErectionSection
          quotationId={formData.id || ''}
          items={items}
          onItemUpdate={(itemId, field, value) => {
            updateItem(itemId, field, value);
          }}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px' }}>
        <div>
          <div className="card" style={{ padding: '12px', height: '100%' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Notes & Remarks:</label>
            <textarea 
              className="form-input" 
              style={{ width: '100%', height: 'calc(100% - 24px)', minHeight: '120px', fontSize: '11px', resize: 'none' }}
              placeholder="Enter internal notes or additional instructions..."
              value={formData.remarks || ''}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            />
          </div>
        </div>
        <div className="card" style={{ padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(calculations.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
              <span>Total Item Discount</span>
              <span>- {formatCurrency(calculations.totalItemDiscount)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Extra Discount %</span>
              <input type="number" className="form-input" style={{ width: '60px', textAlign: 'right', height: '24px', padding: '2px 4px', fontSize: '11px' }} value={formData.extra_discount_percent} onChange={(e) => setFormData({ ...formData, extra_discount_percent: e.target.value })} min="0" max="100" step="0.01" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Extra Discount Amt</span>
              <input type="number" className="form-input" style={{ width: '100px', textAlign: 'right', height: '24px', padding: '2px 4px', fontSize: '11px' }} value={formData.extra_discount_amount} onChange={(e) => setFormData({ ...formData, extra_discount_amount: e.target.value })} min="0" step="0.01" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
              <span>Extra Discount</span>
              <span>- {formatCurrency(calculations.extraDiscountAmount)}</span>
            </div>
            {calculations.isInterState ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                <span>IGST</span>
                <span>{formatCurrency(calculations.igst)}</span>
              </div>
            ) : (
              <>
                {Object.keys(calculations.taxGroups || {}).length > 0 ? (
                  Object.entries(calculations.taxGroups).map(([rate, taxes]) => (
                    <React.Fragment key={rate}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                        <span>CGST {Number(rate) / 2}%</span>
                        <span>{formatCurrency(taxes.cgst)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                        <span>SGST {Number(rate) / 2}%</span>
                        <span>{formatCurrency(taxes.sgst)}</span>
                      </div>
                    </React.Fragment>
                  ))
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                      <span>CGST</span>
                      <span>{formatCurrency(calculations.cgst)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                      <span>SGST</span>
                      <span>{formatCurrency(calculations.sgst)}</span>
                    </div>
                  </>
                )}
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input 
                  type="checkbox" 
                  id="roundOffToggle"
                  style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                  checked={formData.round_off_enabled} 
                  onChange={(e) => setFormData({ ...formData, round_off_enabled: e.target.checked })} 
                />
                <label htmlFor="roundOffToggle" style={{ fontSize: '11px', cursor: 'pointer', userSelect: 'none' }}>Round Off</label>
              </div>
              <input 
                type="number" 
                className="form-input" 
                style={{ 
                  width: '100px', 
                  textAlign: 'right', 
                  height: '24px', 
                  padding: '2px 4px', 
                  fontSize: '11px',
                  backgroundColor: formData.round_off_enabled ? '#f8fafc' : 'white',
                  color: formData.round_off_enabled ? '#64748b' : '#1e293b'
                }} 
                value={calculations.roundOff.toFixed(2)} 
                readOnly={formData.round_off_enabled}
                onChange={(e) => !formData.round_off_enabled && setFormData({ ...formData, round_off: e.target.value })} 
                step="0.01" 
              />
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700 }}>
              <span>Grand Total</span>
              <span>{formatCurrency(calculations.grandTotal)}</span>
            </div>
            <div style={{ color: '#1e293b', fontSize: '10px', fontStyle: 'italic', fontWeight: 600, textAlign: 'right', marginTop: '2px' }}>
              INR {calculations.amountInWords}
            </div>
          </div>
        </div>
      </div>



      <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-8 border-t border-gray-100 mb-20">
        <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-none px-6 py-4 shadow-sm w-full md:w-auto">
          <div className="w-10 h-10 bg-sky-50 rounded-full flex items-center justify-center text-sky-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Authorized Signatory</span>
            <select 
              className="bg-transparent border-none p-0 text-sm font-bold text-gray-800 focus:ring-0 cursor-pointer min-w-[200px]"
              value={formData.authorized_signatory_id || ''} 
              onChange={(e) => setFormData({ ...formData, authorized_signatory_id: e.target.value })}
            >
              <option value="">Select Signatory...</option>
              {(organisation?.signatures || []).map((sig) => (
                <option key={sig.id} value={sig.id}>{sig.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            className="h-[25px] px-10 min-w-[100px] rounded flex items-center justify-center text-[11px] font-bold text-white bg-gradient-to-b from-[#001f3f] to-[#003366] shadow-none border-none hover:opacity-90 transition-all"
            onClick={() => navigate('/quotations')}
          >
            Cancel
          </button>
          <button 
            className={`h-[25px] px-10 min-w-[100px] rounded flex items-center justify-center text-[11px] font-bold text-white bg-gradient-to-b from-[#001f3f] to-[#003366] shadow-none border-none hover:opacity-90 transition-all ${
              saving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={() => handleSave(true)}
          >
            Save as Draft
          </button>
          <button 
            className={`h-[25px] px-10 min-w-[100px] rounded flex items-center justify-center text-[11px] font-bold text-white bg-gradient-to-b from-[#001f3f] to-[#003366] shadow-none border-none hover:opacity-90 transition-all ${
              saving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : editId ? 'Update Quotation' : 'Confirm & Save'}
          </button>
        </div>
      </div>
      
      {showCustomLabelEditor && (
        <div className="modal-overlay open" onClick={() => setShowCustomLabelEditor(false)}>
          <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Template Column Settings</h3>
              <button className="btn-close" onClick={() => setShowCustomLabelEditor(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                Toggle columns to show/hide on the printed document. You can also customize their display labels.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { key: 'item', label: 'Item Name' },
                  { key: 'item_code', label: 'Internal Part No' },
                  { key: 'client_part_no', label: 'Client Part No' },
                  { key: 'hsn_code', label: 'HSN/SAC' },
                  { key: 'make', label: 'Make/Brand' },
                  { key: 'variant', label: 'Variant Details' },
                  { key: 'description', label: 'Description' },
                  { key: 'client_description', label: 'Client Description' },
                  { key: 'custom1', label: 'Custom Column 1' },
                  { key: 'custom2', label: 'Custom Column 2' }
                ].map(col => {
                  const isEnabled = templateSettings?.column_settings?.optional?.[col.key] !== false;
                  const customLabel = templateSettings?.column_settings?.labels?.[col.key] || '';
                  
                  return (
                    <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid #f3f4f6', borderRadius: '8px' }}>
                      <input 
                        type="checkbox" 
                        checked={isEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setTemplateSettings(prev => {
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
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{col.label}</div>
                        <input 
                          type="text"
                          placeholder="Custom Label (optional)"
                          className="form-input"
                          style={{ marginTop: '4px', height: '28px', fontSize: '11px' }}
                          value={customLabel}
                          onChange={(e) => {
                            const newLabel = e.target.value;
                            setTemplateSettings(prev => {
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
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowCustomLabelEditor(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
      {showItemPicker && (
        <div className="modal-overlay open" onClick={() => setShowItemPicker(false)}>
          <div className="modal-content" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Select Items</h3>
              <button className="btn-close" onClick={() => setShowItemPicker(false)}>×</button>
            </div>
            <div className="modal-body">
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search items..." 
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                style={{ marginBottom: '16px' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', height: '400px' }}>
                <div style={{ overflowY: 'auto', border: '1px solid #eee' }}>
                  <table className="table">
                    <thead>
                      {pickerTable.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map(header => (
                            <th key={header.id}>
                              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {pickerTable.getRowModel().rows.map(row => (
                        <tr key={row.id}>
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ overflowY: 'auto', border: '1px solid #eee', padding: '8px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Selected Items</h4>
                  {pickerItems.map(p => (
                    <div key={p.item_id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                      <span>{p.material.name} x {p.qty}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm" onClick={() => handlePickerQtyChange(p.item_id, -1)}>-</button>
                        <button className="btn btn-sm" onClick={() => handlePickerQtyChange(p.item_id, 1)}>+</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleRemoveFromPicker(p.item_id)}>x</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowItemPicker(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddItemsToQuotation} disabled={pickerItems.length === 0}>Add to Quotation</button>
            </div>
          </div>
        </div>
      )}

      {discountPopup.show && (
        <div className="modal-overlay open">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Bulk Discount Update</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px' }}>
                You are changing <strong>{discountPopup.variantName}</strong> discount from {discountPopup.oldValue}% to {discountPopup.newValue}%.
              </p>
              <p style={{ fontSize: '13px', marginTop: '8px', color: '#666' }}>
                - Affected rows: {discountPopup.affectedRows}<br />
                - Overridden rows (skipped): {discountPopup.overriddenRows}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancelDiscountChanges}>Cancel</button>
              <button className="btn btn-primary" onClick={applyDiscountChanges}>Apply to All Rows</button>
            </div>
          </div>
        </div>
      )}
      {saving && (
        <div style={{position:'fixed',inset:0,background:'rgba(255,255,255,0.92)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:9999,gap:'16px'}}>
          <div style={{width:'48px',height:'48px',border:'4px solid #e5e7eb',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
          <span style={{fontSize:'16px',fontWeight:600,color:'#374151'}}>Saving Quotation...</span>
        </div>
      )}
      
      <ItemCreateDrawer
        isOpen={showItemCreateDrawer}
        onClose={() => setShowItemCreateDrawer(false)}
        onSuccess={handleItemCreateSuccess}
      />
    </div>
  );
}
