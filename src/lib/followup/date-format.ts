import { differenceInCalendarDays, format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatFollowUpDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'dd MMM yyyy');
  } catch {
    return value;
  }
}

export function formatRelativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function daysUntil(dateStr: string): number {
  try {
    return differenceInCalendarDays(parseISO(dateStr), new Date());
  } catch {
    return 0;
  }
}

export function formatAgingLabel(daysOverdue: number): string {
  if (daysOverdue < 0) return `${Math.abs(daysOverdue)}d until due`;
  if (daysOverdue === 0) return 'Due today';
  return `${daysOverdue}d overdue`;
}

export function isValidityExpiringSoon(validTill: string, withinDays = 7): boolean {
  const days = daysUntil(validTill);
  return days >= 0 && days <= withinDays;
}

export function isFollowUpExpired(validTill: string): boolean {
  const days = daysUntil(validTill);
  return days < 0;
}
