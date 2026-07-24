import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../App';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, X, Search, RefreshCcw } from 'lucide-react';
import { toast } from '@/lib/logger';
import { 
  usePaymentRequests, 
  useCreatePaymentRequest, 
  useDeletePaymentRequest, 
  useUpdatePaymentRequest, 
  useResendPaymentRequest 
} from '../../../../modules/Purchase/hooks/usePurchaseQueries';
import { 
  useOrgApprovalSettings, 
  useSubcontractorPaymentsForAccountant, 
  useReleaseSubcontractorPayment 
} from '../../../../hooks/useApprovals';
import { SubcontractorModuleNav } from '../Shared/SubcontractorModuleNav';
import { PaymentsListTab } from './PaymentsListTab';
import { InvoicesTab } from '../Invoices/InvoicesTab';
import { PaymentRequestsTab } from './PaymentRequestsTab';
import { PaymentsLedgerTab } from './PaymentsLedgerTab';

interface PaymentsPageProps {
  onNavigate?: (path: string) => void;
}

export function PaymentsPage({ onNavigate }: PaymentsPageProps) {
  const { organisation, user } = useAuth();
  const orgId = organisation?.id || undefined;
  const queryClient = useQueryClient();

  const { settings: approvalSettings } = useOrgApprovalSettings(orgId);
  const accountantQuery = useSubcontractorPaymentsForAccountant(orgId);
  const releasePayment = useReleaseSubcontractorPayment();

  const [activeTab, setActiveTab] = useState<'payments' | 'invoices' | 'ledger' | 'requests'>('payments');
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  
  // Payment request states
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [requestSubcontractorId, setRequestSubcontractorId] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestPriority, setRequestPriority] = useState('Normal');
  const [requestDueDate, setRequestDueDate] = useState('');
  const [requestPaymentMode, setRequestPaymentMode] = useState('Bank Transfer');
  const [requestBankAccount, setRequestBankAccount] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestClientId, setRequestClientId] = useState('');
  const [requestProjectId, setRequestProjectId] = useState('');
  const [requestWorkOrderId, setRequestWorkOrderId] = useState('');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [subcontractorFilter, setSubcontractorFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');

  const [formData, setFormData] = useState({
    subcontractor_id: '',
    work_order_id: '',
    amount: '',
    gross_amount: '',
    tds_percentage: '',
    tds_amount: '',
    net_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'Bank Transfer',
    reference_no: '',
    description: ''
  });

  const [invoiceFormData, setInvoiceFormData] = useState({
    subcontractor_id: '',
    work_order_id: '',
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    status: 'Pending'
  });

  const { data: allPaymentRequests = [], refetch: refetchRequests } = usePaymentRequests(orgId);
  const createPaymentRequest = useCreatePaymentRequest();
  const deletePaymentRequest = useDeletePaymentRequest();
  const updatePaymentRequest = useUpdatePaymentRequest();
  const resubmitPaymentRequest = useResendPaymentRequest();

  const isAccountant = user?.user_metadata?.role === 'Accountant' || user?.user_metadata?.role === 'Administrator';

  const loadData = async () => {
    if (!organisation?.id) return;
    setIsLoading(true);
    const [paymentsRes, invoicesRes, subsRes, woRes, clientsRes, projectsRes] = await Promise.all([
      supabase.from('subcontractor_payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('subcontractor_invoices').select('*').order('invoice_date', { ascending: false }),
      supabase.from('subcontractors').select('*').eq('organisation_id', organisation.id).eq('status', 'Active'),
      supabase.from('subcontractor_work_orders').select('*').eq('organisation_id', organisation.id),
      supabase.from('clients').select('id, name').eq('organisation_id', organisation.id),
      supabase.from('projects').select('id, name, client_id').eq('organisation_id', organisation.id)
    ]);

    const subs = subsRes.data || [];
    const wos = woRes.data || [];

    const enrichedPayments = (paymentsRes.data || []).map(p => ({
      ...p,
      subcontractors: subs.find(s => s.id === p.subcontractor_id),
      work_orders: wos.find(wo => wo.id === p.work_order_id)
    }));

    const enrichedInvoices = (invoicesRes.data || []).map(i => ({
      ...i,
      subcontractors: subs.find(s => s.id === i.subcontractor_id),
      work_orders: wos.find(wo => wo.id === i.work_order_id)
    }));

    setPayments(enrichedPayments);
    setInvoices(enrichedInvoices);
    setSubcontractors(subs);
    setWorkOrders(wos);
    setClients((clientsRes.data || []).map((c: any) => ({ ...c, displayName: c.name || '(Unnamed Client)' })));
    setProjects((projectsRes.data || []).map((p: any) => ({ ...p, displayName: p.name || '(Unnamed Project)' })));
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches = 
          p.subcontractors?.company_name?.toLowerCase().includes(query) ||
          p.reference_no?.toLowerCase().includes(query) ||
          p.payment_mode?.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (subcontractorFilter !== 'all' && p.subcontractor_id !== subcontractorFilter) return false;
      if (dateFrom && p.payment_date < dateFrom) return false;
      if (dateTo && p.payment_date > dateTo) return false;
      return true;
    });
  }, [payments, searchQuery, subcontractorFilter, dateFrom, dateTo]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(i => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches = 
          i.subcontractors?.company_name?.toLowerCase().includes(query) ||
          i.invoice_no?.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (subcontractorFilter !== 'all' && i.subcontractor_id !== subcontractorFilter) return false;
      if (dateFrom && i.invoice_date < dateFrom) return false;
      if (dateTo && i.invoice_date > dateTo) return false;
      return true;
    });
  }, [invoices, searchQuery, subcontractorFilter, dateFrom, dateTo]);

  const subPaymentRequests = useMemo(() => {
    return allPaymentRequests.filter((r: any) => r.subcontractor_id && r.subcontractor_id !== 'undefined');
  }, [allPaymentRequests]);

  // Build ledger entries from payments and invoices
  const ledgerEntries = useMemo(() => {
    const list = [
      ...filteredInvoices.map(i => ({
        id: i.id,
        date: i.invoice_date,
        type: 'credit',
        category: 'Invoice',
        description: i.invoice_no,
        subcontractor: i.subcontractors?.company_name || '-',
        workOrder: i.work_orders?.work_order_no || '-',
        amount: parseFloat(i.amount || 0),
        tdsAmount: 0,
        netAmount: parseFloat(i.amount || 0),
        reference: i.invoice_no,
        status: i.status
      })),
      ...filteredPayments.map(p => ({
        id: p.id,
        date: p.payment_date,
        type: 'debit',
        category: 'Payment',
        description: p.description || p.payment_mode,
        subcontractor: p.subcontractors?.company_name || '-',
        workOrder: p.work_orders?.work_order_no || '-',
        amount: parseFloat(p.gross_amount || p.amount || 0),
        tdsAmount: parseFloat(p.tds_amount || 0),
        netAmount: parseFloat(p.net_amount || p.amount || 0),
        reference: p.reference_no || '-',
        status: 'Paid'
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const ledgerWithBalance = list.map(entry => {
      if (entry.type === 'credit') {
        runningBalance += entry.amount;
      } else {
        runningBalance -= entry.netAmount;
      }
      return { ...entry, balance: runningBalance };
    });

    return transactionTypeFilter === 'all' 
      ? ledgerWithBalance 
      : ledgerWithBalance.filter(e => e.type === transactionTypeFilter);
  }, [filteredInvoices, filteredPayments, transactionTypeFilter]);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    const grossAmount = parseFloat(formData.gross_amount) || parseFloat(formData.amount) || 0;
    const tdsPercent = parseFloat(formData.tds_percentage) || 0;
    const tdsAmount = (grossAmount * tdsPercent) / 100;
    const netAmount = grossAmount - tdsAmount;

    const paymentData = {
      organisation_id: organisation.id,
      subcontractor_id: formData.subcontractor_id,
      work_order_id: formData.work_order_id || null,
      gross_amount: grossAmount,
      tds_percentage: tdsPercent,
      tds_amount: tdsAmount,
      net_amount: netAmount,
      amount: netAmount,
      payment_date: formData.payment_date,
      payment_mode: formData.payment_mode,
      reference_no: formData.reference_no,
      description: formData.description
    };

    if (editingPayment) {
      await supabase.from('subcontractor_payments').update(paymentData).eq('id', editingPayment.id);
    } else {
      await supabase.from('subcontractor_payments').insert(paymentData);
    }

    setShowModal(false);
    setEditingPayment(null);
    setFormData({
      subcontractor_id: '',
      work_order_id: '',
      amount: '',
      gross_amount: '',
      tds_percentage: '',
      tds_amount: '',
      net_amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'Bank Transfer',
      reference_no: '',
      description: ''
    });
    loadData();
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    const invoiceData = {
      organisation_id: organisation.id,
      subcontractor_id: invoiceFormData.subcontractor_id,
      work_order_id: invoiceFormData.work_order_id || null,
      invoice_no: invoiceFormData.invoice_no,
      invoice_date: invoiceFormData.invoice_date,
      amount: parseFloat(invoiceFormData.amount),
      description: invoiceFormData.description,
      status: invoiceFormData.status
    };

    if (editingInvoice) {
      await supabase.from('subcontractor_invoices').update(invoiceData).eq('id', editingInvoice.id);
    } else {
      await supabase.from('subcontractor_invoices').insert(invoiceData);
    }

    setShowInvoiceModal(false);
    setEditingInvoice(null);
    setInvoiceFormData({
      subcontractor_id: '',
      work_order_id: '',
      invoice_no: '',
      invoice_date: new Date().toISOString().split('T')[0],
      amount: '',
      description: '',
      status: 'Pending'
    });
    loadData();
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    await supabase.from('subcontractor_payments').delete().eq('id', id);
    loadData();
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    await supabase.from('subcontractor_invoices').delete().eq('id', id);
    loadData();
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment request?')) return;
    deletePaymentRequest.mutate(id);
    refetchRequests();
  };

  const handleResubmitRequest = async (req: any) => {
    resubmitPaymentRequest.mutate(req.id);
    refetchRequests();
  };

  const handleReleaseRequest = async (req: any) => {
    if (!confirm('Are you sure you want to release this approved payment?')) return;
    releasePayment.mutate({
      requestId: req.id,
      tdsPercentage: 0,
      notes: 'Released via V2 payments interface'
    });
    refetchRequests();
    loadData();
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) { toast.error('Organisation is required.'); return; }
    if (!requestSubcontractorId) { toast.error('Please select a subcontractor.'); return; }
    if (!requestAmount || Number(requestAmount) <= 0) { toast.error('Please enter a valid amount.'); return; }
    
    try {
      if (editingRequestId) {
        await updatePaymentRequest.mutateAsync({
          id: editingRequestId,
          organisation_id: organisation.id,
          subcontractor_id: requestSubcontractorId,
          amount_requested: Number(requestAmount),
          priority: requestPriority,
          due_date: requestDueDate,
          payment_mode: requestPaymentMode,
          bank_account_id: requestBankAccount || null,
          reason: requestReason,
          client_id: requestClientId || null,
          project_id: requestProjectId || null,
          work_order_id: requestWorkOrderId || null,
        });
        toast.success('Payment request updated successfully.');
      } else {
        await createPaymentRequest.mutateAsync({
          organisation_id: organisation.id,
          subcontractor_id: requestSubcontractorId,
          amount_requested: Number(requestAmount),
          priority: requestPriority,
          due_date: requestDueDate,
          payment_mode: requestPaymentMode,
          bank_account_id: requestBankAccount || null,
          reason: requestReason,
          status: 'Pending',
          requested_by: user?.id || null,
          client_id: requestClientId || null,
          project_id: requestProjectId || null,
          work_order_id: requestWorkOrderId || null,
        });
        toast.success('Payment request submitted for approval.');
      }
      setShowRequestDialog(false);
      refetchRequests();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save request.');
    }
  };

  const exportLedgerToCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Subcontractor', 'Work Order', 'Description', 'Reference', 'Amount (₹)', 'TDS (₹)', 'Net Amount (₹)', 'Balance (₹)', 'Status'];
    const rows = ledgerEntries.map(entry => [
      entry.date,
      entry.type.toUpperCase(),
      entry.category,
      entry.subcontractor,
      entry.workOrder,
      entry.description,
      entry.reference,
      entry.amount.toFixed(2),
      entry.tdsAmount.toFixed(2),
      entry.netAmount.toFixed(2),
      entry.balance.toFixed(2),
      entry.status
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `subcontractor_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportLedgerToPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text('Subcontractor Ledger', 14, 20);
      
      doc.setFontSize(10);
      doc.text(`Exported: ${new Date().toLocaleDateString()}`, 14, 28);
      
      const tableData = ledgerEntries.map(entry => [
        entry.date,
        entry.type.toUpperCase(),
        entry.subcontractor,
        entry.workOrder,
        entry.reference,
        `₹${entry.amount.toLocaleString('en-IN')}`,
        `₹${entry.tdsAmount.toLocaleString('en-IN')}`,
        `₹${entry.netAmount.toLocaleString('en-IN')}`,
        `₹${entry.balance.toLocaleString('en-IN')}`
      ]);
      
      autoTable(doc, {
        startY: 32,
        head: [['Date', 'Type', 'Partner', 'Work Order', 'Ref', 'Gross', 'TDS', 'Net', 'Balance']],
        body: tableData,
      });
      
      doc.save(`subcontractor_ledger_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error('Error printing PDF:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Payments & Finance</h1>
            <p className="font-medium text-zinc-400">Track invoices, disbursements, and ledgers across subcontractor contracts</p>
          </div>
          <button
            onClick={() => onNavigate?.('/subcontractors-v2')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400"
          >
            <X size={20} />
          </button>
        </div>

        {onNavigate && <SubcontractorModuleNav onNavigate={onNavigate} />}

        {/* Action Controls */}
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            {(['payments', 'invoices', 'requests', 'ledger'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border ${
                  activeTab === tab 
                    ? 'bg-zinc-900 text-white border-zinc-900' 
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {activeTab === 'requests' && (
              <button
                onClick={() => {
                  setEditingRequestId(null);
                  setRequestSubcontractorId('');
                  setRequestAmount('');
                  setRequestPriority('Normal');
                  setRequestDueDate('');
                  setRequestPaymentMode('Bank Transfer');
                  setRequestBankAccount('');
                  setRequestReason('');
                  setRequestClientId('');
                  setRequestProjectId('');
                  setRequestWorkOrderId('');
                  setShowRequestDialog(true);
                }}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                New Request
              </button>
            )}
            {activeTab === 'payments' && (
              <button
                onClick={() => {
                  setEditingRequestId(null);
                  setRequestSubcontractorId('');
                  setRequestAmount('');
                  setRequestPriority('Normal');
                  setRequestDueDate('');
                  setRequestPaymentMode('Bank Transfer');
                  setRequestBankAccount('');
                  setRequestReason('');
                  setRequestClientId('');
                  setRequestProjectId('');
                  setRequestWorkOrderId('');
                  setShowRequestDialog(true);
                }}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 mr-2"
              >
                Payment Request
              </button>
            )}
            <button
              onClick={() => {
                setEditingInvoice(null);
                setShowInvoiceModal(true);
              }}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50"
            >
              Add Invoice
            </button>
            <button
              onClick={() => {
                setEditingPayment(null);
                setShowModal(true);
              }}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
            >
              Record Payment
            </button>
          </div>
        </div>

        {/* Tab views */}
        {isLoading ? (
          <div className="py-20 text-center text-zinc-400">
            <RefreshCcw className="animate-spin h-8 w-8 mx-auto mb-2 text-zinc-300" />
            Loading finance details...
          </div>
        ) : (
          <>
            {activeTab === 'payments' && (
              <PaymentsListTab
                payments={filteredPayments}
                onEdit={(p) => {
                  setEditingPayment(p);
                  setFormData({
                    subcontractor_id: p.subcontractor_id,
                    work_order_id: p.work_order_id || '',
                    amount: p.amount?.toString() || '',
                    gross_amount: p.gross_amount?.toString() || '',
                    tds_percentage: p.tds_percentage?.toString() || '',
                    tds_amount: p.tds_amount?.toString() || '',
                    net_amount: p.net_amount?.toString() || '',
                    payment_date: p.payment_date,
                    payment_mode: p.payment_mode || 'Bank Transfer',
                    reference_no: p.reference_no || '',
                    description: p.description || ''
                  });
                  setShowModal(true);
                }}
                onDelete={handleDeletePayment}
              />
            )}

            {activeTab === 'invoices' && (
              <InvoicesTab invoices={filteredInvoices} />
            )}

            {activeTab === 'requests' && (
              <PaymentRequestsTab
                requests={subPaymentRequests}
                onEdit={(req) => {
                  setEditingRequestId(req.id);
                  setRequestSubcontractorId(req.subcontractor_id || '');
                  setRequestAmount(req.amount_requested?.toString() || '');
                  setRequestPriority(req.priority || 'Normal');
                  setRequestDueDate(req.due_date || '');
                  setRequestPaymentMode(req.payment_mode || 'Bank Transfer');
                  setRequestBankAccount(req.bank_account_id || '');
                  setRequestReason(req.reason || '');
                  setRequestClientId(req.client_id || '');
                  setRequestProjectId(req.project_id || '');
                  setRequestWorkOrderId(req.work_order_id || '');
                  setShowRequestDialog(true);
                }}
                onDelete={handleDeleteRequest}
                onResubmit={handleResubmitRequest}
                isAccountant={isAccountant}
                onRelease={handleReleaseRequest}
              />
            )}

            {activeTab === 'ledger' && (
              <PaymentsLedgerTab
                ledger={ledgerEntries}
                onExportCSV={exportLedgerToCSV}
                onExportPDF={exportLedgerToPDF}
              />
            )}
          </>
        )}
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-zinc-200 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900">{editingPayment ? 'Edit Payment Record' : 'Record Subcontractor Payment'}</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Partner *</label>
                <select
                  required
                  value={formData.subcontractor_id}
                  onChange={e => setFormData({ ...formData, subcontractor_id: e.target.value })}
                  className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                >
                  <option value="">Select Partner</option>
                  {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Work Order (Optional)</label>
                <select
                  value={formData.work_order_id}
                  onChange={e => setFormData({ ...formData, work_order_id: e.target.value })}
                  className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                >
                  <option value="">Direct Payment (No Work Order)</option>
                  {workOrders.filter(wo => wo.subcontractor_id === formData.subcontractor_id).map(wo => (
                    <option key={wo.id} value={wo.id}>{wo.work_order_no} ({wo.work_description})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Gross Amount (₹) *</label>
                  <input
                    required
                    type="number"
                    value={formData.gross_amount}
                    onChange={e => setFormData({ ...formData, gross_amount: e.target.value })}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">TDS %</label>
                  <input
                    type="number"
                    value={formData.tds_percentage}
                    onChange={e => setFormData({ ...formData, tds_percentage: e.target.value })}
                    placeholder="2"
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Payment Date *</label>
                  <input
                    required
                    type="date"
                    value={formData.payment_date}
                    onChange={e => setFormData({ ...formData, payment_date: e.target.value })}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Payment Mode *</label>
                  <select
                    required
                    value={formData.payment_mode}
                    onChange={e => setFormData({ ...formData, payment_mode: e.target.value })}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  >
                    {['Bank Transfer', 'Cash', 'Cheque', 'UPI'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Reference No / Txn Hash *</label>
                <input
                  required
                  type="text"
                  value={formData.reference_no}
                  onChange={e => setFormData({ ...formData, reference_no: e.target.value })}
                  placeholder="e.g. UTR1238917293"
                  className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Remarks / Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full border border-zinc-200 bg-zinc-50 px-4 py-3 rounded-xl text-sm font-bold text-zinc-900 outline-none resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 h-11 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 bg-zinc-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-800"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-zinc-200 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900">{editingInvoice ? 'Edit Invoice Record' : 'Record Subcontractor Invoice'}</h3>
              <button onClick={() => setShowInvoiceModal(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Partner *</label>
                <select
                  required
                  value={invoiceFormData.subcontractor_id}
                  onChange={e => setInvoiceFormData({ ...invoiceFormData, subcontractor_id: e.target.value })}
                  className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                >
                  <option value="">Select Partner</option>
                  {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Work Order (Optional)</label>
                <select
                  value={invoiceFormData.work_order_id}
                  onChange={e => setInvoiceFormData({ ...invoiceFormData, work_order_id: e.target.value })}
                  className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                >
                  <option value="">Direct Invoice (No Work Order)</option>
                  {workOrders.filter(wo => wo.subcontractor_id === invoiceFormData.subcontractor_id).map(wo => (
                    <option key={wo.id} value={wo.id}>{wo.work_order_no} ({wo.work_description})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Invoice No *</label>
                  <input
                    required
                    type="text"
                    value={invoiceFormData.invoice_no}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, invoice_no: e.target.value })}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Amount (₹) *</label>
                  <input
                    required
                    type="number"
                    value={invoiceFormData.amount}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, amount: e.target.value })}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Invoice Date *</label>
                  <input
                    required
                    type="date"
                    value={invoiceFormData.invoice_date}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, invoice_date: e.target.value })}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Status *</label>
                  <select
                    required
                    value={invoiceFormData.status}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, status: e.target.value })}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  >
                    {['Pending', 'Verified', 'Approved', 'Paid'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Description</label>
                <textarea
                  value={invoiceFormData.description}
                  onChange={e => setInvoiceFormData({ ...invoiceFormData, description: e.target.value })}
                  rows={2}
                  className="w-full border border-zinc-200 bg-zinc-50 px-4 py-3 rounded-xl text-sm font-bold text-zinc-900 outline-none resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="flex-1 h-11 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 bg-zinc-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-800"
                >
                  Save Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Request Modal */}
      {showRequestDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-xl w-full border border-zinc-200 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900">{editingRequestId ? 'Edit Payment Request' : 'New Payment Request'}</h3>
              <button onClick={() => setShowRequestDialog(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Subcontractor *</label>
                <select
                  required
                  value={requestSubcontractorId}
                  onChange={(e) => {
                    setRequestSubcontractorId(e.target.value);
                    setRequestWorkOrderId('');
                    setRequestClientId('');
                    setRequestProjectId('');
                  }}
                  className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                >
                  <option value="">Select Subcontractor</option>
                  {subcontractors.map((s: any) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
              </div>

              {requestSubcontractorId && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Work Order (Optional)</label>
                  <select
                    value={requestWorkOrderId}
                    onChange={(e) => {
                      const woId = e.target.value;
                      const selectedWO = workOrders.find(wo => wo.id === woId);
                      setRequestWorkOrderId(woId);
                      if (selectedWO) {
                        if (selectedWO.client_id) setRequestClientId(selectedWO.client_id);
                        if (selectedWO.project_id) setRequestProjectId(selectedWO.project_id);
                      }
                    }}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  >
                    <option value="">Select Work Order (Optional)</option>
                    {workOrders.filter(wo => wo.subcontractor_id === requestSubcontractorId).map((wo: any) => (
                      <option key={wo.id} value={wo.id}>{wo.work_order_no} - {wo.work_description?.substring(0, 30) || ''}</option>
                    ))}
                  </select>
                  {/* TDS & Retention alerts for the selected WO */}
                  {requestWorkOrderId && (() => {
                    const sel = workOrders.find(wo => wo.id === requestWorkOrderId);
                    if (!sel) return null;
                    const tdsPct = parseFloat(sel.tds_percent || 0);
                    const retPct = parseFloat(sel.retention_percent || 0);
                    return (
                      <div className="mt-3 space-y-2">
                        {(sel.tax_type === 'TDS' || tdsPct > 0) && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2 items-start">
                            <span className="text-sm">⚠️</span>
                            <span><strong>Accountant Notice:</strong> This Work Order requires TDS deduction of <strong>{tdsPct}%</strong>. Please ensure TDS is deducted before payment release.</span>
                          </div>
                        )}
                        {sel.retention_held && retPct > 0 && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex gap-2 items-start">
                            <span className="text-sm">ℹ️</span>
                            <span><strong>Retention:</strong> This Work Order has <strong>{retPct}%</strong> retention for {sel.retention_duration_months || 6} months. Retention may apply on final payment.</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Amount Requested *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Client (Optional)</label>
                  <select
                    value={requestClientId}
                    onChange={(e) => {
                      setRequestClientId(e.target.value);
                      setRequestProjectId('');
                    }}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  >
                    <option value="">Select Client</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Project (Optional)</label>
                  <select
                    value={requestProjectId}
                    onChange={(e) => setRequestProjectId(e.target.value)}
                    disabled={!requestClientId && projects.length > 0}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none disabled:opacity-50"
                  >
                    <option value="">Select Project</option>
                    {projects
                      .filter(p => !requestClientId || p.client_id === requestClientId)
                      .map((p: any) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Priority</label>
                  <select
                    value={requestPriority}
                    onChange={(e) => setRequestPriority(e.target.value)}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  >
                    {['Low', 'Normal', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Payment Mode</label>
                  <select
                    value={requestPaymentMode}
                    onChange={(e) => setRequestPaymentMode(e.target.value)}
                    className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                  >
                    {['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Card', 'NEFT', 'RTGS'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Expected Payment Date</label>
                <input
                  type="date"
                  value={requestDueDate}
                  onChange={(e) => setRequestDueDate(e.target.value)}
                  className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Bank Account / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC 12345"
                  value={requestBankAccount}
                  onChange={(e) => setRequestBankAccount(e.target.value)}
                  className="w-full h-11 border border-zinc-200 bg-zinc-50 px-4 rounded-xl text-sm font-bold text-zinc-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Reason / Notes</label>
                <textarea
                  placeholder="Explain what this payment is for..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  rows={3}
                  className="w-full border border-zinc-200 bg-zinc-50 px-4 py-3 rounded-xl text-sm font-bold text-zinc-900 outline-none resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRequestDialog(false)}
                  className="flex-1 h-11 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPaymentRequest.isPending}
                  className="flex-1 h-11 bg-zinc-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 disabled:opacity-50"
                >
                  {createPaymentRequest.isPending ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default PaymentsPage;
