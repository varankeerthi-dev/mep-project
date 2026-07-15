import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Search,
  Plus,
  Filter,
  Download,
  MoreHorizontal,
  LayoutList,
  Grid3X3,
  Settings,
  Bell,
  ChevronDown,
  Check,
  X,
  GripVertical,
  Save,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { ProjectTask, TaskGroup, TaskColumns, DEFAULT_TASK_COLUMNS, COLUMN_LABELS, TaskCreateInput, TaskUpdateInput, GroupCreateInput } from './types';
import ProjectTaskGroup from './ProjectTaskGroup';
import ProjectTaskBoard from './ProjectTaskBoard';
import ProjectTaskGantt from './ProjectTaskGantt';
import ProjectTaskCalendar from './ProjectTaskCalendar';
import TaskEditDrawer from './TaskEditDrawer';
import TaskCreateDrawer from './TaskCreateDrawer';
import GroupCreateModal from './GroupCreateModal';
import { TaskViewType } from './types';

interface ProjectTaskListViewProps {
  projectId?: string;
  projectName?: string;
  organisationId: string;
  userId: string;
  globalMode?: boolean;
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  
  .ptl-container {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: #ffffff;
    overflow-x: hidden;
  }
  
  .ptl-content {
    padding: 0;
    overflow-x: auto;
  }
  
  .ptl-header {
    background: white;
    border-bottom: 1px solid #e5e7eb;
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 50;
  }
  
