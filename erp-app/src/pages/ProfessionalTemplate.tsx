import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Professional Quotation/Invoice Template
 * features:
 * - Highly structured boxed layout
 * - Organization name with theme color
 * - Clear segregation of Billing and Shipping details
 * - Comprehensive tax calculation display (CGST/SGST or IGST)
 * - Bank details and Authorised Signatory section
 */
export const generateProfessionalTemplate = (data, organisation, templateSettings = null) => {
  const {
    quotation_no,
    invoice_no,
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
    eway_bill
  } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  const contentWidth = pageWidth - (2 * margin);
  
  const docNo = quotation_no || invoice_no || '-';
  const docDate = date || '-';
  
  // Dynamic header labels from settings
  const headerLabels = templateSettings?.column_settings?.header_labels || {
    document_no: 'invoice no:',
    document_date: 'invoice date:',
    po_no: 'PO No:',
    po_date: 'PO Data:',
    remarks: 'Remarks:',
    eway_bill: 'E-Way bill:'
  };

  const documentTitle = data.invoice_no ? 'Tax Invoice' : 'Quotation';
  const themeColor = organisation.theme_color || '#2563eb';

  // Helper for drawing boxes/lines
  const drawBox = (x, y, w, h) => doc.rect(x, y, w, h);
  const drawLine = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2);

  let currentY = margin;

  // --- 1. TITLE ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(documentTitle, pageWidth / 2, currentY + 4, { align: 'center' });
  currentY += 7;

  // --- 2. HEADER BLOCK (Logo | Org Details | Doc Info) ---
  const headerHeight = 40;
  drawBox(margin, currentY, contentWidth, headerHeight);

  // Logo Column (approx 30mm)
  const logoWidth = 30;
  if (organisation.logo_url) {
    try {
      doc.addImage(organisation.logo_url, 'PNG', margin + 2, currentY + 2, logoWidth - 4, headerHeight - 4);
    } catch (e) {
      doc.setFontSize(8);
      doc.text('LOGO', margin + logoWidth / 2, currentY + headerHeight / 2, { align: 'center' });
    }
  } else {
    doc.setFontSize(8);
    doc.text('LOGO', margin + logoWidth / 2, currentY + headerHeight / 2, { align: 'center' });
  }
  drawLine(margin + logoWidth, currentY, margin + logoWidth, currentY + headerHeight);

  // Org Details Column (Middle)
  const middleWidth = contentWidth - logoWidth - 60;
  const middleX = margin + logoWidth;
  
  // Org Name with Color
  doc.setTextColor(themeColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(organisation.name || 'Organisation Name', middleX + 2, currentY + 6);
  
  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const addressLines = doc.splitTextToSize(organisation.address || 'Organisation Address', middleWidth - 4);
  doc.text(addressLines, middleX + 2, currentY + 12);

  // GSTIN Row (at the bottom of this cell)
  drawLine(middleX, currentY + headerHeight - 8, middleX + middleWidth, currentY + headerHeight - 8);
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${organisation.gstin || '-'}`, middleX + 2, currentY + headerHeight - 3);

  drawLine(middleX + middleWidth, currentY, middleX + middleWidth, currentY + headerHeight);

  // Doc Info Column (Right)
  const rightX = middleX + middleWidth;
  const fieldYStart = currentY + 4;
  const fieldGap = 4.5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  
  const fields = [
    { label: headerLabels.document_no, value: docNo },
    { label: headerLabels.document_date, value: docDate },
    { label: headerLabels.po_no, value: po_no || '-' },
    { label: headerLabels.po_date, value: po_date || '-' },
    { label: headerLabels.remarks, value: remarks || reference || '-' },
    { label: headerLabels.eway_bill, value: eway_bill || '-' }
  ];

  fields.forEach((f, i) => {
    doc.text(f.label, rightX + 2, fieldYStart + (i * fieldGap));
    doc.setFont('helvetica', 'bold');
    doc.text(String(f.value), rightX + 25, fieldYStart + (i * fieldGap));
    doc.setFont('helvetica', 'normal');
    if (i < fields.length - 1) {
       drawLine(rightX, fieldYStart + (i * fieldGap) + 1.5, pageWidth - margin, fieldYStart + (i * fieldGap) + 1.5);
    }
  });

  currentY += headerHeight;

  // --- 3. PARTY BLOCK (Bill To | Ship To) ---
  const partyHeight = 35;
  drawBox(margin, currentY, contentWidth, partyHeight);
  drawLine(pageWidth / 2, currentY, pageWidth / 2, currentY + partyHeight);

  // Bill To
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', margin + 2, currentY + 5);
  doc.setFont('helvetica', 'normal');
  const billAddressLines = doc.splitTextToSize(`${client?.client_name || ''}\n${billing_address || ''}`, (contentWidth / 2) - 4);
  doc.text(billAddressLines, margin + 2, currentY + 10);

  // Ship To
  doc.setFont('helvetica', 'bold');
  doc.text('Ship To:', (pageWidth / 2) + 2, currentY + 5);
  doc.setFont('helvetica', 'normal');
  const shipAddressLines = doc.splitTextToSize(`${client?.client_name || ''}\n${data.shipping_address || billing_address || ''}`, (contentWidth / 2) - 4);
  doc.text(shipAddressLines, (pageWidth / 2) + 2, currentY + 10);

  currentY += partyHeight;

  // --- 4. GSTIN BLOCK ---
  const gstinHeight = 8;
  drawBox(margin, currentY, contentWidth, gstinHeight);
  drawLine(pageWidth / 2, currentY, pageWidth / 2, currentY + gstinHeight);

  doc.setFont('helvetica', 'bold');
  doc.text(`Buyer GSTIN: ${gstin || '-'}`, margin + 2, currentY + 5);
  doc.text(`Ship to GSTIN: ${data.ship_to_gstin || gstin || '-'}`, (pageWidth / 2) + 2, currentY + 5);

  currentY += gstinHeight;
  
  const colSettings = templateSettings?.column_settings?.optional || {};
  const labels = templateSettings?.column_settings?.labels || {};

  // --- 5. ITEMS TABLE ---
  const isInterState = state && organisation.state && state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();
  
  const tableHeaders = ['S.No'];
  if (colSettings.hsn_code !== false) tableHeaders.push(labels.hsn_code || 'HSN/SAC');
  if (colSettings.item !== false) tableHeaders.push(labels.item || 'Item Description');
  if (colSettings.client_part_no === true) tableHeaders.push(labels.client_part_no || 'Client Part No');
  if (colSettings.client_description === true) tableHeaders.push(labels.client_description || 'Client Description');
  tableHeaders.push(labels.qty || 'Qty');
  tableHeaders.push(labels.uom || 'Unit');
  tableHeaders.push(labels.rate || 'Rate/Unit');
  tableHeaders.push(labels.tax_percent || 'GST %');
  tableHeaders.push(labels.line_total || 'Amount');

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [tableHeaders],
    body: (items || []).map((item, index) => {
      if (item.is_header) {
        return [{ content: item.description, colSpan: tableHeaders.length, styles: { fontStyle: 'bold', fillColor: [245, 245, 245] } }];
      }
      
      const mapping = client?.id && item.item?.mappings?.find((m: any) => m.client_id === client.id);
      const row = [index + 1];
      if (colSettings.hsn_code !== false) row.push(item.sac_code || item.item?.hsn_code || '-');
      if (colSettings.item !== false) row.push(mapping?.client_description || item.description || item.item?.name || '-');
      if (colSettings.client_part_no === true) row.push(mapping?.client_part_no || '-');
      if (colSettings.client_description === true) row.push(mapping?.client_description || '-');
      row.push(item.qty || 0);
      row.push(item.uom || '-');
      row.push(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.rate || 0));
      row.push(`${item.tax_percent || 0}%`);
      row.push(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.line_total || 0));
      
      return row;
    }),
    theme: 'grid',
    headStyles: { 
      fillColor: [255, 255, 255], 
      textColor: [0, 0, 0], 
      fontStyle: 'bold', 
      fontSize: 8, 
      lineWidth: 0.1, 
      lineColor: [0, 0, 0],
      halign: 'center'
    },
    styles: { 
      fontSize: 8, 
      cellPadding: 2, 
      lineWidth: 0.1, 
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      // Other column widths will be handled by autoTable unless specified
    }
  });

  currentY = doc.lastAutoTable.finalY;

  // --- 6. TOTALS & FOOTER ---
  const totalsWidth = 60;
  const totalsX = pageWidth - margin - totalsWidth;
  const totalsRowHeight = 6;
  
  // Totals Grid
  const totalsToDraw = [
    { label: 'Basic Amount', value: subtotal },
    { label: isInterState ? 'IGST' : 'SGST', value: isInterState ? total_tax : (total_tax / 2) },
    { label: isInterState ? '' : 'CGST', value: isInterState ? null : (total_tax / 2) },
    { label: 'Round off', value: round_off },
    { label: 'Net Value', value: grand_total, isBold: true }
  ].filter(t => t.label !== '');

  totalsToDraw.forEach((t, i) => {
    drawBox(totalsX, currentY + (i * totalsRowHeight), totalsWidth, totalsRowHeight);
    doc.setFont('helvetica', t.isBold ? 'bold' : 'normal');
    doc.text(t.label, totalsX + 2, currentY + (i * totalsRowHeight) + 4);
    doc.text(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(t.value || 0), pageWidth - margin - 2, currentY + (i * totalsRowHeight) + 4, { align: 'right' });
  });

  // Amount in Words (Left of totals)
  const wordsHeight = totalsToDraw.length * totalsRowHeight;
  drawBox(margin, currentY, contentWidth - totalsWidth, wordsHeight);
  doc.setFont('helvetica', 'normal');
  doc.text('Amount in words:', margin + 2, currentY + 4);
  doc.setFont('helvetica', 'bold');
  const wordsLines = doc.splitTextToSize(`INR ${amount_words || 'Zero'} Only`, contentWidth - totalsWidth - 4);
  doc.text(wordsLines, margin + 2, currentY + 9);

  currentY += wordsHeight;

  // --- 7. FINAL FOOTER (Bank Details | Signatory) ---
  const footerHeight = 35;
  drawBox(margin, currentY, contentWidth, footerHeight);
  drawLine(margin + 90, currentY, margin + 90, currentY + footerHeight);
  drawLine(margin + 125, currentY, margin + 125, currentY + footerHeight);

  // Bank Details
  doc.setFont('helvetica', 'normal');
  doc.text('Bank Details:', margin + 2, currentY + 5);
  doc.text(`Name: ${bank_details?.bank_name || '-'}`, margin + 2, currentY + 10);
  doc.text(`A/c No: ${bank_details?.acc_no || '-'}`, margin + 2, currentY + 15);
  doc.text(`branch: ${bank_details?.branch || '-'}`, margin + 2, currentY + 20);
  doc.text(`IFSC: ${bank_details?.ifsc || '-'}`, margin + 2, currentY + 25);

  // Middle Spacer Cell (matches the image gap)

  // Signatory
  const signX = margin + 125;
  doc.setFont('helvetica', 'normal');
  doc.text('For Organisations', signX + 30, currentY + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(organisation.name || '', signX + 30, currentY + 10, { align: 'center' });
  
  if (authorized_signatory?.url) {
    try {
      doc.addImage(authorized_signatory.url, 'PNG', signX + 15, currentY + 12, 30, 12);
    } catch (e) {}
  }

  doc.setFont('helvetica', 'normal');
  doc.text('Autorised Signatory', signX + 30, currentY + footerHeight - 5, { align: 'center' });

  return doc;
};


