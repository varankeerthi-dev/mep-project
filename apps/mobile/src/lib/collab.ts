// lib/collab.ts — Mobile data layer for the Collaboration module.
// Mirrors apps/web/src/projects/features/collaboration (same tables + RPCs).

import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type ChannelType =
  | 'project'
  | 'site_coordination'
  | 'design'
  | 'procurement'
  | 'commercial'
  | 'custom'
  | 'general'
  | 'company';

export interface Channel {
  id: string;
  organisation_id: string;
  project_id: string | null;
  channel_type: ChannelType;
  name: string;
  description: string | null;
  is_archived: boolean;
  visibility: 'company' | 'private';
  join_policy: 'all' | 'invite_only';
  created_at: string;
  updated_at: string;
}

export type MessageType = 'text' | 'photo' | 'file' | 'voice' | 'system' | 'reply';

export interface Message {
  id: string;
  organisation_id: string;
  channel_id: string;
  sender_id: string;
  sender_name?: string | null;
  sender_avatar_url?: string | null;
  parent_message_id: string | null;
  message_type: MessageType;
  content: string;
  metadata: {
    mentions?: string[];
    linked_entities?: unknown[];
    client_msg_id?: string;
    deleted?: boolean;
  };
  client_msg_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface MemberSummary {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

// ── Session / org helpers ────────────────────────────────────────────────────

export interface SessionContext {
  userId: string;
  orgId: string;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from('org_members')
    .select('organisation_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!member?.organisation_id) return null;
  return { userId: user.id, orgId: member.organisation_id };
}

// ── Channels ─────────────────────────────────────────────────────────────────

/** All visible company-level channels + project channels the user can read. */
export async function fetchChannels(orgId: string): Promise<Channel[]> {
  const { data, error } = await supabase
    .from('project_collaboration_channels')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('is_archived', false)
    .order('channel_type', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Channel[];
}

/** Last message per channel, to render previews in the channel list. */
export async function fetchLatestMessageForChannels(
  channelIds: string[],
): Promise<Record<string, Message>> {
  if (channelIds.length === 0) return {};
  const { data, error } = await supabase
    .from('project_collaboration_messages')
    .select('id, channel_id, sender_id, content, message_type, created_at, deleted_at, parent_message_id, metadata, organisation_id, client_msg_id, edited_at')
    .in('channel_id', channelIds)
    .order('created_at', { ascending: false })
    .limit(channelIds.length * 10);
  if (error) throw error;

  const latest: Record<string, Message> = {};
  for (const row of (data ?? []) as Message[]) {
    if (row.deleted_at) continue;
    if (!latest[row.channel_id]) latest[row.channel_id] = row;
  }
  return latest;
}

// ── Messages ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export interface MessagePage {
  items: Message[];
  nextCursor: string | null;
}

/** Page of root messages (parent_message_id IS NULL), newest first. */
export async function fetchMessagesPage(
  channelId: string,
  cursor: string | null,
): Promise<MessagePage> {
  let q = supabase
    .from('project_collaboration_messages')
    .select('*, sender:user_profiles!sender_id(full_name, avatar_url)')
    .eq('channel_id', channelId)
    .is('parent_message_id', null)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) q = q.lt('created_at', cursor);

  const { data, error } = await q;
  if (error) throw error;

  const items = ((data ?? []) as Array<Message & { sender?: { full_name: string | null; avatar_url: string | null } | null }>).map(
    (row) => ({
      ...row,
      sender_name: row.sender?.full_name ?? null,
      sender_avatar_url: row.sender?.avatar_url ?? null,
    }),
  );
  const nextCursor = items.length === PAGE_SIZE ? items[items.length - 1].created_at : null;
  return { items, nextCursor };
}

export async function fetchThread(parentMessageId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('project_collaboration_messages')
    .select('*, sender:user_profiles!sender_id(full_name, avatar_url)')
    .eq('parent_message_id', parentMessageId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Message & { sender?: { full_name: string | null; avatar_url: string | null } | null }>).map(
    (row) => ({
      ...row,
      sender_name: row.sender?.full_name ?? null,
      sender_avatar_url: row.sender?.avatar_url ?? null,
    }),
  );
}

export async function sendMessage(args: {
  channelId: string;
  content: string;
  parentMessageId: string | null;
  clientMsgId: string;
  messageType?: MessageType;
  linkedEntities?: LinkedEntity[];
  mentions?: string[];
}): Promise<Message> {
  const { data, error } = await supabase.rpc('send_collaboration_message', {
    p_channel_id: args.channelId,
    p_content: args.content,
    p_parent_message_id: args.parentMessageId,
    p_message_type: args.messageType ?? 'text',
    p_metadata: {
      client_msg_id: args.clientMsgId,
      ...(args.linkedEntities ? { linked_entities: args.linkedEntities } : {}),
      ...(args.mentions ? { mentions: args.mentions } : {}),
    },
    p_client_msg_id: args.clientMsgId,
  });
  if (error) throw error;
  return data as Message;
}

// ── Task / Reminder actions from a message ─────────────────────────────────

export interface LinkedEntity {
  type:
    | 'task'
    | 'reminder'
    | 'work_order'
    | 'issue'
    | 'daily_report'
    | 'document'
    | 'rfi'
    | 'boq'
    | 'material'
    | 'po'
    | 'quotation';
  id: string;
  label: string;
  snapshot?: Record<string, unknown>;
}

export interface CreateTaskArgs {
  organisationId: string;
  projectId: string | null;
  title: string;
  description?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string | null;
  assigneeIds?: string[];
  checklistTitles?: string[];
  createdBy: string;
}

export interface CreatedTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
}

/**
 * Create an authoritative task (mirrors web useCreateTask) + its checklist,
 * then post the task card message into the channel (post_task_channel_card RPC,
 * idempotent on the server). The task row is the source of truth; the card is
 * best-effort — if it fails the task still exists and realtime will still show it.
 */
export async function createTaskAndPostCard(
  args: CreateTaskArgs & { channelId: string },
): Promise<CreatedTask> {
  const { channelId, ...taskArgs } = args;
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      organisation_id: taskArgs.organisationId,
      project_id: taskArgs.projectId,
      title: taskArgs.title,
      description: taskArgs.description ?? null,
      status: 'not_started',
      priority: taskArgs.priority ?? 'medium',
      task_type: 'task',
      due_date: taskArgs.dueDate ?? null,
      assignee_ids: taskArgs.assigneeIds ?? [],
      completion_percentage: 0,
      is_following: false,
      is_archived: false,
      tags: [],
      created_by: taskArgs.createdBy,
    })
    .select()
    .single();
  if (error) throw error;

  if (taskArgs.checklistTitles && taskArgs.checklistTitles.length > 0) {
    const { error: checklistError } = await supabase
      .from('task_checklist_items')
      .insert(
        taskArgs.checklistTitles.map((title, index) => ({
          task_id: task.id,
          organisation_id: taskArgs.organisationId,
          title,
          sort_order: index,
        })),
      );
    if (checklistError) {
      await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', task.id);
      throw checklistError;
    }
  }

  const { error: cardError } = await supabase.rpc('post_task_channel_card', {
    p_project_id: taskArgs.projectId,
    p_channel_id: channelId,
    p_task_id: task.id,
  });
  if (cardError) console.warn('post_task_channel_card failed:', cardError);

  return task as CreatedTask;
}

