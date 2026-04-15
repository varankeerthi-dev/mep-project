import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { useQuery } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import { useMaterials } from '../hooks/useMaterials';
import { useClients } from '../hooks/useClients';
import { useProjects } from '../hooks/useProjects';
import { useVariants } from '../hooks/useVariants';
import { generateQuickQuoteItems } from '../quotation/quick-quote/engine';
import { loadQuickQuoteConfig, normalizeQuickQuoteConfig } from '../quotation/quick-quote/api';
import type { QuickQuoteConfig } from '../quotation/quick-quote/types';

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
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const duplicateId = searchParams.get('duplicateId');
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
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  
  const [templateSettings, setTemplateSettings] = useState(null);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showCustomLabelEditor, setShowCustomLabelEditor] = useState(false);
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

  const [formData, setFormData] = useState({
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
    status: 'Draft',
    negotiation_mode: false,
    authorized_signatory_id: ''
  });

  const [items, setItems] = useState([]);
  const itemsTableRef = useRef(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [isDirty, setIsDirty] = useState(false);

  const initQuery = useQuery({
    queryKey: ['quotationInit', organisation?.id],
    queryFn: async () => {
      const [pricing, settings, template, quickQuoteConfig] = await Promise.all([
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
            .maybeSingle(),
          'Quotation template',
        ),
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
            .maybeSingle(),
          'Quotation template',
        ),
        organisation?.id ? loadQuickQuoteConfig(organisation.id) : Promise.resolve(null),
      ]);

      return {
        clients,
        projects,
        materials,
        variants,
        pricing: pricing || [],
        settings: settings || [],
        template: template || null,
        quickQuoteConfig: quickQuoteConfig || null
      };
    },
  });

  const initLoading = initQuery.isPending && !initQuery.data;
  const initErrorMessage = initQuery.error instanceof Error ? initQuery.error.message : 'Unable to load quotation setup data.';

  useEffect(() => {
    if (!initQuery.data) return;

    const { pricing, settings, template, quickQuoteConfig } = initQuery.data;

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
    }
  }, [initQuery.data, editId, duplicateId]);

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
    const { data: defaultSeries } = await supabase
      .from('document_series')
      .select('configs, current_number')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

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
}, [buildQuoteNoFromSeries, editId]);

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
        setHeaderDiscounts(discountMap);
      }
    } catch (err) {
      console.warn('Unable to load variant discounts:', err);
    }
  };

  const handleHeaderDiscountChange = useCallback((variantId, newValue) => {
    const oldValue = headerDiscounts[variantId] || 0;
    const numValue = parseFloat(newValue) || 0;
    
    if (numValue === oldValue) return;
    
    const affectedItems = items.filter(item => 
      item.variant_id === variantId && !item.is_override
    );
    const overriddenItems = items.filter(item => 
      item.variant_id === variantId && item.is_override
    );
    
    const variant = variants.find(v => v.id === variantId);
    const variantName = variant?.variant_name || 'Unknown Variant';
    
    if (affectedItems.length > 0 || overriddenItems.length > 0) {
      setDiscountPopup({
        show: true,
        variantId,
        variantName,
        oldValue,
        newValue: numValue,
        affectedRows: affectedItems.length,
        overriddenRows: overriddenItems.length
      });
    } else {
      setHeaderDiscounts(prev => ({ ...prev, [variantId]: numValue }));
    }
  }, [headerDiscounts, items, variants]);

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
    const variantName = variant?.variant_name || 'Unknown Variant';
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
        remark: `Approval requested for ${variantName}: ${discountValue}% (max: ${settings.max}%)`
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
        if (item.variant_id === variantId && !item.is_override) {
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
      const hasVariantItems = items.some(item => item.variant_id === variantId);
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
            .maybeSingle();
          struct = data;
        }

        if (struct) {
          const { data: varSettings } = await supabase
            .from('discount_variant_settings')
            .select('variant_id, default_discount_percent, min_discount_percent, max_discount_percent')
            .eq('structure_id', struct.id);
          
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
          .select('*, items:quotation_items(*, item:materials(id, item_code, display_name, name, hsn_code, sale_price, unit))')
          .eq('id', id)
          .single(),
        'Quotation details',
      );
    } catch (error) {
      alert('Error loading quotation: ' + ((error as Error)?.message || 'Unknown error'));
      return;
    }

    if (data) {
      setFormData({
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
        reference: data.remarks || data.reference || '',
        prepared_by: data.prepared_by || '',
        extra_discount_percent: data.extra_discount_percent || 0,
        extra_discount_amount: data.extra_discount_amount || 0,
        round_off: data.round_off || 0,
        status: isDuplicate ? 'Draft' : (data.status || 'Draft'),
        negotiation_mode: isDuplicate ? false : (data.negotiation_mode || false),
        authorized_signatory_id: data.authorized_signatory_id || ''
      });

      if (data.items) {
        setItems(data.items.map(item => ({
          ...item,
          hsn_code: item.hsn_code || item.item?.hsn_code || null,
          id: Date.now() + Math.random(),
          base_rate_snapshot: parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0,
          applied_discount_percent: parseFloat(item.applied_discount_percent) || 0,
          is_override: item.is_override || false,
          final_rate_snapshot: parseFloat(item.final_rate_snapshot) || parseFloat(item.rate) || 0,
          display_order: item.display_order || 0,
          custom1: item.custom1 || '',
          custom2: item.custom2 || ''
        })));
      }
      
      await loadVariantDiscounts(id);
      
      const portfolio = await loadClientDiscountPortfolio(data.client_id);
      if (portfolio.settings && Object.keys(portfolio.settings).length > 0) {
        setDiscountSettings(prev => ({ ...prev, ...portfolio.settings }));
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
        tax_percent: material.gst_rate || 18,
        discount_percent: 0,
        description: material.display_name || material.name
      }]);
    }
  };

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

        return { ...item, ...updates };
      })
    );
  };

  const removeItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

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
    let subtotal = 0;
    let totalItemDiscount = 0;
    let totalTax = 0;

    items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const gross = qty * rate;
      const discountPercent = parseFloat(item.discount_percent) || 0;
      const discountAmount = (gross * discountPercent) / 100;
      const taxable = gross - discountAmount;
      const taxPercent = parseFloat(item.tax_percent) || 0;
      const taxAmount = (taxable * taxPercent) / 100;
      const lineTotal = taxable + taxAmount;

      subtotal += gross;
      totalItemDiscount += discountAmount;
      totalTax += taxAmount;

      item.line_total = lineTotal;
      item.tax_amount = taxAmount;
      item.discount_amount = discountAmount;
    });

    const afterItemDiscount = subtotal - totalItemDiscount;
    const extraDiscountPercent = parseFloat(formData.extra_discount_percent) || 0;
    const extraDiscountAmount = (afterItemDiscount * extraDiscountPercent) / 100;
    const extraDiscountManual = parseFloat(formData.extra_discount_amount) || 0;
    
    const isInterState = formData.state && companyState && 
                        formData.state.trim().toLowerCase() !== companyState.trim().toLowerCase();
    
    const cgst = isInterState ? 0 : totalTax / 2;
    const sgst = isInterState ? 0 : totalTax / 2;
    const igst = isInterState ? totalTax : 0;

    const subtotalAfterDiscounts = afterItemDiscount - extraDiscountAmount - extraDiscountManual;
    const grandTotal = subtotalAfterDiscounts + totalTax + (parseFloat(formData.round_off) || 0);

    return {
      subtotal,
      totalItemDiscount,
      extraDiscountAmount,
      cgst,
      sgst,
      igst,
      isInterState,
      totalTax,
      grandTotal,
      amountInWords: numberToWords(grandTotal)
    };
  }, [items, formData.extra_discount_percent, formData.extra_discount_amount, formData.round_off, formData.state, companyState]);

  const handleSave = async (saveAndNew = false) => {
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
        remarks: formData.reference || null,
        reference: formData.reference,
        prepared_by: formData.prepared_by || null,
        subtotal: calculations.subtotal,
        total_item_discount: calculations.totalItemDiscount,
        extra_discount_percent: parseFloat(formData.extra_discount_percent) || 0,
        extra_discount_amount: parseFloat(formData.extra_discount_amount) || 0,
        total_tax: calculations.totalTax,
        round_off: parseFloat(formData.round_off) || 0,
        grand_total: calculations.grandTotal,
        status: formData.status,
        negotiation_mode: formData.negotiation_mode,
        authorized_signatory_id: formData.authorized_signatory_id || null
      };

      let quotationId = editId;

      // OPTIMIZED: Fetch series data in parallel with header operation for new quotes
      const seriesQuery = !editId 
        ? supabase.from('document_series').select('*').eq('is_default', true).limit(1).maybeSingle()
        : Promise.resolve({ data: null });

      if (editId) {
        const { data: updatedHeader, error: updateError } = await withTimeout(
          supabase
            .from('quotation_header')
            .update(quotationData)
            .eq('id', editId)
            .select('id'),
          'updating quotation header'
        );
        if (updateError) throw updateError;
        if (!updatedHeader || updatedHeader.length === 0) {
          throw new Error('Quotation header not found for update or permission denied.');
        }
        quotationId = updatedHeader[0].id;
      } else {
        const [seriesResult] = await Promise.all([seriesQuery]);
        const defaultSeries = seriesResult?.data;
        
        let quotationNo = '';
        if (defaultSeries) {
          quotationNo = buildQuoteNoFromSeries(defaultSeries);
        } else {
          const { data: existing } = await supabase
            .from('quotation_header')
            .select('quotation_no')
            .order('created_at', { ascending: false })
            .limit(1);

          quotationNo = 'QT-0001';
          if (existing && existing.length > 0) {
            const lastNum = parseInt((existing[0].quotation_no || '').replace(/[^0-9]/g, ''), 10) || 0;
            quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
          }
        }

        const { data, error } = await withTimeout(
          supabase
            .from('quotation_header')
            .insert({ ...quotationData, quotation_no: quotationNo })
            .select(),
          'creating quotation header'
        );
        
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
        item_id: item.item_id,
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
        custom2: item.custom2 || ''
      }));

      const variantDiscountRecords = Object.entries(headerDiscounts).map(([variantId, discount]) => ({
        quotation_revision_id: quotationId,
        variant_id: variantId,
        header_discount_percent: parseFloat(discount) || 0
      }));

      // OPTIMIZED: Delete and insert in single batch - run all operations in parallel
      await Promise.all([
        supabase.from('quotation_items').delete().eq('quotation_id', quotationId),
        supabase.from('quotation_revision_variant_discount').delete().eq('quotation_revision_id', quotationId)
      ]);

      // Insert new items and discounts in parallel
      const insertPromises = [supabase.from('quotation_items').insert(itemsToInsert)];
      if (variantDiscountRecords.length > 0) {
        insertPromises.push(supabase.from('quotation_revision_variant_discount').insert(variantDiscountRecords));
      }
      await Promise.all(insertPromises);

      // alert removed
      
      if (saveAndNew) {
        setFormData({
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
          status: 'Draft',
          negotiation_mode: false,
          authorized_signatory_id: ''
        });
        setItems([]);
        setHeaderDiscounts({});
        await loadQuoteNoPreview();
      } else {
        navigate(`/quotation/view?id=${quotationId}`);
      }
    } catch (err) {
      console.error('Error saving quotation:', err);
      alert('Error: ' + err.message);
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
      <div className="page-header">
        <h1 className="page-title">{editId ? 'Edit Quotation' : duplicateId ? 'Duplicate Quotation' : 'Create Quotation'}</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.negotiation_mode}
              onChange={(e) => setFormData({ ...formData, negotiation_mode: e.target.checked, status: e.target.checked ? 'Under Negotiation' : formData.status })}
            />
            <span style={{ fontWeight: 500 }}>Negotiation Mode</span>
          </label>
        </div>
      </div>

      <div style={{ background: '#f8f9fa', padding: '8px', borderRadius: '4px', marginBottom: '4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr 1fr', gap: '6px 12px' }}>
          {renderHeaderField('Quote No:', (
            <input type="text" className="form-input" style={{ ...compactFieldStyle, background: '#f3f4f6' }} value={formData.quotation_no || quoteNoPreview || 'Auto'} readOnly />
          ))}
          {renderHeaderField('Date:', (
            <input type="date" className="form-input" style={compactFieldStyle} value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
          ))}
          {renderHeaderField('Client *:', (
            <select className="form-select" style={compactFieldStyle} value={formData.client_id} onChange={(e) => handleClientChange(e.target.value)}>
              <option value="">Select</option>
              {clients.map((c) => (<option key={c.id} value={c.id}>{c.client_name}</option>))}
            </select>
          ))}
          {renderHeaderField('Project:', (
            <select className="form-select" style={compactFieldStyle} value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}>
              <option value="">Select</option>
              {projects.filter((p) => !formData.client_id || p.client_id === formData.client_id).map((p) => (<option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>))}
            </select>
          ))}
          {renderHeaderField('Variant:', (
            <select className="form-select" style={compactFieldStyle} value={formData.variant_id || ''} onChange={(e) => setFormData({ ...formData, variant_id: e.target.value })}>
              <option value="">Select</option>
              {variants.map((v) => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}
            </select>
          ))}
          {renderHeaderField('Valid Till:', (
            <input type="date" className="form-input" style={compactFieldStyle} value={formData.valid_till} onChange={(e) => setFormData({ ...formData, valid_till: e.target.value })} />
          ))}
          {renderHeaderField('Payment:', (
            <input type="text" className="form-input" style={compactFieldStyle} value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} />
          ))}
          {renderHeaderField('Contact:', (
            <select className="form-select" style={compactFieldStyle} value={formData.client_contact || ''} onChange={(e) => setFormData({ ...formData, client_contact: e.target.value })} disabled={!formData.client_id}>
              <option value="">{formData.client_id ? 'Select' : 'Select Client First'}</option>
              {clientContactOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          ))}
          {renderHeaderField('Address:', (
            <input type="text" className="form-input" style={{ ...compactFieldStyle, minHeight: '50px', height: '50px' }} value={formData.billing_address || ''} onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })} placeholder="Billing Address" />
          ))}
          {renderHeaderField('State:', (
            <select className="form-select" style={compactFieldStyle} value={formData.state || ''} onChange={(e) => setFormData({ ...formData, state: e.target.value })}>
              <option value="">Select</option>
              {INDIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          ))}
          {renderHeaderField('GSTIN:', (
            <input type="text" className="form-input" style={compactFieldStyle} value={formData.gstin || ''} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} placeholder="GSTIN" />
          ))}
          {renderHeaderField('Remarks:', (
            <input type="text" className="form-input" style={compactFieldStyle} value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} placeholder="Remarks" />
          ))}
          {renderHeaderField('Prepared By:', (
            <input type="text" className="form-input" style={compactFieldStyle} value={formData.prepared_by} onChange={(e) => setFormData({ ...formData, prepared_by: e.target.value })} placeholder="Prepared By" />
          ))}
        </div>
      </div>

      {variants.length > 0 && (
        <div className="card" style={{ marginBottom: '8px', padding: '6px', background: '#fef9e7', border: '1px solid #fcd34d' }} data-html2canvas-ignore>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#92400e' }}>Discount Control</span>
              <span style={{ fontSize: '10px', color: '#a16207' }}>(Set default % per variant)</span>
            </div>
            <button
              className="btn btn-sm"
              style={{ fontSize: '10px', padding: '2px 6px', background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}
              onClick={() => setActiveTab(activeTab === 'items' ? 'approval' : 'items')}
            >
              {activeTab === 'items' ? 'View Approval History' : 'Back to Items'}
            </button>
          </div>
          
          {activeTab === 'items' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {variants.map(variant => {
              const discountValue = headerDiscounts[variant.id] || 0;
              const settings = discountSettings[variant.id];
              const isAboveMax = settings && discountValue > settings.max;
              const approvalDisplay = getApprovalDisplayStatus(variant.id);
              
              return (
              <div 
                key={variant.id} 
                style={{ 
                  flex: '0 0 auto',
                  padding: '4px 6px',
                  background: '#fff',
                  borderRadius: '4px',
                  border: isAboveMax ? '1px solid #dc2626' : '1px solid #fcd34d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#92400e' }}>
                  {variant.variant_name}:
                </span>
                {approvalDisplay !== 'none' && (
                  <span style={{
                    fontSize: '8px',
                    padding: '1px 4px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    background: approvalDisplay === 'approved' ? '#dcfce7' : approvalDisplay === 'pending' ? '#fef3c7' : '#fee2e2',
                    color: approvalDisplay === 'approved' ? '#166534' : approvalDisplay === 'pending' ? '#92400e' : '#dc2626'
                  }}>
                    {approvalDisplay === 'approved' ? 'A' : approvalDisplay === 'pending' ? 'P' : 'R'}
                  </span>
                )}
                {isAboveMax && (
                  <span style={{ fontSize: '8px', color: '#dc2626', fontWeight: 600 }}>!</span>
                )}
                <input
                  type="number"
                  className="form-input"
                  style={{ 
                    width: '50px', 
                    textAlign: 'right',
                    minHeight: '22px',
                    fontSize: '10px',
                    padding: '2px 4px',
                    background: isAboveMax ? '#fef2f2' : '#fff'
                  }}
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
                    if (e.key === 'Enter') {
                      e.target.blur();
                    }
                  }}
                  min="0"
                  max="100"
                  step="0.01"
                />
                <span style={{ fontSize: '10px', color: '#92400e' }}>%</span>
              </div>
              );
            })}
          </div>
          )}
          
          {activeTab === 'approval' && (
            <div style={{ marginTop: '12px' }}>
              {approvalHistory.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                  No approval history yet. Discounts above the limit will require approval.
                </div>
              ) : (
                <table className="table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px' }}>Variant</th>
                      <th style={{ padding: '8px' }}>Event</th>
                      <th style={{ padding: '8px' }}>By</th>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px' }}>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalHistory.map((log) => {
                      const variant = variants.find(v => v.id === log.variant_id);
                      return (
                        <tr key={log.id}>
                          <td style={{ padding: '8px' }}>{variant?.variant_name || '-'}</td>
                          <td style={{ padding: '8px' }}>{log.event_type}</td>
                          <td style={{ padding: '8px' }}>{log.performed_by_email || '-'}</td>
                          <td style={{ padding: '8px' }}>{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                          <td style={{ padding: '8px' }}>{log.remark || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {quickQuoteConfig && (
        <div className="card" style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '12px', fontWeight: 600 }}>
              <span>Quick Quote</span>
              <span style={{ color: '#64748b', fontWeight: 400 }}>Generate preset rows</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select className="form-select" style={{ minWidth: '170px', height: '32px', fontSize: '12px' }} value={quickQuoteTemplateId} onChange={(e) => setQuickQuoteTemplateId(e.target.value)}>
                <option value="">Template</option>
                {(quickQuoteConfig?.templates || []).map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}
              </select>
              <input className="form-input" style={{ width: '92px', height: '32px', fontSize: '12px' }} value={quickQuoteSize} onChange={(e) => setQuickQuoteSize(e.target.value)} placeholder="Size" />
              <input className="form-input" style={{ width: '92px', height: '32px', fontSize: '12px' }} value={quickQuoteSubSize} onChange={(e) => setQuickQuoteSubSize(e.target.value)} placeholder="Sub-size" />
              <select className="form-select" style={{ minWidth: '160px', height: '32px', fontSize: '12px' }} value={quickQuoteVariantId} onChange={(e) => setQuickQuoteVariantId(e.target.value)}>
                <option value="">Variant</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>{variant.variant_name}</option>
                ))}
              </select>
              <input className="form-input" style={{ width: '120px', height: '32px', fontSize: '12px' }} value={quickQuoteMake} onChange={(e) => setQuickQuoteMake(e.target.value)} placeholder="Make" />
              <input className="form-input" style={{ width: '120px', height: '32px', fontSize: '12px' }} value={quickQuoteSpec} onChange={(e) => setQuickQuoteSpec(e.target.value)} placeholder="Spec" />
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#334155' }}>
                <input type="checkbox" checked={quickQuoteIncludeValves} onChange={(e) => setQuickQuoteIncludeValves(e.target.checked)} />
                Valves
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#334155' }}>
                <input type="checkbox" checked={quickQuoteIncludeThreadItems} onChange={(e) => setQuickQuoteIncludeThreadItems(e.target.checked)} />
                Thread
              </label>
              <button className="btn btn-primary" style={{ height: '32px', borderRadius: '8px', fontSize: '12px', padding: '0 12px' }} onClick={handleGenerateQuickQuote}>
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '16px', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} ref={itemsTableRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>Items</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={addEmptyItemRow} style={{ borderRadius: '8px', fontWeight: 500 }}>+ Add Row</button>
            <button className="btn btn-secondary" onClick={addSectionHeader} style={{ borderRadius: '8px', fontWeight: 500, background: '#f8fafc', color: '#1e293b', border: '1px solid #e2e8f0' }}>+ Add Section Header</button>
            <button className="btn btn-primary" onClick={() => setShowItemPicker(true)} style={{ borderRadius: '8px', fontWeight: 500 }}>+ Add Multiple Items</button>
            <button className="btn btn-secondary" onClick={() => setShowCustomLabelEditor(true)} style={{ borderRadius: '8px', fontWeight: 500 }}>⚙ Custom Columns</button>
          </div>
        </div>

        <div className="grid-table-container">
          <table className="grid-table">
            <thead>
              <tr>
                <th className="col-shrink">#</th>
                <th className="col-hsn">HSN</th>
                <th className="col-item">ITEM</th>
                <th className="col-make">MAKE</th>
                <th className="col-variant">VARIANT</th>
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
                items.map((item, index) => {
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
                      className={draggingItemId === item.id ? 'row-dragging' : item.is_override ? 'override-indicator' : ''}
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
                      <td className="col-shrink">
                        <input
                          type="text"
                          className="cell-input text-center"
                          value={item.hsn_code || item.material?.hsn_code || ''}
                          readOnly
                          style={{ background: '#f8fafc' }}
                        />
                      </td>
                      <td className="col-item">
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
                      </td>
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
                              const variantDiscount = item.variant_id ? (headerDiscounts[item.variant_id] || 0) : 0;
                              const finalRate = calculateVariantDiscountedRate(newRate, variantDiscount);
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
                              const variantDiscount = nextVariant ? (headerDiscounts[nextVariant] || 0) : 0;
                              const finalRate = calculateVariantDiscountedRate(newRate, variantDiscount);
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
                        <button type="button" className="btn-delete" onClick={() => removeItem(item.id)}>×</button>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px' }}>
        <div></div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Round Off</span>
              <input type="number" className="form-input" style={{ width: '100px', textAlign: 'right', height: '24px', padding: '2px 4px', fontSize: '11px' }} value={formData.round_off} onChange={(e) => setFormData({ ...formData, round_off: e.target.value })} step="0.01" />
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <span style={{ fontWeight: 600, fontSize: '11px', color: '#374151' }}>Authorized Signatory:</span>
          <select 
            className="form-select" 
            style={{ minHeight: '28px', padding: '2px 8px', fontSize: '11px', width: '200px' }}
            value={formData.authorized_signatory_id || ''} 
            onChange={(e) => setFormData({ ...formData, authorized_signatory_id: e.target.value })}
          >
            <option value="">Select Signatory</option>
            {(organisation?.signatures || []).map((sig) => (
              <option key={sig.id} value={sig.id}>{sig.name}</option>
            ))}
          </select>
        </div>
      </div>
      
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingBottom: '40px' }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/quotation')}>Cancel</button>
        {saving && (
          <div style={{position:'fixed',inset:0,background:'rgba(255,255,255,0.92)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:9999,gap:'16px'}}>
            <div style={{width:'48px',height:'48px',border:'4px solid #e5e7eb',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
            <span style={{fontSize:'16px',fontWeight:600,color:'#374161'}}>Saving Quotation...</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingBottom: '40px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/quotation')}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => handleSave(false)} disabled={saving}>{saving ? 'Saving...' : editId ? 'Update Quotation' : 'Save Quotation'}</button>
        </div>
      </div>
    </div>
  );
}

