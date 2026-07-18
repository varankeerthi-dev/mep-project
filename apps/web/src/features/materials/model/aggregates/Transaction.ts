/** Normalized transaction row types for the detail viewer */

export interface AdjustmentRow {
  id: string;
  type: 'Inward' | 'Outward';
  source: string;
  doc_no: string;
  txn_date: string;
  party: string;
  qty: number;
  unit: string;
  remarks: string;
}

export interface QuotationTxnRow {
  id: string;
  quotation_no: string;
  quote_date: string;
  client_name: string;
  status: string;
  qty: number;
  uom: string;
  rate: number;
  line_total: number;
}

export interface InvoiceTxnRow {
  id: string;
  type: string;
  doc_no: string;
  doc_date: string;
  party: string;
  qty: number;
  amount: number;
}

export interface PurchaseTxnRow {
  id: string;
  vendor_name: string;
  invoice_no: string;
  purchase_date: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface ChallanTxnRow {
  id: string;
  dc_no: string;
  dc_date: string;
  client_name: string;
  status: string;
  qty: number;
  unit: string;
  amount: number;
}

export interface AuditTxnRow {
  id: string;
  action: string;
  notes: string;
  created_at: string;
  changes: string[];
}

export interface ItemTransactions {
  warehouseRows: WarehouseStockRow[];
  adjustmentRows: AdjustmentRow[];
  quotationRows: QuotationTxnRow[];
  invoiceRows: InvoiceTxnRow[];
  purchaseRows: PurchaseTxnRow[];
  challanRows: ChallanTxnRow[];
  auditRows: AuditTxnRow[];
}

// Use WarehouseStockRow from WarehouseStock aggregate
import type { WarehouseStockRow } from './WarehouseStock';

export function createEmptyItemTransactions(): ItemTransactions {
  return {
    warehouseRows: [],
    adjustmentRows: [],
    quotationRows: [],
    invoiceRows: [],
    purchaseRows: [],
    challanRows: [],
    auditRows: [],
  };
}
