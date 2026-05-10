import { supabase } from '@/lib/supabase';

export interface StockDeductionResult {
  material_id: string;
  warehouse_id: string | null;
  requested_qty: number;
  available_qty: number;
  deducted_qty: number;
  status: 'DEDUCTED' | 'INSUFFICIENT' | 'NO_WAREHOUSE';
}

export async function deductInvoiceStock(
  invoiceId: string,
  orgId: string,
  mode: 'itemized' | 'lot',
  allowInsufficient: boolean = false
): Promise<StockDeductionResult[]> {
  const rpcName = mode === 'lot' ? 'deduct_invoice_stock_lot' : 'deduct_invoice_stock';
  
  const { data, error } = await supabase.rpc(rpcName, {
    p_invoice_id: invoiceId,
    p_organisation_id: orgId,
    p_allow_insufficient: allowInsufficient,
  });

  if (error) {
    console.error('Stock deduction RPC error:', error);
    throw new Error(`Failed to deduct stock: ${error.message}`);
  }

  return (data || []) as StockDeductionResult[];
}

export async function reverseInvoiceStockDeductions(invoiceId: string): Promise<void> {
  const { error } = await supabase.rpc('reverse_invoice_stock_deductions', {
    p_invoice_id: invoiceId,
  });

  if (error) {
    console.error('Stock reversal RPC error:', error);
    throw new Error(`Failed to reverse stock deductions: ${error.message}`);
  }
}

export async function getInvoiceStockDeductions(invoiceId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('invoice_stock_deductions')
    .select(`
      *,
      materials(name, item_type),
      warehouses(warehouse_name),
      company_variants(variant_name)
    `)
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching stock deductions:', error);
    throw new Error(`Failed to fetch stock deductions: ${error.message}`);
  }

  return data || [];
}

export function validateStockAvailability(
  items: Array<{
    meta_json?: {
      material_id?: string;
      warehouse_id?: string;
      variant_id?: string;
      is_service?: boolean;
    };
    qty: number;
  }>,
  stockRows: Array<{
    item_id: string;
    warehouse_id: string;
    company_variant_id: string | null;
    current_stock: number;
  }>,
  defaultWarehouseId?: string | null
): Array<{
  materialId: string;
  warehouseId: string;
  requested: number;
  available: number;
  sufficient: boolean;
}> {
  return items
    .filter(item => item.meta_json?.material_id && !item.meta_json?.is_service)
    .map(item => {
      const materialId = item.meta_json!.material_id!;
      const warehouseId = item.meta_json?.warehouse_id || defaultWarehouseId;
      
      if (!warehouseId) {
        return {
          materialId,
          warehouseId: '',
          requested: item.qty,
          available: 0,
          sufficient: false,
        };
      }

      const stockRow = stockRows.find(
        s => s.item_id === materialId && 
        s.warehouse_id === warehouseId && 
        (item.meta_json?.variant_id ? s.company_variant_id === item.meta_json?.variant_id : s.company_variant_id === null)
      );

      const available = stockRow?.current_stock || 0;

      return {
        materialId,
        warehouseId,
        requested: item.qty,
        available,
        sufficient: available >= item.qty,
      };
    });
}
