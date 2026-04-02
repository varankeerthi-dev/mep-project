import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, Eye, Loader2, Mail, MoreHorizontal, Plus, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../hooks';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { downloadInvoicePDF, emailInvoicePDF, previewInvoicePDF, printInvoicePDF } from '../pdf';
import { formatCurrency, formatDate, getInvoiceDisplayNumber } from '../ui-utils';

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'final'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [activePdfAction, setActivePdfAction] = useState<{
    invoiceId: string;
    action: 'preview' | 'download' | 'print' | 'email';
  } | null>(null);
  const [openMenuInvoiceId, setOpenMenuInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuInvoiceId) return undefined;

    const handleCloseMenu = () => setOpenMenuInvoiceId(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuInvoiceId(null);
      }
    };

    document.addEventListener('click', handleCloseMenu);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleCloseMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuInvoiceId]);

  const invoicesQuery = useInvoices({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const filteredInvoices = useMemo(() => {
    const records = invoicesQuery.data ?? [];

    return records.filter((invoice) => {
      if (!dateFilter) return true;

      const sourceDate = invoice.created_at ? new Date(invoice.created_at) : null;
      if (!sourceDate || Number.isNaN(sourceDate.getTime())) return false;

      const selectedDate = new Date(`${dateFilter}T00:00:00`);
      return sourceDate.toDateString() === selectedDate.toDateString();
    });
  }, [dateFilter, invoicesQuery.data]);

  const handleDownloadPdf = async (invoiceId: string) => {
    setActivePdfAction({ invoiceId, action: 'download' });
    try {
      await downloadInvoicePDF(invoiceId);
    } finally {
      setActivePdfAction(null);
    }
  };

  const handlePreviewPdf = async (invoiceId: string) => {
    setActivePdfAction({ invoiceId, action: 'preview' });
    try {
      await previewInvoicePDF(invoiceId);
    } finally {
      setActivePdfAction(null);
    }
  };

  const handlePrintPdf = async (invoiceId: string) => {
    setActivePdfAction({ invoiceId, action: 'print' });
    try {
      await printInvoicePDF(invoiceId);
    } finally {
      setActivePdfAction(null);
    }
  };

  const handleEmailPdf = async (invoiceId: string) => {
    setActivePdfAction({ invoiceId, action: 'email' });
    try {
      await emailInvoicePDF(invoiceId);
    } finally {
      setActivePdfAction(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
            Invoice Module
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Invoices</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-500">
            Manage draft and final invoices across quotations, delivery challans, and client purchase orders.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/invoices/create')}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800"
        >
          <Plus size={15} />
          Create invoice
        </button>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-200 px-5 py-4 md:grid-cols-[180px_180px_1fr]">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'draft' | 'final')}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="final">Final</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Date</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <div className="flex items-end justify-start text-[12px] text-slate-500 md:justify-end">
            {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-5 py-3">Invoice No</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoicesQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[13px] text-slate-500">
                    Loading invoices...
                  </td>
                </tr>
              )}

              {!invoicesQuery.isLoading && filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <div className="mx-auto max-w-md space-y-2">
                      <div className="text-[15px] font-semibold text-slate-900">No invoices found</div>
                      <div className="text-[13px] text-slate-500">
                        Try a different filter or create your first invoice from a source document.
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-slate-100 text-[13px] text-slate-700 last:border-b-0">
                  <td className="px-5 py-4 font-semibold text-slate-950">{getInvoiceDisplayNumber(invoice)}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900">{invoice.client?.name ?? 'Unknown client'}</div>
                    <div className="mt-1 text-[12px] text-slate-500">{invoice.source_type}</div>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-950">{formatCurrency(invoice.total)}</td>
                  <td className="px-4 py-4">
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-4 text-slate-500">{formatDate(invoice.created_at)}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/invoices/edit?id=${invoice.id}`)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        View / edit
                        <ArrowRight size={14} />
                      </button>
                      <div
                        className="relative"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenMenuInvoiceId((current) => (current === invoice.id ? null : invoice.id ?? null))}
                          disabled={!invoice.id || activePdfAction?.invoiceId === invoice.id}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="More actions"
                          aria-expanded={openMenuInvoiceId === invoice.id}
                        >
                          {activePdfAction?.invoiceId === invoice.id ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <MoreHorizontal size={14} />
                          )}
                        </button>

                        {openMenuInvoiceId === invoice.id && (
                          <div className="absolute right-0 top-10 z-20 min-w-[190px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuInvoiceId(null);
                                void handlePreviewPdf(invoice.id ?? '');
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Eye size={14} />
                              Preview PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuInvoiceId(null);
                                void handleDownloadPdf(invoice.id ?? '');
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Download size={14} />
                              Download PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuInvoiceId(null);
                                void handlePrintPdf(invoice.id ?? '');
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Printer size={14} />
                              Print
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuInvoiceId(null);
                                void handleEmailPdf(invoice.id ?? '');
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Mail size={14} />
                              Email
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
