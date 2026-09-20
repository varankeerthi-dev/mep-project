// ThreadPane.tsx — slide-over pane that shows one thread + a composer.
import { X, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useCollabStore } from '../store';
import { useChannelMembers, useThread, useReactions } from '../hooks';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';

interface Props {
  channelId: string;
}

export function ThreadPane({ channelId }: Props) {
  const openThreadId = useCollabStore((s) => s.openThreadId);
  const setOpen = useCollabStore((s) => s.setOpenThread);
  const thread = useThread(openThreadId);
  const ids = (thread.data ?? []).map((m) => m.id);
  const reactions = useReactions(ids);
  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, typeof reactions.data>();
    for (const r of reactions.data ?? []) {
      const arr = map.get(r.message_id) ?? [];
      arr.push(r);
      map.set(r.message_id, arr);
    }
    return map;
  }, [reactions.data]);
  const membersQuery = useChannelMembers(channelId);
  const sendersMap = useMemo(() => {
    const map = new Map<string, { name: string | null; avatarUrl: string | null }>();
    for (const m of membersQuery.data ?? []) {
      map.set(m.user_id, { name: m.full_name, avatarUrl: m.avatar_url });
    }
    return map;
  }, [membersQuery.data]);

  if (!openThreadId) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white border-l shadow-xl z-30 flex flex-col"
      data-testid="collab-thread-pane"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="font-semibold text-sm">Thread</h3>
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="p-1 text-gray-500 hover:text-gray-800"
          aria-label="Close thread"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {thread.isLoading && (
          <div className="text-center text-gray-400 text-sm py-6">
            <Loader2 className="h-4 w-4 animate-spin inline" /> Loading…
          </div>
        )}
        {(thread.data ?? []).map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            reactions={reactionsByMessageId.get(m.id) ?? []}
            senderName={sendersMap.get(m.sender_id)?.name ?? m.sender_name ?? null}
            senderAvatarUrl={sendersMap.get(m.sender_id)?.avatarUrl ?? m.sender_avatar_url ?? null}
          />
        ))}
      </div>

      <Composer channelId={channelId} parentMessageId={openThreadId} />
    </div>
  );
}