  .ptl-header-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  
  .ptl-project-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1a1a1a;
    padding: 0.375rem 0.625rem;
    background: #f0f4ff;
    border: 1px solid #dbeafe;
    border-radius: 0.375rem;
  }
  
  .ptl-project-dot {
    width: 0.5rem;
    height: 0.5rem;
    background: #2563eb;
    border-radius: 50%;
  }
  
  .ptl-nav {
    display: flex;
    gap: 0.25rem;
  }
  
  .ptl-nav-btn {
    font-family: 'Inter', system-ui, sans-serif;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #6b7280;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .ptl-nav-btn:hover {
    background: #f3f4f6;
    color: #1f2937;
  }
  
  .ptl-nav-btn.active {
    background: #eff6ff;
    color: #2563eb;
  }
  
  .ptl-header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .ptl-icon-btn {
    padding: 0.5rem;
    border-radius: 0.375rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.15s ease;
  }
  
  .ptl-icon-btn:hover {
    background: #f3f4f6;
    color: #1f2937;
  }
  
  .ptl-toolbar {
    background: #fafbfc;
    border-bottom: 1px solid #e0e4e8;
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 40;
    transition: all 0.2s ease;
  }
  
  .ptl-toolbar.collapsed {
    padding: 0.25rem 1rem;
  }
  
  .ptl-toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .ptl-toolbar-left.collapsed {
    gap: 0.25rem;
  }
  
  .ptl-filter-btn {
    font-family: 'Inter', system-ui, sans-serif;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #2563eb;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.15s ease;
  }
  
  .ptl-filter-btn:hover {
    background: #eff6ff;
  }
  
  .ptl-divider {
    width: 1px;
    height: 1rem;
    background: #e0e4e8;
  }
  
  .ptl-group-btn {
    font-family: 'Inter', system-ui, sans-serif;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.15s ease;
  }
  
  .ptl-group-btn:hover {
    background: #f3f4f6;
    color: #1f2937;
  }
  
  .ptl-view-btn {
    font-family: 'Inter', system-ui, sans-serif;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    background: transparent;
    border: 1px solid #e0e4e8;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.15s ease;
  }
  
  .ptl-view-btn:hover {
    background: #f9fafb;
  }
  
  .ptl-view-btn.active {
    background: #eff6ff;
    color: #2563eb;
    border-color: #bfdbfe;
  }
  
  .ptl-toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .ptl-primary-btn {
    font-family: 'Inter', system-ui, sans-serif;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: white;
    background: #2563eb;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  
  .ptl-primary-btn:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .ptl-card {
    background: #ffffff;
    border: 1px solid #d5dbe1;
    overflow: hidden;
  }
  
  /* ── Excel-inspired grid ── */
  
  .ptl-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 0.8125rem;
    color: #1f2937;
    border: 1px solid #c8ced6 !important;
  }
  
  .ptl-grid thead th {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
    background: #f1f5f9;
    border-width: 1px !important;
    border-style: solid !important;
    border-color: #c8ced6 !important;
    padding: 10px 12px;
    text-align: center;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 5;
    user-select: none;
    position: relative;
  }
  
  .ptl-grid thead th:first-child {
    width: 40px;
    min-width: 40px;
    text-align: center;
  }
  
  .ptl-grid thead th.col-left {
    text-align: left;
  }
  
  .ptl-col-resizer {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    background: transparent;
    z-index: 10;
  }
  
  .ptl-col-resizer:hover,
  .ptl-col-resizer:active {
    background: #2563eb;
  }
  
  .ptl-grid tbody tr {
    transition: background 0.1s ease;
  }
  
  .ptl-grid tbody tr:hover {
    background: #f0f7ff;
  }
  
  .ptl-grid tbody tr:nth-child(even) {
    background: #fafbfc;
  }
  
  .ptl-grid tbody tr:nth-child(even):hover {
    background: #edf4ff;
  }
  
  .ptl-grid tbody td {
    border-width: 1px !important;
    border-style: solid !important;
    border-color: #dde1e6 !important;
    padding: 10px 12px;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .ptl-grid tbody td:first-child {
    text-align: center;
    width: 40px;
    min-width: 40px;
  }
  
  .ptl-grid tbody td.td-left {
    text-align: left;
  }
  
  /* Group row spanning full width */
  .ptl-group-row td {
    background: #f1f5f9;
    border-width: 1px !important;
    border-style: solid !important;
    border-color: #c8ced6 !important;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 12px;
    text-align: left;
  }
  
  /* Add-row within group */
  .ptl-add-row td {
    background: #fafbfc;
    border-width: 1px !important;
    border-style: solid !important;
    border-color: #dde1e6 !important;
    padding: 6px 12px;
  }

  /* Sub-task rows */
  .ptl-subtask-row:hover {
    background: #f0f7ff !important;
  }

  .ptl-subtask-row td {
    font-size: 0.8125rem !important;
    color: #64748b;
  }

  /* Show subtask add button on row hover */
  .ptl-task-row:hover .ptl-subtask-add-btn {
    opacity: 1 !important;
  }
  
  .ptl-table-header {
    display: none;
  }
  
  .ptl-empty {
    padding: 4rem 2rem;
    text-align: center;
  }
  
  .ptl-empty-icon {
    width: 4rem;
    height: 4rem;
    margin: 0 auto 1rem;
    color: #d1d5db;
  }
  
  .ptl-empty-text {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.9375rem;
    color: #6b7280;
    margin-bottom: 1rem;
  }
  
  .ptl-empty-cta {
    font-family: 'Inter', system-ui, sans-serif;
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    background: #2563eb;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .ptl-empty-cta:hover {
    background: #1d4ed8;
  }
  
  .ptl-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: #6b7280;
    font-family: 'Inter', system-ui, sans-serif;
  }
  
  .ptl-skeleton {
    background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%);
    background-size: 200% 100%;
    animation: ptl-shimmer 1.5s infinite;
    border-radius: 0.5rem;
  }
  
  @keyframes ptl-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  
  /* Column visibility dropdown */
  .ptl-col-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    background: white;
    border: 1px solid #e0e4e8;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    z-index: 100;
    min-width: 200px;
    max-height: 320px;
    overflow-y: auto;
    padding: 0.5rem;
  }
  
  .ptl-col-item {
    font-family: 'Inter', system-ui, sans-serif;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.8125rem;
    color: #374151;
  }
  
  .ptl-col-item:hover {
    background: #f3f4f6;
  }
  
  .ptl-col-checkbox {
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
    border: 2px solid #d1d5db;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }
  
  .ptl-col-checkbox.checked {
    background: #2563eb;
    border-color: #2563eb;
  }
  
  /* Modal/Drawer backdrop */
  .ptl-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 200;
  }
