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
import { FileText, Download, Trash2, Plus, ArrowLeft, Save, Send, CheckCircle, FileCheck, Loader2, Briefcase, Calendar, User, Info } from 'lucide-react';
import ItemSelectorDrawer from '../../components/ItemSelectorDrawer';
import ItemCreateDrawer from '../../components/ItemCreateDrawer';
import { useClientPOs } from '../hooks';
import { useConversionStatus, getSourceTableName } from '../../conversions/hooks';
import { withSessionCheck } from '../../queryClient';
import { ArcPricingToggle, ArcPricingStatusBadge } from '../../components/ArcPricingToggle';
import { getArcRateFromMap, fetchArcPricingForItems } from '../../lib/arc-pricing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ArcConfirmationDialog, type ArcPricingItem } from '../../components/ArcConfirmationDialog';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { InlineDescriptionCell } from '../../components/InlineDescriptionCell';

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

interface CustomDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
  disabled?: boolean;
}

function CustomDatePicker({ value, onChange, placeholder = "Select date", inputStyle, disabled }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => {
    return value ? new Date(value) : new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleSelectDay = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    const formatted = format(day, 'yyyy-MM-dd');
    onChange(formatted);
    setIsOpen(false);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const getFormattedValue = () => {
    if (!value) return '';
    try {
      return format(new Date(value), 'dd MMM yyyy');
    } catch (e) {
      return value;
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className="cq-datepicker-input"
        style={{ ...inputStyle, cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#f3f4f6' : undefined }}
      >
        <span style={{ color: value ? '#1f2937' : '#9ca3af', fontWeight: value ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {getFormattedValue() || placeholder}
        </span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          zIndex: 100,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
          padding: '12px',
          width: '250px'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <button type="button" onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '2px 6px', fontSize: '14px', fontWeight: 'bold' }}>&lt;</button>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button type="button" onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '2px 6px', fontSize: '14px', fontWeight: 'bold' }}>&gt;</button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd) => (
              <span key={wd} style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af' }}>{wd}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {/* Empty cells for leading days */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <span key={`empty-${i}`} />
            ))}
            
            {/* Days in Month */}
            {daysInMonth.map((day) => {
              const isSelected = value && isSameDay(day, new Date(value));
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={day.toString()}
                  type="button"
                  onClick={(e) => handleSelectDay(day, e)}
                  style={{
                    background: isSelected ? '#2563eb' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: isSelected || isToday ? 'bold' : 'normal',
                    color: isSelected ? 'white' : isToday ? '#2563eb' : '#374151',
                    cursor: 'pointer',
                    height: '24px',
                    width: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface LineItem {
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
  const { organisation } = useAuth();
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
  const [discountPercent, setDiscountPercent] = useState<number | string>(0);
  const [discountAmount, setDiscountAmount] = useState<number | string>(0);
  const [templateSettings, setTemplateSettings] = useState<any>(null);
  const [discountSettings, setDiscountSettings] = useState<Record<string, { default: number; min: number; max: number }>>({});
  const [headerDiscounts, setHeaderDiscounts] = useState<Record<string, number>>({});
  const [discountCategoryMap, setDiscountCategoryMap] = useState<Record<string, any>>({});
  const [authorizedSignatoryId, setAuthorizedSignatoryId] = useState('');
  const [isSigDropdownOpen, setIsSigDropdownOpen] = useState(false);

  // Client search UI state
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Top action bar measurement state
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

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

  // ARC Pricing state
  const [useArcPricing, setUseArcPricing] = useState(false);
  const [arcPricingMap, setArcPricingMap] = useState<Record<string, { item_id: string; arc_rate: number; company_variant_id: string | null; pricing_type: string; is_active: boolean }[]>>({});
  const [arcPricingNotice, setArcPricingNotice] = useState(false);
  const [arcPricingConfirmOpen, setArcPricingConfirmOpen] = useState(false);
  const [variantPricing, setVariantPricing] = useState<Record<string, Record<string, Record<string, number>>>>({});

  const { data: clients = [] } = useClients();
  const selectedClient = useMemo(() => clients.find(c => c.id === clientId) as any, [clients, clientId]);
  const billingAddress = useMemo(() => {
    if (!selectedClient) return '';
    return [selectedClient.address1, selectedClient.address2, selectedClient.city, selectedClient.state, selectedClient.pincode]
      .filter(Boolean)
      .join(', ');
  }, [selectedClient]);
  const { data: clientPOs = [] } = useClientPOs(clientId);
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
          description: mat.display_name || mat.item_name || mat.name || '',
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

  const handleItemSelectorSuccess = (newItems: any[]) => {
    const newLineItems = newItems.map((newItem: any) => {
      const dcId = newItem.discount_category_id || null;
      const categoryDiscount = dcId ? (headerDiscounts[dcId] || 0) : 0;
      const rate = getRateForItem(newItem, newItem.variant_id);
      const rateAfterDiscount = rate - (rate * categoryDiscount / 100);

      return {
        description: newItem.display_name || newItem.item_name || newItem.name,
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
        description: newItem.display_name || newItem.item_name,
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

  const handleSave = async (shouldPrint: boolean = false) => {
    if (!clientId || !organisation?.id) {
      alert('Please select a client');
      return;
    }

    const hasEmptyDescription = items.some(item => !item.description?.trim());
    if (hasEmptyDescription) {
      alert('Please fill in all item descriptions');
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

  const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle = { minWidth: '70px', maxWidth: '70px', fontWeight: 600, fontSize: '11px', color: '#374151' };
  const fieldColStyle = { flex: 1 };
  const inputStyle = { padding: '4px 8px', fontSize: '12px' };

  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
        <Loader2 className="animate-spin text-sky-600" size={24} />
      </div>
    );
  }

  return (
    <div>
      {/* Fixed top action bar */}
      <div ref={headerRef} className="flex items-center justify-between fixed top-0 left-0 right-0 z-50 bg-white pt-4 pb-3 px-6 border-b border-zinc-200" style={{ top: '32px', left: '220px', marginBottom: 0 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-zinc-900 tracking-tight">
            {isNew ? 'Create Proforma' : 'Edit Proforma'}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate('/proforma-invoices')} className="h-9 px-3 rounded flex items-center justify-center text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-all border border-zinc-300 bg-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || !clientId}
            className={`h-9 px-4 rounded flex items-center justify-center text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-all border border-zinc-300 bg-white ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            <span className="ml-1.5">Save as Draft</span>
          </button>
          <button
            type="button"
            style={{
              height: '36px', padding: '0 16px', minWidth: '100px',
              background: '#185FA5', border: '1px solid #185FA5',
              color: '#fff', borderRadius: '6px',
              fontSize: '12px', fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: (saving || !clientId) ? 'not-allowed' : 'pointer',
              opacity: (saving || !clientId) ? 0.6 : 1,
              transition: 'all 0.15s'
            }}
            onClick={() => handleSave(true)}
            disabled={saving || !clientId}
            onMouseEnter={e => { if (!saving && clientId) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
            onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <FileCheck size={14} />}
            <span className="ml-1.5">Save & Print</span>
          </button>
        </div>
      </div>

      {/* Main page layout */}
      <div style={{ paddingTop: headerHeight, background: '#f8fafc', padding: '16px', minHeight: 'calc(100vh - 64px)' }}>
        
        {/* Document Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
          
          {/* Column 1: CLIENT CARD */}
          <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '4px' }}>
              <User size={14} style={{ color: '#2563eb' }} /> Client
            </div>
            
            <div style={{ ...headerFieldStyle, marginBottom: '8px' }}>
              <span style={labelColStyle}>Client *:</span>
              <div style={{ ...fieldColStyle, position: 'relative' }} className="client-dropdown-container">
                <input
                  type="text"
                  className="form-input"
                  style={inputStyle}
                  placeholder="Search or select client..."
                  value={clientSearch || (clientId ? clients.find(c => c.id === clientId)?.client_name : '')}
                  onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); }}
                  onClick={() => setIsClientDropdownOpen(true)}
                  onFocus={() => setIsClientDropdownOpen(true)}
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
                          onClick={() => { setClientId(c.id); setClientSearch(c.client_name); setIsClientDropdownOpen(false); setClientSearch(''); }}
                        >{c.client_name}</div>
                      ))}
                    {clients.filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No clients found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {renderHeaderField('Client State:', <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clientState || 'Auto-populated from client'}</div>)}
            {clientId && (
              <>
                {renderHeaderField('Contact:', <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedClient?.contact || selectedClient?.email || 'N/A'}</div>)}
                {renderHeaderField('Address:', <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'pre-wrap', minHeight: '32px', lineHeight: '1.4' }}>{billingAddress || 'Auto-populated from client'}</div>)}
                {renderHeaderField('GSTIN:', <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedClient?.gstin || 'N/A'}</div>)}
              </>
            )}
            
            {clientId && (
              <div style={{ ...headerFieldStyle, marginBottom: '8px' }}>
                <span style={labelColStyle}>Pricing:</span>
                <div style={{ ...fieldColStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              </div>
            )}
          </div>

          {/* Column 2: DOCUMENT CARD */}
          <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '4px' }}>
              <FileText size={14} style={{ color: '#2563eb' }} /> Document
            </div>
            
            {renderHeaderField('PI Number:', <input type="text" className="form-input" style={inputStyle} value={proformaNumber} onChange={(e) => setProformaNumber(e.target.value)} placeholder="Auto-generated" disabled={!isNew} />)}
            
            <div style={{ ...headerFieldStyle, marginBottom: '8px', flexWrap: 'nowrap' }}>
              <span style={{ ...labelColStyle, whiteSpace: 'nowrap' }}>Date:</span>
              <div style={{ flex: 1, display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap', minWidth: '0px' }}>
                <CustomDatePicker value={proformaDate} onChange={(val) => setProformaDate(val)} inputStyle={{ flex: '1 1 0%', minWidth: '0px' }} />
              </div>
            </div>

            {renderHeaderField('Status:', <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', textTransform: 'capitalize' }}>{status}</div>)}
            {renderHeaderField('Payment:', <input type="text" className="form-input" style={inputStyle} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g., Net 30, 50% Advance" />, true)}
          </div>

          {/* Column 3: PO DETAILS CARD */}
          <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '4px' }}>
              <Briefcase size={14} style={{ color: '#2563eb' }} /> PO & Template
            </div>
            
            {renderHeaderField('Template:', <select className="form-select" style={inputStyle} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Default Template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.template_name} ({template.document_type})
                </option>
              ))}
            </select>)}

            {renderHeaderField('Your State:', <input type="text" className="form-input" style={inputStyle} value={companyState} onChange={(e) => setCompanyState(e.target.value)} placeholder="e.g., Karnataka" />)}

            <div style={{ ...headerFieldStyle, marginBottom: '8px' }}>
              <span style={labelColStyle}>PO Number:</span>
              <div style={{ ...fieldColStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '11px', fontWeight: 500, cursor: 'pointer', color: '#4b5563' }}>
                  <input
                    type="checkbox"
                    checked={manualPO}
                    onChange={(e) => {
                      setManualPO(e.target.checked);
                      if (e.target.checked) {
                        setPoNumber('');
                        setPoDate('');
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
                      } else {
                        setPoNumber('');
                        setPoDate('');
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
            </div>

            <div style={{ ...headerFieldStyle, marginBottom: '8px', flexWrap: 'nowrap' }}>
              <span style={{ ...labelColStyle, whiteSpace: 'nowrap' }}>PO Date:</span>
              <div style={{ flex: 1, display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap', minWidth: '0px' }}>
                <CustomDatePicker value={poDate} onChange={(val) => setPoDate(val)} inputStyle={{ flex: '1 1 0%', minWidth: '0px' }} />
              </div>
            </div>

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


          </div>
        </div>

        {/* Line Items Table Card */}
        <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-8">
          <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-sky-600 rounded-none"></div>
              <h3 className="text-lg font-bold text-zinc-900">Line Items</h3>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-none">
                {items.length} {items.length === 1 ? 'Item' : 'Items'} Total
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleAddItem} className="h-9 px-4 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 rounded shadow-sm">
                <Plus size={14} /> Add Item
              </button>
              <button type="button" onClick={() => setShowItemSelectorDrawer(true)} className="h-9 px-4 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 rounded shadow-sm">
                <Plus size={14} /> Select from Inventory
              </button>
              <button type="button" onClick={() => setShowItemCreateDrawer(true)} className="h-9 px-4 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 rounded shadow-sm">
                <Plus size={14} /> Create New Material
              </button>
            </div>
          </div>

          <div className="grid-table-container">
            <table className="grid-table cq-editable">
              <thead className="grid-table-header-dark">
                <tr>
                  <th className="col-shrink">#</th>
                  {(templateSettings?.column_settings?.optional?.hsn_code !== false) && <th className="col-hsn">HSN Code</th>}
                  {(templateSettings?.column_settings?.optional?.item !== false) && (
                    <th className="col-item" style={{ position: 'relative' }}>
                      {templateSettings?.column_settings?.labels?.item || 'Description'}
                    </th>
                  )}
                  {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
                    <th className="col-code">{templateSettings?.column_settings?.labels?.client_part_no || 'Client Part No'}</th>
                  )}
                  {(templateSettings?.column_settings?.optional?.client_description === true) && (
                    <th className="col-item">{templateSettings?.column_settings?.labels?.client_description || 'Client Description'}</th>
                  )}
                  {(templateSettings?.column_settings?.optional?.make !== false) && <th className="col-make">Make</th>}
                  {(templateSettings?.column_settings?.optional?.variant !== false) && <th className="col-variant">Variant</th>}
                  <th className="col-disc-cat">Discount Category</th>
                  <th className="col-qty">Qty</th>
                  {(templateSettings?.column_settings?.optional?.unit !== false) && <th className="col-unit">Unit</th>}
                  {(templateSettings?.column_settings?.optional?.rate !== false) && <th className="col-rate">Rate</th>}
                  {(templateSettings?.column_settings?.optional?.discount_percent !== false) && <th className="col-disc">Discount %</th>}
                  {(templateSettings?.column_settings?.optional?.rate_after_discount !== false) && <th className="col-rate-after-disc">Rate After Disc</th>}
                  {(templateSettings?.column_settings?.optional?.tax_percent !== false) && <th className="col-gst">Tax %</th>}
                  {templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels && (
                    <th className="col-custom">{templateSettings.column_settings.labels.custom1 || 'Custom 1'}</th>
                  )}
                  {templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels && (
                    <th className="col-custom">{templateSettings.column_settings.labels.custom2 || 'Custom 2'}</th>
                  )}
                  <th className="col-amount">Amount</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="text-center font-semibold text-[11px] text-zinc-500 pt-2">{index + 1}</td>
                    {(templateSettings?.column_settings?.optional?.hsn_code !== false) && (
                      <td className="cell-input">
                        <input
                          type="text"
                          className="cell-input text-center"
                          value={item.hsn_code ?? ''}
                          onChange={(e) => handleItemChange(index, 'hsn_code', e.target.value)}
                          placeholder="HSN"
                        />
                      </td>
                    )}
                    {(templateSettings?.column_settings?.optional?.item !== false) && (
                      <td className="col-item pr-6 relative">
                        <SearchableItemSelect
                          value={item.item_id || ''}
                          materials={materials}
                          onChange={(materialId, mat) => handleMaterialChange(index, mat)}
                        />
                        {item.item_id && (
                          <button
                            type="button"
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red-500 font-bold text-sm bg-transparent border-none p-1 z-10"
                            onClick={() => handleMaterialChange(index, null)}
                            title="Clear item"
                          >
                            ×
                          </button>
                        )}
                        <InlineDescriptionCell
                          materialName=""
                          description={item.description}
                          onSave={(desc) => handleItemChange(index, 'description', desc)}
                        />
                      </td>
                    )}
                    {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
                      <td className="col-shrink cell-static text-center" style={{ fontSize: '11px', color: '#64748b', padding: '4px' }}>
                        {(() => {
                          const mapping = clientId && ((materials as any[]).find(m => m.id === item.item_id)?.mappings as any[])?.find((m: any) => m.client_id === clientId) as any;
                          return mapping?.client_part_no || '-';
                        })()}
                      </td>
                    )}
                    {(templateSettings?.column_settings?.optional?.client_description === true) && (
                      <td className="col-item cell-static" style={{ fontSize: '11px', color: '#64748b', padding: '4px' }}>
                        {(() => {
                          const mapping = clientId && ((materials as any[]).find(m => m.id === item.item_id)?.mappings as any[])?.find((m: any) => m.client_id === clientId) as any;
                          return mapping?.client_description || '-';
                        })()}
                      </td>
                    )}
                    {(templateSettings?.column_settings?.optional?.make !== false) && (
                      <td className="cell-input">
                        <input
                          type="text"
                          className="cell-input text-center"
                          value={item.make ?? ''}
                          onChange={(e) => handleItemChange(index, 'make', e.target.value)}
                          placeholder="Make"
                          list={`make-options-${index}`}
                          autoComplete="off"
                        />
                        <datalist id={`make-options-${index}`}>
                          {Array.from(new Set(items.map(i => i.make).filter(Boolean) as string[])).map((make) => (
                            <option key={make} value={make} />
                          ))}
                        </datalist>
                      </td>
                    )}
                    {(templateSettings?.column_settings?.optional?.variant !== false) && (
                      <td className="col-shrink relative">
                        <VariantCell
                          value={item.variant_id}
                          variants={variants}
                          onChange={(nextVariant) => {
                            const selectedVariant = variants.find(v => v.id === nextVariant);
                            handleItemChange(index, 'variant_id', nextVariant);
                            handleItemChange(index, 'variant', selectedVariant?.variant_name || null);
                          }}
                        />
                      </td>
                    )}
                    <td className="cell-input">
                      <select
                        className="cell-input text-center"
                        value={item.discount_category_id || ''}
                        onChange={(e) => handleItemChange(index, 'discount_category_id', e.target.value || null)}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '12px' }}
                      >
                        <option value="">None</option>
                        {discountCategories.map(dc => (
                          <option key={dc.id} value={dc.id}>{dc.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="cell-input">
                      <input
                        type="number"
                        className="cell-input text-right"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))}
                        min="0"
                        step="0.001"
                      />
                    </td>
                    {(templateSettings?.column_settings?.optional?.unit !== false) && (
                      <td className="cell-input">
                        <input
                          type="text"
                          className="cell-input text-center"
                          value={item.unit ?? ''}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          placeholder="Unit"
                        />
                      </td>
                    )}
                    <td className="cell-input">
                      <input
                        type="number"
                        className="cell-input text-right"
                        value={item.rate}
                        onChange={(e) => handleItemChange(index, 'rate', Number(e.target.value))}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    {(templateSettings?.column_settings?.optional?.discount_percent !== false) && (
                      <td className="cell-input">
                        <input
                          type="number"
                          className="cell-input text-right"
                          value={item.discount_percent}
                          onChange={(e) => handleItemChange(index, 'discount_percent', Number(e.target.value))}
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                        />
                      </td>
                    )}
                    {(templateSettings?.column_settings?.optional?.rate_after_discount !== false) && (
                      <td className="cell-input">
                        <input
                          type="number"
                          className="cell-input text-right bg-zinc-50/50 cursor-default font-medium"
                          value={item.rate_after_discount}
                          readOnly
                          placeholder="0"
                        />
                      </td>
                    )}
                    {(templateSettings?.column_settings?.optional?.tax_percent !== false) && (
                      <td className="cell-input">
                        <input
                          type="number"
                          className="cell-input text-right"
                          value={item.tax_percent}
                          onChange={(e) => handleItemChange(index, 'tax_percent', Number(e.target.value))}
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="18"
                        />
                      </td>
                    )}
                    {templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels && (
                      <td className="cell-input">
                        <input
                          type="text"
                          className="cell-input text-center"
                          value={item.custom1 || ''}
                          onChange={(e) => handleItemChange(index, 'custom1', e.target.value)}
                          placeholder={templateSettings.column_settings.labels.custom1 || 'Custom 1'}
                          style={{ width: '100%' }}
                        />
                      </td>
                    )}
                    {templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels && (
                      <td className="cell-input">
                        <input
                          type="text"
                          className="cell-input text-center"
                          value={item.custom2 || ''}
                          onChange={(e) => handleItemChange(index, 'custom2', e.target.value)}
                          placeholder={templateSettings.column_settings.labels.custom2 || 'Custom 2'}
                          style={{ width: '100%' }}
                        />
                      </td>
                    )}
                    <td className="text-right pr-4 font-semibold text-[12px] pt-2 tabular-nums" style={{ color: '#0f172a' }}>
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="text-center pt-1.5">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-500 hover:bg-red-50 hover:text-red-700 w-5 h-5 rounded flex items-center justify-center transition-all mx-auto"
                        disabled={items.length === 1}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Subtotal & taxes breakdown inside the table footer */}
                <tr className="footer-breakdown-row">
                  <td colSpan={getColsBeforeAmount()} className="text-right pr-4 font-semibold" style={{ textAlign: 'right' }}>Subtotal</td>
                  <td className="text-right pr-4 tabular-nums font-semibold" style={{ textAlign: 'right', paddingRight: '16px' }}>
                    {formatCurrency(totals.subtotal)}
                  </td>
                  <td></td>
                </tr>

                {totals.discount > 0 && (
                  <tr className="footer-breakdown-row">
                    <td colSpan={getColsBeforeAmount()} className="text-right pr-4 text-red-600 font-medium" style={{ textAlign: 'right' }}>Discount</td>
                    <td className="text-right pr-4 tabular-nums text-red-600 font-medium" style={{ textAlign: 'right', paddingRight: '16px' }}>
                      -{formatCurrency(totals.discount)}
                    </td>
                    <td></td>
                  </tr>
                )}

                {totals.cgst > 0 && (
                  <tr className="footer-breakdown-row">
                    <td colSpan={getColsBeforeAmount()} className="text-right pr-4" style={{ textAlign: 'right' }}>CGST</td>
                    <td className="text-right pr-4 tabular-nums" style={{ textAlign: 'right', paddingRight: '16px' }}>
                      {formatCurrency(totals.cgst)}
                    </td>
                    <td></td>
                  </tr>
                )}

                {totals.sgst > 0 && (
                  <tr className="footer-breakdown-row">
                    <td colSpan={getColsBeforeAmount()} className="text-right pr-4" style={{ textAlign: 'right' }}>SGST</td>
                    <td className="text-right pr-4 tabular-nums" style={{ textAlign: 'right', paddingRight: '16px' }}>
                      {formatCurrency(totals.sgst)}
                    </td>
                    <td></td>
                  </tr>
                )}

                {totals.igst > 0 && (
                  <tr className="footer-breakdown-row">
                    <td colSpan={getColsBeforeAmount()} className="text-right pr-4" style={{ textAlign: 'right' }}>IGST</td>
                    <td className="text-right pr-4 tabular-nums" style={{ textAlign: 'right', paddingRight: '16px' }}>
                      {formatCurrency(totals.igst)}
                    </td>
                    <td></td>
                  </tr>
                )}

                {roundOff && totals.roundOffAmount !== 0 && (
                  <tr className="footer-breakdown-row">
                    <td colSpan={getColsBeforeAmount()} className="text-right pr-4" style={{ textAlign: 'right' }}>Round Off</td>
                    <td className="text-right pr-4 tabular-nums" style={{ textAlign: 'right', paddingRight: '16px' }}>
                      {formatCurrency(totals.roundOffAmount)}
                    </td>
                    <td></td>
                  </tr>
                )}

                <tr className="footer-breakdown-row grand-total-row">
                  <td colSpan={getColsBeforeAmount()} className="text-right pr-4" style={{ textAlign: 'right' }}>Grand Total</td>
                  <td className="text-right pr-4 tabular-nums" style={{ textAlign: 'right', paddingRight: '16px' }}>
                    {formatCurrency(totals.total)}
                  </td>
                  <td></td>
                </tr>

                {totals.amountInWords && (
                  <tr className="footer-breakdown-row amount-words-row">
                    <td colSpan={getVisibleColumnCount()} className="text-right pr-4" style={{ textAlign: 'right' }}>
                      INR {totals.amountInWords}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

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

          {/* Terms Card */}
          <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Terms & Conditions:</label>
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
                <span style={{ fontWeight: 500, color: '#4b5563', fontSize: '12px' }}>Render as Tax Invoice (Review Copy)</span>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={renderAsTaxInvoice}
                    onChange={(e) => handleRenderAsTaxInvoiceChange(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    style={{ cursor: 'pointer' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, color: '#4b5563', fontSize: '12px' }}>Show DRAFT Watermark</span>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => handleShowWatermarkChange(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    style={{ cursor: 'pointer' }}
                  />
                </label>
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
    </div>
  );
}