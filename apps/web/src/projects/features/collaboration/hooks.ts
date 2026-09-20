// hooks.ts — React Query hooks for Project Collaboration.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import {
  addReaction,
  ensureChannel,
  getOrCreateCompanyChannel,
  fetchCompanyChannels,
  fetchChannelMembers,
  fetchMessagesPage,
  fetchReactionsForMessages,
  fetchReadState,
  fetchThread,
  markChannelRead,
  removeReaction,
  searchMessages,
  sendMessage,
  softDeleteMessage,
  postTaskChannelCard,
  createPersonalTaskFromMessage,
  createReminderFromMessage,
  toggleReminderStatus,
  createCompanyChannel,
  fetchOrgMemberEmails,
  fetchChannelInvitations,
  clearChannelMessages,
  leaveChannel,
  archiveChannel,
  type MessagePage,
  type CreateCompanyChannelArgs,
} from './api';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useCollabStore } from './store';
import type { Message, MessageDraft } from './types';
import { MessageDraftSchema } from './schemas';

const KEY = {
  channel: (projectId: string) => ['collab', 'channel', projectId] as const,
  companyChannel: (orgId: string, name: string) => ['collab', 'company-channel', orgId, name] as const,
  companyChannels: (orgId: string) => ['collab', 'company-channels', orgId] as const,
  orgMemberEmails: (orgId: string) => ['collab', 'org-member-emails', orgId] as const,
  channelInvitations: (channelId: string) => ['collab', 'channel-invitations', channelId] as const,
  messages: (channelId: string) => ['collab', 'messages', channelId] as const,
  thread: (parentId: string) => ['collab', 'thread', parentId] as const,
  reactions: (messageIds: string[]) => ['collab', 'reactions', messageIds.slice().sort().join(',')] as const,
  readState: (channelId: string, userId: string) => ['collab', 'read', channelId, userId] as const,
  search: (channelId: string, term: string) => ['collab', 'search', channelId, term] as const,
};

