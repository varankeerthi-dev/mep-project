// api.ts — Supabase RPC + query wrappers for Project Collaboration.
import { supabase } from '../../../supabase';
import { SendMessageRpcSchema } from './schemas';
import type {
  Attachment,
  Channel,
  Message,
  Reaction,
  ReadState,
} from './types';

/** Idempotently resolve the project's primary collaboration channel. */
export async function ensureChannel(projectId: string): Promise<Channel> {
  const { data, error } = await supabase.rpc('get_or_create_project_channel', {
    p_project_id: projectId,
  });
  if (error) throw error;
  return data as Channel;
}

interface SendMessageArgs {
  channelId: string;
  content: string;
  parentMessageId: string | null;
  messageType?: 'text' | 'photo' | 'file' | 'voice' | 'system' | 'reply';
  metadata?: Record<string, unknown>;
  clientMsgId: string;
}

export async function sendMessage(args: SendMessageArgs): Promise<Message> {
  const { data, error } = await supabase.rpc('send_collaboration_message', {
    p_channel_id: args.channelId,
    p_content: args.content,
    p_parent_message_id: args.parentMessageId,
    p_message_type: args.messageType ?? 'text',
    p_metadata: args.metadata ?? {},
    p_client_msg_id: args.clientMsgId,
  });
  if (error) throw error;
  // Server-trust boundary: in dev, validate. In prod, trust Supabase types.
  if (import.meta.env.DEV) {
    return SendMessageRpcSchema.parse(data) as Message;
  }
  return data as Message;
}

export async function markChannelRead(channelId: string, throughMessageId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_channel_read', {
    p_channel_id: channelId,
    p_through_message_id: throughMessageId,
  });
  if (error) throw error;
}

export async function addReaction(messageId: string, emoji: string): Promise<Reaction> {
  const { data, error } = await supabase.rpc('add_reaction', {
    p_message_id: messageId,
    p_emoji: emoji,
  });
  if (error) throw error;
  return data as Reaction;
}

export async function removeReaction(messageId: string, emoji: string): Promise<void> {
  const { error } = await supabase.rpc('remove_reaction', {
    p_message_id: messageId,
    p_emoji: emoji,
  });
  if (error) throw error;
}

export async function softDeleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_message', {
    p_message_id: messageId,
  });
  if (error) throw error;
}

export interface AddAttachmentArgs {
  messageId: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

/** Create the attachment row that links a message to an uploaded file. */
export async function addAttachment(args: AddAttachmentArgs): Promise<Attachment> {
  const { data, error } = await supabase.rpc('add_collaboration_attachment', {
    p_message_id: args.messageId,
    p_storage_bucket: args.storageBucket,
    p_storage_path: args.storagePath,
    p_file_name: args.fileName,
    p_file_size: args.fileSize,
    p_mime_type: args.mimeType,
    p_width: args.width ?? null,
    p_height: args.height ?? null,
    p_duration_ms: args.durationMs ?? null,
  });
  if (error) throw error;
  return data as Attachment;
}
export interface MessagePage {
  items: Message[];
  nextCursor: string | null;        // created_at of last item
}

const PAGE_SIZE = 50;

/** Page of root messages (parent_message_id IS NULL), newest first. */
export async function fetchMessagesPage(
  channelId: string,
  cursor: string | null,
): Promise<MessagePage> {
  let q = supabase
    .from('project_collaboration_messages')
    .select('*, sender:user_profiles!sender_id(full_name)')
    .eq('channel_id', channelId)
    .is('parent_message_id', null)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) q = q.lt('created_at', cursor);
  const { data, error } = await q;
  if (error) throw error;
  const items = ((data ?? []) as Array<Message & { sender?: { full_name: string | null } | null }>).map(
    (row) => ({ ...row, sender_name: row.sender?.full_name ?? null }),
  );
  const nextCursor = items.length === PAGE_SIZE ? items[items.length - 1].created_at : null;
  return { items, nextCursor };
}

export async function fetchThread(parentMessageId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('project_collaboration_messages')
    .select('*, sender:user_profiles!sender_id(full_name)')
    .eq('parent_message_id', parentMessageId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Message & { sender?: { full_name: string | null } | null }>).map(
    (row) => ({ ...row, sender_name: row.sender?.full_name ?? null }),
  );
}

export async function fetchAttachments(messageId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('project_collaboration_attachments')
    .select('*')
    .eq('message_id', messageId);
  if (error) throw error;
  return (data ?? []) as Attachment[];
}

export async function fetchReactionsForMessages(messageIds: string[]): Promise<Reaction[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabase
    .from('project_collaboration_reactions')
    .select('*')
    .in('message_id', messageIds);
  if (error) throw error;
  return (data ?? []) as Reaction[];
}

export async function fetchReadState(channelId: string, userId: string): Promise<ReadState | null> {
  const { data, error } = await supabase
    .from('project_collaboration_read_state')
    .select('*')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ReadState | null;
}

export async function fetchMembers(channelId: string) {
  const { data, error } = await supabase
    .from('project_collaboration_members')
    .select('*')
    .eq('channel_id', channelId);
  if (error) throw error;
  return data ?? [];
}

export async function uploadAttachment(
  bucket: string,
  path: string,
  file: File,
): Promise<{ path: string }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return { path };
}

export async function createSignedUrl(bucket: string, path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function searchMessages(
  channelId: string,
  term: string,
  filters: Record<string, string> = {},
  cursor: string | null = null,
  limit = 50,
): Promise<Message[]> {
  const { data, error } = await supabase.rpc('search_collaboration_messages', {
    p_channel_id: channelId,
    p_term: term,
    p_filters: filters,
    p_cursor: cursor,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export interface MemberSummary {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/** Resolve sender display names for a channel. Joins project_collaboration_members → user_profiles. */
export async function fetchChannelMembers(channelId: string): Promise<MemberSummary[]> {
  const { data, error } = await supabase
    .from('project_collaboration_members')
    .select('user_id, user_profiles!inner(full_name, avatar_url)')
    .eq('channel_id', channelId);
  if (error) throw error;
  return ((data ?? []) as Array<{ user_id: string; user_profiles: { full_name: string | null; avatar_url: string | null } | null }>).map(
    (row) => ({
      user_id: row.user_id,
      full_name: row.user_profiles?.full_name ?? null,
      email: null,
      avatar_url: row.user_profiles?.avatar_url ?? null,
    }),
  );
}
