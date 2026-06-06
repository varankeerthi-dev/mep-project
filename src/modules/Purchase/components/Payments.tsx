import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Plus,
  PlusCircle,
  Search,
  X
} from 'lucide-react';
import { Smile } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Button as ShadcnButton } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/Badge';
import { AppTable } from '../../../components/ui/AppTable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Label } from '../../../components/ui/label';
import { Checkbox } from '../../../components/ui/checkbox';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/table';
import { cn } from '../../../lib/utils';

import { toast } from '@/lib/logger';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrgApprovalSettings } from '@/hooks/useApprovals';
import { usePayments, useVendors, useVendorOpenBills, useCreatePayment, useCreatePaymentWithApproval, useCreatePaymentRequest, usePaymentRequests, useDeletePaymentRequest, useResendPaymentRequest, useUpdatePaymentRequest } from '../hooks/usePurchaseQueries';

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
  const [requestVendorId, setRequestVendorId] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestPriority, setRequestPriority] = useState('Normal');
  const [requestDueDate, setRequestDueDate] = useState('');
  const [requestPaymentMode, setRequestPaymentMode] = useState('Bank Transfer');
  const [requestBankAccount, setRequestBankAccount] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [activeView, setActiveView] = useState<'payments' | 'requests'>('payments');
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved'>('all');

  const { data: payments = [], isLoading } = usePayments(organisation?.id);
  const { data: requests = [], isLoading: requestsLoading } = usePaymentRequests(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const { data: vendorBills = [] } = useVendorOpenBills(organisation?.id, vendorId || undefined, openDialog && !isAdvance);
  const { settings: approvalSettings } = useOrgApprovalSettings(organisation?.id);
  const createPayment = useCreatePayment();
  const createPaymentWithApproval = useCreatePaymentWithApproval();
  const [editRequest, setEditRequest] = useState<any | null>(null);
  const editIdRef = useRef<string | null>(null);
  const createPaymentRequest = useCreatePaymentRequest();
  const updatePaymentRequest = useUpdatePaymentRequest();
  const deletePaymentRequest = useDeletePaymentRequest();
  const resendPaymentRequest = useResendPaymentRequest();
  const selectedBills = vendorBills.filter((bill: any) => selectedBillIds.includes(String(bill.id)));
  const isLastStep = isAdvance ? activeStep === 1 : activeStep === 2;
  const paymentApprovalEnabled = approvalSettings?.PURCHASE_PAYMENT ?? false;

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

  const handleCreateRequest = (request?: any) => {
    if (request) {
      editIdRef.current = request?.id || request?.request_id || null;
      setEditRequest(request);
      setRequestVendorId(request.vendor_id || '');
      setRequestAmount(String(request.amount_requested || ''));
      setRequestPriority(request.priority || 'Normal');
      setRequestDueDate(request.due_date || '');
      setRequestPaymentMode(request.payment_mode || 'Bank Transfer');
      setRequestBankAccount(request.bank_account_id || '');
      setRequestReason(request.reason || '');
    }
    setOpenRequestDialog(true);
  };

  const resetRequestForm = () => {
    editIdRef.current = null;
    setEditRequest(null);
    setRequestVendorId('');
    setRequestAmount('');
    setRequestPriority('Normal');
    setRequestDueDate('');
    setRequestPaymentMode('Bank Transfer');
    setRequestBankAccount('');
    setRequestReason('');
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
      if (paymentApprovalEnabled) {
        await createPaymentWithApproval.mutateAsync({ paymentData, billAllocations, createdBy: user?.id ?? null });
        toast.success('Payment submitted for approval.');
      } else {
        await createPayment.mutateAsync({ paymentData, billAllocations });
        toast.success('Payment saved successfully.');
      }
      setOpenDialog(false);
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to save payment.');
    }
  };

  const requestColumns = [
    {
      id: 'request_date',
      header: 'Date',
      cell: ({ row }: any) => {
        const d = new Date(row.original.request_date);
        const dd = String(d.getDate()).padStart(2, '0');
        const mmm = d.toLocaleString('en-US', { month: 'short' });
        const yyyy = d.getFullYear();
        return <span className="text-[10px]">{`${dd}-${mmm}-${yyyy}`}</span>;
      },
    },
    {
      id: 'vendor',
      header: 'Payee',
      cell: ({ row }: any) => <span className="text-[10px]">{row.original.vendor?.company_name || row.original.subcontractor?.company_name || '-'}</span>,
    },
    {
      id: 'amount_requested',
      header: 'Amount',
      cell: ({ row }: any) => (
        <div className="font-medium text-left text-emerald-600 text-[10px]">
          ₹{Number(row.original.amount_requested).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: 'payment_mode',
      header: 'Mode',
      cell: ({ row }: any) => <span className="text-[10px]">{row.original.payment_mode || '-'}</span>,
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: ({ row }: any) => {
        const colors: any = {
          Urgent: 'bg-rose-100 text-rose-700 border-rose-200',
          High: 'bg-orange-100 text-orange-700 border-orange-200',
          Normal: 'bg-zinc-100 text-zinc-700 border-zinc-200',
          Low: 'bg-blue-50 text-blue-700 border-blue-200',
        };
        return (
          <span className={`inline-flex text-[10px] font-bold px-2 py-1 rounded-full border ${colors[row.original.priority] || colors.Normal}`}>
            {row.original.priority}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Paid/Unpaid',
      cell: ({ row }: any) => {
        const isPaid = row.original.status === 'Paid';
        return (
          <span className={`inline-flex text-[10px] font-bold px-2 py-1 rounded-full border ${isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>
            {isPaid ? 'Paid' : 'Unpaid'}
          </span>
        );
      },
    },
    {
      id: 'approval_status',
      header: 'Approval Status',
      cell: ({ row }: any) => {
        const raw = row.original.approval_status || row.original.workflow_step || row.original.status;
        const colors: Record<string, string> = {
          pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
          PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
          approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          rejected: 'bg-red-50 text-red-700 border-red-200',
          Rejected: 'bg-red-50 text-red-700 border-red-200',
          released: 'bg-blue-100 text-blue-700 border-blue-200',
          Released: 'bg-blue-100 text-blue-700 border-blue-200',
          Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        };
        const label = typeof raw === 'string' ? raw.replace(/_/g, ' ') : '-';
        return (
          <span className={`inline-flex text-[10px] font-bold px-2 py-1 rounded-full border ${colors[raw] || 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>
            {label}
          </span>
        );
      },
    },
    {
      id: 'due_date',
      header: 'Due By',
      cell: ({ row }: any) => {
        if (!row.original.due_date) return '-';
        const due = new Date(row.original.due_date);
        const daysLeft = Math.ceil((due.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const dd = String(due.getDate()).padStart(2, '0');
        const mmm = due.toLocaleString('en-US', { month: 'short' });
        const yyyy = due.getFullYear();
        return (
          <div>
            <span className="text-[10px] text-zinc-700">{`${dd}-${mmm}-${yyyy}`}</span>
            <span className="ml-2 text-[10px] font-semibold text-zinc-500">{daysLeft > 0 ? `${daysLeft}d` : `${Math.abs(daysLeft)}d overdue`}</span>
          </div>
        );
      },
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: ({ row }: any) => (
        <span className="text-[10px] text-zinc-600 truncate block max-w-[240px]">{row.original.reason || '-'}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => {
        const r = row.original;
        const canEdit = r.status !== 'Approved' && r.status !== 'APPROVED';
        const canResend = r.status === 'Rejected' || r.status === 'Cancelled';
        return (
          <div className="flex items-center gap-1">
            {canEdit && (
              <button
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  handleCreateRequest(r);
                }}
                className="h-7 px-2 text-[10px] font-semibold text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-md hover:bg-zinc-100 transition-colors active:scale-[0.98]"
                title="Edit this request"
              >
                Edit
              </button>
            )}
            {canResend && (
              <button
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  resendPaymentRequest.mutate(
                    { requestId: r.id, organisationId: r.organisation_id },
                    { onSuccess: () => toast.success('Re-submitted for approval'), onError: (e: any) => toast.error(e?.message ?? 'Resend failed') }
                  );
                }}
                disabled={resendPaymentRequest.isPending}
                className="h-7 px-2 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors active:scale-[0.98]"
                title="Resend for approval"
              >
                Resend
              </button>
            )}
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (confirm('Delete this payment request?')) {
                  deletePaymentRequest.mutate(
                    { requestId: r.id, organisationId: r.organisation_id },
                    { onSuccess: () => toast.success('Payment request deleted'), onError: (e: any) => toast.error(e?.message ?? 'Delete failed') }
                  );
                }
              }}
              disabled={deletePaymentRequest.isPending}
              className="h-7 px-2 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors active:scale-[0.98]"
              title="Delete this request"
            >
              Delete
            </button>
          </div>
        );
      },
    },
  ];

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
        <Badge variant="outline" className="text-[10px] font-medium px-2 py-0 h-5 border-zinc-200 text-zinc-600 bg-zinc-50">
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
          row.original.is_advance ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-50 text-zinc-700 border-zinc-200"
        )}>
          {row.original.is_advance ? 'Advance' : 'Against Bill'}
        </Badge>
      ),
    },
    {
      id: 'workflow_step',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.original.workflow_step || row.original.approval_status || 'Not Required';
        const colorMap: Record<string, string> = {
          pending_approval: 'bg-amber-100 text-amber-700 border-amber-200',
          approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          released: 'bg-blue-100 text-blue-700 border-blue-200',
          rejected: 'bg-red-100 text-red-700 border-red-200',
        };
        return (
          <span className={`inline-flex text-[10px] font-semibold px-2 py-1 rounded-full border ${colorMap[status] || 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
            {String(status).replace(/_/g, ' ')}
          </span>
        );
      },
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
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium text-zinc-900">
            {activeView === 'payments' ? 'Payments Made' : 'Payment Requests'}
          </h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            {activeView === 'payments' ? payments.length : requests.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {activeView === 'payments' ? (
            <>
              <button
                onClick={handleCreateRequest}
                className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-[0.98]"
                style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Payment Request
              </button>
              <button
                onClick={handleAddPayment}
                className="inline-flex items-center justify-center text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm active:scale-[0.98]"
                style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Record Payment
              </button>
            </>
          ) : (
            <button
              onClick={handleCreateRequest}
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:scale-[0.98]"
              style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Request
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-6 border-b border-zinc-100 bg-zinc-50/40">
        {(['payments', 'requests'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={cn(
              'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
              activeView === view
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            )}
          >
            {view === 'payments' ? 'Payments Made' : 'Payment Requests'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {activeView === 'payments' ? (
          <AppTable
            data={payments}
            columns={columns}
            loading={isLoading}
          />
        ) : (
          <>
            <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-zinc-100">
              {(['all', 'pending', 'approved'] as const).map((f) => {
                const counts = {
                  all: requests.length,
                  pending: requests.filter((r: any) => r.status !== 'Approved' && r.status !== 'APPROVED' && r.status !== 'Rejected' && r.status !== 'Cancelled' && r.status !== 'Paid').length,
                  approved: requests.filter((r: any) => r.status === 'Approved' || r.status === 'APPROVED' || r.status === 'Paid').length,
                };
                return (
                  <button
                    key={f}
                    onClick={() => setRequestFilter(f)}
                    className={cn(
                      'h-9 px-3 text-xs font-semibold rounded-full border transition-colors',
                      requestFilter === f
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                    )}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                  </button>
                );
              })}
            </div>
            <AppTable
              data={requests.filter((r: any) => {
                if (requestFilter === 'all') return true;
                if (requestFilter === 'pending') return r.status !== 'Approved' && r.status !== 'APPROVED' && r.status !== 'Rejected' && r.status !== 'Cancelled' && r.status !== 'Paid';
                if (requestFilter === 'approved') return r.status === 'Approved' || r.status === 'APPROVED' || r.status === 'Paid';
                return true;
              })}
              columns={requestColumns}
              loading={requestsLoading}
              defaultPageSize={20}
            />
          </>
        )}
      </div>

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
                    activeStep > step ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-400"
                  )}>
                    {activeStep > step ? <CheckCircle2 className="h-5 w-5" /> : step + 1}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    activeStep === step ? "text-zinc-900" : "text-zinc-400"
                  )}>
                    {step === 0 ? "Vendor" : step === 1 ? "Payment" : "Allocation"}
                  </span>
                  {step < 2 && <div className="flex-1 h-0.5 bg-zinc-100" />}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-8 space-y-6">
              {activeStep === 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Select Vendor *</Label>
                    <Select value={vendorId} onValueChange={(val) => { setVendorId(val); setSelectedBillIds([]); }}>
                      <SelectTrigger className="h-10 border-zinc-200">
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
                    <Label className="text-xs font-bold uppercase text-zinc-500">Payment Date</Label>
                    <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Payment Mode</Label>
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
                    <Label className="text-xs font-bold uppercase text-zinc-500">Amount *</Label>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Reference / No</Label>
                    <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Txn ID, Cheque #, etc" className="h-10" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Bank Account / Account Name</Label>
                    <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="h-10" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Narration</Label>
                    <textarea 
                      className="flex min-h-[80px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                    />
                  </div>

                  {hasVendorProforma && (
                    <div className="md:col-span-2 bg-zinc-50 p-6 rounded-2xl border border-zinc-200 mt-2 space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Proforma Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-zinc-500 tracking-wider">PI Reference</Label>
                          <Input value={vendorProformaInvoice} onChange={(e) => setVendorProformaInvoice(e.target.value)} className="h-9 text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-zinc-500 tracking-wider">PI Date</Label>
                          <Input type="date" value={vendorProformaDate} onChange={(e) => setVendorProformaDate(e.target.value)} className="h-9 text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-zinc-500 tracking-wider">PI Amount</Label>
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
                    <h3 className="text-sm font-bold text-zinc-800">Select Bills to Settle</h3>
                    <div className="text-xs text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full font-semibold">
                      Payment Amount: <span className="text-emerald-600">₹{Number(amount).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="border border-zinc-200 rounded-2xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-zinc-50">
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
                            <TableCell className="font-semibold text-zinc-700">{bill.bill_number}</TableCell>
                            <TableCell className="text-xs text-zinc-500 font-medium">{new Date(bill.bill_date).toLocaleDateString('en-IN')}</TableCell>
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

          <DialogFooter className="px-6 py-4 border-t bg-zinc-50/50 flex flex-row items-center justify-between">
            <ShadcnButton variant="outline" onClick={() => setOpenDialog(false)} className="px-8 border-zinc-200 font-semibold h-10">
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
      <Dialog open={openRequestDialog} onOpenChange={(open) => {
        if (!open) { setOpenRequestDialog(false); resetRequestForm(); }
      }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-10 py-8 border-b bg-primary/5">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <PlusCircle className="h-6 w-6 text-primary" />
              {editRequest ? 'Edit Payment Request' : 'Create Payment Request'}
            </DialogTitle>
            <p className="text-sm text-zinc-500 mt-1">
              {editRequest ? 'Update the payment request details below.' : 'Fill in the payment details below. Required fields are marked.'}
            </p>
          </DialogHeader>

          <form
            className="px-10 py-8 space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();

              if (!organisation?.id) {
                toast.error('Organisation is required to submit a payment request.');
                return;
              }

              if (!requestVendorId) {
                toast.error('Please select a vendor for this request.');
                return;
              }

              if (!requestAmount || Number(requestAmount) <= 0) {
                toast.error('Please enter a valid amount requested.');
                return;
              }

              if (!requestDueDate) {
                toast.error('Please select an expected payment date.');
                return;
              }

              try {
                if (editIdRef.current) {
                  await updatePaymentRequest.mutateAsync({
                    id: editIdRef.current,
                    organisation_id: organisation.id || null,
                    vendor_id: requestVendorId || null,
                    amount_requested: Number(requestAmount),
                    priority: requestPriority,
                    due_date: requestDueDate,
                    payment_mode: requestPaymentMode,
                    bank_account_id: requestBankAccount || null,
                    reason: requestReason,
                  });
                  toast.success('Payment request updated.');
                } else {
                  await createPaymentRequest.mutateAsync({
                    organisation_id: organisation.id || null,
                    vendor_id: requestVendorId || null,
                    amount_requested: Number(requestAmount),
                    priority: requestPriority,
                    due_date: requestDueDate,
                    payment_mode: requestPaymentMode,
                    bank_account_id: requestBankAccount || null,
                    reason: requestReason,
                    status: 'Pending',
                    requested_by: user?.id || null,
                  });
                  toast.success('Payment request submitted for approval.');
                }
                setOpenRequestDialog(false);
                resetRequestForm();
              } catch (err: any) {
                toast.error(err?.message ?? 'Failed to submit payment request.');
              }
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-zinc-500">Vendor</Label>
                <Select value={requestVendorId} onValueChange={(value) => setRequestVendorId(value)}>
                  <SelectTrigger className="h-12 border-zinc-200">
                    <SelectValue placeholder="Select a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>{vendor.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-zinc-500">Priority</Label>
                <Select value={requestPriority} onValueChange={(value) => setRequestPriority(value)}>
                  <SelectTrigger className="h-12 border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Low', 'Normal', 'High', 'Urgent'].map((priority) => (
                      <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-zinc-500">Amount Requested</Label>
                <Input
                  type="number"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-12"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-zinc-500">Payment Mode</Label>
                <Select value={requestPaymentMode} onValueChange={(value) => setRequestPaymentMode(value)}>
                  <SelectTrigger className="h-12 border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-zinc-500">Expected Payment Date</Label>
                <Input
                  type="date"
                  value={requestDueDate}
                  onChange={(e) => setRequestDueDate(e.target.value)}
                  className="h-12"
                  required
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-zinc-500">Bank Account / Cheque No</Label>
                <Input
                  value={requestBankAccount}
                  onChange={(e) => setRequestBankAccount(e.target.value)}
                  placeholder="e.g. HDFC 12345 / Cheque"
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase text-zinc-500">Reason / Notes</Label>
              <textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Explain what this payment is for..."
                className="flex min-h-[160px] w-full rounded-md border border-zinc-200 bg-white px-4 py-3 text-base ring-offset-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <p className="text-xs text-zinc-500">
                Provide as much detail as possible so reviewers can understand this request quickly.
              </p>
            </div>

            <div className="flex items-center justify-end gap-4 pt-2">
              <ShadcnButton
                type="button"
                variant="outline"
                onClick={() => setOpenRequestDialog(false)}
                className="px-10 h-12 text-sm font-semibold"
              >
                Cancel
              </ShadcnButton>
              <ShadcnButton type="submit" disabled={createPaymentRequest.isPending || updatePaymentRequest.isPending} className="px-12 h-12 text-sm font-semibold">
                {editRequest
                  ? updatePaymentRequest.isPending ? 'Updating...' : 'Update Request'
                  : createPaymentRequest.isPending ? 'Submitting...' : 'Submit Request'}
              </ShadcnButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      </div>
  );
};

export default Payments;
