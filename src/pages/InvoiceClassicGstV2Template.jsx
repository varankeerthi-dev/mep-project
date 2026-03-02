import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateInvoiceClassicGstV2 = (data, organisation, templateSettings = {}) => {
  const {
    invoice_no,
    invoice_date,
    po_no,
    po_date,
    eway_bill,
    buyer,
    consignee,
    items,
    totals,
    bank_details,
    remarks,
    authorised_signatory,
    company_name_color
  } = data;

  const {
    show_logo = true,
    show_bank_details: showBankDetails = true,
    show_signature: showSignature = true,
    show_remarks = true,
    show_po_no = true,
    show_eway_bill = true,
    column_settings: colSettings = {}
  } = templateSettings;

  const optionalCols = colSettings.optional || {};
  const showHsnCode = optionalCols.hsn_code !== false;
  const showGstPercent = optionalCols.tax_percent !== false;
  const showRate = optionalCols.rate !== false;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  const companyColor = company_name_color && company_name_color.startsWith('#') 
    ? company_name_color 
    : '#000000';

  let currentY = margin;

  const drawHorizontalLine = (y) => {
    doc.setDrawColor(200);
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageWidth - margin, y);
  };

  const drawVerticalLine = (x, y1, y2) => {
    doc.setDrawColor(200);
    doc.line(x, y1, x, y2);
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  let leftColumnX = margin;
  let rightColumnX = pageWidth - margin - 60;
  let centerX = pageWidth / 2;

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`GSTIN: ${organisation.gstin || '-'}`, leftColumnX, currentY + 3);
  doc.text(`PAN: ${organisation.pan || '-'}`, leftColumnX, currentY + 8);
  if (organisation.tan) {
    doc.text(`TAN: ${organisation.tan}`, leftColumnX, currentY + 13);
  }
  if (organisation.cin_no) {
    doc.text(`CIN: ${organisation.cin_no}`, leftColumnX, currentY + 18);
  }

  if (show_logo && organisation.logo_url) {
    try {
      const logoMaxHeight = 35;
      const logoMaxWidth = 50;
      doc.addImage(organisation.logo_url, 'PNG', centerX - logoMaxWidth/2, currentY, logoMaxWidth, logoMaxHeight);
    } catch (e) {
      console.log('Logo error:', e);
    }
  }

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(companyColor);
  doc.text(organisation.name || 'Company Name', centerX, currentY + 42, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  const orgAddress = organisation.address || 'Company Address';
  const addressLines = doc.splitTextToSize(orgAddress, 120);
  doc.text(addressLines, centerX, currentY + 48, { align: 'center' });

  let addressY = currentY + 48 + (addressLines.length * 4);
  if (organisation.phone) {
    doc.text(`Phone: ${organisation.phone}`, centerX, addressY, { align: 'center' });
    addressY += 4;
  }
  if (organisation.email) {
    doc.text(`Email: ${organisation.email}`, centerX, addressY, { align: 'center' });
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('TAX INVOICE', pageWidth - margin - 5, currentY + 5, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let rightY = currentY + 12;
  doc.text(`Invoice No: ${invoice_no || '-'}`, pageWidth - margin - 5, rightY, { align: 'right' });
  rightY += 5;
  doc.text(`Date: ${invoice_date || '-'}`, pageWidth - margin - 5, rightY, { align: 'right' });
  rightY += 5;
  if (show_po_no && po_no) {
    doc.text(`PO No: ${po_no}`, pageWidth - margin - 5, rightY, { align: 'right' });
    rightY += 5;
  }
  if (show_po_no && po_date) {
    doc.text(`PO Date: ${po_date}`, pageWidth - margin - 5, rightY, { align: 'right' });
    rightY += 5;
  }
  if (show_eway_bill && eway_bill) {
    doc.text(`E-Way Bill: ${eway_bill}`, pageWidth - margin - 5, rightY, { align: 'right' });
  }

  currentY = Math.max(addressY + 10, rightY + 10);
  drawHorizontalLine(currentY);

  const billingSectionHeight = 40;
  const billBoxWidth = contentWidth / 2 - 2;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', leftColumnX + 2, currentY + 6);
  doc.text('Ship To:', leftColumnX + billBoxWidth + 6, currentY + 6);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(buyer?.name || '-', leftColumnX + 2, currentY + 12);
  
  const buyerAddrLines = doc.splitTextToSize(buyer?.address || '-', billBoxWidth - 4);
  doc.text(buyerAddrLines, leftColumnX + 2, currentY + 17);
  
  let buyerInfoY = currentY + 17 + (buyerAddrLines.length * 4);
  doc.text(`GSTIN: ${buyer?.gstin || '-'}`, leftColumnX + 2, buyerInfoY);
  buyerInfoY += 5;
  doc.text(`State: ${buyer?.state || '-'} ${buyer?.state_code ? `(${buyer.state_code})` : ''}`, leftColumnX + 2, buyerInfoY);

  doc.text(consignee?.name || '-', leftColumnX + billBoxWidth + 6, currentY + 12);
  
  const consigneeAddrLines = doc.splitTextToSize(consignee?.address || '-', billBoxWidth - 4);
  doc.text(consigneeAddrLines, leftColumnX + billBoxWidth + 6, currentY + 17);
  
  let consigneeInfoY = currentY + 17 + (consigneeAddrLines.length * 4);
  doc.text(`GSTIN: ${consignee?.gstin || '-'}`, leftColumnX + billBoxWidth + 6, consigneeInfoY);
  consigneeInfoY += 5;
  doc.text(`State: ${consignee?.state || '-'} ${consignee?.state_code ? `(${consignee.state_code})` : ''}`, leftColumnX + billBoxWidth + 6, consigneeInfoY);

  currentY += billingSectionHeight;
  drawHorizontalLine(currentY);

  const tableColumns = [
    { header: 'S.No', key: 'sno', width: 12 },
  ];
  
  if (showHsnCode) {
    tableColumns.push({ header: 'HSN/SAC', key: 'hsn_code', width: 22 });
  }
  
  tableColumns.push(
    { header: 'Item Description', key: 'description', width: showHsnCode ? 55 : 77 },
    { header: 'Qty', key: 'qty', width: 15, align: 'right' },
    { header: 'Unit', key: 'unit', width: 15 }
  );
  
  if (showRate) {
    tableColumns.push({ header: 'Rate/Unit', key: 'rate', width: 22, align: 'right' });
  }
  
  if (showGstPercent) {
    tableColumns.push({ header: 'GST %', key: 'gst_percent', width: 15, align: 'right' });
  }
  
  tableColumns.push({ header: 'Amount', key: 'amount', width: 25, align: 'right' });

  const tableBody = (items || []).map((item, index) => {
    const row = {
      sno: index + 1,
      description: item.description || item.item_name || '-',
      qty: item.qty || 0,
      unit: item.unit || '-'
    };
    
    if (showHsnCode) {
      row.hsn_code = item.hsn_code || item.hsn_sac || '-';
    }
    if (showRate) {
      row.rate = formatCurrency(item.rate || 0);
    }
    if (showGstPercent) {
      row.gst_percent = `${item.gst_percent || item.tax_percent || 0}%`;
    }
    row.amount = formatCurrency(item.amount || item.line_total || 0);
    
    return row;
  });

  autoTable(doc, {
    startY: currentY,
    head: [tableColumns.map(col => col.header)],
    body: tableBody.map(row => tableColumns.map(col => row[col.key])),
    theme: 'grid',
    headStyles: { 
      fillColor: [240, 240, 240], 
      textColor: 0, 
      fontStyle: 'bold', 
      fontSize: 8 
    },
    styles: { 
      fontSize: 8, 
      cellPadding: 2.5 
    },
    columnStyles: tableColumns.reduce((acc, col, idx) => {
      if (col.align) {
        acc[idx] = { halign: col.align };
      }
      if (col.key === 'description') {
        acc[idx] = { ...acc[idx], cellWidth: col.width };
      }
      return acc;
    }, {})
  });

  currentY = doc.lastAutoTable.finalY;

  const totalsSectionWidth = 70;
  const totalsX = pageWidth - margin - totalsSectionWidth;
  
  doc.setFontSize(9);
  
  const basicAmount = totals?.taxable_value || totals?.basic_amount || 0;
  doc.text('Basic Amount:', totalsX, currentY + 6);
  doc.text(formatCurrency(basicAmount), pageWidth - margin - 2, currentY + 6, { align: 'right' });

  let taxY = currentY + 12;
  
  if (totals?.igst > 0) {
    doc.text(`IGST (${totals.igst_rate || 0}%):`, totalsX, taxY);
    doc.text(formatCurrency(totals.igst), pageWidth - margin - 2, taxY, { align: 'right' });
  } else {
    if (totals?.cgst > 0) {
      doc.text(`CGST (${totals.cgst_rate || 0}%):`, totalsX, taxY);
      doc.text(formatCurrency(totals.cgst), pageWidth - margin - 2, taxY, { align: 'right' });
      taxY += 6;
    }
    if (totals?.sgst > 0) {
      doc.text(`SGST (${totals.sgst_rate || 0}%):`, totalsX, taxY);
      doc.text(formatCurrency(totals.sgst), pageWidth - margin - 2, taxY, { align: 'right' });
      taxY += 6;
    }
  }

  if (totals?.round_off) {
    taxY += 6;
    doc.text('Round Off:', totalsX, taxY);
    doc.text(formatCurrency(totals.round_off), pageWidth - margin - 2, taxY, { align: 'right' });
  }

  taxY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Net Value:', totalsX, taxY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(totals?.invoice_value || totals?.total_amount || totals?.net_value || 0), pageWidth - margin - 2, taxY, { align: 'right' });

  currentY = taxY + 10;
  drawHorizontalLine(currentY);

  doc.setFontSize(9);
  doc.text(`Amount in Words: INR ${totals?.amount_words || '-'}`, margin, currentY + 5);
  
  currentY += 12;
  drawHorizontalLine(currentY);

  let footerY = currentY + 5;

  if (show_remarks && remarks) {
    doc.setFont('helvetica', 'bold');
    doc.text('Remarks:', margin, footerY);
    doc.setFont('helvetica', 'normal');
    const remarksLines = doc.splitTextToSize(remarks, contentWidth / 2 - 10);
    doc.text(remarksLines, margin, footerY + 5);
    footerY += 5 + (remarksLines.length * 4);
  }

  if (showBankDetails && bank_details) {
    doc.setFont('helvetica', 'bold');
    doc.text('Bank Details:', margin, footerY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bank: ${bank_details.bank_name || '-'}`, margin, footerY + 5);
    doc.text(`A/c No: ${bank_details.acc_no || '-'}`, margin, footerY + 10);
    doc.text(`Branch: ${bank_details.branch || '-'}`, margin, footerY + 15);
    doc.text(`IFSC: ${bank_details.ifsc || '-'}`, margin, footerY + 20);
  }

  const signX = pageWidth - margin - 40;
  
  doc.setFontSize(9);
  doc.text(`For ${organisation.name || 'Organisation'}`, signX, footerY);
  
  if (showSignature && authorised_signatory?.url) {
    try {
      doc.addImage(authorised_signatory.url, 'PNG', signX, footerY + 3, 30, 12);
    } catch (e) {}
  }
  
  doc.text(authorised_signatory?.name || 'Authorised Signatory', signX, footerY + 25);

  const pageCount = doc.internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  return doc;
};

export default generateInvoiceClassicGstV2;
