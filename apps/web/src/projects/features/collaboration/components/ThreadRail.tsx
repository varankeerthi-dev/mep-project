// ThreadRail.tsx — always-on right rail. Shows the open thread or a hint.
import { X, MessageSquare } from 'lucide-react';
import { useCollabStore } from '../store';
import { useThread, useReactions, useChannelMembers } from '../hooks';
import { useMemo } from 'react';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { Loader2 } from 'lucide-react';

interface Props {
  channelId: string;
}

export function ThreadRail({ channelId }: Props) {
  const openThreadId = useCollabStore((s) => s.openThreadId);
  const setOpen = useCollabStore((s) => s.setOpenThread);
  const thread = useThread(openThreadId);
  const ids = (thread.data ?? []).map((m) => m.id);
  const reactions = useReactions(ids);
  const membersQuery = useChannelMembers(channelId);
  const senderNames = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of membersQuery.data ?? []) map.set(m.user_id, m.full_name);
    return map;
  }, [membersQuery.data]);

  if (!openThreadId) {
    return (
      <aside
        className="w-80 shrink-0 border-l bg-white flex flex-col h-full"
        data-testid="collab-thread-rail-empty"
      >
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold">Thread</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-center px-6 text-sm text-gray-500">
          Select a message's thread to view it here.
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="w-80 shrink-0 border-l bg-white flex flex-col h-full"
      data-testid="collab-thread-rail"
    >
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold">Thread</h3>
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="p-1 text-gray-500 hover:text-gray-800"
          aria-label="Close thread"
          title="Close thread"
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
            reactions={reactions.data ?? []}
            senderName={senderNames.get(m.sender_id) ?? null}
          />
        ))}
      </div>

      <Composer channelId={channelId} parentMessageId={openThreadId} />
    </aside>
  );
}
