import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PRO_MARGIN_MM,
  appendLabelValueGrid,
  appendProFooterNote,
  appendSectionHeading,
  drawProDoubleFrame,
  PRO_GRID_HEAD_FILL,
  PRO_GRID_LINE,
  renderProOrgBanner,
} from './proGridLayout';

export type ProGridAdjustmentNoteKind = 'Debit Note' | 'Credit Note';

export type ProGridAdjustmentNoteInput = {
  kind: ProGridAdjustmentNoteKind;
  document_no: string;
  document_date: string;
  reference_no?: string;
  reference_date?: string;
  /** Customer or vendor display name */
  party_name: string;
  party_gstin?: string;
  party_address?: string;
  reason?: string;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_amount: number;
  amount_in_words?: string;
  items?: { description: string; qty?: number; rate?: number; amount?: number; hsn?: string }[];
  organisation: Record<string, unknown>;
};

function fmt(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Debit / credit note — grid layout (print-ready when wired from UI). */
export function generateProGridAdjustmentNotePdf(input: ProGridAdjustmentNoteInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  drawProDoubleFrame(doc);

  const { organisation, kind } = input;
  let y = renderProOrgBanner(doc, organisation, {
    documentTitle: kind,
    themeHex: (organisation.theme_color as string) || '#0f172a',
  });

  y = appendLabelValueGrid(
    doc,
    y,
    [
      ['Document No.', input.document_no, 'Date', input.document_date],
      ['Reference', input.reference_no || '—', 'Ref. date', input.reference_date || '—'],
    ],
    { title: 'Document details' },
  );

  y = appendSectionHeading(doc, y, 'Party');
  y = appendLabelValueGrid(doc, y, [
    ['Name', input.party_name, 'GSTIN', input.party_gstin || '—'],
    ['Address', input.party_address || '—', 'Reason', input.reason || '—'],
  ]);

  const lineItems = input.items || [];
  if (lineItems.length) {
    y = appendSectionHeading(doc, y, 'Line items');
    autoTable(doc, {
      startY: y,
      margin: { left: PRO_MARGIN_MM, right: PRO_MARGIN_MM },
      head: [['#', 'HSN', 'Description', 'Qty', 'Rate', 'Amount']],
      body: lineItems.map((row, i) => [
        String(i + 1),
        row.hsn || '—',
        row.description,
        row.qty != null ? String(row.qty) : '—',
        fmt(row.rate),
        fmt(row.amount),
      ]),
      theme: 'grid',
      headStyles: { fillColor: PRO_GRID_HEAD_FILL, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, lineColor: PRO_GRID_LINE },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  y = appendSectionHeading(doc, y, 'Tax summary');
  const igst = Number(input.igst_amount || 0);
  const rows: string[][] =
    igst > 0
      ? [
          ['Taxable amount', fmt(input.taxable_amount), 'IGST', fmt(igst)],
          ['Total', fmt(input.total_amount), '—', '—'],
        ]
      : [
          ['Taxable amount', fmt(input.taxable_amount), 'CGST', fmt(input.cgst_amount)],
          ['SGST', fmt(input.sgst_amount), 'Total', fmt(input.total_amount)],
        ];
  y = appendLabelValueGrid(doc, y, rows);

  y = appendSectionHeading(doc, y, 'Amount in words');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const w = doc.splitTextToSize(`INR ${input.amount_in_words || '—'}`, doc.internal.pageSize.getWidth() - 2 * PRO_MARGIN_MM);
  doc.text(w, PRO_MARGIN_MM, y + 2);

  appendProFooterNote(doc, `${kind} — computer generated.`);
  return doc;
}
