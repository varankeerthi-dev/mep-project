# PRD — Task Management Enhancements

**Feature:** Points #15, #18, #19 from UX Discussion
**Date:** 2026-07-26
**Status:** Draft

---

## Executive Summary

Three enhancements to the task management system:
1. **#15 — Drag-and-drop Kanban reordering** (improve existing)
2. **#18 — Bulk task assignment** (new feature)
3. **#19 — Task time tracking** (UX improvements to existing)

---

## Current State Analysis

### What Already Exists

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| DnD in table view | ✅ Implemented | `ProjectTaskListView.tsx` (1555 lines) | Uses `@dnd-kit/core` + `@dnd-kit/sortable`. Works for row reorder + group reassign. |
| DnD in Kanban board | ✅ Implemented | `TaskBoard.tsx` (270 lines) | Card drag between 5 status columns. Uses `@dnd-kit/core` + `DragOverlay`. |
| Bulk status change | ✅ Implemented | `TaskListView.tsx` (1126 lines) | Select checkboxes → bulk status/priority update via `useBulkUpdateTasks`. |
| Bulk priority change | ✅ Implemented | `TaskListView.tsx` | Same as above. |
| Bulk assignment | ❌ Not implemented | — | No UI or hook for assigning multiple tasks to a person at once. |
| Time tracking (DB) | ✅ Implemented | `database-unified-tasks.sql` | `task_time_logs` table with auto-trigger recalculating `actual_hours`. |
| Time tracking (UI) | ✅ Implemented | `TaskDetailDrawer.tsx` (554 lines) | Time tab with start/stop timer, manual entry, log list. |
| Time tracking (hooks) | ✅ Implemented | `hooks.ts` (727 lines) | `useTaskTimeLogs`, `useCreateTimeLog`, `useUpdateTimeLog`, `useDeleteTimeLog`. |
| Estimated hours | ✅ DB column | `tasks.estimated_hours` | DECIMAL(8,2). Editable in `TaskEditDrawer.tsx`. |
| Actual hours | ✅ Auto-calculated | `tasks.actual_hours` | Auto-set by DB trigger from `task_time_logs` sum. |

---

## Feature #15 — Drag-and-Drop Kanban Reordering

### Problem
The existing DnD works but has gaps:
- Table view DnD is in a 1555-line monolith (`ProjectTaskListView.tsx`)
- Kanban board DnD (`TaskBoard.tsx`) only allows moving between status columns — cannot reorder within a column
- No visual feedback for drop targets (no highlighted valid zones)
- Cannot drag tasks between different task groups in table view reliably
- No touch support for mobile (critical for site engineers)

### Requirements

#### R1.1 — Kanban Column Reordering
- Users can drag cards within the same status column to reorder them
- Reordering updates `task_no` (sort order) in the database
- Visual: cards shift to show insertion point during drag

#### R1.2 — Enhanced Drop Feedback
- Valid drop zones highlight with a dashed border during drag
- Invalid zones (e.g., no permission) show a red indicator
- `DragOverlay` shows a ghost card matching the original's width/height

#### R1.3 — Mobile Touch Support
- Long-press (300ms) activates drag on touch devices
- Touch drag shows a floating card under the finger
- Drop confirmed on release over a valid zone

#### R1.4 — Group Reassignment via Drag
- In table view, dragging a task onto a group header moves it to that group
- Updates `task_group_id` on the task
- Group completion stats recalculate

### What to Change

| File | Change | Reason |
|------|--------|--------|
| `TaskBoard.tsx` | Add `SortableContext` within each column | Enable within-column reorder |
| `TaskBoard.tsx` | Add `useSensor(PointerSensor)` + `useSensor(TouchSensor)` | Mobile support |
| `TaskBoard.tsx` | Add drop zone highlighting via CSS classes | Visual feedback |
| `ProjectTaskListView.tsx` | Extract DnD logic into `useTaskDnD.ts` hook | Break up 1555-line monolith |
| `ProjectTaskListView.tsx` | Add `TouchSensor` to `DndContext` | Mobile support |
| `hooks.ts` | Add `useReorderTasks` mutation | Batch-update `task_no` for reordered tasks |
| `database-unified-tasks.sql` | Add index on `task_no` per group | Performance for sort queries |

### What to Delete

