// src/screens/Collaboration.tsx
// Mobile Collaboration module — "Slack for ERP".
// Optimized for mobile: 3-level drill-down (channel list → chat → thread sheet),
// sticky composer, thumb-reachable actions, safe-area aware.
// Uses the mobile design system: glass-card, HSL tokens, Inter, rounded-2xl.
// Micro-animations via framer-motion (staggered lists, message pop-in, sheet spring).

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash, Lock, ChevronLeft, Send, Loader2, Search, MessageSquare,
  Reply, X, AlertCircle, Wifi, WifiOff,
  CheckSquare, Bookmark, Bell, Calendar, Trash2,
  AtSign, Paperclip, FileText, Download,
} from 'lucide-react';
import { toastSuccess, toastError } from '../components/Toast';
import {
  getSessionContext,
  fetchChannels,
  fetchLatestMessageForChannels,
  fetchMessagesPage,
  fetchThread,
  sendMessage,
  addReaction,
  removeReaction,
  fetchReactionsForMessages,
  markChannelRead,
  fetchChannelMembers,
  fetchUserProfiles,
  subscribeToChannel,
  createTaskAndPostCard,
  createPersonalTaskFromMessage,
  createReminderFromMessage,
  softDeleteMessage,
  fetchUnreadCounts,
  fetchAttachmentsForMessages,
  uploadAttachment,
  addAttachment,
  createSignedUrl,
  buildAttachmentPath,
  COLLAB_ATTACHMENT_BUCKET,
  type Channel,
  type Message,
  type Reaction,
  type SessionContext,
  type AttachmentRow,
  type UnreadInfo,
} from '../lib/collab';

interface CollaborationProps {
  isDemo?: boolean;
}

// ── Animation presets (shared micro-animation language) ─────────────────────

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 };
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

const listItem = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
};

// ── Small helpers ────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const QUICK_EMOJIS = ['👍', '✅', '🔥', '🎉', '❤️', '👀'];

const CHANNEL_TYPE_META: Record<string, { color: string; bg: string }> = {
  general: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  company: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  project: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  site_coordination: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  design: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
  procurement: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
  commercial: { color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10' },
  custom: { color: 'text-muted-foreground', bg: 'bg-secondary' },
};

const TYPE_LABELS: Record<string, string> = {
  general: 'General',
  company: 'Company',
  project: 'Project',
  site_coordination: 'Site',
  design: 'Design',
  procurement: 'Procurement',
  commercial: 'Commercial',
  custom: 'Channel',
};

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Parse a collaboration message into task fields (mirrors web utils.parseTaskFromMessage). */
function parseTaskFromMessage(content: string) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const rawTitle = lines[0] || 'Task from message';
  const title = rawTitle.length > 80 ? rawTitle.slice(0, 77) + '…' : rawTitle;

  const checklistTitles: string[] = [];
  lines.forEach((line) => {
    const match = line.match(/^[-*•]\s*(?:\[[ x]\]\s*)?(.+)$/i) || line.match(/^\d+[.)]\s*(.+)$/);
    if (match && match[1]?.trim()) {
      checklistTitles.push(match[1].trim());
    }
  });

  return {
    title,
    description: `${content}\n\n[Created from collaboration message]`,
    checklistTitles: checklistTitles.length > 0 ? checklistTitles : undefined,
  };
}

/** Format a Date for a datetime-local input. */
function toLocalInput(d: Date): string {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Highlight @[Full Name] / @name mentions in message text (mirrors web). */
function renderContentWithMentions(content: string) {
  if (!content.includes('@')) return content;
  const regex = /(@\[[^\]]+\]|@[A-Za-z0-9_.-]+)/g;
  const parts = content.split(regex);
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      const display = part.startsWith('@[') && part.endsWith(']') ? '@' + part.slice(2, -1) : part;
      return (
        <span key={i} className="bg-white/25 text-inherit font-bold px-1 rounded mx-0.5">
          {display}
        </span>
      );
    }
    return part;
  });
}

const AVATAR_COLORS = [
  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  'bg-teal-500/15 text-teal-600 dark:text-teal-400',
];

// ── System message cards (mirrors web TaskCard / ReminderCard, read-only) ────

