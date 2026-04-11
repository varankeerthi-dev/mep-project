import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateProGridPurchaseOrderPdf } from '../../../pdf/proGridPurchaseOrderPdf';
import type { PurchaseOrderData } from './purchasePdfTypes';

export type { POItem, PurchaseOrderData } from './purchasePdfTypes';

export interface BillItem {
  sr: number;
  item_name: string;
  description?: string;
  hsn_code?: string;
  batch_no?: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_amount?: number;
  taxable_value: number;
  cgst_percent: number;
  cgst_amount: number;
  sgst_percent: number;
  sgst_amount: number;
  igst_percent?: number;
  igst_amount?: number;
  total_amount: number;
}

export interface PurchaseBillData {
  company_name: string;
  company_address: string;
  company_gstin: string;
  bill_number: string;
  vendor_invoice_no?: string;
  bill_date: string;
  due_date: string;
  vendor_name: string;
  vendor_gstin: string;
  warehouse_name: string;
  direct_supply_to_site: boolean;
  site_address?: string;
  po_number?: string;
  currency: string;
  exchange_rate: number;
  eway_bill_no?: string;
  vehicle_no?: string;
  transporter_name?: string;
  items: BillItem[];
  freight_amount: number;
  insurance_amount: number;
  other_charges: number;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  total_amount_inr: number;
  tds_percent?: number;
  tds_amount?: number;
  net_amount: number;
}

export const generatePOPDF = (data: PurchaseOrderData): Blob => generateProGridPurchaseOrderPdf(data);

