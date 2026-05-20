import type { EscalationStage } from '../../types/followup';

export function getReminderStage(daysOverdue: number): EscalationStage {
  if (daysOverdue < 0) return 0;
  if (daysOverdue >= 0 && daysOverdue < 7) return 1;
  if (daysOverdue >= 7 && daysOverdue < 15) return 2;
  if (daysOverdue >= 15 && daysOverdue < 30) return 3;
  return 4;
}

export type EscalationStageMeta = {
  stage: EscalationStage;
  label: string;
  shortLabel: string;
  description: string;
  recommendedAction: string;
  severity: 'info' | 'warning' | 'danger' | 'critical';
};

const STAGE_META: Record<EscalationStage, EscalationStageMeta> = {
  0: {
    stage: 0,
    label: 'Pre-Due',
    shortLabel: 'Pre',
    description: 'Friendly reminder before due date',
    recommendedAction: 'Share payment link, measurement sheets, and supporting documentation.',
    severity: 'info',
  },
  1: {
    stage: 1,
    label: 'Due / Tier 1',
    shortLabel: 'T1',
    description: 'Professional payment reminder on due date',
    recommendedAction: 'Send balance alert with quick payment shortcut.',
    severity: 'warning',
  },
  2: {
    stage: 2,
    label: 'Tier 2 Overdue',
    shortLabel: 'T2',
    description: 'Soft escalation (+7 days)',
    recommendedAction: 'Ask if invoice is stuck internally; request update from accounts team.',
    severity: 'warning',
  },
  3: {
    stage: 3,
    label: 'Tier 3 Overdue',
    shortLabel: 'T3',
    description: 'Firm escalation (+15 days)',
    recommendedAction: 'Request explicit expected payment date; escalate via email/SMS.',
    severity: 'danger',
  },
  4: {
    stage: 4,
    label: 'Tier 4 Critical',
    shortLabel: 'T4',
    description: 'Critical escalation (+30 days)',
    recommendedAction:
      'Urgent phone call required. Warn about hold on future dispatches and pause on site support.',
    severity: 'critical',
  },
};

export function getEscalationMeta(daysOverdue: number): EscalationStageMeta {
  const stage = getReminderStage(daysOverdue);
  return STAGE_META[stage];
}

export function getEscalationRowClass(severity: EscalationStageMeta['severity']): string {
  switch (severity) {
    case 'info':
      return 'border-l-4 border-l-sky-400 bg-sky-50/40';
    case 'warning':
      return 'border-l-4 border-l-amber-400 bg-amber-50/40';
    case 'danger':
      return 'border-l-4 border-l-orange-500 bg-orange-50/50';
    case 'critical':
      return 'border-l-4 border-l-red-600 bg-red-50/60';
    default:
      return 'border-l-4 border-l-zinc-200';
  }
}
