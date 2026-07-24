export type FinancialSummary = {
  total_po_value: number;
  total_invoice_value: number;
  total_payment_received: number;
  total_expense: number;
  outstanding_amount: number;
  profit: number;
  po_balance: number;
};

export function calculateFinancialSummary(details: {
  pos: any[];
  invoices: any[];
  payments: any[];
  expenses: any[];
}): FinancialSummary {
  const { pos = [], invoices = [], payments = [], expenses = [] } = details;

  const totalPOValue = pos.reduce((s, p) => s + (parseFloat(p.po_total_value) || 0), 0);
  const totalInvoiceValue = invoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
  const totalPaymentReceived = payments.reduce((s, p) => s + (parseFloat(p.payment_amount) || 0), 0);
  const totalExpense = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  return {
    total_po_value: totalPOValue,
    total_invoice_value: totalInvoiceValue,
    total_payment_received: totalPaymentReceived,
    total_expense: totalExpense,
    outstanding_amount: totalInvoiceValue - totalPaymentReceived,
    profit: totalInvoiceValue - totalExpense,
    po_balance: totalPOValue - totalInvoiceValue,
  };
}
