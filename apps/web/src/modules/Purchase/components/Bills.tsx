import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Receipt, 
  FileText, 
  Edit, 
  FileEdit,
  Trash2, 
  Warehouse, 
  Truck,
  PlusCircle,
  X,
  Loader2,
  Printer
} from 'lucide-react';
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

import { Checkbox } from '../../../components/ui/checkbox';
import { cn } from '../../../lib/utils';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../../../components/ui/table";

import { toast } from '@/lib/logger';
import { useDebounce } from '../../../hooks/useDebounce';
import { useAuth } from '../../../contexts/AuthContext';
import { usePurchaseBills, useVendors, useCreatePurchaseBill, useUpdatePOStatus } from '../hooks/usePurchaseQueries';
import { fetchSourceDocument, transformSourceToTarget, getSourceStatusAfterConversion } from '../../../conversions/api';
import { generateBillPDF, openPDFPreview } from '../utils/pdfGenerator';

const GST_RATES = [0, 5, 12, 18, 28];

interface BillItem {
  id?: string;
  _key: string;
  sr: number;
  item_name: string;
  batch_no: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_amount: number;
  taxable_value: number;
  cgst_percent: number;
  cgst_amount: number;
  sgst_percent: number;
  sgst_amount: number;
  igst_percent: number;
  igst_amount: number;
  total_amount: number;
  warehouse_id?: string;
  godown_location?: string;
}

