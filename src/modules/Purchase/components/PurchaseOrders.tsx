import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, 
  FileText, 
  Mail, 
  Printer, 
  Eye, 
  ShoppingCart, 
  Edit, 
  Trash2,
  Filter,
  Search,
  ChevronRight,
  ChevronLeft,
  X,
  CheckSquare,
  Square,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Columns,
  Copy,
  Paperclip,
  Upload
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button as ShadcnButton } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/Badge';
import { AppTable } from '../../../components/ui/AppTable';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../../components/ui/select';
import { Label } from '../../../components/ui/label';
import { cn } from '../../../lib/utils';

import { useAuth } from '../../../contexts/AuthContext';
import { usePurchaseOrders, usePurchaseOrder, useVendors, useCreatePurchaseOrder, useUpdatePurchaseOrder, useUpdatePOStatus, useDeletePO } from '../hooks/usePurchaseQueries';
import { generatePOPDF, downloadPDF, openPDFPreview } from '../utils/pdfGenerator';
import { z } from 'zod';
import { 
  validateGSTIN, 
  validatePAN, 
  validatePIN, 
  validateEmail, 
  validateNoNumbers,
  validateQuantity 
} from '../utils/validation';
import { supabase } from '../../../supabase';

const APPROVAL_STEPS = ['Draft', 'Pending Approval', 'Approved', 'Sent', 'Acknowledged', 'Partially Received', 'Completed'];

const CURRENCIES = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
];

const GST_RATES = [0, 5, 12, 18, 28];

interface POItem {
  sr: number;
  item_id?: string;
  section?: string;
  item_name: string;
  make: string;
  variant: string;
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_percent: number;
  discount_amount: number;
  taxable_value: number;
  cgst_percent: number;
  cgst_amount: number;
  sgst_percent: number;
  sgst_amount: number;
  igst_percent: number;
  igst_amount: number;
  total_amount: number;
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    'Draft': { bg: 'bg-zinc-100', text: 'text-zinc-700' },
    'Pending Approval': { bg: 'bg-amber-100', text: 'text-amber-700' },
    'Approved': { bg: 'bg-sky-100', text: 'text-sky-700' },
    'Sent': { bg: 'bg-blue-100', text: 'text-blue-700' },
    'Acknowledged': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    'Completed': { bg: 'bg-green-100', text: 'text-green-700' },
    'Cancelled': { bg: 'bg-red-100', text: 'text-red-700' },
  };
  const colors = statusColors[status] || statusColors['Draft'];
  
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 h-5 rounded-full", colors.bg, colors.text)}>
      {status}
    </span>
  );
}

const numberToWords = (num: number): string => {
  if (Math.abs(num) < 0.01) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertBelow1000 = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelow1000(n % 100) : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = 'Rupees ';
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  if (crore) result += convertBelow1000(crore) + ' Crore ';
  if (lakh) result += convertBelow1000(lakh) + ' Lakh ';
  if (thousand) result += convertBelow1000(thousand) + ' Thousand ';
  if (hundred) result += convertBelow1000(hundred) + ' ';

  if (paise > 0) {
    result = result.trim() + ' and ' + convertBelow1000(paise) + ' Paise';
  }

  return result.trim() + ' Only';
};