/** One-click personal task from a message (appears in the user's My Tasks). */
export async function createPersonalTaskFromMessage(messageId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('create_personal_task_from_message', {
    p_message_id: messageId,
  });
  if (error) throw error;
  return data;
}

export interface CreateReminderArgs {
  messageId: string;
  recipientId?: string | null;
  title: string;
  notes?: string | null;
  remindAt?: string | null;
}

/** Create a reminder from a message. */
export async function createReminderFromMessage(args: CreateReminderArgs): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('create_reminder_from_message', {
    p_message_id: args.messageId,
    p_recipient_id: args.recipientId ?? null,
    p_title: args.title,
    p_notes: args.notes ?? null,
    p_remind_at: args.remindAt ?? null,
  });
  if (error) throw error;
  return data as { id: string };
}

/** Soft-delete own message (mirrors web softDeleteMessage RPC). */
export async function softDeleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_message', {
    p_message_id: messageId,
  });
  if (error) throw error;
}

export async function addReaction(messageId: string, emoji: string): Promise<void> {
  const { error } = await supabase.rpc('add_reaction', {
    p_message_id: messageId,
    p_emoji: emoji,
  });
  if (error) throw error;
}

export async function removeReaction(messageId: string, emoji: string): Promise<void> {
  const { error } = await supabase.rpc('remove_reaction', {
    p_message_id: messageId,
    p_emoji: emoji,
  });
  if (error) throw error;
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

export async function markChannelRead(channelId: string, throughMessageId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_channel_read', {
    p_channel_id: channelId,
    p_through_message_id: throughMessageId,
  });
  if (error) throw error;
}

