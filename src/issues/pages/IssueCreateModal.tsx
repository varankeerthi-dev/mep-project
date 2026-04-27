import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateIssue } from '../hooks';
import { ISSUE_TYPES, ISSUE_SYSTEMS, ISSUE_SEVERITIES, ISSUE_PRIORITIES } from '../types';
import {
  X,
  Loader2,
  AlertTriangle,
  Building2,
  Users,
  Package,
} from 'lucide-react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  :root {
    --icm-bg-overlay: rgba(0,0,0,0.5);
    --icm-bg-card: #ffffff;
    --icm-bg-page: #f8f9fa;
    --icm-bg-hover: #f1f3f4;
    --icm-border: #e5e7eb;
    --icm-text-primary: #111827;
    --icm-text-secondary: #6b7280;
    --icm-text-muted: #9ca3af;
    --icm-accent: #dc2626;
  }
  
  .icm-overlay {
    position: fixed;
    inset: 0;
    background: var(--icm-bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .icm-modal {
    background: var(--icm-bg-card);
    border-radius: 0.5rem;
    width: 100%;
    max-width: 640px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .icm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--icm-border);
  }
  
  .icm-header h2 {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--icm-text-primary);
    margin: 0;
  }
  
  .icm-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    color: var(--icm-text-secondary);
    cursor: pointer;
  }
  
  .icm-close:hover {
    background: var(--icm-bg-hover);
  }
  
  .icm-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }
  
  .icm-form-grid {
    display: grid;
    gap: 1rem;
  }
  
  .icm-form-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  
  @media (max-width: 640px) {
    .icm-form-row { grid-template-columns: 1fr; }
  }
  
  .icm-form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .icm-form-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--icm-text-secondary);
  }
  
  .icm-form-label .required {
    color: #dc2626;
  }
  
  .icm-input, .icm-select, .icm-textarea {
    padding: 0.625rem 0.75rem;
    background: var(--icm-bg-page);
    border: 1px solid var(--icm-border);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--icm-text-primary);
    width: 100%;
  }
  
  .icm-input:focus, .icm-select:focus, .icm-textarea:focus {
    outline: none;
    border-color: var(--icm-accent);
    background: white;
  }
  
  .icm-textarea {
    min-height: 100px;
    resize: vertical;
  }
  
  .icm-location-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }
  
  @media (max-width: 480px) {
    .icm-location-grid { grid-template-columns: repeat(2, 1fr); }
  }
  
  .icm-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--icm-border);
    background: var(--icm-bg-page);
  }
  
  .icm-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
  }
  
  .icm-btn-primary {
    background: var(--icm-accent);
    color: white;
  }
  
  .icm-btn-primary:hover {
    background: #b91c1c;
  }
  
  .icm-btn-secondary {
    background: var(--icm-bg-card);
    color: var(--icm-text-primary);
    border: 1px solid var(--icm-border);
  }
  
  .icm-btn-secondary:hover {
    background: var(--icm-bg-hover);
  }
  
  .icm-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

interface IssueCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

