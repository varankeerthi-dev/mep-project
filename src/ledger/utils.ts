import { format, isAfter, parseISO } from 'date-fns';
import type { LedgerClient, LedgerInvoice, LedgerReceipt, OpeningBalance } from './api';

export type LedgerStatementRow = {
  id: string;
  date: string;
  paymentType?: string | null;
  type: 'Debit' | 'Credit' | 'Opening Balance';
  remarks: string;
  debit: number;
  credit: number;
};

export type LedgerSummaryRow = {
  clientId: string;
  clientName: string;
  outstanding: number;
  oldestDueDate: string | null;
  overdue: boolean;
  invoices: LedgerInvoice[];
  receipts: LedgerReceipt[];
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatCurrencyExplicit(value: number) {
  return `Rs. ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

export function formatDisplayDate(value?: string | null) {
  if (!value) return '-';
  try {
    return format(parseISO(value), 'dd MMM yyyy');
  } catch {
    return value;
  }
}

export function getClientName(client?: LedgerClient | null, fallback?: string | null) {
  return client?.name ?? fallback ?? 'Unknown client';
}

export function generateFyOptions(format: string, startMonth: number = 4): string[] {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  
  for (let i = -2; i <= 3; i++) {
    const year = currentYear + i;
    if (year > 2060) continue;
    const nextYear = year + 1;
    const yearStr = year.toString();
    const nextYearStr = nextYear.toString().slice(-2);
    
    let fy: string;
    switch (format) {
      case 'FY24-25':
        fy = `FY${yearStr.slice(-2)}-${nextYearStr}`;
        break;
      case 'FY2024-25':
        fy = `FY${yearStr}-${nextYearStr}`;
        break;
      case '2024-25':
        fy = `${yearStr}-${nextYearStr}`;
        break;
      case '2024_25':
        fy = `${yearStr}_${nextYearStr}`;
        break;
      default:
        fy = `${yearStr.slice(-2)}-${nextYearStr}`;
    }
    options.push(fy);
  }
  
  return options;
}

function normalizeDate(value?: string | null) {
  return value ?? '9999-12-31';
}

export function buildLedgerStatementRows(
  invoices: LedgerInvoice[], 
  receipts: LedgerReceipt[],
  openingBalance?: OpeningBalance | null
): LedgerStatementRow[] {
  const rows: LedgerStatementRow[] = [];

  if (openingBalance && openingBalance.amount > 0) {
    rows.push({
      id: `ob-${openingBalance.id}`,
      date: openingBalance.as_of_date || '',
      type: 'Opening Balance' as const,
      remarks: openingBalance.remarks || `Opening Balance`,
      debit: Number(openingBalance.amount || 0),
      credit: 0,
    });
  }

  const debitRows: LedgerStatementRow[] = invoices.map((invoice) => ({
    id: `inv-${invoice.id}`,
    date: invoice.invoice_date ?? invoice.created_at?.slice(0, 10) ?? '',
    type: 'Debit' as const,
    remarks: invoice.remarks || invoice.invoice_no || 'Invoice',
    debit: Number(invoice.total || 0),
    credit: 0,
  }));

  const creditRows: LedgerStatementRow[] = receipts.map((receipt) => ({
    id: `rcpt-${receipt.id}`,
    date: receipt.receipt_date,
    paymentType: receipt.payment_type || '-',
    type: 'Credit' as const,
    remarks: receipt.remarks || receipt.receipt_no || 'Receipt',
    debit: 0,
    credit: Number(receipt.amount || 0),
  }));

  return [...rows, ...debitRows, ...creditRows].sort((left, right) => {
    if (left.type === 'Opening Balance') return -1;
    if (right.type === 'Opening Balance') return 1;
    return normalizeDate(left.date).localeCompare(normalizeDate(right.date));
  });
}

export function buildLedgerSummaries(
  clients: LedgerClient[],
  invoices: LedgerInvoice[],
  receipts: LedgerReceipt[],
  today = new Date(),
): LedgerSummaryRow[] {
  const receiptsByClient = new Map<string, LedgerReceipt[]>();
  receipts.forEach((receipt) => {
    const list = receiptsByClient.get(receipt.client_id) ?? [];
    list.push(receipt);
    receiptsByClient.set(receipt.client_id, list);
  });

  return clients
    .map((client) => {
      const clientInvoices = invoices
        .filter((invoice) => invoice.client_id === client.id)
        .sort((left, right) => normalizeDate(left.due_date ?? left.invoice_date).localeCompare(normalizeDate(right.due_date ?? right.invoice_date)));
      const clientReceipts = (receiptsByClient.get(client.id) ?? []).sort((left, right) => normalizeDate(left.receipt_date).localeCompare(normalizeDate(right.receipt_date)));

      let remainingReceipts = clientReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
      let oldestDueDate: string | null = null;

      clientInvoices.forEach((invoice) => {
        const invoiceAmount = Number(invoice.total || 0);
        const applied = Math.min(invoiceAmount, remainingReceipts);
        remainingReceipts -= applied;
        const unpaid = invoiceAmount - applied;

        if (unpaid > 0 && !oldestDueDate) {
          oldestDueDate = invoice.due_date ?? invoice.invoice_date ?? null;
        }
      });

      const totalInvoices = clientInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
      const totalReceipts = clientReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
      const outstanding = Number((totalInvoices - totalReceipts).toFixed(2));
      const overdue = Boolean(oldestDueDate && isAfter(today, parseISO(oldestDueDate)));

      return {
        clientId: client.id,
        clientName: client.name,
        outstanding,
        oldestDueDate,
        overdue,
        invoices: clientInvoices,
        receipts: clientReceipts,
      };
    })
    .sort((left, right) => right.outstanding - left.outstanding);
}
