import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { AppTable } from '../components/ui/AppTable';

export default function DailyUpdates() {
  const { organisation } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ project_id: '', update_date: new Date().toISOString().split('T')[0], description: '', images: [] });

  const loadUpdates = async () => { 
    const { data } = await supabase.from('daily_updates').select('*, project:projects(name)').eq('organisation_id', organisation?.id).order('update_date', { ascending: false }); 
    setUpdates(data || []); 
  };

  useEffect(() => { loadUpdates(); }, [organisation?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await supabase.from('daily_updates').insert({ project_id: formData.project_id || null, update_date: formData.update_date, description: formData.description, organisation_id: organisation?.id });
    setShowForm(false); loadUpdates();
  }

  const tableColumns = useMemo(() => [
    { header: 'Date', accessorKey: 'update_date' },
    { header: 'Project', accessorKey: 'project.name', cell: (info) => info.getValue() || '-' },
    { header: 'Description', accessorKey: 'description' }
  ], []);

  return (
    <div>
      <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ margin: '20px 24px' }}>{showForm ? 'Cancel' : '+ Add Update'}</button>
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
          <AppTable
            data={updates}
            columns={tableColumns}
            enableSorting={true}
            enablePagination={true}
            emptyMessage="No daily updates"
          />
        )}
      </div>
    </div>
  );
}


