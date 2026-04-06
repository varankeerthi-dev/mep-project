import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LedgerEntry, LedgerSummary } from '../hooks/useSubcontractorLedger';
import { formatCurrency } from './formatters';

interface ExportLedgerPDFParams {
  subcontractorName: string;
  workOrderRef: string;
  ledger: LedgerEntry[];
  summary: LedgerSummary;
  date: string;
}

export function exportLedgerPDF({
  subcontractorName,
  workOrderRef,
  ledger,
  summary,
  date
}: ExportLedgerPDFParams) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.text('SUBCONTRACTOR LEDGER', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(12);
  doc.text(`Subcontractor: ${subcontractorName}`, 20, 35);
  doc.text(`Reference: ${workOrderRef}`, 20, 42);
  doc.text(`Generated: ${date}`, 20, 49);
  
  // Summary Section
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text('SUMMARY', 20, 65);
  
  const summaryData = [
    ['Contract Value:', formatCurrency(summary.contractValue)],
    ['Total Invoiced:', formatCurrency(summary.totalInvoiced)],
    ['Total Paid:', formatCurrency(summary.totalPaid)],
    ['Balance Due:', formatCurrency(summary.balanceDue)],
  ];
  
  if (summary.totalTDS > 0) {
    summaryData.push(['Total TDS:', formatCurrency(summary.totalTDS)]);
  }
  
  autoTable(doc, {
    startY: 70,
    body: summaryData,
    theme: 'plain',
    styles: {
      font: 'courier',
      fontSize: 10,
      cellPadding: 2
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' }
    }
  });
  
  // Ledger Table
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  const tableStartY = (doc as any).lastAutoTable?.finalY + 10 || 95;
  doc.text('TRANSACTIONS', 20, tableStartY);
  
  const tableBody = ledger.map(entry => [
    entry.date,
    entry.type,
    entry.reference,
    entry.debit > 0 ? formatCurrency(entry.debit) : '-',
    entry.credit > 0 ? formatCurrency(entry.credit) : '-',
    entry.tdsAmount > 0 ? formatCurrency(entry.tdsAmount) : '-',
    formatCurrency(entry.balance)
  ]);
  
  autoTable(doc, {
    startY: tableStartY + 5,
    head: [['Date', 'Type', 'Reference', 'Debit', 'Credit', 'TDS', 'Balance']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      font: 'courier',
      fontStyle: 'bold'
    },
    styles: {
      font: 'courier',
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    }
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount} - ${subcontractorName} - ${date}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Save
  const filename = `Ledger_${subcontractorName.replace(/\s+/g, '_')}_${workOrderRef.replace(/\s+/g, '_')}_${date}.pdf`;
  doc.save(filename);
}
