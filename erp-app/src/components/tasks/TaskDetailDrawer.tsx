// ============================================
// UNIFIED TASK MODULE — TASK DETAIL DRAWER
// ============================================
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTask, useUpdateTask, useTaskComments, useCreateComment, useTaskAttachments, useTaskTimeLogs, useTaskActivity } from './hooks';
import type { TaskStatus, TaskPriority, TaskDiscipline } from './types';
import { STATUS_CONFIG, PRIORITY_CONFIG, DISCIPLINE_CONFIG, TASK_TYPE_CONFIG } from './types';
import { cn } from '../../lib/utils';
import {
  X,
  Check,
  Clock,
  Calendar,
  User,
  Tag,
  MapPin,
  FileText,
  Paperclip,
  MessageSquare,
  Activity,
  Timer,
  Plus,
  Send,
  Trash2,
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface TaskDetailDrawerProps {
  taskId: string | null;
  onClose: () => void;
}

export default function TaskDetailDrawer({ taskId, onClose }: TaskDetailDrawerProps) {
  const { user } = useAuth();
  const { data: task, isLoading } = useTask(taskId);
  const updateTask = useUpdateTask();

  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'attachments' | 'time' | 'activity'>('details');
  const [commentText, setCommentText] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);

  // Sub-queries (only when task is loaded)
  const { data: comments = [] } = useTaskComments(taskId);
  const { data: attachments = [] } = useTaskAttachments(taskId);
  const { data: timeLogs = [] } = useTaskTimeLogs(taskId);
  const { data: activities = [] } = useTaskActivity(taskId);
  const createComment = useCreateComment();

  const handleComment = async () => {
    if (!commentText.trim() || !user?.id || !taskId) return;
    await createComment.mutateAsync({
      task_id: taskId,
      user_id: user.id,
      content: commentText.trim(),
    });
    setCommentText('');
  };

  if (!taskId) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[520px] flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-medium text-zinc-400">
              {task ? `TASK-${task.task_no}` : 'Loading...'}
            </span>
            {task && task.task_type !== 'task' && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500">
                {TASK_TYPE_CONFIG[task.task_type].icon} {task.task_type}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Clock className="h-6 w-6 animate-spin text-zinc-200" />
          </div>
        ) : task ? (
          <>
            {/* Title */}
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-[16px] font-bold leading-tight text-zinc-900">{task.title}</h2>
              {task.description && (
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">{task.description}</p>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 px-5">
              {[
                { key: 'details' as const, label: 'Details', icon: FileText },
                { key: 'comments' as const, label: `Comments (${comments.length})`, icon: MessageSquare },
                { key: 'attachments' as const, label: `Files (${attachments.length})`, icon: Paperclip },
                { key: 'time' as const, label: 'Time', icon: Timer },
                { key: 'activity' as const, label: 'Activity', icon: Activity },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[11px] font-medium transition-colors',
                    activeTab === key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-zinc-500 hover:text-zinc-700'
                  )}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'details' && (
                <TaskDetailsTab task={task} updateTask={updateTask} />
              )}
              {activeTab === 'comments' && (
                <TaskCommentsTab
                  comments={comments}
                  commentText={commentText}
                  onCommentTextChange={setCommentText}
                  onComment={handleComment}
                />
              )}
              {activeTab === 'attachments' && (
                <TaskAttachmentsTab attachments={attachments} />
              )}
              {activeTab === 'time' && (
                <TaskTimeTab timeLogs={timeLogs} />
              )}
              {activeTab === 'activity' && (
                <TaskActivityTab activities={activities} />
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

// ============================================
// DETAILS TAB
// ============================================

function TaskDetailsTab({
  task,
  updateTask,
}: {
  task: any;
  updateTask: any;
}) {
  const statusCfg = STATUS_CONFIG[task.status as TaskStatus];
  const priorityCfg = PRIORITY_CONFIG[task.priority as TaskPriority];

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2.5">
      <span className="w-24 shrink-0 text-[11px] font-medium text-zinc-400">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );

  return (
    <div className="px-5 py-4">
      {/* Status & Priority Row */}
      <div className="mb-4 flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Status</label>
          <select
            value={task.status}
            onChange={(e) => updateTask.mutateAsync({ id: task.id, status: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] font-medium outline-none transition-colors focus:border-blue-400"
            style={{ color: statusCfg.text, backgroundColor: statusCfg.bg }}
          >
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Priority</label>
          <select
            value={task.priority}
            onChange={(e) => updateTask.mutateAsync({ id: task.id, priority: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] font-medium outline-none transition-colors focus:border-blue-400"
            style={{ color: priorityCfg.text, backgroundColor: priorityCfg.bg }}
          >
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress */}
      <Field label="Progress">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={task.completion_percentage}
            onChange={(e) => updateTask.mutateAsync({ id: task.id, completion_percentage: parseInt(e.target.value) })}
            className="flex-1 accent-blue-600"
          />
          <span className="w-10 text-right text-[12px] font-bold tabular-nums text-zinc-700">
            {task.completion_percentage}%
          </span>
        </div>
      </Field>

      <div className="my-2 border-t border-zinc-100" />

      {/* Dates */}
      <Field label="Start Date">
        <input
          type="date"
          value={task.start_date || ''}
          onChange={(e) => updateTask.mutateAsync({ id: task.id, start_date: e.target.value || null })}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-900 outline-none transition-colors focus:border-blue-400"
        />
      </Field>

      <Field label="Due Date">
        <input
          type="date"
          value={task.due_date || ''}
          onChange={(e) => updateTask.mutateAsync({ id: task.id, due_date: e.target.value || null })}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-900 outline-none transition-colors focus:border-blue-400"
        />
      </Field>

      <Field label="Duration">
        <span className="text-[12px] text-zinc-700">
          {task.duration_days ? `${task.duration_days} days` : '—'}
        </span>
      </Field>

      <div className="my-2 border-t border-zinc-100" />

      {/* MEP Fields */}
      <Field label="Discipline">
        <select
          value={task.discipline || ''}
          onChange={(e) => updateTask.mutateAsync({ id: task.id, discipline: e.target.value || null })}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-900 outline-none transition-colors focus:border-blue-400"
        >
          <option value="">Select discipline</option>
          {Object.entries(DISCIPLINE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Location">
        <input
          type="text"
          value={task.location || ''}
          onChange={(e) => updateTask.mutateAsync({ id: task.id, location: e.target.value || null })}
          placeholder="e.g., Tower A - Level 3"
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-900 outline-none placeholder:text-zinc-300 transition-colors focus:border-blue-400"
        />
      </Field>

      <Field label="Drawing Ref">
        <input
          type="text"
          value={task.drawing_ref || ''}
          onChange={(e) => updateTask.mutateAsync({ id: task.id, drawing_ref: e.target.value || null })}
          placeholder="e.g., M-101 Rev.3"
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] font-mono text-zinc-900 outline-none placeholder:text-zinc-300 transition-colors focus:border-blue-400"
        />
      </Field>

      <Field label="WBS Code">
        <input
          type="text"
          value={task.wbs_code || ''}
          onChange={(e) => updateTask.mutateAsync({ id: task.id, wbs_code: e.target.value || null })}
          placeholder="e.g., 2.1.1"
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] font-mono text-zinc-900 outline-none placeholder:text-zinc-300 transition-colors focus:border-blue-400"
        />
      </Field>

      <div className="my-2 border-t border-zinc-100" />

      {/* Hours */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Est. Hours">
            <input
              type="number"
              value={task.estimated_hours || ''}
              onChange={(e) => updateTask.mutateAsync({ id: task.id, estimated_hours: parseFloat(e.target.value) || null })}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] tabular-nums text-zinc-900 outline-none transition-colors focus:border-blue-400"
            />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Act. Hours">
            <span className="text-[12px] tabular-nums text-zinc-700">
              {task.actual_hours ?? '—'}
            </span>
          </Field>
        </div>
      </div>

      {/* Tags */}
      <Field label="Tags">
        <div className="flex flex-wrap gap-1.5">
          {task.tags?.map((tag: string) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600"
            >
              <Tag size={10} />
              {tag}
            </span>
          ))}
          <button className="rounded-md border border-dashed border-zinc-200 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-500">
            + Add
          </button>
        </div>
      </Field>

      {/* Meta */}
      <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} />
          Created {new Date(task.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <Activity size={12} />
          Updated {new Date(task.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMMENTS TAB
// ============================================

function TaskCommentsTab({
  comments,
  commentText,
  onCommentTextChange,
  onComment,
}: {
  comments: any[];
  commentText: string;
  onCommentTextChange: (v: string) => void;
  onComment: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <MessageSquare size={24} className="mb-2" />
            <p className="text-[12px]">No comments yet</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">
                {comment.user_id?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-zinc-700">User</span>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(comment.created_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment Input */}
      <div className="border-t border-zinc-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => onCommentTextChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) onComment(); }}
            placeholder="Write a comment..."
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-400"
          />
          <button
            onClick={onComment}
            disabled={!commentText.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ATTACHMENTS TAB
// ============================================

function TaskAttachmentsTab({ attachments }: { attachments: any[] }) {
  return (
    <div className="px-5 py-4">
      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
          <Paperclip size={24} className="mb-2" />
          <p className="text-[12px]">No attachments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3 transition-colors hover:bg-zinc-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
                <FileText size={16} />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-medium text-zinc-700">{att.file_name}</p>
                <p className="text-[10px] text-zinc-400">
                  {att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : ''} · {new Date(att.created_at).toLocaleDateString()}
                </p>
              </div>
              <button className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// TIME TAB
// ============================================

function TaskTimeTab({ timeLogs }: { timeLogs: any[] }) {
  const totalMinutes = timeLogs.reduce((sum: number, log: any) => sum + (log.duration_minutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="px-5 py-4">
      <div className="mb-4 rounded-lg bg-zinc-50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Logged</p>
        <p className="mt-1 text-[20px] font-bold tabular-nums text-zinc-900">{totalHours}h</p>
      </div>

      {timeLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
          <Timer size={24} className="mb-2" />
          <p className="text-[12px]">No time logged</p>
        </div>
      ) : (
        <div className="space-y-2">
          {timeLogs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <User size={12} />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-medium text-zinc-700">{log.description || 'No description'}</p>
                <p className="text-[10px] text-zinc-400">
                  {new Date(log.start_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </p>
              </div>
              <span className="text-[12px] font-bold tabular-nums text-zinc-700">
                {log.duration_minutes ? `${(log.duration_minutes / 60).toFixed(1)}h` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// ACTIVITY TAB
// ============================================

function TaskActivityTab({ activities }: { activities: any[] }) {
  return (
    <div className="px-5 py-4">
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
          <Activity size={24} className="mb-2" />
          <p className="text-[12px]">No activity yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <Activity size={12} />
              </div>
              <div>
                <p className="text-[12px] text-zinc-600">
                  <span className="font-medium text-zinc-700">User</span>{' '}
                  {activity.action.replace(/_/g, ' ')}
                </p>
                <p className="text-[10px] text-zinc-400">
                  {new Date(activity.created_at).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
