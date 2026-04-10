import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Menu,
  Plus,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Minus,
  Check,
  X,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import {
  ProjectTask,
  TaskGroup,
  TaskColumns,
  TaskColumns as TaskColumnsType,
  COLUMN_LABELS,
  PRIORITY_COLORS,
  STATUS_COLORS,
  TaskUpdateInput,
} from './types';

interface ProjectTaskGroupProps {
  group: TaskGroup;
  viewColumns: TaskColumns;
  columnWidths: Record<string, string>;
  gridTemplate: string;
  onTaskClick: (task: ProjectTask) => void;
  onInlineEdit: (taskId: string, newName: string) => void;
  onAddTask: () => void;
  onToggleCollapse: (id: string, isCollapsed: boolean) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (id: string, updates: TaskUpdateInput) => void;
}

export default function ProjectTaskGroup({
  group,
  viewColumns,
  columnWidths,
  gridTemplate,
  onTaskClick,
  onInlineEdit,
  onAddTask,
  onToggleCollapse,
  onDeleteTask,
  onUpdateTask,
}: ProjectTaskGroupProps) {
  const isCollapsed = group.is_collapsed ?? false;
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleStartEdit = (task: ProjectTask) => {
    setEditingTaskId(task.id);
    setEditingName(task.name);
  };

  const handleSaveEdit = () => {
    if (editingTaskId && editingName.trim()) {
      onInlineEdit(editingTaskId, editingName.trim());
    }
    setEditingTaskId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'High':
        return <ArrowUp size={14} style={{ color: '#ef4444' }} />;
      case 'Medium':
        return <Minus size={14} style={{ color: '#f59e0b' }} />;
      case 'Low':
        return <ArrowDown size={14} style={{ color: '#3b82f6' }} />;
      default:
        return null;
    }
  };

  const getDaysToGo = (dueDate: string | null) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return '#22c55e';
    if (percentage >= 50) return '#3b82f6';
    if (percentage >= 20) return '#eab308';
    return '#d1d5db';
  };

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6' }}>
      {/* Group Header */}
      <div
        style={{
          background: '#fafafa',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `40px 80px 1fr ${Object.entries(viewColumns).filter(([_, v]) => v).length > 2 ? '1fr'.repeat(Object.entries(viewColumns).filter(([_, v]) => v).length - 2) : ''}`,
            gap: '1rem',
            padding: '0.75rem 1rem',
            alignItems: 'center',
          }}
          onClick={() => onToggleCollapse(group.id, !isCollapsed)}
        >
          {/* Collapse Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isCollapsed ? (
              <ChevronRight size={16} style={{ color: '#9ca3af' }} />
            ) : (
              <ChevronDown size={16} style={{ color: '#9ca3af' }} />
            )}
          </div>

          {/* Group Name & Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Menu size={14} style={{ color: '#9ca3af' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
              {group.name}
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 500,
                color: '#6b7280',
                background: '#e5e7eb',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
              }}
            >
              {group.task_count || 0}
            </span>
          </div>

          {/* Empty cells for alignment */}
          <div></div>
        </div>
      </div>

      {/* Tasks */}
      {!isCollapsed && group.tasks && group.tasks.length > 0 && (
        <div>
          {group.tasks.map((task, index) => {
            const daysToGo = getDaysToGo(task.due_date);
            const visibleColumns = Object.entries(viewColumns).filter(([_, v]) => v);

            return (
              <div
                key={task.id}
                style={{
                  borderBottom: index === group.tasks!.length - 1 ? 'none' : '1px solid #f3f4f6',
                  cursor: 'pointer',
                }}
                className="ptl-task-row"
                onClick={(e) => {
                  // Don't open drawer if clicking on name for inline edit
                  const target = e.target as HTMLElement;
                  if (target.closest('.ptl-inline-edit')) return;
                  onTaskClick(task);
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `40px ${visibleColumns.map(([k]) => columnWidths[k] || '1fr').join(' ')}`,
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    alignItems: 'center',
                  }}
                >
                  {/* Checkbox + Drag Handle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        width: '1rem',
                        height: '1rem',
                        borderRadius: '0.25rem',
                        border: '2px solid #d1d5db',
                        cursor: 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <GripVertical size={12} style={{ color: '#d1d5db' }} />
                    </div>
                  </div>

                  {/* Dynamic Columns */}
                  {visibleColumns.map(([colKey]) => {
                    const col = colKey as keyof TaskColumns;

                    // Task No
                    if (col === 'task_no') {
                      return (
                        <div
                          key={col}
                          style={{
                            width: columnWidths[col] || '80px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: '#6b7280',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        >
                          {task.task_no}
                        </div>
                      );
                    }

                    // Name (with inline edit)
                    if (col === 'name') {
                      return (
                        <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {task.color && (
                            <div
                              style={{
                                width: '0.5rem',
                                height: '0.5rem',
                                borderRadius: '50%',
                                background: task.color,
                              }}
                            />
                          )}
                          {editingTaskId === task.id ? (
                            <div className="ptl-inline-edit" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleSaveEdit}
                                autoFocus
                                style={{
                                  width: '100%',
                                  padding: '0.25rem 0.5rem',
                                  border: '1px solid #3b82f6',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.8125rem',
                                  outline: 'none',
                                }}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveEdit();
                                }}
                                style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <Check size={14} style={{ color: '#22c55e' }} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
                                style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <X size={14} style={{ color: '#ef4444' }} />
                              </button>
                            </div>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.8125rem',
                                fontWeight: 500,
                                color: '#1f2937',
                                cursor: 'text',
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(task);
                              }}
                              title="Double-click to edit"
                            >
                              {task.name}
                            </span>
                          )}
                        </div>
                      );
                    }

                    // Assignees
                    if (col === 'assignees') {
                      return (
                        <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {task.assignees && task.assignees.length > 0 ? (
                            <>
                              {task.assignees.slice(0, 3).map((assignee, i) => (
                                <div
                                  key={i}
                                  style={{
                                    width: '1.5rem',
                                    height: '1.5rem',
                                    borderRadius: '50%',
                                    background: `linear-gradient(135deg, hsl(${i * 60}, 70%, 60%), hsl(${i * 60 + 30}, 70%, 50%))`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.625rem',
                                    fontWeight: 600,
                                    color: 'white',
                                    marginLeft: i > 0 ? '-0.5rem' : 0,
                                    border: '2px solid white',
                                  }}
                                  title={assignee.name}
                                >
                                  {assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                              ))}
                              {task.assignees.length > 3 && (
                                <span style={{ fontSize: '0.6875rem', color: '#6b7280', marginLeft: '0.25rem' }}>
                                  +{task.assignees.length - 3}
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>—</span>
                          )}
                        </div>
                      );
                    }

                    // Status
                    if (col === 'status') {
                      const statusColor = STATUS_COLORS[task.status as keyof typeof STATUS_COLORS];
                      return (
                        <div key={col}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.25rem 0.625rem',
                              borderRadius: '9999px',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              background: statusColor?.bg || '#f1f5f9',
                              color: statusColor?.text || '#64748b',
                            }}
                          >
                            {task.status}
                          </span>
                        </div>
                      );
                    }

                    // Tags
                    if (col === 'tags') {
                      return (
                        <div key={col} style={{ display: 'flex', gap: '0.25rem' }}>
                          {task.tags && task.tags.length > 0 ? (
                            task.tags.slice(0, 2).map((tag, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: '0.125rem 0.5rem',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.625rem',
                                  fontWeight: 500,
                                  background: '#f3f4f6',
                                  color: '#6b7280',
                                }}
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>—</span>
                          )}
                        </div>
                      );
                    }

                    // Start Date
                    if (col === 'start_date') {
                      return (
                        <div key={col} style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {task.start_date || '—'}
                        </div>
                      );
                    }

                    // Due Date
                    if (col === 'due_date') {
                      return (
                        <div key={col} style={{ fontSize: '0.75rem' }}>
                          <span style={{ color: '#6b7280' }}>{task.due_date || '—'}</span>
                          {daysToGo !== null && (
                            <div style={{ fontSize: '0.6875rem', marginTop: '0.125rem' }}>
                              {daysToGo > 0 && (
                                <span style={{ color: '#22c55e' }}>({daysToGo}d to go)</span>
                              )}
                              {daysToGo === 0 && (
                                <span style={{ color: '#eab308' }}>(Today)</span>
                              )}
                              {daysToGo < 0 && (
                                <span style={{ color: '#ef4444' }}>({Math.abs(daysToGo)}d overdue)</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Duration
                    if (col === 'duration') {
                      return (
                        <div key={col} style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {task.duration || '—'}
                        </div>
                      );
                    }

                    // Priority
                    if (col === 'priority') {
                      const priorityColor = PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS];
                      return (
                        <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {getPriorityIcon(task.priority)}
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: priorityColor?.text || '#6b7280' }}>
                            {task.priority}
                          </span>
                        </div>
                      );
                    }

                    // Completion Percentage
                    if (col === 'completion_percentage') {
                      return (
                        <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '0.375rem', background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${task.completion_percentage}%`,
                                height: '100%',
                                background: getProgressColor(task.completion_percentage),
                                borderRadius: '9999px',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#374151', minWidth: '2rem' }}>
                            {task.completion_percentage}%
                          </span>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            );
          })}

          {/* Add Task Row */}
          <div
            style={{
              padding: '0.5rem 1rem',
              borderTop: '1px solid #f3f4f6',
              background: '#fafafa',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `40px 80px 1fr ${Object.entries(viewColumns).filter(([_, v]) => v).length > 2 ? '1fr'.repeat(Object.entries(viewColumns).filter(([_, v]) => v).length - 2) : ''}`,
                gap: '1rem',
                alignItems: 'center',
              }}
            >
              <div></div>
              <div></div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTask();
                  }}
                  style={{
                    fontSize: '0.75rem',
                    color: '#2563eb',
                    fontWeight: 500,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Add Task
                </button>
                <span style={{ color: '#d1d5db' }}>|</span>
                <button
                  style={{
                    fontSize: '0.75rem',
                    color: '#2563eb',
                    fontWeight: 500,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Add Task List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty group */}
      {!isCollapsed && (!group.tasks || group.tasks.length === 0) && (
        <div style={{ padding: '1rem 2rem', background: '#fafafa' }}>
          <button
            onClick={onAddTask}
            style={{
              fontSize: '0.75rem',
              color: '#2563eb',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            + Add first task
          </button>
        </div>
      )}
    </div>
  );
}