const TASK_STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  not_started: { label: 'Not Started', bg: 'bg-secondary', text: 'text-muted-foreground', dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  under_review: { label: 'Under Review', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  completed: { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  on_hold: { label: 'On Hold', bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
};

const PRIORITY_META: Record<string, { label: string; text: string }> = {
  low: { label: 'Low', text: 'text-muted-foreground' },
  medium: { label: 'Medium', text: 'text-blue-600 dark:text-blue-400' },
  high: { label: 'High', text: 'text-amber-600 dark:text-amber-400' },
  critical: { label: 'Critical', text: 'text-red-600 dark:text-red-400 font-bold' },
  urgent: { label: 'Urgent', text: 'text-red-600 dark:text-red-400 font-bold' },
};

function CollabTaskCard({ message }: { message: Message }) {
  const entity = (message.metadata?.linked_entities ?? [])[0] as { type?: string; id?: string; label?: string; snapshot?: Record<string, any> } | undefined;
  if (!entity) return null;
  const meta = (entity.snapshot ?? {}) as Record<string, any>;
  const status = TASK_STATUS_META[meta.status] ?? TASK_STATUS_META.not_started;
  const priority = PRIORITY_META[meta.priority] ?? PRIORITY_META.medium;
  const isDone = meta.status === 'completed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING}
      className={`mx-2 my-1.5 rounded-2xl border p-3.5 ${
        isDone ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-primary/20 bg-primary/5'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-500/15 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
          <CheckSquare className="h-4 w-4" />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Task</span>
        <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md ${priority.text}`}>{priority.label}</span>
      </div>
      <p className={`text-sm font-semibold leading-snug ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {entity.label || meta.title || 'Task'}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        {meta.due_date && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            <Calendar className="h-3 w-3" />
            {new Date(meta.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      <p className="text-[9px] text-muted-foreground/60 mt-1.5">Manage this task from the web app or the Tasks module</p>
    </motion.div>
  );
}

function CollabReminderCard({ message }: { message: Message }) {
  const entity = (message.metadata?.linked_entities ?? [])[0] as { type?: string; id?: string; label?: string; snapshot?: Record<string, any> } | undefined;
  if (!entity) return null;
  const meta = (entity.snapshot ?? {}) as Record<string, any>;
  const isDone = meta.status === 'completed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING}
      className="mx-2 my-1.5 rounded-2xl border border-purple-500/25 bg-purple-500/5 p-3.5"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-7 w-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Reminder</span>
        {isDone && (
          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">Done</span>
        )}
      </div>
      <p className={`text-sm font-semibold leading-snug ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {entity.label || meta.title || 'Reminder'}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {meta.remind_at && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
            <Calendar className="h-3 w-3" />
            {new Date(meta.remind_at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
        {meta.recipient_name && (
          <span className="text-[10px] font-semibold text-muted-foreground">
            → {meta.recipient_name}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Component ────────────────────────────────────────────────────────────────

export function Collaboration({ isDemo = false }: CollaborationProps) {
  // Navigation state: list → chat → thread
  const [view, setView] = useState<'list' | 'chat'>('list');
  const [threadParent, setThreadParent] = useState<Message | null>(null);

  const [ctx, setCtx] = useState<SessionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [connected, setConnected] = useState(true);

  // Data
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelPreviews, setChannelPreviews] = useState<Record<string, Message>>({});
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Composer
  const [draft, setDraft] = useState('');
  const [threadDraft, setThreadDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null); // message id for emoji sheet

  // Long-press action sheet
  const [actionFor, setActionFor] = useState<Message | null>(null);

  // Create Task sheet
  const [taskSheetFor, setTaskSheetFor] = useState<Message | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskChecklist, setTaskChecklist] = useState<string[]>([]);
  const [creatingTask, setCreatingTask] = useState(false);

  // Set Reminder sheet
  const [reminderSheetFor, setReminderSheetFor] = useState<Message | null>(null);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [reminderRecipient, setReminderRecipient] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [creatingReminder, setCreatingReminder] = useState(false);
  const [channelMembersList, setChannelMembersList] = useState<{ user_id: string; full_name: string | null }[]>([]);

  // Unread badges (per channel)
  const [unread, setUnread] = useState<Record<string, UnreadInfo>>({});

  // Mentions (@ autocomplete)
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionMatchStart, setMentionMatchStart] = useState(-1);
  const [selectedMentions, setSelectedMentions] = useState<Map<string, string>>(new Map()); // id -> name
  const [threadMentionOpen, setThreadMentionOpen] = useState(false);
  const [threadMentionQuery, setThreadMentionQuery] = useState('');
  const [threadMentionMatchStart, setThreadMentionMatchStart] = useState(-1);
  const [threadSelectedMentions, setThreadSelectedMentions] = useState<Map<string, string>>(new Map());

  // Attachments
  const [staged, setStaged] = useState<{ id: string; file: File; previewUrl?: string }[]>([]);
  const [attachments, setAttachments] = useState<Record<string, AttachmentRow[]>>({}); // by message id
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Demo data
  const [demoChannels] = useState<Channel[]>(() => [
    { id: 'demo-ch-general', organisation_id: 'demo', project_id: null, channel_type: 'general', name: 'general', description: 'Company-wide chatter', is_archived: false, visibility: 'company', join_policy: 'all', created_at: '', updated_at: '' },
    { id: 'demo-ch-mle', organisation_id: 'demo', project_id: 'demo-p1', channel_type: 'project', name: 'metro-line-expansion', description: 'Metro Line Expansion', is_archived: false, visibility: 'company', join_policy: 'all', created_at: '', updated_at: '' },
    { id: 'demo-ch-site', organisation_id: 'demo', project_id: null, channel_type: 'site_coordination', name: 'site-coordination', description: 'Daily site sync', is_archived: false, visibility: 'company', join_policy: 'all', created_at: '', updated_at: '' },
    { id: 'demo-ch-proc', organisation_id: 'demo', project_id: null, channel_type: 'procurement', name: 'procurement', description: 'POs and vendors', is_archived: false, visibility: 'company', join_policy: 'all', created_at: '', updated_at: '' },
  ]);
  const [demoMessages] = useState<Record<string, Message[]>>(() => ({
    'demo-ch-general': [
      { id: 'demo-m1', organisation_id: 'demo', channel_id: 'demo-ch-general', sender_id: 'demo-u2', sender_name: 'Priya Sharma', parent_message_id: null, message_type: 'text', content: 'Morning team! Cement delivery for CCB-12 confirmed for 8 AM tomorrow. 🚚', metadata: {}, client_msg_id: null, edited_at: null, deleted_at: null, created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString() },
      { id: 'demo-m2', organisation_id: 'demo', channel_id: 'demo-ch-general', sender_id: 'demo-u3', sender_name: 'Rahul Verma', parent_message_id: null, message_type: 'text', content: 'Great — I will inform the site supervisor to keep the unloading area clear.', metadata: {}, client_msg_id: null, edited_at: null, deleted_at: null, created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
      { id: 'demo-m3', organisation_id: 'demo', channel_id: 'demo-ch-general', sender_id: 'demo-u2', sender_name: 'Priya Sharma', parent_message_id: null, message_type: 'text', content: 'Also: the electrical subcontractor asked for an extra week on conduit work. Flagging for approval.', metadata: {}, client_msg_id: null, edited_at: null, deleted_at: null, created_at: new Date(Date.now() - 1000 * 60 * 6).toISOString() },
    ],
    'demo-ch-mle': [
      { id: 'demo-m4', organisation_id: 'demo', channel_id: 'demo-ch-mle', sender_id: 'demo-u3', sender_name: 'Rahul Verma', parent_message_id: null, message_type: 'text', content: 'Piling work on segment 4 is 80% complete. Curing time will finish by Friday.', metadata: {}, client_msg_id: null, edited_at: null, deleted_at: null, created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
      { id: 'demo-m5', organisation_id: 'demo', channel_id: 'demo-ch-mle', sender_id: 'demo-u1', sender_name: 'Demo User', parent_message_id: null, message_type: 'text', content: 'Excellent. Let us keep the daily site report updated with the curing schedule.', metadata: {}, client_msg_id: null, edited_at: null, deleted_at: null, created_at: new Date(Date.now() - 1000 * 60 * 75).toISOString() },
    ],
    'demo-ch-site': [],
    'demo-ch-proc': [],
  }));
  const demoUser = { id: 'demo-u1', name: 'Demo User' };

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isDemo) {
      setChannels(demoChannels);
      setChannelPreviews(buildPreviews(demoChannels, demoMessages));
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const session = await getSessionContext();
        if (!session) {
          if (!cancelled) {
            setError('No organization associated with this account');
            setLoading(false);
          }
          return;
        }
        if (cancelled) return;
        setCtx(session);
        const chans = await fetchChannels(session.orgId);
        if (cancelled) return;
        setChannels(chans);
        const previews = await fetchLatestMessageForChannels(chans.map((c) => c.id));
        if (!cancelled) setChannelPreviews(previews);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load channels');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isDemo]);

  function buildPreviews(chs: Channel[], msgs: Record<string, Message[]>): Record<string, Message> {
    const out: Record<string, Message> = {};
    for (const c of chs) {
      const list = msgs[c.id];
      if (list && list.length > 0) out[c.id] = list[0];
    }
    return out;
  }

  // ── Open a channel ─────────────────────────────────────────────────────────

  const openChannel = useCallback(async (channel: Channel) => {
    setActiveChannel(channel);
    setView('chat');
    setMessages([]);
    setError(null);

    if (isDemo) {
      setMessages(demoMessages[channel.id] ?? []);
      return;
    }
    if (!ctx) return;

    setLoadingMessages(true);
    try {
      const page = await fetchMessagesPage(channel.id, null);
      setMessages(page.items);
      // Mark read up to newest
      if (page.items[0]) {
        markChannelRead(channel.id, page.items[0].id).catch(() => {});
      }
      // Member count (non-fatal)
      fetchChannelMembers(channel.id)
        .then((members) => setMemberCount(members.length))
        .catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, [ctx, isDemo, demoMessages]);

  // ── Realtime subscription while a channel is open ──────────────────────────

  useEffect(() => {
    if (isDemo || !activeChannel) return;

    const upsert = (m: Message) => {
      if (m.parent_message_id) {
        if (threadParent?.id === m.parent_message_id) {
          setThreadReplies((prev) => {
            if (prev.some((r) => r.id === m.id)) return prev;
            return [...prev, m];
          });
        }
        return;
      }
      setMessages((prev) => {
        // Replace optimistic placeholder
        const cmid = m.client_msg_id;
        let replaced = false;
        const next = prev.map((existing) => {
          if (cmid && existing.id.startsWith('optimistic:') && existing.client_msg_id === cmid) {
            replaced = true;
            return m;
          }
          return existing;
        });
        if (replaced) return next;
        if (next.some((x) => x.id === m.id)) return next;
        return [m, ...next];
      });
    };

    const unsub = subscribeToChannel(activeChannel.id, {
      onMessageInsert: (raw) => {
        // Realtime rows carry raw user ids — enrich with profile names, then upsert.
        if (raw.sender_name || raw.sender_id === (ctx?.userId ?? '')) {
          upsert(raw);
        } else {
          fetchUserProfiles([raw.sender_id])
            .then((profiles) => {
              const p = profiles[raw.sender_id];
              upsert({ ...raw, sender_name: p?.full_name ?? null, sender_avatar_url: p?.avatar_url ?? null });
            })
            .catch(() => upsert(raw));
        }
      },
      onMessageUpdate: (m) => setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x))),
      onMessageDelete: (id) => setMessages((prev) => prev.filter((x) => x.id !== id)),
      onReactionsChange: () => {
        // Refresh reactions for currently loaded messages
        const ids = messagesRef.current.map((m) => m.id).filter((i) => !i.startsWith('optimistic:'));
        fetchReactionsForMessages(ids).then((rows) => {
          const map: Record<string, Reaction[]> = {};
          for (const r of rows) {
            if (!map[r.message_id]) map[r.message_id] = [];
            map[r.message_id].push(r);
          }
          setReactions(map);
        }).catch(() => {});
      },
    });

    subRef.current = unsub;
    setConnected(true);
    return () => {
      unsub();
      subRef.current = null;
    };
  }, [activeChannel?.id, isDemo]);

  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const subRef = useRef<(() => void) | null>(null);

  // Load reactions when messages change
  useEffect(() => {
    if (isDemo || !activeChannel) return;
    const ids = messages.map((m) => m.id).filter((i) => !i.startsWith('optimistic:'));
    if (ids.length === 0) return;
    let cancelled = false;
    fetchReactionsForMessages(ids)
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, Reaction[]> = {};
        for (const r of rows) {
          if (!map[r.message_id]) map[r.message_id] = [];
          map[r.message_id].push(r);
        }
        setReactions(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [messages.length, activeChannel?.id, isDemo]);

  // ── Thread ─────────────────────────────────────────────────────────────────

  const openThread = useCallback(async (message: Message) => {
    setThreadParent(message);
    setThreadReplies([]);
    if (isDemo) {
      setThreadReplies([]);
      return;
    }
    try {
      const replies = await fetchThread(message.id);
      setThreadReplies(replies);
    } catch {
      // Non-fatal; thread shows empty state
    }
  }, [isDemo]);

  // ── Send ───────────────────────────────────────────────────────────────────

  /** Upload staged files, attach them to the saved message. Best-effort per file. */
  const uploadAndAttach = useCallback(async (messageId: string, items: { id: string; file: File }[]) => {
    if (!ctx || items.length === 0) return;
    for (const item of items) {
      const path = buildAttachmentPath({
        organisationId: ctx.orgId,
        channelId: activeChannel?.id ?? '',
        messageId,
        fileName: item.file.name,
      });
      try {
        await uploadAttachment(COLLAB_ATTACHMENT_BUCKET, path, item.file);
        await addAttachment({
          messageId,
          storageBucket: COLLAB_ATTACHMENT_BUCKET,
          storagePath: path,
          fileName: item.file.name,
          fileSize: item.file.size,
          mimeType: item.file.type || null,
        });
      } catch {
        toastError(`Upload failed: ${item.file.name}`);
      }
    }
  }, [ctx, activeChannel]);

  /** Collect mention user-ids still present in the text (mirrors web Composer.submit). */
  const collectMentions = useCallback((map: Map<string, string>, text: string): string[] => {
    const ids: string[] = [];
    map.forEach((name, id) => {
      if (text.includes(`@${name}`) || text.includes(`@[${name}]`)) ids.push(id);
    });
    return ids;
  }, []);

  // ── Mention autocomplete (main composer) ──────────────────────────────────

  const handleDraftChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraft(val);

    const cursor = e.target.selectionStart;
    const beforeCursor = val.slice(0, cursor);
    const lastAt = beforeCursor.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || /[\s\n]/.test(beforeCursor[lastAt - 1]))) {
      const query = beforeCursor.slice(lastAt + 1);
      if (!query.includes('\n') && query.length <= 25) {
        setMentionOpen(true);
        setMentionQuery(query);
        setMentionMatchStart(lastAt);
        return;
      }
    }
    setMentionOpen(false);
  }, []);

  const selectMember = useCallback((member: { user_id: string; full_name: string | null }) => {
    const rawName = member.full_name?.trim() || 'user';
    const before = draft.slice(0, mentionMatchStart);
    const after = draft.slice((mentionMatchStart + mentionQuery.length + 1));
    const inserted = rawName.includes(' ') ? `@[${rawName}] ` : `@${rawName} `;
    setDraft(before + inserted + after);
    setSelectedMentions((prev) => new Map(prev).set(member.user_id, rawName));
    setMentionOpen(false);
  }, [draft, mentionMatchStart, mentionQuery]);

  // ── Mention autocomplete (thread composer) ─────────────────────────────────

  const handleThreadDraftChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setThreadDraft(val);

    const cursor = e.target.selectionStart ?? 0;
    const beforeCursor = val.slice(0, cursor);
    const lastAt = beforeCursor.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || /[\s\n]/.test(beforeCursor[lastAt - 1]))) {
      const query = beforeCursor.slice(lastAt + 1);
      if (!query.includes('\n') && query.length <= 25) {
        setThreadMentionOpen(true);
        setThreadMentionQuery(query);
        setThreadMentionMatchStart(lastAt);
        return;
      }
    }
    setThreadMentionOpen(false);
  }, []);

  const selectThreadMember = useCallback((member: { user_id: string; full_name: string | null }) => {
    const rawName = member.full_name?.trim() || 'user';
    const before = threadDraft.slice(0, threadMentionMatchStart);
    const after = threadDraft.slice(threadMentionMatchStart + threadMentionQuery.length + 1);
    const inserted = rawName.includes(' ') ? `@[${rawName}] ` : `@${rawName} `;
    setThreadDraft(before + inserted + after);
    setThreadSelectedMentions((prev) => new Map(prev).set(member.user_id, rawName));
    setThreadMentionOpen(false);
  }, [threadDraft, threadMentionMatchStart, threadMentionQuery]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if ((!text && staged.length === 0) || !activeChannel || sending) return;
    setSending(true);
    setDraft('');
    const filesToSend = staged;
    setStaged([]);
    setSelectedMentions(new Map());
    setMentionOpen(false);

    if (isDemo) {
      const optimistic: Message = {
        id: `demo-${Date.now()}`,
        organisation_id: 'demo',
        channel_id: activeChannel.id,
        sender_id: demoUser.id,
        sender_name: demoUser.name,
        parent_message_id: null,
        message_type: 'text',
        content: text,
        metadata: {},
        client_msg_id: null,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [optimistic, ...prev]);
      setChannelPreviews((prev) => ({ ...prev, [activeChannel.id]: optimistic }));
      setSending(false);
      return;
    }

    const clientMsgId = crypto.randomUUID();
    const optimistic: Message = {
      id: `optimistic:${clientMsgId}`,
      organisation_id: ctx?.orgId ?? '',
      channel_id: activeChannel.id,
      sender_id: ctx?.userId ?? '',
      parent_message_id: null,
      message_type: 'text',
      content: text,
      metadata: { client_msg_id: clientMsgId },
      client_msg_id: clientMsgId,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimistic, ...prev]);

    try {
      const saved = await sendMessage({
        channelId: activeChannel.id,
        content: text,
        parentMessageId: null,
        clientMsgId,
        mentions: collectMentions(selectedMentions, text),
      });
      await uploadAndAttach(saved.id, filesToSend);
      // Realtime usually reconciles this; do it optimistically too.
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === `optimistic:${clientMsgId}` ? saved : m));
        return next.some((m) => m.id === saved.id) ? next.filter((m, i) => next.findIndex((x) => x.id === m.id) === i) : next;
      });
      setChannelPreviews((prev) => ({ ...prev, [activeChannel.id]: saved }));
      if (filesToSend.length > 0) {
        fetchAttachmentsForMessages([saved.id])
          .then((rows) => setAttachments((prev) => ({ ...prev, [saved.id]: rows })))
          .catch(() => {});
      }
    } catch (err: any) {
      // Keep optimistic bubble; user sees failure via message state
      setError(err?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [draft, staged, activeChannel, sending, ctx, isDemo, selectedMentions, collectMentions, uploadAndAttach]);

  const handleSendThreadReply = useCallback(async () => {
    const text = threadDraft.trim();
    if (!text || !threadParent || !activeChannel || sending) return;
    setSending(true);
    setThreadDraft('');

    const clientMsgId = crypto.randomUUID();
    const optimistic: Message = {
      id: `optimistic:${clientMsgId}`,
      organisation_id: ctx?.orgId ?? '',
      channel_id: activeChannel.id,
      sender_id: ctx?.userId ?? '',
      sender_name: 'You',
      parent_message_id: threadParent.id,
      message_type: 'text',
      content: text,
      metadata: { client_msg_id: clientMsgId },
      client_msg_id: clientMsgId,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
    };
    setThreadReplies((prev) => [...prev, optimistic]);

    if (isDemo) {
      setSending(false);
      return;
    }

    try {
      const saved = await sendMessage({
        channelId: activeChannel.id,
        content: text,
        parentMessageId: threadParent.id,
        clientMsgId,
        mentions: collectMentions(threadSelectedMentions, text),
      });
      setThreadReplies((prev) => prev.map((m) => (m.id === `optimistic:${clientMsgId}` ? saved : m)));
      setThreadSelectedMentions(new Map());
      // Refresh thread count on parent
      const replies = await fetchThread(threadParent.id);
      setThreadReplies(replies);
    } catch (err: any) {
      setError(err?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }, [threadDraft, threadParent, activeChannel, sending, ctx, isDemo, threadSelectedMentions, collectMentions]);

  // ── Reactions ──────────────────────────────────────────────────────────────

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    setPickerFor(null);
    if (isDemo) return;
    const mine = reactions[messageId]?.some((r) => r.user_id === ctx?.userId && r.emoji === emoji);
    // Optimistic toggle
    setReactions((prev) => {
      const list = prev[messageId] ?? [];
      if (mine) {
        return { ...prev, [messageId]: list.filter((r) => !(r.user_id === ctx?.userId && r.emoji === emoji)) };
      }
      return {
        ...prev,
        [messageId]: [...list, { id: `tmp-${Date.now()}`, message_id: messageId, user_id: ctx?.userId ?? '', emoji }],
      };
    });
    try {
      if (mine) {
        await removeReaction(messageId, emoji);
      } else {
        await addReaction(messageId, emoji);
      }
    } catch {
      // Reconcile on next realtime ping / load
    }
  }, [reactions, ctx, isDemo]);

  // ── Task / Reminder actions (mirrors web MessageBubble) ─────────────────

  const openActionSheet = useCallback((message: Message) => {
    if (message.deleted_at) return;
    setActionFor(message);
  }, []);

  // Long-press detection (cross-platform: touch + mouse + pen via Pointer Events).
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  const startPress = useCallback((message: Message) => (e: React.PointerEvent) => {
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      // Haptic tick where supported (Android Chrome)
      try { navigator.vibrate?.(12); } catch { /* noop */ }
      openActionSheet(message);
    }, 450);
  }, [openActionSheet]);

  const cancelPress = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const movePress = useCallback((e: React.PointerEvent) => {
    // Cancel if the finger drifted (user is scrolling, not pressing).
    const start = pressStartRef.current;
    if (start && (Math.abs(e.clientX - start.x) > 10 || Math.abs(e.clientY - start.y) > 10)) {
      cancelPress();
    }
  }, [cancelPress]);

  const handleAddToMyTask = useCallback(async (message: Message) => {
    setActionFor(null);
    if (isDemo) {
      toastSuccess('✓ Added to My Tasks');
      return;
    }
    try {
      await createPersonalTaskFromMessage(message.id);
      toastSuccess('✓ Added to My Tasks');
    } catch {
      toastError('Failed to add to personal tasks');
    }
  }, [isDemo]);

  const openCreateTask = useCallback((message: Message) => {
    setActionFor(null);
    const parsed = parseTaskFromMessage(message.content);
    setTaskTitle(parsed.title);
    setTaskDescription(parsed.description);
    setTaskChecklist(parsed.checklistTitles ?? []);
    setTaskPriority('medium');
    setTaskDueDate('');
    setTaskSheetFor(message);
  }, []);

  const submitCreateTask = useCallback(async () => {
    if (!taskTitle.trim() || !activeChannel || !ctx) return;
    setCreatingTask(true);
    try {
      if (isDemo) {
        // Simulate: post a system task-card message into the demo channel.
        const card: Message = {
          id: `demo-task-${Date.now()}`,
          organisation_id: 'demo',
          channel_id: activeChannel.id,
          sender_id: ctx.userId,
          sender_name: 'System',
          parent_message_id: null,
          message_type: 'system',
          content: `Created task: ${taskTitle.trim()}`,
          metadata: {
            linked_entities: [{
              type: 'task',
              id: `demo-task-ent-${Date.now()}`,
              label: taskTitle.trim(),
              snapshot: { title: taskTitle.trim(), status: 'not_started', priority: taskPriority, due_date: taskDueDate || null },
            }],
          },
          client_msg_id: null,
          edited_at: null,
          deleted_at: null,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [card, ...prev]);
        toastSuccess('✓ Task created');
      } else {
        await createTaskAndPostCard({
          organisationId: ctx.orgId,
          projectId: activeChannel.project_id,
          channelId: activeChannel.id,
          title: taskTitle.trim(),
          description: taskDescription.trim() || null,
          priority: taskPriority,
          dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : null,
          assigneeIds: ctx.userId ? [ctx.userId] : [],
          checklistTitles: taskChecklist,
          createdBy: ctx.userId,
        });
        toastSuccess('✓ Task created');
      }
      setTaskSheetFor(null);
    } catch (err: any) {
      toastError(err?.message || 'Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  }, [taskTitle, taskDescription, taskPriority, taskDueDate, taskChecklist, activeChannel, ctx, isDemo]);

  const openSetReminder = useCallback((message: Message) => {
    setActionFor(null);
    const parsed = parseTaskFromMessage(message.content);
    setReminderTitle(parsed.title);
    setReminderNotes(message.content);
    setReminderRecipient(ctx?.userId ?? '');
    setReminderAt('');
    setReminderSheetFor(message);
    // Load channel members for the recipient picker (non-fatal)
    if (!isDemo && activeChannel) {
      fetchChannelMembers(activeChannel.id)
        .then((members) => setChannelMembersList(members.map((m) => ({ user_id: m.user_id, full_name: m.full_name }))))
      .catch(() => {});
    }
  }, [ctx, isDemo, activeChannel]);

  // Load channel members when a channel opens (for @mentions)
  useEffect(() => {
    if (isDemo || !activeChannel) {
      if (isDemo) {
        setChannelMembersList([
          { user_id: 'demo-u2', full_name: 'Priya Sharma' },
          { user_id: 'demo-u3', full_name: 'Rahul Verma' },
          { user_id: 'demo-u1', full_name: 'Demo User' },
        ]);
      }
      return;
    }
    fetchChannelMembers(activeChannel.id)
      .then((members) => setChannelMembersList(members.map((m) => ({ user_id: m.user_id, full_name: m.full_name }))))
      .catch(() => {});
  }, [activeChannel?.id, isDemo]);

  const submitSetReminder = useCallback(async () => {
    if (!reminderTitle.trim() || !reminderSheetFor || !activeChannel || !ctx) return;
    setCreatingReminder(true);
    try {
      const isoRemindAt = reminderAt ? new Date(reminderAt).toISOString() : null;
      const recipientName = reminderRecipient === ctx.userId
        ? 'Myself'
        : (channelMembersList.find((m) => m.user_id === reminderRecipient)?.full_name ?? 'Team member');

      if (isDemo) {
        const card: Message = {
          id: `demo-rem-${Date.now()}`,
          organisation_id: 'demo',
          channel_id: activeChannel.id,
          sender_id: ctx.userId,
          sender_name: 'System',
          parent_message_id: null,
          message_type: 'system',
          content: `Reminder set: ${reminderTitle.trim()}`,
          metadata: {
            linked_entities: [{
              type: 'reminder',
              id: `demo-rem-ent-${Date.now()}`,
              label: reminderTitle.trim(),
              snapshot: { title: reminderTitle.trim(), remind_at: isoRemindAt, recipient_name: recipientName, status: 'pending' },
            }],
          },
          client_msg_id: null,
          edited_at: null,
          deleted_at: null,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [card, ...prev]);
      } else {
        const created = await createReminderFromMessage({
          messageId: reminderSheetFor.id,
          recipientId: reminderRecipient || ctx.userId,
          title: reminderTitle.trim(),
          notes: reminderNotes.trim() || null,
          remindAt: isoRemindAt,
        });
        // Post system card message into the channel (same as web ReminderCreateDrawer).
        await sendMessage({
          channelId: activeChannel.id,
          content: `Reminder set: ${reminderTitle.trim()}`,
          parentMessageId: null,
          clientMsgId: crypto.randomUUID(),
          messageType: 'system',
          linkedEntities: [{
            type: 'reminder',
            id: created.id,
            label: reminderTitle.trim(),
            snapshot: {
              title: reminderTitle.trim(),
              remind_at: isoRemindAt,
              recipient_name: recipientName,
              status: 'pending',
            },
          }],
        });
      }
      toastSuccess('✓ Reminder set');
      setReminderSheetFor(null);
    } catch (err: any) {
      toastError(err?.message || 'Failed to set reminder');
    } finally {
      setCreatingReminder(false);
    }
  }, [reminderTitle, reminderNotes, reminderRecipient, reminderAt, reminderSheetFor, activeChannel, ctx, channelMembersList, isDemo]);

  const handleDeleteMessage = useCallback(async (message: Message) => {
    setActionFor(null);
    if (isDemo) {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      toastSuccess('Message deleted');
      return;
    }
    try {
      await softDeleteMessage(message.id);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      toastSuccess('Message deleted');
    } catch {
      toastError('Failed to delete message');
    }
  }, [isDemo]);

  // ── Unread counts + attachments loading ───────────────────────────────────

  const loadUnread = useCallback(async () => {
    if (isDemo || !ctx || channels.length === 0) return;
    try {
      const info = await fetchUnreadCounts(ctx.orgId, ctx.userId, channels.map((c) => c.id));
      setUnread(info);
    } catch {
      // Non-fatal
    }
  }, [isDemo, ctx, channels]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  const openAttachment = useCallback(async (att: AttachmentRow) => {
    setOpeningFile(att.id);
    try {
      const url = await createSignedUrl(att.storage_bucket, att.storage_path, 3600);
      window.open(url, '_blank');
    } catch {
      toastError('Could not open file');
    } finally {
      setOpeningFile(null);
    }
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredChannels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q),
    );
  }, [channels, searchQuery]);

  // For chat display: oldest at top → reverse the newest-first list
  const chatMessages = useMemo(() => [...messages].reverse(), [messages]);

  // Mention autocomplete list (main composer + thread composer)
  const mentionCandidates = useMemo(() => {
    const q = mentionQuery.toLowerCase().trim();
    const all = channelMembersList;
    if (!q) return all.slice(0, 8);
    return all.filter((m) => (m.full_name ?? '').toLowerCase().includes(q)).slice(0, 8);
  }, [channelMembersList, mentionQuery]);

  const threadMentionCandidates = useMemo(() => {
    const q = threadMentionQuery.toLowerCase().trim();
    const all = channelMembersList;
    if (!q) return all.slice(0, 8);
    return all.filter((m) => (m.full_name ?? '').toLowerCase().includes(q)).slice(0, 8);
  }, [channelMembersList, threadMentionQuery]);

  // Thread reply counts for root messages (loaded lazily, like web ThreadSummary)
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (isDemo || !activeChannel || messages.length === 0) return;
    let cancelled = false;
    // Only root messages without a cached count
    const roots = messages.filter((m) => threadCounts[m.id] === undefined).slice(0, 15);
    if (roots.length === 0) return;
    Promise.all(
      roots.map(async (m) => {
        try {
          const replies = await fetchThread(m.id);
          return [m.id, replies.length] as const;
        } catch {
          return [m.id, 0] as const;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setThreadCounts((prev) => {
        const next = { ...prev };
        for (const [id, n] of pairs) next[id] = n;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [messages, activeChannel?.id, isDemo]);

  // Attachments for loaded messages
  useEffect(() => {
    if (isDemo || !activeChannel || messages.length === 0) return;
    const ids = messages.filter((m) => !m.id.startsWith('optimistic:') && !m.id.startsWith('demo-')).map((m) => m.id);
    if (ids.length === 0) return;
    let cancelled = false;
    fetchAttachmentsForMessages(ids)
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, AttachmentRow[]> = {};
        for (const r of rows) {
          (map[r.message_id] ??= []).push(r);
        }
        setAttachments((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [messages.length, activeChannel?.id, isDemo]);

  // Auto-scroll: keep newest message visible without user scrolling.
  const listRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const scrollToBottom = useCallback((smooth = false) => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  useEffect(() => {
    // Jump to bottom when a channel opens or the count grows while near bottom
    if (isNearBottomRef.current) scrollToBottom(messages.length > 0);
  }, [messages.length, scrollToBottom]);

  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    /* h-dvh + overflow-hidden: the screen never scrolls as a page — only the
       message list / channel list scroll inside it. This keeps the chat header
       (channel title) and composer permanently in view.
       pb reserves room for the fixed bottom nav (h-16) + iOS safe area. */
    <div className="h-dvh bg-background max-w-lg mx-auto flex flex-col overflow-hidden relative pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {/* Animated view switch (list ↔ chat) */}
      <AnimatePresence mode="wait" initial={false}>
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Header */}
            <header className="px-4 pt-10 pb-3 flex items-center justify-between border-b border-border bg-card">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Collab
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">Team channels & discussions</p>
              </div>
              <motion.div
                className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}
                animate={connected ? { scale: [1, 1.25, 1] } : {}}
                transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 0.7 }}
                title={connected ? 'Live' : 'Offline'}
              />
            </header>

            {/* Search */}
            <div className="px-4 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search channels..."
                  className="w-full pl-9 pr-4 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="mx-4 mt-3 p-3 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Channel list */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-2.5">
              {filteredChannels.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-8 text-center border border-dashed border-border"
                >
                  <Hash className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No channels found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Channels are created on the web app — project channels appear here automatically.
                  </p>
                </motion.div>
              ) : (
                <motion.ul variants={listStagger} initial="hidden" animate="show" className="space-y-2.5">
                  {filteredChannels.map((channel) => {
                    const preview = channelPreviews[channel.id];
                    const meta = CHANNEL_TYPE_META[channel.channel_type] ?? CHANNEL_TYPE_META.custom;
                    return (
                      <motion.li key={channel.id} variants={listItem}>
                        <motion.button
                          onClick={() => openChannel(channel)}
                          whileTap={{ scale: 0.97 }}
                          transition={SPRING}
                          className="w-full glass-card rounded-2xl p-4 text-left border border-border/50 flex items-center gap-3 cursor-pointer"
                        >
                          {/* Channel glyph */}
                          <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
                            {channel.visibility === 'private' ? (
                              <Lock className="h-5 w-5" />
                            ) : (
                              <Hash className="h-5 w-5" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-bold text-foreground truncate">
                                {channel.name}
                              </p>
                              {preview && (
                                <span className="text-[10px] font-medium text-muted-foreground shrink-0 tabular-nums">
                                  {formatRelativeTime(preview.created_at)}
                                </span>
                              )}
                            </div>
                            {preview ? (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {preview.sender_name ? `${preview.sender_name.split(' ')[0]}: ` : ''}
                                {preview.content}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground/60 italic mt-0.5">
                                {channel.description || 'No messages yet — say hi!'}
                              </p>
                            )}
                          </div>

                          {/* Unread badge / Type chip */}
                          {(unread[channel.id]?.count ?? 0) > 0 ? (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={SPRING}
                              className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums shadow-sm shadow-primary/30"
                            >
                              {unread[channel.id]!.count > 99 ? '99+' : unread[channel.id]!.count}
                            </motion.span>
                          ) : (
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${meta.bg} ${meta.color}`}>
                              {TYPE_LABELS[channel.channel_type] ?? 'Channel'}
                            </span>
                          )}
                        </motion.button>
                      </motion.li>
                    );
                  })}
                </motion.ul>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ CHAT VIEW ═══ */}
        {view === 'chat' && activeChannel && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Chat header — sticky by construction: sits outside the scroll
                container and is pinned under the top edge while scrolling. */}
            <header className="px-4 pt-10 pb-3 flex items-center gap-3 border-b border-border bg-card shrink-0">
              <motion.button
                onClick={() => { setView('list'); setActiveChannel(null); }}
                whileTap={{ scale: 0.9 }}
                className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0 cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" />
              </motion.button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-foreground truncate flex items-center gap-1">
                  {activeChannel.visibility === 'private' ? (
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  {activeChannel.name}
                </h1>
                <p className="text-[10px] text-muted-foreground truncate">
                  {activeChannel.description || TYPE_LABELS[activeChannel.channel_type] || 'Channel'}
                  {memberCount > 0 && ` • ${memberCount} members`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {connected ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-red-500" />
                )}
              </div>
            </header>

            {/* Messages — oldest at top, newest pinned above composer.
                The scroll container is this list only; min-h-0 lets it shrink
                within the flex column so header + composer never move. */}
            <div
              ref={listRef}
              onScroll={onListScroll}
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-1.5 pb-4 min-h-0"
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : chatMessages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-8 text-center border border-dashed border-border mt-10"
                >
                  <Hash className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">This is the beginning</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Be the first to message #{activeChannel.name}
                  </p>
                </motion.div>
              ) : (
                <>
                  {messages.length >= 50 && !isDemo && (
                    <div className="text-center py-2">
                      <span className="text-[10px] text-muted-foreground/70">
                        Older messages stay on the web app
                      </span>
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {chatMessages.map((msg) => {
                      // System messages render as rich cards (task/reminder) — no bubble.
                      if (msg.message_type === 'system') {
                        const entity = (msg.metadata?.linked_entities ?? [])[0] as { type?: string } | undefined;
                        if (entity?.type === 'task') {
                          return <CollabTaskCard key={msg.id} message={msg} />;
                        }
                        if (entity?.type === 'reminder') {
                          return <CollabReminderCard key={msg.id} message={msg} />;
                        }
                        return (
                          <motion.p
                            key={msg.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-[11px] text-muted-foreground/70 italic py-1"
                          >
                            {msg.content}
                          </motion.p>
                        );
                      }

                      const isMine = msg.sender_id === (isDemo ? demoUser.id : ctx?.userId);
                      const msgReactions = reactions[msg.id] ?? [];
                      const grouped = msgReactions.reduce<Record<string, string[]>>((acc, r) => {
                        (acc[r.emoji] ??= []).push(r.user_id);
                        return acc;
                      }, {});
                      return (
                        <motion.div
                          key={msg.id}
                          layout
                          initial={{ opacity: 0, y: 16, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={SPRING}
                          className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}
                        >
                          {/* Avatar (others only) */}
                          <div className="shrink-0 pt-1">
                            {isMine ? (
                              <div className="h-8 w-8" />
                            ) : (
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${avatarColorFor(msg.sender_id)}`}>
                                {initialsOf(msg.sender_name)}
                              </div>
                            )}
                          </div>

                          <div className={`flex flex-col max-w-[78%] ${isMine ? 'items-end' : 'items-start'}`}>
                            {/* Name + time */}
                            <div className={`flex items-baseline gap-1.5 mb-0.5 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                              <span className="text-[11px] font-bold text-foreground">
                                {isMine ? 'You' : msg.sender_name || 'Unknown'}
                              </span>
                              <span className="text-[9px] text-muted-foreground/70 tabular-nums">
                                {formatClock(msg.created_at)}
                              </span>
                            </div>

                            {/* Bubble — long-press opens action sheet (Slack-style) */}
                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              onPointerDown={startPress(msg)}
                              onPointerUp={cancelPress}
                              onPointerLeave={cancelPress}
                              onPointerCancel={cancelPress}
                              onPointerMove={movePress}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                openActionSheet(msg);
                              }}
                              className={`rounded-2xl px-3.5 py-2.5 text-left cursor-pointer select-text touch-select-none ${
                                isMine
                                  ? 'bg-primary text-primary-foreground rounded-br-md'
                                  : 'glass-card text-foreground rounded-bl-md border border-border/40'
                              } ${msg.deleted_at ? 'italic opacity-60' : ''}`}
                            >
                              <p className="text-sm leading-snug break-words whitespace-pre-wrap">
                                {msg.deleted_at
                                  ? 'This message was deleted'
                                  : renderContentWithMentions(msg.content)}
                              </p>
                            </motion.button>

                            {/* Attachments (files / PDFs / images) */}
                            {(attachments[msg.id] ?? []).length > 0 && (
                              <div className={`flex flex-col gap-1.5 mt-1.5 ${isMine ? 'items-end' : ''}`}>
                                {(attachments[msg.id] ?? []).map((att) => {
                                  const isImage = att.mime_type?.startsWith('image/');
                                  return (
                                    <motion.button
                                      key={att.id}
                                      whileTap={{ scale: 0.97 }}
                                      onClick={() => openAttachment(att)}
                                      className="flex items-center gap-2 max-w-full glass-card rounded-xl border border-border/50 px-3 py-2 cursor-pointer"
                                    >
                                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                        {isImage ? <FileText className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                      </div>
                                      <div className="min-w-0 text-left">
                                        <p className="text-xs font-semibold text-foreground truncate max-w-[160px]">{att.file_name}</p>
                                        {att.file_size != null && (
                                          <p className="text-[9px] text-muted-foreground">{formatFileSize(att.file_size)}</p>
                                        )}
                                      </div>
                                      {openingFile === att.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                                      ) : (
                                        <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      )}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Reactions row */}
                            {Object.keys(grouped).length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={SPRING}
                                className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : ''}`}
                              >
                                {Object.entries(grouped).map(([emoji, users]) => (
                                  <motion.button
                                    key={emoji}
                                    whileTap={{ scale: 0.8 }}
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                    className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-0.5 cursor-pointer ${
                                      ctx?.userId && users.includes(ctx.userId)
                                        ? 'bg-primary/10 border-primary/30 text-primary'
                                        : 'bg-secondary border-border text-muted-foreground'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="tabular-nums">{users.length}</span>
                                  </motion.button>
                                ))}
                              </motion.div>
                            )}

                            {/* Thread replies / Reply hint */}
                            {(threadCounts[msg.id] ?? 0) > 0 ? (
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => openThread(msg)}
                                className="mt-1.5 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/20 text-[10px] font-bold text-primary cursor-pointer flex items-center gap-1"
                              >
                                <MessageSquare className="h-3 w-3" />
                                {threadCounts[msg.id]} {(threadCounts[msg.id] ?? 0) === 1 ? 'reply' : 'replies'}
                              </motion.button>
                            ) : (
                              <button
                                onClick={() => openThread(msg)}
                                className="mt-1 px-1 text-[10px] font-semibold text-muted-foreground/70 hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Reply className="h-3 w-3" />
                                Reply in thread
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </>
              )}
            </div>

            {/* Composer — fixed footer inside the flex column (no page scroll) */}
            <div className="shrink-0 px-3 pb-3 pt-2 bg-background border-t border-border/30 relative">
              {/* Mention autocomplete popup (main composer) */}
              <AnimatePresence>
                {mentionOpen && mentionCandidates.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.12 }}
                    className="absolute bottom-full left-3 right-3 mb-1 glass-card rounded-2xl border border-border shadow-xl overflow-hidden z-20"
                  >
                    <div className="px-3 py-1.5 bg-secondary/50 border-b border-border/40 text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
                      <AtSign className="h-3 w-3 text-primary" />
                      Mention team member
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {mentionCandidates.map((m) => (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => selectMember(m)}
                          className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left active:bg-secondary/60 transition-colors cursor-pointer"
                        >
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0 ${avatarColorFor(m.user_id)}`}>
                            {initialsOf(m.full_name)}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate">{m.full_name || 'Member'}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Staged attachments preview */}
              {staged.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 px-1">
                  {staged.map((s) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative shrink-0 glass-card rounded-xl border border-border/50 px-3 py-2 flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-[11px] font-semibold text-foreground truncate max-w-[110px]">{s.file.name}</span>
                      <button
                        type="button"
                        onClick={() => setStaged((prev) => prev.filter((p) => p.id !== s.id))}
                        className="text-muted-foreground active:scale-90 transition-transform cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                {/* Paperclip — file / PDF / image picker */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 w-11 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0 cursor-pointer"
                >
                  <Paperclip className="h-4.5 w-4.5" />
                </motion.button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) {
                      setStaged((prev) => [
                        ...prev,
                        ...files.map((f) => ({ id: crypto.randomUUID(), file: f })),
                      ]);
                    }
                    e.target.value = '';
                  }}
                />

                <div className="flex-1 glass-card rounded-2xl border border-border/60 px-4 py-2.5 flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={handleDraftChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={`Message #${activeChannel.name} — @ to mention`}
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none resize-none max-h-28 leading-snug"
                  />
                </div>
                <motion.button
                  onClick={handleSend}
                  disabled={(!draft.trim() && staged.length === 0) || sending}
                  whileTap={draft.trim() || staged.length > 0 ? { scale: 0.88 } : undefined}
                  animate={draft.trim() || staged.length > 0 ? { scale: 1 } : { scale: 0.96 }}
                  className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    draft.trim() || staged.length > 0
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ THREAD BOTTOM SHEET ═══ */}
      <AnimatePresence>
        {threadParent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setThreadParent(null)}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              drag="y"
              dragDirectionLock
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) setThreadParent(null);
              }}
              className="fixed inset-x-0 bottom-0 z-[61] h-[82vh] max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl shadow-2xl flex flex-col pb-safe touch-none"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 bg-muted rounded-full opacity-60" />
              </div>

              {/* Thread header */}
              <div className="px-4 pb-3 flex items-center justify-between border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Reply className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Thread</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setThreadParent(null)}
                  className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              {/* Parent message */}
              <div className="px-4 py-3 border-b border-border/30 shrink-0">
                <div className="glass-card rounded-xl p-3 border border-border/40">
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-xs font-bold text-foreground">
                      {threadParent.sender_name || 'Unknown'}
                    </span>
                    <span className="text-[9px] text-muted-foreground/70">
                      {formatClock(threadParent.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-snug whitespace-pre-wrap break-words">
                    {threadParent.content}
                  </p>
                </div>
              </div>

              {/* Replies */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {threadReplies.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground/60 py-8">
                    No replies yet — start the conversation.
                  </p>
                ) : (
                  threadReplies.map((reply) => {
                    const isMine = reply.sender_id === (isDemo ? demoUser.id : ctx?.userId);
                    return (
                      <motion.div
                        key={reply.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={SPRING}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                          isMine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted/60 text-foreground rounded-bl-md'
                        }`}>
                          {!isMine && (
                            <p className="text-[10px] font-bold opacity-70 mb-0.5">{reply.sender_name}</p>
                          )}
                          <p className="text-sm leading-snug break-words whitespace-pre-wrap">{reply.content}</p>
                          <p className={`text-[9px] mt-0.5 tabular-nums ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground/60'}`}>
                            {formatClock(reply.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Thread composer */}
              <div className="px-3 pb-4 pt-2 border-t border-border/30 shrink-0 relative">
                {/* Mention autocomplete popup (thread composer) */}
                <AnimatePresence>
                  {threadMentionOpen && threadMentionCandidates.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full left-3 right-3 mb-1 glass-card rounded-2xl border border-border shadow-xl overflow-hidden z-20"
                    >
                      <div className="px-3 py-1.5 bg-secondary/50 border-b border-border/40 text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
                        <AtSign className="h-3 w-3 text-primary" />
                        Mention team member
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {threadMentionCandidates.map((m) => (
                          <button
                            key={m.user_id}
                            type="button"
                            onClick={() => selectThreadMember(m)}
                            className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left active:bg-secondary/60 transition-colors cursor-pointer"
                          >
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0 ${avatarColorFor(m.user_id)}`}>
                              {initialsOf(m.full_name)}
                            </div>
                            <span className="text-sm font-medium text-foreground truncate">{m.full_name || 'Member'}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-end gap-2">
                  <input
                    type="text"
                    value={threadDraft}
                    onChange={handleThreadDraftChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendThreadReply();
                      }
                    }}
                    placeholder="Reply... @ to mention"
                    className="flex-1 h-11 px-4 rounded-2xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                  <motion.button
                    onClick={handleSendThreadReply}
                    disabled={!threadDraft.trim() || sending}
                    whileTap={threadDraft.trim() ? { scale: 0.88 } : undefined}
                    className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer ${
                      threadDraft.trim() ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    <Send className="h-4.5 w-4.5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ EMOJI REACTION SHEET ═══ */}
      <AnimatePresence>
        {pickerFor && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              onClick={() => setPickerFor(null)}
              className="fixed inset-0 z-[70] bg-black/30"
            />
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={SPRING}
              className="fixed bottom-0 inset-x-0 z-[71] max-w-lg mx-auto bg-card border-t border-border rounded-t-2xl shadow-2xl px-4 pt-4 pb-8"
            >
              <div className="flex justify-center mb-3">
                <div className="w-12 h-1.5 bg-muted rounded-full opacity-60" />
              </div>
              <div className="flex justify-around">
                {QUICK_EMOJIS.map((emoji, i) => (
                  <motion.button
                    key={emoji}
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ ...SPRING, delay: i * 0.04 }}
                    whileTap={{ scale: 1.4, rotate: 8 }}
                    onClick={() => toggleReaction(pickerFor, emoji)}
                    className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-2xl cursor-pointer"
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ LONG-PRESS ACTION SHEET (Slack-style) ═══ */}
      <AnimatePresence>
        {actionFor && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              onClick={() => setActionFor(null)}
              className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              drag="y"
              dragDirectionLock
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 450) setActionFor(null);
              }}
              className="fixed inset-x-0 bottom-0 z-[81] max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl shadow-2xl flex flex-col pb-safe touch-none"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-muted rounded-full opacity-60" />
              </div>

              {/* Message context preview */}
              <div className="px-4 pb-3">
                <div className="glass-card rounded-xl p-3 border border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                    {actionFor.sender_name || 'Unknown'} · {formatClock(actionFor.created_at)}
                  </p>
                  <p className="text-xs text-foreground line-clamp-2 leading-snug">{actionFor.content}</p>
                </div>
              </div>

              {/* Quick reactions row */}
              <div className="px-4 pb-3">
                <div className="flex justify-between gap-1">
                  {QUICK_EMOJIS.map((emoji, i) => (
                    <motion.button
                      key={emoji}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ ...SPRING, delay: i * 0.035 }}
                      whileTap={{ scale: 1.35, rotate: 10 }}
                      onClick={() => toggleReaction(actionFor.id, emoji)}
                      className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center text-xl cursor-pointer"
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="px-4 pb-8 space-y-1">
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openCreateTask(actionFor)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary/60 active:bg-secondary text-left cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <CheckSquare className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">Create Task</p>
                    <p className="text-[11px] text-muted-foreground">Turn this message into a trackable task</p>
                  </div>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.09 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAddToMyTask(actionFor)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary/60 active:bg-secondary text-left cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Bookmark className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">Add to My Tasks</p>
                    <p className="text-[11px] text-muted-foreground">Save to your personal task list</p>
                  </div>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.13 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openSetReminder(actionFor)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary/60 active:bg-secondary text-left cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Bell className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">Set Reminder</p>
                    <p className="text-[11px] text-muted-foreground">Get notified about this later</p>
                  </div>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.17 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { const m = actionFor; setActionFor(null); openThread(m); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary/60 active:bg-secondary text-left cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <Reply className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">Reply in Thread</p>
                    <p className="text-[11px] text-muted-foreground">Start a focused side conversation</p>
                  </div>
                </motion.button>

                {actionFor.sender_id === (isDemo ? demoUser.id : ctx?.userId) && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.21 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDeleteMessage(actionFor)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-destructive/5 border border-destructive/20 active:bg-destructive/10 text-left cursor-pointer"
                  >
                    <div className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                      <Trash2 className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-destructive">Delete Message</p>
                      <p className="text-[11px] text-muted-foreground">Only you can see this action</p>
                    </div>
                  </motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ CREATE TASK SHEET ═══ */}
      <AnimatePresence>
        {taskSheetFor && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              onClick={() => setTaskSheetFor(null)}
              className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              drag="y"
              dragDirectionLock
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 130 || info.velocity.y > 550) setTaskSheetFor(null);
              }}
              className="fixed inset-x-0 bottom-0 z-[81] max-h-[88vh] max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl shadow-2xl flex flex-col pb-safe touch-none"
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-12 h-1.5 bg-muted rounded-full opacity-60" />
              </div>

              <div className="px-5 pb-3 flex items-center justify-between border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <CheckSquare className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Create Task</h3>
                    <p className="text-[10px] text-muted-foreground">From collaboration message</p>
                  </div>
                </div>
                <button onClick={() => setTaskSheetFor(null)} className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Task Title *</label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    className="w-full px-3.5 h-11 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Description</label>
                  <textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    rows={3}
                    className="w-full p-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted/60 border border-border/30">
                      {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTaskPriority(p)}
                          className={`py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                            taskPriority === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                          }`}
                        >
                          {p === 'critical' ? 'Crit' : p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Due Date</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full px-3 h-11 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>

                {taskChecklist.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Checklist (auto-detected)</label>
                    <div className="rounded-xl border border-border/50 bg-muted/30 divide-y divide-border/40">
                      {taskChecklist.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2">
                          <span className="h-4 w-4 rounded border-2 border-muted-foreground/30 shrink-0" />
                          <span className="text-xs text-foreground flex-1">{item}</span>
                          <button
                            type="button"
                            onClick={() => setTaskChecklist((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-muted-foreground/60 active:scale-90 transition-transform cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 pb-6 pt-3 border-t border-border/30 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={submitCreateTask}
                  disabled={!taskTitle.trim() || creatingTask}
                  className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
                  Create Task
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ SET REMINDER SHEET ═══ */}
      <AnimatePresence>
        {reminderSheetFor && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              onClick={() => setReminderSheetFor(null)}
              className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              drag="y"
              dragDirectionLock
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 130 || info.velocity.y > 550) setReminderSheetFor(null);
              }}
              className="fixed inset-x-0 bottom-0 z-[81] max-h-[88vh] max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl shadow-2xl flex flex-col pb-safe touch-none"
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-12 h-1.5 bg-muted rounded-full opacity-60" />
              </div>

              <div className="px-5 pb-3 flex items-center justify-between border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Bell className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Set Reminder</h3>
                    <p className="text-[10px] text-muted-foreground">From collaboration message</p>
                  </div>
                </div>
                <button onClick={() => setReminderSheetFor(null)} className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Reminder Title *</label>
                  <input
                    type="text"
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    placeholder="What should be remembered?"
                    className="w-full px-3.5 h-11 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Context / Notes</label>
                  <textarea
                    value={reminderNotes}
                    onChange={(e) => setReminderNotes(e.target.value)}
                    rows={3}
                    placeholder="Optional additional context..."
                    className="w-full p-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Recipient</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReminderRecipient(ctx?.userId ?? '')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        reminderRecipient === ctx?.userId
                          ? 'bg-primary/10 border border-primary/30 text-primary'
                          : 'bg-secondary border border-transparent text-muted-foreground'
                      }`}
                    >
                      Myself
                    </button>
                    {channelMembersList
                      .filter((m) => m.user_id !== ctx?.userId)
                      .map((m) => (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => setReminderRecipient(m.user_id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            reminderRecipient === m.user_id
                              ? 'bg-primary/10 border border-primary/30 text-primary'
                              : 'bg-secondary border border-transparent text-muted-foreground'
                          }`}
                        >
                          {m.full_name || 'Member'}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Remind At (Optional)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Tomorrow 9 AM', days: 1 },
                      { label: 'In 2 Days', days: 2 },
                      { label: 'Next Week', days: 7 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + preset.days);
                          d.setHours(9, 0, 0, 0);
                          setReminderAt(toLocalInput(d));
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border text-muted-foreground bg-background cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                    {reminderAt && (
                      <button
                        type="button"
                        onClick={() => setReminderAt('')}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border border-destructive/30 text-destructive bg-destructive/5 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={reminderAt}
                    onChange={(e) => setReminderAt(e.target.value)}
                    className="w-full px-3.5 h-11 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              <div className="px-5 pb-6 pt-3 border-t border-border/30 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={submitSetReminder}
                  disabled={!reminderTitle.trim() || creatingReminder}
                  className="w-full h-12 rounded-2xl bg-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creatingReminder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                  Set Reminder
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
