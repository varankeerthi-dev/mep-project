import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Calendar,
  Flag,
  User,
  ChevronDown,
  ChevronRight,
  FileText,
  MapPin,
  Clock,
  Hash,
  Wrench,
  AlertTriangle,
  Layers,
  ClipboardList,
  BookOpen,
  HardHat,
  Ruler,
  Search,
  Building2,
} from 'lucide-react';
import { supabase } from '../../supabase';
import { TaskGroup, TaskCreateInput, TaskStatus, TaskPriority, TaskType, TaskDiscipline, STATUS_CONFIG, PRIORITY_CONFIG, TASK_TYPE_CONFIG, DISCIPLINE_CONFIG } from './types';

interface TaskCreateDrawerProps {
  projectId: string;
  defaultGroupId: string | null;
  groups: TaskGroup[];
  organisationId: string;
  onClose: () => void;
  onSubmit: (input: TaskCreateInput) => void;
  isLoading: boolean;
}

// Multi-Select with Search Component
interface MultiSelectOption {
  id: string;
  label: string;
  subtitle?: string;
  color?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  maxVisible?: number;
}

function MultiSelect({ options, selectedIds, onChange, placeholder, searchPlaceholder = 'Search...', maxVisible = 3 }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()) || o.subtitle?.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.filter(o => selectedIds.includes(o.id));
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Selected pills */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: '2.25rem',
          padding: '0.375rem 0.5rem',
          border: `1px solid ${isOpen ? '#3b82f6' : '#e2e8f0'}`,
          borderRadius: '0.375rem',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          alignItems: 'center',
          transition: 'border-color 0.15s',
        }}
      >
        {selected.length === 0 && (
          <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>{placeholder}</span>
        )}
        {selected.slice(0, maxVisible).map(opt => (
          <span
            key={opt.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              fontSize: '0.6875rem',
              fontWeight: 500,
              background: opt.color ? `${opt.color}15` : '#eff6ff',
              color: opt.color || '#3b82f6',
              border: `1px solid ${opt.color ? `${opt.color}30` : '#bfdbfe'}`,
            }}
          >
            {opt.label}
            <span onClick={(e) => { e.stopPropagation(); toggle(opt.id); }} style={{ cursor: 'pointer', lineHeight: 1 }}>
              <X size={10} />
            </span>
          </span>
        ))}
        {selected.length > maxVisible && (
          <span style={{ fontSize: '0.6875rem', color: '#64748b', padding: '0.125rem 0.25rem' }}>
            +{selected.length - maxVisible} more
          </span>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '0.25rem',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 50,
        }}>
          {/* Search */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.375rem 0.5rem 0.375rem 1.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  outline: 'none',
                  background: '#f8fafc',
                }}
              />
            </div>
          </div>
          {/* Options */}
          <div style={{ maxHeight: '12rem', overflow: 'auto', padding: '0.25rem' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>No results</div>
            )}
            {filtered.map(opt => {
              const isSelected = selectedIds.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggle(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.625rem',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: '1rem',
                    height: '1rem',
                    borderRadius: '0.25rem',
                    border: `2px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
                    background: isSelected ? '#3b82f6' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}>
                    {isSelected && <ChevronDown size={10} style={{ color: '#fff' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.label}
                    </div>
                    {opt.subtitle && (
                      <div style={{ fontSize: '0.625rem', color: '#94a3b8' }}>{opt.subtitle}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'deliverable', label: 'Deliverable' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'rfi', label: 'RFI' },
  { value: 'ncr', label: 'NCR' },
];

const DISCIPLINE_OPTIONS: { value: TaskDiscipline; label: string }[] = [
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'fire_protection', label: 'Fire Protection' },
  { value: 'elv', label: 'ELV' },
  { value: 'civil', label: 'Civil' },
  { value: 'architectural', label: 'Architectural' },
  { value: 'general', label: 'General' },
];

// Collapsible Section Component
interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ icon, title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.625rem 0.75rem',
          background: isOpen ? '#f8fafc' : 'transparent',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = '#f1f5f9'; }}
        onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ color: isOpen ? '#3b82f6' : '#94a3b8', transition: 'color 0.15s' }}>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span style={{ color: '#64748b' }}>{icon}</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: isOpen ? '#334155' : '#64748b', transition: 'color 0.15s' }}>
          {title}
        </span>
      </button>
      <div style={{
        maxHeight: isOpen ? '1200px' : '0',
        overflow: 'hidden',
        opacity: isOpen ? 1 : 0,
        transition: 'max-height 0.3s ease, opacity 0.2s ease, padding 0.2s ease',
        padding: isOpen ? '0.75rem 0.75rem 0.25rem' : '0 0.75rem',
      }}>
        {children}
      </div>
    </div>
  );
}

// Input/Select field styles
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid #e2e8f0',
  borderRadius: '0.375rem',
  fontSize: '0.8125rem',
  outline: 'none',
  background: '#fff',
  transition: 'border-color 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: '#64748b',
  marginBottom: '0.375rem',
};

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
};

export default function TaskCreateDrawer({
  projectId,
  defaultGroupId,
  groups,
  organisationId,
  onClose,
  onSubmit,
  isLoading,
}: TaskCreateDrawerProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taskGroupId, setTaskGroupId] = useState<string | null>(defaultGroupId);
  const [status, setStatus] = useState<TaskStatus>('not_started');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [taskType, setTaskType] = useState<TaskType>('task');
  const [discipline, setDiscipline] = useState<TaskDiscipline | null>(null);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [duration, setDuration] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [location, setLocation] = useState('');
  const [drawingRef, setDrawingRef] = useState('');
  const [wbsCode, setWbsCode] = useState('');
  const [tags, setTags] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [subcontractorIds, setSubcontractorIds] = useState<string[]>([]);

  // Fetch org members for assignee dropdown
  const [orgMembers, setOrgMembers] = useState<MultiSelectOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('org_members')
        .select('user_id, role, user_profiles(full_name, email)')
        .eq('organisation_id', organisationId);
      if (data) {
        setOrgMembers(data.map((m: any) => ({
          id: m.user_id,
          label: m.user_profiles?.full_name || m.user_id.slice(0, 8),
          subtitle: m.user_profiles?.email || m.role,
          color: '#3b82f6',
        })));
      }
      setLoadingMembers(false);
    };
    fetchMembers();
  }, [organisationId]);

  // Fetch subcontractors
  const [subcontractors, setSubcontractors] = useState<MultiSelectOption[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);

  useEffect(() => {
    const fetchSubs = async () => {
      const { data } = await supabase
        .from('subcontractors')
        .select('id, company_name, contact_person')
        .eq('organisation_id', organisationId)
        .order('company_name');
      if (data) {
        setSubcontractors(data.map((s: any) => ({
          id: s.id,
          label: s.company_name,
          subtitle: s.contact_person || undefined,
          color: '#8b5cf6',
        })));
      }
      setLoadingSubs(false);
    };
    fetchSubs();
  }, [organisationId]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({
      project_id: projectId,
      task_group_id: taskGroupId,
      title: name.trim(),
      description: description.trim() || undefined,
      task_type: taskType,
      status,
      priority,
      start_date: startDate || null,
      due_date: dueDate || null,
      duration_days: duration ? parseInt(duration) : null,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      assignee_ids: assigneeIds.length > 0 ? assigneeIds : undefined,
      subcontractor_ids: subcontractorIds.length > 0 ? subcontractorIds : undefined,
      discipline: discipline || null,
      location: location.trim() || null,
      drawing_ref: drawingRef.trim() || null,
      wbs_code: wbsCode.trim() || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 200,
        }}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '520px',
          height: '100vh',
          background: '#fafbfc',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
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
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} style={{ color: '#3b82f6' }} />
            </div>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
              Create Task
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.375rem',
              borderRadius: '0.375rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem 1.25rem 1.25rem' }}>
          
          {/* Task Name - Always visible, no collapse */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Task Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Install AHU-01 on Level 3"
              autoFocus
              style={{ ...inputStyle, fontSize: '0.875rem', fontWeight: 500, padding: '0.625rem 0.875rem' }}
            />
          </div>

          {/* Section 1: Classification */}
          <CollapsibleSection icon={<Layers size={14} />} title="Classification" defaultOpen={true}>
            {/* Task Type & Discipline */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Task Type</label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as TaskType)}
                  style={inputStyle}
                >
                  {TASK_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Discipline</label>
                <select
                  value={discipline || ''}
                  onChange={(e) => setDiscipline(e.target.value as TaskDiscipline || null)}
                  style={{
                    ...inputStyle,
                    borderLeft: discipline ? `3px solid ${DISCIPLINE_CONFIG[discipline]?.color || '#6b7280'}` : undefined,
                  }}
                >
                  <option value="">Select discipline</option>
                  {DISCIPLINE_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status & Priority */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  style={{
                    ...inputStyle,
                    background: STATUS_CONFIG[status]?.bg || '#f8fafc',
                    color: STATUS_CONFIG[status]?.text || '#64748b',
                    border: `1px solid ${STATUS_CONFIG[status]?.border || '#e2e8f0'}`,
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  style={{
                    ...inputStyle,
                    background: PRIORITY_CONFIG[priority]?.bg || '#f8fafc',
                    color: PRIORITY_CONFIG[priority]?.text || '#64748b',
                  }}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Task Group */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Task Group</label>
              <select
                value={taskGroupId || ''}
                onChange={(e) => setTaskGroupId(e.target.value || null)}
                style={inputStyle}
              >
                <option value="">No Group</option>
                {groups.filter(g => g.id !== 'ungrouped').map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            {/* Assignees */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Assignees</label>
              {loadingMembers ? (
                <div style={{ ...inputStyle, color: '#94a3b8', fontSize: '0.8125rem' }}>Loading members...</div>
              ) : (
                <MultiSelect
                  options={orgMembers}
                  selectedIds={assigneeIds}
                  onChange={setAssigneeIds}
                  placeholder="Select team members"
                  searchPlaceholder="Search by name or email..."
                />
              )}
            </div>

            {/* Subcontractor */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Subcontractor</label>
              {loadingSubs ? (
                <div style={{ ...inputStyle, color: '#94a3b8', fontSize: '0.8125rem' }}>Loading subcontractors...</div>
              ) : (
                <MultiSelect
                  options={subcontractors}
                  selectedIds={subcontractorIds}
                  onChange={setSubcontractorIds}
                  placeholder="Select subcontractor"
                  searchPlaceholder="Search by company name..."
                />
              )}
            </div>

            {/* Tags */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Tags <span style={{ color: '#94a3b8' }}>(comma separated)</span></label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., HVAC, Level 3, Critical"
                style={inputStyle}
              />
            </div>
          </CollapsibleSection>

          {/* Section 2: Schedule */}
          <CollapsibleSection icon={<Clock size={14} />} title="Schedule" defaultOpen={true}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Duration (days)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g., 5"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Est. Hours</label>
                <input
                  type="number"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="e.g., 40"
                  min="0"
                  step="0.5"
                  style={inputStyle}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 3: Site Details */}
          <CollapsibleSection icon={<MapPin size={14} />} title="Site Details" defaultOpen={false}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Location / Zone</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Level 3, Zone B"
                  style={inputStyle}
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Drawing Reference</label>
                <input
                  type="text"
                  value={drawingRef}
                  onChange={(e) => setDrawingRef(e.target.value)}
                  placeholder="e.g., M-101 Rev.3"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>WBS Code</label>
                <input
                  type="text"
                  value={wbsCode}
                  onChange={(e) => setWbsCode(e.target.value)}
                  placeholder="e.g., 23.01.03"
                  style={inputStyle}
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Spec Reference</label>
                <input
                  type="text"
                  placeholder="e.g., Div 23, Sec 23.1"
                  style={inputStyle}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 4: Safety & Compliance */}
          <CollapsibleSection icon={<HardHat size={14} />} title="Safety & Compliance" defaultOpen={false}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={fieldGroupStyle}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <AlertTriangle size={12} style={{ color: '#f59e0b' }} />
                  Inspection Required
                </label>
                <select style={inputStyle}>
                  <option value="">No</option>
                  <option value="pre-install">Pre-Installation</option>
                  <option value="during">During Work</option>
                  <option value="final">Final Inspection</option>
                  <option value="witness">Witness Point</option>
                </select>
              </div>
              <div style={fieldGroupStyle}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <ClipboardList size={12} style={{ color: '#3b82f6' }} />
                  Approval Required
                </label>
                <select style={inputStyle}>
                  <option value="">No</option>
                  <option value="consultant">Consultant</option>
                  <option value="client">Client</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <HardHat size={12} style={{ color: '#ef4444' }} />
                Safety Requirements
              </label>
              <select style={inputStyle}>
                <option value="">None</option>
                <option value="ptw">Permit to Work</option>
                <option value="hot">Hot Work Permit</option>
                <option value="confined">Confined Space</option>
                <option value="height">Working at Height</option>
                <option value="electrical">Electrical Isolation</option>
              </select>
            </div>
          </CollapsibleSection>

          {/* Section 5: Description */}
          <CollapsibleSection icon={<FileText size={14} />} title="Description" defaultOpen={false}>
            <div style={fieldGroupStyle}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add scope of work, notes, or special instructions..."
                rows={4}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                }}
              />
            </div>
          </CollapsibleSection>

        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            background: '#fff',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.625rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: name.trim() && !isLoading ? '#2563eb' : '#93c5fd',
              color: 'white',
              border: 'none',
              cursor: name.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'background 0.15s',
            }}
          >
            <Plus size={14} />
            {isLoading ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
