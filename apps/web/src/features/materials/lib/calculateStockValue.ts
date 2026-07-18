/** Calculate total stock value (quantity × unit price). */
export function calculateStockValue(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}
