import { useState } from 'react';
import type { QuotationTxnRow, InvoiceTxnRow, PurchaseTxnRow, ChallanTxnRow } from '../../model/aggregates';

interface TransactionsTabProps {
  quotationRows: QuotationTxnRow[];
  invoiceRows: InvoiceTxnRow[];
  purchaseRows: PurchaseTxnRow[];
  challanRows: ChallanTxnRow[];
  loading: boolean;
  initialTab?: 'quotation' | 'invoice' | 'purchase' | 'challan';
}

type SubTab = 'quotation' | 'invoice' | 'purchase' | 'challan';

export function TransactionsTab({ quotationRows, invoiceRows, purchaseRows, challanRows, loading, initialTab = 'quotation' }: TransactionsTabProps) {
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab);

  if (loading) return <div className="p-6 text-sm text-zinc-400">Loading...</div>;

  const tabs: { key: SubTab; label: string; count: number }[] = [
    { key: 'quotation', label: 'Quotations', count: quotationRows.length },
    { key: 'invoice', label: 'Invoices', count: invoiceRows.length },
    { key: 'purchase', label: 'Purchase Details', count: purchaseRows.length },
    { key: 'challan', label: 'Delivery Challans', count: challanRows.length },
  ];

  return (
    <div className="p-4">
      <div className="flex gap-1 mb-4 border-b border-zinc-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {activeTab === 'quotation' && <QuotationTable rows={quotationRows} />}
      {activeTab === 'invoice' && <InvoiceTable rows={invoiceRows} />}
      {activeTab === 'purchase' && <PurchaseTable rows={purchaseRows} />}
      {activeTab === 'challan' && <ChallanTable rows={challanRows} />}
    </div>
  );
}

function QuotationTable({ rows }: { rows: QuotationTxnRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-400">No quotations found.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Quotation No</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Date</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Client</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Status</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Qty</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Rate</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Line Total</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
              <td className="px-3 py-2 text-xs font-medium">{r.quotation_no}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{r.quote_date ? new Date(r.quote_date).toLocaleDateString() : '-'}</td>
              <td className="px-3 py-2 text-xs text-zinc-600">{r.client_name}</td>
              <td className="px-3 py-2 text-xs">{r.status || '-'}</td>
              <td className="px-3 py-2 text-xs text-right">{r.qty}</td>
              <td className="px-3 py-2 text-xs text-right">{r.rate}</td>
              <td className="px-3 py-2 text-xs text-right font-medium">{r.line_total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceTable({ rows }: { rows: InvoiceTxnRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-400">No invoices found.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Type</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Doc No</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Date</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Party</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Qty</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Amount</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
              <td className="px-3 py-2 text-xs">{r.type}</td>
              <td className="px-3 py-2 text-xs font-mono">{r.doc_no}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{r.doc_date ? new Date(r.doc_date).toLocaleDateString() : '-'}</td>
              <td className="px-3 py-2 text-xs text-zinc-600">{r.party}</td>
              <td className="px-3 py-2 text-xs text-right">{r.qty}</td>
              <td className="px-3 py-2 text-xs text-right font-medium">{r.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PurchaseTable({ rows }: { rows: PurchaseTxnRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-400">No purchase records found.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Vendor</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Invoice</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Date</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Qty</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Unit</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Rate</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Amount</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
              <td className="px-3 py-2 text-xs">{r.vendor_name}</td>
              <td className="px-3 py-2 text-xs font-mono">{r.invoice_no}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{r.purchase_date ? new Date(r.purchase_date).toLocaleDateString() : '-'}</td>
              <td className="px-3 py-2 text-xs text-right">{r.qty}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{r.unit}</td>
              <td className="px-3 py-2 text-xs text-right">{r.rate}</td>
              <td className="px-3 py-2 text-xs text-right font-medium">{r.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChallanTable({ rows }: { rows: ChallanTxnRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-400">No delivery challans found.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">DC No</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Date</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Client</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Status</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Qty</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Unit</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Amount</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
              <td className="px-3 py-2 text-xs font-medium">{r.dc_no}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{r.dc_date ? new Date(r.dc_date).toLocaleDateString() : '-'}</td>
              <td className="px-3 py-2 text-xs text-zinc-600">{r.client_name}</td>
              <td className="px-3 py-2 text-xs">{r.status || '-'}</td>
              <td className="px-3 py-2 text-xs text-right">{r.qty}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{r.unit}</td>
              <td className="px-3 py-2 text-xs text-right font-medium">{r.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
