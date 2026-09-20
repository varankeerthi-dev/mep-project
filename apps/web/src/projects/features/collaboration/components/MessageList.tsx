// MessageList.tsx — virtualized list of root messages with infinite scroll.
import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useCollabStore } from '../store';
import { useChannelMembers, useMessages, useReactions, useReadState, useAutoMarkRead } from '../hooks';
import { MessageBubble } from './MessageBubble';
import { ThreadSummary } from './ThreadSummary';
import { groupConsecutive, isOptimisticId } from '../utils';
import type { Reaction } from '../types';
import { Loader2 } from 'lucide-react';

interface Props {
  channelId: string;
}
export function MessageList({ channelId }: Props) {
  const { user } = useAuth();
  const filter = useCollabStore((s) => s.filter);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(channelId);

  const flatRaw = useMemo(() => {
    return (data?.pages.flatMap((p) => p.items) ?? []).filter((m) => !m.deleted_at || isOptimisticId(m.id));
  }, [data?.pages]);

  const readState = useReadState(channelId);
  const lastReadId = readState.data?.last_read_message_id ?? null;

  const flat = useMemo(() => {
    if (filter === 'all') return flatRaw;
    if (filter === 'unread') {
      if (!lastReadId) return flatRaw;
      const idx = flatRaw.findIndex((m) => m.id === lastReadId);
      return idx === -1 ? flatRaw : flatRaw.slice(0, idx);
    }
    if (filter === 'mentions') {
      return flatRaw.filter((m) => {
        const mentions = m.metadata?.mentions ?? [];
        return (user?.id && mentions.includes(user.id)) || m.content.includes('@');
      });
    }
    if (filter === 'files') {
      return flatRaw.filter((m) => m.message_type === 'file' || (m.metadata?.linked_entities?.some(e => e.type === 'document')));
    }
    if (filter === 'photos') {
      return flatRaw.filter((m) => m.message_type === 'photo');
    }
    return flatRaw;
  }, [flatRaw, filter, lastReadId, user?.id]);

  const scrolledToMessageId = useCollabStore((s) => s.scrolledToMessageId);
  const setScrolledToMessageId = useCollabStore((s) => s.setScrolledToMessageId);

  const ids = useMemo(() => flat.map((m) => m.id), [flat]);
  const reactions = useReactions(ids);
  const membersQuery = useChannelMembers(channelId);
  const sendersMap = useMemo(() => {
    const map = new Map<string, { name: string | null; avatarUrl: string | null }>();
    for (const m of membersQuery.data ?? []) {
      map.set(m.user_id, { name: m.full_name, avatarUrl: m.avatar_url });
    }
    return map;
  }, [membersQuery.data]);

  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const r of reactions.data ?? []) {
      const arr = map.get(r.message_id) ?? [];
      arr.push(r);
      map.set(r.message_id, arr);
    }
    return map;
  }, [reactions.data]);

  // Group consecutive same-sender messages for visual grouping.
  const groups = useMemo(() => groupConsecutive(flat, (m) => m.sender_id), [flat]);

  // The latest non-optimistic message in the channel represents the read waterline.
  const latestMessage = flatRaw[0] ?? null;
  const isLatestAlreadyRead = latestMessage ? latestMessage.id === lastReadId : true;
  const unreadWaterlineId = !isLatestAlreadyRead && latestMessage && !isOptimisticId(latestMessage.id)
    ? latestMessage.id
    : null;

  useAutoMarkRead(channelId, unreadWaterlineId);

  // Scroll to a message when search jumps to it.
  useEffect(() => {
    if (!scrolledToMessageId) return;
    const el = document.querySelector(
      `[data-testid="collab-msg"][data-message-id="${scrolledToMessageId}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight
      el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-1');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-1');
        setScrolledToMessageId(null);
      }, 2000);
    } else {
      setScrolledToMessageId(null);
    }
  }, [scrolledToMessageId, setScrolledToMessageId]);

  // Infinite scroll sentinel: when it enters the viewport, fetch older page.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        fetchNextPage();
      }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (flat.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-gray-400 p-6 text-center">
        {filter !== 'all' ? `No messages found matching "${filter}".` : 'No messages yet. Send a message to start the conversation!'}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="collab-message-list">
      {groups.map((group, gi) => (
        <div key={`g-${gi}`} className="space-y-1">
          {group.map((m) => (
            <div key={m.id}>
              <MessageBubble
                message={m}
                reactions={reactionsByMessageId.get(m.id) ?? []}
                senderName={sendersMap.get(m.sender_id)?.name ?? m.sender_name ?? null}
                senderAvatarUrl={sendersMap.get(m.sender_id)?.avatarUrl ?? m.sender_avatar_url ?? null}
              />
              <ThreadSummary messageId={m.id} channelId={channelId} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
