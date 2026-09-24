// api.ts — Supabase RPC + query wrappers for Project Collaboration.
import { supabase } from '../../../supabase';
import { SendMessageRpcSchema } from './schemas';
import type {
  Attachment,
  Channel,
  ChannelInvitation,
  ChannelJoinPolicy,
  ChannelVisibility,
  Message,
  OrgMemberContact,
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

/** Idempotently resolve or create a company-wide channel (#general). */
export async function getOrCreateCompanyChannel(
  organisationId: string,
  channelName: string = 'general',
): Promise<Channel> {
  const { data, error } = await supabase.rpc('get_or_create_company_channel', {
    p_organisation_id: organisationId,
    p_channel_name: channelName,
  });
  if (error) throw error;
  return data as Channel;
}

/** Fetch all company-level channels (project_id IS NULL). */
export async function fetchCompanyChannels(organisationId: string): Promise<Channel[]> {
  const { data, error } = await supabase
    .from('project_collaboration_channels')
    .select('*')
    .eq('organisation_id', organisationId)
    .is('project_id', null)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Channel[];
}

export interface CreateCompanyChannelArgs {
  organisationId: string;
  name: string;
  description?: string | null;
  visibility: ChannelVisibility;
  joinPolicy: ChannelJoinPolicy;
  inviteEmails?: string[];
}

/**
 * Create a company channel. The server enforces the organization boundary, the
 * separator/case-insensitive name uniqueness, the visibility model and the
 * invitations, so callers cannot bypass any of it.
 */
export async function createCompanyChannel(args: CreateCompanyChannelArgs): Promise<Channel> {
  const { data, error } = await supabase.rpc('create_company_channel', {
    p_organisation_id: args.organisationId,
    p_name: args.name,
    p_description: args.description ?? null,
    p_visibility: args.visibility,
    p_join_policy: args.joinPolicy,
    p_invite_emails: args.inviteEmails ?? [],
  });
  if (error) throw error;
  return data as Channel;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const asEmail = (raw: unknown): string => String(raw ?? '').trim().toLowerCase();

/**
 * The organisation's address book for the invite picker: app users plus the HR
 * employee roster.
 *
 * Three sources, joined here because none of them has a usable FK chain:
 *   * org_members      — who belongs to the organisation
 *   * user_profiles    — name + avatar for those users (its organisation_id is
 *                        not reliably populated, so membership decides)
 *   * employees       — the HR roster, including people who have no login; their
 *                        address comes from whichever of work/personal e-mail the
 *                        record is set to sign in with
 * Addresses are de-duplicated, so someone who is both a user and an employee
 * appears once, enriched with both ids.
 */
export async function fetchOrgMemberEmails(organisationId: string): Promise<OrgMemberContact[]> {
  if (!organisationId) return [];

  const [membersRes, profilesRes, employeesRes] = await Promise.all([
    supabase.from('org_members').select('user_id').eq('organisation_id', organisationId),
    supabase
      .from('user_profiles')
      .select('user_id, email, full_name, avatar_url')
      .not('email', 'is', null),
    supabase
      .from('employees')
      .select('id, name, email, work_email, personal_email, login_email_type, status')
      .eq('organisation_id', organisationId),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const memberIds = new Set((membersRes.data ?? []).map((m: any) => m.user_id));
  const byEmail = new Map<string, OrgMemberContact>();

  // 1. App users — they bring the profile name and avatar.
  for (const row of (profilesRes.data ?? []) as any[]) {
    const email = asEmail(row.email);
    if (!EMAIL_RE.test(email) || !memberIds.has(row.user_id) || byEmail.has(email)) continue;
    byEmail.set(email, {
      user_id: row.user_id,
      employee_id: null,
      email,
      full_name: row.full_name ?? null,
      avatar_url: row.avatar_url ?? null,
      source: 'user',
    });
  }

  // 2. HR roster — adds the people who never signed in, and flags the overlaps.
  // A roster read failing (table absent, no rights) just means users-only.
  for (const row of (employeesRes.data ?? []) as any[]) {
    if (row.status && String(row.status).toLowerCase() !== 'active') continue;

    const preferred =
      String(row.login_email_type ?? 'work').toLowerCase() === 'personal'
        ? row.personal_email
        : row.work_email;

    for (const candidate of [preferred, row.work_email, row.personal_email, row.email]) {
      const email = asEmail(candidate);
      if (!EMAIL_RE.test(email)) continue;
      const existing = byEmail.get(email);
      byEmail.set(email, {
        user_id: existing?.user_id ?? null,
        employee_id: row.id,
        email,
        full_name: existing?.full_name ?? row.name ?? null,
        avatar_url: existing?.avatar_url ?? null,
        source: 'employee',
      });
      break;
    }
  }

  return [...byEmail.values()].sort((a, b) =>
    (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
  );
}

/** Invitations recorded for a channel (RLS: inviter, invitee or channel admin). */
export async function fetchChannelInvitations(channelId: string): Promise<ChannelInvitation[]> {
  const { data, error } = await supabase
    .from('channel_invitations')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChannelInvitation[];
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
  if (Boolean((import.meta as any)?.env?.DEV)) {
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
  role: string | null;
}

/** Resolve sender display names for a channel. Joins project_collaboration_members → user_profiles. */
export async function fetchChannelMembers(channelId: string): Promise<MemberSummary[]> {
  const { data } = await supabase
    .from('project_collaboration_members')
    .select('user_id, role, user_profiles!inner(full_name, avatar_url)')
    .eq('channel_id', channelId);

  const seen = new Set<string>();
  const members: MemberSummary[] = [];

  for (const row of (data ?? []) as any[]) {
    if (row.user_id && !seen.has(row.user_id)) {
      seen.add(row.user_id);
      members.push({
        user_id: row.user_id,
        full_name: row.user_profiles?.full_name ?? null,
        email: null,
        avatar_url: row.user_profiles?.avatar_url ?? null,
        role: row.role ?? null,
      });
    }
  }

  if (members.length > 0) return members;

  // Fallback to active organization user profiles
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url')
    .not('full_name', 'is', null)
    .limit(30);

  return (profiles ?? []).map((p: any) => ({
    user_id: p.id,
    full_name: p.full_name,
    email: null,
    avatar_url: p.avatar_url ?? null,
    role: null,
  }));
}

/** Post (or retrieve, idempotently) the quotation card message in the project's channel. */
export async function postQuotationChannelCard(
  quotationId: string,
  event: 'created' | 'submitted' | 'approved' | 'rejected' | 'returned',
): Promise<{ message_id: string; channel_id: string }> {
  const { data, error } = await supabase.rpc('post_quotation_channel_card', {
    p_quotation_id: quotationId,
    p_event: event,
  });
  if (error) throw error;
  return data as { message_id: string; channel_id: string };
}

/** Post or retrieve the authoritative task card in a collaboration channel. */
export async function postTaskChannelCard(
  projectId: string | null | undefined,
  channelId: string,
  taskId: string,
): Promise<Message> {
  const { data, error } = await supabase.rpc('post_task_channel_card', {
    p_project_id: projectId ?? null,
    p_channel_id: channelId,
    p_task_id: taskId,
  });
  if (error) throw error;
  return data as Message;
}

/** One-click create personal task from message. */
export async function createPersonalTaskFromMessage(messageId: string): Promise<any> {
  const { data, error } = await supabase.rpc('create_personal_task_from_message', {
    p_message_id: messageId,
  });
  if (error) throw error;
  return data;
}

/** Create reminder from message. */
export async function createReminderFromMessage(args: {
  messageId: string;
  recipientId?: string | null;
  title: string;
  notes?: string | null;
  remindAt?: string | null;
}): Promise<any> {
  const { data, error } = await supabase.rpc('create_reminder_from_message', {
    p_message_id: args.messageId,
    p_recipient_id: args.recipientId ?? null,
    p_title: args.title,
    p_notes: args.notes ?? null,
    p_remind_at: args.remindAt ?? null,
  });
  if (error) throw error;
  return data;
}

/** Toggle reminder completion status. */
export async function toggleReminderStatus(
  reminderId: string,
  status: 'pending' | 'completed' | 'dismissed',
): Promise<any> {
  const { data, error } = await supabase.rpc('toggle_reminder_status', {
    p_reminder_id: reminderId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

// ============================================================================
// Channel Management RPCs
// ============================================================================

/**
 * Clear all messages in a channel. Admin/owner only.
 * This is a destructive action that cannot be undone.
 */
export async function clearChannelMessages(channelId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_channel_messages', {
    p_channel_id: channelId,
  });
  if (error) throw error;
}

/**
 * Leave a channel. Cannot leave if you're the only owner.
 */
export async function leaveChannel(channelId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_channel', {
    p_channel_id: channelId,
  });
  if (error) throw error;
}

/**
 * Archive/delete a channel. Owner only.
 */
export async function archiveChannel(channelId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_channel', {
    p_channel_id: channelId,
  });
  if (error) throw error;
}
