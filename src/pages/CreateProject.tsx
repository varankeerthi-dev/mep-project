import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Building2, DollarSign, Calendar, Activity } from 'lucide-react';

type ProjectFormData = {
  client_id: string
  project_name: string
  parent_project_id: string
  project_type: string
  project_estimated_value: string
  po_required: boolean
  po_status: string
  start_date: string
  expected_end_date: string
  actual_end_date: string
  completion_percentage: number
  status: string
  remarks: string
}

const STATUS_CONFIG = {
  'Draft': { bg: '#f1f5f9', color: '#64748b' },
  'Active': { bg: '#dcfce7', color: '#16a34a' },
  'Execution Completed': { bg: '#fef3c7', color: '#d97706' },
  'Financially Closed': { bg: '#e0e7ff', color: '#4f46e5' },
  'Closed': { bg: '#f1f5f9', color: '#475569' },
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --bg-page: #faf9f7;
    --bg-card: #ffffff;
    --bg-hover: #f5f3f0;
    --bg-input: #fafaf9;
    --border: #e8e5e1;
    --border-hover: #d4d0ca;
    --border-focus: #e85d04;
    --text-primary: #1a1a1a;
    --text-secondary: #6b6b6b;
    --text-muted: #9ca3af;
    --accent: #e85d04;
    --accent-hover: #dc4c00;
    --accent-light: #fff4ed;
  }
  
  * { box-sizing: border-box; }
  
  body { background: var(--bg-page); }
  
  .pf-page {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: var(--bg-page);
    min-height: 100vh;
    padding: 2rem;
  }
  
  .pf-container {
    max-width: 900px;
    margin: 0 auto;
  }
  
  .pf-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .pf-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .pf-back:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
    color: var(--text-primary);
  }
  
  .pf-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    margin: 0;
  }
  
  .pf-subtitle {
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin-top: 0.125rem;
  }
  
  .pf-actions {
    display: flex;
    gap: 0.75rem;
    margin-left: auto;
  }
  
  .pf-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.125rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    font-family: inherit;
  }
  
  .pf-btn-primary {
    background: var(--accent);
    color: white;
  }
  
  .pf-btn-primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }
  
  .pf-btn-secondary {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  
  .pf-btn-secondary:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }
  
  /* Form Sections */
  .pf-section {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    margin-bottom: 1rem;
    overflow: hidden;
  }
  
  .pf-section-header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.875rem 1.25rem;
    background: var(--bg-page);
    border-bottom: 1px solid var(--border);
  }
  
  .pf-section-icon {
    color: var(--accent);
  }
  
  .pf-section-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-secondary);
    margin: 0;
  }
  
  .pf-section-body {
    padding: 1rem 1.25rem;
  }
  
  /* Form Grid */
  .pf-grid {
    display: grid;
    gap: 0.875rem;
  }
  
  .pf-grid-2 { grid-template-columns: repeat(2, 1fr); }
  .pf-grid-4 { grid-template-columns: repeat(4, 1fr); }
  
  @media (max-width: 768px) {
    .pf-grid-2, .pf-grid-4 { grid-template-columns: 1fr; }
  }
  
  /* Form Field */
  .pf-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .pf-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  
  .pf-label-required::after {
    content: ' *';
    color: var(--accent);
  }
  
  .pf-input,
  .pf-select,
  .pf-textarea {
    width: 100%;
    padding: 0.625rem 0.875rem;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--text-primary);
    transition: all 0.15s ease;
  }
  
  .pf-input:focus,
  .pf-select:focus,
  .pf-textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(232, 93, 4, 0.08);
    background: white;
  }
  
  .pf-input::placeholder,
  .pf-textarea::placeholder {
    color: var(--text-muted);
  }
  
  .pf-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    padding-right: 2.5rem;
  }
  
  .pf-textarea {
    resize: vertical;
    min-height: 80px;
  }
  
  .pf-input-mono {
    font-family: 'JetBrains Mono', monospace;
  }
  
  /* Radio Group */
  .pf-radio-group {
    display: flex;
    gap: 1.5rem;
    padding: 0.5rem 0;
  }
  
  .pf-radio {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-secondary);
    transition: color 0.15s ease;
  }
  
  .pf-radio:hover {
    color: var(--text-primary);
  }
  
  .pf-radio input[type="radio"] {
    appearance: none;
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--border);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }
  
  .pf-radio input[type="radio"]:checked {
    border-color: var(--accent);
    background: var(--accent);
    box-shadow: inset 0 0 0 3px white;
  }
  
  /* Status Pills */
  .pf-status-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }
  
  .pf-status-pill {
    padding: 0.375rem 0.875rem;
    border-radius: 2rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-secondary);
  }
  
  .pf-status-pill:hover {
    border-color: var(--border-hover);
    background: var(--bg-hover);
  }
  
  .pf-status-pill.active {
    border-color: transparent;
  }
  
  /* Loading */
  .pf-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  .pf-skeleton {
    background: linear-gradient(90deg, var(--bg-page) 0%, var(--bg-card) 50%, var(--bg-page) 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 0.5rem;
  }
  
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'pf-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

export default function CreateProject() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [formData, setFormData] = useState<ProjectFormData>({
    client_id: '',
    project_name: '',
    parent_project_id: '',
    project_type: 'Main',
    project_estimated_value: '',
    po_required: true,
    po_status: 'Pending',
    start_date: '',
    expected_end_date: '',
    actual_end_date: '',
    completion_percentage: 0,
    status: 'Draft',
    remarks: ''
  });

  useEffect(() => {
    loadClients();
    loadProjects();
    if (editId) {
      loadProject(editId);
    }
  }, [editId]);

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('id, client_name').order('client_name');
    setClients(data || []);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, project_code, project_name')
      .order('project_name');
    setProjects(data || []);
  };

  const loadProject = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setFormData({
          client_id: data.client_id || '',
          project_name: data.project_name || '',
          parent_project_id: data.parent_project_id || '',
          project_type: data.project_type || 'Main',
          project_estimated_value: data.project_estimated_value || '',
          po_required: data.po_required !== false,
          po_status: data.po_status || 'Pending',
          start_date: data.start_date || '',
          expected_end_date: data.expected_end_date || '',
          actual_end_date: data.actual_end_date || '',
          completion_percentage: data.completion_percentage || 0,
          status: data.status || 'Draft',
          remarks: data.remarks || ''
        });
      }
    } catch (err: any) {
      console.error('Error loading project:', err);
      alert('Error loading project: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: any) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? e.target.checked : value
    }));
  };

  const validateForm = () => {
    if (!formData.project_name.trim()) {
      alert('Project Name is required');
      return false;
    }
    if (!formData.client_id) {
      alert('Please select a client');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const projectData = {
        client_id: formData.client_id,
        name: formData.project_name.trim(),
        project_name: formData.project_name.trim(),
        parent_project_id: formData.parent_project_id || null,
        project_type: formData.project_type,
        project_estimated_value: formData.project_estimated_value ? parseFloat(formData.project_estimated_value) : null,
        po_required: formData.po_required,
        po_status: formData.po_required ? formData.po_status : 'Not Required',
        start_date: formData.start_date || null,
        expected_end_date: formData.expected_end_date || null,
        actual_end_date: formData.actual_end_date || null,
        completion_percentage: parseFloat(String(formData.completion_percentage)) || 0,
        status: formData.status,
        remarks: formData.remarks || null
      };

      if (editId) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', editId);
        
        if (error) throw error;
        alert('Project updated successfully!');
      } else {
        const { error } = await supabase
          .from('projects')
          .insert(projectData);
        
        if (error) throw error;
        alert('Project created successfully!');
      }
      
      navigate('/projects');
    } catch (err: any) {
      console.error('Error saving project:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'Closed' && editId) {
      try {
        const { data, error } = await supabase.rpc('can_close_project', { p_id: editId });
        if (error) {
          console.warn('RPC call failed, allowing close:', error);
        } else if (!data) {
          alert('Cannot close project: Outstanding invoices exist');
          return;
        }
      } catch (err) {
        console.warn('Error checking project close status:', err);
      }
    }
    setFormData(prev => ({ ...prev, status: newStatus }));
  };

  if (loading) {
    return (
      <div className="pf-page">
        <div className="pf-container">
          <div className="pf-skeleton" style={{ width: '100%', height: '400px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="pf-page">
      <div className="pf-container">
        <div className="pf-header">
          <button className="pf-back" onClick={() => navigate('/projects')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="pf-title">{editId ? 'Edit Project' : 'New Project'}</h1>
            <p className="pf-subtitle">{editId ? 'Update project details' : 'Create a new project'}</p>
          </div>
          <div className="pf-actions">
            <button className="pf-btn pf-btn-secondary" onClick={() => navigate('/projects')}>
              Cancel
            </button>
            <button type="submit" className="pf-btn pf-btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Identity Section */}
          <div className="pf-section">
            <div className="pf-section-header">
              <Building2 size={16} className="pf-section-icon" />
              <h2 className="pf-section-title">Identity</h2>
            </div>
            <div className="pf-section-body">
              <div className="pf-grid pf-grid-2">
                <div className="pf-field">
                  <label className="pf-label pf-label-required">Client</label>
                  <select
                    name="client_id"
                    className="pf-select"
                    value={formData.client_id}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.client_name}</option>
                    ))}
                  </select>
                </div>

                <div className="pf-field">
                  <label className="pf-label pf-label-required">Project Name</label>
                  <input
                    type="text"
                    name="project_name"
                    className="pf-input"
                    value={formData.project_name}
                    onChange={handleInputChange}
                    placeholder="Enter project name"
                    required
                  />
                </div>

                <div className="pf-field">
                  <label className="pf-label">Parent Project</label>
                  <select
                    name="parent_project_id"
                    className="pf-select"
                    value={formData.parent_project_id}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Parent Project</option>
                    {projects.filter(p => p.id !== editId).map(p => (
                      <option key={p.id} value={p.id}>{p.project_code || 'N/A'} - {p.project_name || 'Unnamed'}</option>
                    ))}
                  </select>
                </div>

                <div className="pf-field">
                  <label className="pf-label">Project Type</label>
                  <select
                    name="project_type"
                    className="pf-select"
                    value={formData.project_type}
                    onChange={handleInputChange}
                  >
                    <option value="Main">Main</option>
                    <option value="Expansion">Expansion</option>
                    <option value="Service">Service</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Commercial Section */}
          <div className="pf-section">
            <div className="pf-section-header">
              <DollarSign size={16} className="pf-section-icon" />
              <h2 className="pf-section-title">Commercial</h2>
            </div>
            <div className="pf-section-body">
              <div className="pf-grid pf-grid-2">
                <div className="pf-field">
                  <label className="pf-label">Estimated Value</label>
                  <input
                    type="number"
                    name="project_estimated_value"
                    className="pf-input pf-input-mono"
                    value={formData.project_estimated_value}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="pf-field">
                  <label className="pf-label">PO Required</label>
                  <div className="pf-radio-group">
                    <label className="pf-radio">
                      <input
                        type="radio"
                        name="po_required"
                        checked={formData.po_required === true}
                        onChange={() => setFormData(prev => ({ ...prev, po_required: true }))}
                      />
                      Yes
                    </label>
                    <label className="pf-radio">
                      <input
                        type="radio"
                        name="po_required"
                        checked={formData.po_required === false}
                        onChange={() => setFormData(prev => ({ ...prev, po_required: false, po_status: 'Not Required' }))}
                      />
                      No
                    </label>
                  </div>
                </div>

                {formData.po_required && (
                  <div className="pf-field">
                    <label className="pf-label">PO Status</label>
                    <select
                      name="po_status"
                      className="pf-select"
                      value={formData.po_status}
                      onChange={handleInputChange}
                    >
                      <option value="Not Required">Not Required</option>
                      <option value="Pending">Pending</option>
                      <option value="Received">Received</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline Section */}
          <div className="pf-section">
            <div className="pf-section-header">
              <Calendar size={16} className="pf-section-icon" />
              <h2 className="pf-section-title">Timeline</h2>
            </div>
            <div className="pf-section-body">
              <div className="pf-grid pf-grid-4">
                <div className="pf-field">
                  <label className="pf-label">Start Date</label>
                  <input
                    type="date"
                    name="start_date"
                    className="pf-input"
                    value={formData.start_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="pf-field">
                  <label className="pf-label">Expected End</label>
                  <input
                    type="date"
                    name="expected_end_date"
                    className="pf-input"
                    value={formData.expected_end_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="pf-field">
                  <label className="pf-label">Actual End</label>
                  <input
                    type="date"
                    name="actual_end_date"
                    className="pf-input"
                    value={formData.actual_end_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="pf-field">
                  <label className="pf-label">Completion %</label>
                  <input
                    type="number"
                    name="completion_percentage"
                    className="pf-input pf-input-mono"
                    value={formData.completion_percentage}
                    onChange={handleInputChange}
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="pf-section">
            <div className="pf-section-header">
              <Activity size={16} className="pf-section-icon" />
              <h2 className="pf-section-title">Status & Notes</h2>
            </div>
            <div className="pf-section-body">
              <div className="pf-grid pf-grid-2">
                <div className="pf-field">
                  <label className="pf-label">Project Status</label>
                  <div className="pf-status-group">
                    {['Draft', 'Active', 'Execution Completed', 'Financially Closed', 'Closed'].map(status => {
                      const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
                      const isActive = formData.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          className={`pf-status-pill ${isActive ? 'active' : ''}`}
                          style={isActive ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color } : {}}
                          onClick={() => handleStatusChange(status)}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pf-field">
                  <label className="pf-label">Remarks</label>
                  <textarea
                    name="remarks"
                    className="pf-textarea"
                    value={formData.remarks}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Add any additional notes..."
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
