import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

const pushPath = (path) => {
  const nextPath = path || '/';
  if (`${window.location.pathname}${window.location.search}` !== nextPath || window.location.hash) {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new Event('locationchange'));
  }
};

export default function SettingsPage() {
  const { user, organisation, handleLogout } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ emp_name: '', email: '', role: 'Assistant' });
  
  // Document Settings state
  const [docSettings, setDocSettings] = useState({
    vendor_prefix: 'VEN',
    vendor_start_number: 1,
    vendor_suffix: '',
    vendor_padding: 3
  });
  const [loadingDocSettings, setLoadingDocSettings] = useState(false);

  useEffect(() => { 
    supabase.from('users').select('*').order('created_at', { ascending: false }).then(({ data }) => setUsers(data || [])); 
    
    // Load document settings
    if (organisation?.id) {
      supabase.from('document_settings').select('*').eq('organisation_id', organisation.id).single().then(({ data }) => {
        if (data) {
          setDocSettings({
            vendor_prefix: data.vendor_prefix || 'VEN',
            vendor_start_number: data.vendor_start_number || 1,
            vendor_suffix: data.vendor_suffix || '',
            vendor_padding: data.vendor_padding || 3
          });
        }
      });
    }
  }, [organisation?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const empId = 'EMP-' + Date.now().toString().slice(-6);
    await supabase.from('users').insert({ ...formData, emp_id: empId });
    setShowForm(false); setFormData({ emp_name: '', email: '', role: 'Assistant' });
    supabase.from('users').select('*').order('created_at', { ascending: false }).then(({ data }) => setUsers(data || []));
  };

  const deleteUser = async (id) => { if (confirm('Delete this user?')) { await supabase.from('users').delete().eq('id', id); supabase.from('users').select('*').order('created_at', { ascending: false }).then(({ data }) => setUsers(data || [])); }};

  const saveDocSettings = async () => {
    setLoadingDocSettings(true);
    try {
      const { error } = await supabase.from('document_settings').upsert({
        organisation_id: organisation?.id,
        vendor_prefix: docSettings.vendor_prefix,
        vendor_start_number: docSettings.vendor_start_number,
        vendor_suffix: docSettings.vendor_suffix,
        vendor_padding: docSettings.vendor_padding,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organisation_id' });
      
      if (error) throw error;
      alert('Document settings saved successfully!');
    } catch (error) {
      console.error('Error saving document settings:', error);
      alert('Error saving settings: ' + error.message);
    } finally {
      setLoadingDocSettings(false);
    }
  };

  const generatePreview = () => {
    const startNum = parseInt(docSettings.vendor_start_number) || 1;
    const paddedNum = String(startNum).padStart(parseInt(docSettings.vendor_padding) || 3, '0');
    return `${docSettings.vendor_prefix || 'VEN'}${paddedNum}${docSettings.vendor_suffix || ''}`;
  };

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Settings</h1></div>
      
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Account</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#3498db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
            {(user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>{user?.email}</div>
            <div style={{ color: '#666', fontSize: '14px' }}>{organisation?.name}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary">Sign Out</button>
      </div>

      {/* Document Settings Section */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Document Settings</h3>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
          Configure number series for documents. Changes will apply to new documents only.
        </p>
        
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '16px', color: '#333' }}>Vendor Number Series</h4>
          <div className="form-row">
            <div className="form-group" style={{ flex: '1' }}>
              <label className="form-label">Prefix</label>
              <input 
                type="text" 
                className="form-input" 
                value={docSettings.vendor_prefix}
                onChange={e => setDocSettings({...docSettings, vendor_prefix: e.target.value})}
                placeholder="VEN"
              />
            </div>
            <div className="form-group" style={{ flex: '1' }}>
              <label className="form-label">Starting Number</label>
              <input 
                type="number" 
                className="form-input" 
                value={docSettings.vendor_start_number}
                onChange={e => setDocSettings({...docSettings, vendor_start_number: parseInt(e.target.value) || 1})}
                placeholder="1"
              />
            </div>
            <div className="form-group" style={{ flex: '1' }}>
              <label className="form-label">Suffix</label>
              <input 
                type="text" 
                className="form-input" 
                value={docSettings.vendor_suffix}
                onChange={e => setDocSettings({...docSettings, vendor_suffix: e.target.value})}
                placeholder="(optional)"
              />
            </div>
            <div className="form-group" style={{ flex: '1' }}>
              <label className="form-label">Padding (digits)</label>
              <input 
                type="number" 
                className="form-input" 
                value={docSettings.vendor_padding}
                onChange={e => setDocSettings({...docSettings, vendor_padding: parseInt(e.target.value) || 3})}
                min="1"
                max="10"
                placeholder="3"
              />
            </div>
          </div>
          
          <div style={{ marginTop: '12px', padding: '12px', background: '#f8f9fa', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>Preview:</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50', fontFamily: 'monospace' }}>
              {generatePreview()}
            </span>
          </div>
          
          <button 
            onClick={saveDocSettings}
            disabled={loadingDocSettings}
            className="btn btn-primary"
            style={{ marginTop: '16px' }}
          >
            {loadingDocSettings ? 'Saving...' : 'Save Document Settings'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>User Access Rights</h3>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add User'}</button>
        </div>
        
        {showForm && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Employee Name *</label><input type="text" className="form-input" value={formData.emp_name} onChange={e => setFormData({...formData, emp_name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Role *</label><select className="form-select" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}><option value="Admin">Admin</option><option value="Engineer">Engineer</option><option value="Manager">Manager</option><option value="Assistant">Assistant</option><option value="Stores">Stores</option><option value="Site Engineer">Site Engineer</option></select></div>
              </div>
              <button type="submit" className="btn btn-primary">Save User</button>
            </form>
          </div>
        )}

        <div className="table-container">
          <table className="table">
            <thead><tr><th>Emp ID</th><th>Emp Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>{users.map(u => (<tr key={u.id}><td>{u.emp_id}</td><td>{u.emp_name}</td><td>{u.email}</td><td>{u.role}</td><td><button className="btn btn-sm btn-secondary" onClick={() => deleteUser(u.id)}>Delete</button></td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


