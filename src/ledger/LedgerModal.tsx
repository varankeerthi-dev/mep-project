import { useMemo } from 'react';
import { Download, FilePenLine, Printer, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { LedgerClient } from './api';
import type { LedgerSummaryRow } from './utils';
import { buildLedgerStatementRows, formatCurrency, formatDisplayDate } from './utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organisation: Record<string, unknown> | null;
  client: LedgerClient | null;
  summary: LedgerSummaryRow | null;
  rangeLabel: string;
  onEditLedger: (clientId: string) => void;
};

function getOrganisationLine(organisation: Record<string, unknown> | null) {
  const address = [organisation?.address, organisation?.city, organisation?.state]
    .filter(Boolean)
    .join(', ');

  return {
    name: String(organisation?.name ?? 'Organisation'),
    gstin: String(organisation?.gstin ?? organisation?.gst_number ?? '-'),
    address: address || String(organisation?.email ?? '-'),
  };
}

function createPrintDocument(title: string, html: string) {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
  if (!popup) {
    throw new Error('Unable to open print preview window.');
  }

  popup.document.open();
  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; }
          .sheet { max-width: 900px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 18px; padding: 24px; }
          .meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
          .panel h2 { margin: 0 0 8px; font-size: 16px; }
          .panel p { margin: 0; font-size: 12px; line-height: 1.6; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px 12px; font-size: 12px; text-align: left; }
          th { background: #f8fafc; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; color: #64748b; }
          .num { text-align: right; }
          .totals { width: 320px; margin-left: auto; margin-top: 18px; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
          .totals-row.total { font-weight: 700; font-size: 14px; color: #0f172a; border-bottom: 0; padding-top: 12px; }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

function downloadLedgerPdf(
  organisation: ReturnType<typeof getOrganisationLine>,
  client: LedgerClient,
  rows: ReturnType<typeof buildLedgerStatementRows>,
  summary: LedgerSummaryRow,
  rangeLabel: string,
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const netBalance = summary.outstanding;
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);

  doc.setFontSize(18);
  doc.text('Ledger Statement', 40, 44);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Range: ${rangeLabel}`, 40, 62);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text(organisation.name, 40, 92);
  doc.setFontSize(10);
  doc.text(`GSTIN: ${organisation.gstin}`, 40, 108);
  doc.text(organisation.address, 40, 124);

  doc.setFontSize(12);
  doc.text(client.name, 330, 92);
  doc.setFontSize(10);
  doc.text(`GSTIN: ${client.gstin || '-'}`, 330, 108);
  doc.text(`State: ${client.state || '-'}`, 330, 124);

  autoTable(doc, {
    startY: 152,
    head: [['Date', 'Type', 'Remarks', 'Debit Amount', 'Credit Amount']],
    body: rows.map((row) => [
      formatDisplayDate(row.date),
      row.type,
      row.remarks,
      row.debit ? formatCurrency(row.debit) : '-',
      row.credit ? formatCurrency(row.credit) : '-',
    ]),
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 6,
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [100, 116, 139],
      fontSize: 8,
    },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 152;
  doc.setFontSize(10);
  doc.text(`Total Debits: ${formatCurrency(totalDebit)}`, 350, finalY + 24);
  doc.text(`Total Credits: ${formatCurrency(totalCredit)}`, 350, finalY + 40);
  doc.setFontSize(12);
  doc.text(`Net Balance: ${formatCurrency(netBalance)}`, 350, finalY + 62);

  doc.save(`ledger-${client.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

export default function LedgerModal({
  open,
  onOpenChange,
  organisation,
  client,
  summary,
  rangeLabel,
  onEditLedger,
}: Props) {
  const orgDetails = useMemo(() => getOrganisationLine(organisation), [organisation]);
  const rows = useMemo(
    () => buildLedgerStatementRows(summary?.invoices ?? [], summary?.receipts ?? []),
    [summary],
  );

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const netBalance = Number(((summary?.outstanding ?? 0)).toFixed(2));

  const printHtml = useMemo(() => {
    if (!client || !summary) return '';

    const bodyRows = rows
      .map(
        (row) => `
          <tr>
            <td>${formatDisplayDate(row.date)}</td>
            <td>${row.type}</td>
            <td>${row.remarks}</td>
            <td class="num">${row.debit ? formatCurrency(row.debit) : '-'}</td>
            <td class="num">${row.credit ? formatCurrency(row.credit) : '-'}</td>
          </tr>
        `,
      )
      .join('');

    return `
      <div class="sheet">
        <div class="meta">
          <div class="panel">
            <h2>${orgDetails.name}</h2>
            <p>GSTIN: ${orgDetails.gstin}</p>
            <p>${orgDetails.address}</p>
          </div>
          <div class="panel">
            <h2>${client.name}</h2>
            <p>GSTIN: ${client.gstin || '-'}</p>
            <p>State: ${client.state || '-'}</p>
            <p>Range: ${rangeLabel}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Remarks</th>
              <th class="num">Debit Amount</th>
              <th class="num">Credit Amount</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
        <div class="totals">
          <div class="totals-row"><span>Total Debits</span><strong>${formatCurrency(totalDebit)}</strong></div>
          <div class="totals-row"><span>Total Credits</span><strong>${formatCurrency(totalCredit)}</strong></div>
          <div class="totals-row total"><span>Net Balance</span><strong>${formatCurrency(netBalance)}</strong></div>
        </div>
      </div>
    `;
  }, [client, netBalance, orgDetails, rangeLabel, rows, summary, totalCredit, totalDebit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[1100px] overflow-hidden rounded-[28px] border border-slate-200 p-0 shadow-[0_24px_64px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <DialogHeader className="mb-0 space-y-1">
            <DialogTitle className="text-[20px] font-semibold tracking-tight text-slate-950">
              Ledger Statement
            </DialogTitle>
            <DialogDescription className="text-[13px] text-slate-500">
              {client?.name ?? 'Client'} • {rangeLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => client && summary && downloadLedgerPdf(orgDetails, client, rows, summary, rangeLabel)}
              disabled={!client || !summary}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} />
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => printHtml && createPrintDocument(`${client?.name || 'ledger'}-statement`, printHtml)}
              disabled={!printHtml}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              type="button"
              onClick={() => client && onEditLedger(client.id)}
              disabled={!client}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FilePenLine size={14} />
              Edit Ledger
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-88px)] overflow-auto bg-slate-50/70 px-6 py-6">
          <div className="mx-auto flex max-w-[960px] flex-col gap-5 rounded-[24px] border border-slate-200 bg-white p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Company</div>
                <div className="mt-3 text-[18px] font-semibold tracking-tight text-slate-950">{orgDetails.name}</div>
                <div className="mt-2 text-[13px] leading-6 text-slate-500">GSTIN: {orgDetails.gstin}</div>
                <div className="text-[13px] leading-6 text-slate-500">{orgDetails.address}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Client</div>
                <div className="mt-3 text-[18px] font-semibold tracking-tight text-slate-950">{client?.name ?? '-'}</div>
                <div className="mt-2 text-[13px] leading-6 text-slate-500">GSTIN: {client?.gstin || '-'}</div>
                <div className="text-[13px] leading-6 text-slate-500">State: {client?.state || '-'}</div>
                <div className="text-[13px] leading-6 text-slate-500">Statement Period: {rangeLabel}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[20px] border border-slate-200">
              <table className="min-w-full table-fixed">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3 text-right">Debit Amount</th>
                    <th className="px-4 py-3 text-right">Credit Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-[13px] text-slate-500">
                        No ledger entries in this date range.
                      </td>
                    </tr>
                  )}

                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 text-[13px] text-slate-700">
                      <td className="px-4 py-3">{formatDisplayDate(row.date)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            row.type === 'Debit'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.remarks}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {row.debit ? formatCurrency(row.debit) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {row.credit ? formatCurrency(row.credit) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto grid w-full max-w-[340px] gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-[13px] text-slate-600">
                <span>Total Debits</span>
                <strong className="text-slate-900">{formatCurrency(totalDebit)}</strong>
              </div>
              <div className="flex items-center justify-between text-[13px] text-slate-600">
                <span>Total Credits</span>
                <strong className="text-slate-900">{formatCurrency(totalCredit)}</strong>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 text-[15px] font-semibold text-slate-950">
                <span>Net Balance</span>
                <span>{formatCurrency(netBalance)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
