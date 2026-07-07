import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { ArrowLeft, Save, Building2, DollarSign, Calendar, Activity, Search } from 'lucide-react';
import { useProjectFormDraft } from '../hooks/useProjectFormDraft';
import { useAuditLog } from '../hooks/useAuditLog';

export type ProjectFormData = {
  client_id: string
  project_name: string
  parent_project_id: string
  project_type: string
  project_estimated_value: string
  po_required: boolean
  po_status: string
  po_number: string
  po_date: string
  start_date: string
  expected_end_date: string
  actual_end_date: string
  completion_percentage: number
  status: string
  remarks: string
  contractor_scope: string
  client_scope: string
  excluded_scope: string
  pending_approval: string
  site_instructions: string
}

const STATUS_CONFIG = {
  'Draft': { bg: '#f1f5f9', color: '#64748b' },
  'Active': { bg: '#dcfce7', color: '#16a34a' },
  'Execution Completed': { bg: '#fef3c7', color: '#d97706' },
  'Financially Closed': { bg: '#e0e7ff', color: '#4f46e5' },
  'Closed': { bg: '#f1f5f9', color: '#475569' },
};

const BRAND_BLUE = '#185FA5';

const headerFieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
const labelColStyle: React.CSSProperties = { minWidth: '70px', maxWidth: '70px', fontWeight: 600, fontSize: '11px', color: '#374151' };
const fieldColStyle: React.CSSProperties = { flex: 1 };
const sectionHeaderStyle: React.CSSProperties = { fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };
const inputStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d4d4d8', background: '#fff', width: '100%', outline: 'none', color: '#1f2937', fontFamily: 'inherit' };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: '60px', lineHeight: 1.4 };

const sectionBoxStyle: React.CSSProperties = { background: '#f8f9fa', padding: '12px', borderRadius: '6px' };

const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
  <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
    <span style={labelColStyle}>{label}</span>
    <div style={fieldColStyle}>{field}</div>
  </div>
);

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '6px 14px', border: `1px solid ${BRAND_BLUE}`,
  background: BRAND_BLUE, color: '#fff',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '6px 14px', border: '1px solid #d1d5db',
  background: '#fff', color: '#374151',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s',
};

