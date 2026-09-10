// types.ts — DB row types for Project Collaboration

export type ChannelType =
  | 'project'
  | 'site_coordination'
  | 'design'
  | 'procurement'
  | 'commercial'
  | 'custom';

export interface Channel {
  id: string;
  organisation_id: string;
  project_id: string;
  channel_type: ChannelType;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CollaborationRole = 'owner' | 'admin' | 'member' | 'guest';

export interface Member {
  id: string;
  organisation_id: string;
  channel_id: string;
  user_id: string;
  role: CollaborationRole;
  joined_at: string;
  last_read_at: string | null;
}

export type MessageType = 'text' | 'photo' | 'file' | 'voice' | 'system' | 'reply';

export interface LinkedEntity {
  type:
    | 'task'
    | 'work_order'
    | 'issue'
    | 'daily_report'
    | 'document'
    | 'rfi'
    | 'boq'
    | 'material'
    | 'po';
  id: string;
  label: string;
  snapshot?: Record<string, unknown>;
}

export interface MessageMetadata {
  mentions?: string[];          // auth user ids
  linked_entities?: LinkedEntity[];
  client_msg_id?: string;
  deleted?: boolean;
  ai?: { classification?: string; confidence?: number; potential_action?: boolean };
}

export interface Message {
  id: string;
  organisation_id: string;
  channel_id: string;
  sender_id: string;
  sender_name?: string | null;
  parent_message_id: string | null;
  message_type: MessageType;
  content: string;
  metadata: MessageMetadata;
  client_msg_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface Attachment {
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  upload_status: 'pending' | 'uploaded' | 'failed';
  created_by: string;
  created_at: string;
}

export interface Reaction {
  id: string;
  organisation_id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReadState {
  channel_id: string;
  user_id: string;
  last_read_message_id: string | null;
  last_read_at: string;
}

export type CollaborationFilter =
  | 'all'
  | 'unread'
  | 'mentions'
  | 'files'
  | 'photos'
  | 'decisions'
  | 'issues'
  | 'action_items';

export interface MessageDraft {
  text: string;
  attachments: StagedAttachment[];
  parentMessageId: string | null;
}

export interface StagedAttachment {
  id: string;            // local id, not yet uploaded
  file: File;
  storagePath?: string;  // set after upload
  uploaded: boolean;
  failed: boolean;
  previewUrl?: string;
}
