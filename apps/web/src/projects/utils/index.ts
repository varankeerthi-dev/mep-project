import { formatAppDate } from '@/lib/dateFormat';

export const fmt = (n: any) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export const fmtD = (d?: string | null) => formatAppDate(d);
