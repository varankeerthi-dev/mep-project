// @ts-nocheck
import * as TP from '../persistence/transactionPersistence';
import { getLocalAuditTrail, normalizeAuditChanges } from '../shared/audit';
import { createEmptyItemTransactions } from '../model/aggregates/Transaction';

/** Load all transaction data for an item and normalize for display */
export async function loadItemTransactionData(itemId: string) {
  try {
    const [
      warehouseStockRows,
      warehouseMasterRows,
      variantMasterRows,
      inwardItemRows,
      outwardItemRows,
      quotationItemRows,
      challanItemRows,
      auditDbRows,
    ] = await Promise.all([
      TP.fetchItemStockTransactions(itemId),
      TP.fetchWarehouseMaster(),
      TP.fetchVariantMaster(),
      TP.fetchInwardItems(itemId),
      TP.fetchOutwardItems(itemId),
      TP.fetchQuotationItems(itemId),
      TP.fetchChallanItems(itemId),
      TP.fetchAuditLogs(itemId),
    ]);

    const inwardIds = [...new Set(inwardItemRows.map((r) => r.inward_id).filter(Boolean))];
    const outwardIds = [...new Set(outwardItemRows.map((r) => r.outward_id).filter(Boolean))];
    const quotationIds = [...new Set(quotationItemRows.map((r) => r.quotation_id).filter(Boolean))];
    const challanIds = [...new Set(challanItemRows.map((r) => r.delivery_challan_id).filter(Boolean))];

    const [inwardRows, outwardRows, quotationRows, challanRows, clientRows] = await Promise.all([
      TP.fetchInwardHeaders(inwardIds),
      TP.fetchOutwardHeaders(outwardIds),
      TP.fetchQuotationHeaders(quotationIds),
      TP.fetchChallanHeaders(challanIds),
      (async () => {
        const clientIds = [...new Set((await TP.fetchQuotationHeaders(quotationIds)).map((r) => r.client_id).filter(Boolean))];
        return TP.fetchClientsByIds(clientIds);
      })(),
    ]);

    // Build lookup maps
    const warehouseMap = {};
    warehouseMasterRows.forEach((r) => { warehouseMap[r.id] = r.warehouse_name || r.name || r.warehouse_code || 'Warehouse'; });
    const variantMap = {};
    variantMasterRows.forEach((r) => { variantMap[r.id] = r.variant_name; });
    const inwardMap = {};
    inwardRows.forEach((r) => { inwardMap[r.id] = r; });
    const outwardMap = {};
    outwardRows.forEach((r) => { outwardMap[r.id] = r; });
    const quotationMap = {};
    quotationRows.forEach((r) => { quotationMap[r.id] = r; });
    const challanMap = {};
    challanRows.forEach((r) => { challanMap[r.id] = r; });
    const clientMap = {};
    clientRows.forEach((r) => { clientMap[r.id] = r.client_name; });

    // Normalize warehouse rows
    const normalizedWarehouseRows = (warehouseStockRows || [])
      .map((row) => ({
        id: row.id,
        warehouse: warehouseMap[row.warehouse_id] || 'Unassigned',
        variant: variantMap[row.company_variant_id] || 'Default',
        current_stock: parseFloat(row.current_stock) || 0,
        low_stock_level: parseFloat(row.low_stock_level) || 0,
        updated_at: row.updated_at,
      }))
      .sort((a, b) => a.warehouse.localeCompare(b.warehouse));

    // Normalize adjustments
    const inwardAdjustments = (inwardItemRows || []).map((row) => {
      const header = inwardMap[row.inward_id] || {};
      return {
        id: `in-${row.id}`,
        type: 'Inward',
        source: 'Material Inward',
        doc_no: header.invoice_no || row.inward_id || '-',
        txn_date: header.inward_date || row.created_at,
        party: header.vendor_name || '-',
        qty: parseFloat(row.quantity) || 0,
        unit: row.unit || '-',
        remarks: header.remarks || '-',
      };
    });
    const outwardAdjustments = (outwardItemRows || []).map((row) => {
      const header = outwardMap[row.outward_id] || {};
      return {
        id: `out-${row.id}`,
        type: 'Outward',
        source: 'Material Outward/Rejection',
        doc_no: row.outward_id || '-',
        txn_date: header.outward_date || row.created_at,
        party: header.project_id || '-',
        qty: (parseFloat(row.quantity) || 0) * -1,
        unit: row.unit || '-',
        remarks: header.remarks || '-',
      };
    });
    const normalizedAdjustments = [...inwardAdjustments, ...outwardAdjustments].sort(
      (a, b) => new Date(b.txn_date || 0).getTime() - new Date(a.txn_date || 0).getTime()
    );

    // Normalize quotation rows
    const normalizedQuotationRows = (quotationItemRows || [])
      .map((row) => {
        const header = quotationMap[row.quotation_id] || {};
        return {
          id: row.id,
          quotation_no: header.quotation_no || row.quotation_id || '-',
          quote_date: header.date || row.created_at,
          client_name: clientMap[header.client_id] || '-',
          status: header.status || '-',
          qty: parseFloat(row.qty) || 0,
          uom: row.uom || '-',
          rate: parseFloat(row.rate) || 0,
          line_total: parseFloat(row.line_total) || 0,
        };
      })
      .sort((a, b) => new Date(b.quote_date || 0).getTime() - new Date(a.quote_date || 0).getTime());

    // Normalize challan rows
    const normalizedChallanRows = (challanItemRows || [])
      .map((row) => {
        const header = challanMap[row.delivery_challan_id] || {};
        return {
          id: row.id,
          dc_no: header.dc_number || row.delivery_challan_id || '-',
          dc_date: header.dc_date || row.created_at,
          client_name: header.client_name || '-',
          status: header.status || '-',
          qty: parseFloat(row.quantity) || 0,
          unit: row.unit || '-',
          amount: parseFloat(row.amount) || 0,
        };
      })
      .sort((a, b) => new Date(b.dc_date || 0).getTime() - new Date(a.dc_date || 0).getTime());

    // Invoice rows
    const inwardInvoiceRows = (inwardItemRows || [])
      .map((row) => {
        const header = inwardMap[row.inward_id] || {};
        return {
          id: `inv-in-${row.id}`,
          type: 'Purchase Invoice',
          doc_no: header.invoice_no || '-',
          doc_date: header.inward_date || row.created_at,
          party: header.vendor_name || '-',
          qty: parseFloat(row.quantity) || 0,
          amount: parseFloat(row.amount) || (parseFloat(row.rate) || 0) * (parseFloat(row.quantity) || 0),
        };
      })
      .filter((row) => row.doc_no && row.doc_no !== '-');

    const challanInvoiceRows = (challanItemRows || []).map((row) => {
      const header = challanMap[row.delivery_challan_id] || {};
      return {
        id: `inv-dc-${row.id}`,
        type: 'Sales Invoice',
        doc_no: header.dc_number || '-',
        doc_date: header.dc_date || row.created_at,
        party: header.client_name || '-',
        qty: parseFloat(row.quantity) || 0,
        amount: parseFloat(row.amount) || 0,
      };
    });

    const noteRows = (outwardItemRows || [])
      .map((row) => {
        const header = outwardMap[row.outward_id] || {};
        const remarks = (header.remarks || '').toLowerCase();
        const isCredit = remarks.includes('credit');
        const isDebit = remarks.includes('debit');
        if (!isCredit && !isDebit) return null;
        return {
          id: `note-${row.id}`,
          type: isCredit ? 'Credit Note' : 'Debit Note',
          doc_no: row.outward_id || '-',
          doc_date: header.outward_date || row.created_at,
          party: header.project_id || '-',
          qty: parseFloat(row.quantity) || 0,
          amount: 0,
        };
      })
      .filter(Boolean);

    const normalizedInvoiceRows = [...inwardInvoiceRows, ...challanInvoiceRows, ...noteRows].sort(
      (a, b) => new Date(b.doc_date || 0).getTime() - new Date(a.doc_date || 0).getTime()
    );

    // Purchase rows
    const normalizedPurchaseRows = (inwardItemRows || [])
      .map((row) => {
        const header = inwardMap[row.inward_id] || {};
        const qty = parseFloat(row.quantity) || 0;
        const rate = parseFloat(row.rate) || 0;
        return {
          id: `pur-${row.id}`,
          vendor_name: header.vendor_name || '-',
          invoice_no: header.invoice_no || '-',
          purchase_date: header.inward_date || row.created_at,
          qty,
          unit: row.unit || '-',
          rate,
          amount: parseFloat(row.amount) || (qty * rate),
        };
      })
      .sort((a, b) => new Date(b.purchase_date || 0).getTime() - new Date(a.purchase_date || 0).getTime());

    // Audit rows
    const dbAuditRowsNormalized = (auditDbRows || []).map((row) => ({
      id: row.id || `db-${row.created_at || Date.now()}`,
      action: row.action || row.action_type || row.event_type || 'UPDATED',
      notes: row.notes || row.action_details || row.description || '-',
      created_at: row.created_at || row.updated_at || row.timestamp || new Date().toISOString(),
      changes: normalizeAuditChanges(row.changes || row.changed_fields || row.change_summary),
    }));

    const localAuditRowsNormalized = (getLocalAuditTrail() || [])
      .filter((row) => row.item_id === itemId)
      .map((row) => ({
        id: row.id,
        action: row.action || 'UPDATED',
        notes: row.notes || '-',
        created_at: row.created_at || new Date().toISOString(),
        changes: normalizeAuditChanges(row.changes),
      }));

    const normalizedAuditRows = [...dbAuditRowsNormalized, ...localAuditRowsNormalized].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    return {
      warehouseRows: normalizedWarehouseRows,
      adjustmentRows: normalizedAdjustments,
      quotationRows: normalizedQuotationRows,
      invoiceRows: normalizedInvoiceRows,
      purchaseRows: normalizedPurchaseRows,
      challanRows: normalizedChallanRows,
      auditRows: normalizedAuditRows,
    };
  } catch (err) {
    console.error('Item transaction load error:', err);
    return createEmptyItemTransactions();
  }
}
