// TaskLinkSelector.tsx
// Shared searchable task picker for Site Reports.
// Supports single-select (primary task, stoppage link) and multi-select (covered tasks).
// Uses useTaskSearch for server-side search and useTaskLabelResolution for pre-selected pills.

import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Check, ChevronDown, AlertTriangle } from 'lucide-react';
import { useTaskSearch, useTaskLabelResolution, TaskSearchResult } from '../../hooks/useTaskSearch';

// ─── Status badge config ───────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  not_started:  { bg: '#f4f4f5', text: '#52525b', label: 'Not Started' },
  in_progress:  { bg: '#dbeafe', text: '#1d4ed8', label: 'In Progress' },
  under_review: { bg: '#fef3c7', text: '#b45309', label: 'Under Review' },
  on_hold:      { bg: '#e0e7ff', text: '#4338ca', label: 'On Hold' },
  completed:    { bg: '#dcfce7', text: '#15803d', label: 'Completed' },
  cancelled:    { bg: '#fee2e2', text: '#b91c1c', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] || { bg: '#f4f4f5', text: '#64748b', label: status };
  return (
    <span
      style={{
        padding: '1px 6px',
        borderRadius: '9999px',
        fontSize: '0.65rem',
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.text,
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

function DueDateChip({ dueDate, status }: { dueDate: string; status: string }) {
  const parts = dueDate.split('-');
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let bg = '#f8fafc';
  let text = '#475569';
  let border = '#e2e8f0';
  let label = due.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  
  if (status === 'completed' || status === 'cancelled') {
    bg = '#f1f5f9';
    text = '#64748b';
  } else if (diffDays < 0) {
    bg = '#fef2f2';
    text = '#ef4444';
    border = '#fee2e2';
    label = 'Overdue';
  } else if (diffDays <= 3) {
    bg = '#fffbeb';
    text = '#d97706';
    border = '#fef3c7';
    label = diffDays === 0 ? 'Today' : `Due in ${diffDays}d`;
  }
  
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 5px',
        borderRadius: '3px',
        fontSize: '0.625rem',
        fontWeight: 500,
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        flexShrink: 0,
        marginLeft: '0.25rem',
      }}
    >
      {label}
    </span>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface TaskLinkSelectorProps {
  organisationId: string;
  projectId?: string | null;
  /** Single mode: a string task ID (or null). Multi mode: array of task IDs. */
  value: string | string[] | null;
  onChange: (val: string | string[] | null) => void;
  mode: 'single' | 'multi';
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function TaskLinkSelector({
  organisationId,
  projectId,
  value,
  onChange,
  mode,
  placeholder = 'Search tasks...',
  disabled = false,
  label,
}: TaskLinkSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalise value to array for uniform handling
  const selectedIds: string[] = Array.isArray(value)
    ? value.filter(Boolean)
    : value
    ? [value]
    : [];

  // Server-side search results (excludes archived/deleted)
  const { data: searchResults = [], isFetching } = useTaskSearch(
    organisationId,
    projectId,
    search,
  );

  // Label resolution for pre-selected values (includes archived)
  const { data: selectedTasks = [] } = useTaskLabelResolution(organisationId, selectedIds);

  // Build a map from id → task for quick lookup
  const selectedMap = Object.fromEntries(selectedTasks.map((t) => [t.id, t]));

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const toggleTask = (task: TaskSearchResult) => {
    if (mode === 'single') {
      const newVal = selectedIds[0] === task.id ? null : task.id;
      onChange(newVal);
      setOpen(false);
      setSearch('');
    } else {
      const already = selectedIds.includes(task.id);
      const updated = already
        ? selectedIds.filter((id) => id !== task.id)
        : [...selectedIds, task.id];
      onChange(updated);
    }
  };

  const removeId = (id: string) => {
    if (mode === 'single') {
      onChange(null);
    } else {
      onChange(selectedIds.filter((sid) => sid !== id));
    }
  };

  // Determine which results to show (exclude already-selected in multi mode)
  const visibleResults = mode === 'multi'
    ? searchResults.filter((t) => !selectedIds.includes(t.id))
    : searchResults;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#6b7280',
            marginBottom: '0.375rem',
          }}
        >
          {label}
        </label>
      )}

      {/* Trigger / pill display area */}
      <div
        onClick={openDropdown}
        style={{
          minHeight: '2.25rem',
          border: `1px solid ${open ? '#2563eb' : '#d1d5db'}`,
          borderRadius: '0.5rem',
          padding: '0.375rem 0.5rem',
          background: disabled ? '#f9fafb' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.3rem',
          transition: 'border-color 0.15s',
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
        }}
      >
        {selectedIds.length === 0 && (
          <span style={{ fontSize: '0.8125rem', color: '#9ca3af', flex: 1 }}>
            {placeholder}
          </span>
        )}

        {selectedIds.map((id) => {
          const task = selectedMap[id];
          const isArchived = task ? (task.is_archived || !!task.deleted_at) : false;
          const label = task ? `#${task.task_no} — ${task.title}` : id.slice(0, 8) + '…';
          return (
            <span
              key={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.125rem 0.375rem 0.125rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 500,
                background: isArchived ? '#f1f5f9' : '#eff6ff',
                color: isArchived ? '#94a3b8' : '#1d4ed8',
                border: `1px solid ${isArchived ? '#e2e8f0' : '#bfdbfe'}`,
                maxWidth: '340px',
              }}
            >
              {isArchived && <AlertTriangle size={10} style={{ color: '#f59e0b', flexShrink: 0 }} />}
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '160px',
                }}
              >
                {label}
              </span>
              {task?.due_date && (
                <DueDateChip dueDate={task.due_date} status={task.status} />
              )}
              {isArchived && (
                <span
                  style={{
                    fontSize: '0.6rem',
                    background: '#e2e8f0',
                    color: '#64748b',
                    padding: '0 3px',
                    borderRadius: '3px',
                    flexShrink: 0,
                  }}
                >
                  Archived
                </span>
              )}
              {!disabled && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeId(id); }}
                  style={{
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          );
        })}

        {!disabled && (
          <ChevronDown
            size={14}
            style={{
              marginLeft: 'auto',
              color: '#9ca3af',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s',
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {/* Search input */}
          <div
            style={{
              padding: '0.5rem',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Search size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search tasks..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '0.8125rem',
                color: '#1f2937',
                background: 'transparent',
              }}
            />
            {isFetching && (
              <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>searching…</span>
            )}
          </div>

          {/* Results */}
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {search.length < 2 ? (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                }}
              >
                Type at least 2 characters to search
              </div>
            ) : visibleResults.length === 0 && !isFetching ? (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                }}
              >
                No tasks found
              </div>
            ) : (
              visibleResults.map((task) => {
                const isSelected = selectedIds.includes(task.id);
                return (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(task)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {/* Checkbox (multi) or check mark (single) */}
                    <div
                      style={{
                        width: '1rem',
                        height: '1rem',
                        borderRadius: mode === 'multi' ? '0.25rem' : '50%',
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

                    {/* Task info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: '#94a3b8',
                            flexShrink: 0,
                          }}
                        >
                          #{task.task_no}
                        </span>
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            color: '#1f2937',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {task.title}
                        </span>
                        {task.due_date && (
                          <DueDateChip dueDate={task.due_date} status={task.status} />
                        )}
                      </div>
                    </div>

                    {/* Status + progress */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                      <StatusBadge status={task.status} />
                      {task.completion_percentage > 0 && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            color: '#6b7280',
                            fontWeight: 500,
                          }}
                        >
                          {task.completion_percentage}%
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
