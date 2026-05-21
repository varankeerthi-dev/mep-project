import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase';
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
  organisationId: string;
}

const STATUS_OPTIONS: TaskStatus[] = [
  'not_started',
  'in_progress',
  'under_review',
  'on_hold',
  'completed',
];

const STATUS_LABELS: Record<string, string> = {
  'not_started': 'Not Started',
  'in_progress': 'In Progress',
  'under_review': 'Under Review',
  'on_hold': 'On Hold',
  'completed': 'Completed',
  'Not Started': 'Not Started',
  'In Progress': 'In Progress',
  'Possible Delay': 'Under Review',
  'On Hold': 'On Hold',
  'Completed': 'Completed',
};

const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

const PRIORITY_LABELS: Record<string, string> = {
  'low': 'Low',
  'medium': 'Medium',
  'high': 'High',
  'critical': 'Critical',
  'Low': 'Low',
  'Medium': 'Medium',
  'High': 'High',
  'Critical': 'Critical',
  'None': 'None',
};

export default function TaskEditDrawer({
  task,
  onClose,
  onUpdate,
  onDelete,
  groups,
  organisationId,
}: TaskEditDrawerProps) {
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [isFollowing, setIsFollowing] = useState(task.is_following);
  const [pendingUpdates, setPendingUpdates] = useState<TaskUpdateInput>({});
  const [assigneeNames, setAssigneeNames] = useState<Record<string, { name: string; email?: string }>>({});
  const [orgMembers, setOrgMembers] = useState<{ id: string; name: string; email?: string }[]>([]);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  const effectiveAssigneeIds = (pendingUpdates.assignee_ids as string[] | undefined) ?? task.assignee_ids ?? [];

  // Close assignee dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch org members for assignee selection
  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('org_members')
        .select('user_id, role, user_profiles(full_name, email)')
        .eq('organisation_id', organisationId);
      if (data) {
        const members = (data as any[]).map((m: any) => ({
          id: m.user_id,
          name: m.user_profiles?.full_name || m.user_id.slice(0, 8),
          email: m.user_profiles?.email || undefined,
        }));
        setOrgMembers(members);
        const map: Record<string, { name: string; email?: string }> = {};
        members.forEach(m => { map[m.id] = { name: m.name, email: m.email }; });
        setAssigneeNames(prev => ({ ...prev, ...map }));
      }
    };
    fetchMembers();
  }, [organisationId]);

  const localTitle = useRef(task.title);
  const localDescription = useRef(task.description || '');
  const localStartDate = useRef(task.start_date || '');
  const localDueDate = useRef(task.due_date || '');
  const localCompletion = useRef(task.completion_percentage);

