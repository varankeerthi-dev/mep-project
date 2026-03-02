import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates a standard A4 document PDF (Quotation/Invoice/etc.) in a consistent grid/tabular format.
 * This is the generic implementation of the "A4" template.
 */
export const generateDocumentA4 = (data, organisation, documentTitle = 'DOCUMENT') => {
  const {
    document_no,
    document_date,
    reference_no,
    reference_date,
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

  // Helpers
  const hLine = (y) => { doc.setDrawColor(200); doc.setLineWidth(0.1); doc.line(margin, y, pageWidth - margin, y); };
  const vLine = (x, y1, y2) => { doc.setDrawColor(200); doc.line(x, y1, x, y2); };

  // --- HEADER ---
  // Add Logo if exists
  if (organisation.logo_url) {
    try {
      doc.addImage(organisation.logo_url, 'PNG', margin, margin, 25, 25);
    } catch (e) {
      console.warn('Could not add logo to PDF:', e);
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`GSTIN: ${organisation.gstin || '-'}`, pageWidth - margin - 40, margin + 5);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(documentTitle.toUpperCase(), pageWidth / 2, margin + 10, { align: 'center' });

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

  // --- PARTIES & DETAILS ---
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

  // Right Side Info Box
  const invDetailsX = pageWidth - margin - 50;
  doc.setDrawColor(0);
  doc.rect(invDetailsX - 2, currentY + 2, 50, 25);
  doc.setFontSize(8);
  const numLabel = documentTitle.includes('Quotation') ? 'Quotation No' : 'Invoice No';
  doc.text(`${numLabel}: ${document_no}`, invDetailsX, currentY + 7);
  doc.text(`Date: ${document_date}`, invDetailsX, currentY + 11);
  doc.text(`Ref/PO No: ${reference_no || '-'}`, invDetailsX, currentY + 15);
  doc.text(`Ref/PO Date: ${reference_date || '-'}`, invDetailsX, currentY + 19);
  doc.text(`Due/Expiry: ${due_date || '-'}`, invDetailsX, currentY + 23);

  currentY += detailsHeight;
  hLine(currentY);

  // --- ITEMS TABLE ---
  autoTable(doc, {
    startY: currentY,
    head: [['SI', 'HSN/SAC', 'Description of Goods', 'Quantity', 'Unit', 'Rate', 'Per', 'Disc %', 'GST %', 'Amount']],
    body: (items || []).map((item, index) => [
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
  });

  currentY = doc.lastAutoTable.finalY;

  // --- TOTALS ---
  const totalsYStart = currentY;
  const totalsHeight = 35;

  // Totals Section
  vLine(pageWidth - margin - 60, totalsYStart, totalsYStart + totalsHeight);
  const totalLabelX = pageWidth - margin - 58;
  const totalValueX = pageWidth - margin - 2;

  doc.setFontSize(8);
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
  doc.text('Total Value:', totalLabelX, currentY + 31);
  doc.text(String(totals.invoice_value || 0), totalValueX, currentY + 31, { align: 'right' });

  currentY += totalsHeight;
  hLine(currentY);

  // Bottom Content
  doc.setFont('helvetica', 'normal');
  doc.text(`Amount in Words: INR ${totals.amount_words || '-'}`, margin + 2, currentY + 5);
  currentY += 8;
  hLine(currentY);

  // Bank & Footer
  doc.setFont('helvetica', 'bold');
  doc.text('Bank Details:', margin + 2, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`A/c Name: ${bank_details.acc_name || '-'} | Bank: ${bank_details.bank_name || '-'} | A/c: ${bank_details.acc_no || '-'} | IFSC: ${bank_details.ifsc || '-'}`, margin + 2, currentY + 9);

  const signX = pageWidth - margin - 40;
  doc.setFontSize(9);
  doc.text(`For ${organisation.name}`, signX, currentY + 10);
  
  // Add Signature Image if selected
  if (data.authorized_signatory?.url) {
    try {
      doc.addImage(data.authorized_signatory.url, 'PNG', signX, currentY + 12, 30, 15);
    } catch (e) {
      console.warn('Could not add signature to PDF:', e);
    }
  }

  doc.text(data.authorized_signatory?.name || 'Authorised Signatory', signX, currentY + 30);

  doc.setFontSize(7);
  doc.text('This is a Computer Generated Document', pageWidth / 2, pageHeight - 10, { align: 'center' });

  return doc;
};
