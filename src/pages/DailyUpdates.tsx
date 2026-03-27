import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function DailyUpdates() {
  const [updates, setUpdates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ project_id: '', update_date: new Date().toISOString().split('T')[0], description: '', images: [] });

  const loadUpdates = async () => { const { data } = await supabase.from('daily_updates').select('*, project:projects(name)').order('update_date', { ascending: false }); setUpdates(data || []); };

  useEffect(() => { loadUpdates(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await supabase.from('daily_updates').insert({ project_id: formData.project_id || null, update_date: formData.update_date, description: formData.description });
    setShowForm(false); loadUpdates();
  };

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Daily Updates</h1><button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Update'}</button></div>
      {showForm && (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Project</label><select className="form-select" value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})}><option value="">Select Project</option></select></div>
              <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={formData.update_date} onChange={e => setFormData({...formData, update_date: e.target.value})} /></div>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Upload Pictures</label><input type="file" className="form-input" multiple accept="image/*" /></div>
            <div className="form-group"><label className="form-label">Upload Documents (PDF)</label><input type="file" className="form-input" multiple accept="application/pdf" /></div>
            <button type="submit" className="btn btn-primary">Submit</button>
          </form>
        </div>
      )}
      <div className="card">
        {updates.length === 0 ? <div className="empty-state"><h3>No Updates</h3></div> : (
          <div className="table-container"><table className="table"><thead><tr><th>Date</th><th>Project</th><th>Description</th></tr></thead><tbody>{updates.map(u => (<tr key={u.id}><td>{u.update_date}</td><td>{u.project?.name || '-'}</td><td>{u.description}</td></tr>))}</tbody></table></div>
        )}
      </div>
    </div>
  );
}


