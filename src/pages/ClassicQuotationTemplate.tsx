import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateClassicQuotationTemplate = (data: any, organisation: any, templateSettings: any = null) => {
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
    terms_conditions,
    prepared_by
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
  const docTitle = quotation_no ? 'QUOTATION' : invoice_no ? 'INVOICE' : 'DOCUMENT';
  doc.text(docTitle, pageWidth / 2, currentY + 2, { align: 'center' });
  
  currentY = margin + 2; // Begin precisely without arbitrary blank spacers natively

  // ── UNIFIED MASTER HEADER GRID ──
  const totalHeight = 48; // Highly compact spacing mapped identical
  const leftOrgH = 24; 

  // Render outer unified boundary frame strictly
  doc.setDrawColor(...blackColor); // Image displays solid crisp black boundaries mapping cleanly
  doc.setLineWidth(0.3);
  doc.rect(margin, currentY, contentWidth, totalHeight); 
  
  // ── RIGHT METADATA DYNAMIC SIZING ──
  const metaVals = [
    { label: quotation_no ? 'QUOTE NO.' : 'INVOICE NO.', value: quotation_no || invoice_no || dc_number || '-' },
    { label: 'DATE', value: date || '-' },
    { label: 'REVISION NO.', value: '00' },
    { label: 'REMARKS', value: remarks || reference || '-' },
    { label: 'PREP. BY', value: prepared_by || '-' },
    { label: 'PAYMENT TERMS', value: payment_terms || '-' },
    { label: 'VALID UNTIL', value: valid_till || '-' }
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

  // Calculate coordinates dynamically sizing backwards (Right-to-Left constraint binding)
  const metaLabelW = maxLabelW + 4; // Padding
  let metaValW = maxValW + 6; // Padding
  if (metaValW > 60) metaValW = 60; // Max bound
  if (metaValW < 20) metaValW = 20; // Min bound safely

  const rightColW = metaLabelW + metaValW;
  const metaDividerX = pageWidth - margin - rightColW;

  // Primary Vertical Dividers bounding the Right Master column
  doc.line(metaDividerX, currentY, metaDividerX, currentY + totalHeight); 
  doc.line(metaDividerX + metaLabelW, currentY, metaDividerX + metaLabelW, currentY + totalHeight);

  // ── 1. LEFT SIDE: ORGANISATION (TOP) ──
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
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  const maxW = (metaDividerX - textX) - 2; 
  const addressLines = doc.splitTextToSize(organisation.address || '', maxW);
  doc.text(addressLines, textX, currentY + 15.5);

  if (organisation.email) {
    doc.text(`Email: ${organisation.email}`, textX, currentY + 15.5 + (addressLines.length * 3.5));
  }

  // ── 2. LEFT SIDE: CLIENT & SHIP TO (BOTTOM) ──
  doc.line(margin, currentY + leftOrgH, metaDividerX, currentY + leftOrgH);
  
  const clientSplitX = margin + ((metaDividerX - margin) / 2);
  doc.line(clientSplitX, currentY + leftOrgH, clientSplitX, currentY + totalHeight);
  
  const cY = currentY + leftOrgH;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayColor);
  doc.text('BILL TO', margin + 2, cY + 4);
  doc.text('SHIP TO', clientSplitX + 2, cY + 4);
  
  // Clean strict separating underlines rendering strictly isolating the labels
  doc.line(margin + 2, cY + 6, clientSplitX - 2, cY + 6);
  doc.line(clientSplitX + 2, cY + 6, metaDividerX - 2, cY + 6);
  
  doc.setTextColor(...blackColor);
  doc.setFontSize(8);
  
  // Left: Bill To strictly confined natively spanning to midline
  doc.setFontSize(9);
  doc.text(client?.client_name || client?.name || '', margin + 2, cY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  const billLines = doc.splitTextToSize(billing_address || client?.address || '', clientSplitX - margin - 4);
  doc.text(billLines, margin + 2, cY + 14);
  doc.setTextColor(...blackColor);
  if (client?.gstin || gstin) doc.text(`GSTIN: ${client?.gstin || gstin}`, margin + 2, cY + 14 + (billLines.length * 3.5));
  
  // Right: Ship To mapping symmetric to the internal barrier limit seamlessly
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  doc.setFontSize(9);
  doc.text(data.shipping_company_name || client?.client_name || '', clientSplitX + 2, cY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  const shipLines = doc.splitTextToSize(data.shipping_address || billing_address || client?.address || '', metaDividerX - clientSplitX - 4);
  doc.text(shipLines, clientSplitX + 2, cY + 14);
  doc.setTextColor(...blackColor);
  if (data.shipping_gst || client?.gstin || gstin) doc.text(`GSTIN: ${data.shipping_gst || client?.gstin || gstin}`, clientSplitX + 2, cY + 14 + (shipLines.length * 3.5));

  // ── 3. RIGHT SIDE: METADATA COLUMN SECURELY PARTITIONED EXACTLY ──
  const metaRowsCount = 7;
  const metaRowH = totalHeight / metaRowsCount; // dynamically sized natively
  
  for (let i = 1; i < metaRowsCount; i++) {
    doc.line(metaDividerX, currentY + (i * metaRowH), pageWidth - margin, currentY + (i * metaRowH));
  }
  
  let labelY = currentY;
  metaVals.forEach(p => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    // Explicitly Left Aligned natively inside dynamically calculated right-floating column!
    doc.text(p.label, metaDividerX + 2, labelY + 4.8);
    
    doc.setTextColor(...blackColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    // Value text natively mapped beyond barrier
    doc.text(String(p.value), metaDividerX + metaLabelW + 2, labelY + 4.8);
    
    labelY += metaRowH;
  });

  // Proceed strictly past boundaries flawlessly
  currentY += totalHeight + 5;

  // ── ITEMS TABLE ──
  // Calculate safely expanding bottom limits explicitly tracking separated grid sizes
  // 25mm (Matrix containing Words) + 5mm (gap) + 25mm (Footer Box)
  const totalsSectionHeight = 25 + 5 + 25; 
  const totalsStartY = pageHeight - margin - totalsSectionHeight;
  
  // Calculate available space for line items table
  const tableEndY = totalsStartY - 5; // 5mm gap before totals
  
  // ── PRE-MAP TABLE ROWS TO MEASURE EXACT GEOMETRIES ──
  const formatNumber = (num: any) => Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const tableRows = (items || []).map((item: any, index: number) => {
    const row = [];
    row.push(index + 1);
    if (showHsn) row.push(item.sac_code || item.item?.hsn_code || '');
    const mapping = client?.id && item.item?.mappings?.find((m: any) => m.client_id === client.id);
    if (showItem) row.push(mapping?.client_description || item.description || item.item?.display_name || item.item?.name || '');
    if (showClientDescription) row.push(mapping?.client_description || '');
    if (showItemCode) row.push(mapping?.client_part_no || item.item?.item_code || '');
    if (showClientPartNo) row.push(mapping?.client_part_no || '');
    row.push(String(item.qty || ''));
    row.push(item.uom || '');
    if (showRate) row.push(formatNumber(item.rate));
    if (showDiscount) row.push(item.discount_percent ? `${item.discount_percent}%` : '');
    if (showTax) row.push((item.tax_percent !== undefined && item.tax_percent !== null && item.tax_percent !== '') ? `${item.tax_percent}%` : '0%');
    if (showAmount) row.push(formatNumber(item.line_total));
    return row;
  });

  // Calculate mathematically strictly wrapping geometries calculating BOTH Headers and Row data safely
  const getDynamicW = (idx: number, headerText: string, expand1Digit = false) => {
    // 1. Measure header text width precisely
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    let maxW = doc.getTextWidth(headerText);
    
    // 2. Measure data text widths
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    tableRows.forEach(row => {
      const w = doc.getTextWidth(String(row[idx] || ''));
      if (w > maxW) maxW = w;
    });
    
    // 3mm physical inner cell padding + 1.5mm (~1 extra digit width requested)
    return Math.ceil(maxW + 3 + (expand1Digit ? 1.5 : 0));
  };

  // Building dynamic columns strictly bounded to row inputs
  const activeHeaders: string[] = [];
  const colStyles: any = {};
  let colIndex = 0;

  activeHeaders.push('S.No');
  colStyles[colIndex] = { cellWidth: getDynamicW(colIndex, 'S.No'), halign: 'center' };
  colIndex++;

  if (showHsn) {
    activeHeaders.push('HSN');
    colStyles[colIndex] = { cellWidth: getDynamicW(colIndex, 'HSN'), halign: 'center' };
    colIndex++;
  }

  if (showItem) {
    const itemLabel = extSettings.column_settings?.labels?.item || 'Item Description';
    activeHeaders.push(itemLabel);
    colStyles[colIndex] = { cellWidth: 'auto' };
    colIndex++;
  }

  if (showClientDescription) {
    activeHeaders.push('Client Description');
    colStyles[colIndex] = { cellWidth: getDynamicW(colIndex, 'Client Description'), halign: 'left' };
    colIndex++;
  }

  if (showItemCode) {
    activeHeaders.push('Item Code');
    colStyles[colIndex] = { cellWidth: getDynamicW(colIndex, 'Item Code'), halign: 'center' };
    colIndex++;
  }

  if (showClientPartNo) {
    activeHeaders.push('Client Part No');
    colStyles[colIndex] = { cellWidth: getDynamicW(colIndex, 'Client Part No'), halign: 'center' };
    colIndex++;
  }

  // ── UNIFORM METRIC COLUMNS SIZING ──
  let tempIdx = colIndex; // Safe traversal pointer
  const metricWidths: number[] = [];
  
  const qtyIdx = tempIdx++;
  metricWidths.push(getDynamicW(qtyIdx, 'Qty'));
  
  const unitIdx = tempIdx++;
  metricWidths.push(getDynamicW(unitIdx, 'Unit'));
  
  if (showRate) {
    metricWidths.push(getDynamicW(tempIdx++, 'Rate', true));
  }
  if (showDiscount) {
    metricWidths.push(getDynamicW(tempIdx++, 'Disc%'));
  }
  if (showTax) {
    tempIdx++; // Advance structurally avoiding identical metric aggregation
  }

  // Resolve identically unified structural metrics gracefully 
  const uniformMetricW = Math.max(...metricWidths);

  activeHeaders.push('Qty');
  colStyles[colIndex] = { cellWidth: uniformMetricW, halign: 'center' };
  colIndex++;

  activeHeaders.push('Unit');
  colStyles[colIndex] = { cellWidth: uniformMetricW, halign: 'center' };
  colIndex++;

  if (showRate) {
    activeHeaders.push('Rate');
    colStyles[colIndex] = { cellWidth: uniformMetricW, halign: 'right' };
    colIndex++;
  }

  if (showDiscount) {
    activeHeaders.push('Disc%');
    colStyles[colIndex] = { cellWidth: uniformMetricW, halign: 'center' };
    colIndex++;
  }

  if (showTax) {
    activeHeaders.push('GST%');
    colStyles[colIndex] = { cellWidth: getDynamicW(colIndex, 'GST%'), halign: 'center' };
    colIndex++;
  }

  if (showAmount) {
    activeHeaders.push('Amount'); // Dropping Rs. to prevent multi-line header crush
    colStyles[colIndex] = { cellWidth: getDynamicW(colIndex, 'Amount', true), halign: 'right' };
    colIndex++;
  }
  
  let finalY = currentY;
  let lastColW = 0;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [activeHeaders],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 1.5
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [0, 0, 0],
      cellPadding: 1.5
    },
    columnStyles: colStyles,
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.5,
    didParseCell: (data: any) => {
      // Specific headers overriding the global center alignment
      if (data.section === 'head') {
        if (activeHeaders[data.column.index] === 'Amount (Rs.)' || activeHeaders[data.column.index] === 'Rate (Rs.)') {
          data.cell.styles.halign = 'right';
        }
        if (activeHeaders[data.column.index] === 'Item Description') {
          data.cell.styles.halign = 'left';
        }
      }
    },
    // Make table expand to fill available space
    didDrawPage: (data: any) => {
      finalY = data.cursor.y;
      
      if (data.table.columns && data.table.columns.length > 0) {
        lastColW = data.table.columns[data.table.columns.length - 1].width;
      }
      
      // If table doesn't fill available space, draw empty rows
      if (finalY < tableEndY) {
        const emptyRowHeight = 6;
        const rowsNeeded = Math.floor((tableEndY - finalY) / emptyRowHeight);
        
        // Get table width and position
        const tableWidth = contentWidth;
        const tableX = margin;
        
        // Draw empty rows to fill space
        for (let i = 0; i < rowsNeeded; i++) {
          const rowY = finalY + (i * emptyRowHeight);
          
          // Draw row border
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.2);
          doc.rect(tableX, rowY, tableWidth, emptyRowHeight);
          
          // Draw vertical lines matching dynamic column widths
          let xPos = tableX;
          
          data.table.columns.forEach((col: any, idx: number) => {
            if (idx > 0) {
              doc.line(xPos, rowY, xPos, rowY + emptyRowHeight);
            }
            xPos += col.width;
          });
        }
      }
    }
  });

  // Position totals at fixed bottom location
  currentY = totalsStartY;

  // ── TOTALS SECTION ──
  const totalsBoxHeight = 25; // 5 rows * 5mm
  const totalsRowH = 5;
  const labelsW = 40; // Fixed physical width for cleanly housing Sub Total / CGST text labels
  const mathBoxX = pageWidth - margin - lastColW - labelsW; // Left boundary of the mathematical segment

  doc.setDrawColor(...blackColor); // Matching table inner grid border stroke
  doc.setLineWidth(0.2); 
  doc.rect(margin, currentY, contentWidth, totalsBoxHeight); // Outer perimeter frame
  
  // Natively connect the vertical boundary separator matching strictly with autoTable's exact Amount column boundary mapping
  if (lastColW > 0) {
    doc.line(pageWidth - margin - lastColW, currentY, pageWidth - margin - lastColW, currentY + totalsBoxHeight);
  }
  
  // Draw an explicit internal vertical barrier confining the labels bounding box cleanly 
  doc.line(mathBoxX, currentY, mathBoxX, currentY + totalsBoxHeight);

  // Draw exactly 4 inner intersecting horizontal dividing structural rows mapping cleanly EXCLUSIVELY into the math box
  for (let i = 1; i < 5; i++) {
    doc.line(mathBoxX, currentY + (i * totalsRowH), pageWidth - margin, currentY + (i * totalsRowH));
  }
  
  // Format numeric styles securely
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  
  const valX = pageWidth - margin - 2;
  const lblX = pageWidth - margin - lastColW - 2;
  
  doc.text(`Sub Total (Basic)`, lblX, currentY + 3.5, { align: 'right' });
  doc.text(formatNumber(subtotal), valX, currentY + 3.5, { align: 'right' });
  
  doc.text(`Add : CGST @ 9%`, lblX, currentY + 8.5, { align: 'right' });
  doc.text(formatNumber(data.cgst_amount), valX, currentY + 8.5, { align: 'right' });
  
  doc.text(`Add : SGST @ 9%`, lblX, currentY + 13.5, { align: 'right' });
  doc.text(formatNumber(data.sgst_amount), valX, currentY + 13.5, { align: 'right' });
  
  doc.text(`Round Off`, lblX, currentY + 18.5, { align: 'right' });
  doc.text(formatNumber(round_off), valX, currentY + 18.5, { align: 'right' });
  
  // Natively fill Grand Total background securely strictly bound inside the right-hand math matrix structure visually
  doc.setFillColor(0, 0, 0);
  doc.rect(mathBoxX, currentY + 20, lastColW + labelsW, 5, 'F');
  
  // Redraw precise white vertical clipping separator cleanly bypassing black override
  if (lastColW > 0) {
    doc.setDrawColor(255, 255, 255);
    doc.line(pageWidth - margin - lastColW, currentY + 20, pageWidth - margin - lastColW, currentY + 25);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`GRAND TOTAL (Rs.)`, lblX, currentY + 23.5, { align: 'right' });
  doc.text(formatNumber(grand_total), valX, currentY + 23.5, { align: 'right' });
  
  // ── AMOUNT IN WORDS SECTION ──
  // Fallback Indian Number to Words converter natively built inside template 
  const numberToWords = (amount: number): string => {
    if (!amount || isNaN(amount) || amount === 0) return 'Zero Only';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const inWords = (num: number): string => {
      if (num.toString().length > 9) return 'Overflow';
      const n = ('000000000' + num).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n) return '';
      let str = '';
      str += (n[1] != '00') ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
      str += (n[2] != '00') ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
      str += (n[3] != '00') ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
      str += (n[4] != '0') ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
      str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
      return str.trim();
    };
    const parts = amount.toString().split('.');
    const rupees = parseInt(parts[0], 10);
    const paise = parseInt(parts[1] || '0', 10);
    let result = inWords(rupees) + ' Rupees';
    if (paise > 0) result += ' and ' + inWords(paise) + ' Paise';
    return result + ' Only';
  };

  // Validating and formatting to start properly with Indian Rupee
  let wordsText = amount_words || numberToWords(Math.round(grand_total || 0));
  if (wordsText && !wordsText.toLowerCase().includes('rupee')) {
    wordsText = `Indian Rupees ${wordsText}`;
  } else if (!wordsText) {
    wordsText = 'Indian Rupees Zero Only';
  } else if (!wordsText.toLowerCase().startsWith('indian')) {
    wordsText = `Indian ${wordsText}`;
  }

  // Explicitly wrap this across multiple lines bound fully utilizing the entire physical width cleanly 
  const wordsLines = doc.splitTextToSize(wordsText, contentWidth - doc.getTextWidth('Amount in Words :') - 10);
  
  // AMOUNT IN WORDS RENDERED SECURELY INSIDE CLEAN LEFTWARD GRID CELL
  const wordsBoxWidth = mathBoxX - margin;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount in Words :', margin + 2, currentY + 3.5);
  doc.setFont('helvetica', 'italic');
  doc.text(wordsLines.map((l: string) => l.toUpperCase()), margin + doc.getTextWidth('Amount in Words :') + 4, currentY + 3.5);
  
  currentY += totalsBoxHeight + 5; // Step smoothly avoiding static hacks downward right into identical Footer margin
  // ── FOOTER SECTION ──
  doc.setDrawColor(...blackColor);
  doc.setLineWidth(0.5);
  doc.rect(margin, currentY, contentWidth, 25);
  
  // Vertical separator strictly confining the Right auth box to exactly 60mm!
  const authBoxW = 60;
  const authDivX = pageWidth - margin - authBoxW;
  doc.line(authDivX, currentY, authDivX, currentY + 25);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  
  // Headers
  if (showBankDet) doc.text('Bank Details', margin + 2, currentY + 4);
  else if (showTandC) doc.text('Terms & Conditions', margin + 2, currentY + 4);
  
  // Natively compute strict center boundary precisely enclosing the right sub-matrix frame geometrically
  const authCenterX = authDivX + (authBoxW / 2);
  if (showAuthSig) doc.text('Authorised Signatory', authCenterX, currentY + 4, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  
  // Bank details rendering strictly on left dynamically spanning huge left zone limits confidently
  if (showBankDet) {
    const bankDetailsList = [
      `Bank Name: ${bank_details?.bank_name || organisation.bank_name || ''}`,
      `Branch: ${bank_details?.bank_branch || organisation.bank_branch || ''}`,
      `A/c No: ${bank_details?.account_no || organisation.bank_account_no || ''}`,
      `A/c Type: ${bank_details?.account_type || organisation.bank_account_type || ''}`,
      `IFSC Code: ${bank_details?.ifsc || organisation.bank_ifsc || ''}`
    ];
    
    bankDetailsList.forEach((detail, index) => {
      doc.text(detail, margin + 2, currentY + 8 + (index * 2.5));
    });
  }
  
  // Terms & conditions explicitly hugging left underneath bank details seamlessly wrapping new extra room bounds
  if (showTandC) {
    let termsText = '';
    
    // Handle new Terms & Conditions format
    if (terms_conditions) {
      try {
        const termsData = typeof terms_conditions === 'string' 
          ? JSON.parse(terms_conditions) 
          : terms_conditions;
        
        if (termsData && termsData.sections) {
          termsText = termsData.sections.map((section: any, sectionIndex: number) => {
            const sectionTitle = `${sectionIndex + 1}. ${section.title}`;
            const items = section.items ? section.items.map((item: any, itemIndex: number) => {
              const prefix = item.item_type === 'bullet' ? '•' : `${itemIndex + 1}.`;
              return `   ${prefix} ${item.content}`;
            }).join('\n') : '';
            return `${sectionTitle}\n${items}`;
          }).join('\n\n');
        }
      } catch (error) {
        // Fallback to plain text if JSON parsing fails
        termsText = String(terms_conditions);
      }
    }
    
    // Fallback to organisation terms if no quotation terms
    if (!termsText) {
      termsText = organisation.terms_conditions || '';
    }
    
    if (termsText) {
      const termsLines = doc.splitTextToSize(termsText, (authDivX - margin) - 4);
      doc.setFontSize(6);
      doc.text(termsLines, margin + 2, showBankDet ? (currentY + 22) : (currentY + 8));
    }
  }

  // Right-aligned strictly symmetric centered bounding constraints for Authorised matrix physically!
  if (showAuthSig) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`For ${organisation.name || ''}`, authCenterX, currentY + 6, { align: 'center' });
    
    // Attempt signature natively mapping directly into center coordinates if physically available
    if (authorized_signatory?.url) {
      try {
        doc.addImage(authorized_signatory.url, 'PNG', authCenterX - 12, currentY + 8, 24, 7);
      } catch (e) {
         doc.text('__________________', authCenterX, currentY + 14, { align: 'center' });
      }
    } else {
      doc.text('__________________', authCenterX, currentY + 14, { align: 'center' });
    }
    
    doc.text('Authorised Signatory', authCenterX, currentY + 17, { align: 'center' });
  }

  return doc;
};