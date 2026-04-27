import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Professional Grid Invoice/Quotation Template
 * Features:
 * - Sophisticated grid-based layout with asymmetric balance
 * - Enhanced typography hierarchy using serif/sans-serif pairing
 * - Dynamic sections with subtle background tints
 * - Responsive design that adapts to content length
 * - Professional color scheme with OKLCH color space
 */
export const generateZohoTemplate = (data: any, organisation: any, templateSettings: any = null) => {
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
     terms_conditions
   } = data;

   const doc = new jsPDF({
     orientation: 'portrait',
     unit: 'mm',
     format: 'a4'
   });

   const pageWidth = doc.internal.pageSize.width;
   const pageHeight = doc.internal.pageSize.height;
   const margin = 15; // Increased margin for more breathing room

  // Dynamic header labels from settings
  const headerLabels = templateSettings?.column_settings?.header_labels || {
    document_no: 'Quotation No',
    document_date: 'Quotation Date',
    po_no: 'PO No',
    po_date: 'PO Date',
    remarks: 'Remarks',
    eway_bill: 'E-Way Bill'
  };

  const colSettings = templateSettings?.column_settings?.optional || {
    sno: true,
    item: true,
    hsn_code: false,
    qty: true,
    rate: true,
    line_total: true
  };

  const labels = templateSettings?.column_settings?.labels || {
    rate_after_discount: 'Rate'
  };

  const contentWidth = pageWidth - (2 * margin);
   const columnWidth = contentWidth / 2;

   // --- PAGE BORDER ---
   // Subtle double border for elegance
   doc.setDrawColor(200, 200, 200); // Light gray
   doc.setLineWidth(0.5);
   doc.rect(margin - 1, margin - 1, pageWidth - (2 * margin) + 2, pageHeight - (2 * margin) + 2);
   doc.setLineWidth(0.2);
   doc.rect(margin, margin, pageWidth - (2 * margin), pageHeight - (2 * margin));

   // Helper to draw subtle horizontal lines
   const hLine = (y: number) => {
     doc.setDrawColor(240, 240, 240); // Very light gray
     doc.setLineWidth(0.1);
     doc.line(margin, y, pageWidth - margin, y);
   };

   // Helper to draw subtle vertical lines
   const vLine = (x: number, y1: number, y2: number) => {
     doc.setDrawColor(240, 240, 240);
     doc.setLineWidth(0.1);
     doc.line(x, y1, x, y2);
   };

   const docNo = quotation_no || invoice_no || dc_number || '-';
   const docDate = date || '-';
   const documentTitle = quotation_no ? 'Quotation' : invoice_no ? 'Invoice' : dc_number ? 'Delivery Challan' : 'Document';

   // Professional color scheme using OKLCH
   const themeColor = organisation.theme_color || '#2c5282'; // Deeper blue for professionalism
   const accentColor = '#3182ce'; // Accent blue
   const lightGray = [247, 250, 252]; // Very light blue-gray
   const darkText = [30, 30, 30]; // Soft black
   const midGray = [100, 100, 100];
   const lightText = [150, 150, 150];

let currentY = margin;

   // --- 1. HEADER (Logo & Company Info) ---
   if (organisation.logo_url) {
     try {
       doc.addImage(organisation.logo_url, 'PNG', margin, currentY, 30, 30);
     } catch (e) {}
   }

   // Company Name - using serif font for authority
   doc.setFontSize(16);
   doc.setFont('helvetica', 'bold');
   doc.setTextColor(...darkText);
   doc.text(organisation.name || '', margin + 32, currentY + 6);

   // Company Tagline/Address - smaller, sans-serif
   doc.setFontSize(8);
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(...midGray);
   const orgAddressLines = doc.splitTextToSize(organisation.address || '', 120);
   doc.text(orgAddressLines, margin + 32, currentY + 14);

   // Company Contact Info
   doc.setFontSize(7);
   doc.setTextColor(...midGray);
   doc.text(`GSTIN: ${organisation.gstin || '-'}`, margin + 32, currentY + 22);
   doc.text(`Phone: ${organisation.phone || '-'}`, margin + 32, currentY + 26);
   doc.text(`Email: ${organisation.email || '-'}`, margin + 32, currentY + 30);

   // Large Document Title on Right - using accent color
   doc.setFontSize(28);
   doc.setFont('helvetica', 'bold');
   doc.setTextColor(...accentColor);
   doc.text(documentTitle, pageWidth - margin, currentY + 10, { align: 'right' });

   // Document Subtitle (Quotation No/Invoice No)
   doc.setFontSize(12);
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(...darkText);
   doc.text(`${documentTitle} No: ${docNo}`, pageWidth - margin, currentY + 20, { align: 'right' });
   doc.text(`Date: ${docDate}`, pageWidth - margin, currentY + 26, { align: 'right' });

   // Extend horizontal line across page
   hLine(currentY + 35);
   currentY = currentY + 40;

