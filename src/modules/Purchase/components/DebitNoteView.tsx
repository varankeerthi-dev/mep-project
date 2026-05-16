import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, FileText, Printer, Download, ChevronDown, Eye, Loader2, X, Search } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { AppTable } from '../../../components/ui/AppTable';
import { cn } from '../../../lib/utils';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useDebitNotes, useDeleteDebitNote } from '../hooks/usePurchaseQueries';
import { generateProGridAdjustmentNotePdf } from '../../../pdf/proGridAdjustmentNotePdf';

const DN_TYPE_LABELS: Record<string, string> = {
  'Purchase Return': 'Purchase Return',
  'Rate Difference': 'Rate Difference',
  'Discount': 'Discount',
  'Rejection': 'Rejection',
  'Other': 'Other',
};

function formatCurrency(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const DebitNoteView: React.FC = () => {
  const { organisation } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedDN, setSelectedDN] = useState<any>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  const { data: dns = [], isLoading, refetch } = useDebitNotes(organisation?.id);
  const deleteDN = useDeleteDebitNote();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setPrintMenuOpen(false);
      }
    };
    if (printMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [printMenuOpen]);

  const filteredDNs = useMemo(() => {
    if (!search) return dns;
    const q = search.toLowerCase();
    return (dns as any[]).filter(
      (dn: any) =>
        dn.dn_number?.toLowerCase().includes(q) ||
        dn.vendor?.company_name?.toLowerCase().includes(q) ||
        dn.bill?.bill_number?.toLowerCase().includes(q)
    );
  }, [dns, search]);

  const buildPdfData = useCallback((dn: any) => {
    return {
      kind: 'Debit Note' as const,
      document_no: dn.dn_number,
      document_date: dn.dn_date,
      party_name: dn.vendor?.company_name ?? 'Unknown Vendor',
      party_gstin: dn.vendor?.gstin ?? undefined,
      party_address: undefined,
      reason: dn.reason ?? undefined,
      taxable_amount: dn.taxable_amount ?? 0,
      cgst_amount: dn.cgst_amount ?? 0,
      sgst_amount: dn.sgst_amount ?? 0,
      igst_amount: dn.igst_amount ?? 0,
      total_amount: dn.total_amount ?? 0,
      items: (dn.items || []).map((item: any) => ({
        description: item.description,
        hsn: item.hsn_code ?? '—',
        qty: item.quantity,
        rate: item.rate,
        amount: item.total_amount,
      })),
      organisation: organisation ?? {},
    };
  }, [organisation]);

  const handlePreview = useCallback(async () => {
    if (!selectedDN) return;
    setPreviewModalOpen(true);
    setPreviewLoading(true);
    try {
      const pdfData = buildPdfData(selectedDN);
      const pdfDoc = generateProGridAdjustmentNotePdf(pdfData);
      const blob = pdfDoc.output('blob');
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedDN, buildPdfData]);

  const handleDownload = useCallback(() => {
    if (!selectedDN) return;
    const pdfData = buildPdfData(selectedDN);
    const pdfDoc = generateProGridAdjustmentNotePdf(pdfData);
    pdfDoc.save(`${selectedDN.dn_number}.pdf`);
  }, [selectedDN, buildPdfData]);

  const handlePrint = useCallback(() => {
    if (!selectedDN) return;
    const pdfData = buildPdfData(selectedDN);
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
  }, [selectedDN, buildPdfData]);

  const handleDelete = useCallback(async () => {
    if (!selectedDN) return;
    try {
      await deleteDN.mutateAsync(selectedDN.id);
      setDeleteConfirmOpen(false);
      setSelectedDN(null);
      refetch();
    } catch {
      alert('Failed to delete debit note');
    }
  }, [selectedDN, deleteDN, refetch]);

  const getSignatoryName = useCallback(() => {
    if (!selectedDN?.authorized_signatory_id) return '';
    const sig = (organisation?.signatures as any[])?.find(s => String(s.id) === String(selectedDN.authorized_signatory_id));
    return sig?.name ?? '';
  }, [selectedDN, organisation]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-zinc-400">Loading debit notes...</div>;
  }

  return (
    <div className="flex h-full gap-5">
      {/* Left Sidebar */}
      <div className="w-[300px] flex flex-col bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="py-4 px-5 border-b bg-zinc-50/50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-zinc-700">All Debit Notes</h2>
        </div>
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search DN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-zinc-200 rounded focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredDNs.map((dn: any) => (
            <div
              key={dn.id}
              onClick={() => setSelectedDN(dn)}
              className={`px-5 py-3 cursor-pointer transition-colors border-l-4 ${
                selectedDN?.id === dn.id
                  ? 'bg-rose-50 border-l-rose-500'
                  : 'bg-white border-l-transparent hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-zinc-900">{dn.dn_number}</span>
                <Badge variant={dn.approval_status === 'Approved' ? 'default' : dn.approval_status === 'Rejected' ? 'destructive' : 'secondary'} className="text-[9px] h-4 px-1.5">
                  {dn.approval_status}
                </Badge>
              </div>
              <div className="text-xs text-zinc-500 truncate">{dn.vendor?.company_name ?? '—'}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-zinc-400">{formatDate(dn.dn_date)}</span>
                <span className="text-xs font-semibold text-zinc-900">{formatCurrency(dn.total_amount)}</span>
              </div>
            </div>
          ))}
          {filteredDNs.length === 0 && (
            <div className="px-5 py-12 text-center text-xs text-zinc-400">
              {(dns as any[]).length === 0 ? 'No debit notes yet' : 'No matches'}
            </div>
          )}
        </div>
      </div>

      {/* Right Detail Panel */}
      <div className="flex-1 bg-white rounded-lg shadow-sm overflow-y-auto">
        {!selectedDN ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Select a debit note to view details</div>
        ) : (
          <div className="max-w-4xl mx-auto py-10 px-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-zinc-900">{selectedDN.dn_number}</h1>
                <Badge variant={selectedDN.approval_status === 'Approved' ? 'default' : selectedDN.approval_status === 'Rejected' ? 'destructive' : 'secondary'}>
                  {selectedDN.approval_status}
                </Badge>
              </div>
              <button
                onClick={handlePreview}
                className="inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-gradient-to-b from-rose-600 to-rose-700 text-white rounded-none hover:opacity-90 transition-all text-[11px] font-bold shadow-none border-none"
              >
                <Printer className="w-[14px] h-[14px]" /> Print
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('edit-dn', { detail: { dn: selectedDN } }));
                }}
                className="inline-flex items-center gap-2 px-4 h-[25px] bg-white text-zinc-700 border border-zinc-300 rounded hover:bg-zinc-50 transition-all text-[12px] font-bold"
              >
                <Pencil className="w-[14px] h-[14px]" /> Edit
              </button>

              <div className="relative" ref={printMenuRef}>
                <button
                  onClick={() => setPrintMenuOpen(!printMenuOpen)}
                  className="inline-flex items-center gap-2 px-4 h-[25px] bg-white text-zinc-700 border border-zinc-300 rounded hover:bg-zinc-50 transition-all text-[12px] font-bold"
                >
                  <FileText className="w-[14px] h-[14px]" /> Print Template <ChevronDown className="w-[12px] h-[12px]" />
                </button>
                {printMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-zinc-200 shadow-xl p-1 rounded-sm">
                    <button onClick={() => { handlePreview(); setPrintMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 rounded">
                      <Eye className="w-[14px] h-[14px]" /> Preview PDF
                    </button>
                    <button onClick={() => { handleDownload(); setPrintMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 rounded">
                      <Download className="w-[14px] h-[14px]" /> Download PDF
                    </button>
                    <button onClick={() => { handlePrint(); setPrintMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 rounded">
                      <Printer className="w-[14px] h-[14px]" /> Print PDF
                    </button>
                  </div>
                )}
              </div>

              {selectedDN.approval_status === 'Pending' && (
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="inline-flex items-center gap-2 px-4 h-[25px] bg-white text-red-600 border border-red-200 rounded hover:bg-red-50 transition-all text-[12px] font-bold"
                >
                  <Trash2 className="w-[14px] h-[14px]" /> Delete
                </button>
              )}
            </div>

            {/* Detail Card */}
            <div className="bg-white rounded-lg border border-zinc-200 p-8">
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-3">Vendor</h3>
                  <p className="text-lg font-bold text-zinc-900">{selectedDN.vendor?.company_name ?? '—'}</p>
                  {selectedDN.vendor?.gstin && <p className="text-sm text-zinc-500 mt-1">GSTIN: {selectedDN.vendor.gstin}</p>}
                  {selectedDN.bill?.bill_number && <p className="text-sm text-zinc-500">Bill: {selectedDN.bill.bill_number}</p>}
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-3">Debit Note Details</h3>
                  <div className="space-y-1 text-sm text-zinc-600">
                    <p>Date: <span className="font-medium text-zinc-900">{formatDate(selectedDN.dn_date)}</span></p>
                    <p>Type: <span className="font-medium text-zinc-900">{DN_TYPE_LABELS[selectedDN.dn_type] ?? selectedDN.dn_type}</span></p>
                    {selectedDN.reason && <p>Reason: <span className="font-medium text-zinc-900">{selectedDN.reason}</span></p>}
                    {getSignatoryName() && <p>Signatory: <span className="font-medium text-zinc-900">{getSignatoryName()}</span></p>}
                  </div>
                </div>
              </div>

              {/* Items */}
              <table className="w-full text-sm mb-8">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="py-2 px-3 text-left text-xs font-semibold text-zinc-500">#</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-zinc-500">Description</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-zinc-500">HSN</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-zinc-500">Qty</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-zinc-500">Rate</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-zinc-500">Taxable</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-zinc-500">GST</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-zinc-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedDN.items || []).map((item: any, idx: number) => {
                    const gst = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
                    return (
                      <tr key={item.id || idx} className="border-b border-zinc-100">
                        <td className="py-2 px-3 text-zinc-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-zinc-900">{item.description}</td>
                        <td className="py-2 px-3 text-zinc-500">{item.hsn_code ?? '—'}</td>
                        <td className="py-2 px-3 text-right">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.rate)}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.taxable_value)}</td>
                        <td className="py-2 px-3 text-right font-mono text-zinc-500">{formatCurrency(gst)}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{formatCurrency(item.total_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Taxable Amount</span>
                    <span className="font-mono">{formatCurrency(selectedDN.taxable_amount ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>GST</span>
                    <span className="font-mono">{formatCurrency((selectedDN.cgst_amount ?? 0) + (selectedDN.sgst_amount ?? 0) + (selectedDN.igst_amount ?? 0))}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-zinc-200 pt-3">
                    <span>Total</span>
                    <span className="font-mono text-rose-600">{formatCurrency(selectedDN.total_amount ?? 0)}</span>
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
                <FileText size={18} style={{ color: '#e11d48' }} />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{selectedDN?.dn_number} — {selectedDN?.vendor?.company_name}</span>
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
                <iframe src={previewPdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Debit Note PDF Preview" />
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
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>Delete Debit Note</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#525252' }}>Are you sure you want to delete this debit note? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmOpen(false)} style={{ padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDelete} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
