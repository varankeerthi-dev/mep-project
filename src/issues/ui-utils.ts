export * from './types';
export * from './api';
export * from './hooks';

import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';
import type { Issue, IssueStatus, IssueSeverity, IssueLocationPath } from './types';

export function formatIssueDate(date: string | null): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd/MM/yyyy');
  } catch {
    return date;
  }
}

export function formatIssueDateTime(date: string | null): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd/MM/yyyy HH:mm');
  } catch {
    return date;
  }
}

export function formatIssueAge(date: string | null): string {
  if (!date) return '—';
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function getIssueAgeDays(createdAt: string): number {
  try {
    return differenceInDays(new Date(), parseISO(createdAt));
  } catch {
    return 0;
  }
}

export function isIssueOverdue(issue: Issue): boolean {
  if (!issue.due_date || issue.status === 'closed' || issue.status === 'verified') {
    return false;
  }
  try {
    const dueDate = parseISO(issue.due_date);
    return dueDate < new Date();
  } catch {
    return false;
  }
}

export function formatLocationPath(issue: Issue): string {
  const parts = [
    issue.location_block,
    issue.location_floor,
    issue.location_room,
    issue.location_zone,
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(' / ') : '—';
}

export function formatLocationPathCompact(issue: Issue): string {
  const parts = [
    issue.location_block,
    issue.location_floor ? 'F' + issue.location_floor : null,
    issue.location_room ? 'R' + issue.location_room : null,
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(' / ') : '—';
}

const SEVERITY_COLORS: Record<IssueSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  major: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  minor: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
};

const STATUS_COLORS: Record<IssueStatus, { bg: string; text: string; border: string }> = {
  open: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  assigned: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  in_progress: { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },
  waiting_inspection: { bg: '#fdf4ff', text: '#9333ea', border: '#f5d0fe' },
  verified: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  closed: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  reopened: { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' },
};

export function getSeverityStyles(severity: IssueSeverity) {
  return SEVERITY_COLORS[severity] || SEVERITY_COLORS.minor;
}

export function getStatusStyles(status: IssueStatus) {
  return STATUS_COLORS[status] || STATUS_COLORS.open;
}

export function isEditable(issue: Issue): boolean {
  return issue.status !== 'closed' && issue.status !== 'verified';
}

export function canClose(issue: Issue): boolean {
  return issue.status === 'waiting_inspection' || issue.status === 'in_progress';
}

export function canReopen(issue: Issue): boolean {
  return issue.status === 'closed' || issue.status === 'verified';
}

export const SYSTEM_LABELS: Record<string, string> = {
  hvac: 'HVAC',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  firefighting: 'Fire Fighting',
  BMS: 'BMS',
  other: 'Other',
};

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  installation: 'Installation',
  quality: 'Quality',
  design: 'Design',
  safety: 'Safety',
  breakdown: 'Breakdown',
  punchlist: 'Punch List',
  ncr: 'NCR',
};

export function getSystemLabel(system: string | null): string {
  if (!system) return '—';
  return SYSTEM_LABELS[system] || system;
}

export function getIssueTypeLabel(type: string): string {
  return ISSUE_TYPE_LABELS[type] || type;
}