import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type VendorLedgerVendor = {
  id: string;
  vendor_code?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  gstin?: string | null;
  phone?: string | null;
  opening_balance?: number | null;
};

export type VendorLedgerBill = {
  id: string;
  bill_number?: string | null;
  bill_date?: string | null;
  due_date?: string | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  balance_amount?: number | null;
  payment_status?: string | null;
  vendor_invoice_no?: string | null;
};

export type VendorLedgerPayment = {
  id: string;
  voucher_no?: string | null;
  payment_date?: string | null;
  amount?: number | null;
  reference_no?: string | null;
  narration?: string | null;
  is_advance?: boolean | null;
  payment_mode?: string | null;
  has_vendor_proforma?: boolean | null;
  vendor_proforma_invoice?: string | null;
  vendor_proforma_date?: string | null;
  vendor_proforma_amount?: number | null;
};

export type VendorLedgerDebitNote = {
  id: string;
  dn_number?: string | null;
  dn_date?: string | null;
  dn_type?: string | null;
  total_amount?: number | null;
  reason?: string | null;
  approval_status?: string | null;
};

export type VendorLedgerEntry = {
  id: string;
  date: string;
  type: 'Opening Balance' | 'Bill' | 'Payment' | 'Debit Note';
  reference: string;
  remarks: string;
  debit: number;
  credit: number;
  balance: number;
};

export type VendorLedgerSummary = {
  openingBalance: number;
  totalBills: number;
  totalPayments: number;
  totalDebitNotes: number;
  totalCredits: number;
  closingBalance: number;
};

export type VendorLedgerDateRange = {
  startDate?: string;
  endDate?: string;
};

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0);

