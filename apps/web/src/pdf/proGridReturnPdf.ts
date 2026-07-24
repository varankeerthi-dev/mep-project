// apps/web/src/pdf/proGridReturnPdf.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReturnPDFData = {
  return_number: string;
  return_date: string;
  customer_dc_number?: string;
  vehicle_number?: string;
  remarks?: string;
  project_name: string;
  client_name: string;
  warehouse?: { name: string };
  employee?: { name: string };
  assigned_employee?: { name: string };
  next_action_type?: string;
  next_action_due_date?: string;
  items: {
    name: string;
    variant_name: string | null;
    warehouse_name: string;
    quantity: number;
    unit: string;
    is_scrap: boolean;
    rate: number;
    total: number;
    remarks: string;
  }[];
};

export function renderReturnPDF(data: ReturnPDFData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 12;
  const contentWidth = pageWidth - (2 * margin);

  let currentY = margin;

  // Colors (Clean Slate theme)
  const primaryColor: [number, number, number] = [17, 24, 39]; // Gray 900
  const secondaryColor: [number, number, number] = [79, 70, 229]; // Indigo 600
  const lightBg: [number, number, number] = [249, 250, 251]; // Gray 50
  const borderColor: [number, number, number] = [229, 231, 235]; // Gray 200

  // 1. Header block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...primaryColor);
  doc.text('MATERIAL RETURN CHALLAN', margin, currentY + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128); // Gray 500
  doc.text('Physical Inventory Return & Audit Document', margin, currentY + 10);

  // Status badge
  doc.setFillColor(237, 242, 247); // Light gray
  doc.rect(pageWidth - margin - 35, currentY, 35, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(74, 85, 104);
  doc.text('COMPLETED', pageWidth - margin - 17.5, currentY + 5.5, { align: 'center' });

  currentY += 16;

  // 2. Metadata Grid Frame
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.setFillColor(...lightBg);
  doc.rect(margin, currentY, contentWidth, 34, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);

  // Labels
  doc.text('RETURN NUMBER', margin + 4, currentY + 6);
  doc.text('RETURN DATE', margin + 50, currentY + 6);
  doc.text('PROJECT NAME', margin + 95, currentY + 6);
  doc.text('CLIENT NAME', margin + 140, currentY + 6);

  doc.text('CUSTOMER DC NO', margin + 4, currentY + 22);
  doc.text('VEHICLE NUMBER', margin + 50, currentY + 22);
  doc.text('DEFAULT WAREHOUSE', margin + 95, currentY + 22);
  doc.text('RETURNED BY', margin + 140, currentY + 22);

  // Values
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...primaryColor);

  doc.text(data.return_number, margin + 4, currentY + 11.5);
  doc.text(new Date(data.return_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), margin + 50, currentY + 11.5);
  doc.text(data.project_name, margin + 95, currentY + 11.5, { maxWidth: 40 });
  doc.text(data.client_name, margin + 140, currentY + 11.5, { maxWidth: 40 });

  doc.setFont('helvetica', 'normal');
  doc.text(data.customer_dc_number || 'N/A', margin + 4, currentY + 27.5);
  doc.text(data.vehicle_number || 'N/A', margin + 50, currentY + 27.5);
  doc.text(data.warehouse?.name || 'N/A', margin + 95, currentY + 27.5, { maxWidth: 40 });
  doc.text(data.employee?.name || 'N/A', margin + 140, currentY + 27.5, { maxWidth: 40 });

  currentY += 40;

  // 3. Items Table
  const tableHeaders = ['S.No', 'Material Description', 'Target Warehouse', 'Quality Status', 'Returned Qty', 'Rate (INR)', 'Total Amount (INR)'];
  const tableRows = data.items.map((item, idx) => [
    idx + 1,
    item.variant_name ? `${item.name} (${item.variant_name})` : item.name,
    item.warehouse_name,
    item.is_scrap ? 'SCRAP' : 'GOOD',
    `${item.quantity} ${item.unit}`,
    item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })
  ]);

  const totalAmount = data.items.reduce((s, x) => s + x.total, 0);

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [17, 24, 39], // Gray 900
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 50 },
      2: { cellWidth: 35 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 27 }
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [55, 65, 81] // Gray 700
    },
    alternateRowStyles: {
      fillColor: [253, 254, 255]
    },
    margin: { left: margin, right: margin },
    didParseCell: (dataCell) => {
      // Color code SCRAP and GOOD
      if (dataCell.column.index === 3 && dataCell.section === 'body') {
        if (dataCell.cell.raw === 'SCRAP') {
          dataCell.cell.styles.textColor = [220, 38, 38]; // Rose 600
          dataCell.cell.styles.fontStyle = 'bold';
        } else {
          dataCell.cell.styles.textColor = [5, 150, 105]; // Emerald 600
          dataCell.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  // Get Y position after table
  let finalY = (doc as any).lastAutoTable.finalY + 8;

  // 4. Summary Total Box
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.setFillColor(...lightBg);
  doc.rect(pageWidth - margin - 75, finalY, 75, 12, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  doc.text('TOTAL VALUATION:', pageWidth - margin - 71, finalY + 7.5);

  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text(`INR ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 4, finalY + 8, { align: 'right' });

  finalY += 20;

  // 5. Downstream Action Panel (If configured)
  if (data.next_action_type) {
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.setFillColor(243, 244, 246); // Gray 100
    doc.rect(margin, finalY, contentWidth, 22, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(79, 70, 229); // Indigo 600
    doc.text('DOWNSTREAM FOLLOW-UP ACTION INSTRUCTIONS', margin + 4, finalY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...primaryColor);
    doc.text(`Action Type: ${data.next_action_type.replace('_', ' ').toUpperCase()}`, margin + 4, finalY + 12);
    if (data.next_action_due_date) {
      doc.text(`Due Date: ${new Date(data.next_action_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, margin + 40, finalY + 12);
    }
    if (data.assigned_employee?.name) {
      doc.text(`Assigned Owner: ${data.assigned_employee.name}`, margin + 85, finalY + 12);
    }

    if (data.remarks) {
      doc.text(`Instructions: ${data.remarks}`, margin + 4, finalY + 17, { maxWidth: contentWidth - 8 });
    }

    finalY += 30;
  }

  // Ensure footer doesn't run off page
  if (finalY > pageHeight - 40) {
    doc.addPage();
    finalY = margin + 10;
  }

  // 6. Signatures Grid
  doc.setLineWidth(0.2);
  doc.setDrawColor(156, 163, 175); // Gray 400

  // Line 1: Customer Representative
  doc.line(margin + 5, finalY + 15, margin + 55, finalY + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Returned By (Representative)', margin + 30, finalY + 19, { align: 'center' });

  // Line 2: Receiver Signature
  doc.line(pageWidth - margin - 55, finalY + 15, pageWidth - margin - 5, finalY + 15);
  doc.text('Authorized Receiver (Warehouse)', pageWidth - margin - 30, finalY + 19, { align: 'center' });

  // Save the document
  doc.save(`${data.return_number}_Return_Challan.pdf`);
}
