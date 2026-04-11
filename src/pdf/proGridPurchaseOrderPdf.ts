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
import type { PurchaseOrderData } from '../modules/Purchase/utils/purchasePdfTypes';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', minimumFractionDigits: 2 }).format(amount);
}

function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n);
}

/** Purchase order — label/value grids + line grid */
export function generateProGridPurchaseOrderPdf(data: PurchaseOrderData): Blob {
  const doc = new jsPDF('p', 'mm', 'a4');
  drawProDoubleFrame(doc);

  const organisation: Record<string, unknown> = {
    name: data.company_name,
    address: data.company_address,
    gstin: data.company_gstin,
    phone: data.company_phone,
    logo_url: data.company_logo,
    theme_color: '#0f172a',
  };

  let y = renderProOrgBanner(doc, organisation, { documentTitle: 'Purchase Order', themeHex: '#0f172a' });

  y = appendLabelValueGrid(
    doc,
    y,
    [
      ['PO No.', data.po_number, 'PO Date', data.po_date],
      ['Currency', data.currency, 'Exchange rate', data.currency !== 'INR' ? String(data.exchange_rate) : '1.0000'],
    ],
    { title: 'Order details' },
  );

  y = appendSectionHeading(doc, y, 'Vendor / delivery');
  y = appendLabelValueGrid(doc, y, [
    ['Vendor', data.vendor_name, 'GSTIN', data.vendor_gstin],
    ['Vendor address', data.vendor_address, 'Contact', data.vendor_contact],
    ['Deliver to', data.delivery_location, 'Terms', data.terms],
  ]);

  const tableData = data.items.map((item) => ({
    sr: item.sr,
    description: item.description,
    hsn: item.hsn_code || '—',
    qty: `${item.quantity} ${item.unit}`,
    rate: formatCurrency(item.rate, data.currency),
    gst: `${item.cgst_percent + item.sgst_percent}%`,
    amount: formatCurrency(item.total_amount, data.currency),
  }));

  autoTable(doc, {
    startY: y,
    margin: { left: PRO_MARGIN_MM, right: PRO_MARGIN_MM },
    head: [['Sr', 'Description', 'HSN', 'Qty', 'Rate', 'GST%', 'Amount']],
    body: tableData.map((row) => [row.sr, row.description, row.hsn, row.qty, row.rate, row.gst, row.amount]),
    theme: 'grid',
    headStyles: { fillColor: PRO_GRID_HEAD_FILL, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2, lineColor: PRO_GRID_LINE },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'right', cellWidth: 28 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  const totalsData: string[][] = [
    ['Subtotal', formatCurrency(data.subtotal, data.currency), 'Discount', formatCurrency(data.discount_amount, data.currency)],
    ['Taxable value', formatCurrency(data.taxable_amount, data.currency), 'CGST', formatCurrency(data.cgst_amount, data.currency)],
  ];
  if (data.igst_amount > 0) {
    totalsData.push(['IGST', formatCurrency(data.igst_amount, data.currency), 'Grand total', formatCurrency(data.total_amount, data.currency)]);
  } else {
    totalsData.push(['SGST', formatCurrency(data.sgst_amount, data.currency), 'Grand total', formatCurrency(data.total_amount, data.currency)]);
  }
  if (data.currency !== 'INR') {
    totalsData.push(['INR equivalent', `₹${formatIndianNumber(data.total_amount_inr)}`, '—', '—']);
  }

  y = appendSectionHeading(doc, y, 'Value summary');
  y = appendLabelValueGrid(doc, y, totalsData);

  y = appendSectionHeading(doc, y, 'Notes');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const notes = doc.splitTextToSize(data.notes || 'Payment and quality terms as per agreed contract.', doc.internal.pageSize.getWidth() - 2 * PRO_MARGIN_MM);
  doc.text(notes, PRO_MARGIN_MM, y + 2);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const fy = Math.max(y + notes.length * 4 + 8, pageHeight - 32);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorised signatory', pageWidth - PRO_MARGIN_MM - 40, fy, { align: 'center' });
  doc.line(pageWidth - PRO_MARGIN_MM - 62, fy + 8, pageWidth - PRO_MARGIN_MM - 8, fy + 8);

  appendProFooterNote(doc, 'Purchase order — computer generated.');
  return doc.output('blob');
}
