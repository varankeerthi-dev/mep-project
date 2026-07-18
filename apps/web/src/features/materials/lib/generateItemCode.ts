/** Generate a unique item code based on timestamp. */
export function generateItemCode(prefix = 'ITEM'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

/** Generate a warehouse code. */
export function generateWarehouseCode(): string {
  return `WH-${Date.now().toString(36).toUpperCase()}`;
}
