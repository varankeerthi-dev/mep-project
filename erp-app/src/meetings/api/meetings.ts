import { supabase } from '../../supabase';
import type {
  Meeting,
  MeetingMinutesItem,
  MeetingAttendee,
  MeetingActionItem,
  MeetingAttachment,
  CreateMeetingInput,
  UpdateMeetingInput,
  MeetingFilter,
  Client,
  Project,
} from '../types';

// Types moved to types/index.ts - keeping re-exports for backward compatibility

// Re-export types for backward compatibility
export type {
  Meeting,
  MeetingMinutesItem,
  MeetingAttendee,
  MeetingActionItem,
  MeetingAttachment,
  CreateMeetingInput,
  UpdateMeetingInput,
  MeetingFilter,
  Client,
  Project,
} from '../types';

// Get all meetings for an organisation with filtering
export async function getMeetings(
  organisationId: string,
  filters?: MeetingFilter
): Promise<Meeting[]> {
  let query = supabase
    .from('meetings')
    .select('*, client:clients(id, client_name)')
    .eq('organisation_id', organisationId)
    .order('meeting_date', { ascending: false });

  if (filters?.meetingType) {
    query = query.eq('meeting_type', filters.meetingType);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    query = query.or(
      `client_name.ilike.%${filters.search}%,vendor_name.ilike.%${filters.search}%,location.ilike.%${filters.search}%`
    );
  }
  if (filters?.startDate) {
    query = query.gte('meeting_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('meeting_date', filters.endDate);
  }
  // Default: hide archived unless explicitly showing
  if (filters?.includeArchived === false) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  console.log('API result:', data, error);
  if (error) throw error;
  return (data || []) as Meeting[];
}

// Get meeting by ID with relations
export async function getMeetingById(meetingId: string): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from('meetings')
    .select()
    .eq('id', meetingId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Meeting;
}

// Create meeting
export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .insert(input as unknown as Record<string, unknown>)
    .select()
    .single();

  if (error) throw error;
  return data as Meeting;
}

