import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function CreateProject() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);

  const [formData, setFormData] = useState({
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

  const loadProject = async (id) => {
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
    } catch (err) {
      console.error('Error loading project:', err);
      alert('Error loading project: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const projectData = {
        client_id: formData.client_id,
        project_name: formData.project_name.trim(),
        parent_project_id: formData.parent_project_id || null,
        project_type: formData.project_type,
        project_estimated_value: formData.project_estimated_value ? parseFloat(formData.project_estimated_value) : null,
        po_required: formData.po_required,
        po_status: formData.po_required ? formData.po_status : 'Not Required',
        start_date: formData.start_date || null,
        expected_end_date: formData.expected_end_date || null,
        actual_end_date: formData.actual_end_date || null,
        completion_percentage: parseFloat(formData.completion_percentage) || 0,
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
    } catch (err) {
      console.error('Error saving project:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
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

  const getStatusColor = (status) => {
    const colors = {
      'Draft': { bg: '#f3f4f6', color: '#6b7280' },
      'Active': { bg: '#dbeafe', color: '#1d4ed8' },
      'Execution Completed': { bg: '#fef3c7', color: '#b45309' },
      'Financially Closed': { bg: '#d1fae5', color: '#047857' },
      'Closed': { bg: '#f3f4f6', color: '#374151' }
    };
    return colors[status] || colors['Draft'];
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{editId ? 'Edit Project' : 'New Project'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#374151' }}>Identity</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Client *</label>
              <select
                name="client_id"
                className="form-select"
                value={formData.client_id}
                onChange={handleInputChange}
              >
                <option value="">Select Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.client_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input
                type="text"
                name="project_name"
                className="form-input"
                value={formData.project_name}
                onChange={handleInputChange}
                placeholder="Enter project name"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Parent Project</label>
              <select
                name="parent_project_id"
                className="form-select"
                value={formData.parent_project_id}
                onChange={handleInputChange}
              >
                <option value="">Select Parent Project</option>
                {projects.filter(p => p.id !== editId).map(p => (
                  <option key={p.id} value={p.id}>{p.project_code || 'N/A'} - {p.project_name || 'Unnamed'}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Project Type</label>
              <select
                name="project_type"
                className="form-select"
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

        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#374151' }}>Commercial</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Estimated Value</label>
              <input
                type="number"
                name="project_estimated_value"
                className="form-input"
                value={formData.project_estimated_value}
                onChange={handleInputChange}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label className="form-label">PO Required</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="po_required"
                    checked={formData.po_required === true}
                    onChange={() => setFormData(prev => ({ ...prev, po_required: true }))}
                  />
                  Yes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
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
              <div className="form-group">
                <label className="form-label">PO Status</label>
                <select
                  name="po_status"
                  className="form-select"
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

        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#374151' }}>Timeline</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                name="start_date"
                className="form-input"
                value={formData.start_date}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expected End Date</label>
              <input
                type="date"
                name="expected_end_date"
                className="form-input"
                value={formData.expected_end_date}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Actual End Date</label>
              <input
                type="date"
                name="actual_end_date"
                className="form-input"
                value={formData.actual_end_date}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Completion %</label>
              <input
                type="number"
                name="completion_percentage"
                className="form-input"
                value={formData.completion_percentage}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="0.01"
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#374151' }}>Status</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {['Draft', 'Active', 'Execution Completed', 'Financially Closed', 'Closed'].map(status => (
                  <button
                    key={status}
                    type="button"
                    className="btn"
                    style={{
                      background: formData.status === status ? getStatusColor(status).bg : '#f3f4f6',
                      color: formData.status === status ? getStatusColor(status).color : '#6b7280',
                      border: formData.status === status ? '2px solid ' + getStatusColor(status).color : '1px solid #d1d5db',
                      padding: '6px 12px',
                      fontSize: '12px'
                    }}
                    onClick={() => handleStatusChange(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea
                name="remarks"
                className="form-textarea"
                value={formData.remarks}
                onChange={handleInputChange}
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/projects')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : editId ? 'Update' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