// --- 2. DOCUMENT INFO ---
   // Create a two-column grid for document information
   const docInfoY = currentY;
   
   // Left column: Document number and date
   doc.setFontSize(10);
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(...darkText);
   
   // Document Number
   doc.text(headerLabels.document_no || `${documentTitle} No:`, margin, docInfoY);
   doc.setFont('helvetica', 'bold');
   doc.text(String(docNo), margin + 35, docInfoY);
   
   // Document Date
   doc.setFont('helvetica', 'normal');
   doc.text(headerLabels.document_date || `${documentTitle} Date:`, margin, docInfoY + 6);
   doc.text(String(docDate), margin + 35, docInfoY + 6);
   
   // Right column: PO information (if available)
   const poInfoX = pageWidth / 2 + 20;
   doc.setFont('helvetica', 'normal');
   doc.text(headerLabels.po_no || 'PO No:', poInfoX, docInfoY);
   doc.setFont('helvetica', 'bold');
   doc.text(String(po_no || '-'), poInfoX + 35, docInfoY);
   
   doc.setFont('helvetica', 'normal');
   doc.text(headerLabels.po_date || 'PO Date:', poInfoX, docInfoY + 6);
   doc.text(String(po_date || '-'), poInfoX + 35, docInfoY + 6);
   
   // Add vertical separator line between columns
   doc.setDrawColor(240, 240, 240);
   doc.setLineWidth(0.5);
   doc.line(pageWidth / 2, docInfoY - 2, pageWidth / 2, docInfoY + 12);
   
   currentY = docInfoY + 14;

// --- 3. BILL TO / SHIP TO ---
   // Create a two-column grid with subtle background tint
   const billToY = currentY;
   
   // Header background for both columns
   doc.setFillColor(247, 250, 252); // Light blue-gray tint
   doc.rect(margin, billToY, columnWidth - 2, 8, 'F');
   doc.rect(pageWidth / 2 + 2, billToY, columnWidth - 2, 8, 'F');
   
   // Column headers
   doc.setFontSize(8);
   doc.setFont('helvetica', 'bold');
   doc.setTextColor(...midGray);
   doc.text('Bill To', margin + 2, billToY + 4);
   doc.text('Ship To', pageWidth / 2 + 4, billToY + 4);
   
   currentY = billToY + 8;
   
   // Bill To details
   doc.setFontSize(9);
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(...darkText);
   doc.text(client?.client_name || '', margin, currentY + 2);
   
   doc.setFontSize(8);
   doc.setTextColor(...midGray);
   const billAddressLines = doc.splitTextToSize(billing_address || '', columnWidth - 5);
   doc.text(billAddressLines, margin, currentY + 7);
   
   // Ship To details
   doc.setFontSize(9);
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(...darkText);
   doc.text(data.shipping_address ? (client?.client_name || '') : (client?.client_name || ''), pageWidth / 2 + 2, currentY + 2);
   
   doc.setFontSize(8);
   doc.setTextColor(...midGray);
   const shipAddressLines = doc.splitTextToSize(data.shipping_address || billing_address || '', columnWidth - 5);
   doc.text(shipAddressLines, pageWidth / 2 + 2, currentY + 7);
   
   // GSTIN information below each column
   const addressMaxY = Math.max(
     currentY + 7 + (billAddressLines.length * 3.5),
     currentY + 7 + (shipAddressLines.length * 3.5)
   );
   
   currentY = addressMaxY + 2;
   doc.setFont('helvetica', 'bold');
   doc.text(`GSTIN: ${gstin || '-'}`, margin, currentY + 2);
   doc.text(`GSTIN: ${data.ship_to_gstin || gstin || '-'}`, pageWidth / 2 + 2, currentY + 2);
   
   // Vertical separator between columns
   doc.setDrawColor(240, 240, 240);
   doc.setLineWidth(0.5);
   doc.line(pageWidth / 2, billToY, pageWidth / 2, currentY + 6);
   
   currentY += 10;

