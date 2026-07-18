// @ts-nocheck
import { supabase } from '../../../supabase';
import { timedSupabaseQuery } from '../../../utils/queryTimeout';

const runQuery = async (label: string, queryBuilder: any, timeout = 15000) => {
  try {
    const data = await timedSupabaseQuery(queryBuilder, label, timeout);
    return data || [];
  } catch (err: any) {
    console.log(`${label} load warning:`, err.message);
    return [];
  }
};

export async function fetchItemStockTransactions(itemId: string) {
  return runQuery(
    'item_stock',
    supabase
      .from('item_stock')
      .select('id, item_id, company_variant_id, warehouse_id, current_stock, low_stock_level, updated_at')
      .eq('item_id', itemId)
  );
}

export async function fetchWarehouses() {
  return runQuery(
    'warehouses',
    supabase.from('warehouses').select('id, warehouse_name, name, warehouse_code')
  );
}

export async function fetchVariants() {
  return runQuery(
    'company_variants',
    supabase.from('company_variants').select('id, variant_name')
  );
}

export async function fetchInwardItems(itemId: string) {
  return runQuery(
    'material_inward_items',
    supabase
      .from('material_inward_items')
      .select('id, inward_id, material_id, quantity, unit, rate, amount, created_at')
      .eq('material_id', itemId)
      .order('created_at', { ascending: false })
  );
}

export async function fetchOutwardItems(itemId: string) {
  return runQuery(
    'material_outward_items',
    supabase
      .from('material_outward_items')
      .select('id, outward_id, material_id, quantity, unit, created_at')
      .eq('material_id', itemId)
      .order('created_at', { ascending: false })
  );
}

export async function fetchQuotationItems(itemId: string) {
  return runQuery(
    'quotation_items',
    supabase
      .from('quotation_items')
      .select('id, quotation_id, item_id, qty, uom, rate, line_total, created_at')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
  );
}

export async function fetchChallanItems(itemId: string) {
  return runQuery(
    'delivery_challan_items',
    supabase
      .from('delivery_challan_items')
      .select('id, delivery_challan_id, material_id, quantity, unit, rate, amount, created_at')
      .eq('material_id', itemId)
      .order('created_at', { ascending: false })
  );
}

export async function fetchAuditLogs(itemId: string) {
  return runQuery(
    'item_audit_logs',
    supabase
      .from('item_audit_logs')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
  );
}

export async function fetchInwardHeaders(ids: string[]) {
  if (!ids.length) return [];
  return runQuery(
    'material_inward',
    supabase
      .from('material_inward')
      .select('id, inward_date, vendor_name, invoice_no, remarks, created_at')
      .in('id', ids)
  );
}

export async function fetchOutwardHeaders(ids: string[]) {
  if (!ids.length) return [];
  return runQuery(
    'material_outward',
    supabase
      .from('material_outward')
      .select('id, outward_date, project_id, remarks, created_at')
      .in('id', ids)
  );
}

export async function fetchQuotationHeaders(ids: string[]) {
  if (!ids.length) return [];
  return runQuery(
    'quotation_header',
    supabase
      .from('quotation_header')
      .select('id, quotation_no, date, client_id, status, grand_total, created_at')
      .in('id', ids)
  );
}

export async function fetchChallanHeaders(ids: string[]) {
  if (!ids.length) return [];
  return runQuery(
    'delivery_challans',
    supabase
      .from('delivery_challans')
      .select('id, dc_number, dc_date, status, client_name, created_at')
      .in('id', ids)
  );
}

export async function fetchClientsByIds(ids: string[]) {
  if (!ids.length) return [];
  return runQuery(
    'clients',
    supabase.from('clients').select('id, client_name').in('id', ids)
  );
}

export async function insertAuditLog(entry: {
  item_id: string;
  action: string;
  notes: string;
  changes: string;
  created_at: string;
}) {
  const { error } = await supabase.from('item_audit_logs').insert(entry);
  if (error) {
    console.log('item_audit_logs write warning:', error.message);
    return false;
  }
  return true;
}
