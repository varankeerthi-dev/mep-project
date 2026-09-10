// hooks.ts — React Query hooks for Project Collaboration.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import {
  addReaction,
  ensureChannel,
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
  type MessagePage,
} from './api';
import { useAuth } from '../../../contexts/AuthContext';
import { useCollabStore } from './store';
import type { Message, MessageDraft } from './types';
import { MessageDraftSchema } from './schemas';

const KEY = {
  channel: (projectId: string) => ['collab', 'channel', projectId] as const,
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
    onSuccess: () => {
      if (channelId && user?.id) {
        qc.invalidateQueries({ queryKey: KEY.readState(channelId, user.id) });
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

export function useAddReaction(channelId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      addReaction(messageId, emoji),
    onSuccess: () => {
      if (channelId) qc.invalidateQueries({ queryKey: ['collab', 'reactions'] });
    },
  });
}

export function useRemoveReaction(channelId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      removeReaction(messageId, emoji),
    onSuccess: () => {
      if (channelId) qc.invalidateQueries({ queryKey: ['collab', 'reactions'] });
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
  useEffect(() => {
    if (!channelId || !visibleLastMessageId || !user?.id) return;
    mark.mutate(visibleLastMessageId);
    // intentionally not including `mark` in deps to avoid loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, visibleLastMessageId, user?.id]);
}
