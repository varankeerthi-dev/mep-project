/** Warehouse stock entry — editor state for a specific warehouse+variant combination */
export interface WarehouseStockEntry {
  exclude: boolean;
  current_stock: number;
}

/** Key-value map: `${warehouseId}_${variantId}` -> stock entry */
export type WarehouseStockMap = Record<string, WarehouseStockEntry>;

/** Normalized warehouse stock row for display */
export interface WarehouseStockRow {
  id: string;
  warehouse: string;
  variant: string;
  current_stock: number;
  low_stock_level: number;
  updated_at: string;
}