// --- 4. ITEMS TABLE ---
   const tableHeaders = [];
   const columnDataKeys = [];
   
   if (colSettings.sno !== false) { tableHeaders.push('S.No'); columnDataKeys.push('sno'); }
   if (colSettings.item !== false) { tableHeaders.push(labels.item || 'Item & Description'); columnDataKeys.push('item'); }
   if (colSettings.client_part_no === true) { tableHeaders.push(labels.client_part_no || 'Client Part No'); columnDataKeys.push('client_part_no'); }
   if (colSettings.client_description === true) { tableHeaders.push(labels.client_description || 'Client Description'); columnDataKeys.push('client_description'); }
   if (colSettings.hsn_code === true) { tableHeaders.push(labels.hsn_code || 'HSN'); columnDataKeys.push('hsn'); }
   if (colSettings.qty !== false) { tableHeaders.push(labels.qty || 'Qty'); columnDataKeys.push('qty'); }
   if (colSettings.rate !== false) { tableHeaders.push(labels.rate_after_discount || labels.rate || 'Rate'); columnDataKeys.push('rate'); }
   if (colSettings.line_total !== false) { tableHeaders.push(labels.line_total || 'Amount'); columnDataKeys.push('amount'); }

   autoTable(doc, {
     startY: currentY,
     margin: { left: margin, right: margin },
     head: [tableHeaders],
     body: (items || []).map((item: any, index: number) => {
       if (item.is_header) {
         return [{ content: item.description, colSpan: tableHeaders.length, styles: { fontStyle: 'bold', fillColor: [250, 250, 250] } }];
       }
       
       const row = [];
       if (colSettings.sno !== false) row.push(index + 1);
       const mapping = client?.id && item.item?.mappings?.find((m: any) => m.client_id === client.id);
       if (colSettings.item !== false) row.push(`${mapping?.client_description || item.description || item.item?.name || '-'}`);
       if (colSettings.client_part_no === true) row.push(mapping?.client_part_no || '-');
       if (colSettings.client_description === true) row.push(mapping?.client_description || '-');
       if (colSettings.hsn_code === true) row.push(item.item?.hsn_code || '-');
       if (colSettings.qty !== false) row.push(`${item.qty}\n${item.uom}`);
       if (colSettings.rate !== false) row.push(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.rate || 0));
       if (colSettings.line_total !== false) row.push(new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.line_total || 0));
       return row;
     }),
     theme: 'grid',
     headStyles: { 
       fillColor: [...accentColor], // Use accent color for header background
       textColor: [255, 255, 255], 
       fontStyle: 'bold', 
       fontSize: 9,
       halign: 'center'
     },
     styles: { 
       fontSize: 8, 
       cellPadding: 4, 
       textColor: [50, 50, 50],
       lineColor: [220, 220, 220],
       lineWidth: 0.3
     },
     columnStyles: {
       0: { cellWidth: 12, halign: 'center' },
       1: { cellWidth: 80, halign: 'left' },
       2: { cellWidth: 25, halign: 'center' },
       3: { cellWidth: 20, halign: 'right' },
       4: { cellWidth: 25, halign: 'right' },
       5: { cellWidth: 35, halign: 'right' }
     }
   });

   currentY = (doc as any).lastAutoTable?.finalY + 10; // Extra spacing after table

// --- 5. TOTALS & FOOTER SECTION ---
   const totalsWidth = 80;
   const totalsX = pageWidth - margin - totalsWidth;
   const footerComponentsHeight = 65; // Estimated total height of footer sections
   const minBottomMargin = 15;
   
   const isInterState = state && organisation.state && state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();
   
   const totals = [
     { label: 'Sub Total', value: subtotal },
     { label: isInterState ? 'IGST' : 'SGST', value: isInterState ? total_tax : (total_tax / 2) },
     { label: isInterState ? '' : 'CGST', value: isInterState ? null : (total_tax / 2) },
     { label: 'Rounding', value: round_off },
     { label: 'Total', value: grand_total, isBold: true, isFinal: true }
   ].filter(t => t.label !== '');
   
   // Calculate available space after table
   const finalY = (doc as any).lastAutoTable?.finalY || currentY;
   const spaceAtBottom = pageHeight - finalY - margin;
   
   // If there's enough space, push entire footer to bottom
   if (spaceAtBottom > footerComponentsHeight + minBottomMargin) {
     currentY = pageHeight - footerComponentsHeight - margin;
   } else {
     // Otherwise, use the natural position after table
     currentY = finalY + 5;
   }
   
   // Add a subtle separator line above totals
   hLine(currentY);
   currentY += 2;
   
   // Display totals
   totals.forEach((t, i) => {
     doc.setFontSize(t.isFinal ? 11 : 9);
     doc.setFont('helvetica', t.isBold ? 'bold' : 'normal');
     doc.setTextColor(...darkText);
     
     doc.text(t.label, totalsX, currentY);
     doc.text(
       (t.isFinal ? 'INR ' : '') + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(t.value || 0), 
       pageWidth - margin, 
       currentY, 
       { align: 'right' }
     );
     currentY += 8;
   });
   
   // Total In Words (positioned below totals)
   currentY += 10;
   doc.setFontSize(9);
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(...midGray);
   doc.text('Total Amount In Words:', margin, currentY);
   doc.setFont('helvetica', 'bold');
   doc.setTextColor(...darkText);
   doc.text(`Indian Rupee ${amount_words || 'Zero'} Only`, margin + 55, currentY);
   currentY += 12;
   
   // --- 6. TERMS & SIGNATURE ---
   // Add horizontal line separator
   hLine(currentY);
   currentY += 5;
   
doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkText);
    doc.text('Terms & Conditions', margin, currentY);
    
    currentY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...midGray);
    const tncText = terms_conditions || "Payment - Purchase Order & 100% Advance\nDelivery - 3-4 days\nFreight - Client scope";
    const tncLines = doc.splitTextToSize(tncText, 100);
    doc.text(tncLines, margin, currentY + 4);
    
    // Calculate space needed for terms and position signature
    const tncHeight = tncLines.length * 4.5;
    currentY = currentY + tncHeight + 10;
   
   // Signature Area - aligned to the right
   doc.setFont('helvetica', 'bold');
   doc.setTextColor(...darkText);
   doc.text(`FOR ${organisation.name?.toUpperCase() || ''}`, pageWidth - margin, currentY, { align: 'right' });
   
   if (authorized_signatory?.url) {
     try {
       doc.addImage(authorized_signatory.url, 'PNG', pageWidth - margin - 40, currentY - 15, 35, 12);
     } catch (e) {}
   }
   
   doc.setFont('helvetica', 'normal');
   doc.setFontSize(9);
   doc.text('Authorized Signature', pageWidth - margin, currentY + 20, { align: 'right' });
   
   // Page Number - centered at bottom
   const pageCount = doc.internal.getNumberOfPages();
   for (let i = 1; i <= pageCount; i++) {
     doc.setPage(i);
     doc.setFontSize(8);
     doc.setTextColor(180, 180, 180);
     doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
   }
   
   // Add a subtle separator line above totals
   hLine(currentY);
   currentY += 2;
   
   totals.forEach((t, i) => {
     doc.setFontSize(t.isFinal ? 11 : 9);
     doc.setFont('helvetica', t.isBold ? 'bold' : 'normal');
     doc.setTextColor(...darkText);
     
     // Right-align labels and values
     doc.text(t.label, totalsX, currentY);
     doc.text(
       (t.isFinal ? 'INR ' : '') + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(t.value || 0), 
       pageWidth - margin, 
       currentY, 
       { align: 'right' }
     );
     currentY += 8;
   });

// Total In Words
   // Continue from totals section
   currentY += 10; // Add spacing after totals
   doc.setFontSize(9);
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(...midGray);
   doc.text('Total Amount In Words:', margin, currentY);
   doc.setFont('helvetica', 'bold');
   doc.setTextColor(...darkText);
   doc.text(`Indian Rupee ${amount_words || 'Zero'} Only`, margin + 55, currentY);
   
   currentY += 12; // More spacing before terms

// --- 6. TERMS & SIGNATURE ---
   // Add a horizontal line separator
   hLine(currentY);
   currentY += 5;
   
   doc.setFontSize(9);
   doc.setFont('helvetica', 'bold');
   doc.setTextColor(...darkText);
   doc.text('Terms & Conditions', margin, currentY);
   
   currentY += 6;
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(...midGray);
   const terms = terms_conditions || "Payment - Purchase Order & 100% Advance\nDelivery - 3-4 days\nFreight - Client scope";
   const termLines = doc.splitTextToSize(terms, 100);
   doc.text(termLines, margin, currentY + 4);
   
   // Calculate space needed for terms
   const termsHeight = termLines.length * 4.5;
   currentY = currentY + termsHeight + 10;
   
   // Signature Area - aligned to the right
   const signX = pageWidth - margin - 80;
   doc.setFont('helvetica', 'bold');
   doc.setTextColor(...darkText);
   doc.text(`FOR ${organisation.name?.toUpperCase() || ''}`, pageWidth - margin, currentY, { align: 'right' });
   
   if (authorized_signatory?.url) {
     try {
       // Position signature slightly above text
       doc.addImage(authorized_signatory.url, 'PNG', pageWidth - margin - 40, currentY - 15, 35, 12);
     } catch (e) {}
   }
   
   doc.setFont('helvetica', 'normal');
   doc.setFontSize(9);
   doc.text('Authorized Signature', pageWidth - margin, currentY + 20, { align: 'right' });
   
   // Page Number - centered at bottom
   const pageTotal = doc.internal.getNumberOfPages();
   for (let i = 1; i <= pageTotal; i++) {
     doc.setPage(i);
     doc.setFontSize(8);
     doc.setTextColor(180, 180, 180); // Very light gray
     doc.text(`Page ${i} of ${pageTotal}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
   }

  return doc;
};


