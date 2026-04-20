import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Receipt, 
  FileText, 
  Edit, 
  Trash2, 
  Warehouse, 
  Truck,
  PlusCircle,
  X
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
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
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

import { useAuth } from '../../../contexts/AuthContext';
import { usePurchaseBills, useVendors, useCreatePurchaseBill } from '../hooks/usePurchaseQueries';
import { generateBillPDF, openPDFPreview } from '../utils/pdfGenerator';

const GST_RATES = [0, 5, 12, 18, 28];

interface BillItem {
  id?: string;
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
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  const { data: bills = [], isLoading } = usePurchaseBills(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const createBill = useCreatePurchaseBill();

  const handleAdd = () => {
    setOpenDialog(true);
    setVendorId('');
    setItems([]);
    setDirectSupply(false);
  };

  const addItem = () => {
    setItems([...items, {
      sr: items.length + 1, item_name: '', batch_no: '', quantity: 1, unit: 'Nos',
      rate: 0, discount_amount: 0, taxable_value: 0, cgst_percent: 9, cgst_amount: 0,
      sgst_percent: 9, sgst_amount: 0, igst_percent: 18, igst_amount: 0, total_amount: 0,
    }]);
  };

  const updateItem = (index: number, field: keyof BillItem, value: any) => {
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
    const billData = {
      organisation_id: organisation?.id,
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
    setOpenDialog(false);
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
          ¥{Number(getValue()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
          'Unpaid': 'bg-slate-50 text-slate-700 border-slate-200',
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
            <Warehouse className="h-4 w-4 text-slate-400" />
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
          >
            <FileText className="h-4 w-4" />
          </ShadcnButton>
          <ShadcnButton 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 text-slate-600 hover:bg-slate-100"
          >
            <Edit className="h-4 w-4" />
          </ShadcnButton>
        </div>
      ),
    },
  ];


  return (
    <div className="h-full flex flex-col space-y-4 p-4 md:p-6 bg-slate-50/50">
      <Card className="border-none shadow-sm overflow-hidden text-sm">
        <CardHeader className="py-4 px-6 bg-white border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Purchase Bills</CardTitle>
                <p className="text-xs text-slate-500 font-medium">Record and manage vendor invoices</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search bills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64 h-9 text-xs border-slate-200 focus:ring-primary/20"
                />
              </div>
              <ShadcnButton 
                onClick={handleAdd} 
                className="h-9 gap-2 shadow-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                Enter Bill
              </ShadcnButton>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="flex-1 border-none shadow-sm overflow-hidden bg-white">
        <div className="h-[calc(100vh-220px)] overflow-auto p-1">
          <AppTable
            data={bills}
            columns={columns}
            loading={isLoading}
          />
        </div>
      </Card>

      <Dialog open={openDialog} onOpenChange={(open) => !open && setOpenDialog(false)}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl font-bold">Enter Purchase Bill</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Vendor *</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger className="border-slate-200">
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
                <Label className="text-xs font-bold uppercase text-slate-500">Bill Number *</Label>
                <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} className="border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Vendor Inv#</Label>
                <Input value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} className="border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Bill Date</Label>
                <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['INR', 'USD', 'EUR'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Exchange Rate</Label>
                <Input 
                  type="number" 
                  value={exchangeRate} 
                  onChange={(e) => setExchangeRate(Number(e.target.value))} 
                  disabled={currency === 'INR'} 
                  className="border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-primary" />
                Warehouse / Storage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-slate-500">Warehouse</Label>
                  <Input 
                    value={warehouseId} 
                    onChange={(e) => setWarehouseId(e.target.value)} 
                    disabled={directSupply} 
                    placeholder="Storage location..."
                    className="border-slate-200"
                  />
                </div>
                <div className="flex items-center space-x-2 bg-primary/5 p-4 rounded-lg border border-primary/10">
                  <Checkbox id="direct" checked={directSupply} onCheckedChange={(val) => setDirectSupply(!!val)} />
                  <Label htmlFor="direct" className="text-sm font-semibold text-primary cursor-pointer">
                    Direct Supply to Site (Skip warehouse stock)
                  </Label>
                </div>
              </div>
              {directSupply && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-slate-500">Site Address</Label>
                  <Input 
                    value={siteAddress} 
                    onChange={(e) => setSiteAddress(e.target.value)} 
                    placeholder="Project site address where materials are delivered..."
                    className="border-slate-200"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-primary" />
                Items & Costing
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
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
                      <TableRow key={idx} className="group">
                        <TableCell className="text-[10px] text-slate-400 font-medium">{item.sr}</TableCell>
                        <TableCell>
                          <Input className="h-8 text-xs border-transparent group-hover:border-slate-200 bg-transparent shadow-none" value={item.item_name} onChange={(e) => updateItem(idx, 'item_name', e.target.value)} placeholder="Item name" />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-xs border-transparent group-hover:border-slate-200 bg-transparent shadow-none" value={item.batch_no} onChange={(e) => updateItem(idx, 'batch_no', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 text-xs text-center border-transparent group-hover:border-slate-200 bg-transparent shadow-none" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-xs border-transparent group-hover:border-slate-200 bg-transparent shadow-none" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 text-xs text-right border-transparent group-hover:border-slate-200 bg-transparent shadow-none" value={item.rate} onChange={(e) => updateItem(idx, 'rate', Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 text-xs text-right border-transparent group-hover:border-slate-200 bg-transparent shadow-none" value={item.discount_amount} onChange={(e) => updateItem(idx, 'discount_amount', Number(e.target.value))} />
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
                            <SelectTrigger className="h-8 text-[10px] border-transparent group-hover:border-slate-200 bg-transparent shadow-none text-center px-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-700 text-xs">
                          {item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <ShadcnButton 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { const updated = items.filter((_, i) => i !== idx); setItems(updated); calculateTotals(updated); }}
                            className="h-7 w-7 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ShadcnButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-3 bg-slate-50 border-t flex justify-center">
                  <ShadcnButton variant="ghost" size="sm" onClick={addItem} className="text-primary font-bold gap-2 hover:bg-primary/5">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </ShadcnButton>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-sm bg-slate-900 text-white rounded-xl p-6 shadow-xl space-y-3">
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

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/50 flex flex-row items-center justify-between">
            <ShadcnButton variant="outline" onClick={() => setOpenDialog(false)} className="px-8 border-slate-200 font-semibold">
              Cancel
            </ShadcnButton>
            <ShadcnButton 
              onClick={handleSave} 
              disabled={items.length === 0 || !vendorId || !billNumber}
              className="px-10 bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-100"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Complete Billing
            </ShadcnButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Bills;