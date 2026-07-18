/**
 * Calculate profit margin percentage.
 * Returns 0 if cost is 0 (to avoid division by zero).
 */
export function calculateMargin(cost: number, sellingPrice: number): number {
  if (cost === 0) return 0;
  return ((sellingPrice - cost) / cost) * 100;
}