export async function fetchReadState(
  channelId: string,
  userId: string,
): Promise<{ last_read_message_id: string | null; last_read_at: string } | null> {
  const { data, error } = await supabase
    .from('project_collaboration_read_state')
    .select('last_read_message_id, last_read_at')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Display names/avatars for raw user ids (realtime rows don't carry the join). */
export async function fetchUserProfiles(
  userIds: string[],
): Promise<Record<string, { full_name: string | null; avatar_url: string | null }>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url')
    .in('id', unique);
  if (error) throw error;
  const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
  for (const row of (data ?? []) as any[]) {
    map[row.id] = { full_name: row.full_name ?? null, avatar_url: row.avatar_url ?? null };
  }
  return map;
}

export async function fetchChannelMembers(channelId: string): Promise<MemberSummary[]> {
  const { data, error } = await supabase
    .from('project_collaboration_members')
    .select('user_id, role, user_profiles!inner(full_name, avatar_url)')
    .eq('channel_id', channelId);
  if (error) throw error;

  const seen = new Set<string>();
  const members: MemberSummary[] = [];
  for (const row of (data ?? []) as any[]) {
    if (row.user_id && !seen.has(row.user_id)) {
      seen.add(row.user_id);
      members.push({
        user_id: row.user_id,
        full_name: row.user_profiles?.full_name ?? null,
        avatar_url: row.user_profiles?.avatar_url ?? null,
        role: row.role ?? null,
      });
    }
  }
  return members;
}

// ── Realtime ─────────────────────────────────────────────────────────────────

export interface RealtimeHandlers {
  onMessageInsert: (message: Message) => void;
  onMessageUpdate: (message: Message) => void;
  onMessageDelete: (messageId: string) => void;
  onReactionsChange: () => void;
}

/** Scoped Supabase Realtime subscription for one channel. Returns cleanup. */
export function subscribeToChannel(channelId: string, handlers: RealtimeHandlers) {
  const sub = supabase
    .channel(`collab-mobile:${channelId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'project_collaboration_messages', filter: `channel_id=eq.${channelId}` },
      (payload: any) => handlers.onMessageInsert(payload.new as Message),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'project_collaboration_messages', filter: `channel_id=eq.${channelId}` },
      (payload: any) => handlers.onMessageUpdate(payload.new as Message),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'project_collaboration_messages', filter: `channel_id=eq.${channelId}` },
      (payload: any) => handlers.onMessageDelete((payload.old as { id: string })?.id),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'project_collaboration_reactions' },
      () => handlers.onReactionsChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(sub);
  };
}

// ── Attachments ──────────────────────────────────────────────────────────────

export interface AttachmentRow {
  id: string;
  message_id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  storage_bucket: string;
  storage_path: string;
}

export const COLLAB_ATTACHMENT_BUCKET = 'project-collab-attachments';

/** Sanitized storage path: org/channel/message/timestamp_filename (mirrors web buildAttachmentPath). */
export function buildAttachmentPath(args: {
  organisationId: string;
  channelId: string;
  messageId: string;
  fileName: string;
}): string {
  const safe = args.fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${args.organisationId}/${args.channelId}/${args.messageId}/${Date.now()}_${safe}`;
}

export async function uploadAttachment(bucket: string, path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
}

/** Link an uploaded file to a message (server-trusted RPC). */
export async function addAttachment(args: {
  messageId: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
}): Promise<AttachmentRow> {
  const { data, error } = await supabase.rpc('add_collaboration_attachment', {
    p_message_id: args.messageId,
    p_storage_bucket: args.storageBucket,
    p_storage_path: args.storagePath,
    p_file_name: args.fileName,
    p_file_size: args.fileSize,
    p_mime_type: args.mimeType,
    p_width: null,
    p_height: null,
    p_duration_ms: null,
  });
  if (error) throw error;
  return data as AttachmentRow;
}

export async function fetchAttachmentsForMessages(messageIds: string[]): Promise<AttachmentRow[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabase
    .from('project_collaboration_attachments')
    .select('*')
    .in('message_id', messageIds);
  if (error) throw error;
  return (data ?? []) as AttachmentRow[];
}

/** Temporary private-URL for viewing/downloading an attachment. */
export async function createSignedUrl(bucket: string, path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

// ── Unread counts ────────────────────────────────────────────────────────────

export interface UnreadInfo {
  /** Count of root messages after the user's read waterline. */
  count: number;
  /** Newest message id at/below the waterline — used for markChannelRead. */
  lastReadMessageId: string | null;
}

/**
 * Compute per-channel unread counts in one pass: fetch the user's read state
 * for all channels, then count messages created after the waterline.
 * Simple + correct for mobile page sizes; avoids per-channel RPC round trips.
 */
export async function fetchUnreadCounts(
  _orgId: string,
  userId: string,
  channelIds: string[],
): Promise<Record<string, UnreadInfo>> {
  if (channelIds.length === 0) return {};
  const out: Record<string, UnreadInfo> = {};
  for (const id of channelIds) out[id] = { count: 0, lastReadMessageId: null };

  const { data: states, error } = await supabase
    .from('project_collaboration_read_state')
    .select('channel_id, last_read_message_id, last_read_at')
    .eq('user_id', userId)
    .in('channel_id', channelIds);
  if (error) throw error;

  const waterline = new Map<string, string>();
  for (const s of (states ?? []) as any[]) {
    if (s.channel_id && s.last_read_at) {
      waterline.set(s.channel_id, s.last_read_at);
      if (out[s.channel_id]) out[s.channel_id].lastReadMessageId = s.last_read_message_id ?? null;
    }
  }

  // Fetch messages newer than each channel's waterline (bounded per channel).
  const perChannelLimit = 99;
  await Promise.all(
    [...waterline.entries()].map(async ([channelId, sinceIso]) => {
      const { data, error: qErr } = await supabase
        .from('project_collaboration_messages')
        .select('id', { count: 'exact', head: false })
        .eq('channel_id', channelId)
        .is('parent_message_id', null)
        .gt('created_at', sinceIso)
        .limit(perChannelLimit);
      if (qErr || !data) return;
      if (out[channelId]) out[channelId].count = data.length;
    }),
  );

  // Channels never opened: count recent messages (last 7 days) as unread.
  const neverOpened = channelIds.filter((id) => !waterline.has(id));
  if (neverOpened.length > 0) {
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    await Promise.all(
      neverOpened.map(async (channelId) => {
        const { data, error: qErr } = await supabase
          .from('project_collaboration_messages')
          .select('id')
          .eq('channel_id', channelId)
          .is('parent_message_id', null)
          .gt('created_at', since)
          .limit(perChannelLimit);
        if (qErr || !data) return;
        if (out[channelId]) out[channelId].count = data.length;
      }),
    );
  }

  return out;
}
