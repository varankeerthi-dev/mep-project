// MessageBubble.tsx — single message with body, reactions, edit/delete, task/reminder creation.
import { memo, useState } from 'react';
import {
  Smile,
  Pencil,
  Trash2,
  MoreHorizontal,
  CheckSquare,
  Bookmark,
  Bell,
  MessageSquare,
} from 'lucide-react';
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
          className="bg-blue-50 text-blue-600 font-semibold px-1 rounded mx-0.5"
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
  const setOpenThread = useCollabStore((s) => s.setOpenThread);
  const expandThread = useCollabStore((s) => s.expandThread);
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
      <div className="text-[11px] text-slate-400 italic px-2 py-1" data-testid="collab-msg-tombstone">
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
      <div className="text-[11px] text-slate-400 italic px-2 py-1 text-center" data-testid="collab-msg-system">
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
      className={`group relative flex items-start gap-2.5 px-2 py-1 -mx-2 rounded hover:bg-slate-50 transition-colors ${isOptimistic ? 'opacity-70' : ''}`}
      data-testid="collab-msg"
      data-message-id={message.id}
    >
      {/* Hover action toolbar */}
      <div className="absolute right-2 -top-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 bg-white border border-slate-200 rounded shadow-sm px-1 py-0.5 text-slate-500 z-10 transition">
        <div className="relative">
          <button
            type="button"
            className="px-1 hover:text-amber-500"
            onClick={(e) => {
              e.stopPropagation();
              setShowEmoji((v) => !v);
            }}
            aria-label="React"
            title="Add reaction"
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
        {/* Reply in thread */}
        <button
          type="button"
          className="px-1 hover:text-blue-600"
          onClick={(e) => {
            e.stopPropagation();
            expandThread();
            setOpenThread(message.id);
          }}
          title="Reply in thread"
          aria-label="Reply in thread"
          data-testid="collab-msg-thread"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        {/* Direct Create Task Action */}
        <button
          type="button"
          className="px-1 hover:text-blue-600"
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
            className="px-1 hover:text-slate-800"
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
            className="px-1 hover:text-slate-800"
            aria-label="Remove my reactions"
            title="Remove my reactions"
          >
            ×
          </button>
        )}
      </div>

      <UserAvatar
        name={senderName}
        avatarUrl={senderAvatarUrl ?? message.sender_avatar_url}
        userId={message.sender_id}
        size="sm"
        fallbackType="face"
        className="shrink-0"
        showTooltip
      />
      <div className="flex-1 min-w-0 text-[13px]">
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold text-slate-900 hover:underline cursor-pointer truncate">
            {isOptimistic
              ? 'Sending…'
              : senderName && senderName.trim().length > 0
              ? senderName
              : 'Unknown user'}
          </span>
          <span className="text-[11px] text-slate-400 shrink-0">
            {formatRelativeTime(message.created_at)}
          </span>
          {message.edited_at && (
            <span className="text-[11px] text-slate-400 shrink-0">(edited)</span>
          )}
        </div>
        <div className="text-slate-800 mt-0.5 whitespace-pre-wrap break-words leading-snug">
          {renderContentWithMentions(message.content)}
        </div>

        <LinkedEntityChips entities={message.metadata.linked_entities ?? []} />

        <ReactionBar messageId={message.id} reactions={reactions} channelId={message.channel_id} />
      </div>
    </div>
  );
});
