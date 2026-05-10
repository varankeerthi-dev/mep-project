import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateClassicToolsDeliveryChallanTemplate = (data: any, organisation: any, templateSettings: any = null) => {
  // Extract template settings
  const extSettings = templateSettings || {};
  const colSettings = extSettings.column_settings?.optional || {};
  
  const showItemCode = colSettings.item_code === true;
  const showClientPartNo = colSettings.client_part_no === true;
  const showClientDescription = colSettings.client_description === true;
  const showHsn = colSettings.hsn_code !== false; // defaults to true for classic
  const showRate = colSettings.rate !== false;    // default true
  const showDiscount = colSettings.discount_percent === true;
  const showTax = colSettings.tax_percent !== false;
  const showAmount = colSettings.line_total !== false;
  const showItem = colSettings.item !== false;
  
  const showBankDet = extSettings.show_bank_details !== false;
  const showTandC = extSettings.show_terms !== false;
  const showAuthSig = extSettings.show_signature !== false;

  const {
    dc_number,
    reference_id,
    date,
    transaction_type,
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
    terms_conditions,
    prepared_by,
    taken_by,
    received_by,
    from_client,
    to_client,
    remarks,
    source_place, // NEW: Tool source place
    current_location // NEW: Current location of tools
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

  // Colors
  const blackColor = [0, 0, 0];
  const grayColor = [100, 100, 100];
  const lightGray = [240, 240, 240];

  let currentY = margin - 2;

  // ── DOCUMENT TITLE ──
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  const docTitle = 'DELIVERY CHALLAN';
  doc.text(docTitle, pageWidth / 2, currentY + 2, { align: 'center' });
  
  currentY = margin + 2;

  // ── UNIFIED MASTER HEADER GRID ──
  const totalHeight = 48;
  const leftOrgH = 24; 

  // Render outer unified boundary frame
  doc.setDrawColor(...blackColor);
  doc.setLineWidth(0.3);
  doc.rect(margin, currentY, contentWidth, totalHeight); 
  
  // ── RIGHT METADATA DYNAMIC SIZING ──
  const metaVals = [
    { label: 'DC NO.', value: dc_number || reference_id || '-' },
    { label: 'DATE', value: date || '-' },
    { label: 'TRANSACTION TYPE', value: transaction_type || 'ISSUE' },
    { label: 'REMARKS', value: remarks || '-' },
    { label: 'PREP. BY', value: prepared_by || '-' },
    { label: 'TAKEN BY', value: taken_by || '-' },
    { label: 'PO NO.', value: po_no || '-' }
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let maxLabelW = 0;
  metaVals.forEach(m => {
    const w = doc.getTextWidth(m.label);
    if (w > maxLabelW) maxLabelW = w;
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  let maxValW = 0;
  metaVals.forEach(m => {
    const w = doc.getTextWidth(String(m.value));
    if (w > maxValW) maxValW = w;
  });

  // Calculate coordinates dynamically
  const metaLabelW = maxLabelW + 4;
  let metaValW = maxValW + 6;
  if (metaValW > 60) metaValW = 60;
  if (metaValW < 20) metaValW = 20;

  const rightColW = metaLabelW + metaValW;
  const metaDividerX = pageWidth - margin - rightColW;

  // Primary Vertical Dividers
  doc.line(metaDividerX, currentY, metaDividerX, currentY + totalHeight); 
  doc.line(metaDividerX + metaLabelW, currentY, metaDividerX + metaLabelW, currentY + totalHeight);

  // ── 1. LEFT SIDE: ORGANISATION ──
  let textX = margin + 2;
  const logoWidth = 20;
  const logoHeight = 14;
  if (organisation?.logo_url) {
    try {
      doc.addImage(organisation.logo_url, 'PNG', margin + 2, currentY + 4, logoWidth, logoHeight);
      textX = margin + logoWidth + 4; 
    } catch (e) {}
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  doc.text(organisation.name || '', textX, currentY + 7);
  
  doc.setFontSize(8);
  const row2Arr = [];
  if (organisation.gstin) row2Arr.push(`GSTIN: ${organisation.gstin}`);
  const phoneVal = organisation.phone || organisation.mobile;
  if (phoneVal) row2Arr.push(`Ph: ${phoneVal}`);
  if (row2Arr.length > 0) doc.text(row2Arr.join(' | '), textX, currentY + 11.5);
  
  if (organisation.address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...grayColor);
    const addressLines = doc.splitTextToSize(organisation.address, 80);
    addressLines.forEach((line: string, idx: number) => {
      doc.text(line, textX, currentY + 15 + (idx * 3));
    });
  }

  // ── 2. RIGHT SIDE: METADATA VALUES ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  metaVals.forEach((m, i) => {
    const y = currentY + 6 + (i * 6);
    doc.text(m.label, metaDividerX + 2, y);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...blackColor);
  metaVals.forEach((m, i) => {
    const y = currentY + 6 + (i * 6);
    const valueStr = String(m.value);
    const truncated = valueStr.length > 25 ? valueStr.substring(0, 22) + '...' : valueStr;
    doc.text(truncated, metaDividerX + metaLabelW + 2, y);
  });

  currentY += totalHeight + 6;

  // ── CLIENT & TRANSACTION DETAILS ──
  doc.setDrawColor(...blackColor);
  doc.setLineWidth(0.3);
  doc.rect(margin, currentY, contentWidth, 36);
  
  // Left side - Client details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CLIENT DETAILS', margin + 2, currentY + 5);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let clientY = currentY + 10;
  
  if (transaction_type === 'TRANSFER') {
    doc.text(`From: ${from_client || '-'}`, margin + 2, clientY);
    doc.text(`To: ${to_client || '-'}`, margin + 2, clientY + 4);
  } else {
    doc.text(client || '-', margin + 2, clientY);
    if (billing_address) {
      const addressLines = doc.splitTextToSize(billing_address, 80);
      addressLines.forEach((line: string, idx: number) => {
        doc.text(line, margin + 2, clientY + 4 + (idx * 3));
      });
    }
    if (gstin) doc.text(`GSTIN: ${gstin}`, margin + 2, clientY + 12);
  }
  
  // Right side - Additional details
  const rightDetailsX = margin + 85;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ADDITIONAL DETAILS', rightDetailsX, currentY + 5);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Project: ${project || '-'}`, rightDetailsX, currentY + 10);
  doc.text(`State: ${state || '-'}`, rightDetailsX, currentY + 14);
  if (eway_bill) doc.text(`E-Way Bill: ${eway_bill}`, rightDetailsX, currentY + 18);
  if (received_by) doc.text(`Received By: ${received_by}`, rightDetailsX, currentY + 22);
  
  // NEW: Tool Source Place (above table)
  if (source_place || current_location) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TOOL SOURCE:', margin, currentY + 42);
    doc.setFont('helvetica', 'normal');
    doc.text(source_place || current_location || '-', margin, currentY + 46);
  }

  currentY += 42;

  // ── TOOLS TABLE ──
  const tableHeaders = [];
  const tableData = [];
  
  // Build headers based on settings
  if (showItemCode) tableHeaders.push('CODE');
  if (showItem) tableHeaders.push('TOOL NAME');
  if (showClientPartNo) tableHeaders.push('PART NO');
  if (showClientDescription) tableHeaders.push('DESCRIPTION');
  if (showHsn) tableHeaders.push('HSN');
  // Add MAKE column (user-specific, hide/unhide option)
  if (colSettings.make !== false) tableHeaders.push('MAKE');
  tableHeaders.push('QTY');
  if (showRate) tableHeaders.push('RATE');
  if (showDiscount) tableHeaders.push('DISC %');
  if (showTax) tableHeaders.push('TAX %');
  if (showAmount) tableHeaders.push('AMOUNT');

  // Build table data
  items?.forEach((item: any, index: number) => {
    const row = [];
    if (showItemCode) row.push(item.item_code || item.tool_code || '-');
    if (showItem) row.push(item.tool_name || item.item_name || '-');
    if (showClientPartNo) row.push(item.client_part_no || '-');
    if (showClientDescription) row.push(item.description || item.make || '-');
    if (showHsn) row.push(item.hsn_code || '-');
    // Add MAKE column data (user-specific, hide/unhide option)
    if (colSettings.make !== false) row.push(item.make || '-');
    row.push(item.quantity || 0);
    if (showRate) row.push(item.rate ? item.rate.toFixed(2) : '0.00');
    if (showDiscount) row.push(item.discount_percent ? item.discount_percent.toFixed(2) : '0.00');
    if (showTax) row.push(item.cgst_percent + item.sgst_percent || 18);
    if (showAmount) row.push(item.total_amount ? item.total_amount.toFixed(2) : '0.00');
    tableData.push(row);
  });

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: currentY,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: lightGray,
      textColor: blackColor,
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: blackColor,
      lineWidth: 0.1,
    },
    bodyStyles: {
      fontSize: 8,
      lineColor: blackColor,
      lineWidth: 0.1,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { cellWidth: 15 }, // Code
      1: { cellWidth: 35 }, // Tool Name
      2: { cellWidth: 18 }, // Part No
      3: { cellWidth: 25 }, // Description
      4: { cellWidth: 12 }, // HSN
      5: { cellWidth: 15 }, // Make (user-specific)
      6: { cellWidth: 8 },  // Qty
      7: { cellWidth: 15 }, // Rate
      8: { cellWidth: 10 }, // Discount
      9: { cellWidth: 8 },  // Tax
      10: { cellWidth: 16 }, // Amount
    },
    theme: 'grid',
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ── TOTALS SECTION ──
  if (showAmount && (subtotal || total_tax || grand_total)) {
    doc.setDrawColor(...blackColor);
    doc.setLineWidth(0.3);
    doc.rect(margin + 120, currentY, contentWidth - 120, 50);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    let totalY = currentY + 8;
    if (subtotal !== undefined) {
      doc.text('Subtotal:', margin + 122, totalY);
      doc.text(String(subtotal.toFixed(2)), pageWidth - margin - 20, totalY, { align: 'right' });
      totalY += 8;
    }
    
    if (total_tax !== undefined) {
      doc.text('Tax:', margin + 122, totalY);
      doc.text(String(total_tax.toFixed(2)), pageWidth - margin - 20, totalY, { align: 'right' });
      totalY += 8;
    }
    
    if (round_off !== undefined) {
      doc.text('Round Off:', margin + 122, totalY);
      doc.text(String(round_off.toFixed(2)), pageWidth - margin - 20, totalY, { align: 'right' });
      totalY += 8;
    }
    
    if (grand_total !== undefined) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Grand Total:', margin + 122, totalY);
      doc.text(String(grand_total.toFixed(2)), pageWidth - margin - 20, totalY, { align: 'right' });
    }
  }

  // ── TERMS & CONDITIONS ──
  if (showTandC && terms_conditions) {
    currentY += 56;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TERMS & CONDITIONS:', margin, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const termsLines = doc.splitTextToSize(terms_conditions, contentWidth - 4);
    termsLines.forEach((line: string, idx: number) => {
      doc.text(line, margin, currentY + 5 + (idx * 3));
    });
    currentY += 5 + (termsLines.length * 3);
  }

  // ── SIGNATURE SECTION ──
  if (showAuthSig) {
    currentY += 15;
    doc.setDrawColor(...blackColor);
    doc.setLineWidth(0.3);
    
    // Left signature
    doc.rect(margin, currentY, 60, 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Issued By:', margin + 2, currentY + 5);
    doc.text('Signature:', margin + 2, currentY + 15);
    doc.text('Date:', margin + 2, currentY + 22);
    
    // Right signature
    doc.rect(pageWidth - margin - 60, currentY, 60, 25);
    doc.text('Received By:', pageWidth - margin - 58, currentY + 5);
    doc.text('Signature:', pageWidth - margin - 58, currentY + 15);
    doc.text('Date:', pageWidth - margin - 58, currentY + 22);
  }

  // ── BANK DETAILS (if applicable) ──
  if (showBankDet && bank_details) {
    currentY += 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Bank Details:', margin, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const bankLines = doc.splitTextToSize(bank_details, contentWidth - 4);
    bankLines.forEach((line: string, idx: number) => {
      doc.text(line, margin, currentY + 4 + (idx * 3));
    });
  }

  return new Blob([doc.output('blob')], { type: 'application/pdf' });
};
