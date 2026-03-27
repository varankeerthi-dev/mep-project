import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

type ClientRequest = {
  id?: string
  client_name: string
  subject: string
  request_date: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  status?: 'pending' | 'resolved' | string
}

export default function ClientRequests() {
  const [requests, setRequests] = useState<ClientRequest[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<ClientRequest>({
    client_name: '',
    subject: '',
    request_date: new Date().toISOString().split('T')[0],
    description: '',
    priority: 'medium'
  })

  const loadRequests = async () => {
    const { data } = await supabase.from('client_requests').select('*').order('request_date', { ascending: false })
    setRequests(data || [])
  }

  useEffect(() => { loadRequests() }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await supabase.from('client_requests').insert(formData)
    setShowForm(false)
    setFormData({
      client_name: '',
      subject: '',
      request_date: new Date().toISOString().split('T')[0],
      description: '',
      priority: 'medium'
    })
    loadRequests()
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('client_requests').update({ status }).eq('id', id)
    loadRequests()
  }

  const getPriorityColor = (p: string) => {
    if (p === 'high') return '#f8d7da'
    if (p === 'medium') return '#fff3cd'
    return '#d4edda'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Client Requests</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Request'}</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Client Name *</label><input type="text" className="form-input" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required /></div>
              <div className="form-group"><label className="form-label">Subject *</label><input type="text" className="form-input" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Request Date</label><input type="date" className="form-input" value={formData.request_date} onChange={e => setFormData({...formData, request_date: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Priority</label><select className="form-select" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as 'low' | 'medium' | 'high'})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            <button type="submit" className="btn btn-primary">Submit Request</button>
          </form>
        </div>
      )}

      <div className="card">
        {requests.length === 0 ? <div className="empty-state"><h3>No Client Requests</h3></div> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Date</th><th>Client</th><th>Subject</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{requests.map(r => (
                <tr key={r.id}>
                  <td>{r.request_date}</td>
                  <td>{r.client_name}</td>
                  <td>{r.subject}</td>
                  <td><span style={{ padding: '4px 8px', borderRadius: '4px', background: getPriorityColor(r.priority) }}>{r.priority}</span></td>
                  <td><span style={{ padding: '4px 8px', borderRadius: '4px', background: r.status === 'pending' ? '#fff3cd' : '#d4edda' }}>{r.status}</span></td>
                  <td>
                    {r.status === 'pending' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => r.id && updateStatus(r.id, 'resolved')}>Mark Resolved</button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
