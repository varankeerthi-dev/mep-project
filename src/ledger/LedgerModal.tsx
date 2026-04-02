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
import { buildLedgerStatementRows, formatCurrency, formatCurrencyExplicit, formatDisplayDate } from './utils';

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

function buildLedgerPdfDoc(
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

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(28, 26, 539, 770, 18, 18, 'S');

  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Ledger Statement', 44, 54);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Statement Period: ${rangeLabel}`, 44, 70);

  doc.setTextColor(15, 23, 42);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(40, 88, 240, 74, 12, 12, 'F');
  doc.roundedRect(287, 88, 240, 74, 12, 12, 'F');
  doc.setFontSize(12);
  doc.text(organisation.name, 52, 108);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`GSTIN: ${organisation.gstin}`, 52, 124);
  doc.text(organisation.address, 52, 140, { maxWidth: 210 });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text(client.name, 299, 108);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`GSTIN: ${client.gstin || '-'}`, 299, 124);
  doc.text(`State: ${client.state || '-'}`, 299, 140);

  autoTable(doc, {
    startY: 180,
    head: [['Date', 'Type', 'Remarks', 'Debit Amount', 'Credit Amount']],
    body: rows.map((row) => [
      formatDisplayDate(row.date),
      row.type,
      row.remarks,
      row.debit ? formatCurrencyExplicit(row.debit) : '-',
      row.credit ? formatCurrencyExplicit(row.credit) : '-',
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

  const finalY = (doc as any).lastAutoTable?.finalY ?? 180;
  const summaryY = finalY + 18;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(342, summaryY, 186, 82, 12, 12, 'F');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Debits', 354, summaryY + 20);
  doc.text('Total Credits', 354, summaryY + 40);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrencyExplicit(totalDebit), 516, summaryY + 20, { align: 'right' });
  doc.text(formatCurrencyExplicit(totalCredit), 516, summaryY + 40, { align: 'right' });
  doc.setDrawColor(226, 232, 240);
  doc.line(354, summaryY + 52, 516, summaryY + 52);
  doc.setFontSize(11);
  doc.text('Net Balance', 354, summaryY + 70);
  doc.text(formatCurrencyExplicit(netBalance), 516, summaryY + 70, { align: 'right' });

  return doc;
}

function downloadLedgerPdf(
  organisation: ReturnType<typeof getOrganisationLine>,
  client: LedgerClient,
  rows: ReturnType<typeof buildLedgerStatementRows>,
  summary: LedgerSummaryRow,
  rangeLabel: string,
) {
  const doc = buildLedgerPdfDoc(organisation, client, rows, summary, rangeLabel);
  doc.save(`ledger-${client.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

function printLedgerPdf(
  organisation: ReturnType<typeof getOrganisationLine>,
  client: LedgerClient,
  rows: ReturnType<typeof buildLedgerStatementRows>,
  summary: LedgerSummaryRow,
  rangeLabel: string,
) {
  const doc = buildLedgerPdfDoc(organisation, client, rows, summary, rangeLabel);
  const blobUrl = doc.output('bloburl');
  const popup = window.open(blobUrl, '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!popup) {
    throw new Error('Unable to open print preview window.');
  }
  popup.addEventListener('load', () => {
    popup.focus();
    popup.print();
  });
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
              onClick={() => client && summary && printLedgerPdf(orgDetails, client, rows, summary, rangeLabel)}
              disabled={!client || !summary}
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
