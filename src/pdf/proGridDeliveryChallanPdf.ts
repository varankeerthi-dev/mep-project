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

type Org = Record<string, unknown>;
type Col = { header: string; key: string; width: number };

export type ProGridDcParams = {
  challan: Record<string, unknown>;
  dcWithItems: { items?: Record<string, unknown>[] };
  organisation: Org;
  columnConfig: Col[];
  tableData: Record<string, unknown>[];
  formatChallanDate: (iso: string | null | undefined) => string;
  orientation?: 'portrait' | 'landscape';
  pageFormat?: 'a4' | 'letter';
};

export function generateProGridDeliveryChallanPdf(params: ProGridDcParams): jsPDF {
  const { challan, dcWithItems, organisation, columnConfig, tableData, formatChallanDate, orientation = 'portrait', pageFormat = 'a4' } =
    params;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageFormat === 'letter' ? 'letter' : 'a4',
  });
  drawProDoubleFrame(doc);

  let y = renderProOrgBanner(doc, organisation, { documentTitle: 'Delivery Challan', themeHex: organisation.theme_color as string });

  const shipAddr = [
    challan.ship_to_address_line1,
    challan.ship_to_address_line2,
    challan.ship_to_city,
    challan.ship_to_state,
    challan.ship_to_pincode,
  ]
    .filter(Boolean)
    .join(', ');

  y = appendLabelValueGrid(
    doc,
    y,
    [
      ['DC No.', String(challan.dc_number || '—'), 'DC Date', formatChallanDate(challan.dc_date as string)],
      ['Client', String(challan.client_name || '—'), 'Site / Bill address', String(challan.site_address || '—')],
      ['Vehicle No.', String(challan.vehicle_number || '—'), 'Driver', String(challan.driver_name || '—')],
      ['E-Way Bill', String(challan.eway_bill_no || '—'), 'Remarks', String(challan.remarks || '—')],
    ],
    { title: 'Challan details' },
  );

  y = appendSectionHeading(doc, y, 'Consignee / ship to');
  y = appendLabelValueGrid(doc, y, [
    ['Ship to — Name', String(challan.ship_to_name || challan.client_name || '—'), 'GSTIN (ship to)', String(challan.ship_to_gstin || '—')],
    ['Ship to — Address', shipAddr || '—', 'PO reference', String(challan.po_no || '—')],
  ]);

  const head = [columnConfig.map((c) => c.header)];
  const body = tableData.map((row) =>
    columnConfig.map((col) => {
      const val = row[col.key];
      if (col.key === 'rate' || col.key === 'amount') {
        return typeof val === 'number' ? `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : String(val ?? '—');
      }
      if (col.key === 'qty' || col.key === 'discount' || col.key === 'tax') {
        return typeof val === 'number' ? String(val) : String(val ?? '—');
      }
      return val == null ? '—' : String(val);
    }),
  );

  autoTable(doc, {
    startY: y,
    margin: { left: PRO_MARGIN_MM, right: PRO_MARGIN_MM },
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: PRO_GRID_HEAD_FILL, textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: PRO_GRID_LINE },
    columnStyles: columnConfig.reduce<Record<number, { cellWidth: number }>>((acc, col, idx) => {
      acc[idx] = { cellWidth: col.width };
      return acc;
    }, {}),
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  const items = dcWithItems.items || [];
  const totalQty = items.reduce((s, it) => s + (parseFloat(String(it.quantity)) || 0), 0);
  const totalAmount = items.reduce((s, it) => s + (parseFloat(String(it.amount)) || 0), 0);

  y = appendSectionHeading(doc, y, 'Totals');
  y = appendLabelValueGrid(doc, y, [
    ['Total quantity', totalQty.toLocaleString('en-IN', { maximumFractionDigits: 3 }), 'Total amount', `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
  ]);

  y = appendSectionHeading(doc, y, 'Signatures');
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Prepared by (company)', PRO_MARGIN_MM + 25, y + 10, { align: 'center' });
  doc.text('Received by (consignee)', pageWidth - PRO_MARGIN_MM - 25, y + 10, { align: 'center' });
  doc.line(PRO_MARGIN_MM, y + 14, PRO_MARGIN_MM + 50, y + 14);
  doc.line(pageWidth - PRO_MARGIN_MM - 50, y + 14, pageWidth - PRO_MARGIN_MM, y + 14);

  appendProFooterNote(doc, 'Delivery challan — computer generated.');
  return doc;
}
