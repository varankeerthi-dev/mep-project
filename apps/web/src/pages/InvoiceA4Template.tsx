import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates a Tax Invoice PDF with the "A4" template layout.
 * This function is designed to be used with the document extraction and generation task.
 */
export const generateInvoiceA4 = (data, organisation) => {
  const {
    invoice_no,
    invoice_date,
    po_no,
    po_date,
    payment_terms,
    due_date,
    buyer,
    consignee,
    items,
    totals,
    transport,
    bank_details,
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
  const colWidth = (pageWidth - 2 * margin) / 2;

  // --- PAGE BORDER ---
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10); // Main outer border
  doc.rect(6, 6, pageWidth - 12, pageHeight - 12); // Elegant double-line effect

  // Helper to draw horizontal line
  const hLine = (y) => {
    doc.setDrawColor(200);
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageWidth - margin, y);
  };

  // Helper to draw vertical line
  const vLine = (x, y1, y2) => {
    doc.setDrawColor(200);
    doc.line(x, y1, x, y2);
  };

  // --- HEADER SECTION ---
  if (organisation.logo_url) {
    try {
      doc.addImage(organisation.logo_url, 'PNG', margin, margin, 25, 25);
    } catch (e) {}
  }

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`GSTIN: ${organisation.gstin || '-'}`, pageWidth - margin - 40, margin + 5);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Tax Invoice', pageWidth / 2, margin + 10, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`GST No: ${organisation.gstin || '-'} | PAN No: ${organisation.pan || '-'} | TAN No: ${organisation.tan || '-'}`, pageWidth / 2, margin + 15, { align: 'center' });

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(organisation.name || 'Company Name', pageWidth / 2, margin + 25, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const orgAddress = organisation.address || 'Company Address';
  const orgAddressLines = doc.splitTextToSize(orgAddress, 150);
  doc.text(orgAddressLines, pageWidth / 2, margin + 30, { align: 'center' });
  
  let currentY = margin + 30 + (orgAddressLines.length * 4);
  doc.text(`Email: ${organisation.email || '-'} | Website: ${organisation.website || '-'} | Mobile: ${organisation.phone || '-'}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;
  doc.text(`MSME/Udyam No: ${organisation.msme_no || '-'}`, pageWidth / 2, currentY, { align: 'center' });

  currentY += 10;
  hLine(currentY);

  // --- BUYER / CONSIGNEE & INVOICE DETAILS ---
  const detailsYStart = currentY;
  const detailsHeight = 50;
  
  // Buyer (Bill to)
  doc.setFont('helvetica', 'bold');
  doc.text('Buyer (Bill to):', margin + 2, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(buyer.name || '-', margin + 2, currentY + 10);
  const buyerAddressLines = doc.splitTextToSize(buyer.address || '-', colWidth - 5);
  doc.text(buyerAddressLines, margin + 2, currentY + 15);
  let buyerInfoY = currentY + 15 + (buyerAddressLines.length * 4);
  doc.text(`State: ${buyer.state || '-'} (${buyer.state_code || '-'})`, margin + 2, buyerInfoY);
  doc.text(`GSTIN: ${buyer.gstin || '-'}`, margin + 2, buyerInfoY + 4);
  doc.text(`Mobile: ${buyer.mobile || '-'}`, margin + 2, buyerInfoY + 8);

  // Consignee (Ship to)
  vLine(margin + colWidth, detailsYStart, detailsYStart + detailsHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('Consignee (Ship to):', margin + colWidth + 2, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(consignee.name || '-', margin + colWidth + 2, currentY + 10);
  const consigneeAddressLines = doc.splitTextToSize(consignee.address || '-', colWidth - 5);
  doc.text(consigneeAddressLines, margin + colWidth + 2, currentY + 15);
  let consigneeInfoY = currentY + 15 + (consigneeAddressLines.length * 4);
  doc.text(`State: ${consignee.state || '-'} (${consignee.state_code || '-'})`, margin + colWidth + 2, consigneeInfoY);
  doc.text(`GSTIN: ${consignee.gstin || '-'}`, margin + colWidth + 2, consigneeInfoY + 4);
  doc.text(`Mobile: ${consignee.mobile || '-'}`, margin + colWidth + 2, consigneeInfoY + 8);

  // Invoice Details (Right floating-ish overlay in the grid if needed, but here structured)
  const invDetailsX = pageWidth - margin - 50;
  doc.setDrawColor(0);
  doc.rect(invDetailsX - 2, currentY + 2, 50, 25);
  doc.setFontSize(8);
  doc.text(`Inv No: ${invoice_no}`, invDetailsX, currentY + 7);
  doc.text(`Date: ${invoice_date}`, invDetailsX, currentY + 11);
  doc.text(`PO No: ${po_no || '-'}`, invDetailsX, currentY + 15);
  doc.text(`PO Date: ${po_date || '-'}`, invDetailsX, currentY + 19);
  doc.text(`Due Date: ${due_date || '-'}`, invDetailsX, currentY + 23);

  currentY += detailsHeight;
  hLine(currentY);

  // --- LINE ITEMS TABLE ---
  autoTable(doc, {
    startY: currentY,
    head: [['SI', 'HSN/SAC', 'Description of Goods', 'Quantity', 'Unit', 'Rate', 'Per', 'Disc %', 'GST %', 'Amount']],
    body: items.map((item, index) => [
      index + 1,
      item.hsn_sac || '-',
      item.description || '-',
      item.qty || 0,
      item.unit || '-',
      item.rate || 0,
      item.per || '-',
      item.disc_percent || 0,
      item.gst_percent || 0,
      item.amount || 0
    ]),
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 20 },
      3: { halign: 'right' },
      5: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' }
    }
  });

  currentY = doc.lastAutoTable.finalY;

  // --- TOTALS & LOGISTICS ---
  const totalsYStart = currentY;
  const totalsHeight = 35;

  // Transport Details
  doc.setFontSize(8);
  doc.text(`Transporter: ${transport.transporter || '-'}`, margin + 2, currentY + 5);
  doc.text(`Destination: ${transport.destination || '-'}`, margin + 2, currentY + 9);
  doc.text(`Vehicle No: ${transport.vehicle_no || '-'}`, margin + 2, currentY + 13);
  doc.text(`E-Way Bill: ${transport.eway_bill || '-'}`, margin + 2, currentY + 17);

  // Totals
  vLine(pageWidth - margin - 60, totalsYStart, totalsYStart + totalsHeight);
  const totalLabelX = pageWidth - margin - 58;
  const totalValueX = pageWidth - margin - 2;

  doc.text('Total Quantity:', totalLabelX, currentY + 5);
  doc.text(String(totals.qty || 0), totalValueX, currentY + 5, { align: 'right' });
  
  doc.text('Taxable Value:', totalLabelX, currentY + 10);
  doc.text(String(totals.taxable_value || 0), totalValueX, currentY + 10, { align: 'right' });

  if (totals.igst > 0) {
    doc.text('IGST:', totalLabelX, currentY + 15);
    doc.text(String(totals.igst || 0), totalValueX, currentY + 15, { align: 'right' });
  } else {
    doc.text('CGST:', totalLabelX, currentY + 15);
    doc.text(String(totals.cgst || 0), totalValueX, currentY + 15, { align: 'right' });
    doc.text('SGST:', totalLabelX, currentY + 20);
    doc.text(String(totals.sgst || 0), totalValueX, currentY + 20, { align: 'right' });
  }

  doc.text('Round Off:', totalLabelX, currentY + 25);
  doc.text(String(totals.round_off || 0), totalValueX, currentY + 25, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Value:', totalLabelX, currentY + 31);
  doc.text(String(totals.invoice_value || 0), totalValueX, currentY + 31, { align: 'right' });

  currentY += totalsHeight;
  hLine(currentY);

  // Amount in Words
  doc.setFont('helvetica', 'normal');
  doc.text(`Amount in Words: INR ${totals.amount_words || '-'}`, margin + 2, currentY + 5);
  currentY += 8;
  hLine(currentY);

  // --- TAX SUMMARY TABLE ---
  autoTable(doc, {
    startY: currentY,
    head: [['HSN/SAC', 'Taxable Value', 'Central Tax Rate', 'Central Tax Amount', 'State Tax Rate', 'State Tax Amount', 'Total Tax Amount']],
    body: (data.tax_summary || []).map(row => [
      row.hsn_sac || '-',
      row.taxable_value || 0,
      row.cgst_rate || '0%',
      row.cgst_amount || 0,
      row.sgst_rate || '0%',
      row.sgst_amount || 0,
      row.total_tax || 0
    ]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
  });

  currentY = doc.lastAutoTable.finalY + 5;

  // --- BANK DETAILS & FOOTER ---
  const footerYStart = currentY;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Bank Details:', margin + 2, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`A/c Name: ${bank_details.acc_name || '-'}`, margin + 2, currentY + 4);
  doc.text(`Bank Name: ${bank_details.bank_name || '-'}`, margin + 2, currentY + 8);
  doc.text(`A/c No: ${bank_details.acc_no || '-'}`, margin + 2, currentY + 12);
  doc.text(`Branch: ${bank_details.branch || '-'}`, margin + 2, currentY + 16);
  doc.text(`IFS Code: ${bank_details.ifsc || '-'}`, margin + 2, currentY + 20);

  // Terms & Conditions
  const termsX = pageWidth / 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions:', termsX, currentY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  (terms_conditions || []).slice(0, 5).forEach((term, i) => {
    doc.text(`${i + 1}. ${term}`, termsX, currentY + 4 + (i * 3));
  });

  // Authorised Signatory
  const signX = pageWidth - margin - 40;
  doc.setFontSize(9);
  doc.text(`For ${organisation.name}`, signX, currentY + 10);
  
  if (data.authorized_signatory?.url) {
    try {
      doc.addImage(data.authorized_signatory.url, 'PNG', signX, currentY + 12, 30, 15);
    } catch (e) {}
  }

  doc.text(data.authorized_signatory?.name || 'Authorised Signatory', signX, currentY + 30);

  // Bottom text
  doc.setFontSize(7);
  doc.text('This is a Computer Generated Invoice', pageWidth / 2, pageHeight - 10, { align: 'center' });
  doc.text(`Jurisdiction: ${organisation.jurisdiction || 'Subject to local jurisdiction'}`, pageWidth / 2, pageHeight - 14, { align: 'center' });

  return doc;
};


