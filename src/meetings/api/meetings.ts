import { supabase } from '../../supabase';

// Types
export interface Meeting {
  id: string;
  organisation_id: string;
  project_id?: string;
  client_name: string;
  vendor_name?: string;
  meeting_date: string;
  meeting_time?: string;
  description?: string;
  location?: string;
  status: string;
  meeting_type: string;
  minutes_status: string;
  minutes_content?: string;
  minutes_created_at?: string;
  minutes_created_by?: string;
  reference_file_path?: string;
  is_site_visit_meeting?: boolean;
  site_visit_id?: string;
  participants?: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingMinutesItem {
  id: string;
  meeting_id: string;
  serial_number: number;
  description: string;
  client_scope?: string;
  vendor_scope?: string;
  target_date?: string;
  remarks?: string;
  requirement?: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingAttendee {
  id: string;
  meeting_id: string;
  name: string;
  email?: string;
  role: string;
  organisation?: string;
  created_at: string;
}

export interface MeetingActionItem {
  id: string;
  meeting_id: string;
  minutes_item_id?: string;
  title: string;
  description?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  due_date?: string;
  priority: string;
  status: string;
  task_id?: string;
  created_at: string;
  updated_at: string;
}

// Get all meetings for an organisation
export async function getMeetings(organisationId: string, projectId?: string) {
  let query = supabase
    .from('meetings')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('meeting_date', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Meeting[];
}

// Get meeting by ID
export async function getMeetingById(meetingId: string) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (error) throw error;
  return data as Meeting;
}

// Create meeting
export async function createMeeting(meeting: Partial<Meeting>) {
  const { data, error } = await supabase
    .from('meetings')
    .insert(meeting)
    .select()
    .single();

  if (error) throw error;
  return data as Meeting;
}

// Update meeting
export async function updateMeeting(meetingId: string, updates: Partial<Meeting>) {
  const { data, error } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', meetingId)
    .select()
    .single();

  if (error) throw error;
  return data as Meeting;
}

// Delete meeting
export async function deleteMeeting(meetingId: string) {
  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', meetingId);

  if (error) throw error;
}

// Get meeting minutes items
export async function getMeetingMinutesItems(meetingId: string) {
  const { data, error } = await supabase
    .from('meeting_minutes_items')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('serial_number', { ascending: true });

  if (error) throw error;
  return data as MeetingMinutesItem[];
}

// Save meeting minutes items
export async function saveMeetingMinutesItems(meetingId: string, items: MeetingMinutesItem[]) {
  // Delete existing items
  await supabase
    .from('meeting_minutes_items')
    .delete()
    .eq('meeting_id', meetingId);

  // Insert new items
  if (items.length > 0) {
    const { error } = await supabase
      .from('meeting_minutes_items')
      .insert(items.map(item => ({ ...item, meeting_id: meetingId })));

    if (error) throw error;
  }
}

// Get meeting attendees
export async function getMeetingAttendees(meetingId: string) {
  const { data, error } = await supabase
    .from('meeting_attendees')
    .select('*')
    .eq('meeting_id', meetingId);

  if (error) throw error;
  return data as MeetingAttendee[];
}

// Save meeting attendees
export async function saveMeetingAttendees(meetingId: string, attendees: MeetingAttendee[]) {
  // Delete existing attendees
  await supabase
    .from('meeting_attendees')
    .delete()
    .eq('meeting_id', meetingId);

  // Insert new attendees
  if (attendees.length > 0) {
    const { error } = await supabase
      .from('meeting_attendees')
      .insert(attendees.map(a => ({ ...a, meeting_id: meetingId })));

    if (error) throw error;
  }
}

// Get meeting action items
export async function getMeetingActionItems(meetingId: string) {
  const { data, error } = await supabase
    .from('meeting_action_items')
    .select('*')
    .eq('meeting_id', meetingId);

  if (error) throw error;
  return data as MeetingActionItem[];
}

// Save meeting action items
export async function saveMeetingActionItems(meetingId: string, actionItems: MeetingActionItem[]) {
  // Delete existing action items
  await supabase
    .from('meeting_action_items')
    .delete()
    .eq('meeting_id', meetingId);

  // Insert new action items
  if (actionItems.length > 0) {
    const { error } = await supabase
      .from('meeting_action_items')
      .insert(actionItems.map(item => ({ ...item, meeting_id: meetingId })));

    if (error) throw error;
  }
}

// Finalize minutes
export async function finalizeMinutes(meetingId: string, userId: string) {
  const { data, error } = await supabase
    .from('meetings')
    .update({
      minutes_status: 'finalized',
      minutes_created_at: new Date().toISOString(),
      minutes_created_by: userId
    })
    .eq('id', meetingId)
    .select()
    .single();

  if (error) throw error;
  return data as Meeting;
}

// Sync action items with unified tasks
export async function syncActionItemsWithTasks(meetingId: string) {
  const actionItems = await getMeetingActionItems(meetingId);
  const meeting = await getMeetingById(meetingId);
  
  for (const item of actionItems) {
    if (item.due_date && !item.task_id) {
      // Create task in tasks table
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
          tags: ['meeting-action', `meeting-${meetingId}`]
        })
        .select()
        .single();

      if (!taskError && taskData) {
        // Update action item with task_id
        await supabase
          .from('meeting_action_items')
          .update({ task_id: taskData.id })
          .eq('id', item.id);
      }
    }
  }
}
