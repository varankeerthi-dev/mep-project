import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MoreHorizontal,
  Link,
  Copy,
  Trash2,
  Move,
  Eye,
  Calendar,
  Clock,
  User,
  Flag,
  Tag,
  FileText,
  Plus,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  ProjectTask,
  TaskGroup,
  TaskStatus,
  TaskPriority,
  TASK_COLORS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  TaskUpdateInput,
  TaskAssignee,
} from './types';

interface TaskEditDrawerProps {
  task: ProjectTask;
  onClose: () => void;
  onUpdate: (updates: TaskUpdateInput) => void;
  onDelete: () => void;
  groups: TaskGroup[];
}

const STATUS_OPTIONS: TaskStatus[] = [
  'Not Started',
  'In Progress',
  'Possible Delay',
  'On Hold',
  'Completed',
];

const PRIORITY_OPTIONS: TaskPriority[] = ['None', 'Low', 'Medium', 'High'];

export default function TaskEditDrawer({
  task,
  onClose,
  onUpdate,
  onDelete,
  groups,
}: TaskEditDrawerProps) {
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isFollowing, setIsFollowing] = useState(task.is_following);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Close action menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDeleteConfirm, onClose]);

  const handleCopyLink = () => {
    const taskUrl = `${window.location.origin}/projects/tasks/${task.id}`;
    navigator.clipboard.writeText(taskUrl);
    setShowActionMenu(false);
  };

  const handleClone = () => {
    onUpdate({
      name: `${task.name} (Copy)`,
      assignees: task.assignees,
      start_date: task.start_date,
      due_date: task.due_date,
      priority: task.priority,
    });
    setShowActionMenu(false);
  };

  const handleMove = (groupId: string | null) => {
    onUpdate({ task_group_id: groupId });
    setShowMoveModal(false);
    setShowActionMenu(false);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  const handleFollowToggle = () => {
    setIsFollowing(!isFollowing);
    onUpdate({ is_following: !isFollowing });
    setShowActionMenu(false);
  };

  const handleColorChange = (color: string) => {
    onUpdate({ color });
    setShowColorPicker(false);
    setShowActionMenu(false);
  };

  return (
    <>
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '480px',
          height: '100vh',
          background: 'white',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <input
            type="text"
            defaultValue={task.name}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== task.name) {
                onUpdate({ name: e.target.value.trim() });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            style={{
              flex: 1,
              fontSize: '1rem',
              fontWeight: 600,
              color: '#1a1a1a',
              border: 'none',
              outline: 'none',
              background: 'transparent',
            }}
          />
          <div style={{ display: 'flex', gap: '0.25rem', position: 'relative' }}>
            {/* Action Menu */}
            <button
              ref={moreButtonRef}
              onClick={() => setShowActionMenu(!showActionMenu)}
              style={{
                padding: '0.375rem',
                borderRadius: '0.375rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
              }}
            >
              <MoreHorizontal size={18} />
            </button>

            {/* Action Menu Dropdown */}
            {showActionMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.25rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  minWidth: '180px',
                  zIndex: 400,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={handleCopyLink}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    fontSize: '0.8125rem',
                    color: '#374151',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Link size={14} />
                  Copy Link
                </button>

                {/* Color */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      fontSize: '0.8125rem',
                      color: '#374151',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: task.color || '#e5e7eb',
                        border: '1px solid #d1d5db',
                      }}
                    />
                    Color
                    <ChevronDown size={12} style={{ marginLeft: 'auto' }} />
                  </button>
                  {showColorPicker && (
                    <div
                      style={{
                        padding: '0.5rem',
                        background: '#f9fafb',
                        borderTop: '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        {TASK_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => handleColorChange(color)}
                            style={{
                              width: '1.5rem',
                              height: '1.5rem',
                              borderRadius: '50%',
                              background: color,
                              border: task.color === color ? '2px solid #1a1a1a' : 'none',
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                        <button
                          onClick={() => handleColorChange('')}
                          style={{
                            width: '1.5rem',
                            height: '1.5rem',
                            borderRadius: '50%',
                            background: '#e5e7eb',
                            border: !task.color ? '2px solid #1a1a1a' : 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            color: '#9ca3af',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleFollowToggle}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    fontSize: '0.8125rem',
                    color: '#374151',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Eye size={14} />
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>

                <button
                  onClick={() => setShowMoveModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    fontSize: '0.8125rem',
                    color: '#374151',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Move size={14} />
                  Move
                </button>

                <button
                  onClick={handleClone}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    fontSize: '0.8125rem',
                    color: '#374151',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Copy size={14} />
                  Clone
                </button>

                <div style={{ borderTop: '1px solid #e5e7eb', margin: '0.25rem 0' }} />

                <button
                  onClick={handleDelete}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    fontSize: '0.8125rem',
                    color: '#ef4444',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '0.375rem',
                borderRadius: '0.375rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem' }}>
          {/* Status */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                marginBottom: '0.5rem',
              }}
            >
              Status
            </label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]?.bg || '#f1f5f9',
                  color: STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]?.text || '#64748b',
                  border: '1px solid #e5e7eb',
                  width: '100%',
                  justifyContent: 'space-between',
                }}
              >
                {task.status}
                <ChevronDown size={14} />
              </button>
              {showStatusDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    zIndex: 100,
                  }}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        onUpdate({ status });
                        setShowStatusDropdown(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8125rem',
                        background: task.status === status ? STATUS_COLORS[status].bg : 'transparent',
                        color: task.status === status ? STATUS_COLORS[status].text : '#374151',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {task.status === status && <Check size={12} />}
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Priority */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                marginBottom: '0.5rem',
              }}
            >
              <Flag size={12} />
              Priority
            </label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]?.bg || '#f1f5f9',
                  color: PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]?.text || '#64748b',
                  border: '1px solid #e5e7eb',
                  width: '100%',
                  justifyContent: 'space-between',
                }}
              >
                {task.priority}
                <ChevronDown size={14} />
              </button>
              {showPriorityDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    zIndex: 100,
                  }}
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <button
                      key={priority}
                      onClick={() => {
                        onUpdate({ priority });
                        setShowPriorityDropdown(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8125rem',
                        background: task.priority === priority ? PRIORITY_COLORS[priority].bg : 'transparent',
                        color: task.priority === priority ? PRIORITY_COLORS[priority].text : '#374151',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {task.priority === priority && <Check size={12} />}
                      {priority}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assignees */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                marginBottom: '0.5rem',
              }}
            >
              <User size={12} />
              Assignees
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {task.assignees && task.assignees.length > 0 ? (
                task.assignees.map((assignee, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.25rem 0.625rem',
                      background: '#f3f4f6',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, hsl(${i * 60}, 70%, 60%), hsl(${i * 60 + 30}, 70%, 50%))`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.5rem',
                        fontWeight: 600,
                        color: 'white',
                      }}
                    >
                      {assignee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    {assignee.name}
                  </div>
                ))
              ) : (
                <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No assignees</span>
              )}
              <button
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  color: '#2563eb',
                  background: '#eff6ff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                Add
              </button>
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  marginBottom: '0.5rem',
                }}
              >
                <Calendar size={12} />
                Start Date
              </label>
              <input
                type="date"
                value={task.start_date || ''}
                onChange={(e) => onUpdate({ start_date: e.target.value || null })}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  marginBottom: '0.5rem',
                }}
              >
                <Calendar size={12} />
                Due Date
              </label>
              <input
                type="date"
                value={task.due_date || ''}
                onChange={(e) => onUpdate({ due_date: e.target.value || null })}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Duration */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                marginBottom: '0.5rem',
              }}
            >
              <Clock size={12} />
              Duration
            </label>
            <input
              type="text"
              placeholder="e.g., 5 days"
              defaultValue={task.duration}
              onBlur={(e) => {
                if (e.target.value !== task.duration) {
                  onUpdate({ duration: e.target.value || undefined });
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.375rem',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Progress */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                marginBottom: '0.5rem',
              }}
            >
              Completion: {task.completion_percentage}%
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="range"
                min="0"
                max="100"
                value={task.completion_percentage}
                onChange={(e) => onUpdate({ completion_percentage: parseInt(e.target.value) })}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min="0"
                max="100"
                value={task.completion_percentage}
                onChange={(e) => onUpdate({ completion_percentage: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                style={{
                  width: '3rem',
                  padding: '0.25rem 0.5rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.25rem',
                  fontSize: '0.8125rem',
                  textAlign: 'center',
                }}
              />
            </div>
          </div>

          {/* Tags */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                marginBottom: '0.5rem',
              }}
            >
              <Tag size={12} />
              Tags
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {task.tags && task.tags.length > 0 ? (
                task.tags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '0.25rem 0.625rem',
                      background: '#f3f4f6',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No tags</span>
              )}
              <button
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  color: '#2563eb',
                  background: '#eff6ff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                Add
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                marginBottom: '0.5rem',
              }}
            >
              <FileText size={12} />
              Description
            </label>
            <textarea
              placeholder="Add a description..."
              defaultValue={task.description}
              onBlur={(e) => {
                if (e.target.value !== (task.description || '')) {
                  onUpdate({ description: e.target.value || undefined });
                }
              }}
              rows={4}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.375rem',
                fontSize: '0.8125rem',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Move Modal */}
        {showMoveModal && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 500,
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                width: '300px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Move to Task List</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {groups.filter(g => g.id !== 'ungrouped').map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleMove(group.id)}
                    style={{
                      padding: '0.625rem 0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8125rem',
                      textAlign: 'left',
                      background: task.task_group_id === group.id ? '#eff6ff' : 'transparent',
                      color: task.task_group_id === group.id ? '#2563eb' : '#374151',
                      border: '1px solid #e5e7eb',
                      cursor: 'pointer',
                    }}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  handleMove(null);
                  setShowMoveModal(false);
                }}
                style={{
                  marginTop: '0.75rem',
                  width: '100%',
                  padding: '0.625rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  background: '#f9fafb',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                }}
              >
                No Task List
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 500,
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                width: '320px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Delete Task?</h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.25rem' }}>
                This action cannot be undone. Are you sure you want to delete "{task.name}"?
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
