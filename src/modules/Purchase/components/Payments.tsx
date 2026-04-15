import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Banknote, 
  FileText, 
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  CreditCard,
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
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { cn } from '../../../lib/utils';

import { toast } from '@/lib/logger';
import { useAuth } from '../../../contexts/AuthContext';
import { usePayments, useVendors, useVendorOpenBills, useCreatePayment } from '../hooks/usePurchaseQueries';

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Card', 'NEFT', 'RTGS'];

export const Payments: React.FC = () => {
  const { organisation, user } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [vendorId, setVendorId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [amount, setAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [narration, setNarration] = useState('');
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [isAdvance, setIsAdvance] = useState(false);
  const [hasVendorProforma, setHasVendorProforma] = useState(false);
  const [vendorProformaInvoice, setVendorProformaInvoice] = useState('');
  const [vendorProformaDate, setVendorProformaDate] = useState('');
  const [vendorProformaAmount, setVendorProformaAmount] = useState('');

  const { data: payments = [], isLoading } = usePayments(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const { data: vendorBills = [] } = useVendorOpenBills(organisation?.id, vendorId || undefined, openDialog && !isAdvance);
  const createPayment = useCreatePayment();
  const selectedBills = vendorBills.filter((bill: any) => selectedBillIds.includes(String(bill.id)));
  const isLastStep = isAdvance ? activeStep === 1 : activeStep === 2;

  const handleAddPayment = () => {
    setOpenDialog(true);
    setActiveStep(0);
    setVendorId('');
    setAmount('');
    setSelectedBillIds([]);
    setIsAdvance(false);
    setReferenceNo('');
    setBankAccount('');
    setNarration('');
    setPaymentMode('Bank Transfer');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setHasVendorProforma(false);
    setVendorProformaInvoice('');
    setVendorProformaDate('');
    setVendorProformaAmount('');
  };

  const handleCreateRequest = () => {
    setOpenRequestDialog(true);
  };

  const buildBillAllocations = () => {
    let remainingAmount = Number(amount);

    return selectedBills.reduce((allocations: any[], bill: any) => {
      const billBalance = Number(bill.balance_amount ?? bill.total_amount ?? 0);
      if (remainingAmount <= 0 || billBalance <= 0) {
        return allocations;
      }

      const adjustedAmount = Math.min(remainingAmount, billBalance);
      remainingAmount -= adjustedAmount;

      allocations.push({
        bill_id: bill.id,
        adjusted_amount: adjustedAmount,
        tds_amount: Number(bill.tds_amount || 0),
      });

      return allocations;
    }, []);
  };

  const handleSave = async () => {
    if (!organisation?.id) {
      toast.error('Organisation is required to record a payment.');
      return;
    }

    if (!vendorId) {
      toast.error('Please select a vendor.');
      setActiveStep(0);
      return;
    }

    if (!amount || Number(amount) <= 0) {
      toast.error('Please enter a valid payment amount.');
      setActiveStep(1);
      return;
    }

    if (!isAdvance && selectedBillIds.length === 0) {
      toast.error('Please select at least one bill for this payment.');
      setActiveStep(2);
      return;
    }

    if (hasVendorProforma && !vendorProformaInvoice.trim()) {
      toast.error('Please enter the vendor proforma invoice reference.');
      setActiveStep(1);
      return;
    }

    const paymentData = {
      organisation_id: organisation.id,
      vendor_id: vendorId,
      payment_date: paymentDate,
      payment_mode: paymentMode,
      amount: Number(amount),
      net_amount: Number(amount),
      reference_no: referenceNo,
      bank_name: bankAccount || null,
      narration,
      is_advance: isAdvance,
      advance_remaining: isAdvance ? Number(amount) : 0,
      created_by: user?.id ?? null,
      ...(hasVendorProforma
        ? {
            has_vendor_proforma: true,
            vendor_proforma_invoice: vendorProformaInvoice.trim(),
            vendor_proforma_date: vendorProformaDate || null,
            vendor_proforma_amount: vendorProformaAmount ? Number(vendorProformaAmount) : null,
          }
        : {}),
    };

    const billAllocations = isAdvance ? [] : buildBillAllocations();

    if (!isAdvance && billAllocations.length === 0) {
      toast.error('No bill amount could be allocated from the selected bills.');
      return;
    }

    try {
      await createPayment.mutateAsync({ paymentData, billAllocations });
      toast.success('Payment saved successfully.');
      setOpenDialog(false);
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to save payment.');
    }
  };

  const columns = [
    {
      id: 'voucher_no',
      header: 'Voucher #',
      cell: ({ row }: any) => (
        <span className="font-semibold text-emerald-600">
          {row.original.voucher_no}
        </span>
      ),
    },
    {
      id: 'payment_date',
      header: 'Date',
      cell: ({ row }: any) => new Date(row.original.payment_date).toLocaleDateString('en-IN'),
    },
    {
      id: 'vendor',
      header: 'Vendor',
      cell: ({ row }: any) => row.original.vendor?.company_name || '-',
    },
    {
      id: 'payment_mode',
      header: 'Mode',
      cell: ({ row }: any) => (
        <Badge variant="outline" className="text-[10px] font-medium px-2 py-0 h-5 border-slate-200 text-slate-600 bg-slate-50">
          {row.original.payment_mode}
        </Badge>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }: any) => (
        <div className="font-medium text-right text-emerald-600">
          ₹{Number(row.original.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: 'reference_no',
      header: 'Reference',
      cell: ({ row }: any) => row.original.reference_no || '-',
    },
    {
      id: 'is_advance',
      header: 'Type',
      cell: ({ row }: any) => (
        <Badge className={cn(
          "text-[10px] font-medium px-2 py-0 h-5 border shadow-none",
          row.original.is_advance ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-700 border-slate-200"
        )}>
          {row.original.is_advance ? 'Advance' : 'Against Bill'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: () => (
        <div className="flex items-center gap-1">
          <ShadcnButton 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-rose-600 hover:bg-rose-50"
          >
            <FileText className="h-4 w-4" />
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
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Banknote className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Payments Made</CardTitle>
                <p className="text-xs text-slate-500 font-medium">Record and track vendor payments</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShadcnButton 
                variant="outline"
                onClick={handleCreateRequest} 
                className="h-9 gap-2 shadow-sm font-semibold border-slate-200"
              >
                <Plus className="h-4 w-4" />
                Payment Request
              </ShadcnButton>
              <ShadcnButton 
                onClick={handleAddPayment} 
                className="h-9 gap-2 shadow-sm font-semibold bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Record Payment
              </ShadcnButton>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="flex-1 border-none shadow-sm overflow-hidden bg-white">
        <div className="h-[calc(100vh-220px)] overflow-auto p-1">
          <AppTable
            data={payments}
            columns={columns}
            loading={isLoading}
          />
        </div>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={openDialog} onOpenChange={(open) => !open && setOpenDialog(false)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-emerald-50/30">
            <DialogTitle className="text-xl font-bold text-emerald-900">Record Payment</DialogTitle>
          </DialogHeader>

          <div className="p-0 flex flex-col h-[70vh]">
            {/* Custom Stepper */}
            <div className="flex items-center px-12 py-6 bg-white border-b gap-4">
              {[0, 1, 2].map((step) => (
                <div key={step} className="flex-1 flex items-center gap-2 group">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                    activeStep === step ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 ring-4 ring-emerald-50" : 
                    activeStep > step ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                  )}>
                    {activeStep > step ? <CheckCircle2 className="h-5 w-5" /> : step + 1}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    activeStep === step ? "text-slate-900" : "text-slate-400"
                  )}>
                    {step === 0 ? "Vendor" : step === 1 ? "Payment" : "Allocation"}
                  </span>
                  {step < 2 && <div className="flex-1 h-0.5 bg-slate-100" />}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-8 space-y-6">
              {activeStep === 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-slate-500">Select Vendor *</Label>
                    <Select value={vendorId} onValueChange={(val) => { setVendorId(val); setSelectedBillIds([]); }}>
                      <SelectTrigger className="h-10 border-slate-200">
                        <SelectValue placeholder="Search and select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((v: any) => (
                          <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                      <Checkbox id="advance" checked={isAdvance} onCheckedChange={(val) => setIsAdvance(!!val)} />
                      <Label htmlFor="advance" className="text-sm font-semibold text-amber-700 cursor-pointer">
                        Advance Payment (Without Bill)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 bg-primary/5 p-4 rounded-xl border border-primary/10">
                      <Checkbox id="proforma" checked={hasVendorProforma} onCheckedChange={(val) => setHasVendorProforma(!!val)} />
                      <Label htmlFor="proforma" className="text-sm font-semibold text-primary cursor-pointer">
                        Proforma Invoice
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-slate-500">Payment Date</Label>
                    <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-slate-500">Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-slate-500">Amount *</Label>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-slate-500">Reference / No</Label>
                    <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Txn ID, Cheque #, etc" className="h-10" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-slate-500">Bank Account / Account Name</Label>
                    <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="h-10" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-slate-500">Narration</Label>
                    <textarea 
                      className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                    />
                  </div>

                  {hasVendorProforma && (
                    <div className="md:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-2 space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Proforma Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 tracking-wider">PI Reference</Label>
                          <Input value={vendorProformaInvoice} onChange={(e) => setVendorProformaInvoice(e.target.value)} className="h-9 text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 tracking-wider">PI Date</Label>
                          <Input type="date" value={vendorProformaDate} onChange={(e) => setVendorProformaDate(e.target.value)} className="h-9 text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 tracking-wider">PI Amount</Label>
                          <Input type="number" value={vendorProformaAmount} onChange={(e) => setVendorProformaAmount(e.target.value)} className="h-9 text-xs font-bold" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeStep === 2 && !isAdvance && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Select Bills to Settle</h3>
                    <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-semibold">
                      Payment Amount: <span className="text-emerald-600">₹{Number(amount).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Bill #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendorBills.map((bill: any) => (
                          <TableRow key={bill.id}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedBillIds.includes(String(bill.id))} 
                                onCheckedChange={(val) => {
                                  if (val) setSelectedBillIds([...selectedBillIds, String(bill.id)]);
                                  else setSelectedBillIds(selectedBillIds.filter(id => id !== String(bill.id)));
                                }} 
                              />
                            </TableCell>
                            <TableCell className="font-semibold text-slate-700">{bill.bill_number}</TableCell>
                            <TableCell className="text-xs text-slate-500 font-medium">{new Date(bill.bill_date).toLocaleDateString('en-IN')}</TableCell>
                            <TableCell className="text-right font-medium">₹{Number(bill.total_amount).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold text-rose-600 italic">₹{Number(bill.balance_amount || bill.total_amount).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/50 flex flex-row items-center justify-between">
            <ShadcnButton variant="outline" onClick={() => setOpenDialog(false)} className="px-8 border-slate-200 font-semibold h-10">
              Cancel
            </ShadcnButton>
            <div className="flex gap-3">
              {activeStep > 0 && (
                <ShadcnButton variant="ghost" onClick={() => setActiveStep(activeStep - 1)} className="gap-2 h-10 px-8">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </ShadcnButton>
              )}
              {!isLastStep ? (
                <ShadcnButton onClick={() => setActiveStep(activeStep + 1)} disabled={activeStep === 0 && !vendorId} className="gap-2 h-10 px-10">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </ShadcnButton>
              ) : (
                <ShadcnButton 
                  onClick={handleSave} 
                  disabled={createPayment.isPending || !amount || Number(amount) <= 0}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2 h-10 px-10 font-bold shadow-lg shadow-emerald-100"
                >
                  {createPayment.isPending ? 'Processing...' : 'Complete Payment'}
                  <CheckCircle2 className="h-4 w-4" />
                </ShadcnButton>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Request Dialog */}
      <Dialog open={openRequestDialog} onOpenChange={(open) => !open && setOpenRequestDialog(false)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-primary/5">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              Create Payment Request
            </DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-500">Vendor</Label>
              <Select>
                <SelectTrigger className="h-10 border-slate-200">
                  <SelectValue placeholder="Which vendor are we paying?" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Amount Requested</Label>
                <Input type="number" placeholder="0.00" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Priority</Label>
                <Select defaultValue="Normal">
                  <SelectTrigger className="h-10 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-500">Expected Payment Date</Label>
              <Input type="date" className="h-10" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-500">Reason / Notes</Label>
              <textarea 
                className="flex min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                placeholder="Brief description of what this payment is for..."
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/50">
            <ShadcnButton variant="outline" onClick={() => setOpenRequestDialog(false)} className="px-8 font-semibold border-slate-200">
              Cancel
            </ShadcnButton>
            <ShadcnButton onClick={() => setOpenRequestDialog(false)} className="px-10 font-bold shadow-lg shadow-primary/10">
              Submit Request
            </ShadcnButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default Payments;
