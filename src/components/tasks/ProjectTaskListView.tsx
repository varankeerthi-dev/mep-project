import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
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
} from 'lucide-react';
import { ProjectTask, TaskGroup, TaskColumns, DEFAULT_TASK_COLUMNS, COLUMN_LABELS, TaskCreateInput, TaskUpdateInput, GroupCreateInput } from './types';
import ProjectTaskGroup from './ProjectTaskGroup';
import TaskEditDrawer from './TaskEditDrawer';
import TaskCreateDrawer from './TaskCreateDrawer';
import GroupCreateModal from './GroupCreateModal';

interface ProjectTaskListViewProps {
  projectId: string;
  projectName?: string;
  organisationId: string;
  userId: string;
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
  .ptl-container {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: #faf9f7;
    overflow-x: hidden;
  }
  
  .ptl-content {
    padding: 0.75rem 1rem;
    overflow-x: auto;
  }
  
  .ptl-content {
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
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a1a;
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    border-radius: 0.375rem;
  }
  
  .ptl-project-dot {
    width: 0.5rem;
    height: 0.5rem;
    background: #3b82f6;
    border-radius: 50%;
  }
  
  .ptl-nav {
    display: flex;
    gap: 0.25rem;
  }
  
  .ptl-nav-btn {
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
    background: white;
    border-bottom: 1px solid #e5e7eb;
    padding: 0.375rem 1rem;
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
    background: #e5e7eb;
  }
  
  .ptl-group-btn {
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
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    background: transparent;
    border: 1px solid #e5e7eb;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.15s ease;
  }
  
  .ptl-view-btn:hover {
    background: #f9fafb;
  }
  
  .ptl-toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .ptl-primary-btn {
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
  
  .ptl-content {
    padding: 0.75rem 1rem;
  }
  
  .ptl-card {
    background: white;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  
  .ptl-table-header {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #fafafa;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
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
    font-size: 0.9375rem;
    color: #6b7280;
    margin-bottom: 1rem;
  }
  
  .ptl-empty-cta {
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
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    z-index: 100;
    min-width: 200px;
    padding: 0.5rem;
  }
  
  .ptl-col-item {
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
}: ProjectTaskListViewProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewColumns, setViewColumns] = useState<TaskColumns>(DEFAULT_TASK_COLUMNS);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [createForGroupId, setCreateForGroupId] = useState<string | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);

  // Fetch task groups with tasks
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      const { data: taskGroups, error: groupsError } = await supabase
        .from('task_groups')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (groupsError) throw groupsError;

      const { data: tasks, error: tasksError } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .is('parent_task_id', null)
        .order('task_no', { ascending: true });

      if (tasksError) throw tasksError;

      // Group tasks by task_group_id
      const groupedTasks = taskGroups.map(group => ({
        ...group,
        tasks: tasks.filter(t => t.task_group_id === group.id),
        task_count: tasks.filter(t => t.task_group_id === group.id).length,
      }));

