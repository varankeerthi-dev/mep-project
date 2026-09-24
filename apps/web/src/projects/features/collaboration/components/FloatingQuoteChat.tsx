// FloatingQuoteChat.tsx - Gmail/FB-style floating chat bubble for the quote-linked
// project channel. Mounted on quotation create/edit/view pages so channel comments
// and threads stay visible while working on the quote. Quote-linked only: renders
// nothing when there is no projectId.
import { useState } from 'react';
import { MessageCircle, ArrowLeft, Loader2, X } from 'lucide-react';
import { ProjectCollaborationTab } from './ProjectCollaborationTab';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { useCollabStore } from '../store';
import { useEnsureChannel, useThread, useReactions, useChannelMembers } from '../hooks';

export function FloatingQuoteChat({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const openThreadId = useCollabStore((s) => s.openThreadId);
  const channelQuery = useEnsureChannel(open ? projectId : null);
  const channelId = channelQuery.data?.id ?? null;

  if (!projectId) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open project chat"
          className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-xl hover:bg-[#1D4ED8] transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[540px] w-[384px] max-h-[calc(100vh-120px)] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-2xl">
          {openThreadId && channelId ? (
            <PopupThread channelId={channelId} onClose={() => setOpen(false)} />
          ) : (
            <ProjectCollaborationTab projectId={projectId} onClose={() => setOpen(false)} />
          )}
        </div>
      )}
    </>
  );
}

// PopupThread - thread drill-in rendered inside the popup (FB-chat style) instead of
// the viewport-fixed ThreadPane, so the quotation being edited stays visible.
function PopupThread({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const openThreadId = useCollabStore((s) => s.openThreadId);
  const setOpenThread = useCollabStore((s) => s.setOpenThread);
  const thread = useThread(openThreadId);
  const ids = (thread.data ?? []).map((m) => m.id);
  const reactions = useReactions(ids);
  const reactionsByMessageId = new Map<string, typeof reactions.data>();
  for (const r of reactions.data ?? []) {
    const arr = reactionsByMessageId.get(r.message_id) ?? [];
    arr.push(r);
    reactionsByMessageId.set(r.message_id, arr);
  }
  const membersQuery = useChannelMembers(channelId);
  const sendersMap = new Map<string, { name: string | null; avatarUrl: string | null }>();
  for (const m of membersQuery.data ?? []) {
    sendersMap.set(m.user_id, { name: m.full_name, avatarUrl: m.avatar_url });
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-3 py-2">
        <button
          type="button"
          onClick={() => setOpenThread(null)}
          aria-label="Back to channel"
          className="p-1 text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold text-zinc-900">Thread</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="ml-auto p-1 text-zinc-500 hover:text-zinc-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {thread.isLoading && (
          <div className="text-center text-zinc-400 text-sm py-6">
            <Loader2 className="h-4 w-4 animate-spin inline" /> Loading...
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
      {openThreadId && <Composer channelId={channelId} parentMessageId={openThreadId} />}
    </div>
  );
}
