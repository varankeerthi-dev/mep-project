// MessageBubble.tsx — single message with body, reactions, edit/delete.
import { useState } from 'react';
import { Smile, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useAddReaction, useDeleteMessage, useRemoveReaction } from '../hooks';
import { ReactionBar } from './ReactionBar';
import { LinkedEntityChips } from './LinkedEntityChips';
import { DailyReportCard } from './DailyReportCard';
import { formatRelativeTime, isOptimisticId } from '../utils';
import type { Message, Reaction } from '../types';

interface Props {
  message: Message;
  reactions: Reaction[];
  senderName?: string | null;
}
const EMOJI_PRESETS: readonly string[] = ['👍', '✅', '👀', '🎯', '🔥', '🙌'];

export function MessageBubble({ message, reactions, senderName = null }: Props) {
  const { user } = useAuth();
  const isOwn = message.sender_id === user?.id;
  const isOptimistic = isOptimisticId(message.id);
  const isDeleted = !!message.deleted_at;

  const addR = useAddReaction(message.channel_id);
  const delR = useRemoveReaction(message.channel_id);
  const del = useDeleteMessage(message.channel_id);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (isDeleted) {
    return (
      <div className="text-xs text-gray-400 italic px-2 py-1" data-testid="collab-msg-tombstone">
        Message deleted
      </div>
    );
  }

  if (message.message_type === 'system') {
    const entity = message.metadata.linked_entities?.[0];
    if (entity?.type === 'daily_report') {
      return <DailyReportCard message={message} />;
    }
    return (
      <div className="text-xs text-gray-500 italic px-2 py-1 text-center" data-testid="collab-msg-system">
        {message.content}
      </div>
    );
  }

  const ownReactions = reactions.filter((r) => r.user_id === user?.id);
  const removeOwnReactions = () => {
    for (const r of ownReactions) {
      delR.mutate({ messageId: message.id, emoji: r.emoji });
    }
  };

  return (
    <div
      className={`group relative rounded px-2 py-1.5 hover:bg-gray-50 ${isOptimistic ? 'opacity-70' : ''}`}
      data-testid="collab-msg"
      data-message-id={message.id}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {isOptimistic
            ? 'Sending…'
            : (senderName && senderName.trim().length > 0
                ? senderName
                : 'Unknown user')}
        </span>
        <span className="text-xs text-gray-500">{formatRelativeTime(message.created_at)}</span>
        {message.edited_at && <span className="text-xs text-gray-400">(edited)</span>}
      </div>
      <div className="text-sm text-gray-800 whitespace-pre-wrap break-words mt-0.5">
        {message.content}
      </div>

      <LinkedEntityChips entities={message.metadata.linked_entities ?? []} />

      <ReactionBar messageId={message.id} reactions={reactions} />

      <div className="absolute right-2 -top-2 hidden group-hover:flex items-center gap-0.5 bg-white border rounded shadow-sm">
        <div className="relative">
          <button
            type="button"
            className="p-1 text-gray-500 hover:text-gray-800"
            onClick={() => setShowEmoji((v) => !v)}
            aria-label="React"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
          {showEmoji && (
            <div className="absolute right-0 mt-1 bg-white border rounded shadow p-1 flex gap-0.5 z-10">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="px-1.5 py-0.5 hover:bg-gray-100 rounded text-sm"
                  onClick={() => {
                    addR.mutate({ messageId: message.id, emoji: e });
                    setShowEmoji(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        {isOwn && (
          <div className="relative">
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-800"
              onClick={() => setShowMenu((v) => !v)}
              aria-label="More"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 bg-white border rounded shadow p-1 z-10 min-w-[140px]">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-gray-100 w-full"
                  onClick={() => setShowMenu(false)}
                >
                  <Pencil className="h-3 w-3" /> Edit (v1: resend)
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-red-50 text-red-600 w-full"
                  onClick={() => {
                    del.mutate(message.id);
                    setShowMenu(false);
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
        {ownReactions.length > 0 && (
          <button
            type="button"
            onClick={removeOwnReactions}
            className="p-1 text-gray-500 hover:text-gray-800"
            aria-label="Remove my reactions"
            title="Remove my reactions"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
