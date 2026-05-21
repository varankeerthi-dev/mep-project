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
  viewColumns: Record<string, boolean>;
  columnWidths: Record<string, string>;
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
    setEditingName(task.title);
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

  const visibleColumns = Object.entries(viewColumns).filter(([_, v]) => v);
  const colSpan = visibleColumns.length + 1;

  return (
    <>
      {/* Group Header Row */}
      <tr
        className="ptl-group-row"
        onClick={() => onToggleCollapse(group.id, !isCollapsed)}
        style={{ cursor: 'pointer' }}
      >
        <td colSpan={colSpan} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isCollapsed ? (
              <ChevronRight size={16} style={{ color: '#64748b' }} />
            ) : (
              <ChevronDown size={16} style={{ color: '#64748b' }} />
            )}
            <Menu size={14} style={{ color: '#94a3b8' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
              {group.name}
            </span>
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                color: '#64748b',
                background: '#e2e8f0',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
              }}
            >
              {group.task_count || 0}
            </span>
          </div>
        </td>
      </tr>

      {/* Task Rows */}
      {!isCollapsed && group.tasks && group.tasks.length > 0 && (
        <>
          {group.tasks.map((task) => {
            const daysToGo = getDaysToGo(task.due_date);

            return (
              <tr
                key={task.id}
                className="ptl-task-row"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('.ptl-inline-edit')) return;
                  onTaskClick(task);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Drag Handle Column */}
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GripVertical size={14} style={{ color: '#cbd5e1', cursor: 'grab' }} />
                  </div>
                </td>

                {/* Dynamic Columns */}
                {visibleColumns.map(([colKey]) => {
                  const col = colKey as keyof TaskColumns;

                  if (col === 'task_no') {
                    return (
                      <td key={col} style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: '#64748b', fontSize: '0.75rem' }}>
                        {task.task_no}
                      </td>
                    );
                  }

                  if (col === 'title') {
                    return (
                      <td key={col} className="td-left" style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {task.color && (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: task.color, flexShrink: 0 }} />
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
                                  border: '2px solid #3b82f6',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.8125rem',
                                  fontFamily: "'Inter', system-ui, sans-serif",
                                  outline: 'none',
                                }}
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                                style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <Check size={14} style={{ color: '#22c55e' }} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                                style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <X size={14} style={{ color: '#ef4444' }} />
                              </button>
                            </div>
                          ) : (
                            <span
                              style={{
                                fontFamily: "'Inter', system-ui, sans-serif",
                                fontSize: '0.8125rem',
                                fontWeight: 500,
                                color: '#1f2937',
                                cursor: 'text',
                              }}
                              onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit(task); }}
                              title="Double-click to edit"
                            >
                              {task.title}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  if (col === 'assignees') {
                    return (
                      <td key={col}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                          {task.assignee_ids && task.assignee_ids.length > 0 ? (
                            <>
                              {task.assignee_ids.slice(0, 3).map((id: string, i: number) => (
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
                                    fontSize: '0.5625rem',
                                    fontWeight: 600,
                                    color: 'white',
                                    marginLeft: i > 0 ? '-0.5rem' : 0,
                                    border: '2px solid white',
                                  }}
                                  title={id}
                                >
                                  {id.slice(0, 2).toUpperCase()}
                                </div>
                              ))}
                              {task.assignee_ids.length > 3 && (
                                <span style={{ fontSize: '0.6875rem', color: '#6b7280', marginLeft: '0.25rem' }}>
                                  +{task.assignee_ids.length - 3}
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>—</span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  if (col === 'status') {
                    const sc = task.status ? STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] : undefined;
                    return (
                      <td key={col}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.25rem 0.625rem',
                            borderRadius: '9999px',
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            fontFamily: "'Inter', system-ui, sans-serif",
                            background: sc?.bg || '#f1f5f9',
                            color: sc?.text || '#64748b',
                          }}
                        >
                          {task.status ? (STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]?.label || task.status) : '—'}
                        </span>
                      </td>
                    );
                  }

                  if (col === 'priority') {
                    const pc = task.priority ? PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] : undefined;
                    return (
                      <td key={col}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                          {getPriorityIcon(task.priority)}
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: "'Inter', system-ui, sans-serif", color: pc?.text || '#6b7280' }}>
                            {task.priority || '—'}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  if (col === 'tags') {
                    return (
                      <td key={col}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          {task.tags && task.tags.length > 0 ? (
                            task.tags.slice(0, 2).map((tag, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: '0.125rem 0.5rem',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.625rem',
                                  fontWeight: 500,
                                  fontFamily: "'Inter', system-ui, sans-serif",
                                  background: '#f3f4f6',
                                  color: '#6b7280',
                                }}
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>—</span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  if (col === 'start_date') {
                    return (
                      <td key={col} style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '0.75rem', color: '#64748b' }}>
                        {task.start_date || '—'}
                      </td>
                    );
                  }

                  if (col === 'due_date') {
                    return (
                      <td key={col} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {task.due_date || '—'}
                        </div>
                        {daysToGo !== null && (
                          <div style={{ fontSize: '0.625rem', fontWeight: 500, marginTop: '0.125rem' }}>
                            {daysToGo > 0 && (
                              <span style={{ color: '#22c55e' }}>({daysToGo}d)</span>
                            )}
                            {daysToGo === 0 && (
                              <span style={{ color: '#eab308' }}>(Today)</span>
                            )}
                            {daysToGo < 0 && (
                              <span style={{ color: '#ef4444' }}>({Math.abs(daysToGo)}d late)</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  }

                  if (col === 'duration_days') {
                    return (
                      <td key={col} style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '0.75rem', color: '#64748b' }}>
                        {task.duration_days ? `${task.duration_days}d` : '—'}
                      </td>
                    );
                  }

                  if (col === 'completion_percentage') {
                    return (
                      <td key={col}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '60px', height: '6px', background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${task.completion_percentage}%`,
                                height: '100%',
                                background: getProgressColor(task.completion_percentage),
                                borderRadius: '9999px',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', fontWeight: 600, color: '#374151', minWidth: '2rem' }}>
                            {task.completion_percentage}%
                          </span>
                        </div>
                      </td>
                    );
                  }

                  if (col === 'discipline') {
                    return (
                      <td key={col} style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '0.75rem', color: '#64748b' }}>
                        {task.discipline || '—'}
                      </td>
                    );
                  }

                  if (col === 'location') {
                    return (
                      <td key={col} style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '0.75rem', color: '#64748b' }}>
                        {task.location || '—'}
                      </td>
                    );
                  }

                  if (col === 'drawing_ref') {
                    return (
                      <td key={col} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#64748b' }}>
                        {task.drawing_ref || '—'}
                      </td>
                    );
                  }

                  if (col === 'wbs_code') {
                    return (
                      <td key={col} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#64748b' }}>
                        {task.wbs_code || '—'}
                      </td>
                    );
                  }

                  if (col === 'estimated_hours') {
                    return (
                      <td key={col} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#64748b' }}>
                        {task.estimated_hours ? `${task.estimated_hours}h` : '—'}
                      </td>
                    );
                  }

                  if (col === 'actual_hours') {
                    return (
                      <td key={col} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#64748b' }}>
                        {task.actual_hours ? `${task.actual_hours}h` : '—'}
                      </td>
                    );
                  }

                  return <td key={col}>—</td>;
                })}
              </tr>
            );
          })}

          {/* Add Task Row */}
          <tr className="ptl-add-row">
            <td colSpan={colSpan}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddTask(); }}
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: '0.75rem',
                    color: '#2563eb',
                    fontWeight: 500,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <Plus size={12} />
                  Add Task
                </button>
              </div>
            </td>
          </tr>
        </>
      )}

      {/* Empty group */}
      {!isCollapsed && (!group.tasks || group.tasks.length === 0) && (
        <tr>
          <td colSpan={colSpan} style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <button
              onClick={onAddTask}
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '0.75rem',
                color: '#2563eb',
                fontWeight: 500,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem 0',
              }}
            >
              + Add first task
            </button>
          </td>
        </tr>
      )}
    </>
  );
}