export type IssueType = 
  | 'installation' 
  | 'quality' 
  | 'design' 
  | 'safety' 
  | 'breakdown' 
  | 'punchlist' 
  | 'ncr';

export type IssueSystem = 
  | 'hvac' 
  | 'electrical' 
  | 'plumbing' 
  | 'firefighting' 
  | 'BMS' 
  | 'other';

export type IssueSeverity = 'critical' | 'major' | 'minor';

export type IssuePriority = 'low' | 'normal' | 'high' | 'urgent';

export type IssueStatus = 
  | 'open' 
  | 'assigned' 
  | 'in_progress' 
  | 'waiting_inspection' 
  | 'verified' 
  | 'closed' 
  | 'reopened';

export type IssueAction = 
  | 'created' 
  | 'assigned' 
  | 'unassigned' 
  | 'status_changed' 
  | 'comment_added'
  | 'attachment_added' 
  | 'closed' 
  | 'reopened' 
  | 'updated';

export interface IssueLocationPath {
  block: string | null;
  floor: string | null;
  room: string | null;
  zone: string | null;
}

export interface Issue {
  id: string;
  organisation_id: string;
  project_id: string;
  client_id: string | null;
  subcontractor_id: string | null;
  issue_no: string;
  title: string;
  description: string | null;
  issue_type: IssueType;
  system: IssueSystem | null;
  subsystem: string | null;
  severity: IssueSeverity;
  priority: IssuePriority | null;
  status: IssueStatus;
  location_block: string | null;
  location_floor: string | null;
  location_room: string | null;
  location_zone: string | null;
  location_path: IssueLocationPath;
  equipment_tag: string | null;
  drawing_ref: string | null;
  boq_ref: string | null;
  reported_by: string | null;
  reported_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
  closed_remark: string | null;
  reopen_remark: string | null;
  reopened_count: number;
  created_at: string;
  updated_at: string;
}

export interface IssueWithRelations extends Issue {
  project?: {
    id: string;
    project_name: string;
  } | null;
  client?: {
    id: string;
    client_name: string;
  } | null;
  subcontractor?: {
    id: string;
    name: string;
  } | null;
}

export interface IssueAttachment {
  id: string;
  organisation_id: string;
  issue_id: string;
  file_url: string;
  file_name: string | null;
  file_type: 'image' | 'video' | 'document' | 'drawing' | null;
  file_size: number | null;
  caption: string | null;
  is_before: boolean;
  is_after: boolean;
  created_by: string | null;
  created_at: string;
}

export interface IssueActivityLog {
  id: string;
  organisation_id: string;
  issue_id: string;
  action: IssueAction;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  done_by: string | null;
  done_by_name: string | null;
  created_at: string;
}

export interface IssueComment {
  id: string;
  organisation_id: string;
  issue_id: string;
  comment: string;
  is_internal: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface IssueFilters {
  organisationId?: string;
  projectId?: string;
  clientId?: string;
  subcontractorId?: string;
  status?: IssueStatus | null;
  severity?: IssueSeverity | null;
  issueType?: IssueType | null;
  system?: IssueSystem | null;
  assignedTo?: string | null;
  reportedBy?: string | null;
  search?: string;
  fromDate?: string | null;
  toDate?: string | null;
  page?: number;
  limit?: number;
}

export interface IssueInput {
  organisation_id: string;
  project_id: string;
  client_id?: string | null;
  subcontractor_id?: string | null;
  title: string;
  description?: string | null;
  issue_type: IssueType;
  system?: IssueSystem | null;
  subsystem?: string | null;
  severity: IssueSeverity;
  priority?: IssuePriority | null;
  location_block?: string | null;
  location_floor?: string | null;
  location_room?: string | null;
  location_zone?: string | null;
  equipment_tag?: string | null;
  drawing_ref?: string | null;
  boq_ref?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  due_date?: string | null;
}

export interface IssueUpdateInput {
  title?: string;
  description?: string;
  issue_type?: IssueType;
  system?: IssueSystem | null;
  subsystem?: string | null;
  severity?: IssueSeverity;
  priority?: IssuePriority | null;
  status?: IssueStatus;
  location_block?: string | null;
  location_floor?: string | null;
  location_room?: string | null;
  location_zone?: string | null;
  equipment_tag?: string | null;
  drawing_ref?: string | null;
  boq_ref?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  due_date?: string | null;
  closed_remark?: string | null;
  reopen_remark?: string | null;
}

export interface IssueStatusUpdate {
  status: IssueStatus;
  remark?: string;
}

export const ISSUE_STATUSES: IssueStatus[] = [
  'open',
  'assigned', 
  'in_progress', 
  'waiting_inspection', 
  'verified', 
  'closed', 
  'reopened'
];

export const ISSUE_TYPES: IssueType[] = [
  'installation', 
  'quality', 
  'design', 
  'safety', 
  'breakdown', 
  'punchlist', 
  'ncr'
];

export const ISSUE_SYSTEMS: IssueSystem[] = [
  'hvac', 
  'electrical', 
  'plumbing', 
  'firefighting', 
  'BMS', 
  'other'
];

export const ISSUE_SEVERITIES: IssueSeverity[] = ['critical', 'major', 'minor'];

export const ISSUE_PRIORITIES: IssuePriority[] = ['low', 'normal', 'high', 'urgent'];