import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../App';
import { useQueryClient } from '@tanstack/react-query';
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

interface PaymentsPageProps {
  onNavigate?: (path: string) => void;
}

export function PaymentsPage({ onNavigate }: PaymentsPageProps) {
  const { organisation, user } = useAuth();
  const orgId = organisation?.id || undefined;
  const queryClient = useQueryClient();

  const { settings: approvalSettings } = useOrgApprovalSettings(orgId);
  const subcontractorPaymentApprovalEnabled = approvalSettings?.SUBCONTRACTOR_PAYMENT ?? false;

  const [activeTab, setActiveTab] = useState<'payments' | 'ledger' | 'requests'>('payments');
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

  const [showRequestDialog, setShowRequestDialog] = useState(false);
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
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

  const { data: allPaymentRequests = [], refetch: refetchRequests } = usePaymentRequests(orgId);
  const createPaymentRequest = useCreatePaymentRequest();
  const deletePaymentRequest = useDeletePaymentRequest();
  const updatePaymentRequest = useUpdatePaymentRequest();
  const resubmitPaymentRequest = useResendPaymentRequest();

  const accountantQuery = useSubcontractorPaymentsForAccountant(orgId);
  const releasePayment = useReleaseSubcontractorPayment();
  const isAccountant = user?.user_metadata?.role === 'Accountant' || user?.user_metadata?.role === 'Administrator';

  const loadData = async () => {
    if (!organisation?.id) return;
    setIsLoading(true);
    try {
      const [paymentsRes, invoicesRes, subsRes, woRes, clientsRes, projectsRes] = await Promise.all([
        supabase
          .from('subcontractor_payments')
          .select('*')
          .order('payment_date', { ascending: false }),
        supabase
          .from('subcontractor_invoices')
          .select('*')
          .order('invoice_date', { ascending: false }),
        supabase
          .from('subcontractors')
          .select('*')
          .eq('organisation_id', organisation.id)
          .eq('status', 'Active'),
        supabase
          .from('subcontractor_work_orders')
          .select('*')
          .eq('organisation_id', organisation.id),
        supabase
          .from('clients')
          .select('id, name')
          .eq('organisation_id', organisation.id),
        supabase
          .from('projects')
          .select('id, name, client_id')
          .eq('organisation_id', organisation.id)
      ]);

      const subs = subsRes.data || [];
      const wos = woRes.data || [];

      // Filter by organisation_id
      const filteredPaymentsData = (paymentsRes.data || []).filter(p => 
        !p.organisation_id || p.organisation_id === organisation.id
      );
      
      const filteredInvoicesData = (invoicesRes.data || []).filter(i => 
        !i.organisation_id || i.organisation_id === organisation.id
      );

      const enrichedPayments = filteredPaymentsData.map(p => ({
        ...p,
        subcontractors: subs.find(s => s.id === p.subcontractor_id),
        work_orders: wos.find(wo => wo.id === p.work_order_id)
      }));

      const enrichedInvoices = filteredInvoicesData.map(i => ({
        ...i,
        subcontractors: subs.find(s => s.id === i.subcontractor_id),
        work_orders: wos.find(wo => wo.id === i.work_order_id)
      }));

      setPayments(enrichedPayments);
      setInvoices(enrichedInvoices);
      setSubcontractors(subs);
      setWorkOrders(wos);
      setClients(clientsRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (err: any) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
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
    return invoices.filter((i) => {
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

  const requestCounts = useMemo(() => ({
    all: subPaymentRequests.length,
    pending: subPaymentRequests.filter((r: any) => r.status !== 'Approved' && r.status !== 'APPROVED' && r.status !== 'Rejected' && r.status !== 'Cancelled' && r.status !== 'Paid').length,
    approved: subPaymentRequests.filter((r: any) => r.status === 'Approved' || r.status === 'APPROVED' || r.status === 'Paid').length,
  }), [subPaymentRequests]);

  const filteredRequests = useMemo(() => {
    let list = subPaymentRequests;
    if (requestFilter === 'pending') {
      list = list.filter((r: any) => r.status !== 'Approved' && r.status !== 'APPROVED' && r.status !== 'Rejected' && r.status !== 'Cancelled' && r.status !== 'Paid');
    } else if (requestFilter === 'approved') {
      list = list.filter((r: any) => r.status === 'Approved' || r.status === 'APPROVED' || r.status === 'Paid');
    }
    return list;
  }, [subPaymentRequests, requestFilter]);

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

    return ledgerWithBalance;
  }, [filteredInvoices, filteredPayments]);

  const filteredLedger = useMemo(() => {
    return transactionTypeFilter === 'all' 
      ? ledgerEntries 
      : ledgerEntries.filter(e => e.type === transactionTypeFilter);
  }, [ledgerEntries, transactionTypeFilter]);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    // Editing a posted payment is not permitted — payments are immutable once recorded.
    if (editingPayment) {
      toast.error('Posted payments cannot be modified. Please contact your administrator.');
      return;
    }

    const grossAmount = parseFloat(formData.gross_amount) || parseFloat(formData.amount) || 0;
    const tdsPercent = parseFloat(formData.tds_percentage) || 0;

    if (grossAmount <= 0) {
      toast.error('Payment amount must be greater than zero.');
      return;
    }

    try {
      // Route through authoritative SECURITY DEFINER RPC.
      // The RPC is responsible for: TDS calculation, GL posting, sequence number,
      // idempotency, retention tracking, and balance updates.
      const { data, error } = await supabase.rpc('record_subcontractor_payment', {
        p_organisation_id: organisation.id,
        p_subcontractor_id: formData.subcontractor_id,
        p_amount: grossAmount,
        p_payment_date: formData.payment_date,
        p_payment_mode: formData.payment_mode,
        p_reference_no: formData.reference_no || null,
        p_tds_percent: tdsPercent,
        p_idempotency_key: null
      });
      if (error) throw error;
      toast.success('Payment recorded successfully.');
      setShowModal(false);
      setEditingPayment(null);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to record payment.');
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    // Editing an approved/posted bill is not permitted — bills are immutable once recorded.
    if (editingInvoice) {
      toast.error('Approved subcontractor bills cannot be modified. Please contact your administrator.');
      return;
    }

    const amount = parseFloat(invoiceFormData.amount);
    if (!amount || amount <= 0) {
      toast.error('Bill amount must be greater than zero.');
      return;
    }

    try {
      // Route through authoritative SECURITY DEFINER RPC.
      // The RPC is responsible for: retention calculation, GL posting, sequence number,
      // idempotency, status enforcement, and balance updates.
      const { data, error } = await supabase.rpc('record_subcontractor_bill', {
        p_organisation_id: organisation.id,
        p_subcontractor_id: invoiceFormData.subcontractor_id,
        p_work_order_id: invoiceFormData.work_order_id || null,
        p_amount: amount,
        p_invoice_date: invoiceFormData.invoice_date,
        p_remarks: invoiceFormData.description || null,
        p_idempotency_key: null
      });
      if (error) throw error;
      toast.success('Subcontractor bill recorded successfully.');
      setShowInvoiceModal(false);
      setEditingInvoice(null);
      resetInvoiceForm();
      loadData();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to record bill.');
    }
  };

  const handleDeletePayment = async (_id: string) => {
    // Financial payments are immutable records once posted.
    // Direct hard-delete of subcontractor payments is prohibited.
    // Contact your administrator to process a reversal through the approval workflow.
    toast.error('Posted payments cannot be deleted. Please raise a reversal request through the administrator.');
  };

  const handleDeleteInvoice = async (id: string) => {
    // Only draft/pending invoices may be deleted.
    // Approved/posted bills are immutable; deletion will be blocked by the database.
    if (!confirm('Delete this subcontractor bill? Approved or posted bills cannot be deleted.')) return;
    try {
      const { error } = await supabase.from('subcontractor_invoices').delete().eq('id', id);
      if (error) throw error;
      toast.success('Bill removed.');
      loadData();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to remove bill. Approved or posted bills cannot be deleted.');
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm('Delete this payment request?')) return;
    try {
      await deletePaymentRequest.mutateAsync({ requestId: id, organisationId: organisation?.id as string });
      toast.success('Payment request deleted.');
      refetchRequests();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete payment request.');
    }
  };

  const handleResubmitRequest = async (req: any) => {
    if (!confirm('Resubmit this payment request for approval?')) return;
    try {
      await resubmitPaymentRequest.mutateAsync({
        requestId: req.id,
        organisationId: req.organisation_id
      });
      toast.success('Payment request resubmitted.');
      refetchRequests();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to resubmit request.');
    }
  };

  const handleReleaseRequest = async (req: any) => {
    if (!confirm('Are you sure you want to release this approved payment?')) return;
    try {
      await releasePayment.mutateAsync({
        paymentId: req.id,
        releasedBy: user?.id
      });
      toast.success('Payment released.');
      refetchRequests();
      loadData();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to release payment.');
    }
  };

  const resetInvoiceForm = () => {
    setInvoiceFormData({
      subcontractor_id: '',
      work_order_id: '',
      invoice_no: '',
      invoice_date: new Date().toISOString().split('T')[0],
      amount: '',
      description: '',
      status: 'Pending'
    });
  };

  const openEditInvoiceModal = (invoice: any) => {
    setEditingInvoice(invoice);
    setInvoiceFormData({
      subcontractor_id: invoice.subcontractor_id,
      work_order_id: invoice.work_order_id || '',
      invoice_no: invoice.invoice_no,
      invoice_date: invoice.invoice_date,
      amount: invoice.amount?.toString() || '',
      description: invoice.description || '',
      status: invoice.status || 'Pending'
    });
    setShowInvoiceModal(true);
  };

  const resetForm = () => {
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
  };

  const openEditModal = (payment: any) => {
    setEditingPayment(payment);
    setFormData({
      subcontractor_id: payment.subcontractor_id,
      work_order_id: payment.work_order_id || '',
      amount: payment.amount?.toString() || '',
      gross_amount: payment.gross_amount?.toString() || '',
      tds_percentage: payment.tds_percentage?.toString() || '',
      tds_amount: payment.tds_amount?.toString() || '',
      net_amount: payment.net_amount?.toString() || '',
      payment_date: payment.payment_date,
      payment_mode: payment.payment_mode || 'Bank Transfer',
      reference_no: payment.reference_no || '',
      description: payment.description || ''
    });
    setShowModal(true);
  };

  const exportLedgerToCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Subcontractor', 'Work Order', 'Description', 'Reference', 'Amount (₹)', 'TDS (₹)', 'Net Amount (₹)', 'Balance (₹)', 'Status'];
    const rows = filteredLedger.map(entry => [
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
      
      const tableData = filteredLedger.length > 0 
        ? filteredLedger.map(entry => [
            entry.date,
            entry.type.toUpperCase(),
            entry.category,
            entry.subcontractor,
            entry.workOrder,
            entry.description,
            entry.reference,
            `₹${entry.amount.toFixed(2)}`,
            entry.tdsAmount > 0 ? `₹${entry.tdsAmount.toFixed(2)}` : '-',
            `₹${entry.netAmount.toFixed(2)}`,
            `₹${entry.balance.toFixed(2)}`,
            entry.status
          ])
        : [['No data available for the selected filters']];
      
      autoTable(doc, {
        startY: 35,
        head: [['Date', 'Type', 'Category', 'Subcontractor', 'Work Order', 'Description', 'Reference', 'Amount', 'TDS', 'Net', 'Balance', 'Status']],
        body: tableData,
        styles: {
          fontSize: 8,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 35 },
          4: { cellWidth: 25 },
          5: { cellWidth: 30 },
          6: { cellWidth: 25 },
          7: { cellWidth: 20, halign: 'right' },
          8: { cellWidth: 15, halign: 'right' },
          9: { cellWidth: 20, halign: 'right' },
          10: { cellWidth: 20, halign: 'right' },
          11: { cellWidth: 20 }
        }
      });
      
      doc.save(`subcontractor_ledger_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ fontFamily: "'Inter', sans-serif" }}>Loading payments...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0f172a', margin: 0 }}>
                Subcontractor Payments
              </h1>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', margin: '4px 0 0 0' }}>
                Manage subcontractor payments, invoices, and track TDS
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {activeTab === 'payments' && (
                <>
                  <button
                    onClick={() => { setEditingRequestId(null); setRequestSubcontractorId(''); setRequestAmount(''); setRequestPriority('Normal'); setRequestDueDate(''); setRequestPaymentMode('Bank Transfer'); setRequestBankAccount(''); setRequestReason(''); setRequestClientId(''); setRequestProjectId(''); setRequestWorkOrderId(''); setShowRequestDialog(true); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      background: '#fff',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#0f172a',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    Payment Request
                  </button>
                  <button
                    onClick={() => { resetForm(); setEditingPayment(null); setShowModal(true); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      background: '#0f172a',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#1e293b'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#0f172a'}
                  >
                    <span style={{ fontSize: '16px' }}>+</span> New Payment
                  </button>
                </>
              )}
              {activeTab === 'requests' && (
                <button
                  onClick={() => { setRequestSubcontractorId(''); setRequestAmount(''); setRequestPriority('Normal'); setRequestDueDate(''); setRequestPaymentMode('Bank Transfer'); setRequestBankAccount(''); setRequestReason(''); setRequestClientId(''); setRequestProjectId(''); setRequestWorkOrderId(''); setShowRequestDialog(true); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#1e293b'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#0f172a'}
                >
                  <span style={{ fontSize: '16px' }}>+</span> New Request
                </button>
              )}
              {activeTab === 'ledger' && (
                <>
                  <button
                    onClick={() => { resetInvoiceForm(); setEditingInvoice(null); setShowInvoiceModal(true); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      background: '#0f172a',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#1e293b'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#0f172a'}
                  >
                    <span style={{ fontSize: '16px' }}>+</span> New Invoice
                  </button>
                  <button
                    onClick={exportLedgerToCSV}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      background: '#fff',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#0f172a',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={exportLedgerToPDF}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      background: '#fff',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#0f172a',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    Export PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {onNavigate && <SubcontractorModuleNav onNavigate={onNavigate} />}

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
            <button
              onClick={() => setActiveTab('payments')}
              style={{
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
                color: activeTab === 'payments' ? '#0f172a' : '#64748b',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'payments' ? '2px solid #0f172a' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Payments
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              style={{
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
                color: activeTab === 'ledger' ? '#0f172a' : '#64748b',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'ledger' ? '2px solid #0f172a' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Ledger
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              style={{
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
                color: activeTab === 'requests' ? '#0f172a' : '#64748b',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'requests' ? '2px solid #0f172a' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Payment Requests
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            marginBottom: '16px'
          }}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ flex: '1', minWidth: '280px', position: 'relative' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by subcontractor, reference, or mode..."
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      padding: '10px 12px 10px 40px',
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px' }}>🔍</span>
                </div>

                {/* Subcontractor Filter */}
                <div style={{ minWidth: '200px' }}>
                  <select
                    value={subcontractorFilter}
                    onChange={(e) => setSubcontractorFilter(e.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  >
                    <option value="all">All Subcontractors</option>
                    {subcontractors.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div style={{ minWidth: '150px' }}>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Date To */}
                <div style={{ minWidth: '150px' }}>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Transaction Type Filter (Ledger only) */}
                {activeTab === 'ledger' && (
                  <div style={{ minWidth: '150px' }}>
                    <select
                      value={transactionTypeFilter}
                      onChange={(e) => setTransactionTypeFilter(e.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        padding: '10px 12px',
                        fontSize: '14px',
                        color: '#0f172a',
                        outline: 'none'
                      }}
                    >
                      <option value="all">All Transactions</option>
                      <option value="credit">Credits (Invoices)</option>
                      <option value="debit">Debits (Payments)</option>
                    </select>
                  </div>
                )}

                {/* Clear Filters */}
                {(searchQuery || subcontractorFilter !== 'all' || dateFrom || dateTo || transactionTypeFilter !== 'all') && (
                  <button
                    onClick={() => { setSearchQuery(''); setSubcontractorFilter('all'); setDateFrom(''); setDateTo(''); setTransactionTypeFilter('all'); }}
                    style={{
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#64748b',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
            marginBottom: '40px'
          }}>
            {activeTab === 'payments' ? (
              <>
                {filteredPayments.length === 0 ? (
                  <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                      No payments found
                    </h3>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                      Create your first payment to get started
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          {['Payment Date', 'Subcontractor', 'Work Order', 'Gross Amount', 'TDS %', 'TDS Amount', 'Net Amount', 'Mode', 'Reference', 'Actions'].map((header) => (
                            <th key={header} style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontSize: '12px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              color: '#64748b'
                            }}>
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((payment) => (
                          <tr key={payment.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a' }}>
                              {payment.payment_date}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                              {payment.subcontractors?.company_name || '-'}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                              {payment.work_orders?.work_order_no || '-'}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>
                              ₹{parseFloat(payment.gross_amount || payment.amount || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                              {payment.tds_percentage ? `${payment.tds_percentage}%` : '-'}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#dc2626', fontWeight: '500' }}>
                              {payment.tds_amount ? `₹${parseFloat(payment.tds_amount).toFixed(2)}` : '-'}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#16a34a', fontWeight: '600' }}>
                              ₹{parseFloat(payment.net_amount || payment.amount || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '16px', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>
                              {payment.payment_mode}
                            </td>
                            <td style={{ padding: '16px', fontSize: '13px', color: '#0f172a', fontFamily: 'monospace' }}>
                              {payment.reference_no || '-'}
                            </td>
                            <td style={{ padding: '16px' }}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => openEditModal(payment)}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeletePayment(payment.id)}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    background: '#fef2f2',
                                    color: '#dc2626',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : activeTab === 'requests' ? (
              <>
                <div style={{ display: 'flex', gap: '8px', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                  {(['all', 'pending', 'approved'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setRequestFilter(f)}
                      style={{
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '999px',
                        border: '1px solid',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: requestFilter === f ? '#0f172a' : '#fff',
                        color: requestFilter === f ? '#fff' : '#64748b',
                        borderColor: requestFilter === f ? '#0f172a' : '#e2e8f0',
                      }}
                    >
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({requestCounts[f]})
                    </button>
                  ))}
                </div>
                {filteredRequests.length === 0 ? (
                  <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                      No payment requests found
                    </h3>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                      Create a payment request to get approval
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          {['Date', 'Subcontractor', 'Amount', 'Requested By', 'Priority', 'Status', 'Approval', 'Due By', 'Reason', 'Actions'].map((header) => (
                            <th key={header} style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontSize: '12px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              color: '#64748b'
                            }}>
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRequests.map((req: any) => {
                          const isPaid = req.status === 'Paid' || req.status === 'PAID';
                          const statusColors: Record<string, string> = { Pending: '#dbeafe', PENDING: '#dbeafe', Approved: '#dcfce7', APPROVED: '#dcfce7', Rejected: '#fee2e2', REJECTED: '#fee2e2', Cancelled: '#f1f5f9', CANCELLED: '#f1f5f9', Paid: '#dcfce7', PAID: '#dcfce7' };
                          const statusTextColors: Record<string, string> = { Pending: '#1e40af', PENDING: '#1e40af', Approved: '#166534', APPROVED: '#166534', Rejected: '#991b1b', REJECTED: '#991b1b', Cancelled: '#64748b', CANCELLED: '#64748b', Paid: '#166534', PAID: '#166534' };
                          
                          const prioColors: Record<string, string> = { Urgent: '#ffe4e6', High: '#ffedd5', Normal: '#f4f4f5', Low: '#dbeafe' };
                          const prioTextColors: Record<string, string> = { Urgent: '#be123c', High: '#c2410c', Normal: '#3f3f46', Low: '#1e40af' };
                          const prio = req.priority || 'Normal';
                          
                          const canRelease = isAccountant && (req.status === 'Approved' || req.status === 'APPROVED') && !isPaid;
                          
                          return (
                            <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a' }}>{req.request_date}</td>
                              <td style={{ padding: '16px', fontSize: '14px', color: '#334155', fontWeight: '500' }}>{req.subcontractor?.company_name || '-'}</td>
                              <td style={{ padding: '16px', fontSize: '14px', color: '#16a34a', fontWeight: '600' }}>₹{Number(req.amount_requested).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: '16px', fontSize: '13px', color: '#475569' }}>{req.requester_name || '-'}</td>
                              <td style={{ padding: '16px' }}>
                                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: prioColors[prio] || '#f4f4f5', color: prioTextColors[prio] || '#3f3f46' }}>
                                  {req.priority}
                                </span>
                              </td>
                              <td style={{ padding: '16px' }}>
                                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: statusColors[req.status] || '#f1f5f9', color: statusTextColors[req.status] || '#64748b' }}>
                                  {isPaid ? 'Paid' : (req.status === 'Approved' || req.status === 'APPROVED') ? 'Unpaid' : req.status}
                                </span>
                              </td>
                              <td style={{ padding: '16px' }}>
                                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: statusColors[req.status] || '#f1f5f9', color: statusTextColors[req.status] || '#64748b' }}>
                                  {(req.status === 'Approved' || req.status === 'APPROVED') ? `Approved${req.approver_name ? ` (${req.approver_name})` : ''}` : (req.status === 'Rejected' || req.status === 'REJECTED') ? `Rejected${req.approver_name ? ` (${req.approver_name})` : ''}` : isPaid ? `Paid${req.approver_name ? ` (${req.approver_name})` : ''}` : 'Pending'}
                                </span>
                              </td>
                              <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>{req.due_date || '-'}</td>
                              <td style={{ padding: '16px', fontSize: '13px', color: '#0f172a' }}>{req.reason || '-'}</td>
                              <td style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {(req.status === 'Pending' || req.status === 'PENDING') && (
                                    <button
                                      onClick={() => {
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
                                      style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', border: 'none', cursor: 'pointer' }}
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {canRelease && (
                                    <button
                                      onClick={() => handleReleaseRequest(req)}
                                      style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', background: '#dcfce7', color: '#166534', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                      Release
                                    </button>
                                  )}
                                  {(req.status === 'Rejected' || req.status === 'REJECTED' || req.status === 'Cancelled' || req.status === 'CANCELLED' || req.status === 'Pending' || req.status === 'PENDING') && (req.status !== 'Approved' && req.status !== 'APPROVED') && !isPaid && (
                                    <button
                                      onClick={() => handleResubmitRequest(req)}
                                      style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', background: '#e0e7ff', color: '#4f46e5', border: 'none', cursor: 'pointer' }}
                                    >
                                      Resubmit
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteRequest(req.id)}
                                    style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer' }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                {filteredLedger.length === 0 ? (
                  <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                      No ledger entries found
                    </h3>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                      Add invoices or payments to see the ledger
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          {['Date', 'Type', 'Category', 'Subcontractor', 'Work Order', 'Description', 'Reference', 'Amount (₹)', 'TDS (₹)', 'Net (₹)', 'Balance (₹)', 'Status'].map((header) => (
                            <th key={header} style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontSize: '12px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              color: '#64748b'
                            }}>
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLedger.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9', background: entry.type === 'credit' ? '#f0fdf4' : 'transparent' }}>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a' }}>
                              {entry.date}
                            </td>
                            <td style={{ padding: '16px' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                background: entry.type === 'credit' ? '#dcfce7' : '#fee2e2',
                                color: entry.type === 'credit' ? '#166534' : '#991b1b'
                              }}>
                                {entry.type}
                              </span>
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                              {entry.category}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                              {entry.subcontractor}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                              {entry.workOrder}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a' }}>
                              {entry.description}
                            </td>
                            <td style={{ padding: '16px', fontSize: '13px', color: '#0f172a', fontFamily: 'monospace' }}>
                              {entry.reference}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>
                              ₹{entry.amount.toFixed(2)}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: entry.tdsAmount > 0 ? '#dc2626' : '#64748b', fontWeight: '500' }}>
                              {entry.tdsAmount > 0 ? `₹${entry.tdsAmount.toFixed(2)}` : '-'}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: entry.type === 'credit' ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                              ₹{entry.netAmount.toFixed(2)}
                            </td>
                            <td style={{ padding: '16px', fontSize: '14px', color: entry.balance >= 0 ? '#0f172a' : '#dc2626', fontWeight: '700' }}>
                              ₹{entry.balance.toFixed(2)}
                            </td>
                            <td style={{ padding: '16px' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                background: entry.status === 'Paid' || entry.status === 'PAID' ? '#dcfce7' : entry.status === 'Approved' || entry.status === 'APPROVED' ? '#dbeafe' : '#fef3c7',
                                color: entry.status === 'Paid' || entry.status === 'PAID' ? '#166534' : entry.status === 'Approved' || entry.status === 'APPROVED' ? '#1e40af' : '#92400e'
                              }}>
                                {entry.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                {editingInvoice ? 'Edit Invoice' : 'New Invoice'}
              </h3>
              <button
                onClick={() => { setShowInvoiceModal(false); setEditingInvoice(null); resetInvoiceForm(); }}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Subcontractor */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Subcontractor *
                  </label>
                  <select
                    value={invoiceFormData.subcontractor_id}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, subcontractor_id: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select subcontractor</option>
                    {subcontractors.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                    ))}
                  </select>
                </div>

                {/* Work Order */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Work Order (Optional)
                  </label>
                  <select
                    value={invoiceFormData.work_order_id}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, work_order_id: e.target.value })}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select work order</option>
                    {workOrders.filter(wo => wo.subcontractor_id === invoiceFormData.subcontractor_id).map((wo) => (
                      <option key={wo.id} value={wo.id}>{wo.work_order_no}</option>
                    ))}
                  </select>
                </div>

                {/* Invoice No */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Invoice No *
                  </label>
                  <input
                    type="text"
                    value={invoiceFormData.invoice_no}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoice_no: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Invoice Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    value={invoiceFormData.invoice_date}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoice_date: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Amount */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    value={invoiceFormData.amount}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, amount: e.target.value })}
                    required
                    step="0.01"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Status */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Status
                  </label>
                  <select
                    value={invoiceFormData.status}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, status: e.target.value })}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Description
                  </label>
                  <textarea
                    value={invoiceFormData.description}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, description: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowInvoiceModal(false); setEditingInvoice(null); resetInvoiceForm(); }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal (New Payment Modal) */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                {editingPayment ? 'Edit Payment' : 'New Payment'}
              </h3>
              <button
                onClick={() => { setShowModal(false); setEditingPayment(null); resetForm(); }}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreatePayment} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Subcontractor */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Subcontractor *
                  </label>
                  <select
                    value={formData.subcontractor_id}
                    onChange={(e) => setFormData({ ...formData, subcontractor_id: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select subcontractor</option>
                    {subcontractors.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                    ))}
                  </select>
                </div>

                {/* Work Order */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Work Order (Optional)
                  </label>
                  <select
                    value={formData.work_order_id}
                    onChange={(e) => {
                      const woId = e.target.value;
                      const selectedWO = workOrders.find(wo => wo.id === woId);
                      let updatedForm: any = { ...formData, work_order_id: woId };
                      if (selectedWO && (selectedWO.tax_type === 'TDS' || parseFloat(selectedWO.tds_percent || 0) > 0)) {
                        const tdsPercent = parseFloat(selectedWO.tds_percent) || 0;
                        const gross = parseFloat(formData.gross_amount) || 0;
                        const tdsAmount = (gross * tdsPercent) / 100;
                        const netAmount = gross - tdsAmount;
                        updatedForm = { ...updatedForm, tds_percentage: tdsPercent.toString(), tds_amount: tdsAmount.toString(), net_amount: netAmount.toString() };
                      }
                      setFormData(updatedForm);
                    }}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select work order</option>
                    {workOrders.filter(wo => wo.subcontractor_id === formData.subcontractor_id).map((wo) => (
                      <option key={wo.id} value={wo.id}>{wo.work_order_no} - {wo.work_description?.substring(0, 30) || 'No description'}</option>
                    ))}
                  </select>
                  {/* TDS alert when work order with TDS is selected */}
                  {formData.work_order_id && (() => {
                    const sel = workOrders.find(wo => wo.id === formData.work_order_id);
                    if (!sel) return null;
                    const tdsPct = parseFloat(sel.tds_percent || 0);
                    const retPct = parseFloat(sel.retention_percent || 0);
                    return (
                      <>
                        {(sel.tax_type === 'TDS' || tdsPct > 0) && (
                          <div style={{ marginTop: '8px', padding: '10px 12px', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '6px', fontSize: '12px', color: '#92400e', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '14px' }}>⚠️</span>
                            <span><strong>TDS Alert:</strong> This Work Order requires TDS deduction of <strong>{tdsPct}%</strong>. TDS rate has been pre-filled.</span>
                          </div>
                        )}
                        {sel.retention_held && retPct > 0 && (
                          <div style={{ marginTop: '6px', padding: '10px 12px', background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: '6px', fontSize: '12px', color: '#1e40af', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '14px' }}>ℹ️</span>
                            <span><strong>Retention:</strong> This Work Order has <strong>{retPct}%</strong> retention configured for {sel.retention_duration_months || 6} months.</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Gross Amount */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Gross Amount *
                  </label>
                  <input
                    type="number"
                    value={formData.gross_amount}
                    onChange={(e) => {
                      const gross = parseFloat(e.target.value) || 0;
                      const tdsPercent = parseFloat(formData.tds_percentage) || 0;
                      const tdsAmount = (gross * tdsPercent) / 100;
                      const netAmount = gross - tdsAmount;
                      setFormData({ ...formData, gross_amount: e.target.value, tds_amount: tdsAmount.toString(), net_amount: netAmount.toString() });
                    }}
                    required
                    step="0.01"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* TDS Percentage */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    TDS Percentage %
                  </label>
                  <input
                    type="number"
                    value={formData.tds_percentage}
                    onChange={(e) => {
                      const tdsPercent = parseFloat(e.target.value) || 0;
                      const gross = parseFloat(formData.gross_amount) || 0;
                      const tdsAmount = (gross * tdsPercent) / 100;
                      const netAmount = gross - tdsAmount;
                      setFormData({ ...formData, tds_percentage: e.target.value, tds_amount: tdsAmount.toString(), net_amount: netAmount.toString() });
                    }}
                    step="0.01"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* TDS Amount (Read-only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    TDS Amount
                  </label>
                  <input
                    type="number"
                    value={formData.tds_amount}
                    readOnly
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      background: '#f8fafc',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Net Amount (Read-only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Net Amount
                  </label>
                  <input
                    type="number"
                    value={formData.net_amount}
                    readOnly
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      background: '#f8fafc',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Payment Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Payment Mode */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Payment Mode *
                  </label>
                  <select
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="RTGS/NEFT">RTGS/NEFT</option>
                  </select>
                </div>

                {/* Reference No */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Reference No
                  </label>
                  <input
                    type="text"
                    value={formData.reference_no}
                    onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingPayment(null); resetForm(); }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {editingPayment ? 'Update Payment' : 'Create Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Request Dialog (New Request Modal) */}
      {showRequestDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e5e5' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>{editingRequestId ? 'Edit Payment Request' : 'New Payment Request'}</h3>
              <button onClick={() => setShowRequestDialog(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            <form onSubmit={async (e) => {
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
            }} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Subcontractor *</label>
                  <select value={requestSubcontractorId} onChange={(e) => { setRequestSubcontractorId(e.target.value); setRequestWorkOrderId(''); setRequestClientId(''); setRequestProjectId(''); }} required style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '14px', outline: 'none' }}>
                    <option value="">Select subcontractor</option>
                    {subcontractors.map((s: any) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                  </select>
                </div>
                {/* Work Order selector */}
                {requestSubcontractorId && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Work Order (Optional)</label>
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
                      style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '14px', outline: 'none' }}
                    >
                      <option value="">Select work order (optional)</option>
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
                        <>
                          {(sel.tax_type === 'TDS' || tdsPct > 0) && (
                            <div style={{ marginTop: '8px', padding: '10px 12px', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '6px', fontSize: '12px', color: '#92400e', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '14px' }}>⚠️</span>
                              <span><strong>Accountant Notice:</strong> This Work Order requires TDS deduction of <strong>{tdsPct}%</strong>. Please ensure TDS is deducted before payment release.</span>
                            </div>
                          )}
                          {sel.retention_held && retPct > 0 && (
                            <div style={{ marginTop: '6px', padding: '10px 12px', background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: '6px', fontSize: '12px', color: '#1e40af', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '14px' }}>ℹ️</span>
                              <span><strong>Retention:</strong> This Work Order has <strong>{retPct}%</strong> retention for {sel.retention_duration_months || 6} months. Retention may apply on final payment.</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Amount Requested *</label>
                  <input type="number" value={requestAmount} onChange={(e) => setRequestAmount(e.target.value)} placeholder="0.00" required min="0" step="0.01" style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '14px', outline: 'none' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Client (Optional)</label>
                    <select value={requestClientId} onChange={(e) => { setRequestClientId(e.target.value); setRequestProjectId(''); }} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '14px', outline: 'none' }}>
                      <option value="">Select client...</option>
                      {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Project (Optional)</label>
                    <select value={requestProjectId} onChange={(e) => setRequestProjectId(e.target.value)} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '14px', outline: 'none' }} disabled={!requestClientId && projects.length > 0}>
                      <option value="">Select project...</option>
                      {projects
                        .filter(p => !requestClientId || p.client_id === requestClientId)
                        .map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Priority</label>
                    <select value={requestPriority} onChange={(e) => setRequestPriority(e.target.value)} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '14px', outline: 'none' }}>
                      {['Low', 'Normal', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Payment Mode</label>
                    <select value={requestPaymentMode} onChange={(e) => setRequestPaymentMode(e.target.value)} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '14px', outline: 'none' }}>
                      {['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Card', 'NEFT', 'RTGS'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Expected Payment Date</label>
                  <input type="date" value={requestDueDate} onChange={(e) => setRequestDueDate(e.target.value)} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Bank Account / Reference</label>
                  <input type="text" value={requestBankAccount} onChange={(e) => setRequestBankAccount(e.target.value)} placeholder="e.g. HDFC 12345" style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>Reason / Notes</label>
                  <textarea value={requestReason} onChange={(e) => setRequestReason(e.target.value)} placeholder="Explain what this payment is for..." rows={4} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '14px', outline: 'none', resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" onClick={() => setShowRequestDialog(false)} style={{ padding: '10px 24px', fontSize: '14px', fontWeight: '600', borderRadius: '8px', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={createPaymentRequest.isPending} style={{ padding: '10px 24px', fontSize: '14px', fontWeight: '600', borderRadius: '8px', background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer' }}>{createPaymentRequest.isPending ? 'Submitting...' : 'Submit for Approval'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default PaymentsPage;
