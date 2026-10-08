import type { ColumnDef, StatusType } from '../table';
import { format, parseISO } from 'date-fns';
import { MapPin } from 'lucide-react';
import {
  SITE_VISIT_LABELS,
  visitToken,
} from './siteVisitLabels';
import { VisitStatusPill } from './VisitStatusPill';

// ── Status → StatusType mapping ────────────────────────────────────────────────
export const visitStatusMap: Record<string, StatusType> = {
  scheduled: 'blue',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error',
  postponed: 'warning',
  pending: 'neutral',
  'Location Denied': 'error',
};

// ── Palette-aware status dot + pill lives in VisitStatusPill.tsx (JSX must be .tsx)

// ── Filter options ─────────────────────────────────────────────────────────────
export const STATUS_FILTER_OPTIONS = [
  { id: 'all', label: SITE_VISIT_LABELS.toolbar.allStatuses },
  { id: 'scheduled', label: SITE_VISIT_LABELS.status.scheduled },
  { id: 'in_progress', label: SITE_VISIT_LABELS.status.in_progress },
  { id: 'pending', label: SITE_VISIT_LABELS.status.pending },
  { id: 'completed', label: SITE_VISIT_LABELS.status.completed },
  { id: 'postponed', label: SITE_VISIT_LABELS.status.postponed },
  { id: 'cancelled', label: SITE_VISIT_LABELS.status.cancelled },
];

// ── Time Formatter ─────────────────────────────────────────────────────────────
/** Formats HH:mm / HH:mm:ss to 12-hour "h:mm A" (e.g., "10:41 PM"). Falls back to created_at if time is empty. */
export function formatTime12(t?: string | null, createdAt?: string | null): string {
  let s = (t || '').trim();
  if (!s && createdAt) {
    try {
      const d = parseISO(createdAt);
      s = format(d, 'HH:mm');
    } catch {
      // ignore
    }
  }
  if (!s) return '--:--';
  if (/am|pm/i.test(s)) return s;
  const parts = s.split(':');
  if (parts.length < 2) return s;
  let h = parseInt(parts[0], 10);
  if (isNaN(h)) return s;
  const m = parts[1].padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// ── Table Row Type ─────────────────────────────────────────────────────────────
export interface SiteVisitRow {
  id: string;
  visit_date: string;
  client_name: string;
  site_address: string;
  visit_time: string;
  out_time: string;
  status: string;
  engineer: string;
  visited_by: string;
  next_step: string;
  follow_up_date: string;
  [key: string]: any;
}

export const siteVisitColumns: ColumnDef<SiteVisitRow>[] = [
  {
    // Reference §2: Visit ID — fixed 100px, monospace token
    header: SITE_VISIT_LABELS.table.headers.visitId,
    accessorKey: 'id',
    id: 'visitId',
    type: 'id',
    align: 'left',
    width: 100,
    cell: ({ row }) => (
      <span className="font-mono text-[11px] font-semibold tracking-[0.02em] text-slate-700 tabular-nums">
        {visitToken(row.id)}
      </span>
    ),
  },
  {
    // Visit Type & Engineer/Time sub-context
    header: 'Visit Type',
    accessorKey: 'visit_type',
    id: 'visit_type',
    type: 'text',
    align: 'left',
    minWidth: 260,
    cell: ({ row }) => {
      const formattedTime = formatTime12(row.visit_time, row.created_at);
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium leading-[18px] text-slate-900">
            {row.visit_type || SITE_VISIT_LABELS.table.missingValue}
          </span>
          <span className="truncate text-[11px] font-normal leading-4 text-slate-500">
            {row.engineer
              ? `${row.engineer}${formattedTime !== '--:--' ? ` · ${formattedTime}` : ''}`
              : formattedTime !== '--:--' ? formattedTime : SITE_VISIT_LABELS.table.missingValue}
          </span>
        </div>
      );
    },
  },
  {
    // Reference §2: Client Organization — flex 1.5x
    header: SITE_VISIT_LABELS.table.headers.client,
    accessorKey: 'client_name',
    id: 'client',
    type: 'text',
    align: 'left',
    minWidth: 190,
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px] font-medium leading-[18px] text-slate-900">
          {row.client_name || SITE_VISIT_LABELS.table.missingValue}
        </span>
        <span className="truncate text-[11px] font-normal leading-4 text-slate-400">
          {row.project_name || row.client_id
            ? row.project_name || ''
            : SITE_VISIT_LABELS.table.missingValue}
        </span>
      </div>
    ),
  },
  {
    // Reference §2: Facility / Location — flex 1.5x, pin icon
    header: SITE_VISIT_LABELS.table.headers.location,
    accessorKey: 'site_address',
    id: 'location',
    type: 'text',
    align: 'left',
    minWidth: 210,
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-1.5">
        <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
        <span className="truncate text-[13px] font-medium leading-[18px] text-slate-900">
          {row.site_address || SITE_VISIT_LABELS.table.missingValue}
        </span>
      </div>
    ),
  },
  {
    // Reference §2: Scheduled Time — fixed 150px, tabular numerals
    header: SITE_VISIT_LABELS.table.headers.scheduledTime,
    accessorKey: 'visit_date',
    id: 'dateTime',
    type: 'date',
    align: 'left',
    width: 150,
    cell: ({ row }) => {
      const date = row.visit_date ? format(parseISO(row.visit_date), 'dd MMM yyyy') : SITE_VISIT_LABELS.table.missingValue;
      const formattedTime = formatTime12(row.visit_time, row.created_at);
      return (
        <div className="flex flex-col tabular-nums">
          <span className="font-mono text-[12px] font-medium leading-[16px] text-slate-900">{date}</span>
          <span className="font-mono text-[11px] font-semibold leading-4 text-primary">
            {formattedTime}
          </span>
        </div>
      );
    },
  },
  {
    // Reference §2: Status — fixed 110px micro-pill
    header: SITE_VISIT_LABELS.table.headers.status,
    accessorKey: 'status',
    id: 'status',
    type: 'status',
    align: 'left',
    width: 110,
    cell: ({ row }) => <VisitStatusPill status={row.status} />,
    statusType: (row) => visitStatusMap[row.status] ?? 'neutral',
  },
  {
    header: SITE_VISIT_LABELS.table.headers.assignedTo,
    accessorKey: 'engineer',
    id: 'assignedTo',
    type: 'text',
    align: 'left',
    minWidth: 140,
    cell: ({ row }) => {
      const name = row.engineer || row.visited_by || SITE_VISIT_LABELS.table.unassigned;
      const initial = name.charAt(0).toUpperCase();
      return (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
            {initial}
          </div>
          <span className="truncate text-[13px] font-medium text-slate-900">{name}</span>
        </div>
      );
    },
  },
];