/** Ensures the project's primary channel exists. Auto-runs on mount. */
export function useEnsureChannel(projectId: string | null | undefined) {
  return useQuery({
    queryKey: projectId ? KEY.channel(projectId) : ['collab', 'channel', 'idle'],
    queryFn: () => ensureChannel(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Ensures the organisation's primary company channel exists (e.g. #general). */
export function useCompanyChannel(orgId: string | null | undefined, name: string = 'general') {
  return useQuery({
    queryKey: orgId ? KEY.companyChannel(orgId, name) : ['collab', 'company-channel', 'idle'],
    queryFn: () => getOrCreateCompanyChannel(orgId!, name),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Lists all company-wide channels for an organisation. */
export function useCompanyChannels(orgId: string | null | undefined) {
  return useQuery({
    queryKey: orgId ? KEY.companyChannels(orgId) : ['collab', 'company-channels', 'idle'],
    queryFn: () => fetchCompanyChannels(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Colleagues (name + email) of the organisation, for the invite picker.
 * Deliberately a separate query from the message flow: it is only fetched when
 * the create-channel dialog is open.
 */
export function useOrgMemberEmails(orgId: string | null | undefined) {
  return useQuery({
    queryKey: orgId ? KEY.orgMemberEmails(orgId) : ['collab', 'org-member-emails', 'idle'],
    queryFn: () => fetchOrgMemberEmails(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Invitations recorded on a channel. */
export function useChannelInvitations(channelId: string | null | undefined) {
  return useQuery({
    queryKey: channelId ? KEY.channelInvitations(channelId) : ['collab', 'channel-invitations', 'idle'],
    queryFn: () => fetchChannelInvitations(channelId!),
    enabled: !!channelId,
    staleTime: 60 * 1000,
  });
}

/** Creates a company channel and refreshes the rail + that channel's entry. */
export function useCreateCompanyChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateCompanyChannelArgs) => createCompanyChannel(args),
    onSuccess: (channel) => {
      qc.invalidateQueries({ queryKey: ['collab', 'company-channels', channel.organisation_id] });
      qc.invalidateQueries({ queryKey: ['collab', 'rail'] });
      qc.setQueryData(KEY.companyChannel(channel.organisation_id, channel.name), channel);
    },
  });
}

/** Cursor-paginated root messages, newest first. */
export function useMessages(channelId: string | null | undefined) {
  return useInfiniteQuery<MessagePage>({
    queryKey: channelId ? KEY.messages(channelId) : ['collab', 'messages', 'idle'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchMessagesPage(channelId!, (pageParam as string | null) ?? null),
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!channelId,
    staleTime: 30 * 1000,
  });
}

export function useThread(parentMessageId: string | null | undefined) {
  return useQuery<Message[]>({
    queryKey: parentMessageId ? KEY.thread(parentMessageId) : ['collab', 'thread', 'idle'],
    queryFn: () => fetchThread(parentMessageId!),
    enabled: !!parentMessageId,
    staleTime: 30 * 1000,
  });
}

export function useReactions(messageIds: string[]) {
  const stable = useMemo(() => messageIds, [messageIds.join(',')]);
  return useQuery({
    queryKey: KEY.reactions(stable),
    queryFn: () => fetchReactionsForMessages(stable),
    enabled: stable.length > 0,
    staleTime: 15 * 1000,
  });
}

export function useReadState(channelId: string | null | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: channelId && userId ? KEY.readState(channelId, userId) : ['collab', 'read', 'idle'],
    queryFn: () => fetchReadState(channelId!, userId),
    enabled: !!channelId && !!userId,
    staleTime: 30 * 1000,
  });
}

/** Channel members with display names. Used to render sender labels in messages. */
export function useChannelMembers(channelId: string | null | undefined) {
  return useQuery({
    queryKey: channelId ? ['collab', 'members', channelId] : ['collab', 'members', 'idle'],
    queryFn: () => fetchChannelMembers(channelId!),
    enabled: !!channelId,
    staleTime: 5 * 60 * 1000,
  });
}
export function useMarkRead(channelId: string | null | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => markChannelRead(channelId!, messageId),
    onSuccess: (_, messageId) => {
      if (channelId && user?.id) {
        qc.setQueryData(KEY.readState(channelId, user.id), (old: any) => ({
          ...(old ?? {}),
          channel_id: channelId,
          user_id: user.id,
          last_read_message_id: messageId,
          last_read_at: new Date().toISOString(),
        }));
      }
    },
  });
}

export function useSendMessage(channelId: string | null | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (rawDraft: unknown) => {
      const draft = MessageDraftSchema.parse(rawDraft) as MessageDraft;
      if (!channelId) throw new Error('no_channel');
      const metadata = {
        mentions: draft.mentions ?? [],
        linked_entities: draft.linkedEntities ?? [],
        client_msg_id: undefined,
      };
      return sendMessage({
        channelId,
        content: draft.text,
        parentMessageId: draft.parentMessageId ?? null,
        metadata,
        clientMsgId: crypto.randomUUID(),
      });
    },
    // onMutate: optimistic insert by client_msg_id
    onMutate: async (rawDraft) => {
      if (!channelId || !user?.id) return;
      const draft = MessageDraftSchema.parse(rawDraft) as MessageDraft;
      const clientMsgId = crypto.randomUUID();
      const optimistic: Message = {
        id: `optimistic:${clientMsgId}`,
        organisation_id: '',
        channel_id: channelId,
        sender_id: user.id,
        parent_message_id: draft.parentMessageId ?? null,
        message_type: 'text',
        content: draft.text,
        metadata: {
          mentions: draft.mentions ?? [],
          linked_entities: draft.linkedEntities ?? [],
          client_msg_id: clientMsgId,
        },
        client_msg_id: clientMsgId,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
      };
      await qc.cancelQueries({ queryKey: KEY.messages(channelId) });
      qc.setQueryData<{ pages: MessagePage[]; pageParams: (string | null)[] }>(
        KEY.messages(channelId),
        (old) => {
          if (!old) return old;
          const first = old.pages[0] ?? { items: [], nextCursor: null };
          return {
            ...old,
            pages: [{ items: [optimistic, ...first.items], nextCursor: first.nextCursor }, ...old.pages.slice(1)],
            pageParams: old.pageParams,
          };
        },
      );
      return { clientMsgId };
    },
    onSuccess: (saved, _vars, ctx) => {
      if (!channelId) return;
      qc.setQueryData<{ pages: MessagePage[]; pageParams: (string | null)[] }>(
        KEY.messages(channelId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              items: p.items.map((m) =>
                m.id === `optimistic:${ctx?.clientMsgId}` ? saved : m,
              ),
            })),
            pageParams: old.pageParams,
          };
        },
      );
    },
    onError: () => {
      // Optimistic placeholder stays; realtime echo or manual refetch will replace.
      // Draft text is preserved in the Zustand store so the user does not lose input.
    },
  });
}

export function useAddReaction(channelId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      addReaction(messageId, emoji),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collab', 'reactions'] });
    },
  });
}

export function useRemoveReaction(channelId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      removeReaction(messageId, emoji),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collab', 'reactions'] });
    },
  });
}

