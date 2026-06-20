import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const generateClassicDeliveryChallanTemplate = (data: any, organisation: any, templateSettings: any = null) => {
  // Extract template settings
  const extSettings = templateSettings || {};
  const colSettings = extSettings.column_settings?.optional || {};
  
  const showItemCode = colSettings.item_code === true;
  const showClientPartNo = colSettings.client_part_no === true;
  const showClientDescription = colSettings.client_description === true;
  const showHsn = colSettings.hsn_code !== false; // defaults to true
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
    dc_date,
    date,
    client_name,
    site_address,
    billing_address,
    gstin,
    state,
    project_name,
    project,
    items,
    vehicle_number,
    driver_name,
    remarks,
    eway_bill,
    po_no,
    po_date,
    terms_conditions
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

  // Render outer unified boundary frame
  doc.setDrawColor(...blackColor);
  doc.setLineWidth(0.3);
  doc.rect(margin, currentY, contentWidth, totalHeight); 
  
  // ── RIGHT METADATA DYNAMIC SIZING ──
  const displayDate = dc_date || date || '';
  const formattedDate = displayDate ? format(new Date(displayDate), 'dd/MM/yyyy') : '-';
  const metaVals = [
    { label: 'DC NO.', value: dc_number || '-' },
    { label: 'DATE', value: formattedDate },
    { label: 'VEHICLE NO.', value: vehicle_number || '-' },
    { label: 'DRIVER NAME', value: driver_name || '-' },
    { label: 'PO NO.', value: po_no || '-' },
    { label: 'PO DATE', value: po_date ? format(new Date(po_date), 'dd/MM/yyyy') : '-' },
    { label: 'E-WAY BILL', value: eway_bill || '-' }
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  let maxLabelW = 0;
  metaVals.forEach(m => {
    const w = doc.getTextWidth(m.label);
    if (w > maxLabelW) maxLabelW = w;
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
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
    const y = currentY + 5.5 + (i * 6.2);
    doc.text(m.label, metaDividerX + 2, y);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...blackColor);
  metaVals.forEach((m, i) => {
    const y = currentY + 5.5 + (i * 6.2);
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
  
  doc.text(client_name || '-', margin + 2, clientY);
  if (billing_address || site_address) {
    const addressLines = doc.splitTextToSize(billing_address || site_address || '', 80);
    addressLines.forEach((line: string, idx: number) => {
      if (idx < 5) {
        doc.text(line, margin + 2, clientY + 4 + (idx * 3));
      }
    });
  }
  if (gstin) doc.text(`GSTIN: ${gstin}`, margin + 2, clientY + 22);
  
  // Right side - Additional details
  const rightDetailsX = margin + 85;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ADDITIONAL DETAILS', rightDetailsX, currentY + 5);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const projName = project_name || (project && (typeof project === 'object' ? project.project_name : project)) || '-';
  doc.text(`Project: ${projName}`, rightDetailsX, currentY + 10);
  doc.text(`State: ${state || organisation?.state || '-'}`, rightDetailsX, currentY + 14);
  if (remarks) {
    doc.text('Remarks:', rightDetailsX, currentY + 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const remarkLines = doc.splitTextToSize(remarks, contentWidth - 85 - 2);
    remarkLines.forEach((line: string, idx: number) => {
      if (idx < 3) doc.text(line, rightDetailsX, currentY + 23 + (idx * 3.5));
    });
  }
  
  currentY += 42;

  // ── ITEMS TABLE ──
  const tableHeaders = [];
  const tableData = [];
  
  // Build headers based on settings
  if (showItemCode) tableHeaders.push('CODE');
  if (showItem) tableHeaders.push('ITEM DESCRIPTION');
  if (showClientPartNo) tableHeaders.push('PART NO');
  if (showClientDescription) tableHeaders.push('CLIENT DESC');
  if (showHsn) tableHeaders.push('HSN');
  if (colSettings.make !== false) tableHeaders.push('MAKE');
  tableHeaders.push('QTY');
  tableHeaders.push('UNIT');
  if (showRate) tableHeaders.push('RATE');
  if (showDiscount) tableHeaders.push('DISC %');
  if (showTax) tableHeaders.push('TAX %');
  if (showAmount) tableHeaders.push('AMOUNT');

  // Build table data
  items?.forEach((item: any, index: number) => {
    const row = [];
    if (showItemCode) row.push(item.material_code || item.item_code || '-');
    if (showItem) row.push(item.material_name || item.item_name || item.tool_name || item.description || '-');
    if (showClientPartNo) row.push(item.client_part_no || '-');
    if (showClientDescription) row.push(item.client_description || item.description || '-');
    if (showHsn) row.push(item.hsn_code || '-');
    if (colSettings.make !== false) row.push(item.brand || item.make || '-');
    row.push(item.quantity || 0);
    row.push(item.unit || item.uom || 'Nos');
    if (showRate) row.push(item.rate ? parseFloat(item.rate).toFixed(2) : '0.00');
    if (showDiscount) row.push(item.discount_percent ? parseFloat(item.discount_percent).toFixed(2) : '0.00');
    if (showTax) row.push(item.tax_percent ? `${item.tax_percent}%` : '0%');
    if (showAmount) row.push(item.amount ? parseFloat(item.amount).toFixed(2) : '0.00');
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
    theme: 'grid',
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Compute Totals
  const subtotal = items?.reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0) || 0;
  const grand_total = subtotal; // For DC, usually matches items total unless taxes explicitly configured

  // ── TOTALS SECTION ──
  if (showAmount && grand_total > 0) {
    if (currentY + 25 > pageHeight - 35) {
      doc.addPage();
      currentY = margin + 10;
    }

    doc.setDrawColor(...blackColor);
    doc.setLineWidth(0.3);
    doc.rect(margin + 120, currentY, contentWidth - 120, 20);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    let totalY = currentY + 8;
    doc.text('Subtotal:', margin + 122, totalY);
    doc.text(`₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, totalY, { align: 'right' });
    
    totalY += 8;
    doc.text('Grand Total:', margin + 122, totalY);
    doc.text(`₹${grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, totalY, { align: 'right' });

    currentY += 26;
  } else {
    currentY += 6;
  }

  // ── TERMS & CONDITIONS ──
  if (showTandC && terms_conditions) {
    const termsText = typeof terms_conditions === 'string' ? terms_conditions : JSON.stringify(terms_conditions);
    const termsLines = doc.splitTextToSize(termsText, contentWidth - 4);
    const neededHeight = 10 + (termsLines.length * 3);

    if (currentY + neededHeight > pageHeight - 35) {
      doc.addPage();
      currentY = margin + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('TERMS & CONDITIONS:', margin, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    termsLines.forEach((line: string, idx: number) => {
      doc.text(line, margin, currentY + 4 + (idx * 3.2));
    });
    currentY += 4 + (termsLines.length * 3.2) + 6;
  }

  // ── SIGNATURE SECTION ──
  if (showAuthSig) {
    if (currentY + 30 > pageHeight - 10) {
      doc.addPage();
      currentY = margin + 10;
    }

    currentY += 5;
    doc.setDrawColor(...blackColor);
    doc.setLineWidth(0.3);
    
    // Left signature
    doc.rect(margin, currentY, 60, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Issued By:', margin + 2, currentY + 4);
    doc.text('Signature:', margin + 2, currentY + 12);
    doc.text('Date:', margin + 2, currentY + 17);
    
    // Right signature
    doc.rect(pageWidth - margin - 60, currentY, 60, 20);
    doc.text('Received By:', pageWidth - margin - 58, currentY + 4);
    doc.text('Signature:', pageWidth - margin - 58, currentY + 12);
    doc.text('Date:', pageWidth - margin - 58, currentY + 17);
    
    currentY += 24;
  }

  // ── BANK DETAILS (if applicable) ──
  if (showBankDet && organisation?.bank_name) {
    const bankDetailsStr = `Bank: ${organisation.bank_name} | Branch: ${organisation.bank_branch || '-'} | A/C: ${organisation.bank_account_no || '-'} | IFSC: ${organisation.bank_ifsc || '-'}`;
    
    if (currentY + 15 > pageHeight - 10) {
      doc.addPage();
      currentY = margin + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Bank Details:', margin, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(bankDetailsStr, margin, currentY + 4);
  }

  return doc;
};
