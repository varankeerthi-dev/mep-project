import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type DocumentType = 'quotation' | 'invoice' | 'proforma' | 'delivery_challan';

const DOCUMENT_CONFIG = {
  quotation: { title: 'QUOTATION', numberField: 'quotation_no', label: 'Quotation No' },
  invoice: { title: 'TAX INVOICE', numberField: 'invoice_no', label: 'Invoice No' },
  proforma: { title: 'PROFORMA INVOICE', numberField: 'proforma_no', label: 'Proforma No' },
  delivery_challan: { title: 'DELIVERY CHALLAN', numberField: 'dc_number', label: 'DC No' }
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(val || 0);

const getActiveColumns = (config: any) => {
  return config.columns
    .filter((c: any) => c.enabled)
    .sort((a: any, b: any) => a.order - b.order);
};

const getCellValue = (item: any, colKey: string, index: number) => {
  switch (colKey) {
    case 'sno': return index + 1;
    case 'hsn': return item.item?.hsn_code || '-';
    case 'item': return item.description || item.item?.name || '-';
    case 'qty': return item.qty;
    case 'rate': return item.rate;
    case 'amount': return item.line_total;
    default: return item[colKey] ?? '';
  }
};

export const generateDocumentPDF = (
  type: DocumentType,
  data: any,
  organisation: any,
  templateConfig: any
) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const config = DOCUMENT_CONFIG[type];
  const columns = getActiveColumns(templateConfig);

  const headers = columns.map((c: any) => c.label);

  const margin = 12;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  let currentY = margin;

  // --- HEADER (COMPACT) ---
  doc.setFontSize(16);
  doc.text(organisation.name || '', margin, currentY);

  doc.setFontSize(11);
  doc.text(config.title, pageWidth - margin, currentY, { align: 'right' });

  currentY += 5;

  doc.setFontSize(8);
  doc.text(`${config.label}: ${data[config.numberField] || '-'}`, margin, currentY);
  doc.text(`Date: ${data.date || '-'}`, pageWidth - margin, currentY, { align: 'right' });

  currentY += 6;

  // --- CLIENT ---
  doc.setFontSize(9);
  doc.text(`Bill To: ${data.client?.client_name || ''}`, margin, currentY);
  currentY += 5;

  // --- TABLE ---
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [headers],
    body: (data.items || []).map((item: any, index: number) => {
      return columns.map((col: any) => {
        let value = getCellValue(item, col.key, index);

        if (col.type === 'currency') return formatCurrency(value);
        return value;
      });
    }),
    styles: {
      fontSize: 8,
      cellPadding: 2.5
    },
    columnStyles: columns.reduce((acc: any, col: any, i: number) => {
      acc[i] = {
        halign: col.align || 'left',
        cellWidth: col.width || 'auto'
      };
      return acc;
    }, {})
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // --- FOOTER LOCK ---
  const footerStart = pageHeight - 45;

  if (currentY < footerStart) currentY = footerStart;

  doc.setFontSize(9);

  doc.text(`Sub Total: ${formatCurrency(data.subtotal)}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 5;

  doc.text(`Tax: ${formatCurrency(data.total_tax)}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 5;

  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${formatCurrency(data.grand_total)}`, pageWidth - margin, currentY, { align: 'right' });

  // --- PAGE NUMBERS ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  return doc;
};