| File | Reason |
|------|--------|
| None | No deletions — this is additive |

### Implementation Notes

```typescript
// New hook: hooks.ts
export function useReorderTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; task_no: number; task_group_id?: string }[]) => {
      const promises = updates.map(({ id, ...data }) =>
        supabase.from('tasks').update(data).eq('id', id)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

// TouchSensor config for mobile
const touchSensor = useSensor(TouchSensor, {
  activationConstraint: { delay: 300, tolerance: 5 },
});
```

### Acceptance Criteria

- [ ] Drag a card within a Kanban column → order updates persist after page refresh
- [ ] Drag a card between columns → status updates correctly
- [ ] Drag a task onto a group header in table view → `task_group_id` updates
- [ ] On mobile: long-press activates drag, card follows finger, drop on release
- [ ] Drop zone highlights during drag, invalid zones show red
- [ ] `task_no` values remain sequential within each group after reorder

---

## Feature #18 — Bulk Task Assignment

### Problem
When setting up a project with 50+ tasks, assigning them one-by-one is tedious. The existing bulk operations only cover status and priority — not assignment. There is no way to select multiple tasks and assign them to a person or role at once.

### Requirements

#### R2.1 — Bulk Assign via Checkbox Selection
- User selects 2+ tasks via checkboxes in table view
- "Assign" action appears in the bulk action bar
- Click opens a person selector (team members for the project)
- Confirming assigns all selected tasks to that person

#### R2.2 — Bulk Unassign
- Same selection flow → "Unassign" action
- Clears `assignee_ids` for all selected tasks

#### R2.3 — Bulk Assign by Role/Discipline
- Filter tasks by discipline (mechanical, electrical, plumbing, etc.)
- Select all filtered tasks → assign to a role or person
- Useful for initial project setup: "Assign all electrical tasks to Ahmed"

#### R2.4 — Quick Assign from Board View
- In Kanban board, right-click a card → "Assign to..."
- Shows a mini person selector dropdown
- Single-task quick assign (not bulk, but improves daily workflow)

### What to Change

| File | Change | Reason |
|------|--------|--------|
| `TaskListView.tsx` | Add "Assign" and "Unassign" to bulk action bar | Bulk assignment UI |
| `TaskListView.tsx` | Add `BulkAssignModal` component | Person/team selector modal |
| `hooks.ts` | Add `useBulkAssignTasks` mutation | Batch-update `assignee_ids` |
| `hooks.ts` | `useTeamMembers` already exists | Reuse for person selector |
| `ProjectTaskListView.tsx` | Add same bulk assign action bar | Project-scoped view |
| `TaskBoard.tsx` | Add right-click context menu with "Assign to..." | Quick assign from board |
| `types.ts` | Add `BulkAssignPayload` type | Type safety |

### What to Delete

| File | Reason |
|------|--------|
| None | No deletions — this is additive |

### Implementation Notes

```typescript
// New hook: hooks.ts
export function useBulkAssignTasks() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: async ({ taskIds, assigneeId }: { taskIds: string[]; assigneeId: string }) => {
      // Fetch current assignee_ids for each task, then append
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, assignee_ids')
        .in('id', taskIds);

      const promises = (tasks || []).map((task) => {
        const current = task.assignee_ids || [];
        if (current.includes(assigneeId)) return Promise.resolve();
        return supabase
          .from('tasks')
          .update({ assignee_ids: [...current, assigneeId] })
          .eq('id', task.id);
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

// BulkAssignModal component
function BulkAssignModal({ taskIds, onClose }: { taskIds: string[]; onClose: () => void }) {
  const { data: members } = useTeamMembers();
  const bulkAssign = useBulkAssignTasks();

  // Search/filter team members
  // On select: bulkAssign.mutate({ taskIds, assigneeId })
  // On confirm: onClose()
}
```

### Acceptance Criteria

- [ ] Select 3+ tasks in table view → "Assign" button appears in bulk action bar
- [ ] Click "Assign" → modal shows team members with search
- [ ] Select a person → all selected tasks get that person added to `assignee_ids`
- [ ] "Unassign" clears `assignee_ids` for all selected tasks
- [ ] Board view: right-click card → "Assign to..." dropdown → assign single task
- [ ] Assigning a person who is already assigned to a task doesn't duplicate them
- [ ] After bulk assign, task list refreshes and shows updated assignees

