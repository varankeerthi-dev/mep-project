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
import { numberToInrWords } from './numberToWords';

type Org = Record<string, unknown>;
type TemplateSettings = Record<string, unknown> | null;

export interface SalesOrderPdfItem {
  description: string;
  hsn_code?: string | null;
  qty: number;
  uom?: string | null;
  rate: number;
  discount_percent?: number | null;
  tax_percent?: number | null;
  line_total?: number | null;
}

export interface SalesOrderPdfData {
  sales_order_no: string;
  order_date?: string | null;
  delivery_date?: string | null;
  client_po_number?: string | null;
  client_po_date?: string | null;
  quotation_no?: string | null;
  payment_terms?: string | null;
  remarks?: string | null;
  client_name?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  gstin?: string | null;
  state?: string | null;
  project_name?: string | null;
  subtotal: number;
  discount_total: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  grand_total: number;
  is_inter_state: boolean;
  terms?: string | null;
  signatory_name?: string | null;
  signatory_url?: string | null;
  items: SalesOrderPdfItem[];
}

/**
 * Sales Order print document (A4) in the pro-grid family style.
 * Mirrors proGridQuotationPdf structure; SO stores only subtotal / tax /
 * grand, so discount and taxable are derived (never re-stored).
 */
export function generateProGridSalesOrderPdf(data: SalesOrderPdfData, organisation: Org, _templateSettings?: TemplateSettings): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawProDoubleFrame(doc);

  const themeHex = (organisation.theme_color as string) || '#0f172a';
  let y = renderProOrgBanner(doc, organisation, {
    documentTitle: 'Sales Order',
    themeHex,
  });

  y = appendLabelValueGrid(
    doc,
    y,
    [
      ['SO No.', String(data.sales_order_no || '-'), 'Order Date', String(data.order_date || '-')],
      ['Client PO', String(data.client_po_number || '-'), 'PO Date', String(data.client_po_date || '-')],
      ['Delivery Date', String(data.delivery_date || '-'), 'Quotation Ref', String(data.quotation_no || '-')],
      ['Payment Terms', String(data.payment_terms || '-'), 'Remarks', String(data.remarks || '-')],
    ],
    { title: 'Document details' },
  );

  y = appendSectionHeading(doc, y, 'Bill to / Ship to');
  y = appendLabelValueGrid(doc, y, [
    ['Bill to - Name', String(data.client_name || '-'), 'Ship to - Name', String(data.client_name || '-')],
    ['Bill to - Address', String(data.billing_address || '-'), 'Ship to - Address', String(data.shipping_address || data.billing_address || '-')],
    ['Buyer GSTIN', String(data.gstin || '-'), 'Ship to GSTIN', String(data.gstin || '-')],
    ['State', String(data.state || '-'), 'Project / Site', String(data.project_name || '-')],
  ]);

  let lineNo = 0;
  autoTable(doc, {
    startY: y,
    margin: { left: PRO_MARGIN_MM, right: PRO_MARGIN_MM },
    head: [['#', 'HSN/SAC', 'Description', 'Qty', 'Unit', 'Rate', 'Disc %', 'GST %', 'Amount']],
    body: data.items.map((item) => {
      lineNo += 1;
      const qty = Number(item.qty ?? 0);
      const rate = Number(item.rate ?? 0);
      const disc = Number(item.discount_percent ?? 0);
      const net = qty * rate * (1 - disc / 100);
      const amount = Number(item.line_total ?? net);
      return [
        String(lineNo),
        String(item.hsn_code || '-'),
        String(item.description || '-'),
        String(qty),
        String(item.uom || '-'),
        fmt(rate),
        `${disc}%`,
        `${Number(item.tax_percent ?? 0)}%`,
        fmt(amount),
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
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 'auto' },
      3: { halign: 'right', cellWidth: 13 },
      4: { halign: 'center', cellWidth: 13 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 13 },
      7: { halign: 'center', cellWidth: 13 },
      8: { halign: 'right', cellWidth: 22 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  const rgb = hexToRgb(themeHex);
  doc.setDrawColor(...PRO_GRID_LINE);

  y = appendSectionHeading(doc, y, 'Summary');
  const taxRows: string[][] = data.is_inter_state
    ? [
        ['Taxable value', fmt(data.taxable), 'IGST', fmt(data.igst)],
        ['Discount', fmt(data.discount_total), 'Net payable', fmt(data.grand_total)],
      ]
    : [
        ['Taxable value', fmt(data.taxable), 'CGST', fmt(data.cgst)],
        ['SGST', fmt(data.sgst), 'Discount', fmt(data.discount_total)],
        ['Net payable', fmt(data.grand_total), '-', '-'],
      ];
  y = appendLabelValueGrid(doc, y, taxRows);

  y = appendSectionHeading(doc, y, 'Amount in words');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const words = doc.splitTextToSize(`INR ${numberToInrWords(Number(data.grand_total || 0))} Only`, doc.internal.pageSize.getWidth() - 2 * PRO_MARGIN_MM);
  doc.text(words, PRO_MARGIN_MM, y + 2);
  y += words.length * 4 + 6;

  y = appendSectionHeading(doc, y, 'Authorised signatory');
  const pageWidth = doc.internal.pageSize.getWidth();
  const signX = pageWidth - PRO_MARGIN_MM - 55;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.text(`For ${String((organisation as Record<string, unknown>).name || '')}`, signX, y, { align: 'center' });
  if (data.signatory_url) {
    try {
      doc.addImage(data.signatory_url, 'PNG', signX - 10, y + 1, 24, 8);
    } catch {
      /* ignore */
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(String(data.signatory_name || 'Authorised Signatory'), signX, y + 12, { align: 'center' });

  if (data.terms) {
    y += 30;
    y = appendSectionHeading(doc, y, 'Terms & Conditions');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const termsLines = doc.splitTextToSize(String(data.terms), doc.internal.pageSize.getWidth() - 2 * PRO_MARGIN_MM);
    doc.text(termsLines, PRO_MARGIN_MM, y + 2);
    y += termsLines.length * 4 + 3;
  }

  appendProFooterNote(doc, 'Computer-generated document. Valid subject to terms printed overleaf where applicable.');
  return doc;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
