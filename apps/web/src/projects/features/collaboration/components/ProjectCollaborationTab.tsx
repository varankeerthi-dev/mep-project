// ProjectCollaborationTab.tsx — root of the collaboration feature inside a project.
// Note: the always-on thread rail is mounted by CollaborationWorkspace,
// so this component only owns the channel + chat + composer for the active project.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChannelHeader } from './ChannelHeader';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { ReminderCreateDrawer } from './ReminderCreateDrawer';
import { QuotationPdfDrawer } from './QuotationPdfDrawer';
import { UserAvatar } from './UserAvatar';
import TaskCreateDrawer from '../../../../components/tasks/TaskCreateDrawer';
import TaskDetailDrawer from '../../../../components/tasks/TaskDetailDrawer';
import { useAuth } from '../../../../contexts/AuthContext';
import { useTaskGroups, useCreateTask } from '../../../../components/tasks/hooks';
import { useEnsureChannel, useCompanyChannel, useSearchMessages, useChannelMembers } from '../hooks';
import { useRealtimeChannel } from '../useRealtimeChannel';
import { useCollabStore } from '../store';
import { postTaskChannelCard } from '../api';
import { formatRelativeTime } from '../utils';
import type { Channel, Message } from '../types';
import type { TaskCreateInput } from '../../../../components/tasks/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectId?: string | null;
  channelId?: string | null;
  channelName?: string;
  initialChannel?: Channel;
  /** Closes the docked pane this channel is rendered in (multi-pane split view). */
  onClose?: () => void;
  closeTestId?: string;
}

