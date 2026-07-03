import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  ExternalLink,
  ClipboardList,
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
import { toast } from '../../lib/logger';
import { useTaskPermissions } from './useTaskPermissions';
import TaskLinkSelector from './TaskLinkSelector';

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
  const [showReportHistory, setShowReportHistory] = useState(false);
  const [reportHistoryPage, setReportHistoryPage] = useState(10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + `/site-reports?task_id=${task.id}`);
    toast.success('Task link copied to clipboard');
  };

  const handleColorChange = (color: string) => {
    onUpdate({ color: color || null });
    setShowColorPicker(false);
  };

  const handleFollowToggle = () => {
    const nextVal = !isFollowing;
    setIsFollowing(nextVal);
    onUpdate({ is_following: nextVal });
    toast.success(nextVal ? 'Following task' : 'Unfollowed task');
  };

  const handleClone = () => {
    toast.info('Cloning task is not implemented');
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
    setShowActionMenu(false);
  };

  const confirmDelete = () => {
    onDelete();
    onClose();
  };

  const handleMove = (groupId: string | null) => {
    onUpdate({ task_group_id: groupId });
    setShowMoveModal(false);
  };

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
  const localMilestoneId = useRef(task.milestone_id || '');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(task.milestone_id || '');
  const [milestones, setMilestones] = useState<any[]>([]);
  const dueDateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchMilestones = async () => {
      if (!task.project_id) return;
      const { data } = await supabase
        .from('project_milestones')
        .select('id, name, milestone_date')
        .eq('project_id', task.project_id)
        .eq('organisation_id', organisationId)
        .order('milestone_date', { ascending: true });
      if (data) {
        setMilestones(data);
      }
    };
    fetchMilestones();
  }, [task.project_id, organisationId]);

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
    || localCompletion.current !== task.completion_percentage
    || localMilestoneId.current !== (task.milestone_id || '');

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

          {/* Linked Milestone */}
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
              <ClipboardList size={12} />
              Linked Milestone
            </label>
            <select
              value={selectedMilestoneId}
              onChange={(e) => {
                const milestoneId = e.target.value;
                setSelectedMilestoneId(milestoneId);
                localMilestoneId.current = milestoneId;
                
                // Autofill due date to 2 days prior to the milestone's date
                if (milestoneId) {
                  const selectedMilestone = milestones.find(m => m.id === milestoneId);
                  if (selectedMilestone?.milestone_date) {
                    const dateParts = selectedMilestone.milestone_date.split('-');
                    const date = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
                    date.setDate(date.getDate() - 2);
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                    const dd = String(date.getDate()).padStart(2, '0');
                    const computedDueDate = `${yyyy}-${mm}-${dd}`;
                    
                    if (dueDateInputRef.current) {
                      dueDateInputRef.current.value = computedDueDate;
                    }
                    localDueDate.current = computedDueDate;
                  }
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.375rem',
                fontSize: '0.8125rem',
                outline: 'none',
                background: '#fff',
              }}
            >
              <option value="">No Milestone Linked</option>
              {milestones.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.milestone_date})
                </option>
              ))}
            </select>
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
                ref={dueDateInputRef}
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
              Duration (Days)
            </label>
            <input
              type="number"
              placeholder="e.g., 5"
              defaultValue={task.duration_days || ''}
              onBlur={(e) => {
                const val = parseInt(e.target.value);
                if (val !== task.duration_days) {
                  onUpdate({ duration_days: isNaN(val) ? null : val });
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
                onChange={(e) => { localCompletion.current = parseInt(e.target.value); const numInput = e.target.parentElement?.querySelector('input[type="number"]') as HTMLInputElement; if (numInput) numInput.value = e.target.value; }}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min="0"
                max="100"
                data-field="completion_pct_num"
                defaultValue={task.completion_percentage}
                onChange={(e) => { localCompletion.current = Math.min(100, Math.max(0, parseInt(e.target.value) || 0)); const rangeInput = e.target.parentElement?.querySelector('input[type="range"]') as HTMLInputElement; if (rangeInput) rangeInput.value = e.target.value; }}
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

          {/* ─── Site Report History ─── */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <button
                onClick={() => setShowReportHistory(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <ClipboardList size={12} />
                Site Report History
                <ChevronDown
                  size={12}
                  style={{ transform: showReportHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                />
              </button>

              {/* Create Daily Report button */}
              <button
                onClick={() =>
                  navigate(`/site-reports?task_id=${task.id}&action=create`)
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.625rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#2563eb',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#dbeafe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#eff6ff';
                }}
                title="Create a daily site report pre-filled with this task"
              >
                <Plus size={12} />
                Create Daily Report
              </button>
            </div>

            {/* Collapsible history list */}
            {showReportHistory && (
              <ReportHistoryPanel
                taskId={task.id}
                organisationId={organisationId}
                page={reportHistoryPage}
                onLoadMore={() => setReportHistoryPage(prev => prev + 10)}
                navigate={navigate}
              />
            )}
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
              if (localMilestoneId.current !== (task.milestone_id || '')) {
                updates.milestone_id = localMilestoneId.current || null;
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

interface ReportHistoryPanelProps {
  taskId: string;
  organisationId: string;
  page: number;
  onLoadMore: () => void;
  navigate: ReturnType<typeof useNavigate>;
}

function ReportHistoryPanel({
  taskId,
  organisationId,
  page,
  onLoadMore,
  navigate,
}: ReportHistoryPanelProps) {
  const { role } = useTaskPermissions();
  const isPmOrAdmin = role === 'admin' || role === 'project_manager';

  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [correctedPrimaryTaskId, setCorrectedPrimaryTaskId] = useState<string | null>(null);
  const [correctedCoveredTaskIds, setCorrectedCoveredTaskIds] = useState<string[]>([]);
  const [correctedStoppageTasks, setCorrectedStoppageTasks] = useState<Record<string, string | null>>({});
  const [editingStoppages, setEditingStoppages] = useState<any[]>([]);

  const queryClient = useQueryClient();

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ['task-site-reports', taskId, organisationId, page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_task_links')
        .select(`
          report_id,
          status_during_report,
          completion_snapshot,
          is_completed_in_report,
          site_reports!inner (
            id,
            report_date,
            pm_status,
            engineer_name,
            project_id,
            primary_task_id
          )
        `)
        .eq('task_id', taskId)
        .eq('organisation_id', organisationId)
        .order('site_reports(report_date)', { ascending: false })
        .limit(page);

      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const handleStartEditing = async (reportLink: any) => {
    const report = reportLink.site_reports;
    setEditingReportId(report.id);
    setCorrectedPrimaryTaskId(report.primary_task_id || null);
    
    // Fetch all current task links for this report
    const { data: linksData } = await supabase
      .from('report_task_links')
      .select('task_id')
      .eq('report_id', report.id);
    
    const linkedTaskIds = (linksData || []).map(l => l.task_id);
    setCorrectedCoveredTaskIds(linkedTaskIds.filter(id => id !== report.primary_task_id));

    // Fetch all work stoppages for this report
    const { data: stoppagesData } = await supabase
      .from('site_report_work_stoppages')
      .select('id, task_id, category, affected_work')
      .eq('report_id', report.id);
    
    const stoppageMap: Record<string, string | null> = {};
    (stoppagesData || []).forEach(s => {
      stoppageMap[s.id] = s.task_id || null;
    });
    setCorrectedStoppageTasks(stoppageMap);
    setEditingStoppages(stoppagesData || []);
  };

  const handleSaveCorrections = async (reportId: string) => {
    try {
      const allSelectedTaskIds = Array.from(new Set([
        ...(correctedPrimaryTaskId ? [correctedPrimaryTaskId] : []),
        ...correctedCoveredTaskIds,
      ])).filter(Boolean);

      let taskSnapshots: any[] = [];
      if (allSelectedTaskIds.length > 0) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('id, status, completion_percentage')
          .in('id', allSelectedTaskIds);

        if (tasksError) throw tasksError;

        taskSnapshots = (tasksData || []).map(t => ({
          task_id: t.id,
          status_during_report: t.status,
          completion_snapshot: t.completion_percentage,
          is_completed_in_report: t.status === 'completed'
        }));
      }

      const stoppageUpdates = Object.entries(correctedStoppageTasks).map(([stoppageId, taskId]) => ({
        stoppage_id: stoppageId,
        task_id: taskId
      }));

      // Update primary task directly in site_reports
      const { error: reportUpdateError } = await supabase
        .from('site_reports')
        .update({ primary_task_id: correctedPrimaryTaskId })
        .eq('id', reportId);
      
      if (reportUpdateError) throw reportUpdateError;

      // Update covered tasks many-to-many and stoppage tasks
      const { error: rpcError } = await supabase.rpc('update_report_task_links', {
        p_report_id: reportId,
        p_links: taskSnapshots,
        p_stoppage_updates: stoppageUpdates
      });

      if (rpcError) throw rpcError;

      toast.success('Report links corrected successfully');
      setEditingReportId(null);
      queryClient.invalidateQueries({ queryKey: ['task-site-reports', taskId] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save corrections: ${err.message || err}`);
    }
  };

  const PM_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    'Approved':         { bg: '#dcfce7', text: '#15803d' },
    'Pending Approval': { bg: '#fef3c7', text: '#b45309' },
    'Reported':         { bg: '#dbeafe', text: '#1d4ed8' },
    'Draft':            { bg: '#f4f4f5', text: '#52525b' },
  };

  if (isLoading) {
    return (
      <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
        Loading report history…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '0.75rem', fontSize: '0.75rem', color: '#ef4444' }}>
        Failed to load report history.
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div
        style={{
          padding: '1rem',
          textAlign: 'center',
          background: '#f8fafc',
          borderRadius: '0.5rem',
          border: '1px dashed #e2e8f0',
        }}
      >
        <ClipboardList size={20} style={{ color: '#cbd5e1', margin: '0 auto 0.5rem', display: 'block' }} />
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
          No site reports linked to this task yet.
        </p>
        <p style={{ fontSize: '0.6875rem', color: '#cbd5e1', margin: '0.25rem 0 0' }}>
          Create a daily report to start tracking field progress.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {reports.map((link: any) => {
        const report = link.site_reports;
        const statusCfg = PM_STATUS_COLORS[report.pm_status] || { bg: '#f4f4f5', text: '#52525b' };

        if (editingReportId === report.id) {
          return (
            <div
              key={link.report_id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                padding: '0.875rem',
                background: '#ffffff',
                borderRadius: '0.5rem',
                border: '2px solid #2563eb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1f2937' }}>
                  Correcting Links: {report.report_date}
                </span>
                <span
                  style={{
                    padding: '0.125rem 0.375rem',
                    borderRadius: '9999px',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    background: statusCfg.bg,
                    color: statusCfg.text,
                  }}
                >
                  {report.pm_status}
                </span>
              </div>

              {/* Primary Task */}
              <div>
                <TaskLinkSelector
                  organisationId={organisationId}
                  projectId={report.project_id}
                  value={correctedPrimaryTaskId}
                  onChange={(val) => setCorrectedPrimaryTaskId(val as string | null)}
                  mode="single"
                  label="Primary Task"
                  placeholder="Select primary task..."
                />
              </div>

              {/* Covered Tasks */}
              <div>
                <TaskLinkSelector
                  organisationId={organisationId}
                  projectId={report.project_id}
                  value={correctedCoveredTaskIds}
                  onChange={(val) => setCorrectedCoveredTaskIds(val as string[])}
                  mode="multi"
                  label="Covered Tasks"
                  placeholder="Select covered tasks..."
                />
              </div>

              {/* Stoppages */}
              {editingStoppages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>
                    Stoppage Task Links
                  </span>
                  {editingStoppages.map((stoppage) => (
                    <div key={stoppage.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#4b5563', fontStyle: 'italic' }}>
                        {stoppage.affected_work || stoppage.category}
                      </span>
                      <TaskLinkSelector
                        organisationId={organisationId}
                        projectId={report.project_id}
                        value={correctedStoppageTasks[stoppage.id] || null}
                        onChange={(val) => setCorrectedStoppageTasks(prev => ({ ...prev, [stoppage.id]: val as string | null }))}
                        mode="single"
                        placeholder="Link affected task..."
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  onClick={() => setEditingReportId(null)}
                  style={{
                    flex: 1,
                    padding: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: '#4b5563',
                    background: '#f3f4f6',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveCorrections(report.id)}
                  style={{
                    flex: 1,
                    padding: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                  }}
                >
                  Save Corrections
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={link.report_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.5rem 0.75rem',
              background: '#f8fafc',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              transition: 'border-color 0.15s, background 0.15s',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/site-reports?view=view&report_id=${link.report_id}`)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = '#f0f4ff';
              (e.currentTarget as HTMLDivElement).style.borderColor = '#c7d2fe';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = '#f8fafc';
              (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0';
            }}
          >
            {/* Date */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '2.5rem',
                padding: '0.25rem 0.375rem',
                background: 'white',
                borderRadius: '0.375rem',
                border: '1px solid #e5e7eb',
              }}
            >
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {report.report_date ? new Date(report.report_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }) : '—'}
              </span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2937', lineHeight: 1 }}>
                {report.report_date ? new Date(report.report_date + 'T12:00:00').getDate() : '—'}
              </span>
            </div>

            {/* Report info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1f2937' }}>
                  {report.report_date || 'Unknown date'}
                </span>
                <span
                  style={{
                    padding: '0.0625rem 0.375rem',
                    borderRadius: '9999px',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    background: statusCfg.bg,
                    color: statusCfg.text,
                  }}
                >
                  {report.pm_status || 'Draft'}
                </span>
                {link.is_completed_in_report && (
                  <span
                    style={{
                      padding: '0.0625rem 0.375rem',
                      borderRadius: '9999px',
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      background: '#dcfce7',
                      color: '#15803d',
                    }}
                  >
                    ✓ Completed
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.125rem' }}>
                {report.engineer_name && (
                  <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                    by {report.engineer_name}
                  </span>
                )}
                {link.completion_snapshot != null && (
                  <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                    • {link.completion_snapshot}% at report
                  </span>
                )}
              </div>
            </div>

            {/* PM/Admin Correction button */}
            {isPmOrAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEditing(link);
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: '#2563eb',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  marginRight: '0.25rem',
                }}
              >
                Correct Links
              </button>
            )}

            {/* Arrow */}
            <ExternalLink size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
          </div>
        );
      })}

      {reports.length >= page && (
        <button
          onClick={(e) => { e.stopPropagation(); onLoadMore(); }}
          style={{
            padding: '0.5rem',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: '#2563eb',
            background: 'transparent',
            border: '1px solid #bfdbfe',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          Load more reports
        </button>
      )}
    </div>
  );
}
