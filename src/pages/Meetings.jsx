import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function MeetingsDashboard({ onNavigate }) {
  const [meetings, setMeetings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [viewMode, setViewMode] = useState('list')

  const loadMeetings = async () => {
    let query = supabase.from('meetings').select('*').order('meeting_date', { ascending: true })
    if (filter === 'upcoming') {
      query = query.gte('meeting_date', new Date().toISOString().split('T')[0]).eq('status', 'upcoming')
    } else if (filter === 'completed') {
      query = query.eq('status', 'completed')
    } else if (filter === 'cancelled') {
      query = query.eq('status', 'cancelled')
    }
    const { data } = await query
    setMeetings(data || [])
  }

  useEffect(() => { loadMeetings() }, [filter])

  const updateStatus = async (id, status) => {
    await supabase.from('meetings').update({ status }).eq('id', id)
    loadMeetings()
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Meetings</h1>
        <button className="btn btn-primary" onClick={() => onNavigate('/meetings/create')}>+ Create Meeting</button>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button className={`btn ${filter === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
          <button className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('completed')}>Completed</button>
          <button className={`btn ${filter === 'cancelled' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('cancelled')}>Cancelled</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}>List View</button>
            <button className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('calendar')}>Calendar View</button>
          </div>
        </div>

        {meetings.length === 0 ? (
          <div className="empty-state"><h3>No Meetings</h3></div>
        ) : viewMode === 'list' ? (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Location</th><th>Description</th><th>Participants</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{meetings.map(m => (
                <tr key={m.id}>
                  <td>{m.meeting_date}</td>
                  <td>{m.meeting_time || '-'}</td>
                  <td>{m.client_name}</td>
                  <td>{m.location || '-'}</td>
                  <td>{m.description || '-'}</td>
                  <td>{m.participants || '-'}</td>
                  <td><span style={{ padding: '4px 8px', borderRadius: '4px', background: m.status === 'upcoming' ? '#d1ecf1' : m.status === 'completed' ? '#d4edda' : '#f8d7da', color: m.status === 'upcoming' ? '#0c5460' : m.status === 'completed' ? '#155724' : '#721c24' }}>{m.status}</span></td>
                  <td>
                    {m.status === 'upcoming' && (
                      <>
                        <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(m.id, 'completed')}>Mark Complete</button>
                        <button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => updateStatus(m.id, 'cancelled')}>Cancel</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {meetings.map(m => (
              <div key={m.id} className="card" style={{ padding: '16px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{m.client_name}</div>
                <div style={{ fontSize: '14px', color: '#666' }}>{m.meeting_date} {m.meeting_time}</div>
                <div style={{ fontSize: '14px' }}>{m.location}</div>
                <div style={{ fontSize: '14px', marginTop: '8px' }}>{m.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function CreateMeeting({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    client_name: '',
    meeting_date: new Date().toISOString().split('T')[0],
    meeting_time: '',
    description: '',
    location: '',
    participants: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('meetings').insert(formData)
    if (error) { alert('Error: ' + error.message); return }
    onSuccess()
  }

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Create Meeting</h1></div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Client Name *</label><input type="text" className="form-input" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required /></div>
            <div className="form-group"><label className="form-label">Meeting Date *</label><input type="date" className="form-input" value={formData.meeting_date} onChange={e => setFormData({...formData, meeting_date: e.target.value})} required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Meeting Time</label><input type="time" className="form-input" value={formData.meeting_time} onChange={e => setFormData({...formData, meeting_time: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} /></div>
          </div>
          <div className="form-group"><label className="form-label">Participants</label><input type="text" className="form-input" value={formData.participants} onChange={e => setFormData({...formData, participants: e.target.value})} placeholder="Comma separated names" /></div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: '12px' }}><button type="submit" className="btn btn-primary">Save Meeting</button><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button></div>
        </form>
      </div>
    </div>
  )
}