---

## Feature #19 — Task Time Tracking (UX Improvements)

### Problem
Time tracking is fully implemented at the DB and hook level, but the UX has friction:
- Must open the task detail drawer → navigate to Time tab → click "Start Timer"
- No way to see which tasks you're currently tracking time on from the list
- No weekly/daily summary view
- Estimated vs actual comparison is buried in the edit drawer
- No visual indicator of time health (on-track vs over-estimated)

### Requirements

#### R3.1 — Inline Timer from List View
- Each task row shows a small play/stop button in the "Time" column
- Clicking play starts a timer for that task (creates a `task_time_logs` entry with `start_time = now()`)
- Clicking stop ends the timer (sets `end_time = now()`, calculates duration)
- Only one timer can be active at a time across all tasks

#### R3.2 — Active Timer Banner
- When a timer is running, show a fixed banner at the top of the task list
- Banner shows: task name, elapsed time (updating live), stop button
- Clicking the task name in the banner opens the detail drawer

#### R3.3 — Time Health Indicator
- In the task list, show a color-coded dot next to `actual_hours`:
  - Green: actual < 80% of estimated
  - Yellow: actual 80-100% of estimated
  - Red: actual > 100% of estimated
  - Gray: no estimate set

#### R3.4 — Time Summary Cards
- At the top of the task list (or in a collapsible panel), show:
  - Total estimated hours (for filtered tasks)
  - Total actual hours logged
  - Variance (actual - estimated)
  - Tasks with no time logged (count)

#### R3.5 — Daily Time Log Entry
- Add a "Log Time" quick-action button per task row
- Opens a mini form: date, hours, description, billable checkbox
- No need to open the full detail drawer

### What to Change

| File | Change | Reason |
|------|--------|--------|
| `TaskListView.tsx` | Add "Time" column with play/stop buttons | Inline timer |
| `TaskListView.tsx` | Add `ActiveTimerBanner` component | Running timer indicator |
| `TaskListView.tsx` | Add time health dots in time column | Visual health |
| `TaskListView.tsx` | Add `TimeSummaryCards` above the table | Summary stats |
| `ProjectTaskListView.tsx` | Same changes as above | Project-scoped view |
| `ProjectTaskGroup.tsx` | Add time column rendering | Group-level time display |
| `hooks.ts` | Add `useActiveTimer` query | Fetch currently running timer |
| `hooks.ts` | Add `useStartTimer` / `useStopTimer` mutations | Timer start/stop |
| `types.ts` | Add `TimeHealth` type | `'on-track' | 'warning' | 'over-budget' | 'no-estimate'` |

### What to Delete

| File | Reason |
|------|--------|
| None | No deletions — this is additive |

### Implementation Notes

```typescript
// New hook: hooks.ts
export function useActiveTimer(userId: string) {
  return useQuery({
    queryKey: ['active-timer', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('task_time_logs')
        .select('*, tasks!inner(id, title, project_id)')
        .eq('user_id', userId)
        .is('end_time', null)
        .single();
      return data;
    },
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (taskId: string) => {
      // First, stop any existing active timer
      const { data: active } = await supabase
        .from('task_time_logs')
        .select('id')
        .eq('user_id', user!.id)
        .is('end_time', null);

      if (active?.length) {
        await supabase
          .from('task_time_logs')
          .update({ end_time: new Date().toISOString() })
          .in('id', active.map((a) => a.id));
      }

      // Start new timer
      const { data } = await supabase
        .from('task_time_logs')
        .insert({
          task_id: taskId,
          user_id: user!.id,
          start_time: new Date().toISOString(),
          organisation_id: /* from auth */,
        })
        .select()
        .single();

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: taskKeys.timeLogs('') });
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: string) => {
      const { data } = await supabase
        .from('task_time_logs')
        .update({ end_time: new Date().toISOString() })
        .eq('id', logId)
        .select()
        .single();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: taskKeys.timeLogs('') });
    },
  });
}

// Time health calculation
function getTimeHealth(estimated: number | null, actual: number | null): TimeHealth {
  if (!estimated || !actual) return 'no-estimate';
  const ratio = actual / estimated;
  if (ratio < 0.8) return 'on-track';
  if (ratio <= 1.0) return 'warning';
  return 'over-budget';
}
```