export const generateBillPDF = (data: PurchaseBillData): Blob => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.company_name, 15, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE BILL / INVOICE ENTRY', pageWidth - 15, 20, { align: 'right' });
  
  // Bill Info Box
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bill #: ${data.bill_number}`, pageWidth - 15, 28, { align: 'right' });
  doc.text(`Vendor Inv: ${data.vendor_invoice_no || '-'}`, pageWidth - 15, 33, { align: 'right' });
  doc.text(`Date: ${data.bill_date}`, pageWidth - 15, 38, { align: 'right' });
  doc.text(`Due: ${data.due_date}`, pageWidth - 15, 43, { align: 'right' });
  if (data.po_number) {
    doc.text(`PO Ref: ${data.po_number}`, pageWidth - 15, 48, { align: 'right' });
  }
  
  // Vendor Info
  let yPos = 30;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('VENDOR:', 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(data.vendor_name, 15, yPos + 5);
  doc.text(`GSTIN: ${data.vendor_gstin}`, 15, yPos + 10);
  
  // Warehouse/Direct Supply
  yPos += 18;
  doc.setFontSize(9);
  doc.text(`Warehouse: ${data.warehouse_name}`, 15, yPos);
  doc.text(`Direct to Site: ${data.direct_supply_to_site ? 'YES' : 'NO'}`, 80, yPos);
  
  if (data.direct_supply_to_site && data.site_address) {
    yPos += 5;
    doc.setFontSize(8);
    doc.text(`Site: ${data.site_address.substring(0, 60)}...`, 15, yPos);
  }
  
  // Transport details
  if (data.eway_bill_no || data.vehicle_no) {
    yPos += 8;
    doc.setFontSize(8);
    doc.text(`E-Way: ${data.eway_bill_no || '-'} | Vehicle: ${data.vehicle_no || '-'}`, 15, yPos);
  }
  
  yPos += 12;
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 8;
  
  // Items Table
  const tableHeaders = ['Sr', 'Item', 'Batch', 'Qty', 'Rate', 'GST%', 'Amount'];
  
  const tableData = data.items.map(item => [
    item.sr.toString(),
    item.item_name,
    item.batch_no || '-',
    `${item.quantity} ${item.unit}`,
    formatCurrency(item.rate, data.currency),
    `${item.cgst_percent + item.sgst_percent}%`,
    formatCurrency(item.total_amount, data.currency)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 30, halign: 'right' }
    },
    margin: { left: 15, right: 15 }
  });
  
  // Totals at bottom
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const totalsX = pageWidth - 105;
  
  const totalsRows = [
    ['Subtotal:', formatCurrency(data.subtotal, data.currency)],
    ['Freight:', formatCurrency(data.freight_amount, data.currency)],
    ['Insurance:', formatCurrency(data.insurance_amount, data.currency)],
    ['Other Charges:', formatCurrency(data.other_charges, data.currency)],
    ['Discount:', formatCurrency(data.discount_amount, data.currency)],
    ['Taxable Value:', formatCurrency(data.taxable_amount, data.currency)],
    [`CGST (${data.items[0]?.cgst_percent || 0}%):`, formatCurrency(data.cgst_amount, data.currency)],
    [`SGST (${data.items[0]?.sgst_percent || 0}%):`, formatCurrency(data.sgst_amount, data.currency)]
  ];
  
  if (data.igst_amount > 0) {
    totalsRows.splice(7, 2, [`IGST (${data.items[0]?.igst_percent || 0}%):`, formatCurrency(data.igst_amount, data.currency)]);
  }
  
  // Ensure totals fit at bottom
  const totalsBoxY = Math.min(finalY, pageHeight - 90);
  
  autoTable(doc, {
    startY: totalsBoxY,
    body: totalsRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [150, 150, 150],
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
      1: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: totalsX, right: 15 },
    showHead: false
  });
  
  // Grand Total
  const totalsEndY = (doc as any).lastAutoTable.finalY;
  doc.setFillColor(220, 220, 220);
  doc.rect(totalsX, totalsEndY, 87, 8, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', totalsX + 2, totalsEndY + 5);
  doc.text(formatCurrency(data.total_amount, data.currency), totalsX + 87, totalsEndY + 5, { align: 'right' });
  
  // INR equivalent
  if (data.currency !== 'INR') {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`(₹${formatIndianNumber(data.total_amount_inr)})`, totalsX + 87, totalsEndY + 12, { align: 'right' });
  }
  
  // TDS & Net Amount
  if (data.tds_amount > 0) {
    const tdsY = totalsEndY + 18;
    doc.setFontSize(9);
    doc.text(`TDS (${data.tds_percent}%):`, totalsX + 2, tdsY);
    doc.text(formatCurrency(data.tds_amount, data.currency), totalsX + 87, tdsY, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NET PAYABLE:', totalsX + 2, tdsY + 8);
    doc.text(formatCurrency(data.net_amount, data.currency), totalsX + 87, tdsY + 8, { align: 'right' });
  }
  
  // Inventory Impact Note
  const footerY = pageHeight - 35;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('INVENTORY IMPACT:', 15, footerY);
  doc.setFont('helvetica', 'normal');
  if (data.direct_supply_to_site) {
    doc.text('Direct supply to site - No warehouse stock update', 15, footerY + 5);
  } else {
    doc.text(`Stock added to ${data.warehouse_name}`, 15, footerY + 5);
  }
  
  // Authorization
  doc.text('Prepared By: _______________', 15, footerY + 15);
  doc.text('Verified By: _______________', pageWidth / 2 - 20, footerY + 15);
  doc.text('Approved By: _______________', pageWidth - 60, footerY + 15);
  
  return doc.output('blob');
};

// Helper functions
const formatCurrency = (amount: number, currency: string): string => {
  const symbol = currency === 'INR' ? '₹' : 
                 currency === 'USD' ? '$' :
                 currency === 'EUR' ? '€' :
                 currency === 'GBP' ? '£' : currency + ' ';
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatIndianNumber = (num: number): string => {
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Export PDF helpers
export const downloadPDF = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const openPDFPreview = (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

export const sendPDFByEmail = async (blob: Blob, toEmail: string, subject: string, message: string): Promise<boolean> => {
  // This would integrate with your email API
  // For now, return mock success
  console.log(`Emailing PDF to ${toEmail}: ${subject}`);
  return true;
};