import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { cn } from '../../../lib/utils';

import { useAuth } from '../../../contexts/AuthContext';
import { usePurchaseOrders, useVendors, useCreatePurchaseOrder, useUpdatePOStatus } from '../hooks/usePurchaseQueries';
import { generatePOPDF, downloadPDF, openPDFPreview } from '../utils/pdfGenerator';
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
  const [activeStep, setActiveStep] = useState(0);
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
  const updateStatus = useUpdatePOStatus();

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
    setActiveStep(0);
    setSelectedPO(null);
    setVendorId('');
    setItems([]);
    setCurrency('INR');
    setExchangeRate(1);
    
    // Generate PO number
    const newPoNumber = await generatePONumber();
    setPoNumber(newPoNumber);
    
    setOpenDialog(true);
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

  const handleSave = async () => {
    try {
      const poData = {
        organisation_id: organisation?.id,
        issue_id: issueIdParam || null,
        po_number: poNumber,
        po_date: poDate,
        vendor_id: vendorId,
        currency,
        exchange_rate: exchangeRate,
        delivery_date: deliveryDate,
        terms_conditions: terms,
        subtotal: totals.subtotal,
        discount_amount: totals.discount,
        taxable_amount: totals.taxable,
        cgst_amount: totals.cgst,
        sgst_amount: totals.sgst,
        igst_amount: totals.igst,
        total_amount: totals.total,
        total_amount_inr: totals.totalInr,
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

      const result = await createPO.mutateAsync({ poData, items: itemsData });
      
      // Log creation in issue timeline if issue_id is present
      if (issueIdParam && result?.id) {
        await supabase.from('issue_activity_logs').insert({
          issue_id: issueIdParam,
          action: 'purchase_order_created',
          new_value: { po_id: result.id, po_number: poNumber },
          done_by: (organisation as any)?.created_by || null,
          done_by_name: organisation?.name || 'System'
        });
      }
      
      setOpenDialog(false);
    } catch (error) {
      console.error('Error saving PO:', error);
    }
  };

  const columns = [
    {
      accessorKey: 'po_number',
      header: 'PO Number',
      cell: ({ getValue, row }: any) => (
        <span className="font-semibold text-primary hover:underline cursor-pointer">
          {getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'po_date',
      header: 'Date',
      cell: ({ getValue }: any) => new Date(getValue()).toLocaleDateString('en-IN'),
    },
    {
      accessorKey: 'vendor',
      header: 'Vendor',
      cell: ({ row }: any) => row.original.vendor?.company_name || '-',
    },
    {
      accessorKey: 'currency',
      header: 'Curr',
      cell: ({ getValue }: any) => (
        <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 h-5">
          {getValue()}
        </Badge>
      ),
    },
    {
      accessorKey: 'total_amount',
      header: 'Amount',
      cell: ({ getValue, row }: any) => {
        const amount = Number(getValue());
        const currency = row.original.currency === 'INR' ? '¥' : row.original.currency + ' ';
        return (
          <div className="font-medium text-right">
            {currency}{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue, row }: any) => {
        const val = getValue() || row.original.approval_status;
        const statusColors: any = {
          'Draft': 'bg-gray-100 text-gray-700 border-gray-200',
          'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200',
          'Approved': 'bg-sky-50 text-sky-700 border-sky-200',
          'Sent': 'bg-blue-50 text-blue-700 border-blue-200',
          'Acknowledged': 'bg-emerald-50 text-emerald-700 border-emerald-200',
          'Completed': 'bg-green-50 text-green-700 border-green-200',
          'Cancelled': 'bg-red-50 text-red-700 border-red-200',
        };
        return (
          <Badge 
            className={cn(
              "text-[10px] font-medium px-2 py-0 h-5 border shadow-none",
              statusColors[val] || "bg-gray-100 text-gray-700"
            )}
          >
            {val}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-1">
          <ShadcnButton 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={() => handleViewPDF(row.original)}
          >
            <FileText className="h-4 w-4" />
          </ShadcnButton>
          <ShadcnButton 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-primary hover:bg-primary/10"
          >
            <Mail className="h-4 w-4" />
          </ShadcnButton>
          <ShadcnButton 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-600 hover:bg-slate-100"
          >
            <Edit className="h-4 w-4" />
          </ShadcnButton>
        </div>
      ),
    },
  ];


  return (
    <div className="h-full flex flex-col space-y-4 p-4 md:p-6 bg-zinc-50/50">
      {/* Header Card */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="py-4 px-6 bg-white border-b border-zinc-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-zinc-800">Purchase Orders</CardTitle>
                <p className="text-xs text-zinc-500 font-medium">Manage your procurement workflow</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Search POs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64 h-9 text-sm border-zinc-200 focus:ring-primary/20"
                />
              </div>
              <ShadcnButton 
                onClick={handleAdd} 
                className="h-9 gap-2 shadow-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                Create PO
              </ShadcnButton>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Table Card */}
      <Card className="flex-1 border-none shadow-sm overflow-hidden bg-white">
        <div className="h-[calc(100vh-220px)] overflow-auto">
          <table className="w-full caption-bottom text-sm border-collapse">
            {/* Table Header */}
            <thead className="border-b border-zinc-200 bg-zinc-100 sticky top-0">
              <tr>
                <th className="w-8 px-2 py-1.5 text-center align-middle text-xs font-medium text-zinc-500">
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
                      <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                  </button>
                </th>
                <th className="px-2 py-1.5 text-left align-middle text-xs font-medium text-zinc-500">PO #</th>
                <th className="px-2 py-1.5 text-left align-middle text-xs font-medium text-zinc-500">Date</th>
                <th className="px-2 py-1.5 text-left align-middle text-xs font-medium text-zinc-500">Vendor</th>
                <th className="px-2 py-1.5 text-left align-middle text-xs font-medium text-zinc-500">Curr</th>
                <th className="px-2 py-1.5 text-right align-middle text-xs font-medium text-zinc-500">Amount</th>
                <th className="px-2 py-1.5 text-left align-middle text-xs font-medium text-zinc-500">Status</th>
                <th className="px-2 py-1.5 text-right align-middle text-xs font-medium text-zinc-500 w-24"></th>
              </tr>
            </thead>
            
            {/* Table Body */}
            <tbody className="[&_tr:last-child]:border-0">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-xs text-zinc-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-zinc-950">No purchase orders found</div>
                      <div className="text-[10px] text-zinc-500">Create your first purchase order to get started.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po: any) => (
                  <tr key={po.id} className="border-b border-zinc-100 hover:bg-zinc-50/80">
                    <td className="px-2 py-1 text-center align-middle">
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
                          <CheckSquare className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-zinc-300" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-1 text-left align-middle whitespace-nowrap">
                      <span className="text-xs font-semibold text-primary hover:underline cursor-pointer">
                        {po.po_number}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-left align-middle whitespace-nowrap text-xs text-zinc-600">
                      {new Date(po.po_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-2 py-1 text-left align-middle whitespace-nowrap text-xs text-zinc-600">
                      {po.vendor?.company_name || '-'}
                    </td>
                    <td className="px-2 py-1 text-left align-middle">
                      <Badge variant="secondary" className="text-[10px] font-medium px-1 py-0.5">
                        {po.currency}
                      </Badge>
                    </td>
                    <td className="px-2 py-1 text-right align-middle whitespace-nowrap text-xs font-medium text-zinc-700">
                      {po.currency === 'INR' ? '₹' : po.currency + ' '}{Number(po.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1 text-left align-middle">
                      <StatusBadge status={po.status || po.approval_status} />
                    </td>
                    <td className="px-2 py-1 text-right align-middle">
                      <div className="flex items-center justify-end gap-0.5">
                        <ShadcnButton 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-rose-600 hover:bg-rose-50"
                          onClick={() => handleViewPDF(po)}
                        >
                          <FileText className="h-3 w-3" />
                        </ShadcnButton>
                        <ShadcnButton 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-primary hover:bg-primary/10"
                        >
                          <Mail className="h-3 w-3" />
                        </ShadcnButton>
                        <ShadcnButton 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-zinc-500 hover:bg-zinc-100"
                        >
                          <Edit className="h-3 w-3" />
                        </ShadcnButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Bulk Actions Bar */}
        {selectedRows.length > 0 && (
          <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-200 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedRows([])}
                className="flex items-center gap-2"
              >
                {selectedRows.length === filteredPOs.length && filteredPOs.length > 0 ? (
                  <CheckSquare className="h-4 w-4 text-white" />
                ) : (
                  <Square className="h-4 w-4 text-zinc-400" />
                )}
              </button>
              <span className="text-sm font-medium text-white">
                {selectedRows.length} selected
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ShadcnButton 
                size="sm" 
                variant="ghost"
                className="h-8 text-white hover:bg-zinc-800"
                onClick={() => console.log('Bulk print:', selectedRows)}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print All
              </ShadcnButton>
              <ShadcnButton 
                size="sm" 
                variant="ghost"
                className="h-8 text-white hover:bg-zinc-800"
                onClick={() => console.log('Bulk email:', selectedRows)}
              >
                <Mail className="w-4 h-4 mr-2" />
                Email
              </ShadcnButton>
              <ShadcnButton 
                size="sm" 
                variant="ghost"
                className="h-8 text-white hover:bg-zinc-800"
                onClick={() => setSelectedRows([])}
              >
                Clear
              </ShadcnButton>
            </div>
          </div>
        )}
      </Card>


      {/* Create PO Dialog */}
      {/* Create PO Dialog */}
      <Dialog open={openDialog} onOpenChange={(open) => !open && setOpenDialog(false)}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl font-bold">Create Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-center mb-8">
              {[0, 1, 2].map((step) => (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center">
                    <div 
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                        activeStep === step ? "bg-primary text-white" : 
                        activeStep > step ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {activeStep > step ? <Plus className="h-4 w-4 rotate-45" /> : step + 1}
                    </div>
                    <span className={cn(
                      "text-[10px] mt-2 font-medium uppercase tracking-wider",
                      activeStep === step ? "text-primary" : "text-slate-500"
                    )}>
                      {step === 0 ? "Details" : step === 1 ? "Items" : "Review"}
                    </span>
                  </div>
                  {step < 2 && (
                    <div className={cn(
                      "h-[2px] w-24 mx-4 mb-4 mt-[-10px]",
                      activeStep > step ? "bg-emerald-500" : "bg-slate-200"
                    )} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {activeStep === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div className="space-y-4">
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold">PO Number</Label>
                    <Input value={poNumber} readOnly className="bg-slate-50 border-slate-200" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold">Vendor <span className="text-rose-500">*</span></Label>
                    <Select value={vendorId} onValueChange={setVendorId}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder="Select a vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((v: any) => (
                          <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold">PO Date</Label>
                    <Input 
                      type="date" 
                      value={poDate} 
                      onChange={(e) => setPoDate(e.target.value)} 
                      className="border-slate-200"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold">Delivery Date</Label>
                    <Input 
                      type="date" 
                      value={deliveryDate} 
                      onChange={(e) => setDeliveryDate(e.target.value)} 
                      className="border-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label className="text-sm font-semibold">Currency</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="border-slate-200">
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
                      <Input 
                        type="number" 
                        value={exchangeRate} 
                        onChange={(e) => setExchangeRate(Number(e.target.value))}
                        disabled={currency === 'INR'}
                        className="border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold">Payment Terms</Label>
                    <Input 
                      value={terms} 
                      onChange={(e) => setTerms(e.target.value)} 
                      placeholder="e.g. Net 30"
                      className="border-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Order Items</h3>
                  <ShadcnButton 
                    variant="outline" 
                    size="sm" 
                    onClick={addItem} 
                    className="gap-2 h-8 text-xs font-semibold border-slate-200"
                  >
                    <Plus className="h-3 w-3" />
                    Add Item
                  </ShadcnButton>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-3 py-2.5 font-bold w-10">#</th>
                        <th className="px-3 py-2.5 font-bold">Item & Description</th>
                        <th className="px-3 py-2.5 font-bold w-24">HSN</th>
                        <th className="px-3 py-2.5 font-bold w-20 text-center">Qty</th>
                        <th className="px-3 py-2.5 font-bold w-16">Unit</th>
                        <th className="px-3 py-2.5 font-bold w-24">Rate</th>
                        <th className="px-3 py-2.5 font-bold w-16 text-center">GST%</th>
                        <th className="px-3 py-2.5 font-bold w-28 text-right">Total</th>
                        <th className="px-3 py-2.5 font-bold w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-400 font-medium">{item.sr}</td>
                          <td className="px-3 py-2">
                            <div className="space-y-1.5">
                              <Select 
                                value={item.item_id || ""} 
                                onValueChange={(val) => {
                                  const material = materials.find((m: any) => m.id === val);
                                  if (material) {
                                    updateItem(index, 'item_name', material.display_name || material.name);
                                    updateItem(index, 'item_id', material.id);
                                    updateItem(index, 'hsn_code', material.hsn_code || '');
                                    updateItem(index, 'unit', material.unit || 'Nos');
                                    updateItem(index, 'rate', material.purchase_price || material.sale_price || 0);
                                    updateItem(index, 'make', material.make || '');
                                    if (material.gst_rate) {
                                      const gst = material.gst_rate;
                                      updateItem(index, 'cgst_percent', gst / 2);
                                      updateItem(index, 'sgst_percent', gst / 2);
                                      updateItem(index, 'igst_percent', gst);
                                    }
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs border-slate-100 bg-transparent shadow-none focus:ring-0">
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                  {materials.map((m: any) => (
                                    <SelectItem key={m.id} value={m.id} className="text-xs">
                                      {m.display_name || m.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input 
                                placeholder="Description/Make" 
                                value={item.make} 
                                onChange={(e) => updateItem(index, 'make', e.target.value)}
                                className="h-7 text-[10px] border-slate-100 bg-transparent shadow-none rounded-sm px-2 focus:ring-0"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              value={item.hsn_code} 
                              onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                              className="h-8 text-xs border-slate-100 bg-transparent shadow-none focus:ring-0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              type="number" 
                              value={item.quantity} 
                              onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                              className="h-8 text-xs text-center border-slate-100 bg-transparent shadow-none focus:ring-0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              value={item.unit} 
                              onChange={(e) => updateItem(index, 'unit', e.target.value)}
                              className="h-8 text-xs border-slate-100 bg-transparent shadow-none focus:ring-0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input 
                              type="number" 
                              value={item.rate} 
                              onChange={(e) => updateItem(index, 'rate', Number(e.target.value))}
                              className="h-8 text-xs border-slate-100 bg-transparent shadow-none focus:ring-0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select 
                              value={String(item.cgst_percent + item.sgst_percent)} 
                              onValueChange={(val) => {
                                const gst = Number(val);
                                updateItem(index, 'cgst_percent', gst / 2);
                                updateItem(index, 'sgst_percent', gst / 2);
                                updateItem(index, 'igst_percent', gst);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs border-slate-100 bg-transparent shadow-none text-center focus:ring-0 pr-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {GST_RATES.map((rate) => (
                                  <SelectItem key={rate} value={String(rate)} className="text-xs">{rate}%</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-700">
                            {item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2">
                            <ShadcnButton 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeItem(index)}
                              className="h-7 w-7 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </ShadcnButton>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-3 py-10 text-center text-slate-400 italic">
                            No items added. Click "Add Item" to start.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-6">
                  <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Order Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-medium">₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Discount</span>
                      <span className="font-medium text-rose-500">-₹{totals.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="h-px bg-slate-200 my-2" />
                    <div className="flex justify-between text-sm text-slate-800 font-bold">
                      <span>Taxable Value</span>
                      <span>₹{totals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>CGST</span>
                      <span>₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>SGST</span>
                      <span>₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {totals.igst > 0 && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>IGST</span>
                        <span>₹{totals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="h-[2px] bg-slate-800 mt-6 mb-4" />
                    <div className="flex justify-between items-center bg-slate-900 text-white rounded-lg p-4 shadow-lg shadow-slate-200">
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
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/50 flex flex-row items-center justify-between">
            <ShadcnButton 
              variant="outline" 
              onClick={() => setOpenDialog(false)}
              className="px-6 border-slate-200 font-semibold"
            >
              Cancel
            </ShadcnButton>
            <div className="flex gap-2">
              {activeStep > 0 && (
                <ShadcnButton 
                  variant="outline" 
                  onClick={() => setActiveStep(activeStep - 1)}
                  className="gap-2 px-6 border-slate-200 font-semibold"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </ShadcnButton>
              )}
              {activeStep < 2 ? (
                <ShadcnButton 
                  onClick={() => setActiveStep(activeStep + 1)}
                  className="gap-2 px-8 font-semibold shadow-md"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </ShadcnButton>
              ) : (
                <ShadcnButton 
                  onClick={handleSave} 
                  disabled={items.length === 0 || !vendorId}
                  className="gap-2 px-10 bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-100"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Confirm and Save PO
                </ShadcnButton>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrders;