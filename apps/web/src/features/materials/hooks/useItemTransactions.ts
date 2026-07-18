// @ts-nocheck
import { useState, useCallback } from 'react';
import { supabase } from '../../../supabase';
import { timedSupabaseQuery } from '../../../utils/queryTimeout';
import { emptyItemTransactions } from '../shared/constants';
import { getLocalAuditTrail, normalizeAuditChanges } from '../shared/audit';

const runQuery = async (label: string, queryBuilder: any) => {
  try {
    const data = await timedSupabaseQuery(queryBuilder, label, 15000);
    return data || [];
  } catch (err: any) {
    console.log(`${label} load warning:`, err.message);
    return [];
  }
};

export function useItemTransactions() {
  const [itemTransactions, setItemTransactions] = useState(emptyItemTransactions());
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadItemTransactions = useCallback(async (itemId: string) => {
    if (!itemId) return;
    setDetailLoading(true);
    setDetailError('');

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
        runQuery('item_stock', supabase.from('item_stock').select('id, item_id, company_variant_id, warehouse_id, current_stock, low_stock_level, updated_at').eq('item_id', itemId)),
        runQuery('warehouses', supabase.from('warehouses').select('id, warehouse_name, name, warehouse_code')),
        runQuery('company_variants', supabase.from('company_variants').select('id, variant_name')),
        runQuery('material_inward_items', supabase.from('material_inward_items').select('id, inward_id, material_id, quantity, unit, rate, amount, created_at').eq('material_id', itemId).order('created_at', { ascending: false })),
        runQuery('material_outward_items', supabase.from('material_outward_items').select('id, outward_id, material_id, quantity, unit, created_at').eq('material_id', itemId).order('created_at', { ascending: false })),
        runQuery('quotation_items', supabase.from('quotation_items').select('id, quotation_id, item_id, qty, uom, rate, line_total, created_at').eq('item_id', itemId).order('created_at', { ascending: false })),
        runQuery('delivery_challan_items', supabase.from('delivery_challan_items').select('id, delivery_challan_id, material_id, quantity, unit, rate, amount, created_at').eq('material_id', itemId).order('created_at', { ascending: false })),
        runQuery('item_audit_logs', supabase.from('item_audit_logs').select('*').eq('item_id', itemId).order('created_at', { ascending: false })),
      ]);

      // Build lookup maps
      const inwardIds = [...new Set(inwardItemRows.map((row: any) => row.inward_id).filter(Boolean))];
      const outwardIds = [...new Set(outwardItemRows.map((row: any) => row.outward_id).filter(Boolean))];
      const quotationIds = [...new Set(quotationItemRows.map((row: any) => row.quotation_id).filter(Boolean))];
      const challanIds = [...new Set(challanItemRows.map((row: any) => row.delivery_challan_id).filter(Boolean))];

      const [inwardRows, outwardRows, quotationRows, challanRows] = await Promise.all([
        inwardIds.length ? runQuery('material_inward', supabase.from('material_inward').select('id, inward_date, vendor_name, invoice_no, remarks, created_at').in('id', inwardIds)) : [],
        outwardIds.length ? runQuery('material_outward', supabase.from('material_outward').select('id, outward_date, project_id, remarks, created_at').in('id', outwardIds)) : [],
        quotationIds.length ? runQuery('quotation_header', supabase.from('quotation_header').select('id, quotation_no, date, client_id, status, grand_total, created_at').in('id', quotationIds)) : [],
        challanIds.length ? runQuery('delivery_challans', supabase.from('delivery_challans').select('id, dc_number, dc_date, status, client_name, created_at').in('id', challanIds)) : [],
      ]);

      const clientIds = [...new Set(quotationRows.map((row: any) => row.client_id).filter(Boolean))];
      const clientRows = clientIds.length ? await runQuery('clients', supabase.from('clients').select('id, client_name').in('id', clientIds)) : [];

      // Build maps
      const warehouseMap: Record<string, string> = {};
      warehouseMasterRows.forEach((row: any) => { warehouseMap[row.id] = row.warehouse_name || row.name || row.warehouse_code || 'Warehouse'; });
      const variantMap: Record<string, string> = {};
      variantMasterRows.forEach((row: any) => { variantMap[row.id] = row.variant_name; });
      const inwardMap: Record<string, any> = {};
      inwardRows.forEach((row: any) => { inwardMap[row.id] = row; });
      const outwardMap: Record<string, any> = {};
      outwardRows.forEach((row: any) => { outwardMap[row.id] = row; });
      const quotationMap: Record<string, any> = {};
      quotationRows.forEach((row: any) => { quotationMap[row.id] = row; });
      const challanMap: Record<string, any> = {};
      challanRows.forEach((row: any) => { challanMap[row.id] = row; });
      const clientMap: Record<string, string> = {};
      clientRows.forEach((row: any) => { clientMap[row.id] = row.client_name; });

      // Normalize warehouse rows
      const normalizedWarehouseRows = warehouseStockRows
        .map((row: any) => ({
          id: row.id,
          warehouse: warehouseMap[row.warehouse_id] || 'Unassigned',
          variant: variantMap[row.company_variant_id] || 'Default',
          current_stock: parseFloat(row.current_stock) || 0,
          low_stock_level: parseFloat(row.low_stock_level) || 0,
          updated_at: row.updated_at,
        }))
        .sort((a: any, b: any) => a.warehouse.localeCompare(b.warehouse));

      // Normalize adjustments
      const inwardAdjustments = inwardItemRows.map((row: any) => {
        const header = inwardMap[row.inward_id] || {};
        return { id: `in-${row.id}`, type: 'Inward', source: 'Material Inward', doc_no: header.invoice_no || row.inward_id || '-', txn_date: header.inward_date || row.created_at, party: header.vendor_name || '-', qty: parseFloat(row.quantity) || 0, unit: row.unit || '-', remarks: header.remarks || '-' };
      });
      const outwardAdjustments = outwardItemRows.map((row: any) => {
        const header = outwardMap[row.outward_id] || {};
        return { id: `out-${row.id}`, type: 'Outward', source: 'Material Outward/Rejection', doc_no: row.outward_id || '-', txn_date: header.outward_date || row.created_at, party: header.project_id || '-', qty: (parseFloat(row.quantity) || 0) * -1, unit: row.unit || '-', remarks: header.remarks || '-' };
      });
      const normalizedAdjustments = [...inwardAdjustments, ...outwardAdjustments].sort((a: any, b: any) => new Date(b.txn_date || 0).getTime() - new Date(a.txn_date || 0).getTime());

      // Normalize quotation rows
      const normalizedQuotationRows = quotationItemRows
        .map((row: any) => {
          const header = quotationMap[row.quotation_id] || {};
          return { id: row.id, quotation_no: header.quotation_no || row.quotation_id || '-', quote_date: header.date || row.created_at, client_name: clientMap[header.client_id] || '-', status: header.status || '-', qty: parseFloat(row.qty) || 0, uom: row.uom || '-', rate: parseFloat(row.rate) || 0, line_total: parseFloat(row.line_total) || 0 };
        })
        .sort((a: any, b: any) => new Date(b.quote_date || 0).getTime() - new Date(a.quote_date || 0).getTime());

      // Normalize challan rows
      const normalizedChallanRows = challanItemRows
        .map((row: any) => {
          const header = challanMap[row.delivery_challan_id] || {};
          return { id: row.id, dc_no: header.dc_number || row.delivery_challan_id || '-', dc_date: header.dc_date || row.created_at, client_name: header.client_name || '-', status: header.status || '-', qty: parseFloat(row.quantity) || 0, unit: row.unit || '-', amount: parseFloat(row.amount) || 0 };
        })
        .sort((a: any, b: any) => new Date(b.dc_date || 0).getTime() - new Date(a.dc_date || 0).getTime());

      // Normalize invoice rows
      const inwardInvoiceRows = inwardItemRows.map((row: any) => {
        const header = inwardMap[row.inward_id] || {};
        return { id: `inv-in-${row.id}`, type: 'Purchase Invoice', doc_no: header.invoice_no || '-', doc_date: header.inward_date || row.created_at, party: header.vendor_name || '-', qty: parseFloat(row.quantity) || 0, amount: parseFloat(row.amount) || (parseFloat(row.rate) || 0) * (parseFloat(row.quantity) || 0) };
      }).filter((row: any) => row.doc_no && row.doc_no !== '-');

      const challanInvoiceRows = challanItemRows.map((row: any) => {
        const header = challanMap[row.delivery_challan_id] || {};
        return { id: `inv-dc-${row.id}`, type: 'Sales Invoice', doc_no: header.dc_number || '-', doc_date: header.dc_date || row.created_at, party: header.client_name || '-', qty: parseFloat(row.quantity) || 0, amount: parseFloat(row.amount) || 0 };
      });

      const noteRows = outwardItemRows.map((row: any) => {
        const header = outwardMap[row.outward_id] || {};
        const remarks = (header.remarks || '').toLowerCase();
        const isCredit = remarks.includes('credit');
        const isDebit = remarks.includes('debit');
        if (!isCredit && !isDebit) return null;
        return { id: `note-${row.id}`, type: isCredit ? 'Credit Note' : 'Debit Note', doc_no: row.outward_id || '-', doc_date: header.outward_date || row.created_at, party: header.project_id || '-', qty: parseFloat(row.quantity) || 0, amount: 0 };
      }).filter(Boolean);

      const normalizedInvoiceRows = [...inwardInvoiceRows, ...challanInvoiceRows, ...noteRows].sort((a: any, b: any) => new Date(b.doc_date || 0).getTime() - new Date(a.doc_date || 0).getTime());

      // Normalize purchase rows
      const normalizedPurchaseRows = inwardItemRows
        .map((row: any) => {
          const header = inwardMap[row.inward_id] || {};
          const qty = parseFloat(row.quantity) || 0;
          const rate = parseFloat(row.rate) || 0;
          return { id: `pur-${row.id}`, vendor_name: header.vendor_name || '-', invoice_no: header.invoice_no || '-', purchase_date: header.inward_date || row.created_at, qty, unit: row.unit || '-', rate, amount: parseFloat(row.amount) || (qty * rate) };
        })
        .sort((a: any, b: any) => new Date(b.purchase_date || 0).getTime() - new Date(a.purchase_date || 0).getTime());

      // Normalize audit rows
      const dbAuditRowsNormalized = auditDbRows.map((row: any) => ({
        id: row.id || `db-${row.created_at || Date.now()}`,
        action: row.action || row.action_type || row.event_type || 'UPDATED',
        notes: row.notes || row.action_details || row.description || '-',
        created_at: row.created_at || row.updated_at || row.timestamp || new Date().toISOString(),
        changes: normalizeAuditChanges(row.changes || row.changed_fields || row.change_summary),
      }));

      const localAuditRowsNormalized = getLocalAuditTrail()
        .filter((row: any) => row.item_id === itemId)
        .map((row: any) => ({
          id: row.id,
          action: row.action || 'UPDATED',
          notes: row.notes || '-',
          created_at: row.created_at || new Date().toISOString(),
          changes: normalizeAuditChanges(row.changes),
        }));

      const normalizedAuditRows = [...dbAuditRowsNormalized, ...localAuditRowsNormalized].sort(
        (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      setItemTransactions({
        warehouseRows: normalizedWarehouseRows,
        adjustmentRows: normalizedAdjustments,
        quotationRows: normalizedQuotationRows,
        invoiceRows: normalizedInvoiceRows,
        purchaseRows: normalizedPurchaseRows,
        challanRows: normalizedChallanRows,
        auditRows: normalizedAuditRows,
      });
    } catch (err: any) {
      console.error('Item transaction load error:', err);
      setDetailError(err.message || 'Unable to load linked transactions');
      setItemTransactions(emptyItemTransactions());
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const clearTransactions = useCallback(() => {
    setItemTransactions(emptyItemTransactions());
    setDetailError('');
  }, []);

  return {
    itemTransactions,
    detailLoading,
    detailError,
    loadItemTransactions,
    clearTransactions,
  };
}