`;

const STATUS_LABELS_TABLE: Record<string, string> = {
  'not_started': 'Not Started',
  'in_progress': 'In Progress',
  'under_review': 'Under Review',
  'on_hold': 'On Hold',
  'completed': 'Completed',
};

if (typeof document !== 'undefined') {
  const styleId = 'ptl-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

export default function ProjectTaskListView({
  projectId,
  projectName = 'Project Tasks',
  organisationId,
  userId,
  globalMode = false,
}: ProjectTaskListViewProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewColumns, setViewColumns] = useState<Record<string, boolean>>({
    task_no: true,
    title: true,
    project_name: globalMode,
    assignees: true,
    status: true,
    priority: true,
    start_date: true,
    due_date: true,
    completion_percentage: true,
    tags: false,
    discipline: false,
    duration_days: false,
    location: false,
    drawing_ref: false,
    wbs_code: false,
    estimated_hours: false,
    actual_hours: false,
    last_report: false,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [createForGroupId, setCreateForGroupId] = useState<string | null>(null);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<TaskViewType>('table');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupByField, setGroupByField] = useState<string>('task_list');
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizableWidths, setResizableWidths] = useState<Record<string, string>>({
    task_no: '70px',
    title: '300px',
    project_name: '150px',
    assignees: '140px',
    status: '130px',
    tags: '120px',
    start_date: '110px',
    due_date: '110px',
    duration_days: '90px',
    priority: '110px',
    completion_percentage: '140px',
    discipline: '110px',
    location: '110px',
    drawing_ref: '110px',
    wbs_code: '90px',
    estimated_hours: '80px',
    actual_hours: '80px',
    last_report: '110px',
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside a dropdown or its trigger button
      if (target.closest('.ptl-col-dropdown') || target.closest('.ptl-col-item') ||
          target.closest('.ptl-filter-btn') || target.closest('.ptl-group-btn') ||
          target.closest('.ptl-view-btn')) {
        return;
      }
      setShowStatusFilter(false);
      setShowGroupByDropdown(false);
      setShowColumnDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch task groups with tasks (including sub-tasks)
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['project-tasks', projectId, globalMode, organisationId],
    queryFn: async () => {
      // Fetch project names for global mode
      let projectNameMap: Record<string, string> = {};
      if (globalMode) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .eq('organisation_id', organisationId);
        if (projects) {
          projects.forEach((p: any) => { projectNameMap[p.id] = p.name; });
        }
      }

      let taskGroups: any[] = [];
      if (globalMode) {
        // In global mode, fetch all task groups for the organization
        const { data: allGroups, error: groupsError } = await supabase
          .from('task_groups')
          .select('*')
          .eq('organisation_id', organisationId)
          .order('sort_order', { ascending: true });
        if (groupsError) throw groupsError;
        taskGroups = allGroups || [];
      } else {
        // Per-project mode
        const { data: projectGroups, error: groupsError } = await supabase
          .from('task_groups')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true });
        if (groupsError) throw groupsError;
        taskGroups = projectGroups || [];
      }

      // Fetch ALL tasks (parents + sub-tasks)
      let tasksQuery = supabase
        .from('tasks')
        .select('*')
        .is('deleted_at', null);
      
      if (globalMode) {
        tasksQuery = tasksQuery.eq('organisation_id', organisationId);
      } else {
        tasksQuery = tasksQuery.eq('project_id', projectId);
      }
      
      tasksQuery = tasksQuery.order('task_no', { ascending: true });
      const { data: allTasks, error: tasksError } = await tasksQuery;

      if (tasksError) throw tasksError;

      // Fetch user profiles for assignee name resolution
      const allAssigneeIds = allTasks?.flatMap((t: any) => t.assignee_ids || []) || [];
      const uniqueIds = [...new Set(allAssigneeIds.filter(Boolean))];
      let profileMap: Record<string, { full_name: string; email?: string }> = {};
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from('employees')
          .select('id, name, work_email')
          .in('id', uniqueIds);
        if (profiles) {
          (profiles as any[]).forEach((p: any) => {
            profileMap[p.id] = { full_name: p.name || '', email: p.work_email || '' };
          });
        }
      }

      // Enrich tasks with assignee info, subtasks, and project name
      const enrichedTasks = (allTasks || []).map((t: any) => ({
        ...t,
        assignees: (t.assignee_ids || []).map((uid: string) => ({
          id: uid,
          name: profileMap[uid]?.full_name || uid.slice(0, 8),
          email: profileMap[uid]?.email || '',
        })),
        project_name: globalMode ? (projectNameMap[t.project_id] || 'Unknown') : undefined,
      }));

      // Separate parents and children
      const parentTasks = enrichedTasks.filter((t: any) => !t.parent_task_id);
      const childTasksMap: Record<string, any[]> = {};
      enrichedTasks.filter((t: any) => t.parent_task_id).forEach((t: any) => {
        if (!childTasksMap[t.parent_task_id]) childTasksMap[t.parent_task_id] = [];
        childTasksMap[t.parent_task_id].push(t);
      });

      // Attach subtasks to parents
      const tasksWithSubtasks = parentTasks.map((t: any) => ({
        ...t,
        subtasks: childTasksMap[t.id] || [],
        subtask_count: (childTasksMap[t.id] || []).length,
      }));

      // Group tasks by task_group_id
      const groupedTasks = taskGroups.map(group => ({
        ...group,
        tasks: tasksWithSubtasks.filter((t: any) => t.task_group_id === group.id),
        task_count: tasksWithSubtasks.filter((t: any) => t.task_group_id === group.id).length,
      }));

      // Ungrouped tasks
      const ungroupedTasks = tasksWithSubtasks.filter((t: any) => !t.task_group_id);
      if (ungroupedTasks.length > 0) {
        groupedTasks.push({
          id: 'ungrouped',
          project_id: projectId,
          name: 'Ungrouped',
          start_date: null,
          due_date: null,
          is_collapsed: false,
          sort_order: 999,
          organisation_id: organisationId,
          created_by: userId,
          created_at: '',
          updated_at: '',
          tasks: ungroupedTasks,
          task_count: ungroupedTasks.length,
        } as TaskGroup);
      }

      return groupedTasks;
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (input: TaskCreateInput) => {
      // Auto-generate task_no: find max task_no in project
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('task_no')
        .eq('project_id', input.project_id || projectId)
        .is('deleted_at', null);

      let maxNo = 0;
      if (existingTasks) {
        existingTasks.forEach((t: any) => {
          const raw = String(t.task_no || '');
          const num = parseInt(raw.replace(/\D/g, ''), 10);
          if (!isNaN(num) && num > maxNo) maxNo = num;
        });
      }

      const insertData: Record<string, unknown> = {
        organisation_id: organisationId,
        created_by: userId,
        project_id: input.project_id || projectId,
        task_group_id: input.task_group_id || null,
        parent_task_id: input.parent_task_id || null,
        task_no: maxNo + 1,
        title: input.title,
        description: input.description || null,
        task_type: input.task_type || 'task',
        status: input.status || 'not_started',
        priority: input.priority || 'medium',
        start_date: input.start_date || null,
        due_date: input.due_date || null,
        duration_days: input.duration_days || null,
        estimated_hours: input.estimated_hours || null,
        completion_percentage: 0,
        assignee_ids: input.assignee_ids && input.assignee_ids.length > 0 ? input.assignee_ids : [],
        tags: input.tags && input.tags.length > 0 ? input.tags : [],
        discipline: input.discipline || null,
        location: input.location || null,
        drawing_ref: input.drawing_ref || null,
        wbs_code: input.wbs_code || null,
        is_following: false,
        is_archived: false,
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setShowCreateModal(false);
      setCreateForGroupId(null);
      setParentTaskId(null);
    },
    onError: (error) => {
      alert('Failed to create task: ' + (error as Error).message);
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TaskUpdateInput }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setSelectedTask(null);
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setSelectedTask(null);
    },
    onError: (error) => {
      alert('Failed to delete task: ' + (error as Error).message);
    },
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (input: GroupCreateInput) => {
      const { data, error } = await supabase
        .from('task_groups')
        .insert({
          ...input,
          organisation_id: organisationId,
          created_by: userId,
          sort_order: groups.length,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setShowGroupModal(false);
    },
  });

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('task_groups')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
  });

  // Toggle column visibility
  const toggleColumn = (col: string) => {
    setViewColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  // Handle task click
  const handleTaskClick = (task: ProjectTask) => {
    setSelectedTask(task);
  };

  // Handle inline name edit
  const handleNameInlineEdit = async (taskId: string, newName: string) => {
    updateTaskMutation.mutate({ id: taskId, updates: { title: newName } });
  };

  // Handle create task (modal)
  const handleCreateTask = (groupId?: string | null) => {
    setCreateForGroupId(groupId || null);
    setShowCreateModal(true);
  };

  // Handle inline create task
  const handleInlineCreateTask = (groupId: string | null, taskName: string) => {
    createTaskMutation.mutate({
      title: taskName,
      project_id: projectId,
      task_group_id: groupId || undefined,
      status: 'not_started',
      priority: 'medium',
    });
  };

  // Filter tasks by search and status, then regroup based on groupByField
  const allTasks = groups.flatMap(g => g.tasks || []);

  const filteredTasks = (allTasks as any[]).filter((task: any) => {
    const matchSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(task.task_no).toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const STATUS_ORDER: Record<string, number> = { not_started: 0, in_progress: 1, under_review: 2, on_hold: 3, completed: 4 };
  const STATUS_GROUP_LABELS: Record<string, string> = {
    'not_started': 'Not Started',
    'in_progress': 'In Progress',
    'under_review': 'Under Review',
    'on_hold': 'On Hold',
    'completed': 'Completed',
  };

  let displayGroups: TaskGroup[];

  if (groupByField === 'none') {
    displayGroups = [{
      id: 'all',
      project_id: projectId,
      name: 'All Tasks',
      start_date: null,
      due_date: null,
      is_collapsed: false,
      sort_order: 0,
      organisation_id: organisationId,
      created_by: userId,
      created_at: '',
      updated_at: '',
      tasks: filteredTasks,
      task_count: filteredTasks.length,
    } as TaskGroup];
  } else if (groupByField === 'status') {
    const statusGroups: Record<string, any[]> = {};
    filteredTasks.forEach((task: any) => {
      const key = task.status || 'not_started';
      if (!statusGroups[key]) statusGroups[key] = [];
      statusGroups[key].push(task);
    });
    const sortedKeys = Object.keys(statusGroups).sort((a, b) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99));
    displayGroups = sortedKeys.map((key, idx) => ({
      id: `status-${key}`,
      project_id: projectId,
      name: STATUS_GROUP_LABELS[key] || key,
      start_date: null,
      due_date: null,
      is_collapsed: false,
      sort_order: idx,
      organisation_id: organisationId,
      created_by: userId,
      created_at: '',
      updated_at: '',
      tasks: statusGroups[key],
      task_count: statusGroups[key].length,
    } as TaskGroup));
  } else if (groupByField === 'priority') {
    const prioGroups: Record<string, any[]> = {};
    filteredTasks.forEach((task: any) => {
      const key = task.priority || 'medium';
      if (!prioGroups[key]) prioGroups[key] = [];
      prioGroups[key].push(task);
    });
    const sortedKeys = Object.keys(prioGroups).sort((a, b) => (PRIORITY_ORDER[a] ?? 99) - (PRIORITY_ORDER[b] ?? 99));
    displayGroups = sortedKeys.map((key, idx) => ({
      id: `priority-${key}`,
      project_id: projectId,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      start_date: null,
      due_date: null,
      is_collapsed: false,
      sort_order: idx,
      organisation_id: organisationId,
      created_by: userId,
      created_at: '',
      updated_at: '',
      tasks: prioGroups[key],
      task_count: prioGroups[key].length,
    } as TaskGroup));
  } else {
    // task_list (default) - use original groups
    displayGroups = groups.map(group => ({
      ...group,
      tasks: group.tasks?.filter((task: any) => {
        const matchSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(task.task_no).toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || task.status === statusFilter;
        return matchSearch && matchStatus;
      }),
    })).filter(group => group.tasks && group.tasks.length > 0);
  }

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the task being dragged and the target task
    const allTasks = displayGroups.flatMap(g => g.tasks || []);
    const activeTask = allTasks.find((t: any) => t.id === activeId) as any;
    const overTask = allTasks.find((t: any) => t.id === overId) as any;

    if (!activeTask) return;

    // Determine the target group and parent
    let targetGroupId = activeTask.task_group_id;
    let targetParentId = activeTask.parent_task_id;

    if (overTask) {
      // If dropping on a sub-task, use its parent as the new parent
      if (overTask.parent_task_id) {
        targetParentId = overTask.parent_task_id;
        targetGroupId = overTask.task_group_id;
      } else {
        // Dropping on a parent task - make it a sub-task of that task
        targetParentId = overTask.id;
        targetGroupId = overTask.task_group_id;
      }
    }

    // Build the updates
    const updates: any = {};

    // If moving to a different parent or group
    if (targetParentId !== activeTask.parent_task_id) {
      updates.parent_task_id = targetParentId;
    }
    if (targetGroupId !== activeTask.task_group_id) {
      updates.task_group_id = targetGroupId;
    }

    // Apply the update if there are changes
    if (Object.keys(updates).length > 0) {
      updateTaskMutation.mutate({ id: activeId, updates });
    }
  }, [displayGroups, updateTaskMutation]);

  // Get all sortable IDs for the context
  const getAllSortableIds = useCallback(() => {
    return displayGroups.flatMap(g => {
      const taskIds = (g.tasks || []).map((t: any) => t.id);
      const subtaskIds = (g.tasks || []).flatMap((t: any) => 
        (t.subtasks || []).map((st: any) => st.id)
      );
      return [...taskIds, ...subtaskIds];
    });
  }, [displayGroups]);

  const handleColumnResize = useCallback((key: string, deltaX: number) => {
    setResizableWidths(prev => {
      const current = prev[key];
      if (!current || current === 'auto') return prev;
      const currentPx = parseInt(current, 10);
      if (isNaN(currentPx)) return prev;
      const newWidth = Math.max(50, currentPx + deltaX);
      return { ...prev, [key]: `${newWidth}px` };
    });
  }, []);

  if (isLoading) {
    return (
      <div className="ptl-container">
        <div className="ptl-loading">
          <div className="ptl-skeleton" style={{ width: '100%', height: '400px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="ptl-container">
      {/* Toolbar */}
      <div className={`ptl-toolbar ${toolbarCollapsed ? 'collapsed' : ''}`}>
        <div className={`ptl-toolbar-left ${toolbarCollapsed ? 'collapsed' : ''}`}>
          <div className="ptl-project-name">
            <div className="ptl-project-dot" />
            {projectName}
          </div>
          {!toolbarCollapsed && (
            <>
              <div className="ptl-divider" />
              <div style={{ position: 'relative' }}>
                <button className="ptl-filter-btn" onClick={(e) => { e.stopPropagation(); setShowStatusFilter(!showStatusFilter); setShowGroupByDropdown(false); setShowColumnDropdown(false); }}>
                  {statusFilter === 'all' ? 'All Open' : STATUS_LABELS_TABLE[statusFilter] || statusFilter} <ChevronDown size={12} />
                </button>
                {showStatusFilter && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.25rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 60, minWidth: '160px', padding: '0.25rem' }}>
                    <div
                      className="ptl-col-item"
                      onClick={() => { setStatusFilter('all'); setShowStatusFilter(false); }}
                    >
                      <div className={`ptl-col-checkbox ${statusFilter === 'all' ? 'checked' : ''}`}>
                        {statusFilter === 'all' && <Check size={12} color="white" />}
                      </div>
                      All Open
                    </div>
                    {Object.entries(STATUS_LABELS_TABLE).map(([key, label]) => (
                      <div
                        key={key}
                        className="ptl-col-item"
                        onClick={() => { setStatusFilter(key); setShowStatusFilter(false); }}
                      >
                        <div className={`ptl-col-checkbox ${statusFilter === key ? 'checked' : ''}`}>
                          {statusFilter === key && <Check size={12} color="white" />}
                        </div>
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <button className="ptl-group-btn" onClick={(e) => { e.stopPropagation(); setShowGroupByDropdown(!showGroupByDropdown); setShowStatusFilter(false); setShowColumnDropdown(false); }}>
                  <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Group By:</span>
                  {groupByField === 'task_list' ? 'Task List' : groupByField === 'status' ? 'Status' : groupByField === 'priority' ? 'Priority' : 'None'} <ChevronDown size={12} />
                </button>
                {showGroupByDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.25rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 60, minWidth: '160px', padding: '0.25rem' }}>
                    {[
                      { key: 'task_list', label: 'Task List' },
                      { key: 'status', label: 'Status' },
                      { key: 'priority', label: 'Priority' },
                      { key: 'none', label: 'None' },
                    ].map(opt => (
                      <div
                        key={opt.key}
                        className="ptl-col-item"
                        onClick={() => { setGroupByField(opt.key); setShowGroupByDropdown(false); }}
                      >
                        <div className={`ptl-col-checkbox ${groupByField === opt.key ? 'checked' : ''}`}>
                          {groupByField === opt.key && <Check size={12} color="white" />}
                        </div>
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="ptl-toolbar-right">
          {!toolbarCollapsed && (
            <>
              <div style={{ display: 'flex', gap: '0.25rem', marginRight: '0.5rem' }}>
                {(['table', 'board', 'gantt', 'calendar'] as TaskViewType[]).map(view => (
                  <button
                    key={view}
                    className={`ptl-view-btn ${currentView === view ? 'active' : ''}`}
                    onClick={() => setCurrentView(view)}
                  >
                    {view === 'table' && <LayoutList size={14} />}
                    {view === 'board' && <Grid3X3 size={14} />}
                    {view === 'gantt' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="12" width="12" height="4" rx="1"/></svg>}
                    {view === 'calendar' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>
              <div className="ptl-divider" />
              <div style={{ position: 'relative' }}>
                <button
                  className="ptl-view-btn"
                  onClick={(e) => { e.stopPropagation(); setShowColumnDropdown(!showColumnDropdown); setShowStatusFilter(false); setShowGroupByDropdown(false); }}
                >
                  <Eye size={14} />
                  Columns
                </button>
                {showColumnDropdown && (
                  <div className="ptl-col-dropdown" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    {Object.keys(COLUMN_LABELS).map(col => (
                      <div
                        key={col}
                        className="ptl-col-item"
                        onClick={() => toggleColumn(col as string)}
                      >
                        <div className={`ptl-col-checkbox ${viewColumns[col] ? 'checked' : ''}`}>
                          {viewColumns[col] && <Check size={12} color="white" />}
                        </div>
                        {COLUMN_LABELS[col]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="ptl-view-btn">
                <Download size={14} />
                Export
              </button>
              <button
                className="ptl-primary-btn"
                onClick={() => handleCreateTask()}
              >
                <Plus size={14} />
                Add Task
              </button>
            </>
          )}
          <button
            className="ptl-view-btn"
            onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
            style={{ padding: '0.25rem 0.375rem' }}
            title={toolbarCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
          >
            <ChevronDown size={14} style={{ transform: toolbarCollapsed ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="ptl-content">
        {!toolbarCollapsed && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                }}
              />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.375rem 0.5rem 0.375rem 2rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
            </div>
            <button
              className="ptl-view-btn"
              onClick={() => setShowGroupModal(true)}
            >
            <Plus size={12} />
            Add List
          </button>
          </div>
        )}
      </div>

      {/* View Content */}
      {currentView === 'table' && (
        <div className="ptl-card">
          {displayGroups.length === 0 ? (
            <div className="ptl-empty">
              <div className="ptl-empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </div>
              <p className="ptl-empty-text">No tasks yet. Create your first task to get started.</p>
              <div className="flex items-center gap-2">
                <button
                  className="ptl-empty-cta"
                  onClick={() => handleCreateTask()}
                >
                  <Plus size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Create Task
                </button>
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={getAllSortableIds()}
                strategy={verticalListSortingStrategy}
              >
                <table className="ptl-grid">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      {Object.entries(viewColumns).filter(([_, v]) => v).map(([key]) => (
                        <th
                          key={key}
                          style={{ width: resizableWidths[key] || 'auto' }}
                          className={key === 'title' ? 'col-left' : undefined}
                        >
                          {COLUMN_LABELS[key as keyof TaskColumns]}
                          <div
                            style={{
                              position: 'absolute',
                              right: '-2px',
                              top: '-1px',
                              bottom: '-1px',
                              width: '5px',
                              cursor: 'col-resize',
                              background: 'transparent',
                              zIndex: 10,
                              borderRight: '2px solid transparent',
                            }}
                            onMouseEnter={(e) => { (e.target as HTMLElement).style.borderRightColor = '#2563eb'; }}
                            onMouseLeave={(e) => { if (!isResizing) (e.target as HTMLElement).style.borderRightColor = 'transparent'; }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              let lastX = e.clientX;
                              const onMouseMove = (ev: MouseEvent) => {
                                const delta = ev.clientX - lastX;
                                lastX = ev.clientX;
                                handleColumnResize(key, delta);
                              };
                              const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                                setIsResizing(false);
                              };
                              setIsResizing(true);
                              document.addEventListener('mousemove', onMouseMove);
                              document.addEventListener('mouseup', onMouseUp);
                            }}
                          />
                        </th>
                      ))}
                      <th style={{ width: '36px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayGroups.map(group => (
                      <ProjectTaskGroup
                        key={group.id}
                        group={group}
                        viewColumns={viewColumns}
                        columnWidths={resizableWidths}
                        onTaskClick={handleTaskClick}
                        onInlineEdit={handleNameInlineEdit}
                        onAddTask={(taskName: string) => handleInlineCreateTask(group.id === 'ungrouped' ? null : group.id, taskName)}
                        onAddSubTask={(parentId: string) => {
                          setCreateForGroupId(group.id === 'ungrouped' ? null : group.id);
                          setParentTaskId(parentId);
                          setShowCreateModal(true);
                        }}
                        onToggleCollapse={(id, isCollapsed) => {
                          if (!id.startsWith('status-') && !id.startsWith('priority-') && id !== 'all') {
                            updateGroupMutation.mutate({ id, updates: { is_collapsed: isCollapsed } })
                          } else {
                            const g = displayGroups.find(g => g.id === id);
                            if (g) g.is_collapsed = isCollapsed;
                          }
                        }}
                        onDeleteTask={(id) => setDeleteConfirmId(id)}
                        onUpdateTask={(id, updates) => updateTaskMutation.mutate({ id, updates })}
                      />
                    ))}
                  </tbody>
                </table>
              </SortableContext>
              <DragOverlay>
                {activeDragId ? (
                  <table className="ptl-grid" style={{ opacity: 0.8, pointerEvents: 'none' }}>
                    <tbody>
                      {(() => {
                        const allTasks = displayGroups.flatMap(g => g.tasks || []);
                        const activeTask = allTasks.find((t: any) => t.id === activeDragId) as any;
                        if (activeTask) {
                          return (
                            <tr style={{ background: '#eff6ff', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                              <td style={{ textAlign: 'center', width: '40px' }}>
                                <GripVertical size={14} style={{ color: '#2563eb' }} />
                              </td>
                              <td style={{ fontWeight: 500, color: '#1f2937' }}>
                                {activeTask.title}
                              </td>
                            </tr>
                          );
                        }
                        return null;
                      })()}
                    </tbody>
                  </table>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            style={{ background: 'white', borderRadius: '0.75rem', padding: '1.5rem', width: '360px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={18} style={{ color: '#ef4444' }} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>Delete Task?</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              This action cannot be undone. The task and all its data will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, background: '#f1f5f9', color: '#475569', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmId) {
                    deleteTaskMutation.mutate(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {currentView === 'board' && (
        <ProjectTaskBoard
          projectId={projectId || ''}
          organisationId={organisationId}
          userId={userId}
        />
      )}

      {currentView === 'gantt' && (
        <ProjectTaskGantt
          projectId={projectId || ''}
          projectName={projectName || ''}
          organisationId={organisationId}
        />
      )}

      {currentView === 'calendar' && (
        <ProjectTaskCalendar
          projectId={projectId || ''}
          organisationId={organisationId}
        />
      )}

      {/* Task Edit Drawer */}
      {selectedTask && (
        <>
          <div className="ptl-backdrop" onClick={() => setSelectedTask(null)} />
          <TaskEditDrawer
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(updates) => updateTaskMutation.mutate({ id: selectedTask.id, updates })}
            onDelete={() => deleteTaskMutation.mutate(selectedTask.id)}
            groups={groups}
            organisationId={organisationId}
          />
        </>
      )}

      {/* Create Task Drawer */}
      {showCreateModal && (
        <TaskCreateDrawer
          projectId={projectId || ''}
          defaultGroupId={createForGroupId}
          groups={groups}
          organisationId={organisationId}
          onClose={() => {
            setShowCreateModal(false);
            setCreateForGroupId(null);
            setParentTaskId(null);
          }}
          onSubmit={(input) => createTaskMutation.mutate(parentTaskId ? { ...input, parent_task_id: parentTaskId } : input)}
          isLoading={createTaskMutation.isPending}
        />
      )}

      {/* Create Group Modal */}
      {showGroupModal && (
        <GroupCreateModal
          projectId={projectId || ''}
          onClose={() => setShowGroupModal(false)}
          onSubmit={(input) => createGroupMutation.mutate(input)}
          isLoading={createGroupMutation.isPending}
        />
      )}
    </div>
  );
}
