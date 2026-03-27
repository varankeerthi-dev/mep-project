import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';

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

  useEffect(() => { supabase.from('users').select('*').order('created_at', { ascending: false }).then(({ data }) => setUsers(data || [])); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const empId = 'EMP-' + Date.now().toString().slice(-6);
    await supabase.from('users').insert({ ...formData, emp_id: empId });
    setShowForm(false); setFormData({ emp_name: '', email: '', role: 'Assistant' });
    supabase.from('users').select('*').order('created_at', { ascending: false }).then(({ data }) => setUsers(data || []));
  };

  const deleteUser = async (id) => { if (confirm('Delete this user?')) { await supabase.from('users').delete().eq('id', id); supabase.from('users').select('*').order('created_at', { ascending: false }).then(({ data }) => setUsers(data || [])); }};

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


