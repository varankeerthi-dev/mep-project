// TaskCard.tsx — system message card referencing an authoritative Task.
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  Calendar,
  ExternalLink,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  User,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../../supabase';
import { useTask, useUpdateTask } from '../../../../components/tasks/hooks';
import type { TaskStatus } from '../../../../components/tasks/types';
import { useAuth } from '../../../../contexts/AuthContext';
import { formatRelativeTime } from '../utils';
import { useCollabStore } from '../store';
import { useChannelMembers } from '../hooks';
import { UserAvatar } from './UserAvatar';
import { cn } from '../../../../lib/utils';
import type { Message } from '../types';

interface Props {
  message: Message;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
}

const STATUS_CONFIGS: Record<
  TaskStatus,
  { label: string; color: string; border: string; dot: string }
> = {
  not_started: {
    label: 'Not Started',
    color: 'bg-slate-100 text-slate-700',
    border: 'border-slate-300 hover:bg-slate-200/80',
    dot: 'bg-slate-400',
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-50 text-blue-700',
    border: 'border-blue-300 hover:bg-blue-100/80',
    dot: 'bg-blue-500',
  },
  under_review: {
    label: 'Under Review',
    color: 'bg-amber-50 text-amber-700',
    border: 'border-amber-300 hover:bg-amber-100/80',
    dot: 'bg-amber-500',
  },
  completed: {
    label: 'Completed',
    color: 'bg-emerald-50 text-emerald-700',
    border: 'border-emerald-300 hover:bg-emerald-100/80',
    dot: 'bg-emerald-500',
  },
  on_hold: {
    label: 'On Hold',
    color: 'bg-purple-50 text-purple-700',
    border: 'border-purple-300 hover:bg-purple-100/80',
    dot: 'bg-purple-500',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-50 text-red-700',
    border: 'border-red-300 hover:bg-red-100/80',
    dot: 'bg-red-500',
  },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-slate-500' },
  medium: { label: 'Medium', color: 'text-blue-600' },
  high: { label: 'High', color: 'text-amber-600' },
  critical: { label: 'Critical', color: 'text-red-600 font-semibold' },
  urgent: { label: 'Urgent', color: 'text-red-600 font-semibold' },
};

const STATUS_ORDER: TaskStatus[] = [
  'not_started',
  'in_progress',
  'under_review',
  'completed',
  'on_hold',
  'cancelled',
];

