export type StoppageCategory =
  | 'payment'
  | 'site_clearance'
  | 'client_confirmation'
  | 'site_dependency'
  | 'material'
  | 'planned_shutdown'
  | 'other';

export type BlockingParty =
  | 'client'
  | 'subcontractor'
  | 'our_team'
  | 'external'
  | 'unknown';

export interface WorkStoppage {
  id: string;
  organisation_id: string;
  report_id: string;
  category: StoppageCategory;
  affected_work: string;
  reason_detail: string;
  blocking_party: BlockingParty;
  expected_resolution_date: string | null;
  is_resolved: boolean;
  actual_resolution_date: string | null;
  resolution_notes: string;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkStoppageWithReport extends WorkStoppage {
  report?: {
    id: string;
    report_date: string;
    project_id: string;
  } | {
    id: string;
    report_date: string;
    project_id: string;
  }[] | null;
}

export type WorkStoppageInsert = Omit<
  WorkStoppage,
  'id' | 'created_at' | 'updated_at' | 'is_resolved' | 'actual_resolution_date' | 'resolution_notes' | 'reported_by'
> & {
  is_resolved?: boolean;
  actual_resolution_date?: string | null;
  resolution_notes?: string;
  reported_by?: string | null;
};

export type WorkStoppageUpdate = Partial<
  Omit<WorkStoppage, 'id' | 'created_at' | 'updated_at' | 'organisation_id' | 'report_id'>
>;

export const STOPPAGE_CATEGORY_OPTIONS: { value: StoppageCategory; label: string; tone: string }[] = [
  { value: 'payment',             label: 'Payment',             tone: 'red' },
  { value: 'site_clearance',      label: 'Site clearance',      tone: 'orange' },
  { value: 'client_confirmation', label: 'Client confirmation', tone: 'amber' },
  { value: 'site_dependency',     label: 'Site dependency',     tone: 'blue' },
  { value: 'material',            label: 'Material',            tone: 'purple' },
  { value: 'planned_shutdown',    label: 'Planned shutdown',    tone: 'cyan' },
  { value: 'other',               label: 'Other',               tone: 'zinc' },
];

export const BLOCKING_PARTY_OPTIONS: { value: BlockingParty; label: string }[] = [
  { value: 'client',         label: 'Client' },
  { value: 'subcontractor',  label: 'Subcontractor' },
  { value: 'our_team',       label: 'Our team' },
  { value: 'external',       label: 'External' },
  { value: 'unknown',        label: 'Unknown' },
];

export function labelForStoppageCategory(c: StoppageCategory): string {
  return STOPPAGE_CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c;
}

export function labelForBlockingParty(p: BlockingParty): string {
  return BLOCKING_PARTY_OPTIONS.find((o) => o.value === p)?.label ?? p;
}

export function toneClassForCategory(c: StoppageCategory): { bg: string; text: string; dot: string } {
  const tone = STOPPAGE_CATEGORY_OPTIONS.find((o) => o.value === c)?.tone ?? 'zinc';
  switch (tone) {
    case 'red':    return { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' };
    case 'orange': return { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' };
    case 'amber':  return { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' };
    case 'blue':   return { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' };
    case 'purple': return { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' };
    case 'cyan':   return { bg: 'bg-cyan-100',   text: 'text-cyan-700',   dot: 'bg-cyan-500' };
    default:       return { bg: 'bg-zinc-100',   text: 'text-zinc-700',   dot: 'bg-zinc-400' };
  }
}
