// Core Types for Meetings Module

export type MeetingStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
export type MinutesStatus = 'pending' | 'draft' | 'finalized';
export type MeetingType =
  | 'client'
  | 'project'
  | 'internal'
  | 'development'
  | 'vendor'
  | 'subcontractor'
  | 'site'
  | 'other';
export type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ActionItemPriority = 'low' | 'medium' | 'high' | 'critical';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type LocationType = 'physical' | 'virtual' | 'hybrid';
export type MeetingTopicStatus = 'open' | 'covered' | 'deferred';
export type DecisionStatus = 'proposed' | 'confirmed' | 'superseded' | 'rejected';
export type MeetingLinkEntityType = 'client' | 'vendor' | 'project' | 'task' | 'milestone' | 'site_visit';
export type MeetingVersionStatus = 'draft' | 'in_review' | 'finalized' | 'superseded';
export type MeetingAuditEventType =
  | 'created'
  | 'updated'
  | 'review_requested'
  | 'reviewed'
  | 'finalized'
  | 'amended'
  | 'shared'
  | 'linked'
  | 'unlinked'
  | 'archived';

// Client and Project types for relationship linking
export interface Client {
  id: string;
  client_name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
}

export interface Project {
  id: string;
  project_name: string;
  project_code?: string;
  status?: string;
  client_id?: string;
}

// Meeting interface
export interface Meeting {
  id: string;
  organisation_id: string;
  client_id?: string;
  client?: Client;
  project_id?: string;
  project?: Project;
  client_name: string;
  vendor_name?: string;
  meeting_date: string;
  meeting_time?: string;
  duration_minutes?: number;
  location?: string;
  location_type?: LocationType;
  meeting_link?: string;
  description?: string;
  meeting_type: MeetingType;
  status: MeetingStatus;
  minutes_status: MinutesStatus;
  minutes_content?: string;
  minutes_created_at?: string;
  minutes_created_by?: string;
  participants?: string;
  tags?: string[];
  recurrence?: RecurrencePattern;
  is_site_visit_meeting?: boolean;
  site_visit_id?: string;
  reference_file_path?: string;
  is_archived?: boolean;
  parent_meeting_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  count: number;
  end_date?: string;
  parent_meeting_id?: string;
}

// Minutes Item interface
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

export interface MeetingTopic {
  id: string;
  meeting_id: string;
  serial_number: number;
  title: string;
  notes?: string;
  status: MeetingTopicStatus;
  created_at: string;
  updated_at: string;
}

export interface MeetingDecision {
  id: string;
  meeting_id: string;
  topic_id?: string;
  decision: string;
  rationale?: string;
  owner_id?: string;
  owner_name?: string;
  status: DecisionStatus;
  decided_at?: string;
  created_at: string;
  updated_at: string;
}

// Attendee interface
export interface MeetingAttendee {
  id: string;
  meeting_id: string;
  name: string;
  email?: string;
  role: AttendeeRole;
  organisation?: string;
  is_present?: boolean;
  created_at: string;
}

export type AttendeeRole =
  | 'organizer'
  | 'client_rep'
  | 'vendor_rep'
  | 'project_manager'
  | 'site_engineer'
  | 'team_member'
  | 'attendee'
  | 'observer';

