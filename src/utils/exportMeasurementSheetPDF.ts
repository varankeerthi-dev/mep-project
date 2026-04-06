import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MeasurementSheet, MeasurementLineItem } from '../hooks/useMeasurementSheets';
import { formatCurrency } from './formatters';

interface ExportMeasurementSheetPDFParams {
  sheet: MeasurementSheet;
  workOrderNo: string;
  subcontractorName: string;
  workDescription: string;
}

export function exportMeasurementSheetPDF({
  sheet,
  workOrderNo,
  subcontractorName,
  workDescription
}: ExportMeasurementSheetPDFParams) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.text('MEASUREMENT SHEET', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  
  // Info Block
  const startY = 35;
  doc.setFont('courier', 'bold');
  doc.text('Work Order:', 20, startY);
  doc.setFont('courier', 'normal');
  doc.text(workOrderNo, 60, startY);
  
  doc.setFont('courier', 'bold');
  doc.text('Subcontractor:', 20, startY + 7);
  doc.setFont('courier', 'normal');
  doc.text(subcontractorName, 60, startY + 7);
  
  doc.setFont('courier', 'bold');
  doc.text('Sheet No:', 20, startY + 14);
  doc.setFont('courier', 'normal');
  doc.text(sheet.sheet_no, 60, startY + 14);
  
  doc.setFont('courier', 'bold');
  doc.text('Date:', 120, startY + 14);
  doc.setFont('courier', 'normal');
  doc.text(sheet.measurement_date, 140, startY + 14);
  
  doc.setFont('courier', 'bold');
  doc.text('Measured By:', 20, startY + 21);
  doc.setFont('courier', 'normal');
  doc.text(sheet.measured_by || 'N/A', 60, startY + 21);
  
  // Description
  if (sheet.description) {
    doc.setFont('courier', 'bold');
    doc.text('Description:', 20, startY + 28);
    doc.setFont('courier', 'normal');
    const splitDesc = doc.splitTextToSize(sheet.description, pageWidth - 80);
    doc.text(splitDesc, 60, startY + 28);
  }
  
  // Line Items Table
  const tableStartY = sheet.description ? startY + 40 : startY + 35;
  
  const tableBody = sheet.line_items.map((item: MeasurementLineItem, index: number) => [
    index + 1,
    item.description,
    item.unit,
    item.contract_qty.toString(),
    item.actual_qty.toString(),
    formatCurrency(item.rate),
    formatCurrency(item.amount),
    formatCurrency(item.difference)
  ]);
  
  autoTable(doc, {
    startY: tableStartY,
    head: [['S.No', 'Description', 'Unit', 'Contract Qty', 'Actual Qty', 'Rate', 'Amount', 'Difference']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      font: 'courier',
      fontSize: 9,
      fontStyle: 'bold'
    },
    styles: {
      font: 'courier',
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 25 },
      6: { halign: 'right', cellWidth: 30 },
      7: { halign: 'right', cellWidth: 30 }
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    didParseCell: (data: any) => {
      // Highlight difference column
      if (data.column.index === 7 && data.cell.raw) {
        const diffValue = parseFloat(data.cell.raw.replace(/[₹,]/g, ''));
        if (diffValue > 0) {
          data.cell.styles.textColor = [214, 39, 29]; // Red
        } else if (diffValue < 0) {
          data.cell.styles.textColor = [34, 139, 34]; // Green
        }
      }
    }
  });
  
  // Summary Block
  const summaryY = (doc as any).lastAutoTable?.finalY + 15 || 150;
  
  doc.setFont('courier', 'bold');
  doc.text('SUMMARY', 20, summaryY);
  
  const summaryData = [
    ['Contract Value:', formatCurrency(sheet.contract_value)],
    ['Actual Value:', formatCurrency(sheet.actual_value)],
    ['Difference:', `${sheet.difference >= 0 ? '+' : ''}${formatCurrency(sheet.difference)}`]
  ];
  
  autoTable(doc, {
    startY: summaryY + 5,
    body: summaryData,
    theme: 'plain',
    styles: {
      font: 'courier',
      fontSize: 10,
      cellPadding: 2
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { halign: 'right', cellWidth: 40 }
    }
  });
  
  // Amendment Note
  if (sheet.amendment_created) {
    const noteY = (doc as any).lastAutoTable?.finalY + 10 || 180;
    doc.setFillColor(255, 243, 224);
    doc.rect(20, noteY, pageWidth - 40, 15, 'F');
    doc.setFont('courier', 'bold');
    doc.setTextColor(237, 108, 2);
    doc.text('Note: Amendment created due to actual quantity exceeding contract quantity.', 25, noteY + 9);
    doc.setTextColor(0, 0, 0);
  }
  
  // Notes
  if (sheet.notes) {
    const notesY = (doc as any).lastAutoTable?.finalY + 20 || 190;
    doc.setFont('courier', 'bold');
    doc.text('Notes:', 20, notesY);
    doc.setFont('courier', 'normal');
    const splitNotes = doc.splitTextToSize(sheet.notes, pageWidth - 40);
    doc.text(splitNotes, 20, notesY + 7);
  }
  
  // Signatures
  const sigY = doc.internal.pageSize.getHeight() - 40;
  doc.setFont('courier', 'normal');
  doc.text('_______________________', 20, sigY);
  doc.text('Measured By', 20, sigY + 7);
  
  doc.text('_______________________', pageWidth / 2, sigY);
  doc.text('Approved By', pageWidth / 2, sigY + 7);
  
  doc.text('_______________________', pageWidth - 70, sigY);
  doc.text('Date', pageWidth - 70, sigY + 7);
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Measurement Sheet ${sheet.sheet_no} - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Save
  const filename = `MeasurementSheet_${workOrderNo}_${sheet.sheet_no}.pdf`;
  doc.save(filename);
}