function SearchableClientSelect({ clients, value, onChange }: { clients: any[]; value: string; onChange: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-container')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = clients.find(c => c.id === value);
  const filtered = clients.filter(c =>
    !searchText || c.client_name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div ref={containerRef} className="dropdown-container" style={{ position: 'relative' }}>
      <input
        value={isOpen ? searchText : (selected?.client_name || '')}
        onChange={e => { setSearchText(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search client..."
        style={inputStyle}
      />
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          zIndex: 50, background: 'white', border: '1px solid #d1d5db',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          maxHeight: '200px', overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No clients found</div>
          ) : filtered.map(c => (
            <div key={c.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
              onClick={() => { onChange(c.id); setSearchText(''); setIsOpen(false); }}
            >{c.client_name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CreateProject() {
  const { organisation, user } = useAuth();
  const navigate = useNavigate();
  const auditLog = useAuditLog(organisation?.id, user?.id);
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [clientPOs, setClientPOs] = useState<any[]>([]);

  const initialFormData: ProjectFormData = {
    client_id: '',
    project_name: '',
    parent_project_id: '',
    project_type: 'Main',
    project_estimated_value: '',
    po_required: true,
    po_status: 'Pending',
    po_number: '',
    po_date: '',
    start_date: '',
    expected_end_date: '',
    actual_end_date: '',
    completion_percentage: 0,
    status: 'Draft',
    remarks: '',
    contractor_scope: '',
    client_scope: '',
    excluded_scope: '',
    pending_approval: '',
    site_instructions: ''
  };

  const [formData, setFormData, clearDraft] = useProjectFormDraft(editId, initialFormData);
  const [draftCleared, setDraftCleared] = useState(false);

  useEffect(() => {
    if (!editId && draftCleared) {
      setFormData(initialFormData as any)
    }
  }, [editId, draftCleared]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!editId) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [editId])

  useEffect(() => {
    loadClients();
    loadProjects();
    if (editId) {
      loadProject(editId);
    }
  }, [editId, organisation?.id]);

  useEffect(() => {
    if (formData.client_id) {
      loadClientPOs(formData.client_id);
    }
  }, [formData.client_id]);

  const loadClients = async () => {
    if (!organisation?.id) return;
    const { data } = await supabase.from('clients').select('id, client_name').eq('organisation_id', organisation.id).order('client_name');
    setClients(data || []);
  };

  const loadClientPOs = async (clientId: string) => {
    if (!organisation?.id || !clientId) {
      setClientPOs([]);
      return;
    }
    const { data } = await supabase
      .from('client_purchase_orders')
      .select('id, po_number, po_date, po_total_value, status')
      .eq('client_id', clientId)
      .order('po_date', { ascending: false });
    setClientPOs(data || []);
  };

  const loadProjects = async () => {
    if (!organisation?.id) return;
    const { data } = await supabase
      .from('projects')
      .select('id, project_code, project_name')
      .eq('organisation_id', organisation.id)
      .order('project_name');
    setProjects(data || []);
  };

  const loadProject = async (id: string) => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('organisation_id', organisation.id)
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
          po_number: data.po_number || '',
          po_date: data.po_date || '',
          start_date: data.start_date || '',
          expected_end_date: data.expected_end_date || '',
          actual_end_date: data.actual_end_date || '',
          completion_percentage: data.completion_percentage || 0,
          status: data.status || 'Draft',
          remarks: data.remarks || '',
          contractor_scope: data.contractor_scope || '',
          client_scope: data.client_scope || '',
          excluded_scope: data.excluded_scope || '',
          pending_approval: data.pending_approval || '',
          site_instructions: data.site_instructions || ''
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

    if (name === 'completion_percentage') {
      const pct = Math.min(100, Math.max(0, parseFloat(value) || 0));
      setFormData((prev: any) => {
        let newStatus = prev.status;
        
        if (pct === 100 && (prev.status === 'Draft' || prev.status === 'Active')) {
          newStatus = 'Execution Completed';
        }
        
        if (pct < 100 && (prev.status === 'Execution Completed' || prev.status === 'Closed' || prev.status === 'Financially Closed')) {
          newStatus = 'Active';
        }
        
        return {
          ...prev,
          completion_percentage: value === '' ? '' : pct,
          status: newStatus
        };
      });
      return;
    }

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

    const isCompleted = ['Execution Completed', 'Closed', 'Financially Closed'].includes(formData.status);
    if (isCompleted && parseFloat(String(formData.completion_percentage)) < 100) {
      alert('A completed project must have a completion percentage of 100%');
      setFormData(prev => ({ ...prev, completion_percentage: 100 }));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    if (!validateForm()) return;

    setSaving(true);
    try {
      const projectData: Record<string, unknown> = {
        client_id: formData.client_id,
        name: formData.project_name.trim(),
        project_name: formData.project_name.trim(),
        parent_project_id: formData.parent_project_id || null,
        project_type: formData.project_type,
        project_estimated_value: formData.project_estimated_value ? parseFloat(formData.project_estimated_value) : null,
        po_required: formData.po_required,
        po_status: formData.po_required ? formData.po_status : 'Not Required',
        po_number: formData.po_number || null,
        po_date: formData.po_date || null,
        start_date: formData.start_date || null,
        expected_end_date: formData.expected_end_date || null,
        actual_end_date: formData.actual_end_date || null,
        completion_percentage: parseFloat(String(formData.completion_percentage)) || 0,
        status: formData.status,
        remarks: formData.remarks || null,
        organisation_id: organisation.id,
        contractor_scope: formData.contractor_scope || null,
        client_scope: formData.client_scope || null,
        excluded_scope: formData.excluded_scope || null,
        pending_approval: formData.pending_approval || null,
        site_instructions: formData.site_instructions || null
      };

      if (editId) {
        projectData.updated_by = user?.id;
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', editId)
          .eq('organisation_id', organisation.id);
        
        if (error) throw error;
        auditLog.log('updated', 'project', editId, projectData as Record<string, unknown>);
        alert('Project updated successfully!');
      } else {
        projectData.created_by = user?.id;
        const { data: newProject, error } = await supabase
          .from('projects')
          .insert(projectData)
          .select('id')
          .single();
        
        if (error) throw error;
        clearDraft();
        setDraftCleared(true);
        auditLog.log('created', 'project', newProject?.id || '', projectData as Record<string, unknown>);
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
    setFormData(prev => {
      const isCompleted = ['Execution Completed', 'Closed', 'Financially Closed'].includes(newStatus);
      return {
        ...prev,
        status: newStatus,
        completion_percentage: isCompleted ? 100 : prev.completion_percentage
      };
    });
  };

  const pageStyle: React.CSSProperties = {
    background: '#faf9f7',
    minHeight: '100vh',
    padding: '2rem',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: '900px', margin: '0 auto', color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => navigate('/projects')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '2.5rem', height: '2.5rem', borderRadius: '8px',
            background: '#fff', border: '1px solid #e8e5e1',
            color: '#6b6b6b', cursor: 'pointer',
          }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em', margin: 0 }}>
              {editId ? 'Edit Project' : 'New Project'}
            </h1>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '2px' }}>
              {editId ? 'Update project details' : 'Create a new project'}
            </p>
            {!editId && localStorage.getItem('mep-create-project-draft') && (
              <p style={{ fontSize: '0.8125rem', color: BRAND_BLUE, marginTop: 4 }}>
                Draft restored from previous session
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Identity Section */}
          <div style={{ background: '#fff', border: '1px solid #e8e5e1', borderRadius: '12px', marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.875rem 24px', background: '#faf9f7', borderBottom: '1px solid #e8e5e1' }}>
              <Building2 size={16} color={BRAND_BLUE} />
              <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6b6b', margin: 0 }}>Identity</h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={sectionBoxStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={sectionHeaderStyle}>Client & Project</div>
                    {renderHeaderField('Client', <SearchableClientSelect clients={clients} value={formData.client_id} onChange={id => handleInputChange({ target: { name: 'client_id', value: id } })} />)}
                    {renderHeaderField('Name', <input name="project_name" value={formData.project_name} onChange={handleInputChange} placeholder="Enter project name" required style={inputStyle} />)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={sectionHeaderStyle}>Categorization</div>
                    {renderHeaderField('Parent', <select name="parent_project_id" value={formData.parent_project_id} onChange={handleInputChange} style={selectStyle}>
                      <option value="">Select Parent Project</option>
                      {projects.filter(p => p.id !== editId).map(p => (
                        <option key={p.id} value={p.id}>{p.project_code || 'N/A'} - {p.project_name || 'Unnamed'}</option>
                      ))}
                    </select>)}
                    {renderHeaderField('Type', <select name="project_type" value={formData.project_type} onChange={handleInputChange} style={selectStyle}>
                      <option value="Main">Main</option>
                      <option value="Expansion">Expansion</option>
                      <option value="Service">Service</option>
                    </select>, true)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Commercial Section */}
          <div style={{ background: '#fff', border: '1px solid #e8e5e1', borderRadius: '12px', marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.875rem 24px', background: '#faf9f7', borderBottom: '1px solid #e8e5e1' }}>
              <DollarSign size={16} color={BRAND_BLUE} />
              <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6b6b', margin: 0 }}>Commercial</h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={sectionBoxStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={sectionHeaderStyle}>Value</div>
                    {renderHeaderField('Est. Value', <input type="number" name="project_estimated_value" value={formData.project_estimated_value} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} />)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={sectionHeaderStyle}>Purchase Order</div>
                    {renderHeaderField('PO Req\'d', <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#374151', cursor: 'pointer' }}>
                      <input type="radio" name="po_required" checked={formData.po_required === true} onChange={() => setFormData(prev => ({ ...prev, po_required: true }))} /> Yes
                      <input type="radio" name="po_required" checked={formData.po_required === false} onChange={() => setFormData(prev => ({ ...prev, po_required: false, po_status: 'Not Required' }))} /> No
                    </label>)}
                    {formData.po_required && (
                      <>
                        {renderHeaderField('Status', <select name="po_status" value={formData.po_status} onChange={handleInputChange} style={selectStyle}>
                          <option value="Not Required">Not Required</option>
                          <option value="Pending">Pending</option>
                          <option value="Received">Received</option>
                        </select>)}
                        {formData.po_status === 'Received' && (
                          <>
                            {renderHeaderField('Select PO', <select value={formData.po_number} onChange={e => {
                              const selectedPO = clientPOs.find(po => po.po_number === e.target.value);
                              if (selectedPO) {
                                setFormData(prev => ({ ...prev, po_number: selectedPO.po_number, po_date: selectedPO.po_date }));
                              } else {
                                setFormData(prev => ({ ...prev, po_number: e.target.value, po_date: '' }));
                              }
                            }} style={selectStyle}>
                              <option value="">Select existing PO or enter manually</option>
                              {clientPOs.map(po => (
                                <option key={po.id} value={po.po_number}>{po.po_number} - {po.po_date} (₹{po.po_total_value})</option>
                              ))}
                            </select>)}
                            {renderHeaderField('PO Number', <input type="text" name="po_number" value={formData.po_number} onChange={handleInputChange} placeholder="Enter PO number" style={inputStyle} />)}
                            {renderHeaderField('PO Date', <input type="date" name="po_date" value={formData.po_date} onChange={handleInputChange} style={inputStyle} />, true)}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Section */}
          <div style={{ background: '#fff', border: '1px solid #e8e5e1', borderRadius: '12px', marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.875rem 24px', background: '#faf9f7', borderBottom: '1px solid #e8e5e1' }}>
              <Calendar size={16} color={BRAND_BLUE} />
              <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6b6b', margin: 0 }}>Timeline</h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={sectionBoxStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={sectionHeaderStyle}>Dates</div>
                    {renderHeaderField('Start', <input type="date" name="start_date" value={formData.start_date} onChange={handleInputChange} style={inputStyle} />)}
                    {renderHeaderField('Expected', <input type="date" name="expected_end_date" value={formData.expected_end_date} onChange={handleInputChange} style={inputStyle} />)}
                    {renderHeaderField('Actual', <input type="date" name="actual_end_date" value={formData.actual_end_date} onChange={handleInputChange} style={inputStyle} />)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={sectionHeaderStyle}>Progress</div>
                    {renderHeaderField('Completion', <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="number" name="completion_percentage" value={formData.completion_percentage} onChange={handleInputChange} min="0" max="100" step="0.01" style={{ ...inputStyle, width: '80px', fontFamily: "'JetBrains Mono', monospace" }} />
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>%</span>
                    </div>, true)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scope & Instructions Section */}
          <div style={{ background: '#fff', border: '1px solid #e8e5e1', borderRadius: '12px', marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.875rem 24px', background: '#faf9f7', borderBottom: '1px solid #e8e5e1' }}>
              <Building2 size={16} color={BRAND_BLUE} />
              <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6b6b', margin: 0 }}>Project Scope & Site Engineer Instructions</h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={sectionBoxStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={sectionHeaderStyle}>Scope</div>
                    {renderHeaderField('Contractor', <textarea name="contractor_scope" value={formData.contractor_scope} onChange={handleInputChange} rows={3} placeholder="Subcontractor scope/deliverables..." style={textareaStyle} />)}
                    {renderHeaderField('Client', <textarea name="client_scope" value={formData.client_scope} onChange={handleInputChange} rows={3} placeholder="Client responsibilities/inputs..." style={textareaStyle} />)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={sectionHeaderStyle}>Exclusions</div>
                    {renderHeaderField('Excluded', <textarea name="excluded_scope" value={formData.excluded_scope} onChange={handleInputChange} rows={3} placeholder="Items outside contract..." style={textareaStyle} />)}
                    {renderHeaderField('Pending', <textarea name="pending_approval" value={formData.pending_approval} onChange={handleInputChange} rows={3} placeholder="Variations awaiting sign-off..." style={textareaStyle} />)}
                  </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                  {renderHeaderField('Instructions', <textarea name="site_instructions" value={formData.site_instructions} onChange={handleInputChange} rows={3} placeholder="Operational instructions for onsite engineers..." style={textareaStyle} />, true)}
                </div>
              </div>
            </div>
          </div>

          {/* Status & Notes Section */}
          <div style={{ background: '#fff', border: '1px solid #e8e5e1', borderRadius: '12px', marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.875rem 24px', background: '#faf9f7', borderBottom: '1px solid #e8e5e1' }}>
              <Activity size={16} color={BRAND_BLUE} />
              <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6b6b', margin: 0 }}>Status & Notes</h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={sectionBoxStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={sectionHeaderStyle}>Status</div>
                    {renderHeaderField('Status', <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {['Draft', 'Active', 'Execution Completed', 'Financially Closed', 'Closed'].map(status => {
                        const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
                        const isActive = formData.status === status;
                        return (
                          <button key={status} type="button"
                            onClick={() => handleStatusChange(status)}
                            style={{
                              padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 500,
                              cursor: 'pointer', border: isActive ? `1px solid ${cfg.color}` : '1px solid #d1d5db',
                              background: isActive ? cfg.bg : '#fff',
                              color: isActive ? cfg.color : '#6b7280',
                              transition: 'all 0.15s',
                            }}
                          >{status}</button>
                        );
                      })}
                    </div>)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={sectionHeaderStyle}>Notes</div>
                    {renderHeaderField('Remarks', <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={4} placeholder="Additional notes..." style={textareaStyle} />, true)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '24px 0' }}>
            <button type="button" onClick={() => { clearDraft(); setDraftCleared(true); navigate('/projects'); }}
              style={secondaryBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ ...primaryBtnStyle, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
              onMouseLeave={e => { if (!saving) { e.currentTarget.style.background = BRAND_BLUE; e.currentTarget.style.borderColor = BRAND_BLUE; }}}
            >
              <Save size={14} />
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
