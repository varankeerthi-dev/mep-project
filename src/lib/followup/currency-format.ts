import { formatCurrency } from '../currency';

export function formatFollowUpCurrency(amount: number, currencyCode = 'INR'): string {
  return formatCurrency(amount, currencyCode);
}

export function formatCompactCurrency(amount: number, currencyCode = 'INR'): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return formatFollowUpCurrency(amount, currencyCode);
}