export interface SiteVisitFormData {
  client_id: string;
  visit_date: string;
  visited_by: string;
  engineer: string;
  employee_id: string;
  visit_time: string;
  out_time: string;
  site_address: string;
  location_url: string;
  discussion_points: string;
  measurements: string;
  status: string;
  next_step: string;
  follow_up_date: string;
  postponed_reason: string;
  is_client_meeting: boolean;
  project_id: string;
  po_wo_contract: string;
  project_manager_id: string;
  site_contact_person: string;
  site_contact_phone: string;
  site_contact_designation: string;
  site_contacts?: SiteContact[];
  instructions_to_site_persons?: string;
  checklist_items?: SiteChecklistItem[];
  visit_type: string;
  priority: string;
  ppe_requirements: string;
  is_chargeable: boolean;
  access_restrictions: string;
  attendees: Array<{ name: string; role: string }>;
  equipment_used: string;
  travel_time_minutes: number | null;
  total_man_hours: number | null;
  weather_conditions: string;
  safety_hazards: string;
  issues_found: Array<{ description: string; severity: string }>;
  recommendations: string;
  travel_expense: number | null;
  accommodation_expense: number | null;
  misc_expense: number | null;
}

export interface SiteContact {
  id?: string;
  name: string;
  phone: string;
  designation: string;
}

export interface SiteChecklistItem {
  id: string;
  text: string;
  completed?: boolean;
  status?: 'Pass' | 'Fail' | 'Pending' | 'N/A' | 'Yes' | 'No';
  observation?: string;
  checked_at?: string;
  checked_by?: string;
}

export const initialSiteVisitFormData: SiteVisitFormData = {
  client_id: '',
  visit_date: format(new Date(), 'yyyy-MM-dd'),
  visited_by: '',
  engineer: '',
  employee_id: '',
  visit_time: format(new Date(), 'HH:mm'),
  out_time: '',
  site_address: '',
  location_url: '',
  discussion_points: '',
  measurements: '',
  status: 'scheduled',
  next_step: '',
  follow_up_date: '',
  postponed_reason: '',
  is_client_meeting: false,
  project_id: '',
  po_wo_contract: '',
  project_manager_id: '',
  site_contact_person: '',
  site_contact_phone: '',
  site_contact_designation: '',
  site_contacts: [{ name: '', phone: '', designation: '' }],
  instructions_to_site_persons: '',
  checklist_items: [],
  visit_type: 'Survey',
  priority: 'Standard',
  ppe_requirements: '',
  is_chargeable: false,
  access_restrictions: '',
  attendees: [],
  equipment_used: '',
  travel_time_minutes: null,
  total_man_hours: null,
  weather_conditions: '',
  safety_hazards: '',
  issues_found: [],
  recommendations: '',
  travel_expense: null,
  accommodation_expense: null,
  misc_expense: null,
};

export const getChecklistQuestions = (visitType: string, customItems?: Array<{ id?: string; text: string }>) => {
  if (customItems && customItems.length > 0) {
    return customItems.map((item, idx) => ({
      id: item.id || `custom-${idx}`,
      text: item.text,
    }));
  }
  if (visitType === 'Maintenance') {
    return [
      { id: 'm1', text: 'Pressure levels checked and adjusted?' },
      { id: 'm2', text: 'Lube / oil levels verified?' },
      { id: 'm3', text: 'Filters cleaned / replaced?' },
      { id: 'm4', text: 'Any signs of leakages detected?' }
    ];
  } else if (visitType === 'Inspection') {
    return [
      { id: 'i1', text: 'Structural integrity check completed?' },
      { id: 'i2', text: 'Electrical connections inspected?' },
      { id: 'i3', text: 'Safety signs and instructions visible?' }
    ];
  } else {
    return [
      { id: 'd1', text: 'Task successfully completed?' },
      { id: 'd2', text: 'Site clean and clear?' },
      { id: 'd3', text: 'Safety instructions followed?' }
    ];
  }
};

