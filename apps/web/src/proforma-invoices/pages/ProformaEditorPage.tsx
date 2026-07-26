import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useMaterials } from '../../hooks/useMaterials';
import { SearchableItemSelect } from '../../components/SearchableItemSelect';
import { useConvertDocument } from '../../conversions/hooks';
import type { ConversionType } from '../../conversions/types';
import { formatCurrency } from '../../utils/formatters';
import { isInterstate } from '../logic';
import { createProforma, updateProforma, getProformaById, sendProforma, markAccepted } from '../api';
import type { ProformaStatus } from '../types';
import type { ProformaInput, ProformaItem } from '../schemas';
import { FileText, Download, Trash2, Plus, ArrowLeft, Save, Send, CheckCircle, FileCheck, Loader2, Briefcase, User, Info, RotateCcw, ArrowUpDown, Columns } from 'lucide-react';
import { CustomDatePicker, DocumentActionBar, HeaderFormGrid, HeaderCard, HeaderField, PrimaryButton, SecondaryButton, ImportButton } from '../../components/document-editor';
import ItemSelectorDrawer from '../../components/ItemSelectorDrawer';
import ItemCreateDrawer from '../../components/ItemCreateDrawer';
import { useClientPOs } from '../hooks';
import { useConversionStatus, getSourceTableName } from '../../conversions/hooks';
import { withSessionCheck } from '../../queryClient';
import { AiDocumentParserModal } from '../../components/AiDocumentParserModal';
import { toast } from 'sonner';
import { ArcPricingToggle, ArcPricingStatusBadge } from '../../components/ArcPricingToggle';
import { getArcRateFromMap, fetchArcPricingForItems } from '../../lib/arc-pricing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ArcConfirmationDialog, type ArcPricingItem } from '../../components/ArcConfirmationDialog';
import { InlineDescriptionCell } from '../../components/InlineDescriptionCell';
import { TermsConditionsDrawer } from '../../components/TermsConditionsDrawer';
import { z } from 'zod';
import { ProformaItemsTable } from '../components/ProformaItemsTable';
import { DocumentConversionChain } from '../../components/DocumentConversionChain';
import POLineItemsSelector from '../../invoices/components/POLineItemsSelector';
import { updatePoLineItemBilling } from '../../lib/poBillingUtils';
import { RevisionBadge } from '../../components/RevisionBadge';
import { RevisionHistoryDialog } from '../../components/RevisionHistoryDialog';
import { RevisionReasonDialog } from '../../components/RevisionReasonDialog';
import { PdfFlavorSelector, getFlavorConfig, type PdfFlavor } from '../../components/PdfFlavorSelector';

// Helper to convert number to words for INR
function numberToWords(num: number) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number) => {
    let numStr = n.toString();
    if (numStr.length > 9) return 'overflow';
    let nArr = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr || nArr.length < 6) return '';
    let str = '';
    str += Number(nArr[1]) !== 0 ? (a[Number(nArr[1])] || b[Number(nArr[1][0])] + ' ' + a[Number(nArr[1][1])]) + 'Crore ' : '';
    str += Number(nArr[2]) !== 0 ? (a[Number(nArr[2])] || b[Number(nArr[2][0])] + ' ' + a[Number(nArr[2][1])]) + 'Lakh ' : '';
    str += Number(nArr[3]) !== 0 ? (a[Number(nArr[3])] || b[Number(nArr[3][0])] + ' ' + a[Number(nArr[3][1])]) + 'Thousand ' : '';
    str += Number(nArr[4]) !== 0 ? (a[Number(nArr[4])] || b[Number(nArr[4][0])] + ' ' + a[Number(nArr[4][1])]) + 'Hundred ' : '';
    str += Number(nArr[5]) !== 0 ? ((str !== '') ? 'and ' : '') + (a[Number(nArr[5])] || b[Number(nArr[5][0])] + ' ' + a[Number(nArr[5][1])]) : '';
    return str.trim() + ' Only';
  };
  return inWords(Math.round(num));
}

export interface LineItem {
  description: string;
  hsn_code: string | null;
  qty: number;
  rate: number;
  amount: number;
  discount_percent: number;
  rate_after_discount: number;
  tax_percent: number;
  item_id: string | null;
  variant_id: string | null;
  discount_category_id?: string | null;
  make: string | null;
  variant: string | null;
  unit: string | null;
  custom1?: string;
  custom2?: string;
}