export function IssueCreateModal({ isOpen, onClose, projectId }: IssueCreateModalProps) {
  const navigate = useNavigate();
  const { organisation, user } = useAuth();
  const createIssue = useCreateIssue();
  
  const [formData, setFormData] = useState({
    project_id: projectId || '',
    title: '',
    description: '',
    issue_type: 'installation' as const,
    system: '' as const,
    subsystem: '',
    severity: 'minor' as const,
    priority: 'normal' as const,
    location_block: '',
    location_floor: '',
    location_room: '',
    location_zone: '',
    equipment_tag: '',
    drawing_ref: '',
    boq_ref: '',
    assigned_to: '',
    due_date: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.project_id) newErrors.project_id = 'Project is required';
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.issue_type) newErrors.issue_type = 'Issue type is required';
    if (!formData.severity) newErrors.severity = 'Severity is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    try {
      const issue = await createIssue.mutateAsync({
        organisation_id: organisation?.id!,
        project_id: formData.project_id,
        title: formData.title,
        description: formData.description || undefined,
        issue_type: formData.issue_type,
        system: formData.system as any || undefined,
        subsystem: formData.subsystem || undefined,
        severity: formData.severity,
        priority: formData.priority as any || undefined,
        location_block: formData.location_block || undefined,
        location_floor: formData.location_floor || undefined,
        location_room: formData.location_room || undefined,
        location_zone: formData.location_zone || undefined,
        equipment_tag: formData.equipment_tag || undefined,
        drawing_ref: formData.drawing_ref || undefined,
        boq_ref: formData.boq_ref || undefined,
        due_date: formData.due_date || undefined,
      });
      
      onClose();
      navigate(`/issue/${issue.id}`);
    } catch (err) {
      console.error('Error creating issue:', err);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="icm-overlay" onClick={onClose}>
      <style>{styles}</style>
      
      <div className="icm-modal" onClick={e => e.stopPropagation()}>
        <div className="icm-header">
          <h2>Create New Issue</h2>
          <button className="icm-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="icm-body">
            <div className="icm-form-grid">
              {/* Title */}
              <div className="icm-form-group">
                <label className="icm-form-label">
                  Title <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="icm-input"
                  value={formData.title}
                  onChange={e => handleChange('title', e.target.value)}
                  placeholder="Brief description of the issue"
                />
                {errors.title && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.title}</span>
                )}
              </div>
              
              {/* Project & Type */}
              <div className="icm-form-row">
                <div className="icm-form-group">
                  <label className="icm-form-label">
                    Project <span className="required">*</span>
                  </label>
                  <select
                    className="icm-select"
                    value={formData.project_id}
                    onChange={e => handleChange('project_id', e.target.value)}
                  >
                    <option value="">Select Project</option>
                  </select>
                  {errors.project_id && (
                    <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.project_id}</span>
                  )}
                </div>
                
                <div className="icm-form-group">
                  <label className="icm-form-label">
                    Issue Type <span className="required">*</span>
                  </label>
                  <select
                    className="icm-select"
                    value={formData.issue_type}
                    onChange={e => handleChange('issue_type', e.target.value)}
                  >
                    {ISSUE_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* System & Severity */}
              <div className="icm-form-row">
                <div className="icm-form-group">
                  <label className="icm-form-label">System</label>
                  <select
                    className="icm-select"
                    value={formData.system}
                    onChange={e => handleChange('system', e.target.value)}
                  >
                    <option value="">Select System</option>
                    {ISSUE_SYSTEMS.map(s => (
                      <option key={s} value={s}>{s.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                
                <div className="icm-form-group">
                  <label className="icm-form-label">
                    Severity <span className="required">*</span>
                  </label>
                  <select
                    className="icm-select"
                    value={formData.severity}
                    onChange={e => handleChange('severity', e.target.value)}
                  >
                    {ISSUE_SEVERITIES.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Priority & Due Date */}
              <div className="icm-form-row">
                <div className="icm-form-group">
                  <label className="icm-form-label">Priority</label>
                  <select
                    className="icm-select"
                    value={formData.priority}
                    onChange={e => handleChange('priority', e.target.value)}
                  >
                    {ISSUE_PRIORITIES.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
                
                <div className="icm-form-group">
                  <label className="icm-form-label">Due Date</label>
                  <input
                    type="date"
                    className="icm-input"
                    value={formData.due_date}
                    onChange={e => handleChange('due_date', e.target.value)}
                  />
                </div>
              </div>
              
              {/* Location */}
              <div className="icm-form-group">
                <label className="icm-form-label">Location</label>
                <div className="icm-location-grid">
                  <input
                    type="text"
                    className="icm-input"
                    placeholder="Block"
                    value={formData.location_block}
                    onChange={e => handleChange('location_block', e.target.value)}
                  />
                  <input
                    type="text"
                    className="icm-input"
                    placeholder="Floor"
                    value={formData.location_floor}
                    onChange={e => handleChange('location_floor', e.target.value)}
                  />
                  <input
                    type="text"
                    className="icm-input"
                    placeholder="Room"
                    value={formData.location_room}
                    onChange={e => handleChange('location_room', e.target.value)}
                  />
                  <input
                    type="text"
                    className="icm-input"
                    placeholder="Zone"
                    value={formData.location_zone}
                    onChange={e => handleChange('location_zone', e.target.value)}
                  />
                </div>
              </div>
              
              {/* Description */}
              <div className="icm-form-group">
                <label className="icm-form-label">Description</label>
                <textarea
                  className="icm-textarea"
                  value={formData.description}
                  onChange={e => handleChange('description', e.target.value)}
                  placeholder="Detailed description of the issue..."
                />
              </div>
              
              {/* References */}
              <div className="icm-form-row">
                <div className="icm-form-group">
                  <label className="icm-form-label">Equipment Tag</label>
                  <input
                    type="text"
                    className="icm-input"
                    value={formData.equipment_tag}
                    onChange={e => handleChange('equipment_tag', e.target.value)}
                    placeholder="e.g., AHU-001"
                  />
                </div>
                
                <div className="icm-form-group">
                  <label className="icm-form-label">Drawing Ref</label>
                  <input
                    type="text"
                    className="icm-input"
                    value={formData.drawing_ref}
                    onChange={e => handleChange('drawing_ref', e.target.value)}
                    placeholder="e.g., MECH-001"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="icm-footer">
            <button type="button" className="icm-btn icm-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="icm-btn icm-btn-primary"
              disabled={createIssue.isPending}
            >
              {createIssue.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <AlertTriangle size={16} />
                  Create Issue
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}