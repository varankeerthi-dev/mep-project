// MessageBubble.tsx — single message with body, reactions, edit/delete, task/reminder creation.
import { memo, useState } from 'react';
import { Smile, Pencil, Trash2, MoreHorizontal, CheckSquare, Bookmark, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../../contexts/AuthContext';
import { useAddReaction, useDeleteMessage, useRemoveReaction, useCreatePersonalTaskFromMessage } from '../hooks';
import { ReactionBar } from './ReactionBar';
import { LinkedEntityChips } from './LinkedEntityChips';
import { DailyReportCard } from './DailyReportCard';
import { TaskCard } from './TaskCard';
import { ReminderCard } from './ReminderCard';
import { useCollabStore } from '../store';
import { formatRelativeTime, isOptimisticId, parseTaskFromMessage } from '../utils';
import { UserAvatar } from './UserAvatar';
import type { Message, Reaction } from '../types';

interface Props {
  message: Message;
  reactions: Reaction[];
  senderName?: string | null;
  senderAvatarUrl?: string | null;
}
const EMOJI_PRESETS: readonly string[] = ['👍', '✅', '👀', '🎯', '🔥', '🙌'];


function renderContentWithMentions(content: string) {
  if (!content.includes('@')) return content;
  // Match @[Full Name] or @Word
  const regex = /(@\[[^\]]+\]|@[A-Za-z0-9_.-]+)/g;
  const parts = content.split(regex);
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      const display = part.startsWith('@[') && part.endsWith(']') ? '@' + part.slice(2, -1) : part;
      return (
        <span
          key={i}
          className="inline-block px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 font-semibold text-xs mx-0.5"
        >
          {display}
        </span>
      );
    }
    return part;
  });
}

export const MessageBubble = memo(function MessageBubble({
  message,
  reactions,
  senderName = null,
  senderAvatarUrl = null,
}: Props) {
  const { user } = useAuth();
  const isOwn = message.sender_id === user?.id;
  const isOptimistic = isOptimisticId(message.id);
  const isDeleted = !!message.deleted_at;

  const addR = useAddReaction(message.channel_id);
  const delR = useRemoveReaction(message.channel_id);
  const del = useDeleteMessage(message.channel_id);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const openTaskCreate = useCollabStore((s) => s.openTaskCreate);
  const openReminderCreate = useCollabStore((s) => s.openReminderCreate);
  const createPersonalTask = useCreatePersonalTaskFromMessage();

  const handleCreateTask = () => {
    const parsed = parseTaskFromMessage(message.content, message.metadata?.mentions);
    openTaskCreate({
      ...parsed,
      channelId: message.channel_id,
    });
  };

  const handleAddToMyTask = async () => {
    try {
      await createPersonalTask.mutateAsync(message.id);
      toast.success('✓ Added to My Tasks');
    } catch {
      toast.error('Failed to add to personal tasks');
    }
  };

  const handleSetReminder = () => {
    const parsed = parseTaskFromMessage(message.content);
    openReminderCreate({
      messageId: message.id,
      channelId: message.channel_id,
      defaultTitle: parsed.title,
      defaultNotes: message.content,
    });
  };

  if (isDeleted) {
    return (
      <div className="text-xs text-gray-400 italic px-2 py-1" data-testid="collab-msg-tombstone">
        Message deleted
      </div>
    );
  }

  if (message.message_type === 'system') {
    const entity = message.metadata?.linked_entities?.[0];
    if (entity?.type === 'daily_report') {
      return <DailyReportCard message={message} />;
    }
    if (entity?.type === 'task') {
      return (
        <TaskCard
          message={message}
          senderName={senderName}
          senderAvatarUrl={senderAvatarUrl}
        />
      );
    }
    if ((entity as any)?.type === 'reminder') {
      return <ReminderCard message={message} />;
    }
    return (
      <div className="text-xs text-gray-500 italic px-2 py-1 text-center" data-testid="collab-msg-system">
        {message.content}
      </div>
    );
  }

  const ownReactions = reactions.filter((r) => r.user_id === user?.id);
  const removeOwnReactions = (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const r of ownReactions) {
      delR.mutate({ messageId: message.id, emoji: r.emoji });
    }
  };

  return (
    <div
      className={`group relative rounded-lg px-2.5 py-1.5 hover:bg-slate-50/80 transition-colors ${isOptimistic ? 'opacity-70' : ''}`}
      data-testid="collab-msg"
      data-message-id={message.id}
    >
      <div className="flex items-start gap-2.5">
        <UserAvatar
          name={senderName}
          avatarUrl={senderAvatarUrl ?? message.sender_avatar_url}
          userId={message.sender_id}
          size="sm"
          fallbackType="face"
          className="mt-0.5"
          showTooltip
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {isOptimistic
                ? 'Sending…'
                : (senderName && senderName.trim().length > 0
                    ? senderName
                    : 'Unknown user')}
            </span>
            <span className="text-xs text-slate-500">{formatRelativeTime(message.created_at)}</span>
            {message.edited_at && <span className="text-xs text-slate-400">(edited)</span>}
          </div>
          <div className="text-sm text-slate-800 whitespace-pre-wrap break-words mt-0.5">
            {renderContentWithMentions(message.content)}
          </div>

          <LinkedEntityChips entities={message.metadata.linked_entities ?? []} />

          <ReactionBar messageId={message.id} reactions={reactions} channelId={message.channel_id} />
        </div>
      </div>

      <div className="absolute right-2 -top-2 hidden group-hover:flex items-center gap-0.5 bg-white border rounded shadow-sm">
        <div className="relative">
          <button
            type="button"
            className="p-1 text-gray-500 hover:text-gray-800"
            onClick={(e) => {
              e.stopPropagation();
              setShowEmoji((v) => !v);
            }}
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
                  onClick={(ev) => {
                    ev.stopPropagation();
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
        {/* Direct Create Task Action */}
        <button
          type="button"
          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
          onClick={(e) => {
            e.stopPropagation();
            handleCreateTask();
          }}
          title="Create Task"
          aria-label="Create Task"
          data-testid="collab-msg-create-task"
        >
          <CheckSquare className="h-3.5 w-3.5" />
        </button>

        {/* More Actions Menu */}
        <div className="relative">
          <button
            type="button"
            className="p-1 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-100 transition"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
            aria-label="More options"
            title="More options"
            data-testid="collab-msg-more"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-20 min-w-[160px] text-xs">
              <button
                type="button"
                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 text-slate-700 hover:text-blue-700 w-full text-left rounded font-medium transition cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  handleCreateTask();
                }}
                data-testid="collab-msg-menu-create-task"
              >
                <CheckSquare className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Create Task</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-amber-50 text-slate-700 hover:text-amber-800 w-full text-left rounded transition cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  handleAddToMyTask();
                }}
                data-testid="collab-msg-menu-add-personal"
              >
                <Bookmark className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Add to my task</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-purple-50 text-slate-700 hover:text-purple-700 w-full text-left rounded transition cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  handleSetReminder();
                }}
                data-testid="collab-msg-menu-set-reminder"
              >
                <Bell className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span>Set Reminder</span>
              </button>

              {isOwn && (
                <>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    type="button"
                    className="flex items-center gap-2 px-2.5 py-1.5 text-slate-600 hover:bg-gray-100 w-full text-left rounded transition cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 shrink-0" />
                    <span>Edit (v1: resend)</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-2.5 py-1.5 text-red-600 hover:bg-red-50 w-full text-left rounded transition cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      del.mutate(message.id);
                      setShowMenu(false);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
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
});
