import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import RecordPaymentDrawer from '../components/RecordPaymentDrawer';
import PaymentHistoryDrawer from '../components/PaymentHistoryDrawer';

export default function InvoiceView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('id');
  const { organisation } = useAuth();

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
      <div className="w-[300px] flex flex-col bg-white shadow-sm" style={{ fontFamily: "'Roboto', sans-serif" }}>
        <div className="py-5 px-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-gray-700">All Invoices</h2>
          <button
            onClick={() => navigate('/invoices/create')}
            className="p-1.5 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {invoicesQuery.isPending ? (
            <div className="p-8 text-center text-gray-400 text-sm italic">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm italic">No invoices found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/invoices/view?id=${inv.id}`)}
                  className={`px-6 cursor-pointer transition-colors hover:bg-sky-50/30 ${
                    invoiceId === inv.id ? 'bg-sky-50 border-l-4 border-sky-500' : 'bg-white'
                  }`}
                  style={{ paddingTop: '14px', paddingBottom: '14px' }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[13px] font-bold text-gray-900 truncate pr-2" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
                      {inv.client?.name || 'Unknown Client'}
                    </span>
                    <span className="text-[12px] font-bold text-gray-900" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
                      {formatCurrency(inv.total)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1 gap-4">
                    <div className="text-[11px] font-mono" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
                      <span className="text-gray-700 font-medium">{inv.invoice_no}</span>
                      <span className="mx-1 text-gray-300">•</span>
                      <span className="text-blue-500">{formatDate(inv.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {(() => {
                        // Fallback: paid_amount may be null for pre-migration data
                        // Migration 005 backfills existing data, trigger keeps it in sync
                        const paid = Number((inv as any).paid_amount ?? 0);
                        const total = Number(inv.total ?? 0);
                        if (paid <= 0 || total <= 0) return null;
                        if (paid >= total) {
                          return (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ paddingLeft: '8px', paddingRight: '8px', backgroundColor: '#d1fae5', color: '#047857' }}>
                              Paid
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ paddingLeft: '8px', paddingRight: '8px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                            Partially Paid
                          </span>
                        );
                      })()}
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
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
      <div className="flex-1 bg-gray-50 overflow-y-auto">
        <div className="max-w-5xl mx-auto py-12 px-8 sm:px-12 lg:px-16">
          {!selectedInvoice ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              Invoice not found
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-bold text-gray-900">{selectedInvoice.invoice_no}</h1>
                  {getStatusBadge(selectedInvoice.status)}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-gradient-to-b from-[#001f3f] to-[#003366] text-white rounded-none hover:opacity-90 transition-all text-[11px] font-bold shadow-none border-none"
                    onClick={() => handlePrintAction('download')}
                    disabled={printLoading}
                  >
                    {printLoading ? <Loader2 className="w-[14px] h-[14px] animate-spin" /> : <Printer className="w-[14px] h-[14px]" />}
                    Print
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 mb-6" style={{ paddingBottom: '16px' }}>
                <button
                  className="inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-all text-[12px] font-bold"
                  onClick={() => navigate(`/invoices/edit?id=${selectedInvoice.id}`)}
                >
                  <Edit className="w-[14px] h-[14px]" />
                  Edit
                </button>

                <button
                  className="inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-all text-[12px] font-bold"
                  onClick={handleDuplicate}
                >
                  <Copy className="w-[14px] h-[14px]" />
                  Duplicate
                </button>

                <div className="relative">
                  <button
                    className="inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-all text-[12px] font-bold"
                    onClick={() => {
                      setShowPaymentMenu(!showPaymentMenu);
                    }}
                  >
                    <CreditCard className="w-[14px] h-[14px]" />
                    Payments
                    <ChevronDown className={`w-[14px] h-[14px] transition-transform ${showPaymentMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showPaymentMenu && (
                    <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-gray-200 shadow-xl p-1 rounded-sm">
                      <button
                        onClick={() => {
                          setEditingPayment(null);
                          setRecordPaymentOpen(true);
                          setShowPaymentMenu(false);
                        }}
                        className="flex items-center gap-3 w-full text-left text-xs font-bold text-gray-700 hover:bg-emerald-50 transition-colors"
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
                        className="flex items-center gap-3 w-full text-left text-xs font-bold text-gray-700 hover:bg-sky-50 transition-colors"
                        style={{ padding: '12px' }}
                      >
                        <FileText className="w-4 h-4 text-sky-500" />
                        Payment History
                        {paymentsQuery.data && paymentsQuery.data.length > 0 && (
                          <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                            {paymentsQuery.data.filter(p => p.status === 'paid').length}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    className="inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-all text-[12px] font-bold"
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
                    <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-gray-200 shadow-xl p-1">
                      <button
                        onClick={() => handleConvert('invoice')}
                        className="block w-full text-left px-3 py-2 text-xs font-bold text-gray-700 hover:bg-sky-50"
                      >
                        New from this Invoice
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    className="inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-all text-[12px] font-bold"
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
                    <div ref={printMenuRef} className="absolute left-0 top-full mt-1 z-50 min-w-[240px] bg-white border border-gray-200 shadow-xl p-1 rounded-sm">
                      {printMenuView === 'main' ? (
                        <>
                          <button
                            onClick={() => handlePrintAction('preview')}
                            className="flex items-center gap-3 w-full text-left text-xs font-bold text-gray-700 hover:bg-sky-50 transition-colors"
                            style={{ padding: '12px' }}
                          >
                            <Eye className="w-4 h-4 text-sky-500" />
                            Preview PDF
                          </button>
                          <button
                            onClick={() => handlePrintAction('download')}
                            className="flex items-center gap-3 w-full text-left text-xs font-bold text-gray-700 hover:bg-sky-50 transition-colors"
                            style={{ padding: '12px' }}
                          >
                            <Download className="w-4 h-4 text-sky-500" />
                            Download PDF
                          </button>
                          <button
                            onClick={() => handlePrintAction('print')}
                            className="flex items-center gap-3 w-full text-left text-xs font-bold text-gray-700 hover:bg-sky-50 transition-colors"
                            style={{ padding: '12px' }}
                          >
                            <Printer className="w-4 h-4 text-sky-500" />
                            Print PDF
                          </button>
                          <div className="h-px bg-gray-100 my-1" />
                          <button
                            onClick={() => setPrintMenuView('templates')}
                            className="flex items-center justify-between w-full text-left text-xs font-bold text-gray-700 hover:bg-sky-50 transition-colors group"
                            style={{ padding: '12px' }}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-sky-500" />
                              Choose Template
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-sky-500 transition-colors" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 p-2 mb-1 border-b border-gray-100">
                            <button
                              onClick={() => setPrintMenuView('main')}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4 text-gray-500" />
                            </button>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Template</span>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                            {templates.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => {
                                  handleSelectTemplate(t.id);
                                  setPrintMenuView('main');
                                }}
                                className={`block w-full text-left text-xs font-bold transition-colors ${
                                  selectedTemplateId === t.id ? 'bg-sky-50 text-sky-600' : 'text-gray-700 hover:bg-sky-50/50'
                                }`}
                                style={{ padding: '10px 12px' }}
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {selectedInvoice.status === 'draft' && (
                  <button
                    className="inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-white text-red-600 border border-red-200 rounded hover:bg-red-50 transition-all text-[12px] font-bold"
                    onClick={handleDelete}
                  >
                    <Trash2 className="w-[14px] h-[14px]" />
                    Delete
                  </button>
                )}
              </div>

              {/* Invoice Details */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                {/* Client Info */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Bill To</h3>
                    <p className="text-lg font-semibold text-gray-900">{selectedInvoice.client?.name || 'Unknown'}</p>
                    {(selectedInvoice.client as any)?.gstin && (
                      <p className="text-sm text-gray-600">GSTIN: {(selectedInvoice.client as any).gstin}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Invoice Details</h3>
                    <p className="text-sm text-gray-600">Date: {formatDate(selectedInvoice.created_at)}</p>
                    {selectedInvoice.po_number && (
                      <p className="text-sm text-gray-600">PO No: {selectedInvoice.po_number}</p>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                  <div className="mb-8">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">#</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Description</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Qty</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Rate</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.items.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="py-3 px-4 text-gray-600">{idx + 1}</td>
                            <td className="py-3 px-4 text-gray-900">{item.description}</td>
                            <td className="py-3 px-4 text-right text-gray-600">{item.qty}</td>
                            <td className="py-3 px-4 text-right text-gray-600">{formatCurrency(item.rate)}</td>
                            <td className="py-3 px-4 text-right font-semibold text-gray-900">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64">
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(selectedInvoice.subtotal)}</span>
                    </div>
                    {selectedInvoice.cgst > 0 && (
                      <div className="flex justify-between py-2 text-sm">
                        <span className="text-gray-600">CGST</span>
                        <span className="text-gray-900">{formatCurrency(selectedInvoice.cgst)}</span>
                      </div>
                    )}
                    {selectedInvoice.sgst > 0 && (
                      <div className="flex justify-between py-2 text-sm">
                        <span className="text-gray-600">SGST</span>
                        <span className="text-gray-900">{formatCurrency(selectedInvoice.sgst)}</span>
                      </div>
                    )}
                    {selectedInvoice.igst > 0 && (
                      <div className="flex justify-between py-2 text-sm">
                        <span className="text-gray-600">IGST</span>
                        <span className="text-gray-900">{formatCurrency(selectedInvoice.igst)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 border-t border-gray-200 text-base font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(selectedInvoice.total)}</span>
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
    </div>
  );
}