export default function ProformaEditorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { organisation, user } = useAuth();
  const id = searchParams.get('id');
  const convertFrom = searchParams.get('convertFrom') as ConversionType | null;
  const sourceId = searchParams.get('sourceId');
  const poId = searchParams.get('poId');
  const isNew = !id;
  const isConverting = Boolean(convertFrom && sourceId && !id);
  const isConvertingFromPO = Boolean(poId && !id);
  const conversionInfoRef = useRef<{ type: ConversionType; sourceId: string } | null>(null);

  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ description: '', hsn_code: null, qty: 1, rate: 0, amount: 0, discount_percent: 0, rate_after_discount: 0, tax_percent: 18, item_id: null, variant_id: null, discount_category_id: null, make: null, variant: null, unit: null, custom1: '', custom2: '' }]);

  const [isParserOpen, setIsParserOpen] = useState(false);
  const [activeImportSessionId, setActiveImportSessionId] = useState<string | null>(null);
  const [preImportHeader, setPreImportHeader] = useState<any>(null);

  const handleImportSuccess = (data: any) => {
    setPreImportHeader({
      clientId,
      proformaDate,
      proformaNumber,
      paymentTerms
    });

    if (data.header.party_id) setClientId(data.header.party_id);
    if (data.header.date) setProformaDate(data.header.date);
    if (data.header.reference_number) setProformaNumber(data.header.reference_number);
    if (data.header.payment_terms) setPaymentTerms(data.header.payment_terms);

    const newItems = data.items.map((item: any, idx: number) => {
      const matchedMaterial = materials.find((m: any) => m.id === item.material_id);
      return {
        description: item.product_name,
        hsn_code: item.hsn_code || matchedMaterial?.hsn_code || null,
        qty: item.qty,
        rate: item.rate,
        amount: item.rate * item.qty,
        discount_percent: 0,
        rate_after_discount: item.rate,
        tax_percent: item.tax_percent,
        item_id: item.material_id,
        variant_id: null,
        discount_category_id: matchedMaterial?.discount_category_id || null,
        make: '',
        variant: null,
        unit: item.uom,
        custom1: '',
        custom2: '',
        imported_from_import_id: data.reviewSessionId
      };
    });

    setItems((prev: any[]) => {
      const filtered = prev.filter(i => i.description || i.item_id);
      return [...filtered, ...newItems];
    });
    setActiveImportSessionId(data.reviewSessionId);
  };

  const handleUndoImport = async () => {
    if (!activeImportSessionId) return;
    try {
      const { error } = await supabase
        .from('document_review_sessions')
        .update({
          status: 'ROLLED_BACK',
          rolled_back_at: new Date().toISOString(),
          rolled_back_by_user_id: user?.id,
          rollback_reason: 'User clicked Undo Import banner button'
        })
        .eq('id', activeImportSessionId);

      if (error) throw error;

      if (preImportHeader) {
        if (preImportHeader.clientId !== undefined) setClientId(preImportHeader.clientId);
        if (preImportHeader.proformaDate !== undefined) setProformaDate(preImportHeader.proformaDate);
        if (preImportHeader.proformaNumber !== undefined) setProformaNumber(preImportHeader.proformaNumber);
        if (preImportHeader.paymentTerms !== undefined) setPaymentTerms(preImportHeader.paymentTerms);
      }

      setItems((prev: any[]) => prev.filter((item: any) => item.imported_from_import_id !== activeImportSessionId));
      setActiveImportSessionId(null);
      setPreImportHeader(null);
      toast.success('AI Import undone successfully. Form restored.');
    } catch (e: any) {
      toast.error(`Undo failed: ${e.message}`);
    }
  };
  const [companyState, setCompanyState] = useState('');
  const [clientState, setClientState] = useState('');
  const [status, setStatus] = useState<ProformaStatus>('draft');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState('');
  const [manualPO, setManualPO] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [proformaDate, setProformaDate] = useState(new Date().toISOString().split('T')[0]);
  const [proformaNumber, setProformaNumber] = useState('');
  const [showItemSelectorDrawer, setShowItemSelectorDrawer] = useState(false);
  const [showItemCreateDrawer, setShowItemCreateDrawer] = useState(false);
  const [roundOff, setRoundOff] = useState(false);
  const [renderAsTaxInvoice, setRenderAsTaxInvoice] = useState(false);
  const [showWatermark, setShowWatermark] = useState(false);
  const [pdfFlavor, setPdfFlavor] = useState<PdfFlavor>('proforma');
  const [discountPercent, setDiscountPercent] = useState<number | string>(0);
  const [discountAmount, setDiscountAmount] = useState<number | string>(0);
  const [templateSettings, setTemplateSettings] = useState<any>(null);
  const [discountSettings, setDiscountSettings] = useState<Record<string, { default: number; min: number; max: number }>>({});
  const [headerDiscounts, setHeaderDiscounts] = useState<Record<string, number>>({});
  const [discountCategoryMap, setDiscountCategoryMap] = useState<Record<string, any>>({});
  const [authorizedSignatoryId, setAuthorizedSignatoryId] = useState('');
  const [isSigDropdownOpen, setIsSigDropdownOpen] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | number | null>(null);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [showTermsDrawer, setShowTermsDrawer] = useState(false);
  const [showCustomLabelEditor, setShowCustomLabelEditor] = useState(false);
  const [moveToDialog, setMoveToDialog] = useState<{
    open: boolean;
    itemId: string | number | null;
    currentSNo: number;
    value: string;
    error: string;
  } | null>(null);

  // Client search UI state (null = show selected client name; string = show typed text)
  const [clientSearch, setClientSearch] = useState<string | null>(null);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // ARC Pricing state
  const [useArcPricing, setUseArcPricing] = useState(false);
  const [arcPricingMap, setArcPricingMap] = useState<Record<string, { item_id: string; arc_rate: number; company_variant_id: string | null; pricing_type: string; is_active: boolean }[]>>({});
  const [arcPricingNotice, setArcPricingNotice] = useState(false);
  const [arcPricingConfirmOpen, setArcPricingConfirmOpen] = useState(false);
  const [variantPricing, setVariantPricing] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [isPOSelectorOpen, setIsPOSelectorOpen] = useState(false);
  const [selectedPOLineItems, setSelectedPOLineItems] = useState<any[]>([]);
  const [isApplyingPOItems, setIsApplyingPOItems] = useState(false);

  // ── Revision Management ──
  const [revisionNo, setRevisionNo] = useState(1);
  const [revisionHistory, setRevisionHistory] = useState<any[]>([]);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [pendingSaveWithReason, setPendingSaveWithReason] = useState<{ shouldPrint: boolean } | null>(null);

  const { data: clients = [] } = useClients();
  const selectedClient = useMemo(() => clients.find(c => c.id === clientId) as any, [clients, clientId]);
  const billingAddress = useMemo(() => {
    if (!selectedClient) return '';
    return [selectedClient.address1, selectedClient.address2, selectedClient.city, selectedClient.state, selectedClient.pincode]
      .filter(Boolean)
      .join(', ');
  }, [selectedClient]);
  const { data: clientPOs = [] } = useClientPOs(clientId);

  // PO details query for line items selector
  const poDetailsQuery = useQuery({
    queryKey: ['po-details', selectedPOId, organisation?.id],
    queryFn: async () => {
      if (!selectedPOId) return null;
      const { data: header } = await supabase
        .from('client_purchase_orders')
        .select('id, po_number, po_total_value, po_utilized_value, po_available_value')
        .eq('id', selectedPOId)
        .single();
      if (!header) return null;
      const { data: items } = await supabase
        .from('po_line_items')
        .select('*')
        .eq('po_id', selectedPOId)
        .order('line_order', { ascending: true });
      return { header, items: items || [] };
    },
    enabled: !!selectedPOId && !!organisation?.id,
    staleTime: 0,
  });

  const { data: variants = [] } = useQuery({
    queryKey: ['company-variants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_variants')
        .select('id, variant_name')
        .eq('organisation_id', organisation?.id)
        .order('variant_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['document-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('id, template_name, document_type, column_settings')
        .order('template_name', { ascending: true });
      if (error) throw error;
      return (data || []).filter(t => t.document_type === 'proforma' || t.document_type === 'invoice');
    },
  });

  const { data: discountCategories = [] } = useQuery({
    queryKey: ['discount-categories', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('discount_categories')
        .select('*')
        .or(`organisation_id.eq.${organisation.id},organisation_id.is.null`)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  useEffect(() => {
    const dcMap: Record<string, any> = {};
    (discountCategories || []).forEach((dc) => {
      dcMap[dc.id] = dc;
    });
    setDiscountCategoryMap(dcMap);
  }, [discountCategories]);

  const { data: organisationDetails } = useQuery({
    queryKey: ['organisation-details', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return null;
      const { data, error } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', organisation.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!organisation?.id,
  });

  const { data: materials = [] } = useMaterials();

  // Conversion query
  const conversionQuery = useConvertDocument(convertFrom!, sourceId!);

  // Auto-select client's default template and set clientState when client changes
  useEffect(() => {
    if (clientId) {
      const selectedClient = clients.find(c => c.id === clientId) as any;
      if (selectedClient) {
        setClientState(selectedClient.state || '');
        if (selectedClient.default_template_id && !templateId) {
          setTemplateId(selectedClient.default_template_id);
        }
      }
    }
  }, [clientId, templates, templateId, clients]);

  // Click outside listener for searchable client dropdown
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

  // Fetch ARC pricing when client or items change
  useEffect(() => {
    if (!useArcPricing || !clientId) {
      setArcPricingMap({});
      return;
    }

    const fetchArcPricing = async () => {
      const itemIds = items
        .filter(item => item.item_id)
        .map(item => item.item_id) as string[];
      
      if (itemIds.length === 0) {
        setArcPricingMap({});
        return;
      }

      try {
        const arcData = await fetchArcPricingForItems(clientId, itemIds);
        setArcPricingMap(arcData);
      } catch (err) {
        console.error('Error fetching ARC pricing:', err);
      }
    };

    fetchArcPricing();
  }, [clientId, items, useArcPricing]);

  // Load discount settings and template settings when template changes
  useEffect(() => {
    const loadSettings = async () => {
      if (organisation?.id) {
        // Load discount settings
        const { data: settings } = await supabase
          .from('discount_settings')
          .select('variant_id, default_discount_percent, min_discount_percent, max_discount_percent')
          .eq('organisation_id', organisation.id);

        const settingsMap: Record<string, { default: number; min: number; max: number }> = {};
        (settings || []).forEach((row) => {
          settingsMap[row.variant_id] = {
            default: parseFloat(row.default_discount_percent) || 0,
            min: parseFloat(row.min_discount_percent) || 0,
            max: parseFloat(row.max_discount_percent) || 0
          };
        });
        setDiscountSettings(settingsMap);

        // Load variant pricing data
        const { data: pricing } = await supabase
          .from('item_variant_pricing')
          .select('item_id, company_variant_id, sale_price, make')
          .eq('organisation_id', organisation.id);

        const vPricing: Record<string, Record<string, Record<string, number>>> = {};
        (pricing || []).forEach((row: any) => {
          if (!vPricing[row.item_id]) vPricing[row.item_id] = {};
          if (!vPricing[row.item_id][row.company_variant_id]) vPricing[row.item_id][row.company_variant_id] = {};
          vPricing[row.item_id][row.company_variant_id][row.make] = row.sale_price;
        });
        setVariantPricing(vPricing);

        // Load template settings
        if (templateId) {
          const { data: template } = await supabase
            .from('document_templates')
            .select('column_settings')
            .eq('id', templateId)
            .single();

          if (template) {
            setTemplateSettings(template);
          } else {
            // Default template settings
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
        }
      }
    };

    loadSettings();
  }, [organisation?.id, templateId]);

  // Handle header discount change for discount category based discounts
  const handleHeaderDiscountChange = useCallback((id: string, newValue: number) => {
    const numValue = parseFloat(newValue.toString()) || 0;
    
    const matchFn = (item: LineItem) => item.discount_category_id === id;
      
    const affectedItems = items.filter(matchFn);
    
    if (affectedItems.length > 0) {
      const updatedItems = items.map(item => {
        if (matchFn(item)) {
          const baseRate = item.rate || 0;
          const rateAfterDiscount = baseRate - (baseRate * numValue / 100);
          return {
            ...item,
            discount_percent: numValue,
            rate_after_discount: rateAfterDiscount,
            amount: item.qty * rateAfterDiscount
          };
        }
        return item;
      });
      setItems(updatedItems);
    }
    
    setHeaderDiscounts(prev => ({ ...prev, [id]: numValue }));
  }, [items]);

  // Load PO line items when converting from PO
  useEffect(() => {
    const loadPOLineItems = async () => {
      if (isConvertingFromPO && poId) {
        try {
          const { data: poData, error: poError } = await supabase
            .from('client_purchase_orders')
            .select('*, clients!inner(client_name)')
            .eq('id', poId)
            .single();
          
          if (poError) throw poError;
          
          // Set client ID
          setClientId(poData.client_id);
          
          // Set PO reference
          setPoNumber(poData.po_number);
          setPoDate(poData.po_date);
          
          // Load PO line items
          const { data: lineItems, error: lineItemsError } = await supabase
            .from('po_line_items')
            .select('*')
            .eq('po_id', poId)
            .order('line_order', { ascending: true });
          
          if (lineItemsError) throw lineItemsError;
          
          // Convert PO line items to proforma format
          if (lineItems && lineItems.length > 0) {
            const proformaItems = lineItems.map((item: any) => ({
              description: item.description,
              hsn_code: null,
              qty: item.quantity,
              rate: item.rate_per_unit,
              amount: item.amount || (item.quantity * item.rate_per_unit),
              discount_percent: 0,
              rate_after_discount: item.rate_per_unit,
              tax_percent: item.gst_percentage || 18,
              item_id: null,
              variant_id: null,
              make: null,
              variant: null,
              unit: item.unit || 'Nos',
              discount_category_id: null,
            }));
            setItems(proformaItems);
          }
        } catch (err: any) {
          console.error('Error loading PO line items:', err);
        }
      }
    };
    
    loadPOLineItems();
  }, [isConvertingFromPO, poId]);

  // Fetch series row for PI
  const fetchSeriesRowForPI = async () => {
    const attempts = [
      () =>
        supabase
          .from('document_series')
          .select('id, configs, current_number, created_at')
          .eq('is_default', true)
          .maybeSingle(),
      () =>
        supabase
          .from('document_series')
          .select('id, configs, current_number, created_at')
          .order('created_at', { ascending: false })
          .limit(1),
    ];

    for (const runQuery of attempts) {
      const { data, error } = await runQuery();
      if (error) continue;
      if (Array.isArray(data)) return data[0] || null;
      if (data) return data;
    }
    return null;
  };

  const generatePINumber = async (reserveNumber = false) => {
    const seriesData = await fetchSeriesRowForPI();

    if (seriesData?.configs?.proforma?.enabled) {
      const config = seriesData.configs.proforma;
      const currentNum = (seriesData.current_number || config.start_number || 1);
      const padding = parseInt(config.padding) || 4;
      const paddedNum = String(currentNum).padStart(padding, '0');
      
      if (reserveNumber) {
        await supabase
          .from('document_series')
          .update({ current_number: currentNum + 1 })
          .eq('id', seriesData.id);
      }
      
      let prefix = config.prefix || '';
      if (prefix.includes('{FY}')) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const fy = month < 3 ? `${year - 1}-${year.toString().slice(-2)}` : `${year}-${(year + 1).toString().slice(-2)}`;
        prefix = prefix.replace('{FY}', fy);
      }
      
      setProformaNumber(`${prefix}${paddedNum}${config.suffix || ''}`);
      return;
    }
    
    // Fallback
    const year = new Date().getFullYear();
    const prefix = `PI/${year}/`;
    try {
      const { data: existing } = await supabase
        .from('proforma_invoices')
        .select('pi_number')
        .eq('organisation_id', organisation?.id)
        .like('pi_number', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (existing && existing.length > 0) {
        const lastNum = parseInt((existing[0].pi_number || '').replace(/[^0-9]/g, ''), 10) || 0;
        setProformaNumber(`${prefix}${String(lastNum + 1).padStart(4, '0')}`);
      } else {
        setProformaNumber(`${prefix}0001`);
      }
    } catch {
      setProformaNumber(`${prefix}${Date.now().toString().slice(-6)}`);
    }
  };

  // Generate PI number on mount
  useEffect(() => {
    if (isNew && !proformaNumber) {
      generatePINumber();
    }
  }, [isNew]);

  const { data: proforma, isLoading } = useQuery({
    queryKey: ['proforma-invoice', id],
    queryFn: withSessionCheck(() => getProformaById(id!, organisation?.id || undefined)),
    enabled: !!id && !!organisation?.id,
  });

  useEffect(() => {
    if (proforma) {
      setClientId(proforma.client_id);
      setItems(proforma.items.map(i => {
        const discountPercent = i.discount_percent || 0;
        const baseRate = i.rate || 0;
        const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
        return {
          description: i.description,
          hsn_code: i.hsn_code ?? null,
          qty: i.qty,
          rate: i.rate,
          amount: i.amount,
          discount_percent: discountPercent,
          rate_after_discount: rateAfterDiscount,
          tax_percent: i.tax_percent || 18,
          item_id: i.item_id || null,
          variant_id: i.variant_id || null,
          discount_category_id: i.discount_category_id || null,
          make: i.make || null,
          variant: i.variant || null,
          unit: i.unit || null,
          custom1: i.meta_json?.custom1 ?? '',
          custom2: i.meta_json?.custom2 ?? '',
        };
      }));
      setCompanyState(proforma.company_state ?? '');
      setClientState(proforma.client_state ?? '');
      setStatus(proforma.status);
      setNotes(proforma.notes ?? '');
      setTerms(proforma.terms ?? '');
      setTemplateId(proforma.template_id ?? '');
      setPaymentTerms(proforma.payment_terms ?? '');
      setAuthorizedSignatoryId(proforma.authorized_signatory_id ?? '');
      setDiscountPercent(proforma.discount_percent !== null && proforma.discount_percent !== undefined ? Number(proforma.discount_percent) : 0);
      setDiscountAmount(proforma.discount_amount !== null && proforma.discount_amount !== undefined ? Number(proforma.discount_amount) : 0);
      setRenderAsTaxInvoice(proforma.render_as_tax_invoice ?? false);
      // Derive PDF flavor from stored preference or existing flag
      if (proforma.pdf_flavor) {
        setPdfFlavor(proforma.pdf_flavor);
      } else {
        // Backward compat: map old render_as_tax_invoice boolean
        setPdfFlavor(proforma.render_as_tax_invoice ? 'review' : 'proforma');
      }
      setRevisionNo(proforma.revision_no ?? 1);
      setRevisionHistory(proforma.revision_history ?? []);
      setRevisionReason(proforma.revision_reason ?? '');
    }
  }, [proforma]);

  // Synchronize showWatermark state with renderAsTaxInvoice and localStorage
  const handleRenderAsTaxInvoiceChange = (checked: boolean) => {
    setRenderAsTaxInvoice(checked);
    setShowWatermark(checked);
  };

  const handleShowWatermarkChange = (checked: boolean) => {
    setShowWatermark(checked);
    localStorage.setItem('proforma_watermark_default', checked ? 'true' : 'false');
  };

  useEffect(() => {
    const savedDefault = localStorage.getItem('proforma_watermark_default');
    if (savedDefault !== null) {
      setShowWatermark(savedDefault === 'true');
    } else {
      setShowWatermark(renderAsTaxInvoice);
    }
  }, [renderAsTaxInvoice]);

  // Load conversion data when converting from another document
  useEffect(() => {
    if (!isConverting || !conversionQuery.data) return;

    // Store conversion info for status update on save
    conversionInfoRef.current = {
      type: convertFrom!,
      sourceId: sourceId!,
    };

    const convertedData = conversionQuery.data.data as any;

    // Pre-fill form with converted data
    if (convertedData.client_id) {
      setClientId(convertedData.client_id);
    }
    setCompanyState(convertedData.company_state || organisation?.state || '');
    setClientState(convertedData.client_state || '');
    setNotes(convertedData.notes || '');
    setTerms(convertedData.terms || '');
    setPaymentTerms(convertedData.payment_terms || '');
    setPoNumber(convertedData.po_number || '');
    setPoDate(convertedData.po_date || '');
    setAuthorizedSignatoryId(convertedData.authorized_signatory_id || '');
    setDiscountPercent(convertedData.discount_percent || convertedData.extra_discount_percent || 0);
    setDiscountAmount(convertedData.discount_amount || convertedData.extra_discount_amount || 0);

    // Pre-fill items
    if (convertedData.items && convertedData.items.length > 0) {
      const mappedItems = convertedData.items.map((item: any) => {
        const discountPercent = item.discount_percent || 0;
        const baseRate = item.rate || 0;
        const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
        return {
          description: item.description,
          hsn_code: item.hsn_code,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
          discount_percent: discountPercent,
          rate_after_discount: rateAfterDiscount,
          tax_percent: item.tax_percent || 18,
          item_id: item.item_id || null,
          variant_id: item.variant_id || null,
          discount_category_id: item.discount_category_id || null,
          make: item.make || null,
          variant: item.variant || null,
          unit: item.unit || null,
          custom1: item.meta_json?.custom1 || '',
          custom2: item.meta_json?.custom2 || '',
        };
      });
      setItems(mappedItems);
    }
  }, [isConverting, conversionQuery.data, convertFrom, sourceId, organisation?.state]);

  const calculateTotals = () => {
    // Calculate subtotal as sum of (qty × rate_after_discount) for each item
    const subtotal = items.reduce((sum, item) => {
      const rateAfterDiscount = item.rate_after_discount || item.rate;
      return sum + (item.qty * rateAfterDiscount);
    }, 0);

    // Calculate tax based on amount (qty × rate_after_discount)
    const taxTotal = items.reduce((sum, item) => {
      const itemTaxPercent = item.tax_percent || 18;
      const rateAfterDiscount = item.rate_after_discount || item.rate;
      const amount = item.qty * rateAfterDiscount;
      return sum + amount * (itemTaxPercent / 100);
    }, 0);

    let cgst = 0, sgst = 0, igst = 0;
    if (isInterstate(companyState, clientState)) {
      igst = taxTotal;
    } else {
      cgst = taxTotal / 2;
      sgst = taxTotal / 2;
    }

    const extraDiscountPercentVal = Number(discountPercent) || 0;
    const extraDiscountAmtVal = Number(discountAmount) || 0;
    const computedExtraDiscountAmt = (subtotal * extraDiscountPercentVal) / 100;
    const subtotalAfterDiscounts = subtotal - computedExtraDiscountAmt - extraDiscountAmtVal;

    let total = subtotalAfterDiscounts + taxTotal;
    let roundOffAmount = 0;

    if (roundOff) {
      const roundedTotal = Math.round(total);
      roundOffAmount = roundedTotal - total;
      total = roundedTotal;
    }

    return { subtotal, discount: computedExtraDiscountAmt + extraDiscountAmtVal, cgst, sgst, igst, total, roundOffAmount };
  };

  const totals = useMemo(() => {
    const validItems = items.filter(i => i.description?.trim());
    if (validItems.length === 0) {
      return { subtotal: 0, discount: 0, cgst: 0, sgst: 0, igst: 0, total: 0, taxTotal: 0, roundOffAmount: 0, amountInWords: '' };
    }
    const calculated = calculateTotals();
    return { ...calculated, amountInWords: numberToWords(calculated.total) };
  }, [items, companyState, clientState, roundOff, discountPercent, discountAmount]);

  const handleItemChange = (index: number, field: keyof LineItem, value: string | number | null) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const item = updated[index];

      if (field === 'discount_category_id') {
        const dcId = value as string | null;
        const categoryDiscount = dcId ? (headerDiscounts[dcId] !== undefined ? headerDiscounts[dcId] : (discountCategoryMap[dcId]?.default_discount_percent ?? 0)) : 0;
        item.discount_percent = categoryDiscount;
        const baseRate = Number(item.rate) || 0;
        const rateAfterDiscount = baseRate - (baseRate * categoryDiscount / 100);
        item.rate_after_discount = Math.max(0, rateAfterDiscount);
      }

      // Calculate rate after discount
      if (field === 'discount_percent' || field === 'rate' || field === 'discount_category_id') {
        const discountPercent = Number(item.discount_percent) || 0;
        const baseRate = Number(item.rate) || 0;
        const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
        item.rate_after_discount = Math.max(0, rateAfterDiscount);
      }

      // Calculate amount as qty × rate_after_discount
      if (field === 'qty' || field === 'rate' || field === 'discount_percent' || field === 'rate_after_discount' || field === 'discount_category_id') {
        const rateAfterDiscount = item.rate_after_discount || item.rate;
        item.amount = Number(item.qty) * rateAfterDiscount;
      }

      return updated;
    });
  };

  const handleMaterialChange = (index: number, mat: any) => {
    setItems(prev => {
      const updated = [...prev];
      if (mat) {
        const dcId = mat.discount_category_id || null;
        const categoryDiscount = dcId ? (headerDiscounts[dcId] !== undefined ? headerDiscounts[dcId] : (discountCategoryMap[dcId]?.default_discount_percent ?? 0)) : 0;
        const rate = getRateForItem(mat, updated[index].variant_id);
        const rateAfterDiscount = rate - (rate * categoryDiscount / 100);

        updated[index] = {
          ...updated[index],
          item_id: mat.id,
          description: updated[index].description || '',
          hsn_code: mat.hsn_code || '',
          tax_percent: mat.gst_rate || 18,
          discount_category_id: dcId,
          discount_percent: categoryDiscount,
          rate: rate,
          rate_after_discount: rateAfterDiscount,
          amount: updated[index].qty * rateAfterDiscount,
          unit: mat.unit || 'Nos',
        };
      } else {
        updated[index] = {
          ...updated[index],
          item_id: null,
          description: '',
          hsn_code: null,
          tax_percent: 18,
          discount_category_id: null,
          discount_percent: 0,
          rate: 0,
          rate_after_discount: 0,
          amount: 0,
          unit: null,
        };
      }
      return updated;
    });
  };

  const commitQtyInput = (itemId: string | number) => {
    setQtyDrafts((prev) => {
      if (!(itemId in prev)) return prev;
      const rawValue = prev[itemId].trim();
      const parsedQty = rawValue === '' ? 0 : Math.max(0, parseFloat(rawValue) || 0);
      handleItemChange(items.findIndex((i, idx) => i.id === itemId || (!i.id && idx === Number(itemId))), 'qty', parsedQty);
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const resetQtyInput = (itemId: string | number) => {
    setQtyDrafts((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  // Drag & Drop handlers
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
      const fromIndex = prev.findIndex((r, i) => r.id === draggingItemId || (!r.id && i === Number(draggingItemId)));
      const toIndex = prev.findIndex((r, i) => r.id === targetId || (!r.id && i === Number(targetId)));
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

  // Move To dialog
  const openMoveToDialog = useCallback((itemId: string | number, currentSNo: number) => {
    setMoveToDialog({
      open: true,
      itemId,
      currentSNo,
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
    const maxSNo = items.filter(i => !i.is_header && !i.is_subtotal).length;
    if (targetSNo > maxSNo) {
      setMoveToDialog(prev => prev ? { ...prev, error: `S.No cannot exceed ${maxSNo}` } : null);
      return;
    }
    moveToSerialNo(moveToDialog.itemId, targetSNo);
    setMoveToDialog(null);
  }, [moveToDialog, items]);

  const moveToSerialNo = useCallback((itemId: string | number, targetSNo: number) => {
    setItems((prev) => {
      const fromIndex = prev.findIndex((item, idx) => item.id === itemId || (!item.id && idx === Number(itemId)));
      if (fromIndex < 0) return prev;

      let regularCount = 0;
      let targetIndex = -1;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].is_header || prev[i].is_subtotal) continue;
        regularCount++;
        if (regularCount === targetSNo) {
          targetIndex = i;
          break;
        }
      }

      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      const insertIndex = targetIndex >= 0 ? targetIndex : updated.length;
      updated.splice(insertIndex, 0, movedItem);
      return updated;
    });
  }, []);

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

  const addEmptyItemRow = useCallback(() => {
    const rowId = Date.now() + Math.random();
    setItems((prev) => [...prev, {
      id: rowId,
      description: '',
      hsn_code: null,
      qty: 1,
      rate: 0,
      amount: 0,
      discount_percent: 0,
      rate_after_discount: 0,
      tax_percent: 18,
      item_id: null,
      variant_id: null,
      discount_category_id: null,
      make: null,
      variant: null,
      unit: null,
      custom1: '',
      custom2: '',
    } as LineItem]);
  }, [setItems]);

  const addSectionHeaderRow = useCallback(() => {
    const rowId = 'hdr-' + (Date.now() + Math.random());
    setItems((prev) => [...prev, {
      id: rowId,
      is_header: true,
      description: '',
      hsn_code: null,
      qty: 0,
      rate: 0,
      amount: 0,
      discount_percent: 0,
      rate_after_discount: 0,
      tax_percent: 0,
      item_id: null,
      variant_id: null,
      discount_category_id: null,
      make: null,
      variant: null,
      unit: null,
      custom1: '',
      custom2: '',
    } as any]);
  }, [setItems]);

  const addSubtotalRow = useCallback(() => {
    const rowId = 'st-' + (Date.now() + Math.random());
    setItems((prev) => [...prev, {
      id: rowId,
      is_subtotal: true,
      subtotal_label: 'Sub-total:',
      description: 'Sub-total:',
      hsn_code: null,
      qty: 0,
      rate: 0,
      amount: 0,
      discount_percent: 0,
      rate_after_discount: 0,
      tax_percent: 0,
      item_id: null,
      variant_id: null,
      discount_category_id: null,
      make: null,
      variant: null,
      unit: null,
      custom1: '',
      custom2: '',
    } as any]);
  }, [setItems]);

  const handleAddItem = () => {
    setItems(prev => [...prev, { description: '', hsn_code: null, qty: 1, rate: 0, amount: 0, discount_percent: 0, rate_after_discount: 0, tax_percent: 18, item_id: null, variant_id: null, discount_category_id: null, make: null, variant: null, unit: null }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Get rate for item (considering ARC pricing)
  const getRateForItem = (item: any, variantId?: string | null): number => {
    const materialId = item.id || item.item_id;
    if (!materialId) {
      return Number(item.sale_price || item.default_rate || 0);
    }

    // Check if ARC pricing is available and should be used
    if (useArcPricing && arcPricingMap[materialId]) {
      const arcRate = getArcRateFromMap(arcPricingMap, materialId, variantId);
      if (arcRate !== null) {
        return arcRate;
      }
    }

    // Fall back to standard rate
    return Number(item.sale_price || item.default_rate || 0);
  };

  // PO Line Items selection handlers
  const handleChoosePOLineItems = useCallback(() => {
    if (selectedPOId && poDetailsQuery.data) {
      setIsPOSelectorOpen(true);
    }
  }, [selectedPOId, poDetailsQuery.data]);

  const handlePOLineItemsApply = (selectedItems: any[]) => {
    setIsApplyingPOItems(true);
    const newItems = selectedItems.map((item: any) => ({
      description: item.description,
      hsn_code: item.hsn_sac_code || null,
      qty: item.quantity,
      rate: item.rate_per_unit,
      amount: item.basic_amount,
      discount_percent: 0,
      rate_after_discount: item.rate_per_unit,
      tax_percent: item.gst_percentage,
      item_id: null,
      variant_id: null,
      discount_category_id: null,
      make: null,
      variant: null,
      unit: item.unit || 'Nos',
      custom1: '',
      custom2: '',
    }));
    setItems((prev) => [...prev.filter(i => i.description || i.item_id), ...newItems]);
    setSelectedPOLineItems(selectedItems);
    setIsApplyingPOItems(false);
    setIsPOSelectorOpen(false);
  };

  const handleItemSelectorSuccess = (newItems: any[]) => {
    const newLineItems = newItems.map((newItem: any) => {
      const dcId = newItem.discount_category_id || null;
      const categoryDiscount = dcId ? (headerDiscounts[dcId] || 0) : 0;
      const rate = getRateForItem(newItem, newItem.variant_id);
      const rateAfterDiscount = rate - (rate * categoryDiscount / 100);

      return {
        description: '',
        hsn_code: newItem.hsn_code,
        qty: 1,
        rate: rate,
        amount: rateAfterDiscount,
        discount_percent: categoryDiscount,
        rate_after_discount: rateAfterDiscount,
        tax_percent: newItem.gst_rate || 18,
        item_id: newItem.id || null,
        variant_id: newItem.variant_id || null,
        discount_category_id: dcId,
        make: newItem.make || null,
        variant: newItem.variant || null,
        unit: newItem.unit || 'Nos',
      };
    });

    setItems(prev => [...prev, ...newLineItems]);
    setShowItemSelectorDrawer(false);
  };

  const handleItemCreateSuccess = (newItem: any) => {
    const dcId = newItem.discount_category_id || null;
    const categoryDiscount = dcId ? (headerDiscounts[dcId] || 0) : 0;
    const rate = getRateForItem(newItem, newItem.variant_id);
    const rateAfterDiscount = rate - (rate * categoryDiscount / 100);

    setItems(prev => [
      ...prev,
      {
        description: '',
        hsn_code: newItem.hsn_code,
        qty: 1,
        rate: rate,
        amount: rateAfterDiscount,
        discount_percent: categoryDiscount,
        rate_after_discount: rateAfterDiscount,
        tax_percent: newItem.gst_rate || 18,
        item_id: newItem.id || null,
        variant_id: newItem.variant_id || null,
        discount_category_id: dcId,
        make: newItem.make || null,
        variant: newItem.variant || null,
        unit: newItem.unit || 'Nos',
      }
    ]);
    setShowItemCreateDrawer(false);
  };

  // ── Revision Management: Save current revision snapshot before bumping ──
  const saveCurrentRevision = useCallback(async (reason?: string): Promise<string | null> => {
    if (!id || !organisation?.id) return null;
    const currentRevNo = revisionNo || 1;
    const newRevNo = currentRevNo + 1;
    const revisionSnapshot = {
      revision_no: currentRevNo,
      saved_at: new Date().toISOString(),
      reason: reason || revisionReason || '',
      items: items.map(item => ({ ...item })),
      header: {
        subtotal: totals.subtotal,
        total: totals.total,
        discount_amount: Number(discountAmount) || 0,
        discount_percent: Number(discountPercent) || 0,
      },
    };
    const newHistory = [...(revisionHistory || []), revisionSnapshot];
    try {
      const { error } = await supabase
        .from('proforma_invoices')
        .update({
          revision_no: newRevNo,
          revision_history: newHistory,
          revision_reason: reason || revisionReason || null,
        })
        .eq('id', id);
      if (error) throw error;
      setRevisionNo(newRevNo);
      setRevisionHistory(newHistory);
      setRevisionReason(reason || revisionReason || '');
      return newRevNo;
    } catch (err) {
      console.error('Error saving revision:', err);
      return null;
    }
  }, [id, organisation?.id, revisionNo, revisionHistory, revisionReason, items, totals, discountAmount, discountPercent]);

  const handleSave = async (shouldPrint: boolean = false) => {
    if (!clientId || !organisation?.id) {
      alert('Please select a client');
      return;
    }

    // For existing documents, ask for revision reason before proceeding
    if (!isNew && id) {
      setPendingSaveWithReason({ shouldPrint });
      setReasonDialogOpen(true);
      return;
    }

    await executeSave(shouldPrint);
  };

  const executeSave = async (shouldPrint: boolean = false) => {
    if (!clientId || !organisation?.id) {
      alert('Please select a client');
      return;
    }

    // Zod validation
    const proformaValidationSchema = z.object({
      client_id: z.string().min(1, 'Client is required'),
      items: z.array(z.object({
        description: z.string().min(1, 'Item description is required'),
        qty: z.number().positive('Qty must be greater than 0'),
        rate: z.number().min(0, 'Rate cannot be negative'),
        amount: z.number().min(0, 'Amount cannot be negative'),
        tax_percent: z.number().min(0).max(100),
      })).min(1, 'At least one item is required'),
      pi_number: z.string().optional(),
      created_at: z.string().min(1, 'Date is required'),
      payment_terms: z.string().optional(),
    });

    const validationResult = proformaValidationSchema.safeParse({
      client_id: clientId,
      items: items.map(item => ({
        description: item.description,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount,
        tax_percent: item.tax_percent || 18,
      })),
      pi_number: proformaNumber,
      created_at: proformaDate ? new Date(proformaDate).toISOString() : new Date().toISOString(),
      payment_terms: paymentTerms,
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      alert(firstError.message);
      setSaving(false);
      return;
    }
    
    setSaving(true);
    try {
      const validItems = items.filter(item => item.description?.trim());
      
      if (validItems.length === 0) {
        setSaving(false);
        alert('Please add at least one item with description');
        return;
      }
      
      // Generate and reserve PI number for new proforma
      if (isNew && proformaNumber) {
        await generatePINumber(true);
      }
      
      const input: ProformaInput & { organisation_id: string } = {
        client_id: clientId,
        company_state: companyState || null,
        client_state: clientState || null,
        pi_number: proformaNumber || undefined,
        created_at: proformaDate ? new Date(proformaDate).toISOString() : new Date().toISOString(),
        discount_amount: Number(discountAmount) || 0,
        discount_percent: Number(discountPercent) || 0,
        po_number: poNumber || undefined,
        po_date: poDate || undefined,
        template_id: templateId || undefined,
        authorized_signatory_id: authorizedSignatoryId || null,
        render_as_tax_invoice: renderAsTaxInvoice,
        items: validItems.map(item => ({
          description: item.description,
          hsn_code: item.hsn_code || null,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
          discount_percent: item.discount_percent || 0,
          discount_amount: 0,
          tax_percent: item.tax_percent || 18,
          item_id: item.item_id || null,
          variant_id: item.variant_id || null,
          discount_category_id: item.discount_category_id || null,
          make: item.make || null,
          variant: item.variant || null,
          unit: item.unit || null,
          meta_json: { 
            tax_percent: item.tax_percent || 18, 
            rate_after_discount: item.rate_after_discount,
            custom1: item.custom1 || null,
            custom2: item.custom2 || null
          },
        })),
        notes,
        terms,
        payment_terms: paymentTerms || undefined,
        organisation_id: organisation.id,
      };
      
      let savedProforma;
      // Note: revision snapshot is saved in the onConfirm handler before executeSave is called
      if (isNew) {
        savedProforma = await createProforma(input);
      } else if (id) {
        savedProforma = await updateProforma(id, input);
      }

      // Update source document status if this was a conversion
      if (conversionInfoRef.current && savedProforma) {
        const { type, sourceId } = conversionInfoRef.current;
        const { status } = useConversionStatus(type);
        const tableName = getSourceTableName(type);

        await supabase
          .from(tableName)
          .update({
            status,
            converted_to_id: savedProforma.id,
            converted_to_type: 'proforma',
          })
          .eq('id', sourceId);
      }

      // Update PO line item billing after successful save (first creation only)
      if (isNew && savedProforma && savedProforma.id && selectedPOLineItems.length > 0) {
        try {
          const poItems = selectedPOLineItems.map((poItem: any) => ({
            po_line_item_id: poItem.id,
            po_id: selectedPOId,
            description: poItem.description,
            qty: poItem.quantity,
            rate: poItem.rate_per_unit,
            amount: poItem.full_amount || poItem.basic_amount || 0,
            original_qty: poItem.original_quantity,
            original_rate: poItem.original_rate || poItem.rate_per_unit,
            overbilling_reason: poItem.overbilling_reason || null,
          })).filter((p: any) => p.po_line_item_id);
          if (poItems.length > 0) {
            await updatePoLineItemBilling({
              organisationId: organisation.id,
              sourceType: 'proforma',
              sourceId: savedProforma.id,
              sourceNumber: savedProforma.pi_number || undefined,
              items: poItems,
            });
          }
        } catch (billingError) {
          console.error('Failed to update PO billing:', billingError);
        }
      }

      if (shouldPrint && savedProforma && savedProforma.id) {
        const { downloadProformaPdf } = await import('../pdf');
        await downloadProformaPdf(savedProforma.id, { 
          organisationId: organisation.id,
          isReviewCopy: renderAsTaxInvoice,
          showWatermark: showWatermark
        });
      }

      navigate('/proforma-invoices');
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const { mutate: sendMutate } = useMutation({
    mutationFn: async () => {
      if (!id || !organisation?.id) throw new Error('Missing params');
      return sendProforma(id, organisation.id);
    },
    onSuccess: () => {
      navigate('/proforma-invoices');
    },
  });

  const { mutate: acceptMutate } = useMutation({
    mutationFn: async () => {
      if (!id || !organisation?.id) throw new Error('Missing params');
      return markAccepted(id, organisation.id);
    },
    onSuccess: () => {
      navigate('/proforma-invoices');
    },
  });

  const handleConvertToInvoice = () => {
    if (!id) return;
    navigate(`/invoices/create?convertFrom=proforma-to-invoice&sourceId=${id}`);
  };

  // Fixed dropdown layout hook for inline cell pickers
  const openDropdownAtRef = (ref: React.RefObject<HTMLElement | null>, setStyle: React.Dispatch<React.SetStateAction<React.CSSProperties>>) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #d4d4d4',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxHeight: '200px',
        overflowY: 'auto',
      });
    }
  };

  // Inline Variant cell popover picker
  const VariantCell = ({ value, variants: vList, onChange }: { value: string | null; variants: any[]; onChange: (val: string | null) => void }) => {
    const [open, setOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const ref = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node) && listRef.current && !listRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      const handleScroll = () => setOpen(false);
      if (open) {
        document.addEventListener('mousedown', handler);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
          document.removeEventListener('mousedown', handler);
          window.removeEventListener('scroll', handleScroll);
        };
      }
    }, [open]);

    const selected = vList.find(v => v.id === value || v.variant_name === value);
    const filtered = vList;

    return (
      <>
        <div ref={ref} onClick={() => { openDropdownAtRef(ref, setDropdownStyle); setOpen(true); }} style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '11px', color: value ? '#0f172a' : '#94a3b8', fontWeight: value ? 500 : 400, background: '#fff', border: '1px solid transparent', borderRadius: '0', minHeight: '28px', display: 'flex', alignItems: 'center', userSelect: 'none' }}
          onMouseEnter={e => { (e.currentTarget).style.borderColor = '#3b82f6'; }}
          onMouseLeave={e => { (e.currentTarget).style.borderColor = 'transparent'; }}
        >
          {selected ? selected.variant_name : 'No Category'}
        </div>
        {open && (
          <div ref={listRef} style={dropdownStyle}>
            <div onClick={() => { onChange(null); setOpen(false); }} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 400, color: '#94a3b8', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >No Category</div>
            {filtered.map(v => (
              <div key={v.id} onClick={() => { onChange(v.id); setOpen(false); }} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', color: '#1e293b', borderBottom: '1px solid #f3f4f6' }}
                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >{v.variant_name}</div>
            ))}
          </div>
        )}
      </>
    );
  };

  // Header helpers for dynamic column spans
  const getVisibleColumnCount = () => {
    let count = 1; // #
    if (templateSettings?.column_settings?.optional?.hsn_code !== false) count++;
    if (templateSettings?.column_settings?.optional?.item !== false) count++;
    if (templateSettings?.column_settings?.optional?.client_part_no === true) count++;
    if (templateSettings?.column_settings?.optional?.client_description === true) count++;
    if (templateSettings?.column_settings?.optional?.make !== false) count++;
    if (templateSettings?.column_settings?.optional?.variant !== false) count++;
    count += 1; // Discount Category
    count += 1; // qty
    if (templateSettings?.column_settings?.optional?.unit !== false) count++;
    if (templateSettings?.column_settings?.optional?.rate !== false) count++;
    if (templateSettings?.column_settings?.optional?.discount_percent !== false) count++;
    if (templateSettings?.column_settings?.optional?.rate_after_discount !== false) count++;
    if (templateSettings?.column_settings?.optional?.tax_percent !== false) count++;
    if (templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels) count++;
    if (templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels) count++;
    count += 2; // amount, delete
    return count;
  };

  const getColsBeforeAmount = () => {
    return getVisibleColumnCount() - 2;
  };

  const inputStyle = { padding: '4px 8px', fontSize: '12px' };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
        <Loader2 className="animate-spin text-sky-600" size={24} />
      </div>
    );
  }

  return (
    <div>
      <DocumentActionBar
        title={isNew ? 'Create Proforma' : 'Edit Proforma'}
        fixed={{ top: 32, left: 220 }}
        rightActions={
          <>
            <ImportButton onClick={() => setIsParserOpen(true)} />
            <SecondaryButton onClick={() => navigate('/proforma-invoices')}>Cancel</SecondaryButton>
            <SecondaryButton onClick={() => handleSave(false)} disabled={saving || !clientId}>
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              Save as Draft
            </SecondaryButton>
            <PrimaryButton onClick={() => handleSave(true)} disabled={saving || !clientId}>
              {saving ? <Loader2 className="animate-spin" size={14} /> : <FileCheck size={14} />}
              Save & Print
            </PrimaryButton>
          </>
        }
      />

      {/* Main page layout (paddingTop offsets the fixed action bar at top:32 + ~68px height = 100px) */}
      <div style={{ background: '#f8fafc', padding: '100px 16px 16px', minHeight: 'calc(100vh - 64px)' }}>
        {activeImportSessionId && (
          <div className="bg-indigo-900/40 border border-indigo-800/60 text-indigo-200 px-6 py-3 rounded-lg flex items-center justify-between text-xs font-semibold mb-4 animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-50/20 text-indigo-300 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">AI Imported</span>
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
        
        {/* Conversion Chain Breadcrumb */}
        {id && (
          <div style={{ marginBottom: '12px' }}>
            <DocumentConversionChain documentType="proforma" documentId={id} />
          </div>
        )}

        {/* Document Details Grid */}
        <HeaderFormGrid>
          
          {/* Column 1: CLIENT CARD */}
          <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Client">
            
            <HeaderField label="Client *" labelWidth="70px">
              <div style={{ position: 'relative' }} className="client-dropdown-container">
                <input
                  type="text"
                  className="form-input"
                  style={inputStyle}
                  placeholder="Search or select client..."
                  value={clientSearch !== null ? clientSearch : (clientId ? clients.find(c => c.id === clientId)?.client_name || '' : '')}
                  onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); }}
                  onClick={() => setIsClientDropdownOpen(true)}
                  onFocus={() => setIsClientDropdownOpen(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setClientSearch(null);
                    }, 200);
                  }}
                  disabled={!isNew}
                />
                {isClientDropdownOpen && isNew && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                    {clients
                      .filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map(c => (
                        <div key={c.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                          onClick={() => { setClientId(c.id); setIsClientDropdownOpen(false); setClientSearch(null); }}
                        >{c.client_name}</div>
                      ))}
                    {clients.filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No clients found</div>
                    )}
                  </div>
                )}
              </div>
            </HeaderField>

            <HeaderField label="Client State" labelWidth="70px">
              <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clientState || 'Auto-populated from client'}</div>
            </HeaderField>
            {clientId && (
              <>
                <HeaderField label="Contact" labelWidth="70px">
                  <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedClient?.contact || selectedClient?.email || 'N/A'}</div>
                </HeaderField>
                <HeaderField label="Address" labelWidth="70px">
                  <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'pre-wrap', minHeight: '32px', lineHeight: '1.4' }}>{billingAddress || 'Auto-populated from client'}</div>
                </HeaderField>
                <HeaderField label="GSTIN" labelWidth="70px">
                  <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedClient?.gstin || 'N/A'}</div>
                </HeaderField>
              </>
            )}
            
            {clientId && (
              <HeaderField label="Pricing" labelWidth="70px">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ArcPricingToggle
                    clientId={clientId}
                    enabled={useArcPricing}
                    onChange={(enabled) => {
                      if (enabled && items.length > 0) {
                        setArcPricingConfirmOpen(true);
                      } else {
                        setUseArcPricing(enabled);
                        if (!enabled) {
                          setArcPricingMap({});
                        }
                      }
                    }}
                  />
                  <ArcPricingStatusBadge
                    totalItems={items.length}
                    itemsWithArcRate={Object.values(arcPricingMap).filter(Boolean).length}
                    itemsWithoutArcRate={items.length - Object.values(arcPricingMap).filter(Boolean).length}
                  />
                </div>
              </HeaderField>
            )}
          </HeaderCard>

          {/* Column 2: DOCUMENT CARD */}
          <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Document">
            
            <HeaderField label="PI Number" labelWidth="70px">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="text" className="form-input" style={{ ...inputStyle, flex: 1 }} value={proformaNumber} onChange={(e) => setProformaNumber(e.target.value)} placeholder="Auto-generated" disabled={!isNew} />
                <RevisionBadge revisionNo={revisionNo} onClick={() => setRevisionDialogOpen(true)} />
              </div>
            </HeaderField>
            
            <HeaderField label="Date" labelWidth="70px">
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', minWidth: '0px' }}>
                <CustomDatePicker value={proformaDate} onChange={(val) => setProformaDate(val)} inputStyle={{ flex: '1 1 0%', minWidth: '0px' }} />
              </div>
            </HeaderField>

            <HeaderField label="Status" labelWidth="70px">
              <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {status}
                <PdfFlavorSelector
                  value={pdfFlavor}
                  onChange={(flavor) => {
                    setPdfFlavor(flavor);
                    const config = getFlavorConfig(flavor);
                    setRenderAsTaxInvoice(config.isReviewCopy);
                    setShowWatermark(config.showWatermark);
                    localStorage.setItem('proforma_watermark_default', config.showWatermark ? 'true' : 'false');
                  }}
                />
              </div>
            </HeaderField>
            <HeaderField label="Payment" labelWidth="70px">
              <input type="text" className="form-input" style={inputStyle} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g., Net 30, 50% Advance" />
            </HeaderField>
          </HeaderCard>

          {/* Column 3: PO DETAILS CARD */}
          <HeaderCard icon={<Briefcase size={14} style={{ color: '#2563eb' }} />} title="PO & Template">
            
            <HeaderField label="Template" labelWidth="70px">
              <select className="form-select" style={inputStyle} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Default Template</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.template_name} ({template.document_type})
                  </option>
                ))}
              </select>
            </HeaderField>

            <HeaderField label="Your State" labelWidth="70px">
              <input type="text" className="form-input" style={inputStyle} value={companyState} onChange={(e) => setCompanyState(e.target.value)} placeholder="e.g., Karnataka" />
            </HeaderField>

            <HeaderField label="PO Number" labelWidth="70px">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '11px', fontWeight: 500, cursor: 'pointer', color: '#4b5563' }}>
                  <input
                    type="checkbox"
                    checked={manualPO}
                    onChange={(e) => {
                      setManualPO(e.target.checked);
                      if (e.target.checked) {
                        setPoNumber('');
                        setPoDate('');
                        setSelectedPOId(null);
                      }
                    }}
                    style={{ cursor: 'pointer', width: '13px', height: '13px' }}
                  />
                  Manual Entry
                </label>
                {manualPO ? (
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="form-input"
                    style={inputStyle}
                    placeholder="Enter PO number"
                  />
                ) : (
                  <select
                    value={clientPOs.find(po => po.po_number === poNumber)?.po_number || ''}
                    onChange={(e) => {
                      const selectedPO = clientPOs.find(po => po.po_number === e.target.value);
                      if (selectedPO) {
                        setPoNumber(selectedPO.po_number);
                        setPoDate(selectedPO.po_date || '');
                        setSelectedPOId(selectedPO.id);
                      } else {
                        setPoNumber('');
                        setPoDate('');
                        setSelectedPOId(null);
                      }
                    }}
                    className="form-select"
                    style={inputStyle}
                  >
                    <option value="">Select PO (Optional)</option>
                    {clientPOs.map(po => (
                      <option key={po.id} value={po.po_number}>
                        {po.po_number} (Bal: {formatCurrency(po.po_available_value)})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </HeaderField>

            <HeaderField label="PO Date" labelWidth="70px">
              <div style={{ flex: 1, display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap', minWidth: '0px' }}>
                <CustomDatePicker value={poDate} onChange={(val) => setPoDate(val)} inputStyle={{ flex: '1 1 0%', minWidth: '0px' }} />
              </div>
            </HeaderField>

            {/* Choose PO Line Items button */}
            {!manualPO && poNumber && poDetailsQuery.data && (
              <HeaderField label="" labelWidth="70px">
                <button
                  onClick={handleChoosePOLineItems}
                  disabled={!poDetailsQuery.data?.items?.length}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: poDetailsQuery.data?.items?.length ? '#059669' : '#d1d5db',
                    color: poDetailsQuery.data?.items?.length ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: poDetailsQuery.data?.items?.length ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (poDetailsQuery.data?.items?.length) { (e.currentTarget as HTMLElement).style.background = '#047857'; } }}
                  onMouseLeave={e => { if (poDetailsQuery.data?.items?.length) { (e.currentTarget as HTMLElement).style.background = '#059669'; } }}
                >
                  <FileText size={14} />
                  Choose PO Line Items {poDetailsQuery.data?.items?.length ? `(${poDetailsQuery.data.items.length} available)` : ''}
                </button>
              </HeaderField>
            )}

            {/* Pricing Rules (Discount Categories) */}
            {discountCategories.length > 0 && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
                <div style={{ fontWeight: 600, fontSize: '11px', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Pricing Rules (Discount Categories)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {discountCategories.map((dc) => (
                    <div key={dc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', padding: '4px 8px', fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '4px', minHeight: '32px' }}>
                      <span style={{ fontWeight: 600, color: '#374151', fontSize: '11px', flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dc.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                        <input
                          type="number"
                          style={{ width: '45px', padding: '3px 4px', fontSize: '11px', fontWeight: 700, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: '3px' }}
                          value={headerDiscounts[dc.id] ?? dc.default_discount_percent ?? 0}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                            setHeaderDiscounts(prev => ({ ...prev, [dc.id]: val }));
                          }}
                          onBlur={(e) => {
                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                            handleHeaderDiscountChange(dc.id, val);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          min="0" max="100" step="0.01"
                        />
                        <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}


          </HeaderCard>
        </HeaderFormGrid>

        <ProformaItemsTable
          items={items}
          setItems={setItems}
          materials={materials}
          variants={variants}
          variantPricing={variantPricing}
          discountCategories={discountCategories}
          discountCategoryMap={discountCategoryMap}
          templateSettings={templateSettings}
          clientId={clientId}
          handleItemChange={handleItemChange}
          handleMaterialChange={handleMaterialChange}
          handleAddItem={handleAddItem}
          handleRemoveItem={handleRemoveItem}
          setShowItemSelectorDrawer={setShowItemSelectorDrawer}
          setShowItemCreateDrawer={setShowItemCreateDrawer}
          setShowCustomLabelEditor={setShowCustomLabelEditor}
          onShowItemPicker={() => setShowItemPicker(true)}
          onAddSectionHeader={addSectionHeaderRow}
          onAddSubtotal={addSubtotalRow}
          getVisibleColumnCount={getVisibleColumnCount}
          getColsBeforeAmount={getColsBeforeAmount}
          qtyDrafts={qtyDrafts}
          setQtyDrafts={setQtyDrafts}
          commitQtyInput={commitQtyInput}
          resetQtyInput={resetQtyInput}
          draggingItemId={draggingItemId}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDropOnRow={handleDropOnRow}
          handleDragEnd={handleDragEnd}
          moveToDialog={moveToDialog}
          openMoveToDialog={openMoveToDialog}
          confirmMoveTo={confirmMoveTo}
          setMoveToDialog={setMoveToDialog}
          totals={totals}
          roundOff={roundOff}
        />

        {/* Bottom grid layout: Notes, Terms, and Adjustments */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_300px] gap-4 mt-6">
          {/* Notes Card */}
          <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Notes & Remarks:</label>
            </div>
            <textarea
              className="form-input"
              style={{ width: '100%', minHeight: '36px', fontSize: '13px', resize: 'none', overflow: 'hidden' }}
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
            />
          </div>

          {/* Terms Card */}           <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
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
                 {terms ? 'Edit' : 'Add'}
               </button>
             </div>
             <textarea
               className="form-input"
               style={{ width: '100%', minHeight: '36px', fontSize: '13px', resize: 'none', overflow: 'hidden' }}
               placeholder="Payment terms, delivery terms, etc..."
               value={terms}
               onChange={(e) => {
                 setTerms(e.target.value);
                 e.target.style.height = 'auto';
                 e.target.style.height = e.target.scrollHeight + 'px';
               }}
             />
           </div>

          {/* Adjustments Card */}
          <div className="cq-card-elevated">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ fontWeight: 600, fontSize: '11px', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px', marginBottom: '4px' }}>
                Adjustments & Summary
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#4b5563', fontSize: '12px' }}>Extra Discount %</span>
                <input
                  type="number"
                  className="form-input text-right"
                  style={{ width: '80px', height: '28px', padding: '4px 8px', fontSize: '12px' }}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#4b5563', fontSize: '12px' }}>Extra Discount Amt</span>
                <input
                  type="number"
                  className="form-input text-right"
                  style={{ width: '100px', height: '28px', padding: '4px 8px', fontSize: '12px' }}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#4b5563', fontSize: '12px' }}>Round Off</span>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roundOff}
                    onChange={(e) => setRoundOff(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    style={{ cursor: 'pointer' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#4b5563', fontSize: '12px' }}>PDF Output</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Set in header bar</span>
              </div>

              {/* Authorized Signatory */}
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Authorized Signatory</div>
                <div 
                  className="relative cursor-pointer flex items-center justify-between px-3 py-1.5 border border-zinc-300 rounded bg-white text-zinc-700 text-xs font-medium hover:bg-zinc-50 hover:border-zinc-400 transition-all shadow-sm"
                  onClick={() => setIsSigDropdownOpen(!isSigDropdownOpen)}
                >
                  <span>
                    {authorizedSignatoryId
                      ? ((organisationDetails as any)?.signatures || []).find((s: any) => String(s.id) === String(authorizedSignatoryId))?.name || 'Select Signatory...'
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
                          setAuthorizedSignatoryId('');
                          setIsSigDropdownOpen(false);
                        }}
                      >
                        Select Signatory...
                      </div>
                      {((organisationDetails as any)?.signatures || []).length > 0 ? (
                        ((organisationDetails as any)?.signatures || []).map((sig: any) => (
                          <div 
                            key={String(sig.id)} 
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            onClick={() => {
                              setAuthorizedSignatoryId(String(sig.id));
                              setIsSigDropdownOpen(false);
                            }}
                          >
                            {sig.name}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '8px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>
                          No signatures - Add in Settings → Organisation
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {authorizedSignatoryId && (
                  <div className="bg-white border border-zinc-200 rounded px-3 py-2 shadow-sm mt-2">
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Signature Preview</div>
                    <div className="h-8 flex items-center">
                      {(() => {
                        const sigId = String(authorizedSignatoryId);
                        const selectedSig = ((organisationDetails as any)?.signatures || []).find((s: any) => String(s.id) === sigId);
                        if (selectedSig?.url) {
                          return <img src={selectedSig.url} alt={selectedSig.name} className="max-h-7 max-w-[120px] object-contain" />;
                        }
                        return <span className="text-zinc-400 text-[11px]">No signature preview</span>;
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Status workflow actions inside adjustments sidebar */}
              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!isNew && status === 'draft' && (
                  <button type="button" onClick={() => sendMutate()} className="w-full h-8 flex items-center justify-center gap-1.5 text-xs font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 rounded border border-sky-200 transition-all">
                    <Send size={13} /> Send to Client
                  </button>
                )}
                
                {!isNew && status === 'sent' && (
                  <button type="button" onClick={() => acceptMutate()} className="w-full h-8 flex items-center justify-center gap-1.5 text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 rounded border border-green-200 transition-all">
                    <CheckCircle size={13} /> Mark Accepted
                  </button>
                )}
                
                {!isNew && status === 'accepted' && !proforma?.converted_invoice_id && (
                  <button type="button" onClick={handleConvertToInvoice} className="w-full h-8 flex items-center justify-center gap-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 transition-all">
                    <FileCheck size={13} /> Convert to Invoice
                  </button>
                )}
              </div>

              {/* Grand Total Display */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '10px', borderTop: '2px solid #e5e7eb' }}>
                <span style={{ fontWeight: 700, color: '#1f2937', fontSize: '13px' }}>Grand Total</span>
                <span style={{ fontWeight: 800, color: '#185FA5', fontSize: '15px' }}>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <ItemSelectorDrawer
        isOpen={showItemSelectorDrawer}
        onClose={() => setShowItemSelectorDrawer(false)}
        onSuccess={handleItemSelectorSuccess}
      />

      <ItemCreateDrawer
        isOpen={showItemCreateDrawer}
        onClose={() => setShowItemCreateDrawer(false)}
        onSuccess={handleItemCreateSuccess}
      />

      {/* ARC Pricing Notice Dialog */}
      <Dialog open={arcPricingNotice} onOpenChange={setArcPricingNotice}>
        <DialogContent 
          className="sm:max-w-md" 
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === 'Space') {
              setArcPricingNotice(false);
            }
          }}
          tabIndex={0}
          style={{ paddingTop: '16px', paddingBottom: '16px' }}
        >
          <DialogHeader style={{ paddingLeft: '10px', paddingRight: '10px' }}>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="text-green-600 text-lg">✓</span>
              Using ARC Pricing
            </DialogTitle>
          </DialogHeader>
          <div style={{ paddingTop: '16px', paddingLeft: '10px', paddingRight: '10px', paddingBottom: '16px' }}>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Item rates will now use the <span className="font-semibold text-zinc-800">ARC / Annual Rate Contract / Fixed Pricing</span> configured for this client.
            </p>
            <p className="text-xs text-zinc-400 mt-4">
              Click anywhere or press any key to continue.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ARC Pricing Confirmation Dialog */}
      <ArcConfirmationDialog
        open={arcPricingConfirmOpen}
        onClose={() => {
          setArcPricingConfirmOpen(false);
        }}
        onApplyAll={() => {
          setUseArcPricing(true);
          setArcPricingConfirmOpen(false);
        }}
        onApplySelected={() => {
          setUseArcPricing(true);
          setArcPricingConfirmOpen(false);
        }}
        items={items.map((item: any, index: number) => ({
          id: item.id || `item-${index}`,
          description: item.meta_json?.material_name || item.description || `Item ${index + 1}`,
          currentRate: Number(item.rate) || 0,
          arcRate: arcPricingMap[item.meta_json?.material_id]?.[0]?.arc_rate || null,
          hasArcRate: Boolean(arcPricingMap[item.meta_json?.material_id]?.length > 0),
          variantId: item.meta_json?.variant_id,
          materialId: item.meta_json?.material_id,
        }))}
      />
      {/* AI Document Parser Modal */}
      <AiDocumentParserModal
        isOpen={isParserOpen}
        onClose={() => setIsParserOpen(false)}
        documentType="Proforma"
        currentHeaderValues={{
          party_id: clientId,
          party_name: clients.find((c: any) => c.id === clientId)?.client_name || '',
          date: proformaDate,
          reference_number: proformaNumber,
          payment_terms: paymentTerms
        }}
        onImport={handleImportSuccess}
      />

      {/* Columns Customization Modal */}
      {showCustomLabelEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCustomLabelEditor(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#18181b' }}>Column Settings</h3>
              <button onClick={() => setShowCustomLabelEditor(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 4px', color: '#71717a' }}>&times;</button>
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

      {/* Terms & Conditions Drawer */}
      {showTermsDrawer && (
        <TermsConditionsDrawer
          isOpen={showTermsDrawer}
          onClose={() => setShowTermsDrawer(false)}
          onSelect={(termsObj: any) => {
            setTerms(termsObj.terms_text);
            setShowTermsDrawer(false);
          }}
          documentType="Proforma"
        />
      )}

      {/* Add Multiple Items (Item Picker) Modal */}
      {showItemPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => { setShowItemPicker(false); setPickerItems([]); setItemSearch(''); }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '720px', height: '550px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Add Multiple Items</h3>
              <button onClick={() => { setShowItemPicker(false); setPickerItems([]); setItemSearch(''); }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 4px', color: '#71717a' }}>&times;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0 }}>
              {/* Left panel: Search + Material list */}
              <div style={{ borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                  <input
                    type="text"
                    placeholder="Search materials..."
                    className="form-input"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {(materials as any[])
                    .filter((m: any) => !itemSearch || (m.display_name || m.item_name || m.name || '').toLowerCase().includes(itemSearch.toLowerCase()))
                    .slice(0, 50)
                    .map((mat: any) => {
                      const isInPicker = pickerItems.some((p: any) => p.item_id === mat.id);
                      return (
                        <div
                          key={mat.id}
                          onClick={() => {
                            if (!isInPicker) {
                              setPickerItems((prev: any[]) => [...prev, {
                                item_id: mat.id,
                                name: mat.display_name || mat.item_name || mat.name || 'Unknown',
                                hsn_code: mat.hsn_code || '',
                                tax_percent: mat.gst_rate || 18,
                                unit: mat.unit || 'Nos',
                                qty: 1,
                                rate: 0,
                                material: mat,
                              }]);
                            }
                          }}
                          style={{
                            padding: '8px 12px',
                            cursor: isInPicker ? 'default' : 'pointer',
                            borderRadius: '6px',
                            marginBottom: '4px',
                            background: isInPicker ? '#f0fdf4' : 'transparent',
                            border: '1px solid transparent',
                            borderColor: isInPicker ? '#bbf7d0' : 'transparent',
                            fontSize: '13px',
                            color: '#1e293b',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={e => { if (!isInPicker) { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; } }}
                          onMouseLeave={e => { if (!isInPicker) { (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
                        >
                          <span style={{ fontWeight: isInPicker ? 600 : 400 }}>
                            {mat.display_name || mat.item_name || mat.name || 'Unknown'}
                          </span>
                          {isInPicker ? (
                            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Selected</span>
                          ) : (
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Click to add</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right panel: Selected items with qty inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: '13px', color: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Selected Items</span>
                  <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                    {pickerItems.length}
                  </span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {pickerItems.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                      Click materials on the left to add them here. Adjust quantities before inserting.
                    </div>
                  ) : (
                    pickerItems.map((pickerItem: any, idx: number) => (
                      <div key={pickerItem.item_id || idx} style={{ marginBottom: '6px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b', flex: 1 }}>
                            {pickerItem.name}
                          </span>
                          <button
                            onClick={() => setPickerItems((prev: any[]) => prev.filter((_: any, i: number) => i !== idx))}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
                            title="Remove"
                          >&times;</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>Qty:</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={pickerItem.qty}
                            onChange={(e) => {
                              const newQty = Math.max(0, parseFloat(e.target.value) || 0);
                              setPickerItems((prev: any[]) => prev.map((p: any, i: number) =>
                                i === idx ? { ...p, qty: newQty } : p
                              ));
                            }}
                            style={{
                              width: '60px',
                              padding: '3px 6px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '12px',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>{pickerItem.unit || 'Nos'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Insert button */}
                {pickerItems.length > 0 && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={() => {
                        // Single-pass batch insert: compute all items at once
                        const newItems = pickerItems.map((pickerItem: any) => {
                          const mat = pickerItem.material;
                          const dcId = mat?.discount_category_id || null;
                          const categoryDiscount = dcId ? (headerDiscounts[dcId] !== undefined ? headerDiscounts[dcId] : (discountCategoryMap[dcId]?.default_discount_percent ?? 0)) : 0;
                          const rate = getRateForItem(mat, null);
                          const rateAfterDiscount = rate - (rate * categoryDiscount / 100);
                          return {
                            description: '',
                            hsn_code: mat?.hsn_code || null,
                            qty: pickerItem.qty,
                            rate,
                            amount: pickerItem.qty * rateAfterDiscount,
                            discount_percent: categoryDiscount,
                            rate_after_discount: Math.max(0, rateAfterDiscount),
                            tax_percent: mat?.gst_rate || 18,
                            item_id: mat?.id || null,
                            variant_id: null,
                            discount_category_id: dcId,
                            make: null,
                            variant: null,
                            unit: mat?.unit || 'Nos',
                            custom1: '',
                            custom2: '',
                          } as LineItem;
                        });
                        setItems((prev) => [...prev.filter(i => i.description || i.item_id), ...newItems]);
                        setPickerItems([]);
                        setShowItemPicker(false);
                        setItemSearch('');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1d4ed8'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#2563eb'; }}
                    >
                      Insert Selected ({pickerItems.length}) Item{pickerItems.length > 1 ? 's' : ''}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO Line Items Selector Modal */}
      {isPOSelectorOpen && poDetailsQuery.data && (
        <POLineItemsSelector
          isOpen={isPOSelectorOpen}
          onClose={() => setIsPOSelectorOpen(false)}
          poHeader={{
            po_number: poDetailsQuery.data.header.po_number,
            po_total_value: poDetailsQuery.data.header.po_total_value,
            po_utilized_value: poDetailsQuery.data.header.po_utilized_value,
            po_available_value: poDetailsQuery.data.header.po_available_value,
          }}
          lineItems={poDetailsQuery.data.items}
          onApply={handlePOLineItemsApply}
        />
      )}

      {/* Revision Reason Dialog */}
      <RevisionReasonDialog
        open={reasonDialogOpen}
        onClose={() => {
          setReasonDialogOpen(false);
          setPendingSaveWithReason(null);
        }}
        onConfirm={async (reason) => {
          setRevisionReason(reason);
          setReasonDialogOpen(false);
          // Save the revision snapshot with the reason BEFORE executing the main save
          await saveCurrentRevision(reason);
          // Then execute the main save
          const pending = pendingSaveWithReason;
          setPendingSaveWithReason(null);
          if (pending) {
            executeSave(pending.shouldPrint);
          }
        }}
        currentRevisionNo={revisionNo}
        documentNumber={proformaNumber || 'PRO-0001'}
      />

      {/* Revision History Dialog */}
      <RevisionHistoryDialog
        open={revisionDialogOpen}
        onClose={() => setRevisionDialogOpen(false)}
        revisionHistory={revisionHistory}
        currentRevisionNo={revisionNo}
        currentTotal={totals?.total || 0}
        documentNumber={proformaNumber || 'PRO-0001'}
      />
    </div>
  );
}