import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function RemindMe() {
  const [reminders, setReminders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', remind_date: '', description: '' });
  useEffect(() => { supabase.from('reminders').select('*').order('remind_date', { ascending: true }).then(({ data }) => setReminders(data || [])); }, []);
  const handleSubmit = async (e) => { e.preventDefault(); await supabase.from('reminders').insert(formData); setShowForm(false); setFormData({ title: '', remind_date: '', description: '' }); supabase.from('reminders').select('*').order('remind_date', { ascending: true }).then(({ data }) => setReminders(data || [])); };
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Remind Me</h1><button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add'}</button></div>
      {showForm && (<div className="card"><form onSubmit={handleSubmit}><div className="form-group"><label className="form-label">Title</label><input type="text" className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required /></div><div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={formData.remind_date} onChange={e => setFormData({...formData, remind_date: e.target.value})} required /></div><div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div><button type="submit" className="btn btn-primary">Save</button></form></div>)}
      <div className="card">{reminders.length === 0 ? <div className="empty-state"><h3>No Reminders</h3></div> : (<div className="table-container"><table className="table"><thead><tr><th>Title</th><th>Date</th><th>Description</th></tr></thead><tbody>{reminders.map(r => (<tr key={r.id}><td>{r.title}</td><td>{r.remind_date}</td><td>{r.description || '-'}</td></tr>))}</tbody></table></div>)}</div>
    </div>
  );
}


