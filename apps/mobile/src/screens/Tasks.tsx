// src/screens/Tasks.tsx
// Mobile Tasks module — full parity with the web unified Task module:
//   • Mine (assignee overlaps) + Company (org-wide) scopes
//   • List view + Board view (5 status columns, same as web ProjectTaskBoard)
//   • Create (scope-aware), edit (title/desc/status/priority/due/assignees), soft delete
//   • Personal tasks: private CRUD (priority low/medium/high/urgent), quick add
//   • Checklist via toggle_task_checklist_item RPC, status via update_task_status RPC
//   • Time tracking: start/stop timer (task_time_logs), active-timer banner
// Data integrity: dates sent as-is to date columns; completion stamped by DB.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListChecks, Loader2, X, Check, Calendar, Flag, Plus,
  AlertCircle, ChevronRight, ClipboardList, Bookmark, RefreshCw,
  LayoutGrid, List as ListIcon, Users, Timer, Trash2,
} from 'lucide-react';
import { toastSuccess, toastError } from '../components/Toast';
import { supabase } from '../lib/supabase';
import {
  fetchMyTasks,
  fetchCompanyTasks,
  createTask,
  updateTask,
  deleteTask,
  fetchPersonalTasks,
  createPersonalTask,
  deletePersonalTask,
  togglePersonalTask,
  updateTaskStatus,
  fetchChecklist,
  toggleChecklistItem,
  addChecklistItem,
  fetchOrgMembers,
  fetchActiveTimer,
  startTimer,
  stopTimer,
  resolveUserNames,
  TASK_STATUS_META,
  TASK_PRIORITY_META,
  PERSONAL_PRIORITY_META,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskChecklistItem,
  type PersonalTask,
  type PersonalPriority,
  type OrgMemberOption,
} from '../lib/tasks';

interface TasksProps {
  isDemo?: boolean;
}

// ── Animation presets ────────────────────────────────────────────────────────

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 };

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.03 } },
};

const listItem = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const BOARD_STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'under_review', 'on_hold', 'completed'];