export function ProjectCollaborationTab({
  projectId,
  channelId,
  channelName,
  initialChannel,
  onClose,
  closeTestId,
}: Props) {
  const { user, organisation } = useAuth();
  const orgId = organisation?.id ?? '';

  const projectChannelQuery = useEnsureChannel(projectId);
  const companyChannelQuery = useCompanyChannel(
    !projectId && !initialChannel ? orgId : null,
    channelName || 'general',
  );

  const channel = initialChannel ?? (projectId ? projectChannelQuery.data : companyChannelQuery.data);
  const isLoading = initialChannel
    ? false
    : projectId
    ? projectChannelQuery.isLoading
    : companyChannelQuery.isLoading;
  const isError = initialChannel
    ? false
    : projectId
    ? !!projectChannelQuery.error
    : !!companyChannelQuery.error;

  // Project context for tasks created from this channel. The channel is authoritative:
  // a company channel carries project_id = NULL, so its tasks must be project-less.
  // The guard in post_task_channel_card() rejects any contradiction with this value.
  const effectiveProjectId = projectId || channel?.project_id || null;

  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const resetForProject = useCollabStore((s) => s.resetForProject);

  const taskCreateDrawerOpen = useCollabStore((s) => s.taskCreateDrawerOpen);
  const taskCreateInitial = useCollabStore((s) => s.taskCreateInitial);
  const closeTaskCreate = useCollabStore((s) => s.closeTaskCreate);

  const taskDetailId = useCollabStore((s) => s.taskDetailId);
  const closeTaskDetail = useCollabStore((s) => s.closeTaskDetail);

  const { data: taskGroups = [] } = useTaskGroups(orgId, projectId ?? null);
  const createTaskMutation = useCreateTask();

  // Reset transient UI when project or channel changes.
  useEffect(() => {
    resetForProject(projectId || channel?.id || 'general');
  }, [projectId, channel?.id, resetForProject]);

  useRealtimeChannel(channel?.id ?? null);

  const search = useSearchMessages(channel?.id ?? null, searchTerm.trim());
  const inSearchMode = searchOpen && searchTerm.trim().length > 0;

  const setScrolledToMessageId = useCollabStore((s) => s.setScrolledToMessageId);
  const membersQuery = useChannelMembers(channel?.id ?? null);
  const sendersMap = useMemo(() => {
    const map = new Map<string, { name: string | null; avatarUrl: string | null }>();
    for (const m of membersQuery.data ?? []) {
      map.set(m.user_id, { name: m.full_name, avatarUrl: m.avatar_url });
    }
    return map;
  }, [membersQuery.data]);

  const handleJumpToMessage = useCallback((messageId: string) => {
    setSearchOpen(false);
    setSearchTerm('');
    // Small delay so the MessageList mounts before we scroll
    requestAnimationFrame(() => {
      setScrolledToMessageId(messageId);
    });
  }, [setScrolledToMessageId]);

  const handleCreateTaskSubmit = async (input: TaskCreateInput) => {
    if (!orgId || !user?.id) return;
    try {
      const newTask = await createTaskMutation.mutateAsync({
        ...input,
        project_id: effectiveProjectId,
        organisation_id: orgId,
        created_by: user.id,
      });

      // Post task card to channel
      const targetChannelId = taskCreateInitial?.channelId ?? channel?.id;
      if (targetChannelId) {
        try {
          await postTaskChannelCard(effectiveProjectId, targetChannelId, newTask.id);
        } catch {
          // non-blocking
        }
      }

      toast.success('✓ Task created');
      closeTaskCreate();
    } catch {
      toast.error('Failed to create task');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500" data-testid="collab-loading">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (isError || !channel) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-red-600" data-testid="collab-error">
        Could not open collaboration channel. Check your access and try again.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white relative" data-testid="collab-root">
      <ChannelHeader
        channel={channel}
        onSearch={(v) => {
          if (v === '') setSearchOpen(false);
          else setSearchOpen(true);
          setSearchTerm(v.trim());
        }}
        searchOpen={searchOpen}
        searchTerm={searchTerm}
        onClose={onClose}
        closeTestId={closeTestId}
      />

      {inSearchMode ? (
        <div
          className="flex-1 overflow-y-auto px-4 py-3 space-y-1 collab-scroll"
          data-testid="collab-search-results"
        >
          <div className="text-xs text-slate-500 mb-2">
            {search.isLoading ? 'Searching…' : `${search.data?.length ?? 0} result${(search.data?.length ?? 0) !== 1 ? 's' : ''}`}
          </div>
          {search.data?.map((m) => (
            <SearchResultItem
              key={m.id}
              message={m}
              searchTerm={searchTerm.trim()}
              senderName={sendersMap.get(m.sender_id)?.name ?? m.sender_name ?? null}
              senderAvatarUrl={sendersMap.get(m.sender_id)?.avatarUrl ?? m.sender_avatar_url ?? null}
              onJump={handleJumpToMessage}
            />
          ))}
        </div>
      ) : (
        <MessageList channelId={channel.id} />
      )}

      <Composer channelId={channel.id} channelName={channel.name} />

      {taskCreateDrawerOpen && (!taskCreateInitial?.channelId || taskCreateInitial.channelId === channel.id) && (
        <TaskCreateDrawer
          projectId={effectiveProjectId}
          defaultGroupId={null}
          groups={taskGroups}
          organisationId={orgId}
          onClose={closeTaskCreate}
          onSubmit={handleCreateTaskSubmit}
          isLoading={createTaskMutation.isPending}
          initial={taskCreateInitial ?? undefined}
        />
      )}

      {taskDetailId && (
        <TaskDetailDrawer
          taskId={taskDetailId}
          onClose={closeTaskDetail}
        />
      )}

      <ReminderCreateDrawer />

      <QuotationPdfDrawer />
    </div>
  );
}


// SearchResultItem — a single search result with highlighted term and jump action.
function SearchResultItem({
  message,
  searchTerm,
  senderName,
  senderAvatarUrl,
  onJump,
}: {
  message: Message;
  searchTerm: string;
  senderName: string | null;
  senderAvatarUrl: string | null;
  onJump: (messageId: string) => void;
}) {
  const isSystem = message.message_type === 'system';

  return (
    <button
      type="button"
      onClick={() => onJump(message.id)}
      className="w-full text-left rounded-lg border border-slate-200 hover:border-collab-accent hover:bg-blue-50/60 transition p-2.5 group"
      data-testid="collab-search-result"
    >
      <div className="flex items-start gap-2">
        <UserAvatar
          name={senderName}
          avatarUrl={senderAvatarUrl}
          userId={message.sender_id}
          size="xs"
          fallbackType="face"
          className="mt-0.5 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-slate-800 truncate">
              {senderName || 'Unknown'}
            </span>
            <span className="text-[10px] text-slate-400 shrink-0">
              {formatRelativeTime(message.created_at)}
            </span>
            {isSystem && (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                System
              </span>
            )}
          </div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap break-words line-clamp-3">
            {highlightText(message.content, searchTerm)}
          </div>
          {message.metadata?.linked_entities?.length ? (
            <div className="text-[10px] text-slate-400 mt-1">
              +{message.metadata.linked_entities.length} linked
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// Highlight occurrences of `term` inside `text`. Falls back to plain text when
// the term is empty or the regex would blow up.
function highlightText(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const lower = term.toLowerCase();
  const result: React.ReactNode[] = [];
  let cursor = 0;
  let idx = text.toLowerCase().indexOf(lower);
  while (idx !== -1) {
    if (idx > cursor) result.push(text.slice(cursor, idx));
    result.push(
      <mark key={idx} className="bg-yellow-200 text-slate-900 rounded px-0.5">
        {text.slice(idx, idx + term.length)}
      </mark>,
    );
    cursor = idx + term.length;
    idx = text.toLowerCase().indexOf(lower, cursor);
  }
  if (cursor < text.length) result.push(text.slice(cursor));
  return result.length ? result : text;
}