// Action Item interface
export interface MeetingActionItem {
  id: string;
  meeting_id: string;
  topic_id?: string;
  decision_id?: string;
  minutes_item_id?: string;
  title: string;
  description?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  due_date?: string;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  task_id?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// Attachment interface
export interface MeetingWorkOption {
  id: string;
  title: string;
  project_id?: string | null;
  task_type: 'task' | 'milestone';
  status?: string;
}

export interface MeetingLink {
  id: string;
  meeting_id: string;
  entity_type: MeetingLinkEntityType;
  entity_id: string;
  entity_name?: string;
  source_type?: 'meeting' | 'topic' | 'decision' | 'action_item';
  source_id?: string;
  created_by?: string;
  created_at: string;
}

export interface MeetingVersion {
  id: string;
  meeting_id: string;
  version_number: number;
  status: MeetingVersionStatus;
  snapshot: Record<string, unknown>;
  created_by: string;
  created_at: string;
  finalized_at?: string;
  supersedes_version_id?: string;
}

export interface MeetingAuditEvent {
  id: string;
  meeting_id: string;
  event_type: MeetingAuditEventType;
  actor_id?: string;
  actor_name?: string;
  entity_type?: string;
  entity_id?: string;
  before_value?: Record<string, unknown>;
  after_value?: Record<string, unknown>;
  created_at: string;
}

export interface MeetingAttachment {
  id: string;
  meeting_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

// Meeting Template interface
export interface MeetingTemplate {
  id: string;
  organisation_id: string;
  name: string;
  description?: string;
  default_client_name?: string;
  default_vendor_name?: string;
  default_location?: string;
  default_description?: string;
  default_meeting_type?: MeetingType;
  default_duration_minutes?: number;
  template_attendees?: Partial<MeetingAttendee>[];
  template_minutes?: Partial<MeetingMinutesItem>[];
  created_at: string;
  updated_at: string;
}

// Filter types for queries
export interface MeetingSearchFilters {
  query: string;
  projectId?: string;
  clientId?: string;
  meetingType?: MeetingType;
  startDate?: string;
  endDate?: string;
  includeDrafts?: boolean;
  limit?: number;
  offset?: number;
}

export interface MeetingHistoryEntry {
  id: string;
  meeting_id: string;
  meeting_date: string;
  meeting_type: MeetingType;
  minutes_status: MinutesStatus;
  client_name?: string;
  source_type?: 'meeting' | 'topic' | 'decision' | 'action_item';
  source_id?: string;
  source_title?: string;
  snippet?: string;
}

export interface MeetingSearchResult {
  id: string;
  meeting_id: string;
  meeting_date: string;
  meeting_type: MeetingType;
  client_name?: string;
  project_id?: string;
  project_name?: string;
  source_type: 'meeting' | 'topic' | 'decision' | 'action_item' | 'attachment';
  source_id?: string;
  source_title?: string;
  snippet: string;
  rank?: number;
}

export interface MeetingFilter {
  projectId?: string;
  meetingType?: MeetingType;
  status?: MeetingStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
  includeArchived?: boolean;
  tags?: string[];
}

// Input types for creating/updating
export interface CreateMeetingInput {
  organisation_id: string;
  client_id?: string;
  client_name?: string;
  vendor_name?: string;
  project_id?: string;
  meeting_date: string;
  meeting_time?: string;
  duration_minutes?: number;
  location?: string;
  location_type?: LocationType;
  meeting_link?: string;
  description?: string;
  meeting_type: MeetingType;
  is_site_visit_meeting?: boolean;
  site_visit_id?: string;
  participants?: string;
  tags?: string[];
  recurrence?: RecurrencePattern;
  status?: MeetingStatus;
  minutes_status?: MinutesStatus;
  parent_meeting_id?: string;
}

export interface UpdateMeetingInput {
  client_id?: string;
  client_name?: string;
  vendor_name?: string;
  project_id?: string;
  meeting_date?: string;
  meeting_time?: string;
  duration_minutes?: number;
  location?: string;
  location_type?: LocationType;
  meeting_link?: string;
  description?: string;
  meeting_type?: MeetingType;
  status?: MeetingStatus;
  minutes_status?: MinutesStatus;
  minutes_content?: string;
  minutes_created_at?: string;
  minutes_created_by?: string;
  participants?: string;
  tags?: string[];
  recurrence?: RecurrencePattern;
  is_site_visit_meeting?: boolean;
  site_visit_id?: string;
  reference_file_path?: string;
  is_archived?: boolean;
  parent_meeting_id?: string;
}

// Form data types
export interface MeetingFormData {
  client_id?: string;
  client_name: string;
  vendor_name: string;
  project_id: string;
  meeting_date: string;
  meeting_time: string;
  duration_minutes: number;
  location: string;
  location_type: LocationType;
  meeting_link: string;
  description: string;
  meeting_type: MeetingType;
  tags: string[];
  is_site_visit_meeting: boolean;
  site_visit_id: string;
}

// Statistics
export interface MeetingStats {
  total: number;
  upcoming: number;
  inProgress: number;
  completed: number;
  pendingMinutes: number;
  finalized: number;
  archived: number;
}

// Local-only types (not synced to DB)
export interface LocalMinutesItem {
  id: string;
  serial_number: number;
  description: string;
  client_scope: string;
  vendor_scope: string;
  target_date: string;
  remarks: string;
  requirement: string;
  isNew?: boolean;
  isDirty?: boolean;
}

export interface LocalAttendee {
  id: string;
  name: string;
  email: string;
  role: AttendeeRole;
  organisation: string;
  isNew?: boolean;
  isDirty?: boolean;
}

export interface LocalTopic {
  id: string;
  title: string;
  notes: string;
  status: MeetingTopicStatus;
}

export interface LocalDecision {
  id: string;
  topic_id: string;
  decision: string;
  rationale: string;
  owner_id: string;
  owner_name: string;
  status: DecisionStatus;
}

export interface LocalActionItem {
  id: string;
  topic_id?: string;
  decision_id?: string;
  minutes_item_id?: string;
  title: string;
  description: string;
  assigned_to: string;
  assigned_to_name: string;
  due_date: string;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  task_id: string;
  isNew?: boolean;
  isDirty?: boolean;
}