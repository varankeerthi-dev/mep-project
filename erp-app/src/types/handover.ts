export type HandoverStatus = 'Planning' | 'Ready' | 'Snags' | 'Signed' | 'On Hold';

export type HandoverType = 'system' | 'area' | 'zone' | 'building' | 'floor' | 'other';

export interface ProjectHandover {
  id: string;
  organisation_id: string;
  project_id: string;
  system_or_area: string;
  handover_type: HandoverType;
  planned_date: string;
  actual_date: string | null;
  status: HandoverStatus;
  responsible_engineer_id: string | null;
  responsible_engineer_name: string | null;
  client_signoff_name: string | null;
  client_signoff_date: string | null;
  client_signoff_notes: string | null;
  notes: string | null;
  snag_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectHandoverWithProject extends ProjectHandover {
  project?: {
    id: string;
    name: string;
    project_name: string | null;
    client_name: string | null;
  } | {
    id: string;
    name: string;
    project_name: string | null;
    client_name: string | null;
  }[] | null;
}

export type ProjectHandoverInsert = Omit<ProjectHandover, 'id' | 'created_at' | 'updated_at' | 'snag_count'> & {
  snag_count?: number;
};

export type ProjectHandoverUpdate = Partial<ProjectHandoverInsert>;

export const HANDOVER_STATUS_CONFIG: Record<HandoverStatus, { label: string; bg: string; text: string; dot: string }> = {
  Planning: { label: 'Planning', bg: 'bg-zinc-100', text: 'text-zinc-700', dot: 'bg-zinc-400' },
  Ready:    { label: 'Ready',    bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  Snags:    { label: 'Snags',    bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  Signed:   { label: 'Signed',   bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'On Hold':{ label: 'On Hold',  bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
};

export const HANDOVER_TYPE_OPTIONS: { value: HandoverType; label: string }[] = [
  { value: 'system',  label: 'System' },
  { value: 'area',    label: 'Area' },
  { value: 'zone',    label: 'Zone' },
  { value: 'building',label: 'Building' },
  { value: 'floor',   label: 'Floor' },
  { value: 'other',   label: 'Other' },
];

export const HANDOVER_STATUS_ORDER: HandoverStatus[] = ['Planning', 'Ready', 'Snags', 'Signed', 'On Hold'];
