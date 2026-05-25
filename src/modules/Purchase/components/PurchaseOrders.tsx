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
  Copy
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
import { usePurchaseOrders, useVendors, useCreatePurchaseOrder, useUpdatePurchaseOrder, useUpdatePOStatus, useDeletePO } from '../hooks/usePurchaseQueries';
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
  id?: string;
  item_id?: string;
  sr: number;
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

  const { data: pos = [], isLoading } = usePurchaseOrders(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const createPO = useCreatePurchaseOrder();
  const updatePO = useUpdatePurchaseOrder();
  const updateStatus = useUpdatePOStatus();
  const navigate = useNavigate();

  // Filtered data based on search
  const filteredPOs = useMemo(() => {
    if (!searchTerm) return pos;
    const term = searchTerm.toLowerCase();
    return pos.filter((po: any) => 
      po.po_number?.toLowerCase().includes(term) ||
      po.vendor?.company_name?.toLowerCase().includes(term) ||
      po.status?.toLowerCase().includes(term)
    );
  }, [pos, searchTerm]);

  // Load materials and variants on mount
  useEffect(() => {
    if (organisation?.id) {
      loadMaterials();
      loadVariants();
    }
  }, [organisation?.id]);

  // Handle action=create from URL
  useEffect(() => {
    if (actionParam === 'create' && !openDialog) {
      handleAdd();
      
      // Clear action param so it doesn't re-trigger
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [actionParam, openDialog]);

  // Fetch linked Issue info for pre-filling
  const { data: linkedIssue } = useQuery({
    queryKey: ['issue-for-po', issueIdParam],
    enabled: !!issueIdParam && openDialog,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issues')
        .select('id, title, description, project_id, location_block, equipment_tag')
        .eq('id', issueIdParam)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Pre-fill from issue
  useEffect(() => {
    if (linkedIssue && openDialog && items.length === 0) {
      // Create an initial item based on the issue
      const issueDesc = `Resolution for Issue: ${linkedIssue.title}${linkedIssue.description ? ` - ${linkedIssue.description}` : ''}`;
      const newItem: POItem = {
        sr: 1,
        item_name: linkedIssue.equipment_tag || 'Material/Service',
        make: '',
        variant: '',
        description: issueDesc,
        hsn_code: '',
        quantity: 1,
        unit: 'Nos',
        rate: 0,
        discount_percent: 0,
        discount_amount: 0,
        taxable_value: 0,
        cgst_percent: 9,
        cgst_amount: 0,
        sgst_percent: 9,
        sgst_amount: 0,
        igst_percent: 18,
        igst_amount: 0,
        total_amount: 0,
      };
      setItems([newItem]);
    }
  }, [linkedIssue, openDialog]);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, item_code, display_name, name, hsn_code, sale_price, purchase_price, unit, gst_rate, make, item_type, uses_variant')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setMaterials(data || []);
      console.log('Loaded materials:', data?.length || 0, 'items');
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };

  const loadVariants = async () => {
    try {
      const { data, error } = await supabase
        .from('company_variants')
        .select('id, variant_name')
        .eq('is_active', true)
        .order('variant_name');
      
      if (error) throw error;
      setVariants(data || []);
    } catch (error) {
      console.error('Error loading variants:', error);
    }
  };

  const generatePONumber = async () => {
    if (!organisation?.id) return '';
    
    try {
      // Get PO settings from document_settings
      const { data: settings, error } = await supabase
        .from('document_settings')
        .select('po_prefix, po_start_number, po_suffix, po_padding, po_current_number')
        .eq('organisation_id', organisation.id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (!settings) {
        // No settings found, generate default
        const timestamp = Date.now().toString(36).toUpperCase();
        return `PO-${timestamp}`;
      }
      
      const prefix = settings.po_prefix || 'PO';
      const suffix = settings.po_suffix || '';
      const padding = settings.po_padding || 4;
      const currentNumber = (settings.po_current_number || settings.po_start_number || 1);
      
      // Format number with padding
      const paddedNumber = currentNumber.toString().padStart(padding, '0');
      const generatedNumber = `${prefix}${paddedNumber}${suffix}`;
      
      // Update current number in settings
      await supabase
        .from('document_settings')
        .update({ po_current_number: currentNumber + 1 })
        .eq('organisation_id', organisation.id);
      
      return generatedNumber;
    } catch (error) {
      console.error('Error generating PO number:', error);
      // Fallback to timestamp-based number
      const timestamp = Date.now().toString(36).toUpperCase();
      return `PO-${timestamp}`;
    }
  };

  const handleAdd = async () => {
    setSelectedPO(null);
    setVendorId('');
    setItems([]);
    setCurrency('INR');
    setExchangeRate(1);

    const newPoNumber = await generatePONumber();
    setPoNumber(newPoNumber);

    navigate('/purchase/orders?mode=create');
  };

  const handleViewPDF = (po: any) => {
    const pdfBlob = generatePOPDF({
      company_name: organisation?.name || 'Company',
      company_address: 'Company Address',
      company_gstin: 'GSTIN',
      company_phone: 'Phone',
      po_number: po.po_number,
      po_date: po.po_date,
      vendor_name: po.vendor?.company_name || 'Vendor',
      vendor_address: 'Vendor Address',
      vendor_gstin: po.vendor?.gstin || '',
      vendor_contact: po.vendor?.phone || '',
      delivery_location: po.delivery_location || '',
      currency: po.currency || 'INR',
      exchange_rate: po.exchange_rate || 1,
      terms: po.terms || 'Net 30',
      items: po.items?.map((item: any, idx: number) => ({
        sr: idx + 1,
        description: item.item_name,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        cgst_percent: item.cgst_percent,
        cgst_amount: item.cgst_amount,
        sgst_percent: item.sgst_percent,
        sgst_amount: item.sgst_amount,
        total_amount: item.total_amount,
      })) || [],
      subtotal: po.subtotal,
      discount_amount: po.discount_amount,
      taxable_amount: po.taxable_amount,
      cgst_amount: po.cgst_amount,
      sgst_amount: po.sgst_amount,
      igst_amount: po.igst_amount,
      total_amount: po.total_amount,
      total_amount_inr: po.total_amount_inr,
      notes: po.terms_conditions,
    });
    openPDFPreview(pdfBlob);
  };

  const deletePO = useDeletePO();
  const [deleteConfirmPO, setDeleteConfirmPO] = useState<any>(null);

  const handleEditPO = (po: any) => {
    setSelectedPO(po);
    setPoNumber(po.po_number);
    setVendorId(po.vendor_id);
    setPoDate(po.po_date);
    setDeliveryDate(po.delivery_date || '');
    setCurrency(po.currency);
    setExchangeRate(po.exchange_rate || 1);
    setTerms(po.terms_conditions || 'Net 30');
    const poItems: POItem[] = (po.purchase_order_items || []).map((item: any, idx: number) => ({
      id: item.id,
      item_id: item.item_id,
      sr: idx + 1,
      item_name: item.item_name,
      make: item.make || '',
      variant: item.variant || '',
      description: item.description || '',
      hsn_code: item.hsn_code || '',
      quantity: item.quantity,
      unit: item.unit,
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
    setItems(poItems);
    navigate('/purchase/orders?mode=edit');
  };

  const handleDuplicatePO = async (po: any) => {
    const newPoNumber = await generatePONumber();
    setSelectedPO(null);
    setPoNumber(newPoNumber);
    setVendorId(po.vendor_id);
    setPoDate(new Date().toISOString().split('T')[0]);
    setDeliveryDate('');
    setCurrency(po.currency);
    setExchangeRate(po.exchange_rate || 1);
    setTerms(po.terms_conditions || 'Net 30');
    const poItems: POItem[] = (po.purchase_order_items || []).map((item: any, idx: number) => ({
      item_id: item.item_id,
      sr: idx + 1,
      item_name: item.item_name,
      make: item.make || '',
      variant: item.variant || '',
      description: item.description || '',
      hsn_code: item.hsn_code || '',
      quantity: item.quantity,
      unit: item.unit,
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
    setItems(poItems);
    setOpenDialog(true);
  };

  const handleDeletePO = async () => {
    if (!deleteConfirmPO || !organisation?.id) return;
    try {
      await deletePO.mutateAsync({ id: deleteConfirmPO.id, organisationId: organisation.id });
      setDeleteConfirmPO(null);
    } catch {
      alert('Failed to delete PO');
    }
  };

  const calculateTotals = (currentItems: POItem[]) => {
    let subtotal = 0;
    let discount = 0;
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    currentItems.forEach((item) => {
      const lineValue = item.quantity * item.rate;
      const discAmount = (lineValue * item.discount_percent) / 100;
      const taxableValue = lineValue - discAmount;
      
      subtotal += lineValue;
      discount += discAmount;
      taxable += taxableValue;
      cgst += item.cgst_amount;
      sgst += item.sgst_amount;
      igst += item.igst_amount;
    });

    const total = taxable + cgst + sgst + igst;
    const totalInr = total * exchangeRate;

    setTotals({
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      taxable: parseFloat(taxable.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)),
      sgst: parseFloat(sgst.toFixed(2)),
      igst: parseFloat(igst.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      totalInr: parseFloat(totalInr.toFixed(2)),
    });
  };

  const addItem = () => {
    const newItem: POItem = {
      sr: items.length + 1,
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
      cgst_percent: 9,
      cgst_amount: 0,
      sgst_percent: 9,
      sgst_amount: 0,
      igst_percent: 18,
      igst_amount: 0,
      total_amount: 0,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    const updatedItems = [...items];
    const item = updatedItems[index];
    
    (item as any)[field] = value;
    
    // Recalculate
    const lineValue = item.quantity * item.rate;
    item.discount_amount = (lineValue * item.discount_percent) / 100;
    item.taxable_value = lineValue - item.discount_amount;
    
    item.cgst_amount = (item.taxable_value * item.cgst_percent) / 100;
    item.sgst_amount = (item.taxable_value * item.sgst_percent) / 100;
    item.igst_amount = (item.taxable_value * item.igst_percent) / 100;
    
    item.total_amount = item.taxable_value + item.cgst_amount + item.sgst_amount + item.igst_amount;
    
    setItems(updatedItems);
    calculateTotals(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    updatedItems.forEach((item, i) => { item.sr = i + 1; });
    setItems(updatedItems);
    calculateTotals(updatedItems);
  };

  const handleSave = async (status: string) => {
    try {
      const poData = {
        organisation_id: organisation?.id,
        issue_id: issueIdParam || null,
        po_number: poNumber,
        po_date: poDate,
        vendor_id: vendorId,
        currency,
        exchange_rate: exchangeRate,
        delivery_date: deliveryDate || null,
        terms_conditions: terms,
        subtotal: totals.subtotal,
        discount_amount: totals.discount,
        taxable_amount: totals.taxable,
        cgst_amount: totals.cgst,
        sgst_amount: totals.sgst,
        igst_amount: totals.igst,
        total_amount: totals.total,
        total_amount_inr: totals.totalInr,
        status,
      };

      const itemsData = items.map((item) => ({
        organisation_id: organisation?.id,
        item_id: item.item_id,
        item_name: item.item_name,
        make: item.make,
        variant: item.variant,
        description: item.description,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
        taxable_value: item.taxable_value,
        cgst_percent: item.cgst_percent,
        cgst_amount: item.cgst_amount,
        sgst_percent: item.sgst_percent,
        sgst_amount: item.sgst_amount,
        igst_percent: item.igst_percent,
        igst_amount: item.igst_amount,
        total_amount: item.total_amount,
        total_amount_inr: item.total_amount * exchangeRate,
      }));

      if (selectedPO?.id) {
        await updatePO.mutateAsync({ id: selectedPO.id, poData, items: itemsData });
      } else {
        const result = await createPO.mutateAsync({ poData, items: itemsData });

        if (issueIdParam && result?.id) {
          await supabase.from('issue_activity_logs').insert({
            issue_id: issueIdParam,
            action: 'purchase_order_created',
            new_value: { po_id: result.id, po_number: poNumber },
            done_by: (organisation as any)?.created_by || null,
            done_by_name: organisation?.name || 'System'
          });
        }
      }

      setOpenDialog(false);
      setSelectedPO(null);
    } catch (error) {
      console.error('Error saving PO:', error);
    }
  };

  const isFormPage = searchParams.get('mode') === 'create' || searchParams.get('mode') === 'edit';

  const cancelForm = () => {
    setSelectedPO(null);
    navigate('/purchase/orders');
  };

  const handleBack = () => {
    cancelForm();
  };

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colCustomiserRef.current && !colCustomiserRef.current.contains(e.target as Node)) {
        setColCustomiserOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuPO(null);
      }
    };
    if (colCustomiserOpen || actionMenuPO) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colCustomiserOpen, actionMenuPO]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

        <div className="flex-1 overflow-auto p-6 space-y-10">
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
                  <Select value={vendorId} onValueChange={(val) => { setVendorId(val); setFormErrors(prev => { const next = { ...prev }; delete next.vendor_id; return next; }); }}>
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
                  <Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className={cn("border-zinc-200", formErrors.po_date && "border-rose-400")} />
                  {formErrors.po_date && <span className="text-[11px] text-rose-500">{formErrors.po_date}</span>}
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Delivery Date</Label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="border-zinc-200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
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
                    <Input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} disabled={currency === 'INR'} className="border-zinc-200" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Payment Terms</Label>
                  <Input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="e.g. Net 30" className="border-zinc-200" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-tight">Order Items</h3>
              <button onClick={addItem} className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100" style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Item
              </button>
            </div>
            {formErrors.items && <p className="text-[11px] text-rose-500 mb-2">{formErrors.items}</p>}
            <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2.5 font-bold w-10">#</th>
                    <th className="px-3 py-2.5 font-bold">Item & Description</th>
                    <th className="px-3 py-2.5 font-bold w-20">Variant</th>
                    <th className="px-3 py-2.5 font-bold w-20">Make</th>
                    <th className="px-3 py-2.5 font-bold w-20 text-center">Qty</th>
                    <th className="px-3 py-2.5 font-bold w-16">Unit</th>
                    <th className="px-3 py-2.5 font-bold w-24">Rate</th>
                    <th className="px-3 py-2.5 font-bold w-16 text-center">Disc%</th>
                    <th className="px-3 py-2.5 font-bold w-16 text-center">GST%</th>
                    <th className="px-3 py-2.5 font-bold w-28 text-right">Total</th>
                    <th className="px-3 py-2.5 font-bold w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-zinc-50/50">
                      <td className="px-3 py-2 text-zinc-400 font-medium">{item.sr}</td>
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
                      <td className="px-3 py-2"><Input placeholder="Variant" value={item.variant} onChange={(e) => updateItem(index, 'variant', e.target.value)} className="h-8 text-xs border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>
                      <td className="px-3 py-2"><Input placeholder="Make" value={item.make} onChange={(e) => updateItem(index, 'make', e.target.value)} className="h-8 text-xs border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>
                      <td className="px-3 py-2"><Input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))} className={cn("h-8 text-xs text-center border-zinc-100 bg-transparent shadow-none focus:ring-0", formErrors[`items.${index}.quantity`] && "border-rose-400")} /></td>
                      <td className="px-3 py-2"><Input value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} className="h-8 text-xs border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>
                      <td className="px-3 py-2"><Input type="number" value={item.rate} onChange={(e) => updateItem(index, 'rate', Number(e.target.value))} className="h-8 text-xs border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>
                      <td className="px-3 py-2"><Input type="number" value={item.discount_percent} onChange={(e) => updateItem(index, 'discount_percent', Number(e.target.value))} className="h-8 text-xs text-center border-zinc-100 bg-transparent shadow-none focus:ring-0" /></td>
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
                      <td className="px-3 py-2 text-right font-medium text-zinc-700">{item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeItem(index)} className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={11} className="px-3 py-10 text-center text-zinc-400 italic">No items added. Click "Add Item" to start.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Summary */}
          <div>
            <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-tight mb-4">Order Summary</h3>
            <div className="max-w-2xl">
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Subtotal</span>
                    <span className="font-medium">₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Discount</span>
                    <span className="font-medium text-rose-500">-₹{totals.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="h-px bg-zinc-200 my-2" />
                  <div className="flex justify-between text-sm text-zinc-800 font-bold">
                    <span>Taxable Value</span>
                    <span>₹{totals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>CGST</span>
                    <span>₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>SGST</span>
                    <span>₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {totals.igst > 0 && (
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>IGST</span>
                      <span>₹{totals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="h-[2px] bg-zinc-800 mt-6 mb-4" />
                  <div className="flex justify-between items-center bg-zinc-900 text-white rounded-lg p-4 shadow-lg shadow-zinc-200">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-70 font-mono">Grand Total</span>
                    <div className="text-right">
                      <span className="text-2xl font-black">
                        {CURRENCIES.find(c => c.code === currency)?.symbol} {totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      {currency !== 'INR' && (
                        <div className="text-[10px] uppercase opacity-70 mt-1">
                          (~ ₹{totals.totalInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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