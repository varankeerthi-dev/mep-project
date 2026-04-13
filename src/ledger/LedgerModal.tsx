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
  onManageDetails: (clientId: string) => void;
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

  // Header area
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(250, 248, 245);
  doc.roundedRect(28, 26, 539, 770, 12, 12, 'S');

  doc.setFontSize(20);
  doc.setTextColor(26, 35, 58);
  doc.text('Ledger Statement', 44, 56);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 120);
  doc.text(`Period: ${rangeLabel}`, 44, 72);

  // Org card
  doc.setTextColor(26, 35, 58);
  doc.setFillColor(250, 248, 245);
  doc.roundedRect(40, 92, 235, 70, 8, 8, 'F');
  doc.setFontSize(11);
  doc.text(organisation.name, 52, 110);
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 100);
  doc.text(`GSTIN: ${organisation.gstin}`, 52, 124);
  doc.text(organisation.address, 52, 138, { maxWidth: 205 });

  // Client card
  doc.setTextColor(26, 35, 58);
  doc.setFillColor(250, 248, 245);
  doc.roundedRect(292, 92, 235, 70, 8, 8, 'F');
  doc.setFontSize(11);
  doc.text(client.name, 304, 110);
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 100);
  doc.text(`GSTIN: ${client.gstin || '-'}`, 304, 124);
  doc.text(`State: ${client.state || '-'}`, 304, 138);

  // Table
  autoTable(doc, {
    startY: 180,
    head: [['Date', 'Type', 'Payment Type', 'Remarks', 'Debit Amount', 'Credit Amount']],
    body: rows.map((row) => [
      formatDisplayDate(row.date),
      row.type,
      row.paymentType && row.paymentType !== '-' ? row.paymentType : '-',
      row.remarks,
      row.debit ? formatCurrencyExplicit(row.debit) : '-',
      row.credit ? formatCurrencyExplicit(row.credit) : '-',
    ]),
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 5,
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [250, 248, 245],
      textColor: [80, 80, 100],
      fontSize: 7,
      fontStyle: 'bold',
    },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
  });

  // Summary box
  const finalY = (doc as any).lastAutoTable?.finalY ?? 180;
  const summaryY = finalY + 16;
  doc.setFillColor(250, 248, 245);
  doc.roundedRect(342, summaryY, 186, 78, 8, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 120);
  doc.text('Total Debits', 354, summaryY + 18);
  doc.text('Total Credits', 354, summaryY + 36);
  doc.setFontSize(9);
  doc.setTextColor(26, 35, 58);
  doc.text(formatCurrencyExplicit(totalDebit), 516, summaryY + 18, { align: 'right' });
  doc.text(formatCurrencyExplicit(totalCredit), 516, summaryY + 36, { align: 'right' });
  doc.setDrawColor(226, 232, 240);
  doc.line(354, summaryY + 48, 516, summaryY + 48);
  doc.setFontSize(10);
  doc.text('Net Balance', 354, summaryY + 66);
  doc.text(formatCurrencyExplicit(netBalance), 516, summaryY + 66, { align: 'right' });

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
  onManageDetails,
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        
        .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .font-body { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
        
        .bg-cream-50 { background-color: oklch(0.97 0.01 85); }
        .bg-cream-100 { background-color: oklch(0.94 0.02 85); }
        .bg-navy-950 { background-color: oklch(0.18 0.03 260); }
        .bg-navy-900 { background-color: oklch(0.25 0.04 260); }
        .bg-navy-800 { background-color: oklch(0.32 0.05 260); }
        .text-navy-950 { color: oklch(0.18 0.03 260); }
        .text-navy-900 { color: oklch(0.25 0.04 260); }
        .text-navy-600 { color: oklch(0.45 0.06 260); }
        .text-navy-500 { color: oklch(0.55 0.06 260); }
        .border-navy-200 { border-color: oklch(0.85 0.04 260); }
        .border-navy-100 { border-color: oklch(0.91 0.03 260); }
      `}</style>

      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden rounded-2xl border border-navy-100 bg-white p-0 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-100 px-6 py-5">
          <DialogHeader className="mb-0 space-y-1">
            <DialogTitle className="font-display text-xl font-semibold tracking-tight text-navy-950">
              Ledger Statement
            </DialogTitle>
            <DialogDescription className="font-body text-sm text-navy-500">
              {client?.name ?? 'Client'} • {rangeLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => client && summary && downloadLedgerPdf(orgDetails, client, rows, summary, rangeLabel)}
              disabled={!client || !summary}
              className="font-body inline-flex items-center gap-2 rounded-lg border border-navy-200 px-3 py-2 text-xs font-semibold text-navy-700 transition hover:bg-cream-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={14} />
              PDF
            </button>
            <button
              type="button"
              onClick={() => client && summary && printLedgerPdf(orgDetails, client, rows, summary, rangeLabel)}
              disabled={!client || !summary}
              className="font-body inline-flex items-center gap-2 rounded-lg border border-navy-200 px-3 py-2 text-xs font-semibold text-navy-700 transition hover:bg-cream-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              type="button"
              onClick={() => {
                if (client) {
                  onManageDetails(client.id);
                  onOpenChange(false);
                }
              }}
              disabled={!client}
              className="font-body inline-flex items-center gap-2 rounded-lg bg-navy-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FilePenLine size={14} />
              Manage Details
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="font-body inline-flex h-9 w-9 items-center justify-center rounded-lg border border-navy-200 text-navy-600 transition hover:bg-cream-50"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-88px)] overflow-auto bg-cream-50 px-6 py-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-5 rounded-xl border border-navy-100 bg-white p-6">
            {/* Info Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-navy-100 bg-cream-50 p-4">
                <span className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">Company</span>
                <div className="font-display mt-2 text-lg font-semibold tracking-tight text-navy-950">{orgDetails.name}</div>
                <div className="font-body mt-1 text-sm text-navy-600">GSTIN: {orgDetails.gstin}</div>
                <div className="font-body text-sm text-navy-600">{orgDetails.address}</div>
              </div>

              <div className="rounded-lg border border-navy-100 bg-cream-50 p-4">
                <span className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">Client</span>
                <div className="font-display mt-2 text-lg font-semibold tracking-tight text-navy-950">{client?.name ?? '-'}</div>
                <div className="font-body mt-1 text-sm text-navy-600">GSTIN: {client?.gstin || '-'}</div>
                <div className="font-body text-sm text-navy-600">State: {client?.state || '-'}</div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-lg border border-navy-100">
              <table className="w-full">
                <thead>
                  <tr className="bg-cream-100 font-body text-left text-xs font-semibold uppercase tracking-[0.15em] text-navy-600">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Payment Type</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3 text-right">Debit</th>
                    <th className="px-4 py-3 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <span className="font-body text-sm text-navy-500">No ledger entries in this date range.</span>
                      </td>
                    </tr>
                  )}

                  {rows.map((row) => (
                    <tr key={row.id} className="font-body border-t border-navy-100 text-sm text-navy-700 transition hover:bg-cream-50">
                      <td className="px-4 py-3">{formatDisplayDate(row.date)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-body inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            row.type === 'Debit'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-navy-600">{row.paymentType && row.paymentType !== '-' ? row.paymentType : '-'}</td>
                      <td className="px-4 py-3">{row.remarks}</td>
                      <td className="px-4 py-3 text-right font-display font-medium text-navy-950">
                        {row.debit ? formatCurrency(row.debit) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-display font-medium text-navy-950">
                        {row.credit ? formatCurrency(row.credit) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="ml-auto w-full max-w-xs rounded-lg border border-navy-100 bg-cream-50 p-4">
              <div className="flex items-center justify-between font-body text-sm text-navy-600">
                <span>Total Debits</span>
                <strong className="font-display text-navy-950">{formatCurrency(totalDebit)}</strong>
              </div>
              <div className="flex items-center justify-between font-body text-sm text-navy-600">
                <span>Total Credits</span>
                <strong className="font-display text-navy-950">{formatCurrency(totalCredit)}</strong>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-navy-200 pt-2 font-display text-base font-semibold text-navy-950">
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