// Update meeting
export async function updateMeeting(
  meetingId: string,
  updates: UpdateMeetingInput
): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .update({ ...updates, updated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', meetingId)
    .select()
    .single();

  if (error) throw error;
  return data as Meeting;
}

// Archive meeting (soft delete)
export async function archiveMeeting(meetingId: string): Promise<Meeting> {
  return updateMeeting(meetingId, { is_archived: true });
}

// Restore archived meeting
export async function restoreMeeting(meetingId: string): Promise<Meeting> {
  return updateMeeting(meetingId, { is_archived: false });
}

// Delete meeting (hard delete)
export async function deleteMeeting(meetingId: string): Promise<void> {
  // First delete related records
  await Promise.all([
    supabase.from('meeting_minutes_items').delete().eq('meeting_id', meetingId),
    supabase.from('meeting_attendees').delete().eq('meeting_id', meetingId),
    supabase.from('meeting_action_items').delete().eq('meeting_id', meetingId),
    supabase.from('meeting_attachments').delete().eq('meeting_id', meetingId),
  ]);

  const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
  if (error) throw error;
}

// Duplicate meeting
export async function duplicateMeeting(
  meetingId: string,
  newDate?: string
): Promise<Meeting> {
  const original = await getMeetingById(meetingId);
  if (!original) throw new Error('Meeting not found');

  const { minutesItems, attendees, attachments } = await loadMeetingRelations(meetingId);

  // Create new meeting
  const newMeeting = await createMeeting({
    organisation_id: original.organisation_id,
    client_name: original.client_name,
    vendor_name: original.vendor_name,
    project_id: original.project_id,
    meeting_date: newDate || original.meeting_date,
    meeting_time: original.meeting_time,
    location: original.location,
    description: original.description,
    meeting_type: original.meeting_type,
    is_site_visit_meeting: original.is_site_visit_meeting,
    site_visit_id: original.site_visit_id,
    participants: original.participants,
    tags: original.tags,
    recurrence: original.recurrence,
    meeting_link: original.meeting_link,
    status: 'upcoming',
    minutes_status: 'pending',
  });

  // Copy attendees
  if (attendees.length > 0) {
    await saveMeetingAttendees(newMeeting.id, attendees);
  }

  // Copy attachments
  if (attachments.length > 0) {
    await saveMeetingAttachments(newMeeting.id, attachments);
  }

  return newMeeting;
}

// Load all meeting relations
async function loadMeetingRelations(meetingId: string) {
  const [minutesItems, attendees, attachments] = await Promise.all([
    getMeetingMinutesItems(meetingId),
    getMeetingAttendees(meetingId),
    getMeetingAttachments(meetingId),
  ]);
  return { minutesItems, attendees, attachments };
}

// Get meeting minutes items
export async function getMeetingMinutesItems(meetingId: string): Promise<MeetingMinutesItem[]> {
  const { data, error } = await supabase
    .from('meeting_minutes_items')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('serial_number', { ascending: true });

  if (error) throw error;
  return data as MeetingMinutesItem[];
}

// Save meeting minutes items (upsert - preserves existing with changes)
export async function saveMeetingMinutesItems(
  meetingId: string,
  items: MeetingMinutesItem[]
): Promise<void> {
  // Get existing items
  const { data: existing } = await supabase
    .from('meeting_minutes_items')
    .select('id')
    .eq('meeting_id', meetingId);

  const existingIds = new Set(existing?.map((e) => e.id) || []);
  const newIds = new Set(items.map((i) => i.id).filter(Boolean));

  // Items to delete (exist but not in new list)
  const toDelete = [...existingIds].filter((id) => !newIds.has(id));
  if (toDelete.length > 0) {
    await supabase.from('meeting_minutes_items').delete().in('id', toDelete);
  }

  // Upsert new/updated items
  if (items.length > 0) {
    const itemsToUpsert = items.map((item) => ({
      id: item.id || crypto.randomUUID(),
      meeting_id: meetingId,
      serial_number: item.serial_number,
      description: item.description,
      client_scope: item.client_scope || '',
      vendor_scope: item.vendor_scope || '',
      target_date: item.target_date || null,
      remarks: item.remarks || '',
      requirement: item.requirement || '',
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('meeting_minutes_items')
      .upsert(itemsToUpsert, { onConflict: 'id' });

    if (error) throw error;
  }
}

// Get meeting attendees
export async function getMeetingAttendees(meetingId: string): Promise<MeetingAttendee[]> {
  const { data, error } = await supabase
    .from('meeting_attendees')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as MeetingAttendee[];
}

// Save meeting attendees (upsert)
export async function saveMeetingAttendees(
  meetingId: string,
  attendees: MeetingAttendee[]
): Promise<void> {
  if (attendees.length === 0) return;

  const attendeesToUpsert = attendees.map((a) => ({
    id: a.id || crypto.randomUUID(),
    meeting_id: meetingId,
    name: a.name,
    email: a.email || null,
    role: a.role,
    organisation: a.organisation || null,
    created_at: a.created_at || new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('meeting_attendees')
    .upsert(attendeesToUpsert, { onConflict: 'id' });

  if (error) throw error;
}

// Get meeting action items
export async function getMeetingActionItems(meetingId: string): Promise<MeetingActionItem[]> {
  const { data, error } = await supabase
    .from('meeting_action_items')
    .select('*, assignee:assigned_user(full_name)')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as MeetingActionItem[];
}

// Save meeting action items (upsert)
export async function saveMeetingActionItems(
  meetingId: string,
  actionItems: MeetingActionItem[]
): Promise<void> {
  // Get existing items
  const { data: existing } = await supabase
    .from('meeting_action_items')
    .select('id')
    .eq('meeting_id', meetingId);

  const existingIds = new Set(existing?.map((e) => e.id) || []);
  const newIds = new Set(actionItems.map((i) => i.id).filter(Boolean));

  // Items to delete
  const toDelete = [...existingIds].filter((id) => !newIds.has(id));
  if (toDelete.length > 0) {
    await supabase.from('meeting_action_items').delete().in('id', toDelete);
  }

  // Upsert new/updated items
  if (actionItems.length > 0) {
    const itemsToUpsert = actionItems.map((item) => ({
      id: item.id || crypto.randomUUID(),
      meeting_id: meetingId,
      minutes_item_id: item.minutes_item_id || null,
      title: item.title,
      description: item.description || null,
      assigned_to: item.assigned_to || null,
      due_date: item.due_date || null,
      priority: item.priority || 'medium',
      status: item.status || 'pending',
      task_id: item.task_id || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('meeting_action_items')
      .upsert(itemsToUpsert, { onConflict: 'id' });

    if (error) throw error;
  }
}

// Get meeting attachments
export async function getMeetingAttachments(meetingId: string): Promise<MeetingAttachment[]> {
  const { data, error } = await supabase
    .from('meeting_attachments')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as MeetingAttachment[];
}

// Save meeting attachments
export async function saveMeetingAttachments(
  meetingId: string,
  attachments: MeetingAttachment[]
): Promise<void> {
  if (attachments.length === 0) return;

  const attachmentsToUpsert = attachments.map((a) => ({
    id: a.id || crypto.randomUUID(),
    meeting_id: meetingId,
    file_name: a.file_name,
    file_path: a.file_path,
    file_type: a.file_type,
    file_size: a.file_size,
    uploaded_by: a.uploaded_by,
    created_at: a.created_at || new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('meeting_attachments')
    .upsert(attachmentsToUpsert, { onConflict: 'id' });

  if (error) throw error;
}

// Upload attachment to storage
export async function uploadMeetingAttachment(
  meetingId: string,
  file: File,
  userId: string
): Promise<MeetingAttachment> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${meetingId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
  const filePath = `meetings/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('meeting-attachments')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const attachment: Partial<MeetingAttachment> = {
    meeting_id: meetingId,
    file_name: file.name,
    file_path: filePath,
    file_type: file.type,
    file_size: file.size,
    uploaded_by: userId,
  };

  const { data, error } = await supabase
    .from('meeting_attachments')
    .insert(attachment as Record<string, unknown>)
    .select()
    .single();

  if (error) throw error;
  return data as MeetingAttachment;
}

// Delete attachment
export async function deleteMeetingAttachment(attachmentId: string): Promise<void> {
  const { error } = await supabase
    .from('meeting_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw error;
}

// Finalize minutes
export async function finalizeMinutes(
  meetingId: string,
  userId: string
): Promise<Meeting> {
  return updateMeeting(meetingId, {
    minutes_status: 'finalized',
    minutes_created_at: new Date().toISOString(),
    minutes_created_by: userId,
    status: 'completed',
  });
}

// Reopen finalized minutes
export async function reopenMinutes(meetingId: string): Promise<Meeting> {
  return updateMeeting(meetingId, {
    minutes_status: 'draft',
    minutes_created_at: null,
    minutes_created_by: null,
    status: 'upcoming',
  });
}

// Sync action items with unified tasks
export async function syncActionItemsWithTasks(meetingId: string): Promise<void> {
  const actionItems = await getMeetingActionItems(meetingId);
  const meeting = await getMeetingById(meetingId);
  if (!meeting) return;

  for (const item of actionItems) {
    if (item.due_date && !item.task_id) {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: item.title,
          description: item.description,
          due_date: item.due_date,
          assignee_ids: item.assigned_to ? [item.assigned_to] : [],
          priority: item.priority === 'critical' ? 'critical' : item.priority === 'high' ? 'high' : 'medium',
          status: 'not_started',
          organisation_id: meeting.organisation_id,
          project_id: meeting.project_id,
          task_type: 'task',
          created_by: meeting.minutes_created_by || null,
          tags: ['meeting-action', `meeting-${meetingId}`],
        })
        .select()
        .single();

      if (!taskError && taskData) {
        await supabase
          .from('meeting_action_items')
          .update({ task_id: taskData.id })
          .eq('id', item.id);
      }
    }
  }
}

// Get meeting templates
export async function getMeetingTemplates(organisationId: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meeting_templates')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Meeting[];
}

// Create meeting template
export async function createMeetingTemplate(
  meetingId: string,
  name: string,
  organisationId: string
): Promise<void> {
  const meeting = await getMeetingById(meetingId);
  if (!meeting) throw new Error('Meeting not found');

  const { minutesItems, attendees } = await loadMeetingRelations(meetingId);

  await supabase.from('meeting_templates').insert({
    organisation_id: organisationId,
    name,
    default_client_name: meeting.client_name,
    default_vendor_name: meeting.vendor_name,
    default_location: meeting.location,
    default_description: meeting.description,
    default_meeting_type: meeting.meeting_type,
    default_duration_minutes: meeting.duration_minutes,
    template_attendees: attendees,
    template_minutes: minutesItems,
  });
}

// Create meeting from template
export async function createMeetingFromTemplate(
  templateId: string,
  organisationId: string,
  meetingDate: string
): Promise<Meeting> {
  const { data: template, error } = await supabase
    .from('meeting_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) throw error;

  const meeting = await createMeeting({
    organisation_id: organisationId,
    client_name: template.default_client_name,
    vendor_name: template.default_vendor_name,
    location: template.default_location,
    description: template.default_description,
    meeting_type: template.default_meeting_type,
    meeting_date: meetingDate,
    meeting_time: '',
    status: 'upcoming',
    minutes_status: 'pending',
  });

  // Apply template attendees and minutes
  if (template.template_attendees?.length) {
    await saveMeetingAttendees(meeting.id, template.template_attendees);
  }
  if (template.template_minutes?.length) {
    await saveMeetingMinutesItems(meeting.id, template.template_minutes);
  }

  return meeting;
}

// Update action item status
export async function updateActionItemStatus(
  actionItemId: string,
  status: MeetingActionItem['status']
): Promise<MeetingActionItem> {
  const { data, error } = await supabase
    .from('meeting_action_items')
    .update({ status, updated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', actionItemId)
    .select()
    .single();

  if (error) throw error;
  return data as MeetingActionItem;
}

// Search clients for meeting
export async function searchClients(
  organisationId: string,
  search: string
): Promise<Client[]> {
  let query = supabase
    .from('clients')
    .select('id, client_name')
    .eq('organisation_id', organisationId)
    .limit(20);

  if (search) {
    query = query.ilike('client_name', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Client[];
}

// Search projects for meeting
export async function searchProjects(
  organisationId: string,
  search: string
): Promise<Project[]> {
  let query = supabase
    .from('projects')
    .select('id, project_name, project_code, status')
    .eq('organisation_id', organisationId)
    .limit(20);

  if (search) {
    query = query.ilike('project_name', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Project[];
}

// Get meeting statistics
export async function getMeetingStats(organisationId: string): Promise<{
  total: number;
  upcoming: number;
  completed: number;
  pendingMinutes: number;
  finalized: number;
}> {
  const [meetingsResult, minutesResult] = await Promise.all([
    supabase
      .from('meetings')
      .select('status, minutes_status')
      .eq('organisation_id', organisationId)
      .eq('is_archived', false),
    supabase
      .from('meetings')
      .select('minutes_status')
      .eq('organisation_id', organisationId)
      .eq('is_archived', false)
      .in('minutes_status', ['pending', 'draft']),
  ]);

  const meetings = meetingsResult.data || [];
  const pendingMinutes = minutesResult.data || [];

  return {
    total: meetings.length,
    upcoming: meetings.filter((m) => m.status === 'upcoming').length,
    completed: meetings.filter((m) => m.status === 'completed').length,
    pendingMinutes: pendingMinutes.length,
    finalized: meetings.filter((m) => m.minutes_status === 'finalized').length,
  };
}

// Create recurring meetings
export async function createRecurringMeetings(
  baseMeeting: CreateMeetingInput,
  recurrence: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    count: number;
    endDate?: string;
  }
): Promise<Meeting[]> {
  const meetings: Meeting[] = [];
  let currentDate = new Date(baseMeeting.meeting_date);

  for (let i = 0; i < recurrence.count; i++) {
    const meeting = await createMeeting({
      ...baseMeeting,
      meeting_date: currentDate.toISOString().split('T')[0],
    });
    meetings.push(meeting);

    // Calculate next date
    switch (recurrence.frequency) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }

    // Stop if endDate reached
    if (recurrence.endDate && new Date(currentDate) > new Date(recurrence.endDate)) {
      break;
    }
  }

  return meetings;
}

// Export meeting minutes to PDF (returns data URL)
export async function exportMinutesToPDF(meetingId: string): Promise<string> {
  const [meeting, minutesItems, attendees] = await Promise.all([
    getMeetingById(meetingId),
    getMeetingMinutesItems(meetingId),
    getMeetingAttendees(meetingId),
  ]);

  if (!meeting) throw new Error('Meeting not found');

  // Import PDF generator dynamically to avoid SSR issues
  const { generateMinutesPDF } = await import('../../lib/meeting-pdf-generator');
  return generateMinutesPDF(meeting, minutesItems, attendees);
}

// Send meeting invitation email
export async function sendMeetingInvitation(
  meetingId: string,
  attendeeIds: string[]
): Promise<void> {
  const meeting = await getMeetingById(meetingId);
  const attendees = await getMeetingAttendees(meetingId);

  const selectedAttendees = attendees.filter((a) => attendeeIds.includes(a.id));
  const emails = selectedAttendees
    .map((a) => a.email)
    .filter(Boolean) as string[];

  if (emails.length === 0) return;

  // Call edge function or API to send emails
  // For now, just log - actual implementation would use Resend/SendGrid
  console.log('Sending meeting invitation to:', emails, meeting);
}