export const Bills: React.FC = () => {
  const { organisation } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const debouncedSearch = useDebounce(searchTerm);
  const [isConversionLoading, setIsConversionLoading] = useState(false);
  const [conversionPoId, setConversionPoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const conversionProcessedRef = useRef(false);

  const markDirty = () => setIsDirty(true);

  const closeDialog = () => {
    setOpenDialog(false);
    setConversionPoId(null);
    setIsDirty(false);
    conversionProcessedRef.current = false;
  };

  const handleCancel = () => {
    if (isDirty) {
      setDiscardConfirmOpen(true);
    } else {
      closeDialog();
    }
  };
  const [pageIndex, setPageIndex] = useState(() => {
    const p = parseInt(searchParams.get('page') || '0', 10);
    return isNaN(p) ? 0 : p;
  });
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [vendorFilter, setVendorFilter] = useState(searchParams.get('vendor') || '');
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  const prevSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (debouncedSearch !== prevSearch.current) {
      prevSearch.current = debouncedSearch;
      setPageIndex(0);
      setSearchParams(prev => {
        if (debouncedSearch) prev.set('search', debouncedSearch);
        else prev.delete('search');
        prev.set('page', '0');
        return prev;
      }, { replace: true });
    }
  }, [debouncedSearch, setSearchParams]);

  const handlePageChange = useCallback((page: number) => {
    setPageIndex(page);
    setSearchParams(prev => {
      prev.set('page', String(page));
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
    setSearchParams(prev => {
      prev.set('page', '0');
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const handleStatusFilter = useCallback((status: string) => {
    setStatusFilter(status);
    setPageIndex(0);
    setSearchParams(prev => {
      if (status) prev.set('status', status);
      else prev.delete('status');
      prev.set('page', '0');
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const handleVendorFilter = useCallback((vendorId: string) => {
    setVendorFilter(vendorId);
    setPageIndex(0);
    setSearchParams(prev => {
      if (vendorId) prev.set('vendor', vendorId);
      else prev.delete('vendor');
      prev.set('page', '0');
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const handleBulkPrint = useCallback(() => {
    toast.info(`Print ${selectedRows.length} bill(s) - coming soon`);
  }, [selectedRows]);

  const handleBulkDelete = useCallback(async () => {
    toast.info(`Delete ${selectedRows.length} bill(s) - coming soon`);
  }, [selectedRows]);

  const [vendorId, setVendorId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [warehouseId, setWarehouseId] = useState('');
  const [directSupply, setDirectSupply] = useState(false);
  const [siteAddress, setSiteAddress] = useState('');
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [freightAmount, setFreightAmount] = useState(0);
  const [items, setItems] = useState<BillItem[]>([]);
  const [totals, setTotals] = useState({
    subtotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0,
    freight: 0, total: 0, totalInr: 0,
  });

  const { data: billsRes = { data: [], count: 0 }, isLoading } = usePurchaseBills(organisation?.id, {
    page: pageIndex,
    pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    vendor_id: vendorFilter || undefined,
  });
  const { data: vendors = [] } = useVendors(organisation?.id);
  const createBill = useCreatePurchaseBill();
  const updatePOStatus = useUpdatePOStatus();

  const bills = billsRes.data ?? [];
  const totalCount = billsRes.count ?? 0;

  // Handle conversion from Purchase Order
  useEffect(() => {
    const convertFromPoId = searchParams.get('convertFromPoId');
    if (!convertFromPoId || !organisation?.id || conversionProcessedRef.current) return;

    const loadConversion = async () => {
      setIsConversionLoading(true);
      try {
        const sourceData = await fetchSourceDocument('purchase-po-to-bill', convertFromPoId, organisation.id);
        const result = transformSourceToTarget('purchase-po-to-bill', sourceData);
        const data = result.data as any;

        // Pre-fill the bill form
        setVendorId(data.vendor_id || '');
        setConversionPoId(data.po_id || convertFromPoId);
        setCurrency(data.currency || 'INR');
        setExchangeRate(data.exchange_rate || 1);
        
        // Map PO items to bill items
        if (data.items && data.items.length > 0) {
          const billItems = data.items.map((item: any, idx: number) => ({
            _key: crypto.randomUUID(),
            sr: idx + 1,
            item_name: item.item_name || '',
            batch_no: '',
            quantity: item.quantity || 1,
            unit: item.unit || 'Nos',
            rate: item.rate || 0,
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
          setItems(billItems);
          calculateTotals(billItems);
        }

        // Open the dialog
        conversionProcessedRef.current = true;
        setOpenDialog(true);
        
        // Clear URL param
        setSearchParams(prev => { prev.delete('convertFromPoId'); return prev; }, { replace: true });
      } catch (err) {
        console.error('Failed to load PO conversion:', err);
      } finally {
        setIsConversionLoading(false);
      }
    };

    loadConversion();
  }, [searchParams, organisation?.id]);

  const handleAdd = () => {
    setOpenDialog(true);
    setVendorId('');
    setItems([]);
    setDirectSupply(false);
  };

  const addItem = () => {
    markDirty();
    setItems([...items, {
      _key: crypto.randomUUID(), sr: items.length + 1, item_name: '', batch_no: '', quantity: 1, unit: 'Nos',
      rate: 0, discount_amount: 0, taxable_value: 0, cgst_percent: 9, cgst_amount: 0,
      sgst_percent: 9, sgst_amount: 0, igst_percent: 18, igst_amount: 0, total_amount: 0,
    }]);
  };

  const updateItem = (index: number, field: keyof BillItem, value: any) => {
    markDirty();
    const updated = [...items];
    (updated[index] as any)[field] = value;
    const line = updated[index].quantity * updated[index].rate;
    updated[index].taxable_value = line - updated[index].discount_amount;
    updated[index].cgst_amount = (updated[index].taxable_value * updated[index].cgst_percent) / 100;
    updated[index].sgst_amount = (updated[index].taxable_value * updated[index].sgst_percent) / 100;
    updated[index].igst_amount = (updated[index].taxable_value * updated[index].igst_percent) / 100;
    updated[index].total_amount = updated[index].taxable_value + updated[index].cgst_amount + updated[index].sgst_amount;
    setItems(updated);
    calculateTotals(updated);
  };

  const calculateTotals = (currentItems: BillItem[]) => {
    let subtotal = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
    currentItems.forEach(item => {
      subtotal += item.quantity * item.rate;
      taxable += item.taxable_value;
      cgst += item.cgst_amount;
      sgst += item.sgst_amount;
      igst += item.igst_amount;
    });
    const total = taxable + cgst + sgst + igst + freightAmount;
    setTotals({
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: 0, taxable: parseFloat(taxable.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)), sgst: parseFloat(sgst.toFixed(2)),
      igst: parseFloat(igst.toFixed(2)), freight: freightAmount,
      total: parseFloat(total.toFixed(2)),
      totalInr: parseFloat((total * exchangeRate).toFixed(2)),
    });
  };

  const handleSave = async () => {
    if (!organisation?.id) return;
    setSaving(true);
    try {
      const billData = {
        organisation_id: organisation.id,
        bill_number: billNumber,
        vendor_invoice_no: vendorInvoiceNo,
        vendor_id: vendorId,
        bill_date: billDate,
        due_date: dueDate,
        currency,
        exchange_rate: exchangeRate,
        warehouse_id: directSupply ? null : warehouseId,
        direct_supply_to_site: directSupply,
        site_address: directSupply ? siteAddress : null,
        eway_bill_no: ewayBillNo,
        vehicle_no: vehicleNo,
        freight_amount: freightAmount,
        subtotal: totals.subtotal,
        taxable_amount: totals.taxable,
        cgst_amount: totals.cgst,
        sgst_amount: totals.sgst,
        igst_amount: totals.igst,
        total_amount: totals.total,
        total_amount_inr: totals.totalInr,
        net_amount: totals.total,
        payment_status: 'Unpaid',
      };
      await createBill.mutateAsync({ billData, items });

      // Update source PO status if this bill was created from a PO conversion
      if (conversionPoId) {
        try {
          await updatePOStatus.mutateAsync({
            poId: conversionPoId,
            status: getSourceStatusAfterConversion('purchase-po-to-bill'),
            updates: {},
          });
        } catch (err) {
          console.error('Failed to update PO status after billing:', err);
        }
      }

      toast.success('Bill created successfully');
      closeDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create bill');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      accessorKey: 'bill_number',
      header: 'Bill #',
      cell: ({ getValue, row }: any) => (
        <span className="font-semibold text-primary hover:underline cursor-pointer">
          {getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'bill_date',
      header: 'Date',
      cell: ({ getValue }: any) => new Date(getValue()).toLocaleDateString('en-IN'),
    },
    {
      accessorKey: 'vendor',
      header: 'Vendor',
      cell: ({ row }: any) => row.original.vendor?.company_name || '-',
    },
    {
      accessorKey: 'vendor_invoice_no',
      header: 'Vendor Inv#',
      cell: ({ getValue }: any) => getValue() || '-',
    },
    {
      accessorKey: 'total_amount',
      header: 'Amount',
      cell: ({ getValue }: any) => (
        <div className="font-medium text-right">
          ₹{Number(getValue()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      accessorKey: 'payment_status',
      header: 'Status',
      cell: ({ getValue }: any) => {
        const val = getValue();
        const colors: any = {
          'Paid': 'bg-emerald-50 text-emerald-700 border-emerald-200',
          'Partially Paid': 'bg-amber-50 text-amber-700 border-amber-200',
          'Unpaid': 'bg-zinc-50 text-zinc-700 border-zinc-200',
        };
        return (
          <Badge variant={val === 'Paid' ? 'success' : val === 'Partially Paid' ? 'warning' : 'default'}>
            {val}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'direct_supply',
      header: 'Direct',
      cell: ({ row }: any) => (
        <div className="flex justify-center">
          {row.original.direct_supply_to_site ? (
            <Truck className="h-4 w-4 text-primary" />
          ) : (
            <Warehouse className="h-4 w-4 text-zinc-400" />
          )}
        </div>
      ),
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-1">
          <ShadcnButton
            variant="ghost"
            size="sm"
            className="h-8 w-8 text-rose-600 hover:bg-rose-50"
            aria-label="View bill"
          >
            <FileText className="h-4 w-4" />
          </ShadcnButton>
          <ShadcnButton
            variant="ghost"
            size="sm"
            className="h-8 w-8 text-zinc-600 hover:bg-zinc-100"
            aria-label="Edit bill"
          >
            <Edit className="h-4 w-4" />
          </ShadcnButton>
          <ShadcnButton
            variant="ghost"
            size="sm"
            className="h-8 w-8 text-amber-600 hover:bg-amber-50"
            title="Convert to Debit Note"
            aria-label="Convert to Debit Note"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('convert-to-dn', { detail: { billId: row.original.id, billNumber: row.original.bill_number, vendorId: row.original.vendor_id } }));
            }}
          >
            <FileEdit className="h-4 w-4" />
          </ShadcnButton>
        </div>
      ),
    },
  ];


  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium text-zinc-900">Purchase Bills</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            {totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              placeholder="Search bills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 pl-8 h-[30px] w-56 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="h-[30px] px-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-zinc-600"
          >
            <option value="">All Status</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>
          <button
            onClick={handleAdd}
            className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:scale-[0.98]"
            style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Enter Bill
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <AppTable
          data={bills}
          columns={columns}
          loading={isLoading}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRows}
          manualPagination={true}
          totalCount={totalCount}
          pageIndex={pageIndex}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          bulkActions={selectedRows.length > 0 ? {
            selectedCount: selectedRows.length,
            onPrint: handleBulkPrint,
            onDelete: handleBulkDelete,
          } : undefined}
        />
      </div>

      <Dialog open={openDialog} onOpenChange={(open) => {
        if (!open) {
          if (isDirty) {
            setDiscardConfirmOpen(true);
          } else {
            closeDialog();
          }
        }
      }}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl font-bold">Enter Purchase Bill</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold uppercase text-zinc-500">Vendor *</Label>
                <Select value={vendorId} onValueChange={(v) => { setVendorId(v); markDirty(); }}>
                  <SelectTrigger className="border-zinc-200">
                    <SelectValue placeholder="Select Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-zinc-500">Bill Number *</Label>
                <Input value={billNumber} onChange={(e) => { setBillNumber(e.target.value); markDirty(); }} className="border-zinc-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-zinc-500">Vendor Inv#</Label>
                <Input value={vendorInvoiceNo} onChange={(e) => { setVendorInvoiceNo(e.target.value); markDirty(); }} className="border-zinc-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-zinc-500">Bill Date</Label>
                <Input type="date" value={billDate} onChange={(e) => { setBillDate(e.target.value); markDirty(); }} className="border-zinc-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-zinc-500">Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); markDirty(); }} className="border-zinc-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-zinc-500">Currency</Label>
                <Select value={currency} onValueChange={(v) => { setCurrency(v); markDirty(); }}>
                  <SelectTrigger className="border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['INR', 'USD', 'EUR'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-zinc-500">Exchange Rate</Label>
                <Input 
                  type="number" 
                  value={exchangeRate} 
                  onChange={(e) => { setExchangeRate(Number(e.target.value)); markDirty(); }} 
                  disabled={currency === 'INR'} 
                  className="border-zinc-200"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-800 border-b pb-2 flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-primary" />
                Warehouse / Storage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-zinc-500">Warehouse</Label>
                  <Input 
                    value={warehouseId} 
                    onChange={(e) => { setWarehouseId(e.target.value); markDirty(); }} 
                    disabled={directSupply} 
                    placeholder="Storage location..."
                    className="border-zinc-200"
                  />
                </div>
                <div className="flex items-center space-x-2 bg-primary/5 p-4 rounded-lg border border-primary/10">
                  <Checkbox id="direct" checked={directSupply} onCheckedChange={(val) => { setDirectSupply(!!val); markDirty(); }} />
                  <Label htmlFor="direct" className="text-sm font-semibold text-primary cursor-pointer">
                    Direct Supply to Site (Skip warehouse stock)
                  </Label>
                </div>
              </div>
              {directSupply && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-zinc-500">Site Address</Label>
                  <Input 
                    value={siteAddress} 
                    onChange={(e) => { setSiteAddress(e.target.value); markDirty(); }} 
                    placeholder="Project site address where materials are delivered..."
                    className="border-zinc-200"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-800 border-b pb-2 flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-primary" />
                Items & Costing
              </h3>
              <div className="border border-zinc-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-500">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="w-24">Batch</TableHead>
                      <TableHead className="w-20 text-center">Qty</TableHead>
                      <TableHead className="w-16">Unit</TableHead>
                      <TableHead className="w-24 text-right">Rate</TableHead>
                      <TableHead className="w-20 text-right">Disc</TableHead>
                      <TableHead className="w-20 text-center">GST%</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={item._key} className="group">
                        <TableCell className="text-[10px] text-zinc-400 font-medium">{item.sr}</TableCell>
                        <TableCell>
                          <Input className="h-8 text-xs border-transparent group-hover:border-zinc-200 bg-transparent shadow-none" value={item.item_name} onChange={(e) => updateItem(idx, 'item_name', e.target.value)} placeholder="Item name" />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-xs border-transparent group-hover:border-zinc-200 bg-transparent shadow-none" value={item.batch_no} onChange={(e) => updateItem(idx, 'batch_no', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 text-xs text-center border-transparent group-hover:border-zinc-200 bg-transparent shadow-none" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-xs border-transparent group-hover:border-zinc-200 bg-transparent shadow-none" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 text-xs text-right border-transparent group-hover:border-zinc-200 bg-transparent shadow-none" value={item.rate} onChange={(e) => updateItem(idx, 'rate', Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 text-xs text-right border-transparent group-hover:border-zinc-200 bg-transparent shadow-none" value={item.discount_amount} onChange={(e) => updateItem(idx, 'discount_amount', Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={String(item.cgst_percent + item.sgst_percent)} 
                            onValueChange={(val) => { 
                              const gst = Number(val); 
                              updateItem(idx, 'cgst_percent', gst/2); 
                              updateItem(idx, 'sgst_percent', gst/2); 
                              updateItem(idx, 'igst_percent', gst); 
                            }}
                          >
                            <SelectTrigger className="h-8 text-[10px] border-transparent group-hover:border-zinc-200 bg-transparent shadow-none text-center px-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-medium text-zinc-700 text-xs">
                          {item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <ShadcnButton 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { markDirty(); const updated = items.filter((_, i) => i !== idx); setItems(updated); calculateTotals(updated); }}
                            className="h-7 w-7 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-full"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ShadcnButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-3 bg-zinc-50 border-t flex justify-center">
                  <ShadcnButton variant="ghost" size="sm" onClick={addItem} className="text-primary font-bold gap-2 hover:bg-primary/5">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </ShadcnButton>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-sm bg-zinc-900 text-white rounded-xl p-6 shadow-xl space-y-3">
                <div className="flex justify-between text-xs opacity-70">
                  <span>Subtotal</span>
                  <span>₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-xs opacity-70">
                  <span>Freight</span>
                  <span>₹{totals.freight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-70">Grand Total</span>
                  <div className="text-right">
                    <div className="text-2xl font-black">
                      {currency === 'INR' ? '₹' : currency} {totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    {currency !== 'INR' && (
                      <div className="text-[10px] opacity-60">(~ ₹{totals.totalInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-zinc-50/50 flex flex-row items-center justify-between">
            <ShadcnButton variant="secondary" onClick={handleCancel} className="px-8 font-semibold">
              Cancel
            </ShadcnButton>
            <ShadcnButton 
              onClick={handleSave} 
              disabled={items.length === 0 || !vendorId || !billNumber || saving}
              className="px-10 bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-100"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Receipt className="h-4 w-4 mr-2" /> Complete Billing</>
              )}
            </ShadcnButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation */}
      {discardConfirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%' }}>
            <h3 className="text-base font-bold text-zinc-900 mb-2">Discard changes?</h3>
            <p className="text-sm text-zinc-500 mb-5">You have unsaved changes. Are you sure you want to discard them?</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDiscardConfirmOpen(false)}
                className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100"
                style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
              >
                Keep Editing
              </button>
              <button
                onClick={() => { setDiscardConfirmOpen(false); closeDialog(); }}
                className="inline-flex items-center justify-center text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Bills;