export function TaskCard({ message, senderName, senderAvatarUrl }: Props) {
  const { user } = useAuth();
  const openTaskDetail = useCollabStore((s) => s.openTaskDetail);

  const entity = message.metadata?.linked_entities?.[0];
  const taskId = entity?.id ?? '';
  const meta = (entity?.snapshot ?? (entity as any)?.meta ?? {}) as Record<string, any>;

  // Fetch live authoritative task from Supabase cache/db
  const { data: taskData } = useTask(taskId || null);
  const updateTaskMutation = useUpdateTask();

  // Field values with seamless live fallback to message snapshot
  const title =
    taskData?.title ||
    meta.title ||
    entity?.label ||
    message.content.replace(/^Created task:\s*/, '') ||
    'Task';
  const priorityKey = (taskData?.priority || meta.priority || 'medium') as string;
  const dueDate = taskData?.due_date || meta.due_date;
  const createdBy = taskData?.created_by || meta.created_by || message.sender_id;
  const assigneeIds = useMemo(
    () => ((taskData?.assignee_ids || meta.assignee_ids || []) as string[]).filter(Boolean),
    [taskData?.assignee_ids, meta.assignee_ids],
  );

  // Status handling
  const [localStatus, setLocalStatus] = useState<TaskStatus | null>(null);
  const effectiveStatus: TaskStatus = (localStatus ??
    taskData?.status ??
    meta.status ??
    'not_started') as TaskStatus;
  const isCompleted = effectiveStatus === 'completed';

  // Collapse state for completed tasks
  const [isCollapsed, setIsCollapsed] = useState<boolean>(isCompleted);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync collapsed state when task becomes completed
  useEffect(() => {
    if (effectiveStatus === 'completed') {
      setIsCollapsed(true);
    }
  }, [effectiveStatus]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!statusDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusDropdownOpen]);

  // Channel members for name resolution
  const { data: channelMembers = [] } = useChannelMembers(message.channel_id);

  // Profile resolution for assignees & creator not in channel members
  const missingProfileIds = useMemo(() => {
    const ids = new Set<string>();
    if (createdBy) ids.add(createdBy);
    if (message.sender_id) ids.add(message.sender_id);
    for (const aid of assigneeIds) ids.add(aid);
    return Array.from(ids).filter((id) => !channelMembers.some((m) => m.user_id === id));
  }, [createdBy, message.sender_id, assigneeIds, channelMembers]);

  const { data: extraProfiles = [] } = useQuery({
    queryKey: ['task-card-profiles', missingProfileIds.sort().join(',')],
    queryFn: async () => {
      if (missingProfileIds.length === 0) return [];
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', missingProfileIds);
      return data || [];
    },
    enabled: missingProfileIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Lookup helper
  const getUserInfo = (userId?: string | null) => {
    if (!userId) return null;
    const member = channelMembers.find((m) => m.user_id === userId);
    if (member) return { name: member.full_name, avatarUrl: member.avatar_url };
    const profile = extraProfiles.find((p: any) => p.user_id === userId);
    if (profile) return { name: profile.full_name, avatarUrl: profile.avatar_url };
    return null;
  };

  // Creator display
  const isSelfCreator = !!user?.id && (user.id === message.sender_id || (createdBy && user.id === createdBy));
  const creatorInfo = getUserInfo(createdBy || message.sender_id);
  const creatorName = isSelfCreator
    ? 'You'
    : senderName || message.sender_name || creatorInfo?.name || 'Team member';
  const creatorAvatarUrl = isSelfCreator
    ? user?.user_metadata?.avatar_url
    : senderAvatarUrl || message.sender_avatar_url || creatorInfo?.avatarUrl;

  // Assignee display
  const resolvedAssignees = useMemo(() => {
    return assigneeIds.map((id) => {
      const isSelf = user?.id === id;
      const info = getUserInfo(id);
      return {
        id,
        name: isSelf ? 'You' : info?.name || 'Member',
        avatarUrl: isSelf ? user?.user_metadata?.avatar_url : info?.avatarUrl,
        isSelf,
      };
    });
  }, [assigneeIds, user?.id, user?.user_metadata?.avatar_url, channelMembers, extraProfiles]);

  // Handle status update
  const handleStatusChange = async (newStatus: TaskStatus) => {
    setStatusDropdownOpen(false);
    if (newStatus === effectiveStatus) return;

    setLocalStatus(newStatus);
    if (newStatus === 'completed') {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
    }

    if (!taskId) return;

    try {
      await updateTaskMutation.mutateAsync({
        id: taskId,
        status: newStatus,
        completion_percentage:
          newStatus === 'completed' ? 100 : newStatus === 'not_started' ? 0 : undefined,
      });
      toast.success(`Task status: ${STATUS_CONFIGS[newStatus]?.label || newStatus}`);
    } catch {
      setLocalStatus(null);
      toast.error('Failed to update task status');
    }
  };

  const statusConfig = STATUS_CONFIGS[effectiveStatus] || STATUS_CONFIGS.not_started;
  const priorityConfig = PRIORITY_LABELS[priorityKey] || PRIORITY_LABELS.medium;

  // Render Status Dropdown
  const renderStatusDropdown = () => (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-1 z-30 w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
        Change Status
      </div>
      {STATUS_ORDER.map((s) => {
        const cfg = STATUS_CONFIGS[s];
        const isCurrent = effectiveStatus === s;
        return (
          <button
            key={s}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStatusChange(s);
            }}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors hover:bg-zinc-50 cursor-pointer',
              isCurrent ? 'font-semibold text-zinc-900 bg-blue-50/50' : 'text-zinc-600',
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
              <span>{cfg.label}</span>
            </div>
            {isCurrent && <Check className="h-3 w-3 text-blue-600 shrink-0" />}
          </button>
        );
      })}
    </div>
  );

  // 1. COLLAPSED VIEW FOR COMPLETED TASKS (Saves vertical space in channel)
  if (isCompleted && isCollapsed) {
    return (
      <div
        className="my-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-2 py-1.5 max-w-md shadow-2xs flex items-center justify-between gap-2.5 transition-all"
        data-testid="collab-task-card"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-3 w-3" />
          </span>
          <span
            className="text-xs font-medium text-slate-700 truncate line-through decoration-slate-400"
            title={title}
          >
            {title}
          </span>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStatusDropdownOpen((prev) => !prev);
              }}
              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="Click to change status"
            >
              <span>Completed</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </button>
            {statusDropdownOpen && renderStatusDropdown()}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (taskId) openTaskDetail(taskId);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer px-1 py-0.5"
            data-testid="collab-task-card-view"
          >
            <span>View</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="p-1 text-emerald-700 hover:text-emerald-900 rounded hover:bg-emerald-100/70 cursor-pointer transition-colors"
            title="Expand task details"

            aria-label="Expand task details"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // 2. FULL EXPANDED CARD VIEW
  return (
    <div
      className={cn(
        'my-1.5 rounded-lg border p-3 max-w-md shadow-xs transition-all relative bg-white space-y-2',
        isCompleted ? 'border-emerald-200' : 'border-slate-200',
      )}
      data-testid="collab-task-card"
    >
      {/* Top row: Creator & Status pill */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium min-w-0">
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <CheckSquare className="h-4 w-4 text-blue-600 shrink-0" />
          )}
          <span className="text-[11px] font-semibold text-blue-600">Task</span>
          <span className="text-zinc-400 font-normal">·</span>
          {/* Creator display */}
          <div className="flex items-center gap-1 min-w-0 text-zinc-500 font-normal">
            <UserAvatar
              name={creatorName}
              userId={createdBy || message.sender_id}
              avatarUrl={creatorAvatarUrl}
              size="xs"
              fallbackType="face"
            />
            <span className="truncate" title={`Created by ${creatorName}`}>
              Created by <strong className="font-medium text-zinc-800">{creatorName}</strong>
            </span>
          </div>
          <span className="text-zinc-400 font-normal shrink-0">
            · {formatRelativeTime(message.created_at)}
          </span>
        </div>

        {/* Status Pill & Optional Collapse button */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStatusDropdownOpen((prev) => !prev);
              }}
              className={cn(
                'px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors flex items-center gap-1 cursor-pointer select-none',
                statusConfig.color,
                statusConfig.border,
              )}
              title="Click to change status"
            >
              <span>{statusConfig.label}</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </button>
            {statusDropdownOpen && renderStatusDropdown()}
          </div>

          {isCompleted && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-100 cursor-pointer transition-colors"
              title="Collapse completed task"
              aria-label="Collapse completed task"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Task Title */}
      <div
        className={cn(
          'text-[13px] font-bold leading-snug',
          isCompleted ? 'text-slate-600 line-through decoration-slate-400' : 'text-slate-900',
        )}
      >
        {title}
      </div>

      {/* Assignee(s) Section */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[11px] font-medium text-zinc-400 shrink-0">Assignee:</span>
        {resolvedAssignees.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 italic">
            <User className="h-3 w-3 text-zinc-300" />
            Unassigned
          </span>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            {resolvedAssignees.slice(0, 3).map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded-full bg-white border border-zinc-200/90 px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-2xs"
                title={a.name}
              >
                <UserAvatar
                  name={a.name}
                  avatarUrl={a.avatarUrl}
                  userId={a.id}
                  size="xs"
                  fallbackType="face"
                />
                <span className="max-w-[100px] truncate">{a.name}</span>
              </span>
            ))}
            {resolvedAssignees.length > 3 && (
              <span
                className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 rounded-full px-1.5 py-0.5 border border-zinc-200"
                title={resolvedAssignees
                  .slice(3)
                  .map((a) => a.name)
                  .join(', ')}
              >
                +{resolvedAssignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: Priority, Due Date & View Task */}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2.5 text-slate-500">
          <span
            className={cn(
              'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50',
              priorityConfig.color,
            )}
          >
            {priorityConfig.label} Priority
          </span>
          {dueDate && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Calendar className="h-3 w-3" />
              {dueDate}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (taskId) openTaskDetail(taskId);
          }}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          data-testid="collab-task-card-view"
        >
          <span>View Task</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

