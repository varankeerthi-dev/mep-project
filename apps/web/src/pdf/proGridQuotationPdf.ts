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
  renderProWatermark,
} from './proGridLayout';
import { parseTermsIntoLines } from '../utils/termsHelper';

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
  const cs = (templateSettings as { column_settings?: { optional?: Record<string, boolean>; labels?: Record<string, string> } })?.column_settings;
  const opt = cs?.optional ?? {};
  const lbl = cs?.labels ?? {};
  const showCol = (key: string, dflt: boolean) => (opt[key] === undefined ? dflt : opt[key] !== false);
  const showField = (key: string) => opt[key] !== false;
  const ts = templateSettings as { show_logo?: boolean; show_bank_details?: boolean; show_terms?: boolean; show_signature?: boolean };
  const showBank = ts?.show_bank_details !== false;
  const showSignature = ts?.show_signature !== false;
  const showTerms = ts?.show_terms !== false;

  let y = renderProOrgBanner(doc, organisation, {
    documentTitle,
    themeHex,
  });

  const rawDocNo = data.quotation_no || data.invoice_no || '—';
  const docNo = (data.quotation_no && data.revision_no && Number(data.revision_no) > 1)
    ? `${data.quotation_no} (Rev ${String(data.revision_no).padStart(2, '0')})`
    : String(rawDocNo);
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

  const docRows: string[][] = [
    [hl.document_no, docNo, hl.document_date, docDate],
  ];
  if (showField('po_no')) {
    docRows.push([hl.po_no, String(data.po_no || '—'), hl.po_date, String(data.po_date || '—')]);
  }
  {
    const left: string[] = [];
    const right: string[] = [];
    if (showField('valid_till')) left.push(hl.valid_till, String(data.valid_till || '—'));
    if (showField('payment_terms')) right.push(hl.payment, String(data.payment_terms || '—'));
    if (showField('reference')) left.push('Reference', String(data.reference || '—'));
    if (left.length > 0 || right.length > 0) {
      while (left.length < 2) left.push('', '');
      while (right.length < 2) right.push('', '');
      docRows.push([...left, ...right]);
    }
  }
  {
    const remarkShown = String(data.remarks || data.reference || '');
    if (remarkShown && remarkShown !== '—') docRows.push([hl.remarks, remarkShown, '', '']);
  }
  y = appendLabelValueGrid(doc, y, docRows, { title: 'Document details' });

  const client = (data.client as Record<string, string>) || {};
  const billAddr = String(data.billing_address || '');
  const shipAddr = String(data.shipping_address || data.billing_address || '');
  const showBill = showField('bill_to');
  const showShip = showField('ship_to');
  if (showBill || showShip) {
    y = appendSectionHeading(doc, y, 'Bill to / Ship to');
    const addrRows: string[][] = [];
    if (showBill && showShip) {
      addrRows.push(
        ['Bill to — Name', String(client.client_name || '—'), 'Ship to — Name', String(client.client_name || '—')],
        ['Bill to — Address', billAddr || '—', 'Ship to — Address', shipAddr || '—'],
        ['Buyer GSTIN', String(data.gstin || '—'), 'Ship to GSTIN', String(data.ship_to_gstin || data.gstin || '—')],
        ['State', String(data.state || '—'), 'Project / Site', String(data.project || '—')],
      );
    } else if (showBill) {
      addrRows.push(
        ['Bill to — Name', String(client.client_name || '—'), '', ''],
        ['Bill to — Address', billAddr || '—', '', ''],
        ['Buyer GSTIN', String(data.gstin || '—'), '', ''],
        ['State', String(data.state || '—'), '', ''],
      );
    } else {
      addrRows.push(
        ['Ship to — Name', String(client.client_name || '—'), '', ''],
        ['Ship to — Address', shipAddr || '—', '', ''],
        ['Ship to GSTIN', String(data.ship_to_gstin || data.gstin || '—'), '', ''],
        ['Project / Site', String(data.project || '—'), '', ''],
      );
    }
    y = appendLabelValueGrid(doc, y, addrRows);
  }

  const isInterState =
    data.state &&
    organisation.state &&
    String(data.state).trim().toLowerCase() !== String(organisation.state).trim().toLowerCase();

  const items = (data.items as Record<string, unknown>[]) || [];
  let lineNo = 0;
  const money = (v: unknown) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(Number(v || 0));
  interface GridCol { header: string; width?: number; halign?: 'left' | 'center' | 'right'; cell: (item: Record<string, unknown>) => string; }
  const itemObj = (item: Record<string, unknown>, key: string) => (item.item as Record<string, string> | undefined)?.[key];
  const gridCols: GridCol[] = [
    ...(showCol('sno', true) ? [{ header: '#', width: 8, halign: 'center' as const, cell: () => String(lineNo) }] : []),
    ...(showCol('hsn_code', true) ? [{ header: 'HSN/SAC', width: 22, halign: 'center' as const, cell: (item: Record<string, unknown>) => String(item.section === 'erection' ? (item.sac_code || '—') : (itemObj(item, 'hsn_code') || item.hsn_code || '—')) }] : []),
    ...(showCol('item', true) ? [{ header: 'Description', halign: 'left' as const, cell: (item: Record<string, unknown>) => String(item.description || itemObj(item, 'name') || '—') }] : []),
    ...(showCol('variant', false) ? [{ header: lbl.variant || 'Variant', width: 20, halign: 'left' as const, cell: (item: Record<string, unknown>) => String((item.variant as Record<string, string> | undefined)?.variant_name || item.variant_name || '—') }] : []),
    ...(showCol('make', false) ? [{ header: lbl.make || 'Make', width: 20, halign: 'left' as const, cell: (item: Record<string, unknown>) => String(item.make || itemObj(item, 'make') || '—') }] : []),
    ...(showCol('item_code', false) ? [{ header: lbl.item_code || 'Code', width: 20, halign: 'center' as const, cell: (item: Record<string, unknown>) => String(itemObj(item, 'item_code') || item.item_code || '—') }] : []),
    ...(showCol('description', false) ? [{ header: lbl.description || 'Spec', width: 30, halign: 'left' as const, cell: (item: Record<string, unknown>) => String(item.description || '—') }] : []),
    ...(showCol('custom1', false) ? [{ header: lbl.custom1 || 'Custom 1', width: 20, halign: 'left' as const, cell: (item: Record<string, unknown>) => String(item.custom1 || '—') }] : []),
    ...(showCol('custom2', false) ? [{ header: lbl.custom2 || 'Custom 2', width: 20, halign: 'left' as const, cell: (item: Record<string, unknown>) => String(item.custom2 || '—') }] : []),
    ...(showCol('qty', true) ? [{ header: 'Qty', width: 14, halign: 'right' as const, cell: (item: Record<string, unknown>) => String(item.qty ?? '0') }] : []),
    ...(showCol('uom', true) ? [{ header: 'Unit', width: 14, halign: 'center' as const, cell: (item: Record<string, unknown>) => String(item.uom || '—') }] : []),
    ...(showCol('rate', true) ? [{ header: 'Rate', width: 22, halign: 'right' as const, cell: (item: Record<string, unknown>) => money(item.rate) }] : []),
    ...(showCol('discount_percent', false) ? [{ header: 'Disc%', width: 14, halign: 'right' as const, cell: (item: Record<string, unknown>) => item.discount_percent ? `${item.discount_percent}%` : '—' }] : []),
    ...(showCol('tax_percent', true) ? [{ header: 'GST %', width: 14, halign: 'center' as const, cell: (item: Record<string, unknown>) => `${item.tax_percent ?? 0}%` }] : []),
    ...(showCol('line_total', true) ? [{ header: 'Amount', width: 24, halign: 'right' as const, cell: (item: Record<string, unknown>) => money(item.line_total) }] : []),
  ];
  const gridColStyles: Record<number, any> = {};
  gridCols.forEach((c, i) => { gridColStyles[i] = { ...(c.width ? { cellWidth: c.width } : { cellWidth: 'auto' }), halign: c.halign }; });
  autoTable(doc, {
    startY: y,
    margin: { left: PRO_MARGIN_MM, right: PRO_MARGIN_MM },
    head: [gridCols.map(c => c.header)],
    body: items.map((item) => {
      if (item.is_header) {
        return [{ content: String(item.description || ''), colSpan: gridCols.length, styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }];
      }
      lineNo += 1;
      return gridCols.map(c => c.cell(item));
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
    columnStyles: gridColStyles,
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  const rgb = hexToRgb(themeHex);
  doc.setDrawColor(...PRO_GRID_LINE);

  const subtotal = Number(data.subtotal ?? 0);
  const totalTax = Number(data.total_tax ?? 0);
  const roundOff = Number(data.round_off ?? 0);
  const grandTotal = Number(data.grand_total ?? 0);

  y = appendSectionHeading(doc, y, 'Summary');
  const showSubtotal = showField('subtotal');
  const showTax = showField('total_tax');
  const showRound = showField('round_off');
  const showGrand = showField('grand_total');
  const taxRows: string[][] = isInterState
    ? [
        ...(showSubtotal ? [['Taxable value', fmt(subtotal), 'IGST', showTax ? fmt(totalTax) : '']] : []),
        ...((showRound || showGrand) ? [['Round off', showRound ? fmt(roundOff) : '', 'Net payable', showGrand ? fmt(grandTotal) : '']] : []),
      ]
    : [
        ...(showSubtotal || showTax ? [['Taxable value', showSubtotal ? fmt(subtotal) : '', 'CGST', showTax ? fmt(totalTax / 2) : '']] : []),
        ...((showTax || showRound) ? [['SGST', showTax ? fmt(totalTax / 2) : '', 'Round off', showRound ? fmt(roundOff) : '']] : []),
        ...(showGrand ? [['Net payable', fmt(grandTotal), '—', '—']] : []),
      ];
  if (taxRows.length > 0) {
    y = appendLabelValueGrid(doc, y, taxRows);
  }

  y = appendSectionHeading(doc, y, 'Amount in words');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const words = doc.splitTextToSize(`INR ${String(data.amount_words || 'Zero')} Only`, doc.internal.pageSize.getWidth() - 2 * PRO_MARGIN_MM);
  doc.text(words, PRO_MARGIN_MM, y + 2);
  y += words.length * 4 + 6;

  const bank = (data.bank_details as Record<string, string>) || {};
  const sign = (data.authorized_signatory as Record<string, string>) || {};
  if (showBank) {
    y = appendSectionHeading(doc, y, 'Bank details');
    y = appendLabelValueGrid(doc, y, [
      ['Bank', String(bank.bank_name || '—'), 'Account no.', String(bank.acc_no || '—')],
      ['IFSC', String(bank.ifsc || '—'), 'Branch', String(bank.branch || '—')],
    ]);
  }

  if (showSignature) {
    y = appendSectionHeading(doc, y, 'Authorised signatory');
    const pageWidth = doc.internal.pageSize.getWidth();
    const signX = pageWidth - PRO_MARGIN_MM - 55;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(`For ${String(organisation.name || '')}`, signX, y, { align: 'center' });
    if (sign.url) {
      try {
        doc.addImage(sign.url, 'PNG', signX - 10, y + 1, 24, 8);
      } catch {
        /* ignore */
      }
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(String(sign.name || 'Authorised Signatory'), signX, y + 12, { align: 'center' });
    y += 14;
  }

  // Add Terms & Conditions section if available
  if (showTerms && data.terms_conditions) {
    const termsLines = parseTermsIntoLines(data.terms_conditions);
    if (termsLines.length > 0) {
      y += 10; // Space before terms section
      y = appendSectionHeading(doc, y, 'Terms & Conditions');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);

      termsLines.forEach((line) => {
        const itemLines = doc.splitTextToSize(line, doc.internal.pageSize.getWidth() - 2 * PRO_MARGIN_MM);
        doc.text(itemLines, PRO_MARGIN_MM, y + 2);
        y += itemLines.length * 4 + 1;
      });
      y += 2;
    }
  }

  appendProFooterNote(doc, 'Computer-generated document. Valid subject to terms printed overleaf where applicable.');

  const statusStr = String(data.status || data.approval_status || '').trim().toLowerCase();
  const isPendingApproval = statusStr.includes('pending') || statusStr === 'draft';
  if (isPendingApproval) {
    renderProWatermark(doc, 'PENDING APPROVAL');
  }

  return doc;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
