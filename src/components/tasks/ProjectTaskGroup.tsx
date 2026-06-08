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
  CornerDownRight,
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
  onAddTask: (taskName: string) => void;
  onAddSubTask: (parentId: string) => void;
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
  onAddSubTask,
  onToggleCollapse,
  onDeleteTask,
  onUpdateTask,
}: ProjectTaskGroupProps) {
  const isCollapsed = group.is_collapsed ?? false;
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [inlineNewTask, setInlineNewTask] = useState('');
  const [showInlineInput, setShowInlineInput] = useState(false);

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
  const colSpan = visibleColumns.length + 2; // +1 for grip handle, +1 for delete

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
              <React.Fragment key={task.id}>
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
                    const rawNo = task.task_no;
                    const displayNo = rawNo != null ? String(rawNo).replace(/^T-?0*/i, '') || String(rawNo) : '—';
                    return (
                      <td key={col} style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: '#64748b', fontSize: '0.75rem' }}>
                        {displayNo}
                      </td>
                    );
                  }

                  if (col === 'title') {
                    const hasSubtasks = (task as any).subtasks && (task as any).subtasks.length > 0;
                    const isExpanded = expandedTasks.has(task.id);
                    return (
                      <td key={col} className="td-left" style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {hasSubtasks ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTasks(prev => {
                                  const next = new Set(prev);
                                  if (next.has(task.id)) next.delete(task.id);
                                  else next.add(task.id);
                                  return next;
                                });
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', marginLeft: '0.125rem' }}>{(task as any).subtasks.length}</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddSubTask(task.id); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', opacity: 0 }}
                              className="ptl-subtask-add-btn"
                              title="Add sub-task"
                            >
                              <CornerDownRight size={13} />
                            </button>
                          )}
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
                              {task.assignees && task.assignees.length > 0 ? (
                                task.assignees.slice(0, 3).map((assignee: any, i: number) => (
                                  <div
                                    key={i}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      padding: '0.125rem 0.5rem',
                                      borderRadius: '9999px',
                                      fontSize: '0.6875rem',
                                      fontWeight: 500,
                                      fontFamily: "'Inter', system-ui, sans-serif",
                                      background: `linear-gradient(135deg, hsl(${i * 60 + 200}, 70%, 95%), hsl(${i * 60 + 220}, 70%, 90%))`,
                                      color: `hsl(${i * 60 + 200}, 50%, 35%)`,
                                      border: `1px solid hsl(${i * 60 + 200}, 50%, 80%)`,
                                      marginLeft: i > 0 ? '-0.25rem' : 0,
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={assignee.email || assignee.id}
                                  >
                                    <div
                                      style={{
                                        width: '1.125rem',
                                        height: '1.125rem',
                                        borderRadius: '50%',
                                        background: `linear-gradient(135deg, hsl(${i * 60 + 200}, 70%, 60%), hsl(${i * 60 + 230}, 70%, 50%))`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.5rem',
                                        fontWeight: 600,
                                        color: 'white',
                                      }}
                                    >
                                      {(assignee.name || assignee.id).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    {assignee.name || assignee.id.slice(0, 8)}
                                  </div>
                                ))
                              ) : (
                                task.assignee_ids.slice(0, 3).map((id: string, i: number) => (
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
                                ))
                              )}
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
                {/* Delete column */}
                <td style={{ textAlign: 'center', width: '36px', minWidth: '36px', maxWidth: '36px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                    title="Delete task"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      borderRadius: '0.25rem',
                      color: '#cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none'; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>

              {/* Sub-task rows */}
              {(task as any).subtasks && (task as any).subtasks.length > 0 && expandedTasks.has(task.id) && (task as any).subtasks.map((subtask: any) => (
                <tr
                  key={`sub-${subtask.id}`}
                  className="ptl-subtask-row"
                  onClick={() => onTaskClick(subtask)}
                  style={{ cursor: 'pointer', background: '#fafbfc' }}
                >
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CornerDownRight size={12} style={{ color: '#94a3b8', marginRight: '0.125rem' }} />
                    </div>
                  </td>
                  {visibleColumns.map(([colKey]) => {
                    const col = colKey as keyof TaskColumns;
                    if (col === 'task_no') {
                      const rawNo = subtask.task_no;
                      const displayNo = rawNo != null ? String(rawNo).replace(/^T-?0*/i, '') || String(rawNo) : '—';
                      return (
                        <td key={col} style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, color: '#94a3b8', fontSize: '0.6875rem' }}>
                          {displayNo}
                        </td>
                      );
                    }
                    if (col === 'title') {
                      return (
                        <td key={col} className="td-left" style={{ textAlign: 'left', paddingLeft: '2.5rem' }}>
                          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '0.8125rem', fontWeight: 400, color: '#475569' }}>
                            {subtask.title}
                          </span>
                        </td>
                      );
                    }
                    if (col === 'status') {
                      const sc = subtask.status ? STATUS_COLORS[subtask.status as keyof typeof STATUS_COLORS] : undefined;
                      return (
                        <td key={col}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.1875rem 0.5rem', borderRadius: '9999px', fontSize: '0.625rem', fontWeight: 500, fontFamily: "'Inter', system-ui, sans-serif", background: sc?.bg || '#f1f5f9', color: sc?.text || '#64748b' }}>
                            {subtask.status ? (STATUS_COLORS[subtask.status as keyof typeof STATUS_COLORS]?.label || subtask.status) : '—'}
                          </span>
                        </td>
                      );
                    }
                    if (col === 'priority') {
                      const pc = subtask.priority ? PRIORITY_COLORS[subtask.priority as keyof typeof PRIORITY_COLORS] : undefined;
                      return (
                        <td key={col}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: pc?.text || '#94a3b8' }}>
                            {subtask.priority || '—'}
                          </span>
                        </td>
                      );
                    }
                    if (col === 'assignees') {
                      return (
                        <td key={col}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                            {subtask.assignees && subtask.assignees.length > 0 ? (
                              subtask.assignees.slice(0, 2).map((a: any, i: number) => (
                                <div key={i} style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', background: `linear-gradient(135deg, hsl(${i * 60 + 200}, 70%, 60%), hsl(${i * 60 + 230}, 70%, 50%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 600, color: 'white' }}>
                                  {(a.name || a.id).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.6875rem', color: '#cbd5e1' }}>—</span>
                            )}
                          </div>
                        </td>
                      );
                    }
                    if (col === 'completion_percentage') {
                      return (
                        <td key={col}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                              <div style={{ width: `${subtask.completion_percentage || 0}%`, height: '100%', background: getProgressColor(subtask.completion_percentage || 0), borderRadius: '9999px' }} />
                            </div>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', color: '#94a3b8' }}>{subtask.completion_percentage || 0}%</span>
                          </div>
                        </td>
                      );
                    }
                    if (col === 'start_date' || col === 'due_date') {
                      return <td key={col} style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{subtask[col] || '—'}</td>;
                    }
                    return <td key={col} style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>—</td>;
                  })}
                  {/* Sub-task delete column */}
                  <td style={{ textAlign: 'center', width: '36px', minWidth: '36px', maxWidth: '36px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteTask(subtask.id); }}
                      title="Delete sub-task"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s, background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none'; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              </React.Fragment>
            );
          })}

          {/* Inline Add Task Row */}
          <tr
            className="ptl-add-row"
            onMouseEnter={() => setShowInlineInput(true)}
            onMouseLeave={() => { if (!inlineNewTask.trim()) setShowInlineInput(false); }}
          >
            <td style={{ width: '40px' }}></td>
            {visibleColumns.map(([colKey]) => {
              if (colKey === 'title') {
                return (
                  <td key="inline-title" style={{ width: columnWidths[colKey] || 'auto' }}>
                    {showInlineInput ? (
                      <div style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem', gap: '0.5rem' }}>
                        <Plus size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                        <input
                          type="text"
                          value={inlineNewTask}
                          onChange={(e) => setInlineNewTask(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && inlineNewTask.trim()) {
                              onAddTask(inlineNewTask.trim());
                              setInlineNewTask('');
                            }
                            if (e.key === 'Escape') {
                              setInlineNewTask('');
                              setShowInlineInput(false);
                            }
                          }}
                          placeholder="Task name..."
                          autoFocus
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '0.8125rem',
                            fontFamily: "'Inter', system-ui, sans-serif",
                            color: '#18181b',
                            background: 'transparent',
                            padding: '0.25rem 0',
                          }}
                        />
                      </div>
                    ) : null}
                  </td>
                );
              }
              return <td key={colKey} style={{ width: columnWidths[colKey] || 'auto' }}></td>;
            })}
            <td style={{ width: '36px' }}></td>
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