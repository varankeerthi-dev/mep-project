import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { format } from 'date-fns';
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
import { TermsConditionsDrawer } from '../components/TermsConditionsDrawer';
import { FileText, Plus, Mail } from 'lucide-react';
import { InlineDescriptionCell } from '../components/InlineDescriptionCell';
import { SearchableItemSelect } from '../components/SearchableItemSelect';
import { autoCreateOrUpdateErection } from '../utils/erectionUtils';
import { lookupServiceRate } from '../hooks/useErectionCharges';
import { ErectionSection } from '../components/ErectionSection';
import { ApprovalIntegration } from '../approvals/integration';
import { toast } from '../lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { ArcPricingToggle, ArcPricingStatusBadge, ArcRateBadge, StandardRateBadge } from '../components/ArcPricingToggle';
import { ArcConfirmationDialog } from '../components/ArcConfirmationDialog';
import { fetchArcPricingForItems, getArcRateFromMap } from '../lib/arc-pricing';
import { useLastDocumentRates } from '../hooks/useLastDocumentRates';

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
  const dcIdsParam = searchParams.get('dcIds');
  const multiDCModeParam = searchParams.get('multiDCMode') as any;
  const isConverting = Boolean(convertFrom && sourceId && !editId && !duplicateId);
  const isMultiDC = convertFrom === 'multi-dc-to-quotation' && dcIdsParam;
  const conversionInfoRef = useRef<{ type: ConversionType; sourceId: string } | null>(null);
  const { organisation } = useAuth();
  const { user } = useAuth();
  
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
  const [useArcPricing, setUseArcPricing] = useState(false);
  const [arcPricingMap, setArcPricingMap] = useState<Record<string, any>>({});
  const [arcPricingConfirmOpen, setArcPricingConfirmOpen] = useState(false);
  
  const [discountSettings, setDiscountSettings] = useState({});
  const [approvalStatus, setApprovalStatus] = useState({});
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
} | null>(null);
  const [inputDialog, setInputDialog] = useState<{
  open: boolean;
  title: string;
  placeholder: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  suggestions?: string[];
  allowEmpty?: boolean;
} | null>(null);
  const [discountConfirm, setDiscountConfirm] = useState<{
    portfolio: any;
    clientName: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState('items');
  const [activeSection, setActiveSection] = useState('materials');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  
  const [templateSettings, setTemplateSettings] = useState(null);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showCustomLabelEditor, setShowCustomLabelEditor] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  const getVisibleColumnCount = () => {
    let count = 1;
    if (templateSettings?.column_settings?.optional?.hsn_code !== false) count++;
    if (templateSettings?.column_settings?.optional?.item !== false) count++;
    if (templateSettings?.column_settings?.optional?.client_part_no === true) count++;
    if (templateSettings?.column_settings?.optional?.client_description === true) count++;
    if (templateSettings?.column_settings?.optional?.make !== false) count++;
    if (templateSettings?.column_settings?.optional?.variant !== false) count++;
    count += 7;
    if (templateSettings?.column_settings?.optional?.custom1 === true) count++;
    if (templateSettings?.column_settings?.optional?.custom2 === true) count++;
    count += 2;
    return count;
  };

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
  const [pickerItems, setPickerItems] = useState<any[]>([]);
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
  const [showTermsDrawer, setShowTermsDrawer] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Multi-DC allocation state
  const [dcAllocations, setDcAllocations] = useState<Array<{
    dc_id: string;
    dc_number: string;
    dc_date: string;
    total_amount: number;
    allocated_amount: number;
  }>>([]);
  const [multiDCError, setMultiDCError] = useState('');

  useEffect(() => {
    const measure = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const [formData, setFormData] = useState<any>({
    id: '',
    quotation_no: '',
    revision_no: 1,
    revision_history: [],
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

  const [items, setItems] = useState<any[]>([]);
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

  // ARC pricing query
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

  // Last document rates query (historical quoted/invoiced rates)
  const quotationItemIds = useMemo(() => {
    const ids = items.map((item: any) => item.item_id).filter(Boolean);
    return Array.from(new Set(ids)) as string[];
  }, [items]);

  const { data: lastRatesMap = {} } = useLastDocumentRates(formData.client_id, quotationItemIds);

  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initQuery.data) return;
    
    const { pricing } = initQuery.data;

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
  }, [initQuery.data, materials]);

  useEffect(() => {
    if (!initQuery.data) return;
    
    const currentId = `${editId || ''}-${duplicateId || ''}`;
    if (initializedRef.current === currentId) return;

    const { settings, template, quickQuoteConfig, pricing, orgFullDetails } = initQuery.data;

    const materialsWithService = materials.map(item => ({
      ...item,
      isService: item.item_type === 'service'
    }));

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
        uom: item.uom,
        discount_percent: 0,
        line_total: item.qty * item.rate,
      }));
      setItems(newItems);
    }
  }, [isConverting, conversionQuery.data, convertFrom, sourceId]);

  // Load DC data for multi-DC allocation
  useEffect(() => {
    if (!isMultiDC || !dcIdsParam || !organisation?.id) return;

    const dcIdArray = dcIdsParam.split(',').filter(Boolean);
    if (dcIdArray.length === 0) return;

    const loadDCs = async () => {
      const { data: dcs } = await supabase
        .from('delivery_challans')
        .select('id, dc_number, dc_date, items:delivery_challan_items(amount)')
        .in('id', dcIdArray)
        .eq('organisation_id', organisation.id);

      if (dcs && dcs.length > 0) {
        const allocations = dcs.map(dc => {
          const totalAmount = (dc.items || []).reduce((sum: number, item: any) => sum + (parseFloat(String(item.amount)) || 0), 0);
          return {
            dc_id: dc.id,
            dc_number: dc.dc_number,
            dc_date: dc.dc_date,
            total_amount: totalAmount,
            allocated_amount: totalAmount, // Default: allocate full amount
          };
        });
        setDcAllocations(allocations);
        // Set multi_dc_mode on form data
        setFormData(prev => ({ ...prev, multi_dc_mode: multiDCModeParam || 'single-total' }));
      }
    };

    loadDCs();
  }, [isMultiDC, dcIdsParam, organisation?.id]);

  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalItemDiscount = 0;
    let totalTax = 0;
    
    const subTotalGroups: { [key: string]: number } = {};
    let runningGroupTotal = 0;
    const taxGroups: { [key: string]: { baseAmount: number; taxAmount: number; sgst: number; cgst: number } } = {};

    items.forEach(item => {
      if (item.is_header) return;
      if (item.is_subtotal) {
        const label = item.subtotal_label || 'Sub-total:';
        subTotalGroups[label] = runningGroupTotal;
        runningGroupTotal = 0;
        return;
      }
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
      runningGroupTotal += net;
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

    const afterItemDiscount = subtotal;
    const extraDiscountPercent = parseFloat(formData.extra_discount_percent) || 0;
    const extraDiscountAmount = (afterItemDiscount * extraDiscountPercent) / 100;
    const extraDiscountManual = parseFloat(formData.extra_discount_amount) || 0;
    const isInterState = formData.state && companyState && formData.state.trim().toLowerCase() !== companyState.trim().toLowerCase();
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
    return { subtotal, totalItemDiscount, extraDiscountAmount, cgst, sgst, igst, isInterState, totalTax, roundOff: roundOffValue, grandTotal, taxGroups, subTotalGroups, amountInWords: numberToWords(grandTotal) };
  }, [items, formData.extra_discount_percent, formData.extra_discount_amount, formData.round_off, formData.round_off_enabled, formData.state, companyState]);

  // Auto-split allocation equally when items change (for multi-DC)
  useEffect(() => {
    if (!isMultiDC || dcAllocations.length === 0) return;
    const quotationTotal = calculations?.grandTotal || 0;
    if (quotationTotal <= 0) return;

    // Pro-rata split: allocate proportionally based on DC total amounts
    const grandTotal = dcAllocations.reduce((sum, dc) => sum + dc.total_amount, 0);
    if (grandTotal <= 0) return;

    setDcAllocations(prev => prev.map(dc => ({
      ...dc,
      allocated_amount: Math.round((dc.total_amount / grandTotal) * quotationTotal * 100) / 100,
    })));
  }, [calculations?.grandTotal, isMultiDC]);

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
      toast.error('Please save the quotation first before requesting approval.');
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
      toast.error('Failed to request approval', { description: err.message });
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
      setFormData({
        id: isDuplicate ? '' : (data.id || ''),
        quotation_no: isDuplicate ? '' : (data.quotation_no || ''),
        revision_no: isDuplicate ? 1 : (data.revision_no || 1),
        revision_history: isDuplicate ? [] : (data.revision_history || []),
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
        authorized_signatory_id: (() => {
          const val = data.authorized_signatory_id;
          // Only accept if it's a valid UUID format (not a number string like "1777960083410")
          if (val && val.length > 0 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
            return String(val);
          }
          return null;
        })(),
        include_erection_charges: data.include_erection_charges !== undefined ? data.include_erection_charges : true
      });

      if (data.items) {
        const mappedItems = data.items.map(item => {
          // Better erection detection - precise logic
          const isErection = (item.item_id === null && item.sac_code !== null) || 
                           (item.description && item.description.includes(' - Erection'));
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

      // Load existing DC allocations if this is a multi-DC quotation
      if (data.multi_dc_mode && !isDuplicate) {
        const { data: dcLinks } = await supabase
          .from('quotation_dc_links')
          .select('delivery_challan_id, allocated_amount, dc:delivery_challans(id, dc_number, dc_date, items:delivery_challan_items(amount))')
          .eq('quotation_id', id);

        if (dcLinks && dcLinks.length > 0) {
          const allocations = dcLinks.map((link: any) => {
            const totalAmount = (link.dc?.items || []).reduce((sum: number, item: any) => sum + (parseFloat(String(item.amount)) || 0), 0);
            return {
              dc_id: link.delivery_challan_id,
              dc_number: link.dc?.dc_number || '',
              dc_date: link.dc?.dc_date || '',
              total_amount: totalAmount,
              allocated_amount: Number(link.allocated_amount),
            };
          });
          setDcAllocations(allocations);
        }
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
    setUseArcPricing(false);
    setArcPricingMap({});

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

      if (items.length > 0) {
        setDiscountConfirm({
          portfolio,
          clientName: client?.display_name || client?.name || 'this client'
        });
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

    // Check if ARC pricing is active and exists for this client + material
    if (useArcPricing && arcPricingMap[material.id]) {
      const arcRate = getArcRateFromMap(arcPricingMap, material.id, variantId);
      if (arcRate !== null) {
        return arcRate;
      }
    }

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
        uom: material.unit,
        tax_percent: material.gst_rate || 0,
        discount_percent: 0,
        description: ''
      }]);
    }
  };

  const handleItemCreateSuccess = useCallback((newItem) => {
    // ...
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
    queryClient.invalidateQueries({ queryKey: ['quotationInit'] });
    
    // Optionally, you can add the new item to the current quotation
    // This is commented out for now, but you can enable it if needed
    /*
    const newQuotationItem = {
      id: Date.now() + Math.random(),
      item_id: newItem.id,
      material: newItem,
      qty: 1,
      rate: getRateForMaterialVariant(newItem, null),
      uom: newItem.unit,
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
      itemsTableRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    }, 50);
  };

  const handleGenerateQuickQuote = () => {
    if (!quickQuoteConfig || !quickQuoteTemplateId) {
      toast.warning('Quick Quote template is not configured yet.');
      return;
    }
    if (!quickQuoteSize.trim()) {
      toast.warning('Please enter a size for Quick Quote.');
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
      toast.info('No matching items found for the selected Quick Quote inputs.');
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
      itemsTableRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
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
            updates.uom = mat.unit || '';
            updates.tax_percent = mat.gst_rate || 0;
            
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
              console.warn('Erection auto-creation warning:', err.message);
            });
          }
        }

        return updatedItem;
      })
    );
  };

  const removeItem = useCallback((id) => {
    const linkedErection = items.find(item => item.linked_material_id === id);
    
    if (linkedErection) {
      const erectionTotal = ((linkedErection.qty || 0) * (linkedErection.rate || 0)).toFixed(2);
      setConfirmDialog({
        open: true,
        title: 'Delete Material & Erection Charges',
        description: `This material has linked erection charges (₹${erectionTotal}). Deleting will remove both the material and its erection charge row.`,
        confirmLabel: 'Delete Both',
        destructive: true,
        onConfirm: () => {
          setItems(prev => {
            const filtered = prev.filter(item => item.id !== id && item.id !== linkedErection.id);
            return filtered.map((item, index) => ({
              ...item,
              display_order: index + 1
            }));
          });
          setIsDirty(true);
          setConfirmDialog(null);
        }
      });
      return;
    }
    
    setItems(prev => {
      const filtered = prev.filter(item => item.id !== id);
      return filtered.map((item, index) => ({
        ...item,
        display_order: index + 1
      }));
    });
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
        qty: null,
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

  const addSubtotal = (afterIndex?: number) => {
    const rowId = Date.now() + Math.random();
    setItems((prev) => {
      const newItems = [...prev];
      const insertIndex = afterIndex !== undefined ? afterIndex + 1 : newItems.length;
      newItems.splice(insertIndex, 0, {
        id: rowId,
        item_id: null,
        variant_id: null,
        description: '',
        qty: null,
        uom: '',
        rate: 0,
        discount_percent: 0,
        discount_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        line_total: 0,
        is_subtotal: true,
        subtotal_label: '',
        display_order: insertIndex
      });
      return newItems.map((item, idx) => ({ ...item, display_order: idx }));
    });
  };

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowId: number } | null>(null);

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

  const handleSave = async (saveAndNew = false) => {
    if (saving) return;
    // --- Pre-flight validation (before setting saving=true) ---
    if (!formData.client_id) {
      toast.error('Please select a client');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
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
        toast.error('Session expired', { description: 'Please refresh the page and log in again.' });
        return;
      }

      const needsApproval = !editId;
      let quotationId = editId;

      const quotationData = {
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        billing_address: formData.billing_address,
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
        multi_dc_mode: isMultiDC ? (multiDCModeParam || 'single-total') : null,
      };

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

        if (formData.terms_conditions || formData.terms_text) {
          supabase.from('quotation_terms_conditions').insert({
            quotation_id: quotationId,
            organisation_id: organisation?.id,
            custom_content: JSON.stringify(formData.terms_conditions || { text: formData.terms_text }),
            template_id: formData.terms_conditions?.id || null,
            is_custom: true
          }).then().catch(err => console.error('Error saving terms:', err));
        }

        // Update series after successful insert (fire and forget - don't await)
        if (defaultSeries) {
          const nextNo = getQuoteSeriesNumber(defaultSeries) + 1;
          const cfg = defaultSeries?.configs || {};
          const quoteCfg = cfg.quote || {};
          const updatedCfg = { ...cfg, quote: { ...quoteCfg, start_number: nextNo } };
          supabase.from('document_series').update({ current_number: nextNo, configs: updatedCfg }).eq('id', defaultSeries.id).then();
        }
      }

const itemsToInsert = items.map(item => ({
          quotation_id: quotationId,
          item_id: item.item_id || null,
          variant_id: item.variant_id || null,
          make: item.make || null,
          description: item.description,
          qty: item.is_header || item.is_subtotal ? null : (parseFloat(item.qty) || 1),
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
          is_header: item.is_header || false,
          is_subtotal: item.is_subtotal || false,
          subtotal_label: item.subtotal_label || null,
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

      // Save DC links for multi-DC conversion
      if (isMultiDC && quotationId && dcAllocations.length > 0) {
        // Validate allocated amount matches quotation total (₹1 tolerance)
        const totalAllocated = dcAllocations.reduce((sum, dc) => sum + dc.allocated_amount, 0);
        const quotationTotal = calculations.grandTotal || 0;
        if (Math.abs(totalAllocated - quotationTotal) > 1) {
          throw new Error(`Allocated amount (₹${totalAllocated.toFixed(2)}) does not match quotation total (₹${quotationTotal.toFixed(2)}). Please adjust allocations.`);
        }

        // Save junction table links
        const links = dcAllocations.map(dc => ({
          quotation_id: quotationId,
          delivery_challan_id: dc.dc_id,
          allocated_amount: dc.allocated_amount,
        }));

        await supabase.from('quotation_dc_links').delete().eq('quotation_id', quotationId);
        const { error: linkError } = await supabase.from('quotation_dc_links').insert(links);
        if (linkError) throw linkError;

        // Mark DCs as quoted
        const dcIdArray = dcAllocations.map(dc => dc.dc_id);
        await supabase
          .from('delivery_challans')
          .update({ conversion_status: 'quoted' })
          .in('id', dcIdArray)
          .in('conversion_status', ['active', 'pending_conversion']);
      }


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
      queryClient.invalidateQueries({ queryKey: ['quotation', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotation_items', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotation-terms', quotationId] });

      if (needsApproval && !editId && quotationId) {
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

      // alert removed

      if (saveAndNew) {
        toast.success('Quotation saved as draft!');
        setSaving(false);
        return;
      } else {
        navigate(`/quotation/view?id=${quotationId}`);
      }
    } catch (err) {
      console.error('Error saving quotation:', err);
      const errMsg = (err as any)?.message || String(err || '');
      if (/session|jwt|token|refresh_token|invalid_grant|not authenticated|auth/i.test(errMsg)) {
        toast.error('Session expired', { description: 'Please refresh the page and log in again.' });
      } else {
        toast.error('Save failed', { description: errMsg });
      }
    } finally {
      setSaving(false);
    }
  };

  const compactFieldStyle = { minHeight: '36px', padding: '4px 8px', fontSize: '12px' };
  const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle = { minWidth: '70px', maxWidth: '70px', fontWeight: 600, fontSize: '11px', color: '#374151' };
  const fieldColStyle = { flex: 1 };
  const sectionHeaderStyle = { fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '2px' };
  const inputStyle = { padding: '4px 8px', fontSize: '12px' };

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
      <div ref={headerRef} className="flex items-center justify-between fixed top-0 left-0 right-0 z-50 bg-white pt-4 pb-3 border-b border-zinc-200" style={{ top: '32px', marginBottom: 0 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            {editId ? 'Edit Quotation' : duplicateId ? 'Duplicate Quotation' : 'Create New Quotation'}
          </h1>
          {editId && formData.revision_no > 1 && (
            <span className="px-2 py-1 text-xs font-bold bg-amber-100 text-amber-700 rounded">
              Rev. {formData.revision_no}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pr-4 border-r border-zinc-200">
            <label className="relative inline-flex items-center cursor-pointer group">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={formData.negotiation_mode}
                onChange={async (e) => {
if (e.target.checked && editId && !formData.negotiation_mode) {
                    setConfirmDialog({
                      open: true,
                      title: 'Enable Negotiation Mode',
                      description: `This will save the current quotation as Revision ${formData.revision_no} before making changes. Continue?`,
                      confirmLabel: 'Enable',
                      onConfirm: async () => {
                        setConfirmDialog(null);
                        const result = await saveCurrentRevision();
                        if (!result) {
                          toast.error('Failed to save revision. Please try again.');
                          return;
                        }
                        setFormData(prev => ({ 
                          ...prev, 
                          revision_no: result.newRevisionNo,
                          revision_history: result.newHistory,
                          negotiation_mode: true,
                          status: 'Under Negotiation'
                        }));
                      }
                    });
                    return;
                  } else {
                    setFormData(prev => ({ 
                      ...prev, 
                      negotiation_mode: e.target.checked, 
                      status: e.target.checked ? 'Under Negotiation' : prev.status 
                    }));
                  }
                }}
              />
              <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              <span className="ms-3 text-sm font-medium text-zinc-700 group-hover:text-sky-700 transition-colors">Negotiation Mode</span>
            </label>
            {(formData.revision_history?.length > 0) && (
              <button
                type="button"
                className="text-xs font-medium text-blue-600 hover:text-blue-800 underline ml-2"
                onClick={() => setRevisionDialogOpen(true)}
              >
                View History ({formData.revision_history?.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="h-9 px-2 text-xs font-semibold border border-zinc-300 bg-white text-zinc-700 focus:border-blue-500 focus:outline-none min-w-[100px]"
              title="Quotation status"
            >
              <option value="Draft">Draft</option>
              <option value="Sent">Sent to Client</option>
            </select>
            <button
              type="button"
              className="h-9 px-10 min-w-[100px] rounded flex items-center justify-center text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-all"
              onClick={() => navigate('/quotation')}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`h-9 px-10 min-w-[100px] rounded flex items-center justify-center text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-all ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              className={`h-9 px-10 min-w-[100px] rounded flex items-center justify-center text-xs font-bold transition-all ${
                formData.status === 'Sent'
                  ? 'text-emerald-600 hover:text-emerald-700'
                  : 'text-blue-600 hover:text-blue-700'
              } ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : editId
                  ? formData.status === 'Sent' ? 'Update & Submit' : 'Update Quotation'
                  : formData.status === 'Sent' ? 'Submit to Client' : 'Confirm & Save'}
            </button>
          </div>
        </div>
      </div>
      <div style={{ paddingTop: headerHeight }}>
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm">
        </div>

        {/* Document Details Grid */}
        <div style={{ background: '#f8f9fa', padding: '10px', marginBottom: '10px', borderRadius: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 16px' }}>

            {/* Column 1: DOCUMENT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={sectionHeaderStyle}>Document</div>
              <div style={{ ...headerFieldStyle, marginBottom: '8px' }}>
                <span style={labelColStyle}>Quote No:</span>
                <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', width: '45%' }}>{formData.quotation_no || quoteNoPreview || 'Auto-generating...'}</div>
                  <span style={{ fontWeight: 600, fontSize: '11px', color: '#374151', minWidth: '40px' }}>Date:</span>
                  <input type="date" className="form-input" style={{ ...inputStyle, flex: 1 }} value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                </div>
              </div>
              {renderHeaderField('Prepared By:', <input type="text" className="form-input" style={inputStyle} value={formData.prepared_by || ''} onChange={(e) => setFormData({ ...formData, prepared_by: e.target.value })} placeholder="Sales executive..." />)}
              {renderHeaderField('Valid Till:', <input type="date" className="form-input" style={inputStyle} value={formData.valid_till} onChange={(e) => setFormData({ ...formData, valid_till: e.target.value })} />)}
              {renderHeaderField('Variant:', <select className="form-select" style={inputStyle} value={formData.variant_id} onChange={(e) => {
                const newVariantId = e.target.value;
                setFormData({ ...formData, variant_id: newVariantId });
                if (items.length > 0) {
                  setItems(prev => prev.map(item => {
                    if (item.is_header || item.is_subtotal || item.section === 'erection') return item;
                    const mat = materials.find(m => m.id === item.item_id);
                    if (!mat) return { ...item, variant_id: newVariantId || null };
                    const newRate = getRateForMaterialVariant(mat, newVariantId || null, item.make || '');
                    const variantDiscount = newVariantId ? (headerDiscounts[newVariantId] || 0) : 0;
                    const finalRate = calculateVariantDiscountedRate(newRate, variantDiscount);
                    return { ...item, variant_id: newVariantId || null, base_rate_snapshot: newRate, discount_percent: variantDiscount, applied_discount_percent: variantDiscount, rate: finalRate, final_rate_snapshot: finalRate, is_override: false };
                  }));
                }
              }}>
                <option value="">Standard</option>
                {variants.map(v => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}
              </select>)}
              {renderHeaderField('Reference:', <input type="text" className="form-input" style={inputStyle} value={formData.reference || ''} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} placeholder="Client RFQ No..." />)}
              {renderHeaderField('Payment:', <input type="text" className="form-input" style={inputStyle} value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} placeholder="Net 30 Days" />, true)}
            </div>

            {/* Column 2: CLIENT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={sectionHeaderStyle}>Client</div>
              <div style={{ ...headerFieldStyle, marginBottom: '8px' }}>
                <span style={labelColStyle}>Client:</span>
                <div style={{ ...fieldColStyle, position: 'relative' }} className="client-dropdown-container">
                  <input
                    type="text"
                    className="form-input"
                    style={inputStyle}
                    placeholder="Search or select..."
                    value={clientSearch || (formData.client_id ? clients.find(c => c.id === formData.client_id)?.client_name : '')}
                    onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); }}
                    onClick={() => setIsClientDropdownOpen(true)}
                    onFocus={() => setIsClientDropdownOpen(true)}
                  />
                  {isClientDropdownOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                      {clients
                        .filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase()))
                        .map(c => (
                          <div key={c.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            onClick={() => { handleClientChange(c.id); setClientSearch(c.client_name); setIsClientDropdownOpen(false); setClientSearch(''); }}
                          >{c.client_name}</div>
                        ))}
                      {clients.filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                        <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No clients found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {formData.client_id && (
                <div style={{ ...headerFieldStyle, marginBottom: '8px' }}>
                  <span style={labelColStyle}>Pricing:</span>
                  <div style={{ ...fieldColStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ArcPricingToggle
                        clientId={formData.client_id}
                        enabled={useArcPricing}
                        onChange={(enabled) => {
                          if (enabled && items.filter(i => !i.is_header && !i.is_subtotal).length > 0) {
                            setArcPricingConfirmOpen(true);
                          } else {
                            setUseArcPricing(enabled);
                            if (!enabled) {
                              setArcPricingMap({});
                              // Revert all rates to standard rates
                              setItems(prev => prev.map(item => {
                                if (item.is_header || item.is_subtotal || item.section === 'erection') return item;
                                if (!item.item_id) return item;
                                const mat = materials.find(m => m.id === item.item_id);
                                if (!mat) return item;
                                const stdRate = getRateForMaterialVariant(mat, item.variant_id, item.make);
                                const discountPercent = parseFloat(item.discount_percent) || 0;
                                const finalRate = stdRate - (stdRate * discountPercent / 100);
                                return {
                                  ...item,
                                  base_rate_snapshot: stdRate,
                                  rate: finalRate,
                                  final_rate_snapshot: finalRate,
                                  applied_discount_percent: discountPercent
                                };
                              }));
                            }
                          }
                        }}
                      />
                      <ArcPricingStatusBadge
                        totalItems={items.filter(i => !i.is_header && !i.is_subtotal).length}
                        itemsWithArcRate={items.filter(i => !i.is_header && !i.is_subtotal && i.item_id && arcPricingMap[i.item_id]?.length > 0).length}
                        itemsWithoutArcRate={items.filter(i => !i.is_header && !i.is_subtotal && i.item_id && (!arcPricingMap[i.item_id] || arcPricingMap[i.item_id].length === 0)).length}
                      />
                    </div>
                    {useArcPricing && arcPricingQuery.isLoading && (
                      <span style={{ fontSize: '11px', color: '#737373', display: 'block' }}>Loading ARC rates...</span>
                    )}
                  </div>
                </div>
              )}
              {renderHeaderField('Contact:', <input type="text" className="form-input" style={inputStyle} value={formData.client_contact} onChange={(e) => setFormData({ ...formData, client_contact: e.target.value })} placeholder="+91 98765 43210" />)}
              {renderHeaderField('Address:', <textarea className="form-input" style={{ ...inputStyle, minHeight: '40px', resize: 'vertical' }} value={formData.billing_address} onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })} placeholder="Full billing address..." />)}
              {renderHeaderField('GSTIN:', <input type="text" className="form-input" style={inputStyle} value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} placeholder="27AABCU9603R1ZX" />)}
              {renderHeaderField('State:', <select className="form-select" style={inputStyle} value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })}>
                <option value="">Select state...</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>, true)}
            </div>

            {/* Column 3: PROJECT & DISCOUNTS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={sectionHeaderStyle}>Project</div>
              {renderHeaderField('Project:', <select className="form-select" style={inputStyle} value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}>
                <option value="">Select project...</option>
                {projects.filter((p) => !formData.client_id || p.client_id === formData.client_id).map((p) => (
                  <option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>
                ))}
              </select>)}
              
              {/* Discounts */}
              <div style={{ marginTop: '4px' }}>
                <div style={{ ...sectionHeaderStyle, marginBottom: '6px' }}>Discounts</div>
                {activeTab === 'items' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px' }}>
                    {(() => {
                      const renderVariants = [...variants];
                      if (formData.include_erection_charges) {
                        renderVariants.push({ id: 'erection', variant_name: 'ERECTION CHARGES' });
                      }
                      return renderVariants.length > 0 ? renderVariants.map((variant) => {
                        const approvalDisplay = getApprovalDisplayStatus(variant.id);
                        return (
                          <div key={variant.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', padding: '4px 8px', fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                            <span style={{ fontWeight: 600, color: '#374151', marginRight: '4px', fontSize: '10px' }}>{variant.variant_name}</span>
                            {approvalDisplay !== 'none' && (
                              <span style={{ fontSize: '8px', padding: '1px 4px', fontWeight: 700, borderRadius: '2px', marginRight: '4px', background: approvalDisplay === 'approved' ? '#10b981' : approvalDisplay === 'pending' ? '#f59e0b' : '#ef4444', color: 'white' }}>
                                {approvalDisplay === 'approved' ? 'App' : approvalDisplay === 'pending' ? 'Pend' : 'Rej'}
                              </span>
                            )}
                            <input type="number" style={{ width: '40px', padding: '2px 4px', fontSize: '11px', fontWeight: 700, textAlign: 'right', border: '1px solid #e5e7eb', borderRadius: '2px' }}
                              value={headerDiscounts[variant.id] || 0}
                              onChange={(e) => { const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setHeaderDiscounts(prev => ({ ...prev, [variant.id]: val })); }}
                              onBlur={(e) => { const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); handleHeaderDiscountChange(variant.id, val); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                              min="0" max="100" step="0.01"
                            />
                            <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '2px' }}>%</span>
                          </div>
                        );
                      }) : <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>No variants available.</div>;
                    })()}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>Approval history shown below.</div>
                )}
              </div>

              {/* Erection toggle */}
              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" className="form-checkbox" style={{ width: '14px', height: '14px' }}
                  checked={formData.include_erection_charges}
                  onChange={(e) => setFormData({ ...formData, include_erection_charges: e.target.checked })}
                />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Erection Charges</span>
              </div>
            </div>

          </div>
        </div>

      {/* Multi-DC Allocation Section */}
      {isMultiDC && dcAllocations.length > 0 && (
        <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-8">
          <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-none"></div>
              <h3 className="text-lg font-bold text-zinc-900">DC Allocation</h3>
              <span className="text-xs font-medium text-zinc-500 ml-2">
                {dcAllocations.length} DC(s) • Mode: {multiDCModeParam || 'single-total'}
              </span>
            </div>
          </div>
          <div className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-2 font-semibold text-zinc-700">DC Number</th>
                  <th className="text-left py-2 font-semibold text-zinc-700">DC Date</th>
                  <th className="text-right py-2 font-semibold text-zinc-700">DC Total</th>
                  <th className="text-right py-2 font-semibold text-zinc-700">Allocated Amount</th>
                </tr>
              </thead>
              <tbody>
                {dcAllocations.map(dc => (
                  <tr key={dc.dc_id} className="border-b border-zinc-100">
                    <td className="py-2 font-medium text-zinc-900">{dc.dc_number}</td>
                    <td className="py-2 text-zinc-600">{dc.dc_date ? format(new Date(dc.dc_date), 'dd/MM/yyyy') : '-'}</td>
                    <td className="py-2 text-right tabular-nums">₹{dc.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 text-right tabular-nums">
                      <input
                        type="number"
                        className="w-32 text-right border border-zinc-200 rounded px-2 py-1 text-sm"
                        value={dc.allocated_amount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setDcAllocations(prev => prev.map(d =>
                            d.dc_id === dc.dc_id ? { ...d, allocated_amount: val } : d
                          ));
                        }}
                        step="0.01"
                      />
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={2} className="py-2 text-right">Total Allocated:</td>
                  <td className="py-2 text-right tabular-nums">
                    ₹{dcAllocations.reduce((sum, dc) => sum + dc.total_amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    ₹{dcAllocations.reduce((sum, dc) => sum + dc.allocated_amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
            {multiDCError && (
              <div className="mt-3 text-sm text-red-600 font-medium">{multiDCError}</div>
            )}
            <div className="mt-3 text-xs text-zinc-500">
              Quotation Total: ₹{(calculations?.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              {Math.abs(dcAllocations.reduce((sum, dc) => sum + dc.allocated_amount, 0) - (calculations?.grandTotal || 0)) > 1 && (
                <span className="ml-2 text-red-600 font-medium">
                  (Difference: ₹{Math.abs(dcAllocations.reduce((sum, dc) => sum + dc.allocated_amount, 0) - (calculations?.grandTotal || 0)).toFixed(2)})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-8" ref={itemsTableRef}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-sky-600 rounded-none"></div>
            <h3 className="text-lg font-bold text-zinc-900">Line Items</h3>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-none">
              {items.length} {items.length === 1 ? 'Item' : 'Items'} Total
            </span>
</div>
          
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setShowItemCreateDrawer(true)}
              className="h-9 min-w-[100px] px-4 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              Add Material
            </button>
            <div className="w-px h-6 bg-zinc-200 mx-2"></div>
            <button className="h-9 min-w-[90px] px-3 text-xs font-semibold text-zinc-600 hover:text-blue-600 transition-all" onClick={addEmptyItemRow}>+ Add Row</button>
            <button className="h-9 min-w-[90px] px-3 text-xs font-semibold text-zinc-600 hover:text-blue-600 transition-all" onClick={addSectionHeader}>+ Add Section</button>
            <button className="h-9 min-w-[90px] px-3 text-xs font-semibold text-amber-700 hover:text-amber-800 transition-all" onClick={() => addSubtotal()}>+ Add Sub-total</button>
            <div className="w-px h-6 bg-zinc-200 mx-1"></div>
            <button className="h-9 min-w-[120px] px-3 text-xs font-semibold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5" onClick={() => setShowItemPicker(true)}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              Multiple Items
            </button>
            <div className="w-px h-6 bg-zinc-200 mx-1"></div>
            <button className="h-9 min-w-[90px] px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-700 transition-all flex items-center justify-center gap-1.5" onClick={() => setShowCustomLabelEditor(true)}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              Columns
            </button>
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
                  <td colSpan={getVisibleColumnCount()} className="cell-static text-center" style={{ padding: '48px', color: '#94a3b8', fontSize: '14px' }}>No items added. Click "Add Row" or "Add Multiple Items".</td>
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
                  const itemCountBefore = items.slice(0, index).filter(i => !i.is_header && !i.is_subtotal).length;
                  if (item.is_header) {
                    return (
                      <tr 
                        key={item.id} 
                        style={{ background: '#f8fafc' }}
                      >
                        <td colSpan={getVisibleColumnCount()} style={{ padding: '6px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <input
                              type="text"
                              className="cell-input"
                              style={{ flex: 1, fontWeight: 'bold', color: '#1e293b', background: 'transparent', border: 'none', borderBottom: '1px dashed #cbd5e1', fontSize: '14px', textAlign: 'left' }}
                              placeholder="Enter Section Header (e.g. First Floor Piping)..."
                              value={item.description}
                              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            />
                            <button type="button" className="btn-delete" onClick={() => removeItem(item.id)} style={{ flexShrink: 0, marginLeft: 8 }}>×</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  
                  // Sub-total row
                  if (item.is_subtotal) {
                    const groupLabel = item.subtotal_label || 'Sub-total:';
                    const groupAmount = calculations.subTotalGroups?.[groupLabel] || 0;
                    return (
                      <tr 
                        key={item.id} 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnRow(e, item.id)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragEnd={handleDragEnd}
                        className={draggingItemId === item.id ? 'row-dragging' : ''}
                        style={{ background: '#fef9c3', borderTop: '2px solid #eab308', cursor: 'grab' }}
                      >
                        <td colSpan={getVisibleColumnCount()} style={{ padding: '6px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', gap: '16px' }}>
                            <input
                              type="text"
                              className="cell-input"
                              style={{ maxWidth: '240px', fontWeight: 'bold', color: '#b45309', background: 'transparent', border: 'none', borderBottom: '1px dashed #f59e0b', fontSize: '13px', textAlign: 'right' }}
                              placeholder="Sub-total label..."
                              value={item.subtotal_label || ''}
                              onChange={(e) => {
                                updateItem(item.id, 'subtotal_label', e.target.value);
                                updateItem(item.id, 'description', e.target.value);
                              }}
                            />
                            <span className="text-right font-bold" style={{ color: '#b45309', whiteSpace: 'nowrap', minWidth: '100px', textAlign: 'right' }}>
                              {formatCurrency(groupAmount)}
                            </span>
                            <button type="button" className="btn-delete" onClick={() => removeItem(item.id)}>×</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr 
                      key={item.id} 
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnRow(e, item.id)}
                      onFocus={(e) => {
                        if ((e.target as HTMLElement).closest('.btn-delete')) return;
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
                         style={{ fontSize: '13px' }}
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
                        <SearchableItemSelect
                          value={item.item_id}
                          materials={materials}
                          onChange={(materialId, mat) => {
                            updateItem(item.id, 'item_id', materialId);
                            if (mat) {
                              updateItem(item.id, 'material', mat);
                              updateItem(item.id, 'hsn_code', mat.hsn_code || '');
                              updateItem(item.id, 'description', '');
                              updateItem(item.id, 'tax_percent', mat.gst_rate || 0);
                              const firstMake = itemMakes[mat.id]?.[0] || '';
                              updateItem(item.id, 'make', firstMake);
                              const newRate = getRateForMaterialVariant(mat, item.variant_id || null, firstMake);
                              updateItem(item.id, 'base_rate_snapshot', newRate);
                              const finalRate = calculateVariantDiscountedRate(newRate, item.applied_discount_percent || 0);
                              updateItem(item.id, 'rate', finalRate);
                            }
                          }}
                        />
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
                        <InlineDescriptionCell
                          materialName=""
                          description={item.description}
                          onSave={(desc) => updateItem(item.id, 'description', desc)}
                        />
                      </td>
                      )}
                      {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
                        <td className="col-shrink cell-static">
                          <div style={{ fontSize: '12px', color: '#64748b', padding: '4px', textAlign: 'center' }}>
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
                          <div style={{ fontSize: '12px', color: '#64748b', padding: '4px' }}>
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
                        <input type="number" className="cell-input text-right" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} min="0" style={{appearance: 'textfield'}} />
                      </td>
                      <td className="col-shrink">
                        <input type="text" className="cell-input text-center" value={item.uom} onChange={(e) => updateItem(item.id, 'uom', e.target.value)} />
                      </td>
                      <td className="col-shrink" style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            {useArcPricing && item.item_id && (() => {
                              const arcRate = getArcRateFromMap(arcPricingMap, item.item_id, item.variant_id);
                              if (arcRate !== null) {
                                return <ArcRateBadge arcRate={arcRate} originalRate={item.base_rate_snapshot} />;
                              }
                              return <StandardRateBadge />;
                            })()}
                            <input 
                              type="number" 
                              className="cell-input text-right" 
                              value={item.base_rate_snapshot || 0} 
                              onChange={(e) => {
                                const newBaseRate = Math.max(0, parseFloat(e.target.value) || 0);
                                const disc = item.discount_percent || 0;
                                const finalRate = newBaseRate - (newBaseRate * disc / 100);
                                updateItem(item.id, 'base_rate_snapshot', newBaseRate);
                                updateItem(item.id, 'rate', finalRate);
                                updateItem(item.id, 'is_override', true);
                                updateItem(item.id, 'applied_discount_percent', disc);
                              }}
                              style={{ flex: 1, minWidth: '60px', background: item.is_override ? '#fef3c7' : '#f8fafc', border: item.is_override ? '1px solid #f59e0b' : '' }}
                            />
                            {/* Under-billing warning icon if entered rate < last invoiced rate */}
                            {(() => {
                              if (!item.item_id) return null;
                              const normalizedVariant = item.variant_id && item.variant_id !== '' ? item.variant_id : 'no_variant';
                              const itemKey = `${item.item_id}_${normalizedVariant}`;
                              const liRate = lastRatesMap[itemKey]?.lastInvoiced?.baseRate;
                              if (liRate !== undefined && (parseFloat(item.base_rate_snapshot) || 0) < liRate) {
                                return (
                                  <span 
                                    style={{ color: '#d97706', cursor: 'help', display: 'inline-flex', alignItems: 'center', marginLeft: '2px' }} 
                                    title={`Warning: Entered rate (₹${parseFloat(item.base_rate_snapshot) || 0}) is lower than the last invoiced rate (₹${liRate}) for this client.`}
                                  >
                                    ⚠️
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          
                          {/* Historical Rate Badges */}
                          {item.item_id && (() => {
                            const normalizedVariant = item.variant_id && item.variant_id !== '' ? item.variant_id : 'no_variant';
                            const itemKey = `${item.item_id}_${normalizedVariant}`;
                            const rates = lastRatesMap[itemKey];
                            if (!rates || (!rates.lastQuoted && !rates.lastInvoiced)) return null;
                            
                            return (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', fontSize: '9px', fontWeight: 500, marginTop: '2px' }}>
                                {rates.lastQuoted && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newBaseRate = rates.lastQuoted!.baseRate;
                                      const disc = item.discount_percent || 0;
                                      const finalRate = newBaseRate - (newBaseRate * disc / 100);
                                      updateItem(item.id, 'base_rate_snapshot', newBaseRate);
                                      updateItem(item.id, 'rate', finalRate);
                                      updateItem(item.id, 'is_override', true);
                                      updateItem(item.id, 'applied_discount_percent', disc);
                                      toast.success(`Applied last quoted rate of ₹${newBaseRate}`);
                                    }}
                                    style={{
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      background: '#fef3c7',
                                      color: '#b45309',
                                      border: '1px solid #fde68a',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={`Last Quoted: ₹${rates.lastQuoted.baseRate} in Quote ${rates.lastQuoted.docNo} on ${rates.lastQuoted.date}. Click to apply.`}
                                  >
                                    LQ: ₹{rates.lastQuoted.baseRate}
                                  </button>
                                )}
                                {rates.lastInvoiced && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newBaseRate = rates.lastInvoiced!.baseRate;
                                      const disc = item.discount_percent || 0;
                                      const finalRate = newBaseRate - (newBaseRate * disc / 100);
                                      updateItem(item.id, 'base_rate_snapshot', newBaseRate);
                                      updateItem(item.id, 'rate', finalRate);
                                      updateItem(item.id, 'is_override', true);
                                      updateItem(item.id, 'applied_discount_percent', disc);
                                      toast.success(`Applied last invoiced rate of ₹${newBaseRate}`);
                                    }}
                                    style={{
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      background: '#dbeafe',
                                      color: '#1d4ed8',
                                      border: '1px solid #bfdbfe',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={`Last Invoiced: ₹${rates.lastInvoiced.baseRate} in Invoice ${rates.lastInvoiced.docNo} on ${rates.lastInvoiced.date}. Click to apply.`}
                                  >
                                    LI: ₹{rates.lastInvoiced.baseRate}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_300px] gap-4">
        <div>
          <div className="card" style={{ padding: '12px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Notes & Remarks:</label>
            </div>
            <textarea 
              className="form-input" 
              style={{ width: '100%', height: 'calc(100% - 40px)', minHeight: '120px', fontSize: '13px', resize: 'none' }}
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
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
              >
                <FileText size={12} />
                {formData.terms_conditions ? 'Edit' : 'Add'}
              </button>
            </div>
            {formData.terms_conditions || formData.terms_text ? (
              <textarea
                className="form-input"
                style={{ width: '100%', height: 'calc(100% - 40px)', minHeight: '120px', fontSize: '13px', resize: 'none' }}
                placeholder="Type terms & conditions here, or use the drawer to add from a template..."
                value={formData.terms_text || ''}
                onChange={(e) => setFormData({ ...formData, terms_text: e.target.value })}
              />
            ) : (
              <textarea
                className="form-input"
                style={{ width: '100%', height: 'calc(100% - 40px)', minHeight: '120px', fontSize: '13px', resize: 'none' }}
                placeholder="Type terms & conditions here, or use the drawer to add from a template..."
                value={formData.terms_text || ''}
                onChange={(e) => setFormData({ ...formData, terms_text: e.target.value })}
              />
            )}
          </div>
        </div>
        <div className="card" style={{ padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
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
              <input type="number" className="form-input" style={{ width: '60px', textAlign: 'right', height: '36px', padding: '4px 8px', fontSize: '13px' }} value={formData.extra_discount_percent} onChange={(e) => setFormData({ ...formData, extra_discount_percent: e.target.value })} min="0" max="100" step="0.01" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Extra Discount Amt</span>
              <input type="number" className="form-input" style={{ width: '100px', textAlign: 'right', height: '36px', padding: '4px 8px', fontSize: '13px' }} value={formData.extra_discount_amount} onChange={(e) => setFormData({ ...formData, extra_discount_amount: e.target.value })} min="0" step="0.01" />
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
                <label htmlFor="roundOffToggle" style={{ fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>Round Off</label>
              </div>
              <input 
                type="number" 
                className="form-input" 
                style={{ 
                  width: '100px', 
                  textAlign: 'right', 
                  height: '36px', 
                  padding: '2px 4px', 
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
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700 }}>
              <span>Grand Total</span>
              <span>{formatCurrency(calculations.grandTotal)}</span>
            </div>
            <div style={{ color: '#1e293b', fontSize: '12px', fontStyle: 'italic', fontWeight: 600, textAlign: 'right', marginTop: '2px' }}>
              INR {calculations.amountInWords}
            </div>
            <div style={{ marginTop: '12px', padding: '12px', borderTop: '1px solid #e5e7eb', fontFamily: 'Inter, sans-serif' }}>
              <div className="flex items-center gap-3 bg-white border border-zinc-200 rounded-none px-3 py-2 shadow-sm">
                <div className="w-7 h-7 bg-sky-50 rounded-full flex items-center justify-center text-sky-600 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Authorized Signatory</span>
                  <select 
                    className="bg-transparent border-none p-0 text-xs font-bold text-zinc-800 focus:ring-0 cursor-pointer w-full"
                    value={formData.authorized_signatory_id ?? ''} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, authorized_signatory_id: val || '' });
                    }}
                  >
                    <option value="">Select Signatory...</option>
                    {(organisation?.signatures || []).length > 0 ? (
                      (organisation?.signatures || []).map((sig) => (
                        <option key={String(sig.id)} value={String(sig.id)}>{sig.name}</option>
                      ))
                    ) : (
                      <option disabled>No signatures - Add in Settings → Organisation</option>
                    )}
                  </select>
                  {(organisation?.signatures || []).length === 0 && (
                    <a href="/settings" target="_blank" className="text-[10px] text-blue-600 underline">Add signatures here</a>
                  )}
                </div>
              </div>
              {formData.authorized_signatory_id && formData.authorized_signatory_id !== null && (
                <div className="bg-white border border-zinc-200 rounded-none px-3 py-2 shadow-sm mt-2">
                  <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Signature Preview</div>
                  <div className="h-8 flex items-center">
                    {(() => {
                      const sigId = String(formData.authorized_signatory_id);
                      const selectedSig = (organisation?.signatures || []).find(s => String(s.id) === sigId);
                      if (selectedSig?.url) {
                        return <img src={selectedSig.url} alt={selectedSig.name} className="max-h-7 max-w-[120px] object-contain" />;
                      }
                      return <span className="text-zinc-400 text-[11px]">No signature preview</span>;
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
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
                          style={{ marginTop: '4px', height: '36px', fontSize: '13px' }}
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
          <div className="modal-content" style={{ maxWidth: '750px', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Select Items</h3>
              <button className="btn-close" onClick={() => setShowItemPicker(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '4px 8px' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                  <input 
                    type="text" 
                    className="form-input" 
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
                      {pickerTable.getRowModel().rows.map(row => {
                        const itemId = row.original?.id;
                        const isSelected = itemId && pickerItems.some(p => p.item_id === itemId);
                        return (
                          <tr 
                            key={row.id}
                            style={{ cursor: isSelected ? 'default' : 'pointer', background: isSelected ? '#f0fdf4' : '#fff' }}
                            onClick={() => {
                              if (itemId && !isSelected) {
                                handleAddItemToPicker(row.original);
                              }
                            }}
                          >
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ fontWeight: 500, color: '#1e293b' }}>{row.original?.display_name || row.original?.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{row.original?.item_code}</div>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#64748b' }}>
                              {row.original?.stock_on_hand ?? '-'}
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
              <button className="btn btn-secondary" onClick={() => setShowItemPicker(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddItemsToQuotation} disabled={pickerItems.length === 0}>Add to Quotation ({pickerItems.length})</button>
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
      
      <TermsConditionsDrawer
        isOpen={showTermsDrawer}
        onClose={() => setShowTermsDrawer(false)}
        quotationId={formData.id}
        onSave={(terms) => {
          setFormData({ ...formData, terms_conditions: terms, terms_text: terms.sections?.map((s: any) => `${s.title}\n${s.items?.map((i: any) => i.content).join('\n')}`).join('\n\n') || '' });
          setShowTermsDrawer(false);
        }}
      />

      <ArcConfirmationDialog
        open={arcPricingConfirmOpen}
        onClose={() => {
          setArcPricingConfirmOpen(false);
        }}
        onApplyAll={() => {
          setUseArcPricing(true);
          setArcPricingConfirmOpen(false);
          // Apply ARC rates to all items
          setItems(prev => prev.map(item => {
            if (item.is_header || item.is_subtotal || item.section === 'erection') return item;
            if (!item.item_id) return item;
            const rates = arcPricingMap[item.item_id];
            if (!rates || rates.length === 0) return item;
            const arcRate = getArcRateFromMap(arcPricingMap, item.item_id, item.variant_id);
            if (arcRate === null) return item;
            const discountPercent = parseFloat(item.discount_percent) || 0;
            const finalRate = arcRate - (arcRate * discountPercent / 100);
            return {
              ...item,
              base_rate_snapshot: arcRate,
              rate: finalRate,
              final_rate_snapshot: finalRate,
              applied_discount_percent: discountPercent
            };
          }));
        }}
        onApplySelected={(selectedIds) => {
          setUseArcPricing(true);
          setArcPricingConfirmOpen(false);
          // Apply ARC rates to selected items
          setItems(prev => prev.map(item => {
            if (item.is_header || item.is_subtotal || item.section === 'erection') return item;
            if (!item.item_id) return item;
            if (!selectedIds.includes(item.id)) return item;
            const rates = arcPricingMap[item.item_id];
            if (!rates || rates.length === 0) return item;
            const arcRate = getArcRateFromMap(arcPricingMap, item.item_id, item.variant_id);
            if (arcRate === null) return item;
            const discountPercent = parseFloat(item.discount_percent) || 0;
            const finalRate = arcRate - (arcRate * discountPercent / 100);
            return {
              ...item,
              base_rate_snapshot: arcRate,
              rate: finalRate,
              final_rate_snapshot: finalRate,
              applied_discount_percent: discountPercent
            };
          }));
        }}
        items={items.filter(i => !i.is_header && !i.is_subtotal && i.item_id).map((item: any, index: number) => {
          const arcRate = getArcRateFromMap(arcPricingMap, item.item_id, item.variant_id);
          return {
            id: item.id || `item-${index}`,
            description: item.description || `Item ${index + 1}`,
            currentRate: Number(item.rate) || 0,
            arcRate: arcRate,
            hasArcRate: arcRate !== null,
            variantId: item.variant_id,
            materialId: item.item_id,
          };
        })}
      />

      {confirmDialog && (
        <Dialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{confirmDialog.title}</DialogTitle>
              <DialogDescription>{confirmDialog.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium rounded-md ${confirmDialog.destructive ? 'text-red-600 hover:text-red-700' : 'text-blue-600 hover:text-blue-700'}`}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {discountConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)',
          }}
          onClick={() => setDiscountConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#f0f0f0',
              border: '1px solid #c4c4c4',
              boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
              width: '420px',
              fontFamily: '"Segoe UI", system-ui, sans-serif',
              fontSize: '13px',
              color: '#222',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '16px 20px 12px',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9v-2h2v2zm0-4H9V5h2v6z" fill="#f5a623"/>
              </svg>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Apply client discount profile?</span>
            </div>
            <div style={{ padding: '0 20px 16px', lineHeight: 1.5, color: '#444' }}>
              Apply <strong>{discountConfirm.clientName}</strong>&rsquo;s discount portfolio to all existing items? Row-level overrides will be reset.
            </div>
            <div
              style={{
                display: 'flex', justifyContent: 'flex-end', gap: '8px',
                padding: '12px 20px',
                borderTop: '1px solid #d4d4d4',
                background: '#e8e8e8',
              }}
            >
              <button
                onClick={() => setDiscountConfirm(null)}
                style={{
                  padding: '6px 18px',
                  border: '1px solid #b0b0b0',
                  background: '#f5f5f5',
                  color: '#222',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minWidth: '70px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e5e5e5'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const { portfolio } = discountConfirm;
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
                  setDiscountConfirm(null);
                }}
                style={{
                  padding: '6px 18px',
                  border: '1px solid #0066cc',
                  background: '#0066cc',
                  color: '#fff',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minWidth: '70px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#0052a3'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#0066cc'}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

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

      {revisionDialogOpen && (
        <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Revision History</DialogTitle>
            </DialogHeader>
            <div className="max-h-80 overflow-y-auto">
              {(formData.revision_history || []).length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-6">No revisions yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-zinc-600">Revision</th>
                      <th className="px-3 py-2 text-right font-semibold text-zinc-600">Grand Total</th>
                      <th className="px-3 py-2 text-right font-semibold text-zinc-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {formData.revision_history.map((rev: any, idx: number) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 font-medium">Rev {rev.revision_no}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(rev.header?.grand_total || 0)}</td>
                        <td className="px-3 py-2 text-right text-zinc-500">{rev.saved_at ? new Date(rev.saved_at).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <DialogFooter>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md"
                onClick={() => setRevisionDialogOpen(false)}
              >
                Close
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  );
}
