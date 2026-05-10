import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PRO_MARGIN_MM,
  appendLabelValueGrid,
  appendProFooterNote,
  appendSectionHeading,
  drawProDoubleFrame,
  PRO_GRID_HEAD_FILL,
  PRO_GRID_LINE,
  renderProOrgBanner,
} from './proGridLayout';

type Org = Record<string, unknown>;
type Col = { header: string; key: string; width: number };

export type ProGridToolsTransactionParams = {
  transaction: Record<string, unknown>;
  toolsItems: { items?: Record<string, unknown>[] };
  organisation: Org;
  columnConfig: Col[];
  tableData: Record<string, unknown>[];
  formatDate: (iso: string | null | undefined) => string;
  orientation?: 'portrait' | 'landscape';
  pageFormat?: 'a4' | 'letter';
};

export function generateProGridToolsTransactionPdf(params: ProGridToolsTransactionParams): jsPDF {
  const { 
    transaction, 
    toolsItems, 
    organisation, 
    columnConfig, 
    tableData, 
    formatDate, 
    orientation = 'portrait', 
    pageFormat = 'a4' 
  } = params;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageFormat === 'letter' ? 'letter' : 'a4',
  });
  drawProDoubleFrame(doc);

  // Dynamic document title based on transaction type
  const transactionType = transaction.transaction_type as string || 'ISSUE';
  const documentTitle = transactionType === 'ISSUE' ? 'Tools Issue' : 
                      transactionType === 'RECEIVE' ? 'Tools Receipt' : 
                      'Tools Transfer';

  let y = renderProOrgBanner(doc, organisation, { 
    documentTitle, 
    themeHex: organisation.theme_color as string 
  });

  // Transaction Details Section
  y = appendLabelValueGrid(
    doc,
    y,
    [
      ['Reference No.', transaction.reference_id, 'Date', formatDate(transaction.transaction_date as string)],
      ['Transaction Type', transactionType, 'Client', transaction.client_name],
      ['Taken By', transaction.taken_by, 'Status', transaction.status],
    ],
    { title: 'Transaction details' },
  );

  // Show transfer details only for transfer transactions
  if (transactionType === 'TRANSFER') {
    y = appendSectionHeading(doc, y, 'Transfer details');
    y = appendLabelValueGrid(doc, y, [
      ['From Client', transaction.from_client_name, 'To Client', transaction.to_client_name],
      ['Reason', transaction.remarks || '', '', ''],
    ]);
  }

  // Tools Details Table
  y = appendSectionHeading(doc, y, 'Tools details');
  
  const toolsTableData = (toolsItems.items || []).map((item: any, index: number) => ({
    sr: index + 1,
    tool_name: item.tool_name || item.item_name || '-',
    make: item.make || '-',
    quantity: item.quantity || 0,
    returned_quantity: item.returned_quantity || 0,
    remarks: item.remarks || '-',
  }));

  autoTable(doc, {
    head: [['Sr.', 'Tool Name', 'Make', 'Qty', 'Returned Qty', 'Remarks']],
    body: toolsTableData.map((row: any) => [
      row.sr,
      row.tool_name,
      row.make,
      row.quantity,
      row.returned_quantity,
      row.remarks,
    ]),
    startY: y,
    margin: PRO_MARGIN_MM,
    headStyles: {
      fillColor: PRO_GRID_HEAD_FILL,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      lineColor: PRO_GRID_LINE,
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 15 }, // Sr.
      1: { cellWidth: 60 }, // Tool Name
      2: { cellWidth: 40 }, // Make
      3: { cellWidth: 20 }, // Qty
      4: { cellWidth: 25 }, // Returned Qty
      5: { cellWidth: 40 }, // Remarks
    },
    theme: 'grid',
  });

  // Get final Y position after table
  y = (doc as any).lastAutoTable.finalY + 10;

  // Signature Section
  y = appendSectionHeading(doc, y, 'Acknowledgement');
  y = appendLabelValueGrid(doc, y, [
    ['Issued By', '', 'Received By', ''],
    [`${transactionType === 'ISSUE' ? 'Issued' : transactionType === 'RECEIVE' ? 'Received' : 'Transferred'} By`, '', 'Signature', ''],
    ['', '', '', ''],
    ['Name: ' + (transaction.taken_by || ''), '', 'Name: ________________', ''],
    ['', '', '', ''],
    ['Date: ' + formatDate(transaction.transaction_date as string), '', 'Date: ________________', ''],
  ]);

  // Terms and Conditions
  const termsText = transactionType === 'ISSUE' ? 
    '1. Tools must be returned in good working condition\n2. Any damage must be reported immediately\n3. Tools are company property and must be handled with care' :
    transactionType === 'RECEIVE' ?
    '1. Tools have been received and checked\n2. Any damages noted above\n3. Stock updated accordingly' :
    '1. Tools transferred from one client to another\n2. Both parties acknowledge the transfer\n3. Stock records updated';

  y = appendProFooterNote(doc, y, termsText);

  return doc;
}

// Helper function to generate and download PDF
export function generateToolsTransactionPDF(transactionData: any, organisation: any): Blob {
  const doc = generateProGridToolsTransactionPdf({
    transaction: transactionData,
    toolsItems: { items: transactionData.items || [] },
    organisation: organisation,
    columnConfig: [
      { header: 'Sr.', key: 'sr', width: 15 },
      { header: 'Tool Name', key: 'tool_name', width: 60 },
      { header: 'Make', key: 'make', width: 40 },
      { header: 'Qty', key: 'quantity', width: 20 },
      { header: 'Returned Qty', key: 'returned_quantity', width: 25 },
      { header: 'Remarks', key: 'remarks', width: 40 },
    ],
    tableData: transactionData.items || [],
    formatDate: (iso: string | null | undefined) => {
      if (!iso) return '-';
      return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    },
  });

  return new Blob([doc.output('blob')], { type: 'application/pdf' });
}

// Helper function to open PDF in new tab
export function openToolsTransactionPDF(transactionData: any, organisation: any) {
  const pdfBlob = generateToolsTransactionPDF(transactionData, organisation);
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
}

// Helper function to download PDF
export function downloadToolsTransactionPDF(transactionData: any, organisation: any, filename?: string) {
  const pdfBlob = generateToolsTransactionPDF(transactionData, organisation);
  const pdfUrl = URL.createObjectURL(pdfBlob);
  
  const link = document.createElement('a');
  link.href = pdfUrl;
  link.download = filename || `Tools_${transactionData.transaction_type}_${transactionData.reference_id}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(pdfUrl);
}
