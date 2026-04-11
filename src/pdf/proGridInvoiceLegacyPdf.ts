import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PRO_MARGIN_MM,
  appendLabelValueGrid,
  appendProFooterNote,
  appendSectionHeading,
  drawProDoubleFrame,
  hexToRgb,
  PRO_GRID_HEAD_FILL,
  PRO_GRID_LINE,
  renderProOrgBanner,
} from './proGridLayout';

type Org = Record<string, unknown>;

/** Same payload shape as {@link generateInvoiceA4} */
export function generateProGridInvoiceLegacyPdf(data: Record<string, unknown>, organisation: Org): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawProDoubleFrame(doc);

  const themeHex = (organisation.theme_color as string) || '#0f172a';
  let y = renderProOrgBanner(doc, organisation, {
    documentTitle: 'Tax Invoice',
    themeHex,
  });

  y = appendLabelValueGrid(
    doc,
    y,
    [
      ['Invoice No.', String(data.invoice_no || '—'), 'Invoice date', String(data.invoice_date || '—')],
      ['PO No.', String(data.po_no || '—'), 'PO Date', String(data.po_date || '—')],
      ['Due date', String(data.due_date || '—'), 'Payment terms', String(data.payment_terms || '—')],
    ],
    { title: 'Document details' },
  );

  const buyer = (data.buyer as Record<string, string>) || {};
  const consignee = (data.consignee as Record<string, string>) || {};
  y = appendSectionHeading(doc, y, 'Buyer / Consignee');
  y = appendLabelValueGrid(doc, y, [
    ['Bill to — Name', String(buyer.name || '—'), 'Ship to — Name', String(consignee.name || '—')],
    ['Bill to — Address', String(buyer.address || '—'), 'Ship to — Address', String(consignee.address || '—')],
    ['Bill to — GSTIN', String(buyer.gstin || '—'), 'Ship to — GSTIN', String(consignee.gstin || '—')],
    ['Bill to — State', `${buyer.state || '—'} (${buyer.state_code || '—'})`, 'Ship to — State', `${consignee.state || '—'} (${consignee.state_code || '—'})`],
    ['Bill to — Mobile', String(buyer.mobile || '—'), 'Ship to — Mobile', String(consignee.mobile || '—')],
  ]);

  const transport = (data.transport as Record<string, string>) || {};
  y = appendSectionHeading(doc, y, 'Dispatch / logistics');
  y = appendLabelValueGrid(doc, y, [
    ['Transporter', String(transport.transporter || '—'), 'Vehicle No.', String(transport.vehicle_no || '—')],
    ['Destination', String(transport.destination || '—'), 'E-Way Bill', String(transport.eway_bill || '—')],
  ]);

  const items = (data.items as Record<string, unknown>[]) || [];
  autoTable(doc, {
    startY: y,
    margin: { left: PRO_MARGIN_MM, right: PRO_MARGIN_MM },
    head: [['SI', 'HSN/SAC', 'Description', 'Qty', 'Unit', 'Rate', 'Per', 'Disc %', 'GST %', 'Amount']],
    body: items.map((item, index) => [
      String(index + 1),
      String(item.hsn_sac || '—'),
      String(item.description || '—'),
      String(item.qty ?? '0'),
      String(item.unit || '—'),
      String(item.rate ?? '0'),
      String(item.per || '—'),
      String(item.disc_percent ?? '0'),
      String(item.gst_percent ?? '0'),
      String(item.amount ?? '0'),
    ]),
    theme: 'grid',
    headStyles: { fillColor: PRO_GRID_HEAD_FILL, textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: PRO_GRID_LINE },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
  const totals = (data.totals as Record<string, number>) || {};
  y = appendSectionHeading(doc, y, 'Totals');
  const igst = Number(totals.igst || 0);
  const summaryRows: string[][] =
    igst > 0
      ? [
          ['Total Qty', String(totals.qty ?? 0), 'Taxable value', String(totals.taxable_value ?? 0)],
          ['IGST', String(igst), 'Round off', String(totals.round_off ?? 0)],
          ['Invoice value', String(totals.invoice_value ?? 0), '—', '—'],
        ]
      : [
          ['Total Qty', String(totals.qty ?? 0), 'Taxable value', String(totals.taxable_value ?? 0)],
          ['CGST', String(totals.cgst ?? 0), 'SGST', String(totals.sgst ?? 0)],
          ['Round off', String(totals.round_off ?? 0), 'Invoice value', String(totals.invoice_value ?? 0)],
        ];
  y = appendLabelValueGrid(doc, y, summaryRows);

  y = appendSectionHeading(doc, y, 'Amount in words');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const words = doc.splitTextToSize(
    `INR ${String(totals.amount_words || '—')}`,
    doc.internal.pageSize.getWidth() - 2 * PRO_MARGIN_MM,
  );
  doc.text(words, PRO_MARGIN_MM, y + 2);
  y += words.length * 4 + 6;

  const taxSummary = (data.tax_summary as Record<string, unknown>[]) || [];
  if (taxSummary.length) {
    y = appendSectionHeading(doc, y, 'Tax summary (HSN)');
    autoTable(doc, {
      startY: y,
      margin: { left: PRO_MARGIN_MM, right: PRO_MARGIN_MM },
      head: [['HSN/SAC', 'Taxable', 'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt', 'Total tax']],
      body: taxSummary.map((row) => [
        String(row.hsn_sac || '—'),
        String(row.taxable_value ?? 0),
        String(row.cgst_rate ?? '0%'),
        String(row.cgst_amount ?? 0),
        String(row.sgst_rate ?? '0%'),
        String(row.sgst_amount ?? 0),
        String(row.total_tax ?? 0),
      ]),
      theme: 'grid',
      styles: { fontSize: 7, lineColor: PRO_GRID_LINE },
      headStyles: { fillColor: PRO_GRID_HEAD_FILL, fontStyle: 'bold' },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  const bank = (data.bank_details as Record<string, string>) || {};
  y = appendSectionHeading(doc, y, 'Bank details');
  y = appendLabelValueGrid(doc, y, [
    ['Account name', String(bank.acc_name || '—'), 'Bank', String(bank.bank_name || '—')],
    ['Account no.', String(bank.acc_no || '—'), 'IFSC / Branch', `${bank.ifsc || '—'} / ${bank.branch || '—'}`],
  ]);

  const terms = (data.terms_conditions as string[]) || [];
  if (terms.length) {
    y = appendSectionHeading(doc, y, 'Terms & conditions');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    terms.slice(0, 8).forEach((t, i) => {
      doc.text(`${i + 1}. ${t}`, PRO_MARGIN_MM, y + i * 3.5);
    });
    y += Math.min(terms.length, 8) * 3.5 + 4;
  }

  const rgb = hexToRgb(themeHex);
  const pageWidth = doc.internal.pageSize.getWidth();
  const signX = pageWidth - PRO_MARGIN_MM - 50;
  doc.setFontSize(9);
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.text(`For ${String(organisation.name || '')}`, signX, y + 4, { align: 'center' });
  const sig = (data.authorized_signatory as Record<string, string>) || {};
  if (sig.url) {
    try {
      doc.addImage(sig.url, 'PNG', signX - 10, y + 6, 32, 12);
    } catch {
      /* ignore */
    }
  }
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(String(sig.name || 'Authorised Signatory'), signX, y + 24, { align: 'center' });

  appendProFooterNote(
    doc,
    `Computer-generated invoice. ${String(organisation.jurisdiction || 'Subject to local jurisdiction.')}`,
  );
  return doc;
}
