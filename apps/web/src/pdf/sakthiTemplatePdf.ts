import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to convert URL to base64 safely
async function getBase64ImageFromUrl(imageUrl: string): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const dataUrl = canvas.toDataURL('image/png');
          resolve({ dataUrl, width: img.width, height: img.height });
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error('Canvas context not available'));
      }
    };
    img.onerror = (error) => {
      reject(error);
    };
    img.src = imageUrl;
  });
}

function formatDate(dateStr: any): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return String(dateStr);
  }
}

function fmt(n: any): string {
  const num = parseFloat(String(n));
  if (isNaN(num)) return '0.00';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

interface NormalizedData {
  company: {
    companyName: string;
    companyAddress: string;
    companyGstin: string;
    companyPan: string;
    companyPhone: string;
    companyEmail: string;
    logoUrl: string | null;
  };
  details: {
    docTitle: string;
    docNoLabel: string;
    docNo: string;
    date: string;
    placeOfSupply: string;
    paymentTerms: string;
  };
  client: {
    clientName: string;
    clientAddress: string;
    clientGstin: string;
  };
  items: Array<{
    sno: string;
    hsn: string;
    description: string;
    qty: number | string;
    unit: string;
    rate: number | string;
    gstPercent: number | string;
    amount: number | string;
  }>;
  totals: {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    roundOff: number;
    grandTotal: number;
  };
  bank: {
    bankName: string;
    bankAccNo: string;
    bankIfsc: string;
    bankBranch: string;
  };
}

function normalizeDocumentData(data: any, org: any, type: string): NormalizedData {
  // Normalize company details
  const companyName = org.name || 'SAKTHI SOLUTIONS AND SERVICES';
  const companyAddress = org.address || '';
  const companyGstin = org.gstin || '';
  const companyPan = org.pan || '';
  const companyPhone = org.phone || org.mobile || '';
  const companyEmail = org.email || '';
  const logoUrl = org.logo_url || null;

  // Document details label mapping
  let docTitle = `${type} Details:`;
  let docNoLabel = `${type} NO.:`;
  let docNo = '';
  let date = '';
  let placeOfSupply = data.state || data.client?.state || data.buyer?.state || org.state || '33-TAMIL NADU';
  let paymentTerms = data.payment_terms || data.terms || '';

  const cleanType = type.trim().toLowerCase();

  if (cleanType === 'quotation' || cleanType === 'quote') {
    docTitle = 'Quotation Details:';
    docNoLabel = 'Quotation NO.:';
    docNo = data.quotation_no || '';
    date = data.date || '';
  } else if (cleanType === 'invoice') {
    docTitle = 'Quotation Details:'; // Use Quotation Details as per attached image structure
    docNoLabel = 'Quotation NO.:';
    // If it is indeed invoice type, override with Invoice
    if (data.invoice_no) {
      docTitle = 'Quotation Details:'; // Standard layout keeps it as Quotation/Invoice Details depending on settings, but let's make it match doc type
      docTitle = 'Invoice Details:';
      docNoLabel = 'Invoice NO.:';
      docNo = data.invoice_no;
    } else {
      docNo = data.quotation_no || '';
    }
    date = data.date || data.invoice_date || '';
  } else if (cleanType === 'proforma invoice' || cleanType === 'proformainvoice') {
    docTitle = 'Quotation Details:';
    docNoLabel = 'Quotation NO.:';
    if (data.proforma_no || data.invoice_no) {
      docTitle = 'Quotation Details:';
      docNoLabel = 'Quotation NO.:'; // Standardizes labels based on Sakthi layout
      docTitle = 'Proforma Invoice Details:';
      docNoLabel = 'Proforma Invoice NO.:';
      docNo = data.proforma_no || data.invoice_no;
    } else {
      docNo = data.quotation_no || '';
    }
    date = data.date || data.proforma_date || '';
  } else if (cleanType === 'delivery challan' || cleanType === 'deliverychallan') {
    docTitle = 'Delivery Challan Details:';
    docNoLabel = 'Delivery Challan NO.:';
    docNo = data.dc_number || '';
    date = data.dc_date || data.date || '';
    paymentTerms = data.remarks || '';
  } else if (cleanType === 'purchase order' || cleanType === 'po') {
    docTitle = 'Purchase Order Details:';
    docNoLabel = 'PO NO.:';
    docNo = data.po_number || '';
    date = data.po_date || '';
  } else if (cleanType === 'credit note' || cleanType === 'creditnote') {
    docTitle = 'Credit Note Details:';
    docNoLabel = 'Credit Note NO.:';
    docNo = data.cn_number || '';
    date = data.cn_date || data.date || '';
  } else if (cleanType === 'debit note' || cleanType === 'debitnote') {
    docTitle = 'Debit Note Details:';
    docNoLabel = 'Debit Note NO.:';
    docNo = data.dn_number || '';
    date = data.dn_date || data.date || '';
  }

  // Client normalization
  const clientName = data.client_name || data.client?.client_name || data.client?.name || data.buyer?.name || data.vendor_name || '';
  const clientAddress = data.billing_address || data.client?.address || data.buyer?.address || data.vendor_address || data.site_address || '';
  const clientGstin = data.gstin || data.client?.gstin || data.buyer?.gstin || data.vendor_gstin || '';

  // Items normalization
  const rawItems = data.items || data.materials || [];
  const items = rawItems.map((item: any, idx: number) => {
    const sno = String(idx + 1);
    const hsn = item.hsn_code || item.sac_code || item.hsn_sac || (item.item as any)?.hsn_code || '';
    const description = item.description || (item.item as any)?.name || item.material_name || '';
    const qty = item.qty !== undefined ? item.qty : (item.quantity !== undefined ? item.quantity : 0);
    const unit = item.uom || item.unit || 'Nos';
    const rate = item.rate !== undefined ? item.rate : (item.base_rate_snapshot !== undefined ? item.base_rate_snapshot : 0);
    
    // Tax percent
    let gstPercent = 18;
    if (item.tax_percent !== undefined) {
      gstPercent = item.tax_percent;
    } else if (item.gst_percent !== undefined) {
      gstPercent = parseFloat(item.gst_percent);
    } else if (item.cgst_percent !== undefined && item.sgst_percent !== undefined) {
      gstPercent = item.cgst_percent + item.sgst_percent;
    } else if (item.igst_percent !== undefined) {
      gstPercent = item.igst_percent;
    }

    const amount = item.line_total !== undefined ? item.line_total : (item.amount !== undefined ? item.amount : (item.total_amount !== undefined ? item.total_amount : 0));
    
    return { sno, hsn, description, qty, unit, rate, gstPercent, amount };
  });

  // Totals normalization
  const taxableAmount = data.subtotal || data.taxable_amount || 0;
  const cgstAmount = data.cgst_amount || (data.total_tax ? data.total_tax / 2 : 0);
  const sgstAmount = data.sgst_amount || (data.total_tax ? data.total_tax / 2 : 0);
  const igstAmount = data.igst_amount || data.total_tax || 0;
  const roundOff = data.round_off || 0;
  const grandTotal = data.grand_total || data.total_amount || data.total || 0;

  // Bank details normalization
  const bankName = data.bank_details?.bank_name || org.bank_details?.bank_name || org.bank_name || '';
  const bankAccNo = data.bank_details?.acc_no || org.bank_details?.acc_no || org.bank_account_no || '';
  const bankIfsc = data.bank_details?.ifsc || org.bank_details?.ifsc || org.bank_ifsc || '';
  const bankBranch = data.bank_details?.branch || org.bank_details?.branch || org.bank_branch || '';

  return {
    company: { companyName, companyAddress, companyGstin, companyPan, companyPhone, companyEmail, logoUrl },
    details: { docTitle, docNoLabel, docNo, date, placeOfSupply, paymentTerms },
    client: { clientName, clientAddress, clientGstin },
    items,
    totals: { taxableAmount, cgstAmount, sgstAmount, igstAmount, roundOff, grandTotal },
    bank: { bankName, bankAccNo, bankIfsc, bankBranch }
  };
}

export async function generateSakthiPdf(
  rawDocData: any,
  organisation: any,
  docType: string,
  templateSettings?: any
): Promise<jsPDF> {
  const norm = normalizeDocumentData(rawDocData, organisation, docType);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Try to load logo if available
  let logoData: { dataUrl: string; width: number; height: number } | null = null;
  if (norm.company.logoUrl && templateSettings?.show_logo !== false) {
    try {
      logoData = await getBase64ImageFromUrl(norm.company.logoUrl);
    } catch (e) {
      console.warn('Failed to load logo via base64, using raw URL instead:', e);
      logoData = { dataUrl: norm.company.logoUrl, width: 100, height: 100 };
    }
  }

  // 1. Draw Header
  // Document Title at the very top centered
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(38, 73, 76); // Dark Teal Color `#26494c`
  doc.text(docType.toUpperCase(), pageWidth / 2, 10, { align: 'center' });

  // Logo rendering (Left side, scaled to fit inside 18x18 square maintaining aspect ratio)
  if (logoData) {
    try {
      const ext = logoData.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const boxSize = 18;
      let drawW = boxSize;
      let drawH = boxSize;
      const ratio = logoData.width / logoData.height;
      if (ratio > 1) {
        drawH = boxSize / ratio;
      } else {
        drawW = boxSize * ratio;
      }
      const dx = 12 + (boxSize - drawW) / 2;
      const dy = 15 + (boxSize - drawH) / 2; // y=15 fits inside border
      doc.addImage(logoData.dataUrl, ext, dx, dy, drawW, drawH);
    } catch (e) {
      console.warn('Error drawing logo in PDF:', e);
    }
  }

  // Centered Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(38, 73, 76);
  doc.text('SAKTHI SOLUTIONS & SERVICES', pageWidth / 2, 19, { align: 'center' });

  // Centered Company Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const addrLines = doc.splitTextToSize(norm.company.companyAddress, pageWidth - 65);
  doc.text(addrLines, pageWidth / 2, 23.5, { align: 'center' }); // Pushed to 23.5

  // Centered Contact Details (GSTIN, PAN, Phone, Email) - split in 2 lines or made small to avoid logo overlap
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  const line1Parts = [];
  if (norm.company.companyGstin) line1Parts.push(`GSTIN: ${norm.company.companyGstin}`);
  if (norm.company.companyPan) line1Parts.push(`PAN: ${norm.company.companyPan}`);
  const line1Text = line1Parts.join(' | ');

  const line2Parts = [];
  if (norm.company.companyPhone) line2Parts.push(`Mobile: ${norm.company.companyPhone}`);
  if (norm.company.companyEmail) line2Parts.push(`Email: ${norm.company.companyEmail}`);
  const line2Text = line2Parts.join(' | ');

  doc.text(line1Text, pageWidth / 2, 27.5, { align: 'center' }); // Pushed to 27.5
  doc.text(line2Text, pageWidth / 2, 31, { align: 'center' }); // Pushed to 31

  let y = 35; // Pushed to 35

  // Divider Line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(12, y, pageWidth - 12, y);

  y += 7;

  // 2. Metadata Section (Two Columns)
  const metaStartY = y;
  
  // Left Column: Customer Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(38, 73, 76);
  doc.text('Customer Details:', 12, y);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(norm.client.clientName.toUpperCase(), 12, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const clientAddrLines = doc.splitTextToSize(norm.client.clientAddress, 85);
  doc.text(clientAddrLines, 12, y + 10);

  const clientAddrHeight = clientAddrLines.length * 3.8;
  if (norm.client.clientGstin) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`GSTIN: ${norm.client.clientGstin}`, 12, y + 10 + clientAddrHeight + 1);
  }

  // Right Column: Document Details
  let rightY = metaStartY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(38, 73, 76);
  doc.text(norm.details.docTitle, 110, rightY);

  const docDetails = [
    { label: norm.details.docNoLabel.replace(':', ''), value: norm.details.docNo || '—' },
    { label: 'Date', value: formatDate(norm.details.date) },
    { label: 'Place of Supply', value: norm.details.placeOfSupply || '—' },
    { label: 'Payment Terms', value: norm.details.paymentTerms || '—' }
  ];

  docDetails.forEach((item) => {
    rightY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(item.label, 110, rightY);
    doc.text(':', 142, rightY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(item.value), 145, rightY);
  });

  const leftHeight = 10 + clientAddrHeight + (norm.client.clientGstin ? 5 : 0);
  const rightHeight = rightY - metaStartY;
  y += Math.max(leftHeight, rightHeight) + 8;

  // 3. Items Table
  const tableRows = norm.items.map((item) => [
    item.sno,
    item.hsn || '—',
    item.description || '—',
    item.qty !== '' ? String(item.qty) : '',
    item.unit || '',
    item.rate !== '' ? fmt(item.rate) : '',
    item.gstPercent !== '' ? `${item.gstPercent}%` : '',
    item.amount !== '' ? fmt(item.amount) : ''
  ]);

  // Pad to minimum of 15 rows to create the visual empty grid
  while (tableRows.length < 15) {
    tableRows.push(['', '', '', '', '', '', '', '']);
  }

  let finalY = y;
  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['S.No', 'HSN', 'Item Description', 'Qty', 'Unit', 'Rate/Unit', 'GST', 'Amount']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255], // Remove header background color (White)
      textColor: [38, 73, 76],    // Dark Teal Text Color
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [200, 200, 200],
      lineWidth: 0.15
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 1.2,
      minCellHeight: 5.6,        // Row heights 16px equivalent (5.6mm)
      lineColor: [200, 200, 200],
      lineWidth: 0.15,
      valign: 'middle'           // Vertically center text in rows
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },  // Increased to 12 to prevent "S.No" text breaking
      1: { cellWidth: 20, halign: 'center' },  // HSN
      2: { cellWidth: 'auto', halign: 'left' }, // Item Description
      3: { cellWidth: 12, halign: 'right' },   // Qty
      4: { cellWidth: 14, halign: 'center' },  // Unit
      5: { cellWidth: 20, halign: 'right' },   // Rate/Unit
      6: { cellWidth: 14, halign: 'center' },  // GST
      7: { cellWidth: 24, halign: 'right' }   // Amount
    },
    didDrawPage: (data) => {
      if (data.cursor) {
        finalY = data.cursor.y;
      }
    }
  });

  finalY = finalY || y + 80;

  // 4. Totals Block (Aligned to right)
  const isInterState =
    norm.details.placeOfSupply &&
    organisation.state &&
    !String(norm.details.placeOfSupply).toLowerCase().includes(String(organisation.state).toLowerCase());

  // Determine dynamic tax percentage
  const activeGstPercent = norm.items.find((it) => parseFloat(String(it.gstPercent)) > 0)?.gstPercent || 18;
  const combinedRate = parseFloat(String(activeGstPercent));
  const halfRate = (combinedRate / 2).toFixed(1);

  const totalsRows = [];
  totalsRows.push(['Taxable Amount', fmt(norm.totals.taxableAmount)]);
  
  if (isInterState) {
    totalsRows.push([`IGST (${combinedRate.toFixed(1)}%)`, fmt(norm.totals.igstAmount)]);
  } else {
    const cgstVal = norm.totals.cgstAmount || (norm.totals.igstAmount / 2);
    const sgstVal = norm.totals.sgstAmount || (norm.totals.igstAmount / 2);
    totalsRows.push([`CGST (${halfRate}%)`, fmt(cgstVal)]);
    totalsRows.push([`SGST (${halfRate}%)`, fmt(sgstVal)]);
  }

  totalsRows.push(['Round Off', fmt(norm.totals.roundOff)]);
  totalsRows.push(['Total Amount', `Rs. ${fmt(norm.totals.grandTotal)}`]);

  const pageHeight = doc.internal.pageSize.getHeight();
  let totalsEndY = finalY;

  autoTable(doc, {
    startY: Math.max(finalY + 2, pageHeight - 65), // Fixed totals at bottom
    margin: { left: pageWidth - 12 - 75, right: 12 }, // 75mm wide aligned right
    body: totalsRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 1.8,
      lineColor: [200, 200, 200],
      lineWidth: 0.15
    },
    columnStyles: {
      0: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
      1: { cellWidth: 30, halign: 'right' }
    },
    showHead: false,
    didDrawPage: (data) => {
      if (data.cursor) {
        totalsEndY = data.cursor.y;
      }
    },
    didParseCell: (data) => {
      // Total Amount row styling
      if (data.row.index === totalsRows.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8.5;
      }
    }
  });

  // 5. Footer Details (Bank Info and Terms & Conditions)
  let footerY = Math.max(totalsEndY + 4, pageHeight - 40); // Fixed footer at bottom
  if (totalsEndY + 4 > pageHeight - 40 || footerY + 28 > pageHeight - 6) {
    doc.addPage();
    footerY = 18;
  }

  // Pre-fill Bank details array
  const bankText = [
    { text: 'Bank Details:', bold: true },
    { text: `Bank: ${norm.bank.bankName || 'CITY UNION BANK'}` },
    { text: `Account #: ${norm.bank.bankAccNo || '285120000207581'}` },
    { text: `IFSC Code: ${norm.bank.bankIfsc || 'CIUB0000285'}` },
    { text: `Branch: ${norm.bank.bankBranch || 'Poonamallee'}` }
  ];

  // Pre-fill Terms conditions list
  const termsList: string[] = [];
  if (rawDocData.terms_conditions || rawDocData.terms) {
    try {
      const termsObj = typeof rawDocData.terms_conditions === 'string'
        ? JSON.parse(rawDocData.terms_conditions)
        : (rawDocData.terms_conditions || rawDocData.terms);
        
      if (termsObj && termsObj.sections) {
        termsObj.sections.forEach((sec: any) => {
          if (sec.items) {
            sec.items.forEach((it: any) => termsList.push(it.content));
          }
        });
      } else if (Array.isArray(termsObj)) {
        termsList.push(...termsObj.map(t => typeof t === 'string' ? t : t.content || ''));
      } else if (typeof termsObj === 'string') {
        termsList.push(...termsObj.split('\n').filter(Boolean));
      }
    } catch {
      termsList.push(...String(rawDocData.terms_conditions || rawDocData.terms || '').split('\n').filter(Boolean));
    }
  }

  // Fallback default terms if empty
  if (termsList.length === 0) {
    termsList.push(
      `GST: ${combinedRate}%`,
      'PAYMENT: PO, 100% AGAINST PROFORMA INVOICE',
      'TRANSPORT: AS ABOVE (IF NOT MENTIONED, IT WILL BE CLIENT\'S SCOPE)',
      'DELIVERY: 3-4 DAYS FROM THE DATE OF ADVANCE.'
    );
  }

  const termsText = [
    { text: 'Terms and Conditions:', bold: true },
    ...termsList.map((t) => ({ text: t, bold: false }))
  ];

  // Draw Bank Details (Left side - Width: 60mm)
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  let currentLeftY = footerY;
  bankText.forEach((item) => {
    if (item.bold) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(38, 73, 76);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
    }
    doc.text(item.text, 12, currentLeftY);
    currentLeftY += 4.2;
  });

  // Draw Terms and Conditions (Center - Width: 66mm)
  let currentCenterY = footerY;
  termsText.forEach((item, idx) => {
    if (item.bold) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(38, 73, 76);
      doc.text(item.text, 78, currentCenterY);
      currentCenterY += 3.5;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5); // Reduced body font size
      doc.setTextColor(0, 0, 0);
      const prefix = `${idx}. `;
      const fullText = prefix + item.text;
      const lines = doc.splitTextToSize(fullText, 66);
      doc.text(lines, 78, currentCenterY);
      currentCenterY += lines.length * 3.0; // tighter spacing for smaller font
    }
  });

  // Draw Authorised Signatory Block (Right side - Width: 48mm)
  let currentRightY = footerY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(38, 73, 76);
  const forText = `For ${organisation.name || 'SAKTHI SOLUTIONS & SERVICES'}`;
  const forLines = doc.splitTextToSize(forText, 48);
  forLines.forEach((line: string) => {
    doc.text(line, 150, currentRightY);
    currentRightY += 4;
  });

  // Space for signature
  currentRightY += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('Authorised Signatory', 150, currentRightY);

  // Draw outer page border around all pages except the top document title area
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(38, 73, 76); // Dark Teal Color
    doc.setLineWidth(0.25);
    doc.rect(6, 13, pageWidth - 12, pageHeight - 19);
  }

  return doc;
}
