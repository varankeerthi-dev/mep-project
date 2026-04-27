import { supabase } from '../supabase';
import type {
  Issue,
  IssueWithRelations,
  IssueAttachment,
  IssueActivityLog,
  IssueComment,
  IssueFilters,
  IssueInput,
  IssueUpdateInput,
  IssueStatusUpdate,
} from './types';

const ISSUE_SELECT = `
  id,
  organisation_id,
  project_id,
  client_id,
  subcontractor_id,
  issue_no,
  title,
  description,
  issue_type,
  system,
  subsystem,
  severity,
  priority,
  status,
  location_block,
  location_floor,
  location_room,
  location_zone,
  location_path,
  equipment_tag,
  drawing_ref,
  boq_ref,
  reported_by,
  reported_by_name,
  assigned_to,
  assigned_to_name,
  due_date,
  closed_by,
  closed_by_name,
  closed_at,
  closed_remark,
  reopen_remark,
  reopened_count,
  created_at,
  updated_at,
  project:projects(id, project_name),
  client:clients(id, client_name),
  subcontractor:subcontractors(id, name)
`;

const ATTACHMENT_SELECT = `
  id,
  organisation_id,
  issue_id,
  file_url,
  file_name,
  file_type,
  file_size,
  caption,
  is_before,
  is_after,
  created_by,
  created_at
`;

const ACTIVITY_SELECT = `
  id,
  organisation_id,
  issue_id,
  action,
  old_value,
  new_value,
  done_by,
  done_by_name,
  created_at
`;

const COMMENT_SELECT = `
  id,
  organisation_id,
  issue_id,
  comment,
  is_internal,
  created_by,
  created_by_name,
  created_at
`;

// ============================================================
// QUERY BUILDERS
// ============================================================

function buildIssueQuery(supabase: any, filters: IssueFilters) {
  let query = supabase
    .from('issues')
    .select(ISSUE_SELECT)
    .order('created_at', { ascending: false });

  if (filters.organisationId) {
    query = query.eq('organisation_id', filters.organisationId);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId);
  }
  if (filters.subcontractorId) {
    query = query.eq('subcontractor_id', filters.subcontractorId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.severity) {
    query = query.eq('severity', filters.severity);
  }
  if (filters.issueType) {
    query = query.eq('issue_type', filters.issueType);
  }
  if (filters.system) {
    query = query.eq('system', filters.system);
  }
  if (filters.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }
  if (filters.reportedBy) {
    query = query.eq('reported_by', filters.reportedBy);
  }
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,issue_no.ilike.%${filters.search}%`);
  }
  if (filters.fromDate) {
    query = query.gte('created_at', filters.fromDate);
  }
  if (filters.toDate) {
    query = query.lte('created_at', filters.toDate);
  }

  // Server-side pagination
  if (filters.limit) {
    const offset = ((filters.page || 1) - 1) * filters.limit;
    query = query.range(offset, offset + filters.limit - 1);
  }

  return query;
}

function buildIssueCountQuery(supabase: any, filters: IssueFilters) {
  let query = supabase.from('issues').select('id', { count: 'exact', head: true });

  if (filters.organisationId) {
    query = query.eq('organisation_id', filters.organisationId);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.severity) {
    query = query.eq('severity', filters.severity);
  }
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,issue_no.ilike.%${filters.search}%`);
  }

  return query;
}

// ============================================================
// CRUD OPERATIONS
// ============================================================

export async function getIssues(filters: IssueFilters): Promise<IssueWithRelations[]> {
  const { data, error } = await buildIssueQuery(supabase, filters);
  if (error) throw error;
  return data || [];
}

export async function getIssueCount(filters: IssueFilters): Promise<number> {
  const { count, error } = await buildIssueCountQuery(supabase, filters);
  if (error) throw error;
  return count || 0;
}

