import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useAuth } from '../../App';
import { useInvoices, useInvoiceTemplates } from '../hooks';
import { useInvoicePayments } from '../../ledger/hooks';
import { formatDate, formatCurrency } from '../ui-utils';
import { downloadInvoicePDF, printInvoicePDF, getInvoicePdfBlobUrl } from '../pdf';
import type { InvoiceTemplateRecord } from '../api';
import {
  Printer,
  Edit,
  Copy,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Download,
  Eye,
  FileText,
  Plus,
  Loader2,
  CreditCard,
  History,
  CheckCircle2,
} from 'lucide-react';
import RecordPaymentDrawer from '../components/RecordPaymentDrawer';
import PaymentHistoryDrawer from '../components/PaymentHistoryDrawer';
import ActivityLogDrawer from '../components/ActivityLogDrawer';
import AddSubmittedDetailsDrawer from '../components/AddSubmittedDetailsDrawer';

export default function InvoiceView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('id');
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();

  const [showConvertMenu, setShowConvertMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [printMenuView, setPrintMenuView] = useState<'main' | 'templates'>('main');
  const [printLoading, setPrintLoading] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [selectedInvoiceForSubmission, setSelectedInvoiceForSubmission] = useState<any | null>(null);
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  const [editingPayment, setEditingPayment] = useState<{
    id: string;
    receipt_no: string;
    amount: number;
    receipt_date: string;
    payment_mode: string | null;
    reference_no: string | null;
    notes: string | null;
    status: string | null;
  } | null>(null);

  const paymentsQuery = useInvoicePayments(invoiceId ?? undefined);

  const printMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(event.target as Node)) {
        setShowPrintMenu(false);
        setShowConvertMenu(false);
        setShowTemplateMenu(false);
        setShowPaymentMenu(false);
      }
    };
    if (showPrintMenu || showConvertMenu || showTemplateMenu || showPaymentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPrintMenu, showConvertMenu, showTemplateMenu, showPaymentMenu]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  const invoicesQuery = useInvoices();
  const templatesQuery = useInvoiceTemplates();
  const templates = templatesQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];

  const selectedInvoice = invoices.find((inv) => inv.id === invoiceId) ?? null;
  const totalPaid = (paymentsQuery.data ?? []).filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = (selectedInvoice?.total ?? 0) - totalPaid;

  const getSelectedTemplateName = () => {
    if (!selectedTemplateId) return 'Default';
    const template = templates.find((t) => t.id === selectedTemplateId);
    return template?.name || 'Default';
  };

  const handlePrintAction = async (action: 'preview' | 'download' | 'print') => {
    if (!selectedInvoice?.id) return;
    setPrintLoading(true);
    setShowPrintMenu(false);
    try {
      const selectedTemplate = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) ?? null : null;
      if (action === 'preview') {
        const url = await getInvoicePdfBlobUrl(selectedInvoice, { template: selectedTemplate });
        setPreviewPdfUrl(url);
        setPreviewModalOpen(true);
      } else if (action === 'download') {
        await downloadInvoicePDF(selectedInvoice, { template: selectedTemplate });
      } else if (action === 'print') {
        await printInvoicePDF(selectedInvoice, { template: selectedTemplate });
      }
    } finally {
      setPrintLoading(false);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setShowTemplateMenu(false);
    setPrintMenuView('main');
  };

  const handleDuplicate = async () => {
    if (!selectedInvoice) return;
    try {
      const { data: newInvoice, error } = await supabase
        .from('invoices')
        .insert({
          organisation_id: organisation?.id,
          client_id: selectedInvoice.client_id,
          invoice_date: new Date().toISOString().split('T')[0],
          subtotal: selectedInvoice.subtotal,
          cgst: selectedInvoice.cgst,
          sgst: selectedInvoice.sgst,
          igst: selectedInvoice.igst,
          total: selectedInvoice.total,
          status: 'draft',
          source_type: selectedInvoice.source_type,
          source_id: selectedInvoice.source_id,
          template_id: selectedInvoice.template_id,
          template_type: selectedInvoice.template_type,
          mode: selectedInvoice.mode,
          company_state: selectedInvoice.company_state,
          client_state: selectedInvoice.client_state,
          shipping_address_id: selectedInvoice.shipping_address_id,
          deduct_stock_on_finalize: false,
          meta_json: (selectedInvoice as any).meta_json,
        })
        .select()
        .single();

      if (error) throw error;

      // Duplicate items
      if (selectedInvoice.items?.length) {
        const itemInserts = selectedInvoice.items.map((item: any) => ({
          invoice_id: newInvoice.id,
          description: item.description,
          hsn_code: item.hsn_code,
          qty: item.qty,
          rate: item.rate,
          discount_percent: item.discount_percent,
          amount: item.amount,
          meta_json: item.meta_json,
        }));
        await supabase.from('invoice_items').insert(itemInserts);
      }

      // Duplicate materials
      if (selectedInvoice.materials?.length) {
        const matInserts = selectedInvoice.materials.map((mat: any) => ({
          invoice_id: newInvoice.id,
          material_id: mat.material_id,
          qty: mat.qty,
          rate: mat.rate,
          amount: mat.amount,
          meta_json: mat.meta_json,
        }));
        await supabase.from('invoice_materials').insert(matInserts);
      }

      navigate(`/invoices/view?id=${newInvoice.id}`);
    } catch (err: any) {
      console.error('Error duplicating invoice:', err);
      alert('Failed to duplicate invoice: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleDelete = async () => {
    if (!selectedInvoice?.id) return;
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    if (!confirm('This action cannot be undone. Continue?')) return;
    try {
      await supabase.from('approvals').delete().eq('reference_id', selectedInvoice.id);
      await supabase.from('invoices').delete().eq('id', selectedInvoice.id);
      navigate('/invoices');
    } catch (err: any) {
      console.error('Error deleting invoice:', err);
      alert('Failed to delete invoice: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleConvert = (targetType: string) => {
    if (!selectedInvoice?.id) return;
    setShowConvertMenu(false);
    navigate(`/invoices/create?from=${selectedInvoice.id}`);
  };

  const closePreview = () => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewModalOpen(false);
    setPreviewPdfUrl(null);
    setPreviewLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      draft: { bg: '#f3f4f6', color: '#6b7280' },
      final: { bg: '#d1fae5', color: '#047857' },
    };
    const style = colors[status] || colors['draft'];
    return (
      <span
        style={{
          background: style.bg,
          color: style.color,
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        {status}
      </span>
    );
  };

  if (!invoiceId) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <button onClick={() => navigate('/invoices')} style={{ marginBottom: '16px' }}>
          ← Back to Invoices
        </button>
        <p>Invoice ID is missing.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-48px)] bg-zinc-100 overflow-hidden gap-[20px]">
      {/* Sidebar List (300px) */}
      <div className="w-[300px] flex flex-col bg-white shadow-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="py-5 px-6 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-zinc-700">All Invoices</h2>
          <button
            onClick={() => navigate('/invoices/create')}
            className="p-1.5 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {invoicesQuery.isPending ? (
            <div className="p-8 text-center text-zinc-400 text-sm italic">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-sm italic">No invoices found</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/invoices/view?id=${inv.id}`)}
                  className={`px-4 cursor-pointer transition-colors hover:bg-sky-50/30 ${
                    invoiceId === inv.id ? 'bg-sky-100' : 'bg-white'
                  }`}
                  style={{ paddingTop: '18px', paddingBottom: '18px' }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-bold text-zinc-900 truncate pr-2" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
                      {inv.client?.name || 'Unknown Client'}
                    </span>
                    <span className="text-xs font-bold text-zinc-900" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
                      {formatCurrency(inv.total)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1 gap-4">
                    <div className="text-xs font-inter flex items-center" style={{ paddingLeft: '10px', paddingRight: '10px', marginLeft: '1px', gap: '5px' }}>
                      <span className="text-zinc-700 font-medium">{inv.invoice_no}</span>
                      <span className="text-zinc-300">•</span>
                      <span className="text-blue-500">{formatDate(inv.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {(() => {
                        const paid = Number((inv as any).paid_amount ?? 0);
                        const total = Number(inv.total ?? 0);
                        if (paid <= 0 || total <= 0) return null;
                        if (paid >= total) {
                          return (
                            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ paddingLeft: '8px', paddingRight: '8px', backgroundColor: '#d1fae5', color: '#047857' }}>
                              Paid
                            </span>
                          );
                        }
                        return (
                          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ paddingLeft: '8px', paddingRight: '8px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                            Partially Paid
                          </span>
                        );
                      })()}
                      <span
                        className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{
                          paddingLeft: '10px',
                          paddingRight: '10px',
                          backgroundColor: inv.status === 'final' ? '#d1fae5' : '#f3f4f6',
                          color: inv.status === 'final' ? '#047857' : '#6b7280',
                        }}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-zinc-50 overflow-y-auto">
        <div className="max-w-5xl mx-auto py-12 px-16 sm:px-24 lg:px-32">
          {!selectedInvoice ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              Invoice not found
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-8 px-8">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-bold text-zinc-900">{selectedInvoice.invoice_no}</h1>
                  {getStatusBadge(selectedInvoice.status)}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-gradient-to-b from-[#001f3f] to-[#003366] text-white rounded-none hover:opacity-90 transition-all text-xs font-bold shadow-none border-none"
                    onClick={() => handlePrintAction('download')}
                    disabled={printLoading}
                  >
                    {printLoading ? <Loader2 className="w-[14px] h-[14px] animate-spin" /> : <Printer className="w-[14px] h-[14px]" />}
                    Print
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-[20px] mb-6 px-8 border-t border-zinc-200" style={{ paddingTop: '16px', paddingBottom: '16px' }}>
                <button
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all text-sm font-semibold"
                  onClick={() => navigate(`/invoices/edit?id=${selectedInvoice.id}`)}
                >
                  <Edit className="w-[14px] h-[14px]" />
                  Edit
                </button>

                <button
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all text-sm font-semibold"
                  onClick={handleDuplicate}
                >
                  <Copy className="w-[14px] h-[14px]" />
                  Duplicate
                </button>

                <div className="relative">
                  <button
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-all text-sm font-semibold"
                    onClick={() => {
                      setShowPaymentMenu(!showPaymentMenu);
                    }}
                  >
                    <CreditCard className="w-[14px] h-[14px]" />
                    Payments
                    <ChevronDown className={`w-[14px] h-[14px] transition-transform ${showPaymentMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showPaymentMenu && (
                    <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-zinc-200 shadow-xl p-1 rounded-sm">
                      <button
                        onClick={() => {
                          setEditingPayment(null);
                          setRecordPaymentOpen(true);
                          setShowPaymentMenu(false);
                        }}
                        className="flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-emerald-50 transition-colors"
                        style={{ padding: '12px' }}
                      >
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        Record Payment
                      </button>
                      <button
                        onClick={() => {
                          setPaymentHistoryOpen(true);
                          setShowPaymentMenu(false);
                        }}
                        className="flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors"
                        style={{ padding: '12px' }}
                      >
                        <FileText className="w-4 h-4 text-sky-500" />
                        Payment History
                        {paymentsQuery.data && paymentsQuery.data.length > 0 && (
                          <span className="ml-auto text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">
                            {paymentsQuery.data.filter(p => p.status === 'paid').length}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all text-sm font-semibold"
                    onClick={() => {
                      setShowConvertMenu(!showConvertMenu);
                      setShowPrintMenu(false);
                      setShowTemplateMenu(false);
                    }}
                  >
                    <FileText className="w-[14px] h-[14px]" />
                    Convert
                    <ChevronDown className={`w-[14px] h-[14px] transition-transform ${showConvertMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showConvertMenu && (
                    <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px] bg-white border border-zinc-200 shadow-xl p-1">
                      <button
                        onClick={() => handleConvert('invoice')}
                        className="block w-full text-left px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-sky-50"
                      >
                        New from this Invoice
                      </button>
                      <div className="my-1 border-t border-zinc-100" />
                      <button
                        onClick={() => {
                          window.location.href = `/credit-notes/create?from_invoice=${selectedInvoice.id}`;
                          setShowConvertMenu(false);
                        }}
                        className="block w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                      >
                        Convert to Credit Note
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all text-sm font-semibold"
                    onClick={() => {
                      setShowPrintMenu(!showPrintMenu);
                      setShowConvertMenu(false);
                      setShowTemplateMenu(false);
                    }}
                    disabled={printLoading}
                  >
                    {printLoading ? (
                      <Loader2 className="w-[14px] h-[14px] animate-spin" />
                    ) : (
                      <Printer className="w-[14px] h-[14px]" />
                    )}
                    Print ({getSelectedTemplateName()})
                    <ChevronDown className={`w-[14px] h-[14px] transition-transform ${showPrintMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showPrintMenu && (
                    <div ref={printMenuRef} className="absolute left-0 top-full mt-1 z-50 min-w-[240px] bg-white border border-zinc-200 shadow-xl p-1 rounded-sm">
                      {printMenuView === 'main' ? (
                        <>
                          <button
                            onClick={() => handlePrintAction('preview')}
                            className="flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors"
                            style={{ padding: '12px' }}
                          >
                            <Eye className="w-4 h-4 text-sky-500" />
                            Preview PDF
                          </button>
                          <button
                            onClick={() => handlePrintAction('download')}
                            className="flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors"
                            style={{ padding: '12px' }}
                          >
                            <Download className="w-4 h-4 text-sky-500" />
                            Download PDF
                          </button>
                          <button
                            onClick={() => handlePrintAction('print')}
                            className="flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors"
                            style={{ padding: '12px' }}
                          >
                            <Printer className="w-4 h-4 text-sky-500" />
                            Print PDF
                          </button>
                          <div className="h-px bg-zinc-100 my-1" />
                          <button
                            onClick={() => setPrintMenuView('templates')}
                            className="flex items-center justify-between w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors group"
                            style={{ padding: '12px' }}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-sky-500" />
                              Choose Template
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-sky-500 transition-colors" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 p-2 mb-1 border-b border-zinc-100">
                            <button
                              onClick={() => setPrintMenuView('main')}
                              className="p-1 hover:bg-zinc-100 rounded transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4 text-zinc-500" />
                            </button>
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Template</span>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                            {templates.length === 0 ? (
                              <div className="px-3 py-4 text-xs text-zinc-400 text-center">No templates found</div>
                            ) : (
                              templates.map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => {
                                    handleSelectTemplate(t.id);
                                    setPrintMenuView('main');
                                  }}
                                  className={`block w-full text-left text-xs font-bold transition-colors ${
                                    selectedTemplateId === t.id ? 'bg-sky-50 text-sky-600' : 'text-zinc-700 hover:bg-sky-50/50'
                                  }`}
                                  style={{ padding: '10px 12px' }}
                                >
                                  {t.name || t.template_name || 'Untitled'}
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {selectedInvoice.status === 'draft' && (
                  <button
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-all text-sm font-semibold"
                    onClick={handleDelete}
                  >
                    <Trash2 className="w-[14px] h-[14px]" />
                    Delete
                  </button>
                )}
              </div>

              {/* Creator & Approver */}
              <div 
                className="flex justify-between items-center text-sm text-zinc-500 px-8 border-y border-zinc-200"
                style={{ paddingTop: '14px', paddingBottom: '14px', marginBottom: '14px' }}
              >
                <div>
                  Invoice created by: <span className="text-zinc-900 font-medium ml-1">{selectedInvoice.creator?.full_name || selectedInvoice.prepared_by || user?.user_metadata?.full_name || user?.email || 'Unknown User'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div>Approved by:</div>
                  <button 
                    onClick={() => setActivityLogOpen(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded transition-colors font-medium"
                  >
                    <History size={14} />
                    Activity log
                  </button>
                </div>
              </div>

              {/* Invoice Details Container (Refined Cards Layout v2.0) */}
              <div className="space-y-10 mb-12">
                
                {/* Top Section: General Info & Bill To */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {/* General Information Card */}
                  <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-100">
                      <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-widest">General Information</h3>
                    </div>
                    <div className="py-10 px-12 flex-1" style={{ paddingLeft: '40px', paddingRight: '40px' }}>
                      <dl className="space-y-6">
                        <div className="flex justify-between items-center border-b border-zinc-50 pb-4">
                          <dt className="text-sm text-zinc-500 font-medium">Invoice No</dt>
                          <dd className="text-sm font-bold text-zinc-900">{selectedInvoice.invoice_no || '-'}</dd>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-50 pb-4">
                          <dt className="text-sm text-zinc-500 font-medium">Invoice Date</dt>
                          <dd className="text-sm font-bold text-zinc-900">{formatDate(selectedInvoice.created_at)}</dd>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-50 pb-4">
                          <dt className="text-sm text-zinc-500 font-medium">PO No</dt>
                          <dd className="text-sm font-bold text-zinc-900">{selectedInvoice.po_number || '-'}</dd>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-50 pb-4">
                          <dt className="text-sm text-zinc-500 font-medium">PO Date</dt>
                          <dd className="text-sm font-bold text-zinc-900">{selectedInvoice.po_date ? formatDate(selectedInvoice.po_date) : '-'}</dd>
                        </div>
                        <div className="flex justify-between items-start pt-2">
                          <dt className="text-sm text-zinc-500 font-medium">Remarks</dt>
                          <dd className="text-sm font-semibold text-zinc-900 text-right max-w-[200px] leading-relaxed" title={selectedInvoice.remarks}>{selectedInvoice.remarks || '-'}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Bill To Card */}
                  <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-100">
                      <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Billing Details</h3>
                    </div>
                    <div className="py-10 px-12 flex-1" style={{ paddingLeft: '40px', paddingRight: '40px' }}>
                      <div className="space-y-8">
                        <div>
                          <dt className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Client Entity</dt>
                          <dd className="text-base font-bold text-zinc-900">{selectedInvoice.client?.name || selectedInvoice.client?.client_name || 'Unknown'}</dd>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6">
                          {(selectedInvoice.client as any)?.gstin && (
                            <div>
                              <dt className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">GSTIN</dt>
                              <dd className="text-sm font-semibold text-zinc-700">{(selectedInvoice.client as any).gstin}</dd>
                            </div>
                          )}
                          {(selectedInvoice.billing_address || (selectedInvoice.client as any)?.address || (selectedInvoice.client as any)?.billing_address) && (
                            <div>
                              <dt className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Billing Address</dt>
                              <dd className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line pr-4">{selectedInvoice.billing_address || (selectedInvoice.client as any)?.address || (selectedInvoice.client as any)?.billing_address}</dd>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Table Card */}
                <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-100 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Line Items</h3>
                    <span className="text-xs font-bold text-zinc-400 px-3 py-1 bg-white border border-zinc-100 rounded-full">
                      {selectedInvoice.items?.length || 0} items
                    </span>
                  </div>
                  
                  <div className="p-0">
                    {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                          <thead>
                            <tr className="bg-zinc-100/80 border-b border-zinc-200">
                              {(() => {
                                const template = templates.find(t => t.id === selectedTemplateId);
                                const optCols = template?.column_settings?.optional || {};
                                const hasHSN = selectedInvoice.items?.some((i: any) => i.sac_code || i.hsn_code || i.item?.hsn_code);
                                const hasItemCode = selectedInvoice.items?.some((i: any) => i.item?.item_code || i.item_code);
                                const hasMake = selectedInvoice.items?.some((i: any) => i.make);
                                const hasVariant = selectedInvoice.items?.some((i: any) => i.variant_id);
                                const hasDiscount = selectedInvoice.items?.some((i: any) => i.discount_percent !== undefined && i.discount_percent !== null && i.discount_percent !== 0);
                                const hasTax = selectedInvoice.items?.some((i: any) => i.tax_percent !== undefined && i.tax_percent !== null && i.tax_percent !== 0);

                                return (
                                  <>
                                    {optCols.sno !== false && (
                                      <th className="px-6 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-left w-12">#</th>
                                    )}
                                    {hasHSN && (
                                      <th className="px-6 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-left">HSN/SAC</th>
                                    )}
                                    {hasItemCode && (
                                      <th className="px-6 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-left">Part No</th>
                                    )}
                                    {hasMake && (
                                      <th className="px-6 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-left">Make</th>
                                    )}
                                    <th className="px-8 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-left">Description</th>
                                    {hasVariant && (
                                      <th className="px-6 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-left">Variant</th>
                                    )}
                                    <th className="px-6 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right w-24">Qty</th>
                                    <th className="px-6 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-left w-20">Unit</th>
                                    <th className="px-6 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right w-40">Rate</th>
                                    {hasDiscount && (
                                      <th className="px-6 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right w-24">Disc %</th>
                                    )}
                                    {hasTax && (
                                      <th className="px-6 py-4 border-r border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right w-24">Tax %</th>
                                    )}
                                    <th className="px-8 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right w-48">Amount</th>
                                  </>
                                );
                              })()}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {selectedInvoice.items.map((item: any, index: number) => {
                               const template = templates.find(t => t.id === selectedTemplateId);
                               const optCols = template?.column_settings?.optional || {};
                               const hasHSN = selectedInvoice.items?.some((i: any) => i.sac_code || i.hsn_code || i.item?.hsn_code);
                               const hasItemCode = selectedInvoice.items?.some((i: any) => i.item?.item_code || i.item_code);
                               const hasMake = selectedInvoice.items?.some((i: any) => i.make);
                               const hasVariant = selectedInvoice.items?.some((i: any) => i.variant_id);
                               const hasDiscount = selectedInvoice.items?.some((i: any) => i.discount_percent !== undefined && i.discount_percent !== null && i.discount_percent !== 0);
                               const hasTax = selectedInvoice.items?.some((i: any) => i.tax_percent !== undefined && i.tax_percent !== null && i.tax_percent !== 0);

                               return (
                                <tr 
                                  key={index} 
                                  className={`transition-colors align-top ${index % 2 === 1 ? 'bg-zinc-100/30' : 'bg-white'} hover:bg-sky-50/40`}
                                >
                                  {optCols.sno !== false && (
                                    <td className="px-6 py-4 border-r border-zinc-100 text-xs text-zinc-400 font-medium text-left">{String(index + 1).padStart(2, '0')}</td>
                                  )}
                                  {hasHSN && (
                                    <td className="px-6 py-4 border-r border-zinc-100 text-xs text-zinc-500 font-inter text-left">{item.sac_code || item.hsn_code || item.item?.hsn_code || '-'}</td>
                                  )}
                                  {hasItemCode && (
                                    <td className="px-6 py-4 border-r border-zinc-100 text-xs text-zinc-500 text-left">{item.item?.item_code || item.item_code || '-'}</td>
                                  )}
                                  {hasMake && (
                                    <td className="px-6 py-4 border-r border-zinc-100 text-xs text-zinc-500 text-left">{item.make || '-'}</td>
                                  )}
                                  <td className="px-8 py-4 border-r border-zinc-100 text-left">
                                    <div className="text-sm font-bold text-zinc-900 leading-tight">{item.item?.display_name || item.item?.name || item.description || '-'}</div>
                                    {item.description && item.description !== (item.item?.display_name || item.item?.name) && (
                                      <div className="text-xs text-zinc-500 leading-relaxed mt-1.5">{item.description}</div>
                                    )}
                                  </td>
                                  {hasVariant && (
                                    <td className="px-6 py-4 border-r border-zinc-100 text-xs text-zinc-500 text-left">{item.variant_name || item.variant?.variant_name || '-'}</td>
                                  )}
                                  <td className="px-6 py-4 border-r border-zinc-100 text-sm text-zinc-900 text-right font-bold">{item.qty}</td>
                                  <td className="px-6 py-4 border-r border-zinc-100 text-xs text-zinc-400 uppercase font-medium text-left">{item.uom || item.unit || 'Nos'}</td>
                                  <td className="px-6 py-4 border-r border-zinc-100 text-sm text-zinc-900 text-right font-medium">{formatCurrency(item.rate)}</td>
                                  {hasDiscount && (
                                    <td className="px-6 py-4 border-r border-zinc-100 text-sm text-red-500 text-right font-medium">{item.discount_percent}%</td>
                                  )}
                                  {hasTax && (
                                    <td className="px-6 py-4 border-r border-zinc-100 text-sm text-zinc-600 text-right font-medium">{item.tax_percent}%</td>
                                  )}
                                  <td className="px-8 py-4 bg-zinc-50/10 text-sm font-bold text-zinc-900 text-right">{formatCurrency(item.amount || item.line_total)}</td>
                                </tr>
                               );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-24 bg-zinc-50/30">
                        <div className="text-zinc-400 text-sm font-medium">No line items found for this invoice.</div>
                      </div>
                    )}
                  </div>

                  {/* Totals Section */}
                  <div className="bg-zinc-50/50 p-10 border-t border-zinc-100">
                    <div className="flex flex-col items-end space-y-4">
                      <div className="w-full max-w-[320px]">
                        <div className="flex justify-between py-2.5 text-sm border-b border-zinc-100">
                          <span className="text-zinc-500 font-medium">Sub-total</span>
                          <span className="font-bold text-zinc-900">{formatCurrency(selectedInvoice.subtotal)}</span>
                        </div>
                        {selectedInvoice.cgst > 0 && (
                          <div className="flex justify-between py-2.5 text-sm border-b border-zinc-100">
                            <span className="text-zinc-500 font-medium">CGST</span>
                            <span className="font-medium text-zinc-700">{formatCurrency(selectedInvoice.cgst)}</span>
                          </div>
                        )}
                        {selectedInvoice.sgst > 0 && (
                          <div className="flex justify-between py-2.5 text-sm border-b border-zinc-100">
                            <span className="text-zinc-500 font-medium">SGST</span>
                            <span className="font-medium text-zinc-700">{formatCurrency(selectedInvoice.sgst)}</span>
                          </div>
                        )}
                        {selectedInvoice.igst > 0 && (
                          <div className="flex justify-between py-2.5 text-sm border-b border-zinc-100">
                            <span className="text-zinc-500 font-medium">IGST</span>
                            <span className="font-medium text-zinc-700">{formatCurrency(selectedInvoice.igst)}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-5 mt-3 text-xl font-bold">
                          <span className="text-zinc-900">Total Amount</span>
                          <span className="text-sky-600">{formatCurrency(selectedInvoice.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Post-Invoice Summary Section (UX Enhancement) */}
              <div className="mt-16 mb-20 px-8">
                <div className="h-px bg-zinc-200 w-full mb-12" />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {/* Submission Status Column */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest" style={{ paddingTop: '10px', paddingBottom: '10px' }}>Submission Tracking</h4>
                    {selectedInvoice.submitted_date ? (
                      <div className="bg-white border border-zinc-100 py-5 px-[30px] rounded-xl shadow-sm space-y-3 relative group">
                        <button 
                          onClick={() => {
                            setSelectedInvoiceForSubmission(selectedInvoice);
                            setSubmissionOpen(true);
                          }}
                          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                          title="Edit submission details"
                        >
                          <Edit size={14} />
                        </button>
                        <div className="flex items-center gap-3 text-zinc-900">
                          <CheckCircle2 size={18} className="text-emerald-500" />
                          <span className="text-sm font-semibold">Submitted to Client</span>
                        </div>
                        <div className="text-sm text-zinc-500 pl-7 leading-relaxed">
                          By <span className="font-medium text-zinc-800">{selectedInvoice.submitted_by}</span> on {formatDate(selectedInvoice.submitted_date)}
                        </div>
                        {selectedInvoice.submitted_file_url && (
                          <div className="pl-7 pt-1">
                            <a 
                              href={selectedInvoice.submitted_file_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 underline"
                            >
                              <FileText size={14} /> View Submission Proof
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-zinc-50 border border-dashed border-zinc-200 p-5 rounded-xl text-center">
                        <div className="text-sm text-zinc-400 mb-3" style={{ paddingTop: '10px', paddingBottom: '10px' }}>No submission record found</div>
                        <button 
                          onClick={() => {
                            setSelectedInvoiceForSubmission(selectedInvoice);
                            setSubmissionOpen(true);
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                          style={{ paddingTop: '10px', paddingBottom: '10px' }}
                        >
                          + Add Submission Details
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Payment Progress Column */}
                  <div className="space-y-4" style={{ marginLeft: '6px' }}>
                    <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest" style={{ paddingTop: '10px', paddingBottom: '10px' }}>Payment Settlement</h4>
                    
                    <div className="bg-white border border-zinc-100 py-6 px-[44px] rounded-xl shadow-sm">
                      {/* Financial Bar */}
                      <div className="flex justify-between items-end mb-4">
                        <div>
                          <div className="text-xs text-zinc-400 uppercase font-bold tracking-tight" style={{ paddingTop: '10px', paddingBottom: '10px', marginLeft: '10px' }}>Settled Amount</div>
                          <div className="text-xl font-bold text-zinc-900">{formatCurrency(totalPaid)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-zinc-400 uppercase font-bold tracking-tight" style={{ paddingTop: '10px', paddingBottom: '10px', marginLeft: '10px' }}>Outstanding Balance</div>
                          <div className={`text-xl font-bold ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {formatCurrency(balanceDue)}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden mb-6">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-500" 
                          style={{ width: `${Math.min(100, (totalPaid / (selectedInvoice.total || 1)) * 100)}%` }}
                        />
                      </div>

                      {/* Payment Details / CTA */}
                      {paymentsQuery.data && paymentsQuery.data.length > 0 ? (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-zinc-500" style={{ paddingTop: '10px', paddingBottom: '10px' }}>Recent Receipts</div>
                          {paymentsQuery.data.slice(0, 3).map((p: any) => (
                            <div key={p.id} className="flex justify-between items-center py-2 px-3 bg-zinc-50 rounded-lg text-sm">
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-zinc-700">{p.receipt_no}</span>
                                <span className="text-zinc-300">|</span>
                                <span className="text-zinc-500">{formatDate(p.receipt_date)}</span>
                                {p.payment_mode && (
                                  <span className="text-xs uppercase font-bold px-1.5 py-0.5 bg-zinc-200 text-zinc-600 rounded">
                                    {p.payment_mode.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                              <span className="font-bold text-zinc-900">{formatCurrency(p.amount)}</span>
                            </div>
                          ))}
                          <button 
                            onClick={() => setPaymentHistoryOpen(true)}
                            className="w-full text-center text-xs font-bold text-zinc-400 hover:text-zinc-600 py-2 transition-colors"
                          >
                            View all {paymentsQuery.data.length} transactions
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-4">
                          <div className="text-sm text-zinc-500 mb-4">No payments have been recorded for this invoice yet.</div>
                          <button 
                            onClick={() => setRecordPaymentOpen(true)}
                            className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white text-xs font-bold uppercase rounded-lg hover:bg-emerald-700 transition-all shadow-sm active:scale-[0.95]"
                          >
                            <CreditCard size={14} />
                            Mark Payment?
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* PDF Preview Modal */}
      {previewModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
          }}
          onClick={closePreview}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '90vw',
              maxWidth: '1200px',
              height: '95vh',
              background: '#fff',
              borderRadius: '0.75rem',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.625rem 1rem',
              background: '#fff',
              borderBottom: '1px solid #e5e7eb',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: '#111827', fontSize: '0.875rem', fontWeight: 600 }}>
                  {selectedInvoice?.invoice_no || 'Invoice Preview'}
                </span>
                {previewLoading && (
                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Loading...</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (selectedInvoice?.id) {
                      const selTpl = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) ?? null : null;
                      await downloadInvoicePDF(selectedInvoice, { template: selTpl });
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.375rem 0.75rem',
                    background: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    color: '#374151',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (selectedInvoice?.id) {
                      const selTpl = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) ?? null : null;
                      await printInvoicePDF(selectedInvoice, { template: selTpl });
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.375rem 0.75rem',
                    background: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    color: '#374151',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Printer size={14} />
                  Print
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '2rem',
                    height: '2rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', background: '#f3f4f6' }}>
              {previewPdfUrl ? (
                <iframe
                  src={previewPdfUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Invoice PDF Preview"
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
                  <Loader2 className="animate-spin" size={24} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Drawer */}
      {selectedInvoice && (
        <RecordPaymentDrawer
          open={recordPaymentOpen}
          onClose={() => {
            setRecordPaymentOpen(false);
            setEditingPayment(null);
          }}
          invoice={selectedInvoice}
          editPayment={editingPayment}
          onSuccess={() => {
            paymentsQuery.refetch();
          }}
        />
      )}

      {/* Payment History Drawer */}
      {selectedInvoice && (
        <PaymentHistoryDrawer
          open={paymentHistoryOpen}
          onClose={() => setPaymentHistoryOpen(false)}
          invoice={selectedInvoice}
          onEdit={(payment) => {
            setEditingPayment(payment);
            setPaymentHistoryOpen(false);
            setRecordPaymentOpen(true);
          }}
        />
      )}

      <ActivityLogDrawer 
        open={activityLogOpen} 
        onClose={() => setActivityLogOpen(false)} 
        userName={user?.user_metadata?.full_name || user?.email || 'Unknown User'}
        invoice={selectedInvoice}
        payments={paymentsQuery.data || []}
      />

      {selectedInvoice && (
        <AddSubmittedDetailsDrawer
          open={submissionOpen}
          onClose={() => {
            setSubmissionOpen(false);
          }}
          invoice={selectedInvoice}
        />
      )}
    </div>
  );
}