      // Ungrouped tasks
      const ungroupedTasks = tasks.filter(t => !t.task_group_id);
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
      const { data, error } = await supabase
        .from('project_tasks')
        .insert({
          ...input,
          organisation_id: organisationId,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setShowCreateModal(false);
      setCreateForGroupId(null);
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TaskUpdateInput }) => {
      const { data, error } = await supabase
        .from('project_tasks')
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
        .from('project_tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setSelectedTask(null);
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
  const toggleColumn = (col: keyof TaskColumns) => {
    setViewColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  // Handle task click
  const handleTaskClick = (task: ProjectTask) => {
    setSelectedTask(task);
  };

  // Handle inline name edit
  const handleNameInlineEdit = async (taskId: string, newName: string) => {
    updateTaskMutation.mutate({ id: taskId, updates: { name: newName } });
  };

  // Handle create task
  const handleCreateTask = (groupId?: string | null) => {
    setCreateForGroupId(groupId || null);
    setShowCreateModal(true);
  };

  // Filter tasks by search
  const filteredGroups = groups.map(group => ({
    ...group,
    tasks: group.tasks?.filter(task =>
      task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.task_no.toString().includes(searchTerm)
    ),
  })).filter(group => group.tasks && group.tasks.length > 0);

  // Column widths for grid
  const getColumnWidths = () => {
    const widths: Record<string, string> = {
      task_no: '80px',
      name: '1fr',
      assignees: '160px',
      status: '140px',
      tags: '120px',
      start_date: '120px',
      due_date: '120px',
      duration: '100px',
      priority: '100px',
      completion_percentage: '140px',
    };
    return widths;
  };

  const columnWidths = getColumnWidths();

  // Build grid template
  const getGridTemplate = () => {
    const visibleCols = Object.entries(viewColumns)
      .filter(([_, v]) => v)
      .map(([k]) => columnWidths[k] || '1fr');
    return `40px ${visibleCols.join(' ')}`;
  };

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
              <button className="ptl-filter-btn">
                All Open <ChevronDown size={12} />
              </button>
              <button className="ptl-group-btn">
                <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Group By:</span>
                Task List <ChevronDown size={12} />
              </button>
            </>
          )}
        </div>
        <div className="ptl-toolbar-right">
          {!toolbarCollapsed && (
            <>
              <div style={{ position: 'relative' }}>
                <button
                  className="ptl-view-btn"
                  onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                >
                  <Eye size={14} />
                  Columns
                </button>
                {showColumnDropdown && (
                  <div className="ptl-col-dropdown">
                    {(Object.keys(COLUMN_LABELS) as (keyof TaskColumns)[]).map(col => (
                      <div
                        key={col}
                        className="ptl-col-item"
                        onClick={() => toggleColumn(col)}
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

      {/* Task List */}
      <div className="ptl-card">
          {filteredGroups.length === 0 ? (
            <div className="ptl-empty">
              <div className="ptl-empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </div>
              <p className="ptl-empty-text">No tasks yet. Create your first task to get started.</p>
              <button
                className="ptl-empty-cta"
                onClick={() => handleCreateTask()}
              >
                <Plus size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Create Task
              </button>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div 
                className="ptl-table-header" 
                style={{ 
                  gridTemplateColumns: `40px ${Object.entries(viewColumns).filter(([_, v]) => v).map(([k]) => columnWidths[k] || '1fr').join(' ')}`
                }}
              >
                <div></div>
                {Object.entries(viewColumns).filter(([_, v]) => v).map(([key]) => (
                  <div key={key} style={{ width: columnWidths[key] || 'auto', minWidth: 0 }}>{COLUMN_LABELS[key as keyof TaskColumns]}</div>
                ))}
              </div>
              {/* Task Groups */}
              {filteredGroups.map(group => (
                <ProjectTaskGroup
                  key={group.id}
                  group={group}
                  viewColumns={viewColumns}
                  columnWidths={columnWidths}
                  gridTemplate={getGridTemplate()}
                  onTaskClick={handleTaskClick}
                  onInlineEdit={handleNameInlineEdit}
                  onAddTask={() => handleCreateTask(group.id)}
                  onToggleCollapse={(id, isCollapsed) =>
                    updateGroupMutation.mutate({ id, updates: { is_collapsed: isCollapsed } })
                  }
                  onDeleteTask={(id) => deleteTaskMutation.mutate(id)}
                  onUpdateTask={(id, updates) => updateTaskMutation.mutate({ id, updates })}
                />
              ))}
            </>
          )}
        </div>

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
          />
        </>
      )}

      {/* Create Task Drawer */}
      {showCreateModal && (
        <TaskCreateDrawer
          projectId={projectId}
          defaultGroupId={createForGroupId}
          groups={groups}
          onClose={() => {
            setShowCreateModal(false);
            setCreateForGroupId(null);
          }}
          onSubmit={(input) => createTaskMutation.mutate(input)}
          isLoading={createTaskMutation.isPending}
        />
      )}

      {/* Create Group Modal */}
      {showGroupModal && (
        <GroupCreateModal
          projectId={projectId}
          onClose={() => setShowGroupModal(false)}
          onSubmit={(input) => createGroupMutation.mutate(input)}
          isLoading={createGroupMutation.isPending}
        />
      )}
    </div>
  );
}
