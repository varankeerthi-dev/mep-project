import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type PaymentReceiptInput = {
  receipt_no: string;
  receipt_date: string;
  client_name: string;
  client_gstin?: string | null;
  client_address?: string | null;
  amount: number;
  amount_in_words: string;
  currency?: string;
  payment_mode?: string | null;
  payment_reference?: string | null;
  cheque_no?: string | null;
  utr_no?: string | null;
  po_number?: string | null;
  remarks?: string | null;
  unsettled_invoices?: Array<{ invoice_no: string; invoice_date: string; amount_applied: number; total: number; balance: number }>;
  organisation: Record<string, unknown>;
  signature_url?: string | null;
  signature_name?: string | null;
};

function fmt(n: number, currency?: string): string {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? 'GBP ' : currency === 'AED' ? 'AED ' : 'Rs. ';
  return sym + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

/** Payment Receipt — A4 print-ready document. */
export function generatePaymentReceiptPdf(input: PaymentReceiptInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - 2 * margin;
  let y = margin;

  const org = input.organisation;
  const themeColor = (org.theme_color as string) || '#1e40af';

  // ── Header bar ──
  doc.setFillColor(themeColor);
  doc.rect(0, 0, pageW, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(String(org.name || 'Organisation'), margin, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const orgAddr = [org.address, org.city, org.state].filter(Boolean).join(', ');
  doc.text(orgAddr || '', margin, 26);
  if (org.gstin) {
    doc.text(`GSTIN: ${org.gstin}`, margin, 31);
  }

  // Logo (top-right)
  const logoUrl = org.logo_url as string | undefined;
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, 'PNG', pageW - margin - 25, 5, 25, 25);
    } catch { /* skip */ }
  }

  y = 42;

  // ── Title ──
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT RECEIPT', pageW / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Receipt details ──
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Receipt No:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.text(input.receipt_no, margin + 30, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('Date:', pageW / 2 + 5, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.text(formatDate(input.receipt_date), pageW / 2 + 20, y);
  y += 7;

  if (input.po_number) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('PO / Ref No:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(input.po_number, margin + 30, y);
    y += 7;
  }

  // ── Received from ──
  y += 2;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, 'F');
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIVED FROM', margin + 4, y + 5);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(input.client_name, margin + 4, y + 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  if (input.client_gstin) {
    doc.text(`GSTIN: ${input.client_gstin}`, margin + 4, y + 18);
  }
  y += 28;

  // ── Amount ──
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.roundedRect(margin, y, contentW, 18, 2, 2, 'FD');
  doc.setTextColor(22, 101, 52);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT RECEIVED', margin + 4, y + 7);
  doc.setFontSize(16);
  doc.text(fmt(input.amount, input.currency), pageW - margin - 4, y + 7, { align: 'right' });
  y += 24;

  // ── Payment details ──
  if (input.payment_mode || input.payment_reference || input.cheque_no || input.utr_no || input.remarks) {
    y += 2;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT DETAILS', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);

    if (input.payment_mode) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('Mode:', margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(String(input.payment_mode), margin + 25, y);
      y += 6;
    }
    if (input.cheque_no) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('Cheque No:', margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(String(input.cheque_no), margin + 25, y);
      y += 6;
    }
    if (input.utr_no) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('UTR / Ref:', margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(String(input.utr_no), margin + 25, y);
      y += 6;
    }
    if (input.payment_reference) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('Reference:', margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(String(input.payment_reference), margin + 25, y);
      y += 6;
    }
    if (input.remarks) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('Remarks:', margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(String(input.remarks), margin + 25, y);
      y += 6;
    }
  }

  // ── Amount in words ──
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount in Words:', margin, y);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  const wordsLines = doc.splitTextToSize(input.amount_in_words, contentW - 40);
  doc.text(wordsLines, margin + 40, y);
  y += wordsLines.length * 5 + 4;

  // ── Unsettled invoices (optional) ──
  if (input.unsettled_invoices && input.unsettled_invoices.length > 0) {
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('UNSETTLED INVOICES', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Invoice No.', 'Date', 'Total', 'Applied', 'Balance']],
      body: input.unsettled_invoices.map(inv => [
        inv.invoice_no,
        formatDate(inv.invoice_date),
        fmt(inv.total, input.currency),
        fmt(inv.amount_applied, input.currency),
        fmt(inv.balance, input.currency),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [245, 247, 250], textColor: [100, 100, 100], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Thank you note ──
  if (y > 230) { doc.addPage(); y = margin; }
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank you for your payment!', pageW / 2, y, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('This is a computer-generated receipt.', pageW / 2, y + 5, { align: 'center' });
  y += 14;

  // ── Authorised Signatory ──
  if (input.signature_url && input.signature_name) {
    const sigX = pageW - margin - 55;
    doc.setDrawColor(180, 180, 180);
    doc.line(sigX, y, sigX + 55, y);
    try {
      doc.addImage(input.signature_url, 'PNG', sigX + 12, y - 14, 30, 14);
    } catch { /* skip */ }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(input.signature_name, sigX + 27.5, y + 5, { align: 'center' });
    doc.text('Authorised Signatory', sigX + 27.5, y + 9, { align: 'center' });
  }

  return doc;
}
