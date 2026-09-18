import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureRobotoFontsForJsPdf } from './registerRobotoFonts';

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

  // Party normalization (Customer vs Vendor)
  const isPO = cleanType === 'purchase order' || cleanType === 'po';
  const partyHeader = isPO ? 'Vendor Details:' : 'Customer Details:';
  const clientName = data.client_name || data.client?.client_name || data.client?.name || data.buyer?.name || data.vendor?.company_name || data.vendor?.name || data.vendor_name || '';
  const clientAddress = data.billing_address || data.client?.address || data.buyer?.address || data.vendor?.address || data.vendor_address || data.site_address || data.delivery_location || '';
  const clientGstin = data.gstin || data.client?.gstin || data.buyer?.gstin || data.vendor?.gstin || data.vendor?.gst_number || data.vendor_gstin || '';

  // Items normalization
  const rawItems = data.items || data.materials || [];
  const items = rawItems.map((item: any, idx: number) => {
    const sno = String(idx + 1);
    const hsn = item.hsn_code || item.sac_code || item.hsn_sac || (item.item as any)?.hsn_code || '';
    const itemName = item.item_name || item.name || item.material_name || (item.item as any)?.name || item.description || '';
    const itemDesc = item.description && item.description !== itemName ? `\n${item.description}` : '';
    const description = `${itemName}${itemDesc}`.trim();
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
    client: { clientName, clientAddress, clientGstin, partyHeader },
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
  await ensureRobotoFontsForJsPdf(doc);
  doc.setFont('Roboto', 'normal');
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
  // Document Title at the very top centered (Bold)
  doc.setFont('Roboto', 'bold');
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

  // Centered Company Name (Bold)
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(38, 73, 76);
  doc.text('SAKTHI SOLUTIONS & SERVICES', pageWidth / 2, 19, { align: 'center' });

  // Centered Company Address (Normal)
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const addrLines = doc.splitTextToSize(norm.company.companyAddress, pageWidth - 65);
  doc.text(addrLines, pageWidth / 2, 23.5, { align: 'center' });

  // Centered Contact Details (GSTIN, PAN, Phone, Email) - split in 2 lines (Normal)
  doc.setFont('Roboto', 'normal');
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

  doc.text(line1Text, pageWidth / 2, 27.5, { align: 'center' });
  doc.text(line2Text, pageWidth / 2, 31, { align: 'center' });

  let y = 35;

  // Divider Line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(12, y, pageWidth - 12, y);

  y += 7;

  // 2. Metadata Section (Two Columns)
  const metaStartY = y;
  
  // Left Column: Customer or Vendor Details (Bold section title)
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(38, 73, 76);
  doc.text((norm.client as any).partyHeader || 'Customer Details:', 12, y);
  
  // Party Name (Bold emphasis)
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(norm.client.clientName.toUpperCase(), 12, y + 5);

  // Party Address (Normal)
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const clientAddrLines = doc.splitTextToSize(norm.client.clientAddress, 85);
  doc.text(clientAddrLines, 12, y + 10);

  const clientAddrHeight = clientAddrLines.length * 3.8;
  if (norm.client.clientGstin) {
    // GSTIN label Medium, value Normal
    doc.setFont('Roboto', 'medium');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('GSTIN: ', 12, y + 10 + clientAddrHeight + 1);
    const gstinLabelW = doc.getTextWidth('GSTIN: ');
    doc.setFont('Roboto', 'normal');
    doc.text(norm.client.clientGstin, 12 + gstinLabelW, y + 10 + clientAddrHeight + 1);
  }

  // Right Column: Document Details (Bold section title)
  let rightY = metaStartY;
  doc.setFont('Roboto', 'bold');
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
    doc.setFont('Roboto', 'medium');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(item.label, 110, rightY);
    doc.text(':', 142, rightY);
    doc.setFont('Roboto', 'normal');
    doc.text(String(item.value), 145, rightY);
  });

  const leftHeight = 10 + clientAddrHeight + (norm.client.clientGstin ? 5 : 0);
  const rightHeight = rightY - metaStartY;
  y += Math.max(leftHeight, rightHeight) + 8;

  // 3. Items Table - dynamic columns based on templateSettings
  const opt = templateSettings?.column_settings?.optional || {};
  const lbl = templateSettings?.column_settings?.labels || {};

  interface SakthiCol {
    key: string;
    header: string;
    cellWidth: number | 'auto';
    halign: 'center' | 'left' | 'right';
    getValue: (item: typeof norm.items[0]) => string;
    include: boolean;
  }

  const colDefinitions: SakthiCol[] = [
    {
      key: 'sno',
      header: 'S.No',
      cellWidth: 12,
      halign: 'center',
      getValue: (it) => it.sno,
      include: opt.sno !== false,
    },
    {
      key: 'hsn_code',
      header: 'HSN',
      cellWidth: 20,
      halign: 'center',
      getValue: (it) => it.hsn || '—',
      include: opt.hsn_code !== false,
    },
    {
      key: 'description',
      header: lbl.item || 'Item Description',
      cellWidth: 'auto',
      halign: 'left',
      getValue: (it) => it.description || '—',
      include: opt.item !== false && opt.description !== false,
    },
    {
      key: 'qty',
      header: 'Qty',
      cellWidth: 14,
      halign: 'right',
      getValue: (it) => (it.qty !== '' ? String(it.qty) : ''),
      include: opt.qty !== false,
    },
    {
      key: 'uom',
      header: 'Unit',
      cellWidth: 14,
      halign: 'center',
      getValue: (it) => it.unit || '',
      include: opt.uom !== false && opt.unit !== false,
    },
    {
      key: 'rate',
      header: lbl.rate_after_discount || 'Rate/Unit',
      cellWidth: 22,
      halign: 'left',
      getValue: (it) => (it.rate !== '' ? fmt(it.rate) : ''),
      include: opt.rate !== false && opt.rate_after_discount !== false,
    },
    {
      key: 'tax_percent',
      header: 'GST',
      cellWidth: 14,
      halign: 'center',
      getValue: (it) => (it.gstPercent !== '' ? `${it.gstPercent}%` : ''),
      include: opt.tax_percent !== false,
    },
    {
      key: 'line_total',
      header: 'Amount',
      cellWidth: 24,
      halign: 'left',
      getValue: (it) => (it.amount !== '' ? fmt(it.amount) : ''),
      include: opt.line_total !== false && opt.base_amount !== false,
    },
  ];

  const activeCols = colDefinitions.filter(c => c.include);
  const finalCols = activeCols.length > 0 ? activeCols : [colDefinitions[2], colDefinitions[7]];

  const tableRows = norm.items.map((item) => finalCols.map(c => c.getValue(item)));

  // Dynamically calculate target rows so the empty grid fills seamlessly down to the totals block
  const pageHeight = doc.internal.pageSize.getHeight();
  const targetBottomY = pageHeight - 71; // ~226mm on A4
  const availableTableHeight = targetBottomY - y - 6.5; // subtract header height
  const targetRows = Math.max(norm.items.length, Math.max(15, Math.floor(availableTableHeight / 5.6)));

  while (tableRows.length < targetRows) {
    tableRows.push(finalCols.map(() => ''));
  }

  const dynamicColumnStyles: Record<number, any> = {};
  finalCols.forEach((col, idx) => {
    dynamicColumnStyles[idx] = { cellWidth: col.cellWidth, halign: col.halign };
  });

  let finalY = y;
  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [finalCols.map(c => c.header)],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255], // Remove header background color (White)
      textColor: [38, 73, 76],    // Dark Teal Text Color
      font: 'Roboto',
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [200, 200, 200],
      lineWidth: 0.15
    },
    styles: {
      font: 'Roboto',
      fontStyle: 'normal',
      fontSize: 8,
      cellPadding: 1.2,
      minCellHeight: 5.6,        // Row heights 16px equivalent (5.6mm)
      lineColor: [200, 200, 200],
      lineWidth: 0.15,
      valign: 'middle'           // Vertically center text in rows
    },
    columnStyles: dynamicColumnStyles,
    didDrawPage: (data) => {
      if (data.cursor) {
        finalY = data.cursor.y;
      }
    }
  });

  finalY = finalY || y + 80;

  // 4. Totals Block (Aligned to right, starting immediately below items table)
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

  // Totals table starts immediately below the items table (eliminates blank space between empty rows & total)
  const totalsStartY = finalY + 0.5;
  let totalsEndY = totalsStartY;

  autoTable(doc, {
    startY: totalsStartY,
    margin: { left: pageWidth - 12 - 75, right: 12 }, // 75mm wide aligned right
    body: totalsRows,
    theme: 'grid',
    styles: {
      font: 'Roboto',
      fontStyle: 'normal',
      fontSize: 8,
      cellPadding: 1.8,
      lineColor: [200, 200, 200],
      lineWidth: 0.15
    },
    columnStyles: {
      0: { cellWidth: 45, halign: 'right', font: 'Roboto', fontStyle: 'medium' },
      1: { cellWidth: 30, halign: 'right', font: 'Roboto', fontStyle: 'normal' }
    },
    showHead: false,
    didDrawPage: (data) => {
      if (data.cursor) {
        totalsEndY = data.cursor.y;
      }
    },
    didParseCell: (data) => {
      // Total Amount row styling (Bold emphasis)
      if (data.row.index === totalsRows.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.font = 'Roboto';
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8.5;
      }
    }
  });

  // 5. Terms & Conditions (Left side of Total table with 9px font) & Bank Details
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

  // Left column coordinates: from x = 12 to x = 121 (opposite Totals table which starts at x = 123)
  const leftColX = 12;
  const leftColWidth = 109; // 109mm width with 2mm clearance before Totals table

  let currentTermsY = totalsStartY + 3.5;

  // Draw Terms & Conditions with 9px Roboto fonts
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(38, 73, 76);
  doc.text('Terms and Conditions:', leftColX, currentTermsY);
  currentTermsY += 4.5;

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  termsList.forEach((term, idx) => {
    const prefix = `${idx + 1}. `;
    const fullText = prefix + term;
    const lines = doc.splitTextToSize(fullText, leftColWidth);
    doc.text(lines, leftColX, currentTermsY);
    currentTermsY += lines.length * 4.0;
  });

  // Draw Bank Details below Terms & Conditions on the left
  let currentBankY = currentTermsY + 2.5;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(38, 73, 76);
  doc.text('Bank Details:', leftColX, currentBankY);
  currentBankY += 4.0;

  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  const bankItems = [
    { label: 'Bank: ', value: norm.bank.bankName || 'CITY UNION BANK' },
    { label: 'Account #: ', value: norm.bank.bankAccNo || '285120000207581' },
    { label: 'IFSC Code: ', value: `${norm.bank.bankIfsc || 'CIUB0000285'}   Branch: ${norm.bank.bankBranch || 'Poonamallee'}` }
  ];

  bankItems.forEach((item) => {
    doc.setFont('Roboto', 'medium');
    doc.text(item.label, leftColX, currentBankY);
    const labelW = doc.getTextWidth(item.label);
    doc.setFont('Roboto', 'normal');
    doc.text(item.value, leftColX + labelW, currentBankY);
    currentBankY += 3.6;
  });

  // Draw Authorised Signatory Block on the right side below Totals table (centered under Totals table)
  let currentRightY = totalsEndY + 3;
  doc.setFont('Roboto', 'medium');
  doc.setFontSize(8.5);
  doc.setTextColor(38, 73, 76);
  const forText = `For ${organisation.name || 'SAKTHI SOLUTIONS & SERVICES'}`;
  const forLines = doc.splitTextToSize(forText, 65);
  forLines.forEach((line: string) => {
    doc.text(line, 138, currentRightY);
    currentRightY += 4.0;
  });

  // Space for signature
  currentRightY += 12;

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Authorised Signatory', 145, currentRightY);

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
