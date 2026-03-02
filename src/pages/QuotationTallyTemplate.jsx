import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Tally Style Quotation Template
 * features:
 * - Thick outer border
 * - Clean compartmentalized header (Company vs Party)
 * - Specific column order typical of Tally
 * - Amount in words placement
 * - Clear Declaration and Bank Details
 */
export const generateQuotationTally = (data, organisation) => {
  const {
    quotation_no,
    date,
    valid_till,
    payment_terms,
    contact_no,
    remarks,
    client,
    billing_address,
    gstin,
    state,
    project,
    items,
    subtotal,
    total_item_discount,
    extra_discount_amount,
    total_tax,
    round_off,
    grand_total,
    bank_details,
    authorized_signatory
  } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  
  // Set default font
  doc.setFont('helvetica', 'normal');

  // --- OUTER BORDER (Tally Style) ---
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.rect(margin, margin, pageWidth - 20, pageHeight - 20);

  let currentY = margin;

  // --- HEADER: DOCUMENT TITLE ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTATION', pageWidth / 2, currentY + 5, { align: 'center' });
  currentY += 8;
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // --- COMPANY & PARTY DETAILS SECTION (Compartmentalized) ---
  const headerHeight = 55;
  
  // Vertical separator
  doc.line(pageWidth / 2, currentY, pageWidth / 2, currentY + headerHeight);

  // Left: Company Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(organisation.name || '', margin + 2, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const orgAddressLines = doc.splitTextToSize(organisation.address || '', (pageWidth / 2) - margin - 5);
  doc.text(orgAddressLines, margin + 2, currentY + 10);
  
  let orgInfoY = currentY + 10 + (orgAddressLines.length * 3.5) + 2;
  doc.text(`GSTIN/UIN: ${organisation.gstin || '-'}`, margin + 2, orgInfoY);
  doc.text(`State Name: ${organisation.state || '-'}`, margin + 2, orgInfoY + 4);
  doc.text(`Contact: ${organisation.phone || '-'}`, margin + 2, orgInfoY + 8);
  doc.text(`E-Mail: ${organisation.email || '-'}`, margin + 2, orgInfoY + 12);

  // Right: Document Details
  doc.setFontSize(9);
  doc.text(`Quotation No.`, (pageWidth / 2) + 2, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${quotation_no}`, (pageWidth / 2) + 30, currentY + 5);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Dated`, (pageWidth / 2) + 2, currentY + 10);
  doc.text(`: ${date}`, (pageWidth / 2) + 30, currentY + 10);

  doc.text(`Valid Till`, (pageWidth / 2) + 2, currentY + 20);
  doc.text(`: ${valid_till || '-'}`, (pageWidth / 2) + 30, currentY + 20);

  doc.text(`Payment Terms`, (pageWidth / 2) + 2, currentY + 25);
  doc.text(`: ${payment_terms || '-'}`, (pageWidth / 2) + 30, currentY + 25);

  doc.text(`Project`, (pageWidth / 2) + 2, currentY + 35);
  const projectText = project?.project_name || project?.project_code || '-';
  const projectLines = doc.splitTextToSize(`: ${projectText}`, (pageWidth / 2) - margin - 32);
  doc.text(projectLines, (pageWidth / 2) + 30, currentY + 35);

  currentY += headerHeight;
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // Party Details (Buyer)
  const partyHeight = 35;
  doc.setFontSize(9);
  doc.text('Buyer (Bill to)', margin + 2, currentY + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(client?.client_name || '', margin + 2, currentY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const buyerAddressLines = doc.splitTextToSize(billing_address || '', (pageWidth - 20) / 2);
  doc.text(buyerAddressLines, margin + 2, currentY + 14);
  
  let buyerInfoY = currentY + 14 + (buyerAddressLines.length * 3.5) + 2;
  doc.text(`GSTIN/UIN: ${gstin || '-'}`, margin + 2, buyerInfoY);
  doc.text(`State Name: ${state || '-'}`, margin + 2, buyerInfoY + 4);

  currentY += partyHeight;
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // --- ITEMS TABLE ---
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Sl\nNo.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'per', 'Disc %', 'Amount']],
    body: (items || []).map((item, index) => [
      index + 1,
      item.description || '-',
      item.item?.hsn_code || '-',
      `${item.qty} ${item.uom}`,
      new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.base_rate_snapshot || item.rate),
      item.uom,
      item.discount_percent > 0 ? `${item.discount_percent}%` : '',
      new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.line_total)
    ]),
    theme: 'grid',
    headStyles: { 
      fillColor: [255, 255, 255], 
      textColor: [0, 0, 0], 
      fontStyle: 'bold', 
      fontSize: 8, 
      lineWidth: 0.1, 
      lineColor: [0, 0, 0],
      halign: 'center'
    },
    styles: { 
      fontSize: 8, 
      cellPadding: 2, 
      lineWidth: 0.1, 
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 30, halign: 'right' }
    },
    didDrawPage: (data) => {
        // Maintain the box on multiple pages
        doc.setDrawColor(0);
        doc.setLineWidth(0.4);
        doc.rect(margin, margin, pageWidth - 20, pageHeight - 20);
    }
  });

  currentY = doc.lastAutoTable.finalY;

  // --- TOTALS SECTION ---
  const totalsHeight = 45;
  // If table ends too near bottom, add page (not handled here for simplicity)
  
  // Fill empty space to keep vertical lines going to the bottom of the items section if needed
  // (In Tally, vertical lines usually extend to the total row)

  doc.line(margin, currentY, pageWidth - margin, currentY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Total', margin + 2, currentY + 5);
  doc.text(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(grand_total), pageWidth - margin - 2, currentY + 5, { align: 'right' });
  
  currentY += 8;
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // Amount in words
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Amount Chargeable (in words)', margin + 2, currentY + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const amountWords = data.amount_words || 'Zero';
  doc.text(`INR ${amountWords} Only`, margin + 2, currentY + 9);

  currentY += 12;
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // --- FOOTER SECTION: BANK & DECLARATION ---
  const footerY = currentY;
  const footerHeight = pageHeight - margin - currentY;
  
  // Vertical line for Bank vs Signatory
  doc.line(pageWidth / 2, footerY, pageWidth / 2, pageHeight - margin);

  // Bank Details
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Company\'s Bank Details', margin + 2, footerY + 4);
  doc.text(`Bank Name : `, margin + 2, footerY + 9);
  doc.setFont('helvetica', 'bold');
  doc.text(bank_details?.bank_name || '-', margin + 25, footerY + 9);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`A/c No.   : `, margin + 2, footerY + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(bank_details?.acc_no || '-', margin + 25, footerY + 13);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Branch & IFS Code: `, margin + 2, footerY + 17);
  doc.setFont('helvetica', 'bold');
  doc.text(`${bank_details?.branch || '-'} & ${bank_details?.ifsc || '-'}`, margin + 30, footerY + 17);

  // Declaration
  doc.setFont('helvetica', 'normal');
  doc.text('Declaration', margin + 2, footerY + 25);
  doc.setFontSize(7);
  const declaration = "We declare that this quotation shows the actual price of the goods described and that all particulars are true and correct.";
  doc.text(doc.splitTextToSize(declaration, (pageWidth / 2) - margin - 5), margin + 2, footerY + 29);

  // Right Side: Signatory
  doc.setFontSize(8);
  doc.text(`for ${organisation.name}`, (pageWidth / 2) + 10, footerY + 4);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorised Signatory', (pageWidth / 2) + 30, pageHeight - margin - 5);

  if (authorized_signatory?.url) {
      try {
          doc.addImage(authorized_signatory.url, 'PNG', (pageWidth / 2) + 25, pageHeight - margin - 22, 30, 12);
      } catch (e) {}
  }

  // Common Tally Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('This is a Computer Generated Quotation', pageWidth / 2, pageHeight - 5, { align: 'center' });

  return doc;
};
