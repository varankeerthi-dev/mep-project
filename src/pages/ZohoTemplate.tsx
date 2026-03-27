import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Zoho Style Template
 * Features:
 * - Clean, modern, professional layout
 * - Minimalist lines, light gray accents
 * - Dynamic columns based on user settings
 * - Dynamic labels based on user choice
 */
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

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 12;
  const contentWidth = pageWidth - (2 * margin);
  
  const docNo = quotation_no || invoice_no || dc_number || '-';
  const docDate = date || '-';
  
  // Logic for Document Title
  let documentTitle = 'DOCUMENT';
  if (quotation_no) documentTitle = 'Quotation';
  else if (invoice_no) documentTitle = 'Invoice';
  else if (dc_number) documentTitle = 'Delivery Challan';

  const themeColor = organisation.theme_color || '#2563eb';
  const lightGray = [245, 245, 245];

  // Dynamic header labels from settings
  const headerLabels = templateSettings?.column_settings?.header_labels || {
    document_no: documentTitle + ' No:',
    document_date: documentTitle + ' Date:',
    po_no: 'PO No:',
    po_date: 'PO Date:',
    remarks: 'Remarks:',
    eway_bill: 'E-Way bill:'
  };

  // Optional Column logic
  const colSettings = templateSettings?.column_settings?.optional || {
    sno: true,
    hsn_code: true,
    item: true,
    qty: true,
    rate: true,
    line_total: true
  };
  const labels = templateSettings?.column_settings?.labels || {};

  let currentY = margin;

  // --- 1. HEADER (Logo & Title) ---
  if (organisation.logo_url) {
    try {
      doc.addImage(organisation.logo_url, 'PNG', margin, currentY, 25, 25);
    } catch (e) {}
  }

  // Company Name & Details
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(organisation.name || '', margin + 28, currentY + 5);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  const orgAddressLines = doc.splitTextToSize(organisation.address || '', 80);
  doc.text(orgAddressLines, margin + 28, currentY + 10);
  
  let orgInfoY = currentY + 10 + (orgAddressLines.length * 3.5);
  doc.text(`GSTIN: ${organisation.gstin || '-'}`, margin + 28, orgInfoY + 2);
  doc.text(`Phone: ${organisation.phone || '-'}`, margin + 28, orgInfoY + 5);
  doc.text(`Email: ${organisation.email || '-'}`, margin + 28, orgInfoY + 8);

  // Large Document Title on Right
  doc.setFontSize(24);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(documentTitle, pageWidth - margin, currentY + 10, { align: 'right' });

  currentY = Math.max(currentY + 30, orgInfoY + 15);

  // --- 2. DOCUMENT INFO ---
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  
  // Left Side Doc Info
  doc.text(headerLabels.document_no || 'Quote No:', margin, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(String(docNo), margin + 35, currentY);
  
  doc.setFont('helvetica', 'normal');
  doc.text(headerLabels.document_date || 'Quote Date:', margin, currentY + 5);
  doc.text(String(docDate), margin + 35, currentY + 5);

  currentY += 12;

  // --- 3. BILL TO / SHIP TO ---
  // Gray headers
  doc.setFillColor(245, 247, 250);
  doc.rect(margin, currentY, contentWidth / 2 - 2, 6, 'F');
  doc.rect(pageWidth / 2 + 2, currentY, contentWidth / 2 - 2, 6, 'F');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80);
  doc.text('Bill To', margin + 2, currentY + 4);
  doc.text('Ship To', pageWidth / 2 + 4, currentY + 4);
  
  currentY += 8;
  
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(client?.client_name || '', margin, currentY + 2);
  doc.text(client?.client_name || '', pageWidth / 2 + 2, currentY + 2);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  const billAddressLines = doc.splitTextToSize(billing_address || '', contentWidth / 2 - 5);
  const shipAddressLines = doc.splitTextToSize(data.shipping_address || billing_address || '', contentWidth / 2 - 5);
  
  doc.text(billAddressLines, margin, currentY + 7);
  doc.text(shipAddressLines, pageWidth / 2 + 2, currentY + 7);
  
  const addressMaxY = Math.max(
    currentY + 7 + (billAddressLines.length * 3.5),
    currentY + 7 + (shipAddressLines.length * 3.5)
  );
  
  currentY = addressMaxY + 2;
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${gstin || '-'}`, margin, currentY + 2);
  doc.text(`GSTIN: ${data.ship_to_gstin || gstin || '-'}`, pageWidth / 2 + 2, currentY + 2);

  currentY += 10;

  // --- 4. ITEMS TABLE ---
  const tableHeaders = [];
  const columnDataKeys = [];
  
  if (colSettings.sno) { tableHeaders.push('S.No'); columnDataKeys.push('sno'); }
  if (colSettings.item) { tableHeaders.push('Item & Description'); columnDataKeys.push('item'); }
  if (colSettings.hsn_code) { tableHeaders.push('HSN'); columnDataKeys.push('hsn'); }
  if (colSettings.qty) { tableHeaders.push('Qty'); columnDataKeys.push('qty'); }
  if (colSettings.rate) { tableHeaders.push(labels.rate_after_discount || 'Rate'); columnDataKeys.push('rate'); }
  if (colSettings.line_total) { tableHeaders.push('Amount'); columnDataKeys.push('amount'); }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [tableHeaders],
    body: (items || []).map((item: any, index: number) => {
      if (item.is_header) {
        return [{ content: item.description, colSpan: tableHeaders.length, styles: { fontStyle: 'bold', fillColor: [250, 250, 250] } }];
      }
      
      const row = [];
      if (colSettings.sno) row.push(index + 1);
      if (colSettings.item) row.push(`${item.description || item.item?.name || '-'}`);
      if (colSettings.hsn_code) row.push(item.item?.hsn_code || '-');
      if (colSettings.qty) row.push(`${item.qty}\n${item.uom}`);
      if (colSettings.rate) row.push(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.rate || 0));
      if (colSettings.line_total) row.push(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.line_total || 0));
      return row;
    }),
    theme: 'plain',
    headStyles: { 
      fillColor: [50, 50, 50], 
      textColor: [255, 255, 255], 
      fontStyle: 'bold', 
      fontSize: 8,
      halign: 'center'
    },
    styles: { 
      fontSize: 8, 
      cellPadding: 3, 
      textColor: [50, 50, 50],
      lineColor: [220, 220, 220],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' }
    }
  });

  currentY = (doc as any).lastAutoTable?.finalY + 5;

  // --- 5. TOTALS SECTION ---
  const totalsWidth = 70;
  const totalsX = pageWidth - margin - totalsWidth;
  
  const isInterState = state && organisation.state && state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();
  
  const totals = [
    { label: 'Sub Total', value: subtotal },
    { label: isInterState ? 'IGST' : 'SGST', value: isInterState ? total_tax : (total_tax / 2) },
    { label: isInterState ? '' : 'CGST', value: isInterState ? null : (total_tax / 2) },
    { label: 'Rounding', value: round_off },
    { label: 'Total', value: grand_total, isBold: true, isFinal: true }
  ].filter(t => t.label !== '');

  totals.forEach((t, i) => {
    doc.setFontSize(t.isFinal ? 10 : 8);
    doc.setFont('helvetica', t.isBold ? 'bold' : 'normal');
    doc.setTextColor(t.isFinal ? 0 : 80);
    
    doc.text(t.label, totalsX, currentY);
    doc.text(
      (t.isFinal ? 'INR ' : '') + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(t.value || 0), 
      pageWidth - margin, 
      currentY, 
      { align: 'right' }
    );
    currentY += 6;
  });

  // Total In Words
  currentY = (doc as any).lastAutoTable?.finalY + 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text('Total In Words', margin, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`Indian Rupee ${amount_words || 'Zero'} Only`, margin, currentY + 4);

  currentY += 15;

  // --- 6. TERMS & SIGNATURE ---
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80);
  doc.text('Terms & Conditions', margin, currentY);
  doc.setFont('helvetica', 'normal');
  const terms = terms_conditions || "Payment - Purchase Order & 100% Advance\nDelivery - 3-4 days\nFreight - Client scope";
  const termLines = doc.splitTextToSize(terms, 100);
  doc.text(termLines, margin, currentY + 4);

  // Signature Area
  const signX = pageWidth - margin - 60;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`FOR ${organisation.name?.toUpperCase()}`, pageWidth - margin, currentY, { align: 'right' });
  
  if (authorized_signatory?.url) {
    try {
      doc.addImage(authorized_signatory.url, 'PNG', pageWidth - margin - 40, currentY + 2, 35, 12);
    } catch (e) {}
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Authorized Signature', pageWidth - margin, currentY + 25, { align: 'right' });

  // Page Number
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  return doc;
};


