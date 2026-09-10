// useRealtimeChannel.ts — scoped Supabase Realtime subscription for a channel.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import type { Message, Reaction } from './types';

/**
 * Subscribes to messages + reactions for one channel and reconciles them
 * into the React Query cache. Idempotent: matching optimistic placeholders
 * (id = "optimistic:<clientMsgId>") are replaced by the server row by
 * client_msg_id.
 */
export function useRealtimeChannel(channelId: string | null | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!channelId) return;
    const sub = supabase
      .channel(`collab:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_collaboration_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const m = payload.new as Message;
          qc.setQueryData<{ pages: { items: Message[]; nextCursor: string | null }[]; pageParams: (string | null)[] }>(
            ['collab', 'messages', channelId],
            (old) => {
              if (!old) return old;
              // Replace optimistic placeholder if any.
              const cmid = m.client_msg_id;
              let replaced = false;
              const pages = old.pages.map((p) => ({
                ...p,
                items: p.items.map((existing) => {
                  if (
                    cmid &&
                    existing.id.startsWith('optimistic:') &&
                    existing.client_msg_id === cmid
                  ) {
                    replaced = true;
                    return m;
                  }
                  return existing;
                }),
              }));
              if (replaced) return { ...old, pages };
              // Otherwise prepend if not already present.
              const first = pages[0] ?? { items: [], nextCursor: null };
              if (first.items.some((x) => x.id === m.id)) return old;
              return { ...old, pages: [{ ...first, items: [m, ...first.items] }, ...pages.slice(1)] };
            },
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'project_collaboration_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const m = payload.new as Message;
          qc.setQueryData<{ pages: { items: Message[]; nextCursor: string | null }[]; pageParams: (string | null)[] }>(
            ['collab', 'messages', channelId],
            (old) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((p) => ({
                  ...p,
                  items: p.items.map((x) => (x.id === m.id ? m : x)),
                })),
              };
            },
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'project_collaboration_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const old = payload.old as { id: string };
          qc.setQueryData<{ pages: { items: Message[]; nextCursor: string | null }[]; pageParams: (string | null)[] }>(
            ['collab', 'messages', channelId],
            (curr) => {
              if (!curr) return curr;
              return {
                ...curr,
                pages: curr.pages.map((p) => ({
                  ...p,
                  items: p.items.filter((m) => m.id !== old.id),
                })),
              };
            },
          );
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_collaboration_reactions' },
        () => {
          // Reactions are message-scoped, but we don't know the message_id
          // here. Invalidate the reactions cache for this channel; the hook
          // is short-lived and re-runs on viewport changes.
          qc.invalidateQueries({ queryKey: ['collab', 'reactions'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [channelId, qc]);
}

/** Type re-export so the hook file is self-contained. */
export type { Message, Reaction };
