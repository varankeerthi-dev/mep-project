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
type TemplateSettings = Record<string, unknown> | null;

/**
 * Quotation / pro-forma style document with strict label–value grids (A4).
 * Data shape matches {@link generateProfessionalTemplate} consumers.
 */
export function generateProGridQuotationPdf(data: Record<string, unknown>, organisation: Org, templateSettings?: TemplateSettings): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawProDoubleFrame(doc);

  const documentTitle = data.invoice_no ? 'Tax Invoice' : 'Quotation';
  const themeHex = (organisation.theme_color as string) || '#0f172a';
  const headerLabels =
    (templateSettings as { column_settings?: { header_labels?: Record<string, string> } })?.column_settings?.header_labels || {};

  let y = renderProOrgBanner(doc, organisation, {
    documentTitle,
    themeHex,
  });

  const docNo = String(data.quotation_no || data.invoice_no || '—');
  const docDate = String(data.date || '—');
  const hl = {
    document_no: (headerLabels.document_no as string) || (data.invoice_no ? 'Invoice No.' : 'Quotation No.'),
    document_date: (headerLabels.document_date as string) || 'Date',
    po_no: (headerLabels.po_no as string) || 'PO No.',
    po_date: (headerLabels.po_date as string) || 'PO Date',
    valid_till: 'Valid Till',
    payment: 'Payment Terms',
    remarks: (headerLabels.remarks as string) || 'Remarks',
    eway_bill: (headerLabels.eway_bill as string) || 'E-Way Bill',
  };

  y = appendLabelValueGrid(
    doc,
    y,
    [
      [hl.document_no, docNo, hl.document_date, docDate],
      [hl.po_no, String(data.po_no || '—'), hl.po_date, String(data.po_date || '—')],
      [hl.valid_till, String(data.valid_till || '—'), hl.payment, String(data.payment_terms || '—')],
      [hl.remarks, String(data.remarks || data.reference || '—'), hl.eway_bill, String(data.eway_bill || '—')],
    ],
    { title: 'Document details' },
  );

  const client = (data.client as Record<string, string>) || {};
  const billAddr = String(data.billing_address || '');
  const shipAddr = String(data.shipping_address || data.billing_address || '');
  y = appendSectionHeading(doc, y, 'Bill to / Ship to');
  y = appendLabelValueGrid(doc, y, [
    ['Bill to — Name', String(client.client_name || '—'), 'Ship to — Name', String(client.client_name || '—')],
    ['Bill to — Address', billAddr || '—', 'Ship to — Address', shipAddr || '—'],
    ['Buyer GSTIN', String(data.gstin || '—'), 'Ship to GSTIN', String(data.ship_to_gstin || data.gstin || '—')],
    ['State', String(data.state || '—'), 'Project / Site', String(data.project || '—')],
  ]);

  const isInterState =
    data.state &&
    organisation.state &&
    String(data.state).trim().toLowerCase() !== String(organisation.state).trim().toLowerCase();

  const items = (data.items as Record<string, unknown>[]) || [];
  let lineNo = 0;
  autoTable(doc, {
    startY: y,
    margin: { left: PRO_MARGIN_MM, right: PRO_MARGIN_MM },
    head: [['#', 'HSN/SAC', 'Description', 'Qty', 'Unit', 'Rate', 'GST %', 'Amount']],
    body: items.map((item) => {
      if (item.is_header) {
        return [{ content: String(item.description || ''), colSpan: 8, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }];
      }
      lineNo += 1;
      const lineTotal = Number(item.line_total ?? 0);
      return [
        String(lineNo),
        String((item.item as Record<string, string>)?.hsn_code || '—'),
        String(item.description || (item.item as Record<string, string>)?.name || '—'),
        String(item.qty ?? '0'),
        String(item.uom || '—'),
        new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(Number(item.rate || 0)),
        `${item.tax_percent ?? 0}%`,
        new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(lineTotal),
      ];
    }),
    theme: 'grid',
    headStyles: {
      fillColor: PRO_GRID_HEAD_FILL,
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: PRO_GRID_LINE,
    },
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: PRO_GRID_LINE },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 'auto' },
      3: { halign: 'right', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'center', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 24 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  const rgb = hexToRgb(themeHex);
  doc.setDrawColor(...PRO_GRID_LINE);

  const subtotal = Number(data.subtotal ?? 0);
  const totalTax = Number(data.total_tax ?? 0);
  const roundOff = Number(data.round_off ?? 0);
  const grandTotal = Number(data.grand_total ?? 0);

  y = appendSectionHeading(doc, y, 'Summary');
  const taxRows: string[][] = isInterState
    ? [
        ['Taxable value', fmt(subtotal), 'IGST', fmt(totalTax)],
        ['Round off', fmt(roundOff), 'Net payable', fmt(grandTotal)],
      ]
    : [
        ['Taxable value', fmt(subtotal), 'CGST', fmt(totalTax / 2)],
        ['SGST', fmt(totalTax / 2), 'Round off', fmt(roundOff)],
        ['Net payable', fmt(grandTotal), '—', '—'],
      ];
  y = appendLabelValueGrid(doc, y, taxRows);

  y = appendSectionHeading(doc, y, 'Amount in words');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const words = doc.splitTextToSize(`INR ${String(data.amount_words || 'Zero')} Only`, doc.internal.pageSize.getWidth() - 2 * PRO_MARGIN_MM);
  doc.text(words, PRO_MARGIN_MM, y + 2);
  y += words.length * 4 + 6;

  const bank = (data.bank_details as Record<string, string>) || {};
  const sign = (data.authorized_signatory as Record<string, string>) || {};
  y = appendSectionHeading(doc, y, 'Bank details');
  y = appendLabelValueGrid(doc, y, [
    ['Bank', String(bank.bank_name || '—'), 'Account no.', String(bank.acc_no || '—')],
    ['IFSC', String(bank.ifsc || '—'), 'Branch', String(bank.branch || '—')],
  ]);

  y = appendSectionHeading(doc, y, 'Authorised signatory');
  const pageWidth = doc.internal.pageSize.getWidth();
  const signX = pageWidth - PRO_MARGIN_MM - 55;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.text(`For ${String(organisation.name || '')}`, signX, y, { align: 'center' });
  if (sign.url) {
    try {
      doc.addImage(sign.url, 'PNG', signX - 12, y + 2, 36, 14);
    } catch {
      /* ignore */
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(String(sign.name || 'Authorised Signatory'), signX, y + 22, { align: 'center' });

  appendProFooterNote(doc, 'Computer-generated document. Valid subject to terms printed overleaf where applicable.');
  return doc;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