### Acceptance Criteria

- [ ] Play button on task row → starts timer, button changes to stop (red)
- [ ] Only one timer active at a time; starting a new one stops the previous
- [ ] Active timer banner shows at top of list with task name, elapsed time, stop button
- [ ] Elapsed time in banner updates every second (live)
- [ ] Time health dot shows green/yellow/red/gray next to actual hours
- [ ] Time summary cards show estimated, actual, variance, no-estimate count
- [ ] "Log Time" button opens mini form with date, hours, description, billable
- [ ] All time operations work from both `TaskListView` and `ProjectTaskListView`

---

## Files Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/tasks/BulkAssignModal.tsx` | Modal for selecting team members for bulk assignment |
| `src/components/tasks/ActiveTimerBanner.tsx` | Fixed banner showing running timer |
| `src/components/tasks/TimeSummaryCards.tsx` | Summary stats for estimated vs actual hours |
| `src/components/tasks/QuickTimeLog.tsx` | Mini form for logging time without opening drawer |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/tasks/hooks.ts` | Add `useReorderTasks`, `useBulkAssignTasks`, `useActiveTimer`, `useStartTimer`, `useStopTimer` |
| `src/components/tasks/types.ts` | Add `TimeHealth`, `BulkAssignPayload` types |
| `src/components/tasks/TaskListView.tsx` | Add bulk assign actions, inline timer, time health, time summary |
| `src/components/tasks/ProjectTaskListView.tsx` | Same as above for project-scoped view |
| `src/components/tasks/ProjectTaskGroup.tsx` | Add time column rendering |
| `src/components/tasks/TaskBoard.tsx` | Add within-column reorder, context menu for quick assign |
| `src/components/tasks/SortableRow.tsx` | Add touch sensor support |

### Files to Delete

| File | Reason |
|------|--------|
| None | All changes are additive; no files removed |

---

## Dependency Impact

| Dependency | Action | Reason |
|------------|--------|--------|
| `@dnd-kit/core` | Already installed | Used for DnD |
| `@dnd-kit/sortable` | Already installed | Used for sortable lists |
| `@dnd-kit/utilities` | Already installed | CSS transform utilities |
| No new deps needed | — | All features use existing libraries |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `ProjectTaskListView.tsx` already 1555 lines | Adding more code makes it harder to maintain | Extract DnD logic into `useTaskDnD.ts` hook; extract time components |
| Timer state lost on page refresh | User loses running timer | Persist active timer in DB (already done via `task_time_logs` with `end_time = null`) |
| Bulk assign on large datasets (100+ tasks) | Slow performance | Batch in groups of 50; show progress indicator |
| Mobile DnD conflicts with scroll | Users can't scroll when trying to drag | Use 300ms long-press activation; 5px tolerance |

---

## Implementation Order

### Phase 1 — Quick Wins (1-2 days)
1. `useReorderTasks` hook
2. `useBulkAssignTasks` hook + `BulkAssignModal`
3. `useActiveTimer` / `useStartTimer` / `useStopTimer` hooks

### Phase 2 — Table View (2-3 days)
4. Add "Assign" / "Unassign" to bulk action bar in `TaskListView`
5. Add inline timer (play/stop) to time column
6. Add `ActiveTimerBanner`
7. Add time health dots
8. Add `TimeSummaryCards`
9. Add `QuickTimeLog` mini form

### Phase 3 — Kanban Board (1-2 days)
10. Add `SortableContext` within each Kanban column
11. Add right-click context menu with "Assign to..."
12. Add `TouchSensor` for mobile drag

### Phase 4 — Project View (1 day)
13. Port all changes from `TaskListView` to `ProjectTaskListView`
14. Port changes to `ProjectTaskGroup`

### Phase 5 — Polish (1 day)
15. Extract inline CSS from `ProjectTaskListView` into Tailwind classes
16. Extract DnD logic into `useTaskDnD.ts` hook
17. Add loading states and error handling for bulk operations

---

## Estimated Effort

| Phase | Days |
|-------|------|
| Phase 1 | 1-2 |
| Phase 2 | 2-3 |
| Phase 3 | 1-2 |
| Phase 4 | 1 |
| Phase 5 | 1 |
| **Total** | **6-9 days** |