export function useDeleteMessage(channelId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => softDeleteMessage(messageId),
    onSuccess: () => {
      if (channelId) qc.invalidateQueries({ queryKey: KEY.messages(channelId) });
    },
  });
}

export function useSearchMessages(channelId: string | null | undefined, term: string) {
  return useQuery({
    queryKey: channelId ? KEY.search(channelId, term) : ['collab', 'search', 'idle'],
    queryFn: () => searchMessages(channelId!, term),
    enabled: !!channelId && term.length > 0,
    staleTime: 10 * 1000,
  });
}

/** Mark messages read up to a given message when they scroll into view. */
export function useAutoMarkRead(
  channelId: string | null | undefined,
  visibleLastMessageId: string | null | undefined,
) {
  const { user } = useAuth();
  const mark = useMarkRead(channelId);
  const lastMarkedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!channelId || !visibleLastMessageId || !user?.id) return;
    if (lastMarkedRef.current === visibleLastMessageId) return;
    lastMarkedRef.current = visibleLastMessageId;
    mark.mutate(visibleLastMessageId);
    // intentionally not including `mark` in deps to avoid loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, visibleLastMessageId, user?.id]);
}

/** Post task card into collaboration channel. */
export function usePostTaskChannelCard(channelId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, taskId }: { projectId?: string | null; taskId: string }) => {
      if (!channelId) throw new Error('Channel ID is required');
      return postTaskChannelCard(projectId ?? null, channelId, taskId);
    },
    onSuccess: () => {
      if (channelId) qc.invalidateQueries({ queryKey: KEY.messages(channelId) });
    },
  });
}

/** One-click create personal task from collaboration message. */
export function useCreatePersonalTaskFromMessage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (messageId: string) => createPersonalTaskFromMessage(messageId),
    onSuccess: () => {
      if (user?.id) qc.invalidateQueries({ queryKey: ['collab', 'personal-tasks', user.id] });
    },
  });
}

/** Create reminder from collaboration message. */
export function useCreateReminderFromMessage(channelId?: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (args: {
      messageId: string;
      recipientId?: string | null;
      title: string;
      notes?: string | null;
      remindAt?: string | null;
    }) => createReminderFromMessage(args),
    onSuccess: () => {
      if (user?.id) qc.invalidateQueries({ queryKey: ['collab', 'reminders', user.id] });
      if (channelId) qc.invalidateQueries({ queryKey: KEY.messages(channelId) });
    },
  });
}

/** Toggle reminder status. */
export function useToggleReminderStatus() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({
      reminderId,
      status,
    }: {
      reminderId: string;
      status: 'pending' | 'completed' | 'dismissed';
    }) => toggleReminderStatus(reminderId, status),
    onSuccess: () => {
      if (user?.id) qc.invalidateQueries({ queryKey: ['collab', 'reminders', user.id] });
    },
  });
}

/** Fetch personal tasks for the current authenticated user. */
export function usePersonalTasks() {
  const { user, organisation } = useAuth();
  return useQuery({
    queryKey: ['collab', 'personal-tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('personal_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('is_completed', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!organisation?.id,
  });
}

/** Toggle personal task completion. */
export function useTogglePersonalTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      const { data, error } = await supabase.rpc('toggle_personal_task', {
        p_task_id: taskId,
        p_is_completed: isCompleted,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (user?.id) qc.invalidateQueries({ queryKey: ['collab', 'personal-tasks', user.id] });
    },
  });
}

/** Fetch task reminders for the current user. */
export function useTaskReminders() {
  const { user, organisation } = useAuth();
  return useQuery({
    queryKey: ['collab', 'reminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('task_reminders')
        .select('*')
        .or(`user_id.eq.${user.id},created_by.eq.${user.id}`)
        .order('status', { ascending: true })
        .order('remind_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!organisation?.id,
  });
}

// ============================================================================
// Channel Management Hooks
// ============================================================================

/** Clear all messages in a channel. Admin/owner only. */
export function useClearChannelMessages(channelId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearChannelMessages(channelId!),
    onSuccess: () => {
      if (channelId) qc.invalidateQueries({ queryKey: KEY.messages(channelId) });
    },
  });
}

/** Leave a channel. Cannot leave if you're the only owner. */
export function useLeaveChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => leaveChannel(channelId),
    onSuccess: () => {
      // Invalidate all channel-related queries
      qc.invalidateQueries({ queryKey: ['collab'] });
    },
  });
}

/** Archive/delete a channel. Owner only. */
export function useArchiveChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => archiveChannel(channelId),
    onSuccess: () => {
      // Invalidate all channel-related queries
      qc.invalidateQueries({ queryKey: ['collab'] });
    },
  });
}