export async function getIssueById(id: string): Promise<IssueWithRelations | null> {
  const { data, error } = await supabase
    .from('issues')
    .select(ISSUE_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createIssue(
  input: IssueInput,
  userId: string,
  userName: string
): Promise<Issue> {
  const { data: issue, error } = await supabase
    .from('issues')
    .insert({
      ...input,
      reported_by: userId,
      reported_by_name: userName,
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;

  // Log creation activity
  await logIssueActivity(issue.id, 'created', { status: 'open' }, userId, userName);

  return issue;
}

export async function updateIssue(
  id: string,
  input: IssueUpdateInput,
  userId: string,
  userName: string
): Promise<Issue> {
  // Get current issue for comparison
  const current = await getIssueById(id);
  if (!current) throw new Error('Issue not found');

  const { data: issue, error } = await supabase
    .from('issues')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Log updates
  if (input.title || input.description || input.priority) {
    await logIssueActivity(
      id,
      'updated',
      { title: current.title, priority: current.priority },
      { title: input.title, priority: input.priority },
      userId,
      userName
    );
  }

  return issue;
}

export async function updateIssueStatus(
  id: string,
  update: IssueStatusUpdate,
  userId: string,
  userName: string
): Promise<Issue> {
  const current = await getIssueById(id);
  if (!current) throw new Error('Issue not found');

  const isReopen = current.status === 'closed' && update.status === 'reopened';
  const isClose = update.status === 'closed';

  const updateData: Partial<Issue> = {
    status: update.status,
    updated_at: new Date().toISOString(),
  };

  if (isClose) {
    updateData.closed_by = userId;
    updateData.closed_by_name = userName;
    updateData.closed_at = new Date().toISOString();
    updateData.closed_remark = update.remark || null;
  }

  if (isReopen) {
    updateData.reopened_count = (current.reopened_count || 0) + 1;
    updateData.reopen_remark = update.remark || null;
    updateData.closed_by = null;
    updateData.closed_by_name = null;
    updateData.closed_at = null;
    updateData.closed_remark = null;
  }

  const { data: issue, error } = await supabase
    .from('issues')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Log status change
  await logIssueActivity(
    id,
    isClose ? 'closed' : isReopen ? 'reopened' : 'status_changed',
    { status: current.status },
    { status: update.status },
    userId,
    userName
  );

  return issue;
}

export async function assignIssue(
  id: string,
  assignTo: string,
  assignToName: string,
  userId: string,
  userName: string
): Promise<Issue> {
  const current = await getIssueById(id);
  if (!current) throw new Error('Issue not found');

  const { data: issue, error } = await supabase
    .from('issues')
    .update({
      assigned_to: assignTo,
      assigned_to_name: assignToName,
      status: current.status === 'open' ? 'assigned' : current.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Log assignment
  await logIssueActivity(
    id,
    current.assigned_to ? 'assigned' : 'assigned',
    { assigned_to: current.assigned_to_name },
    { assigned_to: assignToName },
    userId,
    userName
  );

  return issue;
}

export async function deleteIssue(id: string): Promise<void> {
  const { error } = await supabase.from('issues').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// ATTACHMENTS
// ============================================================

export async function getIssueAttachments(issueId: string): Promise<IssueAttachment[]> {
  const { data, error } = await supabase
    .from('issue_attachments')
    .select(ATTACHMENT_SELECT)
    .eq('issue_id', issueId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addIssueAttachment(
  issueId: string,
  organisationId: string,
  attachment: {
    file_url: string;
    file_name?: string;
    file_type?: string;
    file_size?: number;
    caption?: string;
    is_before?: boolean;
    is_after?: boolean;
  },
  userId: string
): Promise<IssueAttachment> {
  const { data, error } = await supabase
    .from('issue_attachments')
    .insert({
      ...attachment,
      issue_id: issueId,
      organisation_id: organisationId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Log attachment added
  await logIssueActivity(issueId, 'attachment_added', null, { file_name: attachment.file_name }, userId, '');

  return data;
}

export async function deleteIssueAttachment(id: string): Promise<void> {
  const { error } = await supabase.from('issue_attachments').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// ACTIVITY LOGS
// ============================================================

async function logIssueActivity(
  issueId: string,
  action: string,
  oldValue: unknown,
  newValue: unknown,
  userId: string,
  userName: string
): Promise<void> {
  await supabase.from('issue_activity_logs').insert({
    issue_id: issueId,
    action,
    old_value: oldValue as any,
    new_value: newValue as any,
    done_by: userId,
    done_by_name: userName,
  });
}

export async function getIssueActivityLogs(issueId: string): Promise<IssueActivityLog[]> {
  const { data, error } = await supabase
    .from('issue_activity_logs')
    .select(ACTIVITY_SELECT)
    .eq('issue_id', issueId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================
// COMMENTS
// ============================================================

export async function getIssueComments(issueId: string): Promise<IssueComment[]> {
  const { data, error } = await supabase
    .from('issue_comments')
    .select(COMMENT_SELECT)
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addIssueComment(
  issueId: string,
  organisationId: string,
  comment: string,
  isInternal: boolean,
  userId: string,
  userName: string
): Promise<IssueComment> {
  const { data, error } = await supabase
    .from('issue_comments')
    .insert({
      issue_id: issueId,
      organisation_id: organisationId,
      comment,
      is_internal: isInternal,
      created_by: userId,
      created_by_name: userName,
    })
    .select()
    .single();

  if (error) throw error;

  // Log comment
  await logIssueActivity(issueId, 'comment_added', null, { comment }, userId, userName);

  return data;
}

export async function deleteIssueComment(id: string): Promise<void> {
  const { error } = await supabase.from('issue_comments').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export interface IssueStats {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  waitingInspection: number;
  closed: number;
  critical: number;
  overdue: number;
}

export async function getIssueStats(organisationId: string, projectId?: string): Promise<IssueStats> {
  let query = supabase.from('issues').select('status, severity, due_date', { count: 'exact' });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const today = new Date().toISOString().split('T')[0];
  const issues = data || [];

  return {
    total: issues.length,
    open: issues.filter((i: any) => i.status === 'open').length,
    assigned: issues.filter((i: any) => i.status === 'assigned').length,
    inProgress: issues.filter((i: any) => i.status === 'in_progress').length,
    waitingInspection: issues.filter((i: any) => i.status === 'waiting_inspection').length,
    closed: issues.filter((i: any) => i.status === 'closed' || i.status === 'verified').length,
    critical: issues.filter((i: any) => i.severity === 'critical').length,
    overdue: issues.filter((i: any) => i.due_date && i.due_date < today && i.status !== 'closed').length,
  };
}

export interface IssuesBySystem {
  system: string;
  count: number;
}

export async function getIssuesBySystem(organisationId: string, projectId?: string): Promise<IssuesBySystem[]> {
  let query = supabase
    .from('issues')
    .select('system')
    .eq('organisation_id', organisationId);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const counts: Record<string, number> = {};
  (data || []).forEach((issue: any) => {
    const sys = issue.system || 'other';
    counts[sys] = (counts[sys] || 0) + 1;
  });

  return Object.entries(counts).map(([system, count]) => ({ system, count }));
}

export interface IssuesBySubcontractor {
  subcontractor_id: string;
  subcontractor_name: string;
  count: number;
}

export async function getIssuesBySubcontractor(
  organisationId: string,
  projectId?: string
): Promise<IssuesBySubcontractor[]> {
  let query = supabase
    .from('issues')
    .select('subcontractor_id, subcontractors(name)')
    .eq('organisation_id', organisationId)
    .not('subcontractor_id', 'is', null);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const counts: Record<string, { name: string; count: number }> = {};
  (data || []).forEach((issue: any) => {
    if (issue.subcontractor_id) {
      if (!counts[issue.subcontractor_id]) {
        counts[issue.subcontractor_id] = { name: issue.subcontractors?.name || 'Unknown', count: 0 };
      }
      counts[issue.subcontractor_id].count++;
    }
  });

  return Object.entries(counts).map(([subcontractor_id, { name, count }]) => ({
    subcontractor_id,
    subcontractor_name: name,
    count,
  }));
}