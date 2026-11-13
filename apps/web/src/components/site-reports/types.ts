export type SiteReportStatus =
  | 'Approved'
  | 'Reported'
  | 'Pending Approval'
  | 'Pending'
  | 'Draft'
  | 'Rejected'
  | 'On Hold';

export type SiteReportDateRange = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month';

export interface SiteReportSummaryStats {
  total: number;
  thisWeek: number;
  today: number;
  engineersActive: number;
}

export interface DateBucketCounts {
  all: number;
  today: number;
  yesterday: number;
  this_week: number;
  this_month: number;
}

export const BUCKET_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  this_month: 'Earlier this Month',
  earlier: 'Earlier',
};

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

export const daysAgo = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() - n);
  return x;
};

export const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const dow = x.getDay();
  const diff = (dow + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
};

export const startOfMonth = (d: Date) => {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
};

export const reportDateBucket = (
  reportDate: string
): 'today' | 'yesterday' | 'this_week' | 'this_month' | 'earlier' => {
  if (!reportDate) return 'earlier';
  const d = new Date(reportDate);
  const now = new Date();
  if (isSameDay(d, now)) return 'today';
  if (isSameDay(d, daysAgo(now, 1))) return 'yesterday';
  if (d >= startOfWeek(now)) return 'this_week';
  if (d >= startOfMonth(now)) return 'this_month';
  return 'earlier';
};

export const dateRangePredicate = (range: SiteReportDateRange, reportDate: string): boolean => {
  if (range === 'all') return true;
  if (!reportDate) return false;
  const d = new Date(reportDate);
  const now = new Date();
  if (range === 'today') return isSameDay(d, now);
  if (range === 'yesterday') return isSameDay(d, daysAgo(now, 1));
  if (range === 'this_week') return d >= startOfWeek(now);
  if (range === 'this_month') return d >= startOfMonth(now);
  return true;
};

export const reportToken = (id?: string): string => {
  if (!id) return 'SR-NEW';
  return `SR-${id.slice(0, 6).toUpperCase()}`;
};

export const STATUS_STYLES: Record<
  string,
  { label: string; text: string; bg: string; border: string; dot: string; isLocked?: boolean }
> = {
  Approved: {
    label: 'Approved',
    text: 'text-emerald-800',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    isLocked: true,
  },
  Reported: {
    label: 'Reported',
    text: 'text-emerald-800',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    isLocked: true,
  },
  'Pending Approval': {
    label: 'Pending Approval',
    text: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    isLocked: true,
  },
  Pending: {
    label: 'Pending',
    text: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    isLocked: false,
  },
  Draft: {
    label: 'Draft',
    text: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    isLocked: false,
  },
  Rejected: {
    label: 'Rejected',
    text: 'text-rose-800',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    isLocked: false,
  },
  'On Hold': {
    label: 'On Hold',
    text: 'text-purple-800',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    isLocked: false,
  },
};
