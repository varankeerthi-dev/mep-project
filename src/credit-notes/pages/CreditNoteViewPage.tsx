import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, FileText, Printer, Download, ChevronDown, Eye, Loader2, X } from 'lucide-react';
import { useCreditNotes, useDeleteCreditNote } from '../../credit-notes/hooks';
import { CNStatusBadge } from '../../credit-notes/components/StatusBadge';
import { formatCurrency, formatDate } from '../../credit-notes/ui-utils';
import { CN_TYPE_LABELS } from '../../credit-notes/schemas';
import type { CreditNote } from '../../credit-notes/types';
import { useAuth } from '../../App';
import { generateProGridAdjustmentNotePdf } from '../../pdf/proGridAdjustmentNotePdf';

export function CreditNoteViewPage() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get('id');

  const { data: creditNotes = [], isLoading, refetch } = useCreditNotes({ organisationId: organisation?.id });
  const deleteCN = useDeleteCreditNote();

  const [search, setSearch] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  const selectedCN = creditNotes.find(cn => cn.id === viewId) ?? null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setPrintMenuOpen(false);
      }
    };
    if (printMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [printMenuOpen]);

  const filteredNotes = creditNotes.filter(cn => {
    if (!search) return true;
    const q = search.toLowerCase();
    return cn.cn_number.toLowerCase().includes(q) ||
      cn.client?.name?.toLowerCase().includes(q) ||
      cn.reason?.toLowerCase().includes(q);
  });

  const buildPdfData = useCallback((cn: CreditNote) => {
    return {
      kind: 'Credit Note' as const,
      document_no: cn.cn_number,
      document_date: cn.cn_date,
      party_name: cn.client?.name ?? 'Unknown Client',
      party_gstin: cn.client?.gstin ?? undefined,
      party_address: undefined,
      reason: cn.reason ?? undefined,
      taxable_amount: cn.taxable_amount,
      cgst_amount: cn.cgst_amount,
      sgst_amount: cn.sgst_amount,
      igst_amount: cn.igst_amount,
      total_amount: cn.total_amount,
      items: cn.items.map(item => ({
        description: item.description,
        hsn: item.hsn_code ?? '—',
        qty: item.quantity,
        rate: item.rate,
        amount: item.total_amount,
      })),
      organisation: organisation ?? {},
      authorized_signatory_id: cn.authorized_signatory_id,
    };
  }, [organisation]);

  const handlePreview = useCallback(async () => {
    if (!selectedCN) return;
    setPreviewModalOpen(true);
    setPreviewLoading(true);
    try {
      const pdfData = buildPdfData(selectedCN);
      const pdfDoc = generateProGridAdjustmentNotePdf(pdfData);
      const blob = pdfDoc.output('blob');
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedCN, buildPdfData]);

  const handleDownload = useCallback(() => {
    if (!selectedCN) return;
    const pdfData = buildPdfData(selectedCN);
    const pdfDoc = generateProGridAdjustmentNotePdf(pdfData);
    pdfDoc.save(`${selectedCN.cn_number}.pdf`);
  }, [selectedCN, buildPdfData]);

  const handlePrint = useCallback(() => {
    if (!selectedCN) return;
    const pdfData = buildPdfData(selectedCN);
    const pdfDoc = generateProGridAdjustmentNotePdf(pdfData);
    const blob = pdfDoc.output('blob');
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try { iframe.contentWindow?.print(); } catch { window.print(); }
      setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 1000);
    };
  }, [selectedCN, buildPdfData]);

  const handleDelete = useCallback(async () => {
    if (!selectedCN) return;
    try {
      await deleteCN.mutateAsync(selectedCN.id);
      setDeleteConfirmOpen(false);
      navigate('/credit-notes');
    } catch {
      alert('Failed to delete credit note');
    }
  }, [selectedCN, deleteCN, navigate]);

  const getSignatoryName = useCallback(() => {
    if (!selectedCN?.authorized_signatory_id) return '';
    const sig = (organisation?.signatures as any[])?.find(s => String(s.id) === String(selectedCN.authorized_signatory_id));
    return sig?.name ?? '';
  }, [selectedCN, organisation]);

  if (isLoading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#a3a3a3' }}>Loading...</div>;
  }

  return (
    <div className="flex h-[calc(100vh-48px)] bg-zinc-100 overflow-hidden gap-[20px]">
      {/* Left Sidebar */}
      <div className="w-[300px] flex flex-col bg-white shadow-sm" style={{ fontFamily: "'Roboto', sans-serif" }}>
        <div className="py-5 px-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-gray-700">All Credit Notes</h2>
          <button onClick={() => navigate('/credit-notes/create')} className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-100">
          <input
            type="text"
            placeholder="Search CN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredNotes.map(cn => (
            <div
              key={cn.id}
              onClick={() => navigate(`/credit-notes/view?id=${cn.id}`)}
              className={`px-6 py-3 cursor-pointer transition-colors border-l-4 ${
                cn.id === viewId
                  ? 'bg-blue-50 border-l-blue-500'
                  : 'bg-white border-l-transparent hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-900">{cn.cn_number}</span>
                <CNStatusBadge status={cn.approval_status} />
              </div>
              <div className="text-xs text-gray-500 truncate">{cn.client?.name ?? '—'}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400">{formatDate(cn.cn_date)}</span>
                <span className="text-xs font-semibold text-gray-900">{formatCurrency(cn.total_amount)}</span>
              </div>
            </div>
          ))}
          {filteredNotes.length === 0 && (
            <div className="px-6 py-12 text-center text-xs text-gray-400">
              {creditNotes.length === 0 ? 'No credit notes yet' : 'No matches'}
            </div>
          )}
        </div>
      </div>

      {/* Right Detail Panel */}
      <div className="flex-1 bg-gray-50 overflow-y-auto">
        {!selectedCN ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Select a credit note to view details</div>
        ) : (
          <div className="max-w-5xl mx-auto py-12 px-8 sm:px-12 lg:px-16">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900">{selectedCN.cn_number}</h1>
                <CNStatusBadge status={selectedCN.approval_status} />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreview}
                  className="inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-gradient-to-b from-[#001f3f] to-[#003366] text-white rounded-none hover:opacity-90 transition-all text-[11px] font-bold shadow-none border-none"
                >
                  <Printer className="w-[14px] h-[14px]" />
                  Print
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 mb-6" style={{ paddingBottom: '16px' }}>
              <button
                onClick={() => navigate(`/credit-notes/edit?id=${selectedCN.id}`)}
                className="inline-flex items-center gap-2 px-4 h-[25px] bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-all text-[12px] font-bold"
              >
                <Pencil className="w-[14px] h-[14px]" /> Edit
              </button>

              <div className="relative" ref={printMenuRef}>
                <button
                  onClick={() => setPrintMenuOpen(!printMenuOpen)}
                  className="inline-flex items-center gap-2 px-4 h-[25px] bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-all text-[12px] font-bold"
                >
                  <FileText className="w-[14px] h-[14px]" /> Print Template <ChevronDown className="w-[12px] h-[12px]" />
                </button>
                {printMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-gray-200 shadow-xl p-1 rounded-sm">
                    <button
                      onClick={() => { handlePreview(); setPrintMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded"
                    >
                      <Eye className="w-[14px] h-[14px]" /> Preview PDF
                    </button>
                    <button
                      onClick={() => { handleDownload(); setPrintMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded"
                    >
                      <Download className="w-[14px] h-[14px]" /> Download PDF
                    </button>
                    <button
                      onClick={() => { handlePrint(); setPrintMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded"
                    >
                      <Printer className="w-[14px] h-[14px]" /> Print PDF
                    </button>
                  </div>
                )}
              </div>

              {selectedCN.approval_status === 'Pending' && (
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="inline-flex items-center gap-2 px-4 h-[25px] bg-white text-red-600 border border-red-200 rounded hover:bg-red-50 transition-all text-[12px] font-bold"
                >
                  <Trash2 className="w-[14px] h-[14px]" /> Delete
                </button>
              )}
            </div>

            {/* Detail Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {/* CN Info + Client */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Bill To</h3>
                  <p className="text-lg font-bold text-gray-900">{selectedCN.client?.name ?? '—'}</p>
                  {selectedCN.client?.gstin && <p className="text-sm text-gray-500 mt-1">GSTIN: {selectedCN.client.gstin}</p>}
                  {selectedCN.client?.state && <p className="text-sm text-gray-500">State: {selectedCN.client.state}</p>}
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Credit Note Details</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Date: <span className="font-medium text-gray-900">{formatDate(selectedCN.cn_date)}</span></p>
                    <p>Type: <span className="font-medium text-gray-900">{CN_TYPE_LABELS[selectedCN.cn_type as keyof typeof CN_TYPE_LABELS] ?? selectedCN.cn_type}</span></p>
                    {selectedCN.reason && <p>Reason: <span className="font-medium text-gray-900">{selectedCN.reason}</span></p>}
                    {getSignatoryName() && <p>Signatory: <span className="font-medium text-gray-900">{getSignatoryName()}</span></p>}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-sm mb-8">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500">#</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500">Description</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500">HSN</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500">Qty</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500">Rate</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500">Taxable</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500">GST</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCN.items.map((item, idx) => {
                    const gst = item.cgst_amount + item.sgst_amount + item.igst_amount;
                    return (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-gray-900">{item.description}</td>
                        <td className="py-2 px-3 text-gray-500">{item.hsn_code ?? '—'}</td>
                        <td className="py-2 px-3 text-right">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.rate)}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.taxable_value)}</td>
                        <td className="py-2 px-3 text-right font-mono text-gray-500">{formatCurrency(gst)}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{formatCurrency(item.total_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Taxable Amount</span>
                    <span className="font-mono">{formatCurrency(selectedCN.taxable_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>CGST</span>
                    <span className="font-mono">{formatCurrency(selectedCN.cgst_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>SGST</span>
                    <span className="font-mono">{formatCurrency(selectedCN.sgst_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>IGST</span>
                    <span className="font-mono">{formatCurrency(selectedCN.igst_amount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-3">
                    <span>Total</span>
                    <span className="font-mono text-blue-600">{formatCurrency(selectedCN.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      {previewModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.6)' }} onClick={() => { setPreviewModalOpen(false); if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '90vw', maxWidth: '1200px', height: '95vh', background: '#fff', borderRadius: '0.75rem', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e5e5e5', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={18} style={{ color: '#2563eb' }} />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{selectedCN?.cn_number} — {selectedCN?.client?.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={handleDownload} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                  <Download size={14} /> Download
                </button>
                <button onClick={() => { setPreviewModalOpen(false); if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: '#737373' }}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', background: '#f3f4f6' }}>
              {previewLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: '#a3a3a3' }} />
                </div>
              ) : previewPdfUrl ? (
                <iframe src={previewPdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Credit Note PDF Preview" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a3a3a3' }}>Failed to load preview</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>Delete Credit Note</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#525252' }}>Are you sure you want to delete this credit note? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmOpen(false)} style={{ padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDelete} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