export const formatLedgerCurrency = (value: number) =>
  `Rs. ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatLedgerDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN');
};

const isWithinRange = (dateValue: string, range?: VendorLedgerDateRange) => {
  if (!dateValue) return false;
  if (!range?.startDate && !range?.endDate) return true;
  if (range.startDate && dateValue < range.startDate) return false;
  if (range.endDate && dateValue > range.endDate) return false;
  return true;
};

export function buildVendorLedgerEntries(
  vendor: VendorLedgerVendor | null,
  bills: VendorLedgerBill[],
  payments: VendorLedgerPayment[],
  debitNotes: VendorLedgerDebitNote[]
): VendorLedgerEntry[] {
  const openingBalance = toNumber(vendor?.opening_balance);

  const rawEntries: Array<Omit<VendorLedgerEntry, 'balance'>> = [
    {
      id: `${vendor?.id ?? 'vendor'}-opening`,
      date: '0000-01-01',
      type: 'Opening Balance',
      reference: vendor?.vendor_code || 'Opening',
      remarks: 'Opening balance carried forward',
      debit: openingBalance > 0 ? openingBalance : 0,
      credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
    },
    ...bills.map((bill) => ({
      id: `bill-${bill.id}`,
      date: bill.bill_date || '',
      type: 'Bill' as const,
      reference: bill.bill_number || 'Bill',
      remarks: bill.vendor_invoice_no ? `Vendor Inv: ${bill.vendor_invoice_no}` : (bill.payment_status || 'Purchase bill'),
      debit: toNumber(bill.total_amount),
      credit: 0,
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.payment_date || '',
      type: 'Payment' as const,
      reference: payment.voucher_no || 'Payment',
      remarks: [
        payment.payment_mode,
        payment.reference_no,
        payment.narration,
        payment.has_vendor_proforma
          ? `Proforma: ${payment.vendor_proforma_invoice || '-'}${payment.vendor_proforma_date ? ` on ${formatLedgerDate(payment.vendor_proforma_date)}` : ''}${payment.vendor_proforma_amount ? ` • ${formatLedgerCurrency(toNumber(payment.vendor_proforma_amount))}` : ''}`
          : null,
      ].filter(Boolean).join(' • ') || (payment.is_advance ? 'Advance payment' : 'Vendor payment'),
      debit: 0,
      credit: toNumber(payment.amount),
    })),
    ...debitNotes.map((debitNote) => ({
      id: `debit-note-${debitNote.id}`,
      date: debitNote.dn_date || '',
      type: 'Debit Note' as const,
      reference: debitNote.dn_number || 'Debit Note',
      remarks: [debitNote.dn_type, debitNote.reason].filter(Boolean).join(' • ') || 'Approved debit note',
      debit: 0,
      credit: toNumber(debitNote.total_amount),
    })),
  ];

  const sortedEntries = rawEntries.sort((a, b) => {
    if (a.date === b.date) return a.reference.localeCompare(b.reference);
    return a.date.localeCompare(b.date);
  });

  let runningBalance = 0;
  return sortedEntries.map((entry) => {
    runningBalance += entry.debit - entry.credit;
    return {
      ...entry,
      balance: runningBalance,
    };
  });
}

export function calculateVendorLedgerSummary(
  vendor: VendorLedgerVendor | null,
  bills: VendorLedgerBill[],
  payments: VendorLedgerPayment[],
  debitNotes: VendorLedgerDebitNote[]
): VendorLedgerSummary {
  const openingBalance = toNumber(vendor?.opening_balance);
  const totalBills = bills.reduce((sum, bill) => sum + toNumber(bill.total_amount), 0);
  const totalPayments = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const totalDebitNotes = debitNotes.reduce((sum, debitNote) => sum + toNumber(debitNote.total_amount), 0);
  const totalCredits = totalPayments + totalDebitNotes;

  return {
    openingBalance,
    totalBills,
    totalPayments,
    totalDebitNotes,
    totalCredits,
    closingBalance: openingBalance + totalBills - totalCredits,
  };
}

export function filterVendorLedgerEntries(
  entries: VendorLedgerEntry[],
  range?: VendorLedgerDateRange
): VendorLedgerEntry[] {
  if (!range?.startDate && !range?.endDate) {
    return entries;
  }

  const openingEntry = entries.find((entry) => entry.type === 'Opening Balance');
  const datedEntries = entries.filter((entry) => entry.type !== 'Opening Balance');
  const entriesBeforeRange = range.startDate
    ? datedEntries.filter((entry) => entry.date && entry.date < range.startDate)
    : [];
  const carriedBalance = entriesBeforeRange.length
    ? entriesBeforeRange[entriesBeforeRange.length - 1].balance
    : (openingEntry?.balance ?? 0);

  const filteredEntries = datedEntries.filter((entry) => isWithinRange(entry.date, range));

  const syntheticOpening: VendorLedgerEntry = {
    id: `range-opening-${range.startDate ?? 'start'}-${range.endDate ?? 'end'}`,
    date: range.startDate || openingEntry?.date || '',
    type: 'Opening Balance',
    reference: openingEntry?.reference || 'Opening',
    remarks: 'Balance brought forward for selected range',
    debit: carriedBalance > 0 ? carriedBalance : 0,
    credit: carriedBalance < 0 ? Math.abs(carriedBalance) : 0,
    balance: carriedBalance,
  };

  return [syntheticOpening, ...filteredEntries];
}

export function calculateVendorLedgerRangeSummary(entries: VendorLedgerEntry[]): VendorLedgerSummary {
  const openingEntry = entries.find((entry) => entry.type === 'Opening Balance');
  const activityEntries = entries.filter((entry) => entry.type !== 'Opening Balance');

  const totalBills = activityEntries
    .filter((entry) => entry.type === 'Bill')
    .reduce((sum, entry) => sum + entry.debit, 0);
  const totalPayments = activityEntries
    .filter((entry) => entry.type === 'Payment')
    .reduce((sum, entry) => sum + entry.credit, 0);
  const totalDebitNotes = activityEntries
    .filter((entry) => entry.type === 'Debit Note')
    .reduce((sum, entry) => sum + entry.credit, 0);

  return {
    openingBalance: openingEntry?.balance ?? 0,
    totalBills,
    totalPayments,
    totalDebitNotes,
    totalCredits: totalPayments + totalDebitNotes,
    closingBalance: entries.length ? entries[entries.length - 1].balance : (openingEntry?.balance ?? 0),
  };
}

export function downloadVendorLedgerPdf(
  organisationName: string,
  vendor: VendorLedgerVendor,
  summary: VendorLedgerSummary,
  entries: VendorLedgerEntry[]
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(organisationName || 'Organisation', 40, 48);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Vendor Ledger Statement', 40, 66);

  doc.setFont('helvetica', 'bold');
  doc.text(vendor.company_name || 'Vendor', 40, 102);
  doc.setFont('helvetica', 'normal');
  doc.text(`Vendor Code: ${vendor.vendor_code || '-'}`, 40, 120);
  doc.text(`Contact: ${vendor.contact_person || vendor.phone || '-'}`, 40, 136);
  doc.text(`GSTIN: ${vendor.gstin || '-'}`, 40, 152);

  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 40, 48, { align: 'right' });
  doc.text(`Closing Balance: ${formatLedgerCurrency(summary.closingBalance)}`, pageWidth - 40, 66, { align: 'right' });

  autoTable(doc, {
    startY: 182,
    head: [['Date', 'Type', 'Reference', 'Remarks', 'Debit', 'Credit', 'Balance']],
    body: entries.map((entry) => [
      formatLedgerDate(entry.date),
      entry.type,
      entry.reference,
      entry.remarks,
      entry.debit ? formatLedgerCurrency(entry.debit) : '-',
      entry.credit ? formatLedgerCurrency(entry.credit) : '-',
      formatLedgerCurrency(entry.balance),
    ]),
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      lineColor: [220, 224, 229],
      lineWidth: 0.5,
      textColor: [31, 41, 55],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 54 },
      1: { cellWidth: 60 },
      2: { cellWidth: 72 },
      3: { cellWidth: 150 },
      4: { halign: 'right', cellWidth: 68 },
      5: { halign: 'right', cellWidth: 68 },
      6: { halign: 'right', cellWidth: 68 },
    },
    margin: { left: 40, right: 40 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 220;
  const summaryX = pageWidth - 220;
  const summaryRows = [
    ['Opening Balance', formatLedgerCurrency(summary.openingBalance)],
    ['Bills', formatLedgerCurrency(summary.totalBills)],
    ['Payments', formatLedgerCurrency(summary.totalPayments)],
    ['Debit Notes', formatLedgerCurrency(summary.totalDebitNotes)],
    ['Closing Balance', formatLedgerCurrency(summary.closingBalance)],
  ];

  autoTable(doc, {
    startY: finalY + 18,
    body: summaryRows,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 5,
      lineColor: [220, 224, 229],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 100, fontStyle: 'bold' },
      1: { cellWidth: 80, halign: 'right' },
    },
    margin: { left: summaryX },
    showHead: false,
  });

  doc.save(`vendor-ledger-${(vendor.company_name || 'vendor').replace(/\s+/g, '-').toLowerCase()}.pdf`);
}
