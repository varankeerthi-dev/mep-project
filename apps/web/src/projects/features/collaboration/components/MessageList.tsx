// MessageList.tsx — virtualized list of root messages with infinite scroll.
import { useEffect, useMemo, useRef } from 'react';
import { useChannelMembers, useMessages, useReactions, useReadState, useAutoMarkRead } from '../hooks';
import { MessageBubble } from './MessageBubble';
import { ThreadSummary } from './ThreadSummary';
import { groupConsecutive, isOptimisticId } from '../utils';
import { Loader2 } from 'lucide-react';

interface Props {
  channelId: string;
}
export function MessageList({ channelId }: Props) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(channelId);

  const flat = (data?.pages.flatMap((p) => p.items) ?? []).filter((m) => !m.deleted_at || isOptimisticId(m.id));
  const ids = flat.map((m) => m.id);
  const reactions = useReactions(ids);
  const readState = useReadState(channelId);
  const membersQuery = useChannelMembers(channelId);
  const senderNames = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of membersQuery.data ?? []) map.set(m.user_id, m.full_name);
    return map;
  }, [membersQuery.data]);

  // Group consecutive same-sender messages for visual grouping.
  const groups = groupConsecutive(flat, (m) => m.sender_id);
  const lastReadId = readState.data?.last_read_message_id ?? null;
  const lastUnread = flat.find((m) => m.id !== lastReadId && !isOptimisticId(m.id));
  useAutoMarkRead(channelId, lastUnread?.id ?? null);

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

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="collab-message-list">
      {groups.map((group, gi) => (
        <div key={`g-${gi}`} className="space-y-1">
          {group.map((m) => (
            <div key={m.id}>
              <MessageBubble
                message={m}
                reactions={reactions.data ?? []}
                senderName={senderNames.get(m.sender_id) ?? null}
              />
              <ThreadSummary messageId={m.id} channelId={channelId} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