function isOverdue(due: string | null | undefined): boolean {
  if (!due) return false;
  const d = new Date(due);
  if (isNaN(d.getTime())) return false;
  // Date-only comparison: due today is NOT overdue.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

/** 'YYYY-MM-DD' → human label. Date-only strings are parsed as local dates. */
function formatDue(due: string | null): string {
  if (!due) return 'No due date';
  const d = due.length === 10 ? new Date(due + 'T00:00:00') : new Date(due);
  if (isNaN(d.getTime())) return 'No due date';
  const today = new Date();
  const startToday = new Date(today); startToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((d.getTime() - startToday.getTime()) / 86400000);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  if (dayDiff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

/** Local date → 'YYYY-MM-DD' for date columns (no UTC drift). */
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DEMO_NAMES: Record<string, string> = {
  'demo-u1': 'You', 'demo-u2': 'Priya Sharma', 'demo-u3': 'Rahul Verma', 'demo-u4': 'Amit Patel',
};

// ── Component ────────────────────────────────────────────────────────────────

export function Tasks({ isDemo = false }: TasksProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [meId, setMeId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [scope, setScope] = useState<'mine' | 'company'>('mine');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [filter, setFilter] = useState<TaskStatus | 'personal' | 'all'>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [personal, setPersonal] = useState<PersonalTask[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);

  // Active timer
  const [timer, setTimer] = useState<{ id: string; task_id: string; start_time: string; task_title: string } | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);

  // Create sheet
  const [createOpen, setCreateOpen] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cPriority, setCPriority] = useState<TaskPriority>('medium');
  const [cDueDate, setCDueDate] = useState('');
  const [cAssignees, setCAssignees] = useState<string[]>([]);
  const [cCreating, setCCreating] = useState(false);
  // Personal quick-create fields (inline in Personal tab)
  const [pTitle, setPTitle] = useState('');
  const [pDueDate, setPDueDate] = useState('');
  const [pPriority] = useState<PersonalPriority>('medium');
  const [pAdding, setPAdding] = useState(false);

  // Edit sheet
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eDescription, setEDescription] = useState('');
  const [eStatus, setEStatus] = useState<TaskStatus>('not_started');
  const [eStatusMenu, setEStatusMenu] = useState(false);
  const [ePriority, setEPriority] = useState<TaskPriority>('medium');
  const [eDueDate, setEDueDate] = useState('');
  const [eAssignees, setEAssignees] = useState<string[]>([]);
  const [eChecklist, setEChecklist] = useState<TaskChecklistItem[]>([]);
  const [eChecklistLoading, setEChecklistLoading] = useState(false);
  const [eNewItem, setENewItem] = useState('');
  const [eSaving, setESaving] = useState(false);
  const [eDeleting, setEDeleting] = useState(false);
  const [eConfirmDelete, setEConfirmDelete] = useState(false);

  // Personal detail
  const [detailPersonal, setDetailPersonal] = useState<PersonalTask | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isDemo) {
        const demoTasks: Task[] = [
          { id: 'demo-t1', organisation_id: 'demo', project_id: 'demo-p1', title: 'Inspect conduit routing on Level 3', description: 'Verify routing matches approved drawings before ceiling closes.', status: 'in_progress', priority: 'high', due_date: toDateInputValue(new Date(Date.now() + 86400000)), completed_date: null, completion_percentage: 40, assignee_ids: ['demo-u1'], created_by: 'demo-u2', created_at: '', updated_at: '' },
          { id: 'demo-t2', organisation_id: 'demo', project_id: 'demo-p2', title: 'Follow up on cement delivery delay', description: 'Confirm revised slot with UltraTech; update casting schedule.', status: 'not_started', priority: 'critical', due_date: toDateInputValue(new Date()), completed_date: null, completion_percentage: 0, assignee_ids: ['demo-u1'], created_by: 'demo-u3', created_at: '', updated_at: '' },
          { id: 'demo-t3', organisation_id: 'demo', project_id: null, title: 'Update BOQ for extra conduit work', description: null, status: 'under_review', priority: 'medium', due_date: toDateInputValue(new Date(Date.now() + 5 * 86400000)), completed_date: null, completion_percentage: 70, assignee_ids: ['demo-u1', 'demo-u4'], created_by: 'demo-u1', created_at: '', updated_at: '' },
          { id: 'demo-t4', organisation_id: 'demo', project_id: null, title: 'Submit weekly site report', description: null, status: 'completed', priority: 'low', due_date: toDateInputValue(new Date(Date.now() - 2 * 86400000)), completed_date: null, completion_percentage: 100, assignee_ids: ['demo-u1'], created_by: 'demo-u2', created_at: '', updated_at: '' },
          { id: 'demo-t5', organisation_id: 'demo', project_id: 'demo-p1', title: 'Order fire-rated panels for Level 1', description: null, status: 'not_started', priority: 'high', due_date: toDateInputValue(new Date(Date.now() + 3 * 86400000)), completed_date: null, completion_percentage: 0, assignee_ids: ['demo-u4'], created_by: 'demo-u2', created_at: '', updated_at: '' },
          { id: 'demo-t6', organisation_id: 'demo', project_id: 'demo-p2', title: 'QA the chilled water piping test pack', description: null, status: 'on_hold', priority: 'medium', due_date: null, completed_date: null, completion_percentage: 20, assignee_ids: ['demo-u3'], created_by: 'demo-u1', created_at: '', updated_at: '' },
        ];
        setTasks(demoTasks);
        setPersonal([
          { id: 'demo-pt1', user_id: 'demo-u1', organisation_id: 'demo', title: 'Call electrical subcontractor about timeline', description: '[Created from collaboration message]', is_completed: false, due_date: toDateInputValue(new Date(Date.now() + 86400000)), priority: 'high', created_at: '' },
          { id: 'demo-pt2', user_id: 'demo-u1', organisation_id: 'demo', title: 'Review quotation revision 2', description: '[Created from collaboration message]', is_completed: true, due_date: null, priority: 'medium', created_at: '' },
        ]);
        setNameMap(DEMO_NAMES);
        setMeId('demo-u1');
        setOrgMembers([
          { id: 'demo-u1', name: 'Demo User' }, { id: 'demo-u2', name: 'Priya Sharma' },
          { id: 'demo-u3', name: 'Rahul Verma' }, { id: 'demo-u4', name: 'Amit Patel' },
        ]);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { data: member } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      const userOrgId = member?.organisation_id;
      if (!userOrgId) throw new Error('No organization associated with this account');

      setMeId(user.id);
      setOrgId(userOrgId);

      const [mine, all, pTasks, members, names, activeTimer] = await Promise.all([
        fetchMyTasks(userOrgId, user.id),
        fetchCompanyTasks(userOrgId),
        fetchPersonalTasks(user.id),
        fetchOrgMembers(userOrgId),
        resolveUserNames([user.id]).catch(() => ({})),
        fetchActiveTimer(user.id).catch(() => null),
      ]);

      setTasks(mergeScopes(mine, all));
      setPersonal(pTasks);
      setOrgMembers(members);
      setNameMap((prev) => ({ ...prev, ...names }));
      setTimer(activeTimer);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDemo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Merge scopes: company list is authoritative; keep any extra "mine" rows
   * (e.g. created before RLS refresh) without duplicating. */
  function mergeScopes(mine: Task[], company: Task[]): Task[] {
    const seen = new Set(company.map((t) => t.id));
    const extras = mine.filter((t) => !seen.has(t.id));
    return [...extras, ...company];
  }

  // Timer ticker
  useEffect(() => {
    if (!timer) return;
    const tick = () => setTimerElapsed(Date.now() - new Date(timer.start_time).getTime());
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [timer]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const effectiveTasks = useMemo(() => {
    // 'mine' = assignee includes me; 'company' = everything in the org list
    if (scope === 'company') return tasks;
    return tasks.filter((t) => t.assignee_ids?.includes(meId));
  }, [tasks, scope, meId]);

  const filteredTasks = useMemo(() => {
    if (filter === 'all' || filter === 'personal') return effectiveTasks;
    return effectiveTasks.filter((t) => t.status === filter);
  }, [effectiveTasks, filter]);

  const filteredPersonal = useMemo(() => personal, [personal]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of BOARD_STATUSES) c[s] = effectiveTasks.filter((t) => t.status === s).length;
    return c;
  }, [effectiveTasks]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleCompleteTask = useCallback(async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'completed' ? 'not_started' : 'completed';
    const prevTasks = tasks;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus, completion_percentage: newStatus === 'completed' ? 100 : 0 } : t)));
    setEditTask((prev) => (prev && prev.id === task.id ? { ...prev, status: newStatus } : prev));
    if (isDemo) {
      toastSuccess(newStatus === 'completed' ? '✓ Task completed' : 'Reopened');
      return;
    }
    try {
      await updateTaskStatus(task.id, newStatus);
      toastSuccess(newStatus === 'completed' ? '✓ Task completed' : 'Task reopened');
    } catch {
      setTasks(prevTasks);
      toastError('Failed to update task');
    }
  }, [isDemo, tasks]);

  const openEdit = useCallback(async (task: Task) => {
    setEditTask(task);
    setETitle(task.title);
    setEDescription(task.description ?? '');
    setEStatus(task.status);
    setEPriority(task.priority);
    setEDueDate(task.due_date ? (task.due_date.length === 10 ? task.due_date : task.due_date.slice(0, 10)) : '');
    setEAssignees(task.assignee_ids ?? []);
    setEStatusMenu(false);
    setEConfirmDelete(false);
    if (isDemo) {
      setEChecklist(task.id === 'demo-t1'
        ? [
            { id: 'demo-cl1', task_id: task.id, organisation_id: 'demo', title: 'East wing corridor', is_completed: true, completed_by: null, completed_at: null, sort_order: 0 },
            { id: 'demo-cl2', task_id: task.id, organisation_id: 'demo', title: 'Level 2 riser room', is_completed: true, completed_by: null, completed_at: null, sort_order: 1 },
            { id: 'demo-cl3', task_id: task.id, organisation_id: 'demo', title: 'Level 3 west wing', is_completed: false, completed_by: null, completed_at: null, sort_order: 2 },
          ]
        : []);
      return;
    }
    setEChecklistLoading(true);
    try {
      const items = await fetchChecklist(task.id);
      setEChecklist(items);
    } catch { /* non-fatal */ }
    finally { setEChecklistLoading(false); }
  }, [isDemo]);

  const handleSaveEdit = useCallback(async () => {
    if (!editTask || !eTitle.trim()) return;
    setESaving(true);
    const updates = {
      title: eTitle.trim(),
      description: eDescription.trim() || null,
      status: eStatus,
      priority: ePriority,
      due_date: eDueDate || null, // 'YYYY-MM-DD' as-is — date column integrity
      assignee_ids: eAssignees,
      completion_percentage: eStatus === 'completed' ? 100 : editTask.completion_percentage,
    };
    if (isDemo) {
      setTasks((prev) => prev.map((t) => (t.id === editTask.id ? { ...t, ...updates } as Task : t)));
      toastSuccess('✓ Task updated');
      setEditTask(null);
      setESaving(false);
      return;
    }
    try {
      const saved = await updateTask(editTask.id, updates);
      setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      toastSuccess('✓ Task updated');
      setEditTask(null);
    } catch (err: any) {
      toastError(err?.message || 'Failed to update task');
    } finally {
      setESaving(false);
    }
  }, [editTask, eTitle, eDescription, eStatus, ePriority, eDueDate, eAssignees, isDemo]);

  const handleDelete = useCallback(async () => {
    if (!editTask) return;
    setEDeleting(true);
    if (isDemo) {
      setTasks((prev) => prev.filter((t) => t.id !== editTask.id));
      toastSuccess('Task deleted');
      setEditTask(null);
      setEDeleting(false);
      return;
    }
    try {
      await deleteTask(editTask.id);
      setTasks((prev) => prev.filter((t) => t.id !== editTask.id));
      toastSuccess('Task deleted');
      setEditTask(null);
    } catch {
      toastError('Failed to delete task');
    } finally {
      setEDeleting(false);
    }
  }, [editTask, isDemo]);

  const handleCreate = useCallback(async () => {
    const title = cTitle.trim();
    if (!title) return;
    setCCreating(true);
    const input = {
      organisationId: orgId || 'demo',
      projectId: null,
      title,
      description: cDescription.trim() || null,
      priority: cPriority,
      dueDate: cDueDate || null, // 'YYYY-MM-DD' as-is
      assigneeIds: scope === 'mine' && cAssignees.length === 0 ? [meId] : cAssignees,
      createdBy: meId,
      status: 'not_started' as TaskStatus,
    };
    if (isDemo) {
      const t: Task = {
        id: `demo-${Date.now()}`, organisation_id: 'demo', project_id: null,
        title, description: input.description, status: 'not_started',
        priority: cPriority, due_date: cDueDate || null, completed_date: null,
        completion_percentage: 0, assignee_ids: input.assigneeIds, created_by: meId,
        created_at: '', updated_at: '',
      };
      setTasks((prev) => [t, ...prev]);
      toastSuccess('✓ Task created');
      setCreateOpen(false);
      resetCreate();
      setCCreating(false);
      return;
    }
    try {
      const task = await createTask(input);
      setTasks((prev) => [task, ...prev]);
      toastSuccess('✓ Task created');
      setCreateOpen(false);
      resetCreate();
    } catch (err: any) {
      toastError(err?.message || 'Failed to create task');
    } finally {
      setCCreating(false);
    }
  }, [cTitle, cDescription, cPriority, cDueDate, cAssignees, scope, meId, orgId, isDemo]);

  function resetCreate() {
    setCTitle(''); setCDescription(''); setCPriority('medium'); setCDueDate(''); setCAssignees([]);
  }

  // Personal CRUD
  const handleAddPersonal = useCallback(async () => {
    const title = pTitle.trim();
    if (!title) return;
    setPAdding(true);
    if (isDemo) {
      setPersonal((prev) => [{ id: `demo-pt-${Date.now()}`, user_id: meId, organisation_id: 'demo', title, description: null, is_completed: false, due_date: pDueDate || null, priority: pPriority, created_at: '' }, ...prev]);
      setPTitle(''); setPDueDate('');
      setPAdding(false);
      toastSuccess('Task added');
      return;
    }
    try {
      const created = await createPersonalTask({ userId: meId, organisationId: orgId, title, dueDate: pDueDate || null, priority: pPriority });
      setPersonal((prev) => [created, ...prev]);
      setPTitle(''); setPDueDate('');
      toastSuccess('Task added');
    } catch {
      toastError('Failed to add task');
    } finally {
      setPAdding(false);
    }
  }, [pTitle, pDueDate, pPriority, meId, orgId, isDemo]);

  const handleTogglePersonal = useCallback(async (item: PersonalTask) => {
    const next = !item.is_completed;
    setPersonal((prev) => prev.map((p) => (p.id === item.id ? { ...p, is_completed: next } : p)));
    if (isDemo) return;
    try {
      await togglePersonalTask(item.id, next);
    } catch {
      setPersonal((prev) => prev.map((p) => (p.id === item.id ? item : p)));
      toastError('Failed to update');
    }
  }, [isDemo]);

  const handleDeletePersonal = useCallback(async (item: PersonalTask) => {
    setPersonal((prev) => prev.filter((p) => p.id !== item.id));
    setDetailPersonal(null);
    if (isDemo) { toastSuccess('Task deleted'); return; }
    try {
      await deletePersonalTask(item.id);
      toastSuccess('Task deleted');
    } catch {
      toastError('Failed to delete');
    }
  }, [isDemo]);

  const handleToggleChecklist = useCallback(async (item: TaskChecklistItem) => {
    const next = !item.is_completed;
    setEChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, is_completed: next } : c)));
    if (isDemo) return;
    try {
      await toggleChecklistItem(item.id, next);
    } catch {
      setEChecklist((prev) => prev.map((c) => (c.id === item.id ? item : c)));
      toastError('Failed to update checklist');
    }
  }, [isDemo]);

  const handleAddChecklist = useCallback(async () => {
    const title = eNewItem.trim();
    if (!title || !editTask) return;
    setENewItem('');
    if (isDemo) {
      setEChecklist((prev) => [...prev, { id: `demo-cl-${Date.now()}`, task_id: editTask.id, organisation_id: 'demo', title, is_completed: false, completed_by: null, completed_at: null, sort_order: prev.length }]);
      return;
    }
    try {
      await addChecklistItem(editTask.id, title);
      const items = await fetchChecklist(editTask.id);
      setEChecklist(items);
    } catch {
      toastError('Failed to add item');
    }
  }, [eNewItem, editTask, isDemo]);

  const handleStartTimer = useCallback(async (task: Task) => {
    if (isDemo) { toastSuccess('Timer started (demo)'); setTimer({ id: 'demo-timer', task_id: task.id, start_time: new Date().toISOString(), task_title: task.title }); return; }
    try {
      await startTimer(orgId, meId, task.id);
      setTimer({ id: `live`, task_id: task.id, start_time: new Date().toISOString(), task_title: task.title });
      toastSuccess('Timer started');
    } catch { toastError('Failed to start timer'); }
  }, [isDemo, orgId, meId]);

  const handleStopTimer = useCallback(async () => {
    if (!timer) return;
    if (isDemo) { setTimer(null); toastSuccess('Timer stopped (demo)'); return; }
    try {
      await stopTimer(timer.id);
      setTimer(null);
      toastSuccess('Timer stopped');
    } catch { toastError('Failed to stop timer'); }
  }, [timer, isDemo]);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const assigneeLabel = (ids: string[] | null | undefined): string => {
    const list = ids ?? [];
    if (list.length === 0) return 'Unassigned';
    const names = list.map((id) => nameMap[id] ?? id.slice(0, 6));
    return names.length <= 2 ? names.join(', ') : `${names[0]} +${names.length - 1}`;
  };

  const renderTaskCard = (task: Task) => {
    const status = TASK_STATUS_META[task.status];
    const priority = TASK_PRIORITY_META[task.priority];
    const overdue = isOverdue(task.due_date) && task.status !== 'completed' && task.status !== 'cancelled';
    const isDone = task.status === 'completed';

    return (
      <motion.div key={task.id} variants={listItem} layout>
        <motion.button
          whileTap={{ scale: 0.98 }}
          transition={SPRING}
          onClick={() => openEdit(task)}
          className="w-full glass-card rounded-2xl p-4 text-left border border-border/50 flex flex-col gap-2.5 cursor-pointer"
        >
          <div className="flex items-start gap-3">
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={(e) => { e.stopPropagation(); handleCompleteTask(task); }}
              className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer ${
                isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/30'
              }`}
            >
              {isDone && <Check className="h-3.5 w-3.5" />}
            </motion.button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold leading-snug ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {task.title}
              </p>
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
              )}
              <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                <Users className="h-2.5 w-2.5" /> {assigneeLabel(task.assignee_ids)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pl-9">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
              <Flag className="h-2.5 w-2.5" />{priority.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              overdue ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-secondary text-muted-foreground'
            }`}>
              <Calendar className="h-2.5 w-2.5" />{formatDue(task.due_date)}{overdue ? ' • Overdue' : ''}
            </span>
          </div>
        </motion.button>
      </motion.div>
    );
  };

  const renderBoardColumn = (status: TaskStatus) => {
    const meta = TASK_STATUS_META[status];
    const colTasks = effectiveTasks.filter((t) => t.status === status);
    return (
      <div key={status} className="w-[270px] shrink-0 flex flex-col">
        <div className="flex items-center gap-2 px-1 pb-2">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          <span className="text-xs font-bold text-foreground">{meta.label}</span>
          <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full tabular-nums">
            {colTasks.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: 'calc(100% - 2rem)' }}>
          <AnimatePresence initial={false}>
            {colTasks.map((task) => {
              const priority = TASK_PRIORITY_META[task.priority];
              const overdue = isOverdue(task.due_date) && task.status !== 'completed';
              return (
                <motion.button
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={SPRING}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openEdit(task)}
                  className="w-full glass-card rounded-xl p-3 text-left border border-border/50 cursor-pointer"
                >
                  <p className={`text-xs font-bold leading-snug ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${priority.bg} ${priority.text}`}>
                      {priority.label}
                    </span>
                    {task.due_date && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${overdue ? 'bg-red-500/10 text-red-500' : 'bg-secondary text-muted-foreground'}`}>
                        {formatDue(task.due_date)}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { resetCreate(); setCreateOpen(true); }}
            className="w-full py-2 rounded-xl border border-dashed border-border/60 text-[11px] font-bold text-muted-foreground/70 flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Add task
          </motion.button>
        </div>
      </div>
    );
  };

  const renderPersonalCard = (item: PersonalTask) => (
    <motion.div key={item.id} variants={listItem} layout>
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => setDetailPersonal(item)}
        className="w-full glass-card rounded-2xl p-4 border border-amber-500/20 flex items-start gap-3 cursor-pointer"
      >
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={(e) => { e.stopPropagation(); handleTogglePersonal(item); }}
          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer ${
            item.is_completed ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-500/40'
          }`}
        >
          {item.is_completed && <Check className="h-3.5 w-3.5" />}
        </motion.button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-snug ${item.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {item.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Bookmark className="h-2.5 w-2.5" /> Personal
            </span>
            {item.priority && (
              <span className={`text-[9px] font-bold ${PERSONAL_PRIORITY_META[item.priority as PersonalPriority]?.text ?? ''}`}>
                {PERSONAL_PRIORITY_META[item.priority as PersonalPriority]?.label ?? item.priority}
              </span>
            )}
            {item.due_date && (
              <span className={`text-[10px] ${isOverdue(item.due_date) && !item.is_completed ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                {formatDue(item.due_date)}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
      </motion.div>
    </motion.div>
  );

  const counts: Record<string, number> = {
    ...statusCounts,
    all: effectiveTasks.length,
    personal: personal.filter((p) => !p.is_completed).length,
  };

  const chipFilters: { key: TaskStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    ...BOARD_STATUSES.map((s) => ({ key: s, label: TASK_STATUS_META[s].label })),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-dvh bg-background max-w-lg mx-auto flex flex-col overflow-hidden relative pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="px-4 pt-10 pb-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" /> Tasks
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {counts.all} tasks • {counts.personal} personal
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* View switch */}
            <div className="flex bg-secondary rounded-xl p-0.5">
              <button onClick={() => setView('list')} className={`h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer ${view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                <ListIcon className="h-4 w-4" />
              </button>
              <button onClick={() => setView('board')} className={`h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer ${view === 'board' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={loadData} className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground cursor-pointer">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </div>

        {/* Scope toggle: Mine / Company */}
        <div className="flex bg-muted/60 border border-border/30 rounded-xl p-1 mt-3">
          {(['mine', 'company'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                scope === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {s === 'mine' ? <Bookmark className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              {s === 'mine' ? 'My Tasks' : 'Company'}
            </button>
          ))}
        </div>
      </header>

      {/* Active timer banner */}
      <AnimatePresence>
        {timer && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-4 mt-3 shrink-0 rounded-xl bg-primary/5 border border-primary/20 px-3.5 py-2.5 flex items-center gap-3"
          >
            <Timer className="h-4 w-4 text-primary animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{timer.task_title}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {String(Math.floor(timerElapsed / 3600000)).padStart(2, '0')}:
                {String(Math.floor((timerElapsed % 3600000) / 60000)).padStart(2, '0')}:
                {String(Math.floor((timerElapsed % 60000) / 1000)).padStart(2, '0')}
              </p>
            </div>
            <button onClick={handleStopTimer} className="h-8 px-3 rounded-lg bg-destructive/10 text-destructive text-[11px] font-bold cursor-pointer">
              Stop
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mx-4 mt-3 p-3 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2 shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Filter chips (hidden in personal scope of list) */}
      {view === 'list' && (
        <div className="px-4 pt-3 pb-1 flex gap-1.5 overflow-x-auto shrink-0">
          {chipFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full border transition-all shrink-0 cursor-pointer ${
                filter === f.key ? 'bg-primary border-primary text-white shadow-sm' : 'bg-card border-border text-muted-foreground'
              }`}
            >
              <span>{f.label}</span>
              {counts[f.key] > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-[10px] font-bold px-1 ${
                  filter === f.key ? 'bg-white/25 text-white' : 'bg-secondary text-muted-foreground'
                }`}>{counts[f.key]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Personal quick add (Mine scope only) */}
      {scope === 'mine' && (
        <div className="px-4 pt-2 shrink-0">
          <div className="glass-card rounded-2xl border border-amber-500/20 p-2.5 flex gap-2">
            <input
              type="text"
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPersonal(); } }}
              placeholder="Quick add personal task..."
              className="flex-1 h-9 px-3 rounded-xl border border-input bg-background text-xs outline-none focus:ring-1 focus:ring-amber-500"
            />
            <input
              type="date"
              value={pDueDate}
              onChange={(e) => setPDueDate(e.target.value)}
              className="w-32 h-9 px-2 rounded-xl border border-input bg-background text-[10px] text-muted-foreground outline-none"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleAddPersonal}
              disabled={!pTitle.trim() || pAdding}
              className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0"
            >
              {pAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </motion.button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 min-h-0 ${view === 'board' ? 'overflow-x-auto overscroll-x-contain' : 'overflow-y-auto overscroll-contain'} px-4 pt-3 pb-6`}>
        {view === 'board' ? (
          <div className="flex gap-3 h-full">
            {BOARD_STATUSES.map(renderBoardColumn)}
          </div>
        ) : filter === 'personal' || scope === 'mine' ? (
          <>
            {/* Personal section */}
            {personal.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                  <Bookmark className="h-3 w-3" /> Personal — private to you
                </p>
                <motion.ul variants={listStagger} initial="hidden" animate="show" className="space-y-2.5">
                  {filteredPersonal.map(renderPersonalCard)}
                </motion.ul>
              </div>
            )}
            {filter !== 'personal' && filteredTasks.length > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {scope === 'mine' ? 'Assigned to me' : 'Company tasks'}
              </p>
            )}
            {filter !== 'personal' && (
              filteredTasks.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-8 text-center border border-dashed border-border">
                  <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No tasks here</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Tap + to create one, or switch to Company</p>
                </motion.div>
              ) : (
                <motion.ul variants={listStagger} initial="hidden" animate="show" className="space-y-2.5">
                  {filteredTasks.map(renderTaskCard)}
                </motion.ul>
              )
            )}
          </>
        ) : (
          filteredTasks.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-8 text-center border border-dashed border-border mt-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">No company tasks in this filter</p>
            </motion.div>
          ) : (
            <motion.ul variants={listStagger} initial="hidden" animate="show" className="space-y-2.5">
              {filteredTasks.map(renderTaskCard)}
            </motion.ul>
          )
        )}
      </div>

      {/* FAB — create task */}
      {view === 'list' && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { resetCreate(); setCreateOpen(true); }}
          className="absolute right-4 bottom-4 h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center cursor-pointer z-20"
        >
          <Plus className="h-6 w-6" />
        </motion.button>
      )}

      {/* ═══ CREATE TASK SHEET ═══ */}
      <AnimatePresence>
        {createOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} onClick={() => setCreateOpen(false)} className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px]" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              drag="y" dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => { if (info.offset.y > 130 || info.velocity.y > 550) setCreateOpen(false); }}
              className="fixed inset-x-0 bottom-0 z-[81] max-h-[90vh] max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl shadow-2xl flex flex-col pb-safe touch-none"
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-12 h-1.5 bg-muted rounded-full opacity-60" /></div>
              <div className="px-5 pb-3 flex items-center justify-between border-b border-border/40 shrink-0">
                <h3 className="text-sm font-bold text-foreground">New Task</h3>
                <button onClick={() => setCreateOpen(false)} className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground cursor-pointer"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Title *</label>
                  <input type="text" value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="What needs to be done?"
                    className="w-full px-3.5 h-11 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Description</label>
                  <textarea value={cDescription} onChange={(e) => setCDescription(e.target.value)} rows={3}
                    className="w-full p-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted/60 border border-border/30">
                      {(['low', 'medium', 'high', 'critical'] as TaskPriority[]).map((p) => (
                        <button key={p} type="button" onClick={() => setCPriority(p)}
                          className={`py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${cPriority === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                          {p === 'critical' ? 'Crit' : p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Due Date</label>
                    <input type="date" value={cDueDate} onChange={(e) => setCDueDate(e.target.value)}
                      className="w-full px-3 h-11 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
                {/* Assignees */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Assignees</label>
                  <div className="flex flex-wrap gap-1.5">
                    {orgMembers.map((m) => {
                      const selected = cAssignees.includes(m.id);
                      return (
                        <button key={m.id} type="button"
                          onClick={() => setCAssignees((prev) => (selected ? prev.filter((i) => i !== m.id) : [...prev, m.id]))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            selected ? 'bg-primary/10 border border-primary/30 text-primary' : 'bg-secondary border border-transparent text-muted-foreground'
                          }`}>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="px-5 pb-6 pt-3 border-t border-border/30 shrink-0">
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleCreate} disabled={!cTitle.trim() || cCreating}
                  className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  {cCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Task
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ EDIT TASK SHEET ═══ */}
      <AnimatePresence>
        {editTask && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} onClick={() => setEditTask(null)} className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px]" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              drag="y" dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => { if (info.offset.y > 130 || info.velocity.y > 550) setEditTask(null); }}
              className="fixed inset-x-0 bottom-0 z-[81] max-h-[92vh] max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl shadow-2xl flex flex-col pb-safe touch-none"
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-12 h-1.5 bg-muted rounded-full opacity-60" /></div>
              <div className="px-5 pb-3 flex items-center justify-between border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Edit Task</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Timer start */}
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleStartTimer(editTask)} title="Start timer"
                    className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center cursor-pointer">
                    <Timer className="h-4 w-4" />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEConfirmDelete(true)} title="Delete"
                    className="h-8 w-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                  <button onClick={() => setEditTask(null)} className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground cursor-pointer"><X className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Title</label>
                  <input type="text" value={eTitle} onChange={(e) => setETitle(e.target.value)}
                    className="w-full px-3.5 h-11 rounded-xl border border-input bg-background text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Description</label>
                  <textarea value={eDescription} onChange={(e) => setEDescription(e.target.value)} rows={3}
                    className="w-full p-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Status */}
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-semibold text-muted-foreground">Status</label>
                    <motion.button whileTap={{ scale: 0.98 }} onClick={() => setEStatusMenu((v) => !v)}
                      className="w-full flex items-center justify-between px-3.5 h-11 rounded-xl border border-input bg-background cursor-pointer">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${TASK_STATUS_META[eStatus].text}`}>
                        <span className={`h-2 w-2 rounded-full ${TASK_STATUS_META[eStatus].dot}`} />{TASK_STATUS_META[eStatus].label}
                      </span>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${eStatusMenu ? 'rotate-90' : ''}`} />
                    </motion.button>
                    <AnimatePresence>
                      {eStatusMenu && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
                          className="absolute left-0 right-0 top-full mt-1 glass-card rounded-2xl border border-border shadow-xl overflow-hidden z-20">
                          {BOARD_STATUSES.map((s) => (
                            <button key={s} type="button" onClick={() => { setEStatus(s); setEStatusMenu(false); }}
                              className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-xs font-semibold cursor-pointer ${eStatus === s ? 'bg-primary/5 text-foreground' : 'text-muted-foreground'}`}>
                              <span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${TASK_STATUS_META[s].dot}`} />{TASK_STATUS_META[s].label}</span>
                              {eStatus === s && <Check className="h-3.5 w-3.5 text-primary" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Due Date</label>
                    <input type="date" value={eDueDate} onChange={(e) => setEDueDate(e.target.value)}
                      className="w-full px-3 h-11 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                  <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted/60 border border-border/30">
                    {(['low', 'medium', 'high', 'critical'] as TaskPriority[]).map((p) => (
                      <button key={p} type="button" onClick={() => setEPriority(p)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${ePriority === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                        {p === 'critical' ? 'Crit' : p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assignees */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Assignees</label>
                  <div className="flex flex-wrap gap-1.5">
                    {orgMembers.map((m) => {
                      const selected = eAssignees.includes(m.id);
                      return (
                        <button key={m.id} type="button"
                          onClick={() => setEAssignees((prev) => (selected ? prev.filter((i) => i !== m.id) : [...prev, m.id]))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            selected ? 'bg-primary/10 border border-primary/30 text-primary' : 'bg-secondary border border-transparent text-muted-foreground'
                          }`}>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Checklist */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Checklist {eChecklist.length > 0 && `(${eChecklist.filter((c) => c.is_completed).length}/${eChecklist.length})`}
                  </p>
                  {eChecklistLoading ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : (
                    <div className="rounded-xl border border-border/50 bg-muted/20 divide-y divide-border/40 overflow-hidden">
                      {eChecklist.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 text-center py-3">No checklist items</p>
                      ) : (
                        eChecklist.map((item) => (
                          <div key={item.id} className="flex items-center gap-2.5 px-3 py-2.5">
                            <motion.button whileTap={{ scale: 0.8 }} onClick={() => handleToggleChecklist(item)}
                              className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                item.is_completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/30'
                              }`}>
                              {item.is_completed && <Check className="h-3 w-3" />}
                            </motion.button>
                            <span className={`text-xs flex-1 ${item.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.title}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="text" value={eNewItem} onChange={(e) => setENewItem(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklist(); } }}
                      placeholder="Add checklist item..."
                      className="flex-1 h-10 px-3.5 rounded-xl border border-input bg-background text-xs outline-none focus:ring-1 focus:ring-primary" />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={handleAddChecklist} disabled={!eNewItem.trim()}
                      className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center cursor-pointer disabled:opacity-40">
                      <Plus className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-6 pt-3 border-t border-border/30 shrink-0 space-y-2">
                <AnimatePresence>
                  {eConfirmDelete && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 flex items-center justify-between gap-3 overflow-hidden">
                      <p className="text-xs text-destructive font-semibold">Delete this task? History is preserved (soft delete).</p>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => setEConfirmDelete(false)} className="h-8 px-3 rounded-lg bg-secondary text-xs font-bold text-muted-foreground cursor-pointer">Cancel</button>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={handleDelete} disabled={eDeleting}
                          className="h-8 px-3 rounded-lg bg-destructive text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
                          {eDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleSaveEdit} disabled={!eTitle.trim() || eSaving}
                  className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  {eSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Changes
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ PERSONAL DETAIL SHEET ═══ */}
      <AnimatePresence>
        {detailPersonal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} onClick={() => setDetailPersonal(null)} className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px]" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              drag="y" dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 500) setDetailPersonal(null); }}
              className="fixed inset-x-0 bottom-0 z-[81] max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl shadow-2xl flex flex-col pb-safe touch-none"
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-12 h-1.5 bg-muted rounded-full opacity-60" /></div>
              <div className="px-5 pb-3 flex items-center justify-between border-b border-border/40 shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600">Personal Task — 100% private</span>
                <button onClick={() => setDetailPersonal(null)} className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground cursor-pointer"><X className="h-4 w-4" /></button>
              </div>
              <div className="px-5 py-4 space-y-3 overflow-y-auto">
                <div className="flex items-start gap-3">
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => handleTogglePersonal(detailPersonal)}
                    className={`h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer ${
                      detailPersonal.is_completed ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-500/40'
                    }`}>
                    {detailPersonal.is_completed && <Check className="h-4 w-4" />}
                  </motion.button>
                  <p className={`text-base font-bold leading-snug flex-1 ${detailPersonal.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {detailPersonal.title}
                  </p>
                </div>
                {detailPersonal.description && <p className="text-sm text-muted-foreground leading-relaxed">{detailPersonal.description}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-card rounded-xl p-3 border border-border/40">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Priority</p>
                    <span className={`text-xs font-bold ${PERSONAL_PRIORITY_META[detailPersonal.priority as PersonalPriority]?.text ?? ''}`}>
                      {PERSONAL_PRIORITY_META[detailPersonal.priority as PersonalPriority]?.label ?? detailPersonal.priority ?? 'Medium'}
                    </span>
                  </div>
                  <div className="glass-card rounded-xl p-3 border border-border/40">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Due</p>
                    <span className="text-xs font-bold text-foreground">{formatDue(detailPersonal.due_date)}</span>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => handleDeletePersonal(detailPersonal)}
                  className="w-full h-11 rounded-2xl bg-destructive/5 border border-destructive/20 text-destructive font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
                  <Trash2 className="h-4 w-4" /> Delete Task
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
