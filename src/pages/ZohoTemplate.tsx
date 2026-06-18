import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateZohoTemplate = (data: any, organisation: any, templateSettings: any = null) => {
  const {
    quotation_no,
    invoice_no,
    dc_number,
    date,
    valid_till,
    payment_terms,
    reference,
    remarks,
    client,
    billing_address,
    gstin,
    state,
    project,
    items,
    subtotal,
    total_tax,
    round_off,
    grand_total,
    bank_details,
    authorized_signatory,
    amount_words,
    po_no,
    po_date,
    eway_bill,
    terms_conditions
  } = data;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth  = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 12; // tighter margin → more row space

  const headerLabels = templateSettings?.column_settings?.header_labels || {
    document_no: 'Quotation No', document_date: 'Quotation Date',
    po_no: 'PO No', po_date: 'PO Date', remarks: 'Remarks', eway_bill: 'E-Way Bill'
  };

  const colSettings = templateSettings?.column_settings?.optional || {
    sno: true, item: true, hsn_code: false, qty: true, rate: true, line_total: true
  };

  const labels = templateSettings?.column_settings?.labels || { rate_after_discount: 'Rate' };

  const columnWidth = (pageWidth - 2 * margin) / 2;

  const accentColorRGB: [number, number, number] = [49, 130, 206];
  const darkText:       [number, number, number] = [30, 30, 30];
  const midGray:        [number, number, number] = [100, 100, 100];

  const docNo        = quotation_no || invoice_no || dc_number || '-';
  const docDate      = date || '-';
  const documentTitle = quotation_no ? 'Quotation'
                      : invoice_no   ? 'Invoice'
                      : dc_number    ? 'Delivery Challan'
                      : 'Document';

  const isInterState =
    state && organisation.state &&
    state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();

  // ─── helpers ────────────────────────────────────────────────────────────────
  const hLine = (y: number) => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageWidth - margin, y);
  };

  const drawPageBorder = () => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(margin - 1, margin - 1, pageWidth - 2 * margin + 2, pageHeight - 2 * margin + 2);
    doc.setLineWidth(0.2);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);
  };

  // ─── draw compact page header (used on page 1 and repeated on subsequent pages) ──
  // Returns the Y position where content below header should start
  const drawPageHeader = (): number => {
    let y = margin;

    // Logo
    if (organisation.logo_url) {
      try { doc.addImage(organisation.logo_url, 'PNG', margin, y, 26, 26); } catch (e) {}
    }

    // Company name + details
    doc.setFontSize(13).setFont('helvetica', 'bold').setTextColor(...darkText);
    doc.text(organisation.name || '', margin + 28, y + 5);

    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...midGray);
    const orgAddr = doc.splitTextToSize(organisation.address || '', 110);
    doc.text(orgAddr, margin + 28, y + 11);
    doc.text(
      `GSTIN: ${organisation.gstin || '-'}   Phone: ${organisation.phone || '-'}   Email: ${organisation.email || '-'}`,
      margin + 28, y + 19
    );

    // Document title + No/Date (right side, left-aligned block)
    doc.setFontSize(22).setFont('helvetica', 'bold').setTextColor(...accentColorRGB);
    doc.text(documentTitle, pageWidth - margin, y + 8, { align: 'right' });

    const hLabelX  = pageWidth - margin - 62;
    const hColonX  = pageWidth - margin - 24;
    const hValueX  = pageWidth - margin - 20;

    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...midGray);
    doc.text(`${documentTitle} No`, hLabelX, y + 16);
    doc.text(':', hColonX, y + 16);
    doc.setFont('helvetica', 'bold').setTextColor(...darkText);
    doc.text(String(docNo), hValueX, y + 16);

    doc.setFont('helvetica', 'normal').setTextColor(...midGray);
    doc.text('Date', hLabelX, y + 22);
    doc.text(':', hColonX, y + 22);
    doc.setFont('helvetica', 'bold').setTextColor(...darkText);
    doc.text(String(docDate), hValueX, y + 22);

    y += 28;
    hLine(y);
    y += 3;

    return y;
  };

  // ─── draw compact sub-header (PO + Bill To / Ship To) ───────────────────────
  // Only drawn on page 1 (before the table)
  const drawSubHeader = (startY: number): number => {
    let y = startY;

    // PO row
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...midGray);
    doc.text(headerLabels.po_no || 'PO No', margin, y);
    doc.text(':', margin + 14, y);
    doc.setFont('helvetica', 'bold').setTextColor(...darkText);
    doc.text(String(po_no || '-'), margin + 17, y);

    doc.setFont('helvetica', 'normal').setTextColor(...midGray);
    doc.text(headerLabels.po_date || 'PO Date', margin + 60, y);
    doc.text(':', margin + 74, y);
    doc.setFont('helvetica', 'bold').setTextColor(...darkText);
    doc.text(String(po_date || '-'), margin + 77, y);

    y += 5;
    hLine(y);
    y += 3;

    // Bill To / Ship To
    const col2X = pageWidth / 2 + 2;

    doc.setFillColor(247, 250, 252);
    doc.rect(margin, y, columnWidth - 2, 6, 'F');
    doc.rect(col2X, y, columnWidth - 2, 6, 'F');

    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(...midGray);
    doc.text('Bill To', margin + 2, y + 3.5);
    doc.text('Ship To', col2X + 2, y + 3.5);
    y += 6;

    // Client name
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...darkText);
    doc.text(client?.client_name || '', margin, y + 2);
    doc.text(client?.client_name || '', col2X, y + 2);

    // Address
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...midGray);
    const billLines = doc.splitTextToSize(billing_address || '', columnWidth - 6);
    const shipLines = doc.splitTextToSize((data as any).shipping_address || billing_address || '', columnWidth - 6);
    doc.text(billLines, margin, y + 6);
    doc.text(shipLines, col2X, y + 6);

    // GSTIN
    const addrH = Math.max(billLines.length, shipLines.length) * 3.5 + 8;
    doc.setFont('helvetica', 'bold').setFontSize(7);
    doc.text(`GSTIN: ${gstin || '-'}`, margin, y + addrH);
    doc.text(`GSTIN: ${(data as any).ship_to_gstin || gstin || '-'}`, col2X, y + addrH);

    // Vertical separator
    doc.setDrawColor(220, 220, 220).setLineWidth(0.3);
    doc.line(pageWidth / 2, y - 1, pageWidth / 2, y + addrH + 3);

    y += addrH + 5;
    hLine(y);
    y += 3;

    return y;
  };

  // ─── draw compact page-2+ mini-header (just company + doc info, no address) ─
  const drawContinuationHeader = (): number => {
    let y = margin;

    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...darkText);
    doc.text(organisation.name || '', margin, y + 4);

    doc.setFontSize(22).setFont('helvetica', 'bold').setTextColor(...accentColorRGB);
    doc.text(documentTitle, pageWidth - margin, y + 6, { align: 'right' });

    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...midGray);
    doc.text(`${documentTitle} No: `, margin, y + 9);
    doc.setFont('helvetica', 'bold').setTextColor(...darkText);
    doc.text(String(docNo), margin + 26, y + 9);

    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...midGray);
    doc.text('(Continued)', pageWidth - margin, y + 12, { align: 'right' });

    y += 14;
    hLine(y);
    y += 3;

    return y;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — draw border + header + sub-header
  // ════════════════════════════════════════════════════════════════════════════
  drawPageBorder();
  let currentY = drawPageHeader();
  currentY = drawSubHeader(currentY);

  // ─── build table columns ────────────────────────────────────────────────────
  const tableHead: string[] = [];
  if (colSettings.sno    !== false) tableHead.push('S.No');
  if (colSettings.hsn_code === true) tableHead.push('HSN/SAC');
  if (colSettings.item   !== false) tableHead.push(labels.item || 'Item & Description');
  if (colSettings.client_part_no === true) tableHead.push(labels.client_part_no || 'Part No');
  if (colSettings.client_description === true) tableHead.push(labels.client_description || 'Client Desc');
  if (colSettings.qty    !== false) tableHead.push(labels.qty || 'Qty / UOM');
  if (colSettings.rate   !== false) tableHead.push(labels.rate_after_discount || 'Rate');
  if (colSettings.line_total !== false) tableHead.push(labels.line_total || 'Amount');

  // ─── ITEMS TABLE ────────────────────────────────────────────────────────────
  // didDrawPage: reprint border + mini-header on every new page
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [tableHead],
    body: (items || []).map((item: any, idx: number) => {
      const mapping = item.client_item_mappings?.[0];
      const row: any[] = [];
      if (colSettings.sno    !== false) row.push(String(idx + 1));
      if (colSettings.hsn_code === true) row.push(item.item?.hsn_code || '-');
      if (colSettings.item   !== false)
        row.push(mapping?.client_description || item.description || item.item?.name || '-');
      if (colSettings.client_part_no === true) row.push(mapping?.client_part_no || '-');
      if (colSettings.client_description === true) row.push(mapping?.client_description || '-');
      if (colSettings.qty    !== false) row.push(`${item.qty}\n${item.uom}`);
      if (colSettings.rate   !== false)
        row.push(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.rate || 0));
      if (colSettings.line_total !== false)
        row.push(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.line_total || 0));
      return row;
    }),
    theme: 'grid',
    // Compact row sizing — fits ~22–25 rows on a page
    headStyles: {
      fillColor: accentColorRGB,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.5,
      halign: 'center',
      minCellHeight: 7
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [50, 50, 50],
      lineColor: [220, 220, 220],
      lineWidth: 0.25,
      minCellHeight: 6
    },
    columnStyles: {
      0: { cellWidth: 10,  halign: 'center' }, // S.No
      1: { cellWidth: 18,  halign: 'center' }, // HSN  (index shifts if hsn off)
      2: { halign: 'left'                    }, // Description (flex)
      3: { cellWidth: 20,  halign: 'center' }, // Qty/UOM
      4: { cellWidth: 26,  halign: 'right'  }, // Rate
      5: { cellWidth: 30,  halign: 'right'  }  // Amount
    },
    // ── Reprint border + mini-header on every new page ──────────────────────
    didDrawPage: (hookData: any) => {
      drawPageBorder();
      if (hookData.pageNumber > 1) {
        const newStartY = drawContinuationHeader();
        // Push table body down so it doesn't overlap the mini-header
        // jspdf-autotable respects pageBreakRow margin via didDrawPage
        (doc as any).__continuationHeaderY = newStartY;
      }
    },
    // Keep table body below the continuation header on page 2+
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    // startY on subsequent pages = bottom of continuation header
    // We use didAddPage to update margin dynamically
  });

  // ─── Footer section — always on the LAST page, pinned to bottom ─────────────
  const lastTableY = (doc as any).lastAutoTable?.finalY ?? currentY;
  const lastPage   = doc.internal.getNumberOfPages();
  doc.setPage(lastPage);

  // Estimate footer height
  const totals = [
    { label: 'Sub Total',                                     value: subtotal },
    { label: isInterState ? 'IGST'  : 'SGST',
      value: isInterState ? total_tax : total_tax / 2         },
    ...(isInterState ? [] : [
      { label: 'CGST', value: total_tax / 2 }
    ]),
    { label: 'Rounding',                                      value: round_off },
    { label: 'Total', value: grand_total, isBold: true, isFinal: true }
  ];

  const tncText   = terms_conditions ||
    'Payment - Purchase Order & 100% Advance\nDelivery - 3-4 days\nFreight - Client scope';
  const tncLines  = doc.splitTextToSize(tncText, 85);
  const tncHeight = tncLines.length * 3.8 + 8;

  const footerHeight =
      4               // hline gap after table
    + 5               // label "Total Amount In Words"
    + 6               // words line(s) (estimate 1 line)
    + 8               // gap
    + 4               // hline
    + tncHeight       // T&C
    + 28              // signature
    + 8;              // bottom breathing room

  const availableSpace = pageHeight - lastTableY - margin;

  // If footer fits below table → natural position; else pin to bottom
  currentY = availableSpace >= footerHeight
    ? lastTableY + 4
    : pageHeight - footerHeight - margin;

  // Ensure we never draw over the table
  if (currentY < lastTableY + 4) currentY = lastTableY + 4;

  hLine(currentY);
  currentY += 4;

  // ── Amount in Words (left) + Totals (right) ──────────────────────────────
  const wordsColWidth = pageWidth / 2 - margin - 6;
  const totalsLabelX  = pageWidth / 2 + 6;
  const totalsValueX  = pageWidth - margin;

  doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...midGray);
  doc.text('Total Amount In Words', margin, currentY);

  const amountText  = `Indian Rupee ${amount_words || 'Zero'} Only`;
  const amountLines = doc.splitTextToSize(amountText, wordsColWidth);
  doc.setFont('helvetica', 'bold').setTextColor(...darkText).setFontSize(8);
  doc.text(amountLines, margin, currentY + 4);

  // Totals column
  const totalsStartY = currentY;
  let totalsY = totalsStartY;
  totals.forEach(t => {
    const fs = (t as any).isFinal ? 9.5 : 8;
    doc.setFontSize(fs)
       .setFont('helvetica', (t as any).isBold ? 'bold' : 'normal')
       .setTextColor(...darkText);
    doc.text(t.label, totalsLabelX, totalsY);
    doc.text(
      ((t as any).isFinal ? 'INR ' : '') +
        new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(t.value || 0),
      totalsValueX, totalsY, { align: 'right' }
    );
    totalsY += 6.5;
  });

  const wordsH = 4 + amountLines.length * 4.5;
  currentY += Math.max(wordsH, totalsY - totalsStartY) + 5;

  // ── Terms & Signature ─────────────────────────────────────────────────────
  hLine(currentY);
  currentY += 4;

  // Two-column: T&C left, signature right
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...darkText);
  doc.text('Terms & Conditions', margin, currentY);

  doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...midGray);
  doc.text(tncLines, margin, currentY + 5);

  // Signature block
  const sigX = pageWidth - margin - 55;
  doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...darkText);
  doc.text(`FOR ${(organisation.name || '').toUpperCase()}`, pageWidth - margin, currentY, { align: 'right' });

  if (authorized_signatory?.url) {
    try {
      doc.addImage(authorized_signatory.url, 'PNG', pageWidth - margin - 38, currentY + 4, 32, 10);
    } catch (e) {}
  }

  doc.setDrawColor(180, 180, 180).setLineWidth(0.3);
  doc.line(sigX, currentY + 22, pageWidth - margin, currentY + 22);

  doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...midGray);
  doc.text('Authorized Signatory', pageWidth - margin, currentY + 26, { align: 'right' });

  // ── Page numbers on every page ────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7).setTextColor(180, 180, 180);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 4, { align: 'center' });
  }

  return doc;
};