export const PurchaseOrders: React.FC = () => {
  const { organisation } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openDialog, setOpenDialog] = useState(false);
  
  const issueIdParam = searchParams.get('issue_id');
  const actionParam = searchParams.get('action');
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [poNumber, setPoNumber] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [vendorId, setVendorId] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [terms, setTerms] = useState('Net 30');
  const [items, setItems] = useState<POItem[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    taxable: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 0,
    totalInr: 0,
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [termsContent, setTermsContent] = useState('');
  const [showTermsDrawer, setShowTermsDrawer] = useState(false);
  const [notes, setNotes] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const initializedRef = useRef(false);

  const markDirty = () => {
    if (initializedRef.current) {
      setIsDirty(true);
      isDirtyRef.current = true;
    }
  };

  useEffect(() => {
    const fp = searchParams.get('mode') === 'create' || searchParams.get('mode') === 'edit';
    if (!fp) return;
    initializedRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    const fp = searchParams.get('mode') === 'create' || searchParams.get('mode') === 'edit';
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    if (isDirty && fp) {
      window.addEventListener('beforeunload', handler);
    }
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, searchParams]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!vendorId) errors.vendor_id = 'Please select a vendor';
    if (!poDate) errors.po_date = 'PO date is required';
    if (items.length === 0) errors.items = 'At least one item is required';

    items.forEach((item, i) => {
      if (!item.item_name) errors[`items.${i}.item_name`] = 'Item name is required';
      if (!item.quantity || item.quantity <= 0) errors[`items.${i}.quantity`] = 'Quantity must be > 0';
      if (item.rate < 0) errors[`items.${i}.rate`] = 'Rate cannot be negative';
    });

    try {
      z.object({
        vendor_id: z.string().min(1, 'Please select a vendor'),
        po_date: z.string().min(1, 'PO date is required'),
        items: z.array(z.object({
          item_name: z.string().min(1, 'Item name is required'),
          quantity: z.number().min(0.001, 'Quantity must be > 0'),
          rate: z.number().min(0, 'Rate cannot be negative'),
        })).min(1, 'At least one item is required'),
      }).parse({
        vendor_id: vendorId,
        po_date: poDate,
        items: items.map(i => ({ item_name: i.item_name, quantity: i.quantity, rate: i.rate })),
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        e.errors.forEach(err => {
          const path = err.path.join('.');
          if (!errors[path]) errors[path] = err.message;
        });
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await handleSave('Draft');
      setIsDirty(false);
      isDirtyRef.current = false;
      cancelForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitApproval = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await handleSave('Pending Approval');
      setIsDirty(false);
      isDirtyRef.current = false;
      cancelForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const ALL_COLUMNS = [
    { key: 'po_number', label: 'PO #', default: true },
    { key: 'po_date', label: 'Date', default: true },
    { key: 'vendor', label: 'Vendor', default: true },
    { key: 'currency', label: 'Currency', default: true },
    { key: 'total_amount', label: 'Amount', default: true },
    { key: 'status', label: 'Status', default: true },
  ];

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  );
  const [colCustomiserOpen, setColCustomiserOpen] = useState(false);
  const colCustomiserRef = useRef<HTMLDivElement>(null);
  const [actionMenuPO, setActionMenuPO] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const ITEM_COLUMNS = [
    { key: 'section', label: 'Section', default: false },
    { key: 'item_name', label: 'Item & Description', default: true },
    { key: 'variant', label: 'Variant', default: true },
    { key: 'make', label: 'Make', default: true },
    { key: 'quantity', label: 'Qty', default: true },
    { key: 'unit', label: 'Unit', default: true },
    { key: 'rate', label: 'Rate', default: true },
    { key: 'discount', label: 'Disc%', default: false },
    { key: 'gst', label: 'GST%', default: true },
    { key: 'total', label: 'Total', default: true },
  ];
  const [itemCols, setItemCols] = useState<Set<string>>(
    new Set(ITEM_COLUMNS.filter(c => c.default).map(c => c.key))
  );
  const [itemColMenuOpen, setItemColMenuOpen] = useState(false);
  const itemColMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colCustomiserRef.current && !colCustomiserRef.current.contains(e.target as Node)) {
        setColCustomiserOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuPO(null);
      }
      if (itemColMenuRef.current && !itemColMenuRef.current.contains(e.target as Node)) {
        setItemColMenuOpen(false);
      }
    };
    if (colCustomiserOpen || actionMenuPO || itemColMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colCustomiserOpen, actionMenuPO, itemColMenuOpen]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isFormPage = searchParams.get('mode') === 'create' || searchParams.get('mode') === 'edit';
  const navigate = useNavigate();

  const { data: vendors = [], isLoading: vendorsLoading } = useVendors(organisation?.id);
  const { data: poList = [], isLoading } = usePurchaseOrders(organisation?.id);
  const createPO = useCreatePurchaseOrder();
  const updatePO = useUpdatePurchaseOrder();
  const deletePO = useDeletePO();

  const editingPOId = searchParams.get('id');
  const { data: editingPO, isLoading: editingPOLoading } = usePurchaseOrder(editingPOId);

  const filteredPOs = useMemo(() => {
    if (!searchTerm) return poList;
    const term = searchTerm.toLowerCase();
    return poList.filter((po: any) =>
      (po.po_number || '').toLowerCase().includes(term) ||
      (po.vendor?.company_name || '').toLowerCase().includes(term) ||
      (po.status || po.approval_status || '').toLowerCase().includes(term)
    );
  }, [poList, searchTerm]);

  // Materials for item select
  const fetchMaterials = useCallback((orgId: string) => {
    supabase.from('materials').select('id, name, display_name, hsn_code, unit, purchase_price, sale_price, make, gst_rate').eq('organisation_id', orgId).order('name').then(({ data, error }) => {
      if (error) console.error('Failed to fetch materials:', error);
      if (data) setMaterials(data);
    });
    // variants fetch skipped: no material_variants/material_intents table available
  }, []);

  useEffect(() => {
    if (!organisation?.id) return;
    fetchMaterials(organisation.id);
  }, [organisation?.id, fetchMaterials]);

  // Load PO data for editing
  useEffect(() => {
    if (editingPO) {
      setPoNumber(editingPO.po_number || '');
      setCurrency(editingPO.currency || 'INR');
      setExchangeRate(editingPO.exchange_rate || 1);
      setVendorId(editingPO.vendor_id || '');
      setPoDate(editingPO.po_date ? editingPO.po_date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setDeliveryDate(editingPO.delivery_date ? editingPO.delivery_date.split('T')[0] : '');
      setTerms(editingPO.terms || 'Net 30');
      setNotes(editingPO.internal_notes || '');
      setDeliveryLocation(editingPO.delivery_location || '');
      setReferenceNo(editingPO.reference_no || '');
      setTermsContent(editingPO.terms_conditions || '');
      setAttachmentUrl(editingPO.attachment_url || '');
      if (editingPO.items) {
        setItems(editingPO.items.map((item: any, idx: number) => ({
          ...item,
          sr: idx + 1,
        })));
      }
    }
  }, [editingPO]);

  // Recalculate totals whenever items change
  useEffect(() => {
    let subtotal = 0, discountTotal = 0, taxableTotal = 0;
    let cgstTotal = 0, sgstTotal = 0, igstTotal = 0, grandTotal = 0;

    items.forEach(item => {
      const lineValue = item.quantity * item.rate;
      const discountAmt = (lineValue * item.discount_percent) / 100;
      const taxable = lineValue - discountAmt;
      const cgst = (taxable * item.cgst_percent) / 100;
      const sgst = (taxable * item.sgst_percent) / 100;
      const igst = (taxable * item.igst_percent) / 100;
      const total = taxable + cgst + sgst + igst;

      item.discount_amount = discountAmt;
      item.taxable_value = taxable;
      item.cgst_amount = cgst;
      item.sgst_amount = sgst;
      item.igst_amount = igst;
      item.total_amount = total;

      subtotal += lineValue;
      discountTotal += discountAmt;
      taxableTotal += taxable;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;
      grandTotal += total;
    });

    const exchange = currency === 'INR' ? 1 : exchangeRate;
    setTotals({
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discountTotal.toFixed(2)),
      taxable: parseFloat(taxableTotal.toFixed(2)),
      cgst: parseFloat(cgstTotal.toFixed(2)),
      sgst: parseFloat(sgstTotal.toFixed(2)),
      igst: parseFloat(igstTotal.toFixed(2)),
      total: parseFloat(grandTotal.toFixed(2)),
      totalInr: parseFloat((grandTotal * exchange).toFixed(2)),
    });
  }, [items, exchangeRate, currency]);

  // PO Number series generation
  const poSeriesRef = useRef(false);
  const getFyPrefix = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month >= 3) return `${year}-${(year + 1).toString().slice(2)}`;
    return `${year - 1}-${year.toString().slice(2)}`;
  };

  const getPOSeriesNumber = async () => {
    if (!organisation?.id) return 'PO-0001';
    try {
      const { data: existing } = await supabase
        .from('document_series')
        .select('*')
        .eq('organisation_id', organisation.id)
        .or('series_name.ilike.%PO%,series_name.ilike.%Purchase Order%,is_default.eq.true')
        .order('is_default', { ascending: false })
        .limit(1);
      let series = existing && existing.length > 0 ? existing[0] : null;
      if (!series) {
        const fyPrefix = getFyPrefix();
        const initialCfg = { prefix: 'PO-', suffix: '', fy_prefix: fyPrefix, padding: 4, current: 1 };
        const { data: newSeries } = await supabase
          .from('document_series')
          .insert({ organisation_id: organisation.id, series_name: 'Purchase Order', is_default: true, current_number: 1, configs: initialCfg })
          .select()
          .single();
        if (newSeries) {
          series = newSeries;
        }
      }
      return series;
    } catch (e) {
      console.warn('Failed to load PO series', e);
      return null;
    }
  };

  const buildPONumber = (series: any): string => {
    const cfg = series?.configs || {};
    const prefix = cfg.prefix || 'PO-';
    const suffix = cfg.suffix || '';
    const fyPrefix = cfg.fy_prefix ? cfg.fy_prefix + '-' : '';
    const padding = cfg.padding || 4;
    const current = cfg.current || series?.current_number || 1;
    const num = String(current).padStart(padding, '0');
    return `${fyPrefix}${prefix}${num}${suffix}`;
  };

  const generatePONumber = async () => {
    const series = await getPOSeriesNumber();
    if (series) {
      const cfg = series.configs || {};
      poSeriesRef.current = true;
      setPoNumber(buildPONumber(series));
    }
  };

  // Pre-generate PO number when form opens
  useEffect(() => {
    if (isFormPage && !editingPOId && !poSeriesRef.current) {
      generatePONumber();
    }
  }, [isFormPage, editingPOId]);

  const openItemPicker = () => {
    if (materials.length === 0 && organisation?.id) fetchMaterials(organisation.id);
    setPickerSearch('');
    setPickerItems([]);
    setItemPickerOpen(true);
  };

  const handleAddToPicker = (material: any) => {
    const existing = pickerItems.find((p: any) => p.item_id === material.id);
    if (existing) {
      setPickerItems(pickerItems.map((p: any) =>
        p.item_id === material.id ? { ...p, qty: p.qty + 1 } : p
      ));
    } else {
      setPickerItems([...pickerItems, {
        item_id: material.id,
        material,
        qty: 1,
        rate: material.purchase_price || material.sale_price || 0,
        unit: material.unit || 'Nos',
        gst_rate: material.gst_rate || 0,
      }]);
    }
  };

  const handlePickerQtyChange = (itemId: string, qty: number) => {
    setPickerItems(pickerItems.map((p: any) =>
      p.item_id === itemId ? { ...p, qty: Math.max(0.01, qty) } : p
    ));
  };

  const handleRemoveFromPicker = (itemId: string) => {
    setPickerItems(pickerItems.filter((p: any) => p.item_id !== itemId));
  };

  const handleAddItemsToPO = async () => {
    if (pickerItems.length === 0) return;
    const newItems: POItem[] = [];
    for (const p of pickerItems) {
      const material = p.material;
      let rate = p.rate;
      let make = material.make || '';
      let discount = 0;
      if (vendorId) {
        const { data: pricingData } = await supabase
          .from('vendor_material_pricing')
          .select('*')
          .eq('material_id', material.id)
          .eq('vendor_id', vendorId)
          .order('is_preferred', { ascending: false })
          .limit(1)
          .single();
        if (pricingData) {
          rate = pricingData.base_rate || rate;
          make = pricingData.make || make;
          discount = pricingData.discount_percent || discount;
        }
      }
      const gst = material.gst_rate || 0;
      newItems.push({
        sr: 0,
        section: material.item_type || '',
        item_id: material.id,
        item_name: material.display_name || material.name || '',
        make: make || '',
        variant: '',
        description: '',
        hsn_code: material.hsn_code || '',
        quantity: p.qty,
        unit: p.unit || 'Nos',
        rate,
        discount_percent: discount,
        discount_amount: 0,
        taxable_value: 0,
        cgst_percent: gst / 2,
        cgst_amount: 0,
        sgst_percent: gst / 2,
        sgst_amount: 0,
        igst_percent: gst,
        igst_amount: 0,
        total_amount: 0,
      });
    }
    setItems(prev => {
      const maxSr = prev.reduce((max, item) => Math.max(max, item.sr), 0);
      return [...prev, ...newItems.map((item, i) => ({ ...item, sr: maxSr + i + 1 }))];
    });
    markDirty();
    setPickerItems([]);
    setItemPickerOpen(false);
  };

  const filteredPickerMaterials = useMemo(() => {
    if (!pickerSearch) return materials;
    const q = pickerSearch.toLowerCase();
    return materials.filter((m: any) =>
      (m.display_name || m.name || '').toLowerCase().includes(q) ||
      (m.hsn_code || '').toLowerCase().includes(q) ||
      (m.make || '').toLowerCase().includes(q)
    );
  }, [materials, pickerSearch]);

  const addItem = () => {
    markDirty();
    const newSr = items.length + 1;
    setItems(prev => [...prev, {
      sr: newSr,
      item_name: '',
      make: '',
      variant: '',
      description: '',
      hsn_code: '',
      quantity: 1,
      unit: 'Nos',
      rate: 0,
      discount_percent: 0,
      discount_amount: 0,
      taxable_value: 0,
      cgst_percent: 0,
      cgst_amount: 0,
      sgst_percent: 0,
      sgst_amount: 0,
      igst_percent: 0,
      igst_amount: 0,
      total_amount: 0,
    }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    markDirty();
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    markDirty();
    setItems(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((item, i) => ({ ...item, sr: i + 1 }));
    });
  };

  const handleAdd = () => {
    setSearchParams({ mode: 'create' });
    setSelectedPO(null);
    resetForm();
  };

  const handleEditPO = (po: any) => {
    setSearchParams({ mode: 'edit', id: po.id });
    setSelectedPO(po);
  };

  const handleDuplicatePO = (po: any) => {
    setSearchParams({ mode: 'create' });
    setPoNumber('');
    setCurrency(po.currency || 'INR');
    setExchangeRate(po.exchange_rate || 1);
    setVendorId(po.vendor_id || '');
    setPoDate(new Date().toISOString().split('T')[0]);
    setDeliveryDate(po.delivery_date ? po.delivery_date.split('T')[0] : '');
    setTerms(po.terms || 'Net 30');
    setNotes(po.internal_notes || '');
    setDeliveryLocation(po.delivery_location || '');
    setReferenceNo(po.reference_no || '');
    if (po.items) {
      setItems(po.items.map((item: any, idx: number) => ({
        ...item,
        sr: idx + 1,
        id: undefined,
        po_id: undefined,
      })));
    }
    poSeriesRef.current = false;
  };

  const resetForm = () => {
    setPoNumber('');
    setCurrency('INR');
    setExchangeRate(1);
    setVendorId('');
    setPoDate(new Date().toISOString().split('T')[0]);
    setDeliveryDate('');
    setTerms('Net 30');
    setItems([]);
    setNotes('');
    setDeliveryLocation('');
    setReferenceNo('');
    setAttachmentFile(null);
    setAttachmentUrl('');
    setFormErrors({});
    poSeriesRef.current = false;
  };

  const [deleteConfirmPO, setDeleteConfirmPO] = useState<any>(null);

  const handleDeletePO = async () => {
    if (!deleteConfirmPO || !organisation?.id) return;
    try {
      await deletePO.mutateAsync({ id: deleteConfirmPO.id, organisationId: organisation.id });
      setDeleteConfirmPO(null);
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleViewPDF = async (po: any) => {
    try {
      const { data: fullPO } = await supabase
        .from('purchase_orders')
        .select('*, items:purchase_order_items(*), vendor:purchase_vendors(*)')
        .eq('id', po.id)
        .single();
      if (fullPO) {
        const blob = generatePOPDF(fullPO as any);
        openPDFPreview(blob);
      }
    } catch (e) {
      console.error('Failed to generate PDF', e);
    }
  };

  const handleSave = async (status: string) => {
    if (!organisation?.id || !validateForm()) return;

    let attachment_url = attachmentUrl;
    if (attachmentFile) {
      const fileExt = attachmentFile.name.split('.').pop();
      const fileName = `po-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(fileName, attachmentFile);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fileName);
        attachment_url = urlData?.publicUrl || '';
      }
    }

    const poData = {
      organisation_id: organisation.id,
      po_number: poNumber,
      vendor_id: vendorId,
      po_date: poDate,
      delivery_date: deliveryDate || null,
      currency,
      exchange_rate: currency === 'INR' ? 1 : exchangeRate,
      status,
      approval_status: status,
      terms_conditions: termsContent || null,
      internal_notes: notes || null,
      delivery_location: deliveryLocation || null,
      reference_no: referenceNo || null,
      attachment_url: attachment_url || null,
      total_amount: totals.total,
      subtotal: totals.subtotal,
      discount_amount: totals.discount,
      taxable_amount: totals.taxable,
      cgst_amount: totals.cgst,
      sgst_amount: totals.sgst,
      igst_amount: totals.igst,
      total_amount_inr: totals.totalInr,
    };

    const itemsData = items.map(item => ({
      item_name: item.item_name,
      item_id: item.item_id || null,
      hsn_code: item.hsn_code || null,
      quantity: item.quantity,
      unit: item.unit || 'Nos',
      rate: item.rate,
      discount_percent: item.discount_percent || 0,
      discount_amount: item.discount_amount || 0,
      taxable_value: item.taxable_value || 0,
      cgst_percent: item.cgst_percent || 0,
      cgst_amount: item.cgst_amount || 0,
      sgst_percent: item.sgst_percent || 0,
      sgst_amount: item.sgst_amount || 0,
      igst_percent: item.igst_percent || 0,
      igst_amount: item.igst_amount || 0,
      total_amount: item.total_amount || 0,
    }));

    if (editingPOId) {
      await updatePO.mutateAsync({ id: editingPOId, poData, items: itemsData });
    } else {
      await createPO.mutateAsync({ poData, items: itemsData });
    }
  };

  const cancelForm = () => {
    setIsDirty(false);
    isDirtyRef.current = false;
    setSearchParams({});
    setSelectedPO(null);
    resetForm();
  };

  const handleBack = cancelForm;

  const columns = [
    ...(visibleColumns.has('po_number') ? [{
      accessorKey: 'po_number' as const,
      header: 'PO #',
      cell: ({ getValue }: any) => (
        <span className="text-xs font-medium text-indigo-600">{getValue()}</span>
      ),
    }] : []),
    ...(visibleColumns.has('po_date') ? [{
      accessorKey: 'po_date' as const,
      header: 'Date',
      cell: ({ getValue }: any) => (
        <span className="text-xs text-zinc-600">{new Date(getValue()).toLocaleDateString('en-IN')}</span>
      ),
    }] : []),
    ...(visibleColumns.has('vendor') ? [{
      accessorKey: 'vendor' as const,
      header: 'Vendor',
      cell: ({ row }: any) => (
        <span className="text-xs text-zinc-800 max-w-[180px] truncate block">{row.original.vendor?.company_name || '-'}</span>
      ),
    }] : []),
    ...(visibleColumns.has('currency') ? [{
      accessorKey: 'currency' as const,
      header: 'Curr',
      cell: ({ getValue }: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600">{getValue()}</span>
      ),
    }] : []),
    ...(visibleColumns.has('total_amount') ? [{
      accessorKey: 'total_amount' as const,
      header: 'Amount',
      cell: ({ getValue, row }: any) => {
        const amount = Number(getValue());
        const symbol = row.original.currency === 'INR' ? '₹' : row.original.currency + ' ';
        return (
          <div className="text-xs font-medium text-zinc-900 tabular-nums text-right">
            {symbol}{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        );
      },
    }] : []),
    ...(visibleColumns.has('status') ? [{
      accessorKey: 'status' as const,
      header: 'Status',
      cell: ({ getValue, row }: any) => {
        const val = getValue() || row.original.approval_status;
        return <StatusBadge status={val} />;
      },
    }] : []),
  ];


  if (isFormPage) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="text-sm text-zinc-500 hover:text-zinc-800 mr-2">&larr; Back</button>
            <h1 className="text-base font-medium text-zinc-900">{selectedPO?.id ? 'Edit Purchase Order' : 'Create Purchase Order'}</h1>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 max-w-[1400px] mx-auto w-full space-y-10">
          {/* Section 1: Details */}
          <div>
            <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-tight mb-4">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">PO Number</Label>
                  <Input value={poNumber} readOnly className="bg-zinc-50 border-zinc-200" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Vendor <span className="text-rose-500">*</span></Label>
                  <Select value={vendorId} onValueChange={(val) => { setVendorId(val); markDirty(); setFormErrors(prev => { const next = { ...prev }; delete next.vendor_id; return next; }); }}>
                    <SelectTrigger className={cn("border-zinc-200", formErrors.vendor_id && "border-rose-400")}>
                      <SelectValue placeholder="Select a vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.vendor_id && <span className="text-[11px] text-rose-500">{formErrors.vendor_id}</span>}
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">PO Date</Label>
                  <Input type="date" value={poDate} onChange={(e) => { setPoDate(e.target.value); markDirty(); }} className={cn("border-zinc-200", formErrors.po_date && "border-rose-400")} />
                  {formErrors.po_date && <span className="text-[11px] text-rose-500">{formErrors.po_date}</span>}
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Reference / RFQ</Label>
                  <Input value={referenceNo} onChange={(e) => { setReferenceNo(e.target.value); markDirty(); }} placeholder="e.g. RFQ-001, PR-2024-001" className="border-zinc-200" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Delivery Date</Label>
                  <Input type="date" value={deliveryDate} onChange={(e) => { setDeliveryDate(e.target.value); markDirty(); }} className="border-zinc-200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold">Currency</Label>
                    <Select value={currency} onValueChange={(val) => { setCurrency(val); markDirty(); }}>
                      <SelectTrigger className="border-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold">Exchange Rate</Label>
                    <Input type="number" value={exchangeRate} onChange={(e) => { setExchangeRate(Number(e.target.value)); markDirty(); }} disabled={currency === 'INR'} className="border-zinc-200" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Payment Terms</Label>
                  <Input value={terms} onChange={(e) => { setTerms(e.target.value); markDirty(); }} placeholder="e.g. Net 30" className="border-zinc-200" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Delivery Address</Label>
                  <textarea
                    value={deliveryLocation}
                    onChange={(e) => { setDeliveryLocation(e.target.value); markDirty(); }}
                    placeholder="Shipping address, delivery instructions, or site location..."
                    rows={3}
                    className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Items */}
          <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-tight">Order Items</h3>
              <div className="flex items-center gap-2">
                <div className="relative" ref={itemColMenuRef}>
                  <button
                    onClick={() => setItemColMenuOpen(!itemColMenuOpen)}
                    className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100"
                    style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
                  >
                    <Columns className="w-4 h-4 mr-1.5" /> Columns
                  </button>
                  {itemColMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5">
                      {ITEM_COLUMNS.map(col => (
                        <label
                          key={col.key}
                          className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                          style={{ padding: '6px' }}
                        >
                          <input
                            type="checkbox"
                            checked={itemCols.has(col.key)}
                            onChange={() => {
                              setItemCols(prev => {
                                const next = new Set(prev);
                                if (next.has(col.key)) next.delete(col.key);
                                else next.add(col.key);
                                return next;
                              });
                            }}
                            className="w-3.5 h-3.5 rounded border-zinc-300 text-indigo-600 accent-indigo-600"
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={openItemPicker} className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700" style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Multiple Items
                </button>
                <button onClick={addItem} className="inline-flex items-center justify-center text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100" style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Item
                </button>
              </div>
            </div>
            {formErrors.items && <p className="text-[11px] text-rose-500 mb-2">{formErrors.items}</p>}
            <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2.5 font-bold w-10">#</th>
                    {itemCols.has('section') && <th className="px-3 py-2.5 font-bold w-24">Section</th>}
                    {itemCols.has('item_name') && <th className="px-3 py-2.5 font-bold">Item & Description</th>}
                    {itemCols.has('variant') && <th className="px-3 py-2.5 font-bold w-20">Variant</th>}
                    {itemCols.has('make') && <th className="px-3 py-2.5 font-bold w-20">Make</th>}
                    {itemCols.has('quantity') && <th className="px-3 py-2.5 font-bold w-20 text-center">Qty</th>}
                    {itemCols.has('unit') && <th className="px-3 py-2.5 font-bold w-16">Unit</th>}
                    {itemCols.has('rate') && <th className="px-3 py-2.5 font-bold w-24">Rate</th>}
                    {itemCols.has('discount') && <th className="px-3 py-2.5 font-bold w-16 text-center">Disc%</th>}
                    {itemCols.has('gst') && <th className="px-3 py-2.5 font-bold w-16 text-center">GST%</th>}
                    {itemCols.has('total') && <th className="px-3 py-2.5 font-bold w-28 text-right">Total</th>}
                    <th className="px-3 py-2.5 font-bold w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-zinc-50/50">
                      <td className="px-3 py-2 text-zinc-400 font-medium">{item.sr}</td>
                      {itemCols.has('section') && <td className="px-3 py-2"><Input placeholder="Section" value={item.section || ''} onChange={(e) => updateItem(index, 'section', e.target.value)} className="h-8 text-xs border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>}
                      {itemCols.has('item_name') && (
                        <td className="px-3 py-2">
                          <div className="space-y-1.5">
                            <Select value={item.item_id || ""} onValueChange={async (val) => {
                              const material = materials.find((m: any) => m.id === val);
                              if (material) {
                                updateItem(index, 'item_name', material.display_name || material.name);
                                updateItem(index, 'item_id', material.id);
                                updateItem(index, 'hsn_code', material.hsn_code || '');
                                updateItem(index, 'unit', material.unit || 'Nos');
                                let rate = material.purchase_price || material.sale_price || 0;
                                let make = material.make || '';
                                let variant = '';
                                let discount = 0;
                                if (vendorId) {
                                  const { data: pricingData } = await supabase
                                    .from('vendor_material_pricing')
                                    .select('*')
                                    .eq('material_id', material.id)
                                    .eq('vendor_id', vendorId)
                                    .order('is_preferred', { ascending: false })
                                    .limit(1)
                                    .single();
                                  if (pricingData) {
                                    rate = pricingData.base_rate || rate;
                                    make = pricingData.make || make;
                                    discount = pricingData.discount_percent || discount;
                                    if (pricingData.variant_id) {
                                      const foundVariant = variants.find(v => v.id === pricingData.variant_id);
                                      if (foundVariant) variant = foundVariant.variant_name;
                                    }
                                  }
                                }
                                updateItem(index, 'rate', rate);
                                updateItem(index, 'make', make);
                                updateItem(index, 'variant', variant);
                                updateItem(index, 'discount_percent', discount);
                                if (material.gst_rate) {
                                  const gst = material.gst_rate;
                                  updateItem(index, 'cgst_percent', gst / 2);
                                  updateItem(index, 'sgst_percent', gst / 2);
                                  updateItem(index, 'igst_percent', gst);
                                }
                              }
                            }}>
                              <SelectTrigger className="h-8 text-xs border-zinc-100 bg-transparent shadow-none focus:ring-0">
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {materials.map((m: any) => (
                                  <SelectItem key={m.id} value={m.id} className="text-xs">{m.display_name || m.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {formErrors[`items.${index}.item_name`] && (
                              <span className="text-[11px] text-rose-500 block">{formErrors[`items.${index}.item_name`]}</span>
                            )}
                          </div>
                        </td>
                      )}
                      {itemCols.has('variant') && <td className="px-3 py-2"><Input placeholder="Variant" value={item.variant} onChange={(e) => updateItem(index, 'variant', e.target.value)} className="h-8 text-xs border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>}
                      {itemCols.has('make') && <td className="px-3 py-2"><Input placeholder="Make" value={item.make} onChange={(e) => updateItem(index, 'make', e.target.value)} className="h-8 text-xs border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>}
                      {itemCols.has('quantity') && <td className="px-3 py-2"><Input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))} className={cn("h-8 text-xs text-center border-zinc-100 bg-transparent shadow-none focus:ring-0", formErrors[`items.${index}.quantity`] && "border-rose-400")} /></td>}
                      {itemCols.has('unit') && <td className="px-3 py-2"><Input value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} className="h-8 text-xs border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>}
                      {itemCols.has('rate') && <td className="px-3 py-2"><Input type="number" value={item.rate} onChange={(e) => updateItem(index, 'rate', Number(e.target.value))} className="h-8 text-xs border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>}
                      {itemCols.has('discount') && <td className="px-3 py-2"><Input type="number" value={item.discount_percent} onChange={(e) => updateItem(index, 'discount_percent', Number(e.target.value))} className="h-8 text-xs text-center border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>}
                      {itemCols.has('gst') && (
                        <td className="px-3 py-2">
                          <Select value={String(item.cgst_percent + item.sgst_percent)} onValueChange={(val) => {
                            const gst = Number(val);
                            updateItem(index, 'cgst_percent', gst / 2);
                            updateItem(index, 'sgst_percent', gst / 2);
                            updateItem(index, 'igst_percent', gst);
                          }}>
                            <SelectTrigger className="h-8 text-xs border-zinc-100 bg-transparent shadow-none text-center focus:ring-0 pr-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GST_RATES.map((rate) => (
                                <SelectItem key={rate} value={String(rate)} className="text-xs">{rate}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                      {itemCols.has('total') && <td className="px-3 py-2 text-right font-medium text-zinc-700">{item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>}
                      <td className="px-3 py-2">
                        <button onClick={() => removeItem(index)} className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                  {items.length > 0 && items.some(i => i.section) && (() => {
                    const groups: { section: string; items: typeof items }[] = [];
                    let currentGroup: typeof items = [];
                    let currentSection = '';
                    items.forEach(item => {
                      const sec = item.section || '';
                      if (sec && sec !== currentSection && currentGroup.length > 0) {
                        groups.push({ section: currentSection, items: currentGroup });
                        currentGroup = [];
                      }
                      currentSection = sec;
                      currentGroup.push(item);
                    });
                    if (currentGroup.length > 0) groups.push({ section: currentSection, items: currentGroup });
                    return groups.filter(g => g.items.length > 1 && g.section).map((g, gi) => {
                      const sub = g.items.reduce((s, i) => s + i.total_amount, 0);
                      return (
                        <tr key={`sec-sub-${gi}`} className="bg-zinc-100/70">
                          <td colSpan={1 + itemCols.size + 1} className="px-3 py-2 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">
                            Subtotal — {g.section} &nbsp;
                            <span className="font-mono text-zinc-800">₹{sub.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                  {items.length === 0 && (
                    <tr><td colSpan={itemCols.size + 2} className="px-3 py-10 text-center text-zinc-400 italic">No items added. Click "Add Item" or "Add Multiple Items" to start.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex gap-6 mt-8">
              {/* Terms & Conditions */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-tight">
                    <FileText className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                    Terms & Conditions
                  </h3>
                  <button onClick={() => setShowTermsDrawer(true)} className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100" style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}>
                    <Edit className="w-4 h-4 mr-1.5" /> Edit
                  </button>
                </div>
                <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50 min-h-[60px]">
                  {termsContent ? (
                    <p className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">{termsContent}</p>
                  ) : (
                    <p className="text-sm text-zinc-400 italic">No terms & conditions defined. Click "Edit" to add.</p>
                  )}
                </div>
              </div>
              {/* Order Summary */}
              <div className="w-72 shrink-0">
                <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-5 sticky top-4">
                  <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-tight mb-4">Order Summary</h3>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-[13px] text-zinc-600">
                      <span>Subtotal</span>
                      <span className="font-semibold">₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-[13px] text-zinc-600">
                        <span>Discount</span>
                        <span className="font-semibold text-rose-500">-₹{totals.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[13px] text-zinc-600">
                      <span>Taxable</span>
                      <span className="font-semibold">₹{totals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-[12px] text-zinc-500">
                      <span>CGST</span>
                      <span>₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-[12px] text-zinc-500">
                      <span>SGST</span>
                      <span>₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {totals.igst > 0 && (
                      <div className="flex justify-between text-[12px] text-zinc-500">
                        <span>IGST</span>
                        <span>₹{totals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="h-px bg-zinc-300 my-3" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-widest text-zinc-800">Grand Total</span>
                      <span className="text-lg font-black">
                        ₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {currency !== 'INR' && (
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>in INR</span>
                        <span>₹{totals.totalInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {currency === 'INR' && totals.total > 0 && (
                      <div className="pt-2 border-t border-zinc-200/60">
                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">Amount in Words</p>
                        <p className="text-[12px] text-zinc-700 italic font-medium leading-relaxed">{numberToWords(totals.total)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Terms & Conditions Drawer */}
          {showTermsDrawer && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '0', maxWidth: '700px', width: '95%', display: 'flex', flexDirection: 'column' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
                  <h3 className="text-base font-bold text-zinc-900">Terms & Conditions</h3>
                  <button onClick={() => setShowTermsDrawer(false)} className="p-1 rounded hover:bg-zinc-100 text-zinc-400"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6">
                  <textarea
                    value={termsContent}
                    onChange={(e) => { setTermsContent(e.target.value); markDirty(); }}
                    placeholder={`Enter terms and conditions for this purchase order...\n\nCommon clauses:\n- Delivery schedule and penalties for delay\n- Payment terms and conditions\n- Warranty and guarantee\n- Inspection and acceptance\n- Force majeure\n- Dispute resolution`}
                    rows={16}
                    className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono leading-relaxed"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200">
                  <button onClick={() => setShowTermsDrawer(false)} className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100" style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}>
                    Cancel
                  </button>
                  <button onClick={() => setShowTermsDrawer(false)} className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700" style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}>
                    <CheckSquare className="w-4 h-4 mr-1.5" /> Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Attachments */}
          <div className="max-w-[400px]">
            <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-tight mb-4">
              <Paperclip className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Attachments
            </h3>
            <div className="border border-dashed border-zinc-200 rounded-lg p-6">
              {attachmentFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-700">{attachmentFile.name}</p>
                      <p className="text-xs text-zinc-400">{(attachmentFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setAttachmentFile(null); setAttachmentUrl(''); markDirty(); }}
                    className="text-xs font-medium text-rose-500 hover:text-rose-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : attachmentUrl ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-700">Existing attachment</p>
                      <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">View file</a>
                    </div>
                  </div>
                  <button
                    onClick={() => setAttachmentUrl('')}
                    className="text-xs font-medium text-rose-500 hover:text-rose-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-zinc-400" />
                  </div>
                  <span className="text-sm text-zinc-500">Click to upload a file</span>
                  <span className="text-[11px] text-zinc-400">PDF, images, spreadsheet — max 10MB</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setAttachmentFile(file); markDirty(); }
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Section 5: Notes */}
          <div>
            <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-tight mb-4">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); markDirty(); }}
              placeholder="Internal notes, remarks, or special instructions..."
              className="w-full h-24 px-4 py-3 text-sm border border-zinc-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Item Picker Modal — two-panel layout */}
        {itemPickerOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]" onClick={() => setItemPickerOpen(false)}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '0', maxWidth: '750px', width: '95%', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
                <h3 className="text-base font-bold text-zinc-900">Add Multiple Items</h3>
                <button onClick={() => setItemPickerOpen(false)} className="p-1 rounded hover:bg-zinc-100 text-zinc-400"><X className="w-4 h-4" /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {/* Left panel — searchable material list */}
                <div style={{ borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Search materials by name, HSN, or make..."
                        className="w-full pl-10 pr-4 h-[38px] text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                        <tr>
                          <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb' }}>Item Name</th>
                          <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', width: '80px' }}>Rate</th>
                          <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', width: '60px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPickerMaterials.length === 0 && (
                          <tr><td colSpan={3} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No materials found.</td></tr>
                        )}
                        {filteredPickerMaterials.map((m: any) => {
                          const isSelected = pickerItems.some((p: any) => p.item_id === m.id);
                          return (
                            <tr
                              key={m.id}
                              style={{ cursor: isSelected ? 'default' : 'pointer', background: isSelected ? '#f0fdf4' : '#fff' }}
                              onClick={() => { if (!isSelected) handleAddToPicker(m); }}
                            >
                              <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ fontWeight: 500, color: '#1e293b', fontSize: '12px' }}>{m.display_name || m.name}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{m.hsn_code || ''} {m.make ? '| ' + m.make : ''}</div>
                              </td>
                              <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#64748b', fontSize: '12px' }}>
                                ₹{(m.purchase_price || m.sale_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                {/* Right panel — selected items with quantity */}
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
                        {pickerItems.map((p: any) => (
                          <div key={p.item_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.material?.display_name || p.material?.name}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                value={p.qty}
                                onChange={(e) => handlePickerQtyChange(p.item_id, Number(e.target.value))}
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
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200">
                <button onClick={() => setItemPickerOpen(false)} className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100" style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}>
                  Cancel
                </button>
                <button
                  onClick={handleAddItemsToPO}
                  disabled={pickerItems.length === 0}
                  className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                  style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
                >
                  Add to Purchase Order ({pickerItems.length})
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 px-6 py-4 border-t bg-white flex items-center justify-between z-10">
          <button onClick={handleBack} className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100" style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}>
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveDraft} disabled={isSubmitting || items.length === 0 || !vendorId} className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 disabled:opacity-50" style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}>
              <ShoppingCart className="w-4 h-4 mr-1.5" /> {isSubmitting ? 'Saving...' : 'Save as Draft'}
            </button>
            <button onClick={handleSubmitApproval} disabled={isSubmitting || items.length === 0 || !vendorId} className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50" style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}>
              <ShoppingCart className="w-4 h-4 mr-1.5" /> {isSubmitting ? 'Saving...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium text-zinc-900">Purchase Orders</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            {filteredPOs.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              placeholder="Search POs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 pl-8 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="relative" ref={colCustomiserRef}>
            <button
              onClick={() => setColCustomiserOpen(!colCustomiserOpen)}
              className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-[0.98]"
              style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
            >
              <Columns className="w-4 h-4 mr-1.5" />
              Columns
            </button>
            {colCustomiserOpen && (
              <div className="absolute right-0 top-full mt-1 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5">
                {ALL_COLUMNS.map(col => (
                  <label
                    key={col.key}
                    className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                    style={{ padding: '6px' }}
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="w-3.5 h-3.5 rounded border-zinc-300 text-indigo-600 accent-indigo-600"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAdd}
            className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:scale-[0.98]"
            style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create PO
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full table-fixed border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 h-[36px] px-6 text-center align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[50px]">
                <button
                  onClick={() => {
                    if (selectedRows.length === filteredPOs.length) {
                      setSelectedRows([]);
                    } else {
                      setSelectedRows(filteredPOs.map((po: any) => po.id));
                    }
                  }}
                  className="flex items-center justify-center"
                >
                  {selectedRows.length === filteredPOs.length && filteredPOs.length > 0 ? (
                    <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-zinc-300" />
                  )}
                </button>
              </th>
              {visibleColumns.has('po_number') && <th className="sticky top-0 z-10 h-[36px] px-6 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200">PO #</th>}
              {visibleColumns.has('po_date') && <th className="sticky top-0 z-10 h-[36px] px-6 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200">Date</th>}
              {visibleColumns.has('vendor') && <th className="sticky top-0 z-10 h-[36px] px-6 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200">Vendor</th>}
              {visibleColumns.has('currency') && <th className="sticky top-0 z-10 h-[36px] px-6 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200">Curr</th>}
              {visibleColumns.has('total_amount') && <th className="sticky top-0 z-10 h-[36px] px-6 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-right">Amount</th>}
              {visibleColumns.has('status') && <th className="sticky top-0 z-10 h-[36px] px-6 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200">Status</th>}
              <th className="sticky top-0 z-10 h-[36px] px-6 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[70px] text-center">Actions</th>
            </tr>
          </thead>
          
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={visibleColumns.size + 2} className="px-6 py-16 text-center text-sm text-zinc-500">Loading...</td>
              </tr>
            ) : filteredPOs.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.size + 2} className="px-6 py-16 text-center text-sm text-zinc-500">No purchase orders found</td>
              </tr>
            ) : (
              filteredPOs.map((po: any, idx: number) => (
                <tr
                  key={po.id}
                  className={cn(
                    "border-t border-zinc-200/70 transition-all",
                    idx % 2 === 0 ? "bg-white" : "bg-zinc-50/30",
                    "hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm",
                    selectedRows.includes(po.id) && "bg-indigo-50/50"
                  )}
                >
                  <td className="px-6 py-[13px] text-center align-middle w-[50px]">
                    <button
                      onClick={() => {
                        if (selectedRows.includes(po.id)) {
                          setSelectedRows(prev => prev.filter(id => id !== po.id));
                        } else {
                          setSelectedRows(prev => [...prev, po.id]);
                        }
                      }}
                      className="flex items-center justify-center"
                    >
                      {selectedRows.includes(po.id) ? (
                        <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                      ) : (
                        <Square className="h-3.5 w-3.5 text-zinc-300" />
                      )}
                    </button>
                  </td>
                  {visibleColumns.has('po_number') && (
                  <td className="px-6 py-[13px] align-middle">
                    <span className="text-xs font-medium text-indigo-600">{po.po_number}</span>
                  </td>
                )}
                {visibleColumns.has('po_date') && (
                  <td className="px-6 py-[13px] align-middle text-xs text-zinc-600">
                    {new Date(po.po_date).toLocaleDateString('en-IN')}
                  </td>
                )}
                {visibleColumns.has('vendor') && (
                  <td className="px-6 py-[13px] align-middle text-xs text-zinc-800 truncate" title={po.vendor?.company_name}>
                    {po.vendor?.company_name || '-'}
                  </td>
                )}
                {visibleColumns.has('currency') && (
                  <td className="px-6 py-[13px] align-middle">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600">{po.currency}</span>
                  </td>
                )}
                {visibleColumns.has('total_amount') && (
                  <td className="px-6 py-[13px] align-middle text-xs font-medium text-zinc-900 tabular-nums text-right">
                    {po.currency === 'INR' ? '₹' : po.currency + ' '}{Number(po.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                )}
                {visibleColumns.has('status') && (
                  <td className="px-6 py-[13px] align-middle">
                    <StatusBadge status={po.status || po.approval_status} />
                  </td>
                )}
                <td className="px-6 py-[13px] align-middle text-center w-[70px]">
                    <div className="relative flex items-center justify-center" ref={actionMenuPO === po.id ? actionMenuRef : undefined}>
                      <button
                        onClick={() => setActionMenuPO(actionMenuPO === po.id ? null : po.id)}
                        className="p-1 rounded-md hover:bg-zinc-100 text-zinc-400 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {actionMenuPO === po.id && (
                        <div className="absolute right-0 top-full mt-1 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5">
                          <button
                            onClick={() => { handleViewPDF(po); setActionMenuPO(null); }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700"
                            style={{ padding: '6px' }}
                          >
                            <Eye className="w-3.5 h-3.5" /> View PDF
                          </button>
                          <button
                            onClick={() => { handleEditPO(po); setActionMenuPO(null); }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700"
                            style={{ padding: '6px' }}
                          >
                            <Edit className="w-3.5 h-3.5" /> Edit PO
                          </button>
                          <button
                            onClick={() => { handleDuplicatePO(po); setActionMenuPO(null); }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700"
                            style={{ padding: '6px' }}
                          >
                            <Copy className="w-3.5 h-3.5" /> Duplicate
                          </button>
                          <div className="h-px bg-zinc-200/60 my-1" />
                          <button
                            onClick={() => { setDeleteConfirmPO(po); setActionMenuPO(null); }}
                            className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-red-600 hover:bg-red-50"
                            style={{ padding: '6px' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete PO
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedRows.length > 0 && (
        <div className="sticky bottom-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl">
          <div>
            <span className="text-sm font-semibold">{selectedRows.length} selected</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => console.log('Bulk print:', selectedRows)}
              className="bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2"
            >
              <Printer className="w-3.5 h-3.5 inline mr-1.5" />
              Print All
            </button>
            <button
              onClick={() => setSelectedRows([])}
              className="bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}




      {/* Delete Confirmation */}
      {deleteConfirmPO && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%' }}>
            <h3 className="text-base font-bold text-zinc-900 mb-2">Delete Purchase Order</h3>
            <p className="text-sm text-zinc-500 mb-5">Are you sure you want to delete <strong>{deleteConfirmPO.po_number}</strong>? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmPO(null)}
                className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100"
                style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePO}
                disabled={deletePO.isPending}
                className="inline-flex items-center justify-center text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
              >
                {deletePO.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;