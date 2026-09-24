/**
 * Formatting utilities for the CEO Dashboard
 * Strict compliance with Inter font, tabular figures, and left-aligned currency rules.
 */

export function formatCeoCurrency(amount: number | null | undefined, compact = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0.00';
  }

  const absAmount = Math.abs(amount);

  if (compact) {
    if (absAmount >= 10000000) { // 1 Crore = 10,000,000
      const cr = amount / 10000000;
      return `₹${cr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
    }
    if (absAmount >= 100000) { // 1 Lakh = 100,000
      const l = amount / 100000;
      return `₹${l.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
    }
    if (absAmount >= 1000) {
      const k = amount / 1000;
      return `₹${k.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} k`;
    }
  }

  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCeoNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return val.toLocaleString('en-IN');
}

export function formatCeoDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

export function getHealthBadgeTone(health: string): { bg: string; text: string; border: string } {
  switch (health) {
    case 'On Track':
    case 'Completed':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'At Risk':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'Critical Delayed':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    default:
      return { bg: 'bg-zinc-50', text: 'text-zinc-700', border: 'border-zinc-200' };
  }
}