const effectiveStatus = (pendingUpdates.status as string) || task.status;
  const effectiveStatusLabel = STATUS_LABELS[effectiveStatus] || effectiveStatus;
  const statusCol = STATUS_COLORS[effectiveStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] || { bg: '#f1f5f9', text: '#64748b' };
  const effectivePriority = (pendingUpdates.priority as string) || task.priority;
  const effectivePriorityLabel = PRIORITY_LABELS[effectivePriority] || effectivePriority;
  const priCol = PRIORITY_COLORS[effectivePriority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || { bg: '#f1f5f9', text: '#64748b' };
  const hasChanges = Object.keys(pendingUpdates).length > 0
    || localTitle.current !== task.title
    || localDescription.current !== (task.description || '')
    || localStartDate.current !== (task.start_date || '')
    || localDueDate.current !== (task.due_date || '')
    || localCompletion.current !== task.completion_percentage;

  const stageUpdate = (updates: TaskUpdateInput) => {
    setPendingUpdates(prev => ({ ...prev, ...updates }));
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
            data-field="title"
            defaultValue={task.title}
            onChange={(e) => { localTitle.current = e.target.value; }}
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
                  background: statusCol.bg,
                  color: statusCol.text,
                  border: '1px solid #e5e7eb',
                  width: '100%',
                  justifyContent: 'space-between',
                }}
              >
                {effectiveStatusLabel}
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
                  {STATUS_OPTIONS.map((status) => {
                      const currentStatus = (pendingUpdates.status as string) || task.status;
                      const isSelected = currentStatus === status || currentStatus === STATUS_LABELS[status];
                      const statusCfg = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
                      return (
                        <button
                          key={status}
                          onClick={() => {
                            stageUpdate({ status });
                            setShowStatusDropdown(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.8125rem',
                            background: isSelected ? (statusCfg?.bg || '#f1f5f9') : 'transparent',
                            color: isSelected ? (statusCfg?.text || '#374151') : '#374151',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          {isSelected && <Check size={12} />}
                          {STATUS_LABELS[status] || status}
                        </button>
                      );
                    })}
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
                  background: priCol.bg,
                  color: priCol.text,
                  border: '1px solid #e5e7eb',
                  width: '100%',
                  justifyContent: 'space-between',
                }}
              >
                {effectivePriorityLabel}
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
                  {PRIORITY_OPTIONS.map((priority) => {
                    const currentPriority = (pendingUpdates.priority as string) || task.priority;
                    const isSelected = currentPriority === priority;
                    const priCfg = PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS];
                    return (
                      <button
                        key={priority}
                        onClick={() => {
                          stageUpdate({ priority });
                          setShowPriorityDropdown(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.8125rem',
                          background: isSelected ? (priCfg?.bg || '#f1f5f9') : 'transparent',
                          color: isSelected ? (priCfg?.text || '#374151') : '#374151',
                          border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {isSelected && <Check size={12} />}
                      {PRIORITY_LABELS[priority] || priority}
                    </button>
                    );
                  })}
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
            <div style={{ position: 'relative' }} ref={assigneeDropdownRef as any}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {effectiveAssigneeIds.length > 0 ? (
                  effectiveAssigneeIds.map((id, i) => {
                    const name = assigneeNames[id]?.name || id.slice(0, 8);
                    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <div
                        key={id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.25rem 0.5rem 0.25rem 0.25rem',
                          background: '#f0f4ff',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: '#334155',
                          border: '1px solid #dbeafe',
                        }}
                      >
                        <div
                          style={{
                            width: '1.25rem',
                            height: '1.25rem',
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, hsl(${(i * 60 + 200) % 360}, 70%, 60%), hsl(${(i * 60 + 230) % 360}, 70%, 50%))`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.5rem',
                            fontWeight: 600,
                            color: 'white',
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        {name}
                        <button
                          onClick={() => {
                            const updated = effectiveAssigneeIds.filter(aid => aid !== id);
                            stageUpdate({ assignee_ids: updated.length > 0 ? updated : undefined });
                          }}
                          style={{
                            padding: 0,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No assignees</span>
                )}
                <button
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    color: '#2563eb',
                    background: '#eff6ff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>
              {showAssigneeDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 50,
                    maxHeight: '200px',
                    overflow: 'auto',
                  }}
                >
                  {orgMembers.length === 0 ? (
                    <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>Loading members...</div>
                  ) : (
                    orgMembers.map(member => {
                      const isSelected = effectiveAssigneeIds.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          onClick={() => {
                            const updated = isSelected
                              ? effectiveAssigneeIds.filter(aid => aid !== member.id)
                              : [...effectiveAssigneeIds, member.id];
                            stageUpdate({ assignee_ids: updated.length > 0 ? updated : undefined });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.8125rem',
                            background: isSelected ? '#eff6ff' : 'transparent',
                            color: isSelected ? '#2563eb' : '#374151',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div
                            style={{
                              width: '1.125rem',
                              height: '1.125rem',
                              borderRadius: '0.25rem',
                              border: isSelected ? 'none' : '2px solid #d1d5db',
                              background: isSelected ? '#2563eb' : '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isSelected && <Check size={10} style={{ color: 'white' }} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{member.name}</div>
                            {member.email && <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{member.email}</div>}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
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
                data-field="start_date"
                defaultValue={task.start_date || ''}
                onChange={(e) => { localStartDate.current = e.target.value; }}
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
                data-field="due_date"
                defaultValue={task.due_date || ''}
                onChange={(e) => { localDueDate.current = e.target.value; }}
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
                data-field="completion_percentage"
                defaultValue={task.completion_percentage}
                onChange={(e) => { localCompletion.current = parseInt(e.target.value); const numInput = e.target.parentElement?.querySelector('input[type="number"]'); if (numInput) numInput.value = e.target.value; }}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min="0"
                max="100"
                data-field="completion_pct_num"
                defaultValue={task.completion_percentage}
                onChange={(e) => { localCompletion.current = Math.min(100, Math.max(0, parseInt(e.target.value) || 0)); const rangeInput = e.target.parentElement?.querySelector('input[type="range"]'); if (rangeInput) rangeInput.value = e.target.value; }}
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
              data-field="description"
              placeholder="Add a description..."
              defaultValue={task.description || ''}
              onChange={(e) => { localDescription.current = e.target.value; }}
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

        {/* Sticky Update Footer */}
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderTop: '1px solid #e5e7eb',
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.625rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              fontFamily: "'Inter', system-ui, sans-serif",
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const updates: TaskUpdateInput = {};
              let hasChanges = Object.keys(pendingUpdates).length > 0;

              Object.assign(updates, pendingUpdates);

              if (localTitle.current !== task.title && localTitle.current.trim()) {
                updates.title = localTitle.current.trim();
                hasChanges = true;
              }
              if (localDescription.current !== (task.description || '')) {
                updates.description = localDescription.current || null;
                hasChanges = true;
              }
              if (localStartDate.current !== (task.start_date || '')) {
                updates.start_date = localStartDate.current || null;
                hasChanges = true;
              }
              if (localDueDate.current !== (task.due_date || '')) {
                updates.due_date = localDueDate.current || null;
                hasChanges = true;
              }
              if (localCompletion.current !== task.completion_percentage) {
                updates.completion_percentage = localCompletion.current;
                hasChanges = true;
              }

              if (hasChanges) {
                onUpdate(updates);
              }
              onClose();
            }}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              fontFamily: "'Inter', system-ui, sans-serif",
              background: hasChanges ? '#2563eb' : '#93c5fd',
              color: 'white',
              border: 'none',
              cursor: hasChanges ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              boxShadow: hasChanges ? '0 1px 2px rgba(37,99,235,0.3)' : 'none',
              transition: 'background 0.15s, transform 0.1s',
            }}
            onMouseEnter={(e) => { if (hasChanges) { e.currentTarget.style.background = '#1d4ed8'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={(e) => { if (hasChanges) { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.transform = 'translateY(0)'; } }}
          >
            Update Task
          </button>
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
                This action cannot be undone. Are you sure you want to delete "{task.title}"?
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
