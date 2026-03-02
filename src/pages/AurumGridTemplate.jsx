import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * AURUM GRID - Business Document Suite
 * Unified engine for Tax Invoice, Quotation, and Delivery Challan
 */
export const generateAurumGridTemplate = (data, organisation, templateSettings = null) => {
  const docType = templateSettings?.document_type || 'Quotation';
  const isInvoice = docType === 'Invoice';
  const isDC = docType === 'Delivery Challan';
  const isQuotation = docType === 'Quotation';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - (2 * margin);

  // Bottom frozen section height allocation
  const bottomSectionHeight = isDC ? 50 : 80; 
  const tableBottomY = pageHeight - margin - bottomSectionHeight;

  // Label System Helper
  const getLabel = (key, defaultVal) => {
    return templateSettings?.column_settings?.header_labels?.[key] 
        || templateSettings?.column_settings?.labels?.[key] 
        || defaultVal;
  };

  // Data mapping
  const docNo = data.invoice_no || data.quotation_no || data.dc_number || '-';
  const docDate = data.date || data.dc_date || '-';
  const themeColor = organisation.theme_color || '#1e293b';

  let currentY = margin;

  const drawLine = (y) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
  };

  // ==========================================
  // HEADER SECTION (Compact 12-Column Grid)
  // ==========================================
  const logoWidth = 35;
  const logoHeight = 15;
  if (organisation.logo_url) {
    try {
      doc.addImage(organisation.logo_url, 'PNG', margin, currentY, logoWidth, logoHeight, undefined, 'FAST');
    } catch (e) {}
  }

  // Left: Company Info
  const leftTextX = margin + (organisation.logo_url ? logoWidth + 5 : 0);
  doc.setTextColor(themeColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(organisation.name || 'COMPANY NAME', leftTextX, currentY + 4);
  
  doc.setTextColor(50);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const orgAddress = `${organisation.address || ''}`.replace(/\n/g, ', ');
  const inlineInfo = `GSTIN: ${organisation.gstin || '-'} | PAN: ${organisation.pan || '-'} | Ph: ${organisation.phone || '-'}`;
  
  doc.text(doc.splitTextToSize(orgAddress, 90), leftTextX, currentY + 8);
  doc.setFont('helvetica', 'bold');
  doc.text(inlineInfo, leftTextX, currentY + 14);

  // Right: Document Info
  const rightX = pageWidth - margin;
  doc.setTextColor(themeColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text((getLabel('document_title', docType)).toUpperCase(), rightX, currentY + 4, { align: 'right' });

  doc.setTextColor(0);
  doc.setFontSize(8);
  
  const rightInfoYStart = currentY + 9;
  const rightInfoSpacing = 4;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${getLabel('document_no', 'No')}:`, rightX - 30, rightInfoYStart);
  doc.setFont('helvetica', 'normal');
  doc.text(String(docNo), rightX, rightInfoYStart, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text(`${getLabel('document_date', 'Date')}:`, rightX - 30, rightInfoYStart + rightInfoSpacing);
  doc.setFont('helvetica', 'normal');
  doc.text(String(docDate), rightX, rightInfoYStart + rightInfoSpacing, { align: 'right' });

  if (data.reference_no || data.po_no) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${getLabel('po_no', 'PO No')}:`, rightX - 30, rightInfoYStart + (rightInfoSpacing * 2));
    doc.setFont('helvetica', 'normal');
    doc.text(String(data.reference_no || data.po_no), rightX, rightInfoYStart + (rightInfoSpacing * 2), { align: 'right' });
  }

  if (isInvoice && data.eway_bill) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${getLabel('eway_bill', 'E-Way Bill')}:`, rightX - 30, rightInfoYStart + (rightInfoSpacing * 3));
    doc.setFont('helvetica', 'normal');
    doc.text(String(data.eway_bill), rightX, rightInfoYStart + (rightInfoSpacing * 3), { align: 'right' });
  }

  currentY += 18;
  drawLine(currentY);
  currentY += 2;

  // ==========================================
  // CLIENT INFO SECTION
  // ==========================================
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  doc.text('BILL TO:', margin, currentY + 3);
  if (!isQuotation) doc.text('SHIP TO:', margin + (contentWidth / 2) + 5, currentY + 3);

  currentY += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  
  const clientName = data.client?.client_name || data.client_name || data.buyer?.name || '';
  doc.text(clientName, margin, currentY);
  if (!isQuotation) doc.text(clientName, margin + (contentWidth / 2) + 5, currentY);

  currentY += 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  const billAddress = doc.splitTextToSize(data.billing_address || data.buyer?.address || '', (contentWidth / 2) - 10);
  doc.text(billAddress, margin, currentY);
  
  if (!isQuotation) {
    const shipAddress = doc.splitTextToSize(data.shipping_address || data.site_address || data.consignee?.address || data.billing_address || '', (contentWidth / 2) - 10);
    doc.text(shipAddress, margin + (contentWidth / 2) + 5, currentY);
  }

  const maxAddrLines = isQuotation ? billAddress.length : Math.max(billAddress.length, (data.shipping_address || data.site_address || '').length / 40 || 1);
  currentY += (maxAddrLines * 3.5) + 2;

  doc.setFont('helvetica', 'bold');
  const gstinLabel = getLabel('gstin', 'GSTIN');
  doc.text(`${gstinLabel}: ${data.gstin || data.buyer?.gstin || data.client_gstin || '-'}`, margin, currentY);
  if (!isQuotation) doc.text(`${gstinLabel}: ${data.ship_to_gstin || data.gstin || data.consignee?.gstin || '-'}`, margin + (contentWidth / 2) + 5, currentY);

  currentY += 6;

  // ==========================================
  // ITEMS TABLE (Dynamic & Expanding)
  // ==========================================
  const optCols = templateSettings?.column_settings?.optional || {};
  const tableHeaders = [];
  const columnDataKeys = [];
  
  // Build dynamic columns
  tableHeaders.push(getLabel('sno', 'S.No')); columnDataKeys.push('sno');
  if (optCols.hsn_code !== false && !isDC) { tableHeaders.push(getLabel('hsn_code', 'HSN/SAC')); columnDataKeys.push('hsn'); }
  tableHeaders.push(getLabel('item', 'Item Description')); columnDataKeys.push('item');
  tableHeaders.push(getLabel('qty', 'Qty')); columnDataKeys.push('qty');
  tableHeaders.push(getLabel('uom', 'Unit')); columnDataKeys.push('unit');
  
  if (!isDC) {
    if (optCols.rate !== false) { tableHeaders.push(getLabel('rate', 'Rate')); columnDataKeys.push('rate'); }
    if (isInvoice && optCols.tax_percent !== false) { tableHeaders.push(getLabel('tax', 'GST %')); columnDataKeys.push('tax'); }
    tableHeaders.push(getLabel('line_total', 'Amount')); columnDataKeys.push('amount');
  }

  const tableBody = (data.items || []).map((item, index) => {
    if (item.is_header) {
      return [{ content: item.description, colSpan: tableHeaders.length, styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: themeColor } }];
    }
    const row = [];
    row.push(index + 1);
    if (optCols.hsn_code !== false && !isDC) row.push(item.hsn_code || item.item?.hsn_code || item.material_hsn || '-');
    row.push(`${item.description || item.material_name || item.item?.name || '-'}`);
    row.push(parseFloat(item.qty || item.quantity || 0));
    row.push(item.uom || item.unit || '-');
    
    if (!isDC) {
      if (optCols.rate !== false) row.push(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.rate || 0));
      if (isInvoice && optCols.tax_percent !== false) row.push(`${item.tax_percent || item.gst_percent || 0}%`);
      row.push(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.line_total || item.amount || 0));
    }
    return row;
  });

  // Track vertical lines for manual grid extension
  let verticalLinePositions = [];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin, bottom: bottomSectionHeight + 15 },
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    headStyles: { 
      fillColor: themeColor, 
      textColor: [255, 255, 255], 
      fontStyle: 'bold', 
      fontSize: 8,
      cellPadding: 4
    },
    styles: { 
      fontSize: 8, 
      cellPadding: 4, 
      textColor: [30, 30, 30],
      lineColor: [220, 220, 220],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: isDC ? { cellWidth: 'auto' } : { cellWidth: 20, halign: 'center' },
      2: isDC ? { cellWidth: 20, halign: 'center' } : { cellWidth: 'auto' }, // Item desc
    },
    willDrawCell: (data) => {
      // Align numbers to right
      const header = tableHeaders[data.column.index];
      if (header === getLabel('qty', 'Qty') || header === getLabel('rate', 'Rate') || header === getLabel('line_total', 'Amount')) {
        data.cell.styles.halign = 'right';
      }
    },
    didDrawPage: (hookData) => {
      // Save column X positions to draw lines down to the footer
      if (verticalLinePositions.length === 0) {
        hookData.table.columns.forEach(col => {
          verticalLinePositions.push(col.x);
        });
        verticalLinePositions.push(hookData.table.columns[hookData.table.columns.length - 1].x + hookData.table.columns[hookData.table.columns.length - 1].width);
      }
      
      const isLastPage = hookData.pageNumber === doc.internal.getNumberOfPages();
      const currentFinalY = hookData.cursor.y;
      
      // Auto-fill empty grid space down to the frozen section
      if (isLastPage && currentFinalY < tableBottomY) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        
        // Draw vertical lines
        verticalLinePositions.forEach(x => {
          doc.line(x, currentFinalY, x, tableBottomY);
        });
        
        // Draw bottom horizontal line
        doc.line(margin, tableBottomY, pageWidth - margin, tableBottomY);
      }
    }
  });

  // ==========================================
  // FROZEN BOTTOM SECTION
  // ==========================================
  const lastPageCount = doc.internal.getNumberOfPages();
  doc.setPage(lastPageCount); // Ensure we're on the last page

  let footerY = tableBottomY + 2; // Start immediately after the forced table bottom

  if (!isDC) {
    // --- TOTALS & TAX BREAKDOWN BLOCK ---
    const totalsWidth = 70;
    const totalsX = pageWidth - margin - totalsWidth;
    
    // Amount in words
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Amount in Words:', margin, footerY + 3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(`INR ${data.amount_words || 'Zero'} Only`, margin, footerY + 8);

    const isInterState = data.state && organisation.state && data.state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();
    const tTax = parseFloat(data.total_tax || 0);

    const totals = [
      { label: 'Basic Amount', value: data.subtotal },
      ...(isInvoice ? [
        { label: isInterState ? 'IGST' : 'SGST', value: isInterState ? tTax : (tTax / 2) },
        { label: isInterState ? '' : 'CGST', value: isInterState ? null : (tTax / 2) }
      ] : []),
      { label: 'Round Off', value: data.round_off },
    ].filter(t => t.label !== '');

    let currentTotalY = footerY + 3;
    doc.setFontSize(8);
    
    totals.forEach(t => {
      doc.setFont('helvetica', 'normal');
      doc.text(t.label, totalsX, currentTotalY);
      doc.text(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(t.value || 0), pageWidth - margin, currentTotalY, { align: 'right' });
      currentTotalY += 5;
    });

    // Grand Total Block
    doc.setFillColor(248, 250, 252);
    doc.rect(totalsX - 5, currentTotalY, totalsWidth + 5, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(themeColor);
    doc.text('Grand Total (INR)', totalsX, currentTotalY + 5.5);
    doc.text(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(data.grand_total || 0), pageWidth - margin, currentTotalY + 5.5, { align: 'right' });

    footerY = currentTotalY + 12;
  } else {
    // DC specific totals
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const dcTotal = (data.items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    doc.text(`Total Items: ${(data.items || []).length}`, margin, footerY + 5);
    doc.text(`Estimated Value: INR ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(dcTotal)}`, pageWidth - margin, footerY + 5, { align: 'right' });
    footerY += 12;
  }

  // Horizontal Divider
  drawLine(footerY);
  footerY += 5;

  // --- SIGNATURE & BANK BLOCK ---
  // Left Side (Bank / Terms)
  doc.setTextColor(0);
  doc.setFontSize(7);
  if (isInvoice || isQuotation) {
    doc.setFont('helvetica', 'bold');
    doc.text('Bank Details', margin, footerY + 2);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bank Name: ${data.bank_details?.bank_name || '-'}`, margin, footerY + 6);
    doc.text(`Account No: ${data.bank_details?.acc_no || '-'}`, margin, footerY + 10);
    doc.text(`IFSC Code: ${data.bank_details?.ifsc || '-'}`, margin, footerY + 14);
    doc.text(`Branch: ${data.bank_details?.branch || '-'}`, margin, footerY + 18);
  } else if (isDC) {
    doc.setFont('helvetica', 'bold');
    doc.text('Dispatch Details', margin, footerY + 2);
    doc.setFont('helvetica', 'normal');
    doc.text(`Vehicle No: ${data.vehicle_number || '-'}`, margin, footerY + 6);
    doc.text(`Driver Name: ${data.driver_name || '-'}`, margin, footerY + 10);
  }

  // Right Side (Signatures)
  const signX = pageWidth - margin - 55;
  
  if (isDC) {
    doc.setFont('helvetica', 'bold');
    doc.text("Receiver's Signature & Seal", pageWidth / 2, footerY + 20, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.text(`For ${organisation.name}`, pageWidth - margin, footerY + 2, { align: 'right' });

  if (data.authorized_signatory?.url) {
    try {
      doc.addImage(data.authorized_signatory.url, 'PNG', pageWidth - margin - 35, footerY + 5, 35, 12);
    } catch (e) {}
  }

  doc.setFont('helvetica', 'normal');
  doc.text(getLabel('authorized_signatory', 'Authorized Signatory'), pageWidth - margin, footerY + 20, { align: 'right' });

  // --- FOOTER (Page Numbers) ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    
    // Add "Computer Generated Document" note
    doc.text('This is a computer-generated document. No signature is required.', pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  return doc;
};