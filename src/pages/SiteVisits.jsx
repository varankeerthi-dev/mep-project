import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function SiteVisitsDashboard({ onNavigate }) {
  const [visits, setVisits] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [selectedVisit, setSelectedVisit] = useState(null)

  const loadData = async () => {
    let query = supabase.from('site_visits').select('*, client:clients(client_name)').order('visit_date', { ascending: false })
    
    if (filter === 'pending') {
      query = query.eq('status', 'Pending')
    } else if (filter === 'completed') {
      query = query.eq('status', 'Completed')
    } else if (filter === 'this_month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      query = query.gte('visit_date', startOfMonth.toISOString().split('T')[0])
    }
    
    const { data } = await query
    setVisits(data || [])
  }

  useEffect(() => { loadData() }, [filter])

  useEffect(() => { setSelectedVisit(filteredVisits[0] || null) }, [filteredVisits])

  const getStatusColor = (status) => {
    if (status === 'Pending') return '#fff3cd'
    if (status === 'Quote to be Sent') return '#cce5ff'
    if (status === 'Offer Submitted') return '#d4edda'
    if (status === 'Completed') return '#155724'
    return '#e2e3e5'
  }

  const filteredVisits = visits.filter(v => {
    const clientName = v.client?.client_name?.toLowerCase() || ''
    return clientName.includes(searchTerm.toLowerCase()) || v.site_address?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header">
        <h1 className="page-title">Site Visits</h1>
        <button className="btn btn-primary" onClick={() => onNavigate('/site-visits/new')}>+ New Visit</button>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>All</button>
          <button className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('pending')}>Pending</button>
          <button className={`btn ${filter === 'this_month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('this_month')}>This Month</button>
          <button className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('completed')}>Completed</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search visits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '250px' }}
            />
            <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}>List</button>
            <button className={`btn ${viewMode === 'card' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('card')}>Card</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 200px)' }}>
        <div style={{ width: '30%', padding: '16px', borderRight: '1px solid #ddd', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => { const idx = filteredVisits.findIndex(v => v.id === selectedVisit?.id); if (idx > 0) setSelectedVisit(filteredVisits[idx-1]) }}>↑</button>
            <button className="btn btn-sm btn-secondary" onClick={() => { const idx = filteredVisits.findIndex(v => v.id === selectedVisit?.id); if (idx < filteredVisits.length-1 && idx !== -1) setSelectedVisit(filteredVisits[idx+1]) }}>↓</button>
          </div>
          {filteredVisits.length === 0 ? <div className="empty-state"><h3>No Site Visits</h3></div> : filteredVisits.map(v => (
            <div key={v.id} onClick={() => setSelectedVisit(v)} style={{ padding: '8px', border: '1px solid #ddd', marginBottom: '8px', cursor: 'pointer', background: selectedVisit?.id === v.id ? '#f0f0f0' : 'white' }} title={`Visited on ${v.visit_date} by ${v.visited_by || v.engineer_name || '-'}`}>
              {v.visit_date} | {v.client?.client_name || '-'}
            </div>
          ))}
        </div>
        <div style={{ width: '70%', padding: '16px', overflowY: 'auto' }}>
          {selectedVisit ? (
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h2>{selectedVisit.client?.client_name || '-'} - {selectedVisit.visit_date}</h2>
                <span style={{ padding: '4px 8px', borderRadius: '4px', background: getStatusColor(selectedVisit.status), fontSize: '12px' }}>{selectedVisit.status}</span>
              </div>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Address:</strong> {selectedVisit.site_address || '-'}</div>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Visited By:</strong> {selectedVisit.visited_by || selectedVisit.engineer_name || '-'}</div>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Purpose:</strong> {selectedVisit.purpose_of_visit || '-'}</div>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Next Step:</strong> {selectedVisit.next_step || '-'}</div>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Follow Up:</strong> {selectedVisit.follow_up_date || '-'}</div>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Measurements:</strong> {selectedVisit.measurements || '-'}</div>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Discussion:</strong> {selectedVisit.discussion_points || '-'}</div>
              <div style={{ fontSize: '14px', marginBottom: '8px' }}><strong>Time:</strong> {selectedVisit.visit_time || '-'} - {selectedVisit.out_time || '-'}</div>
              <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('/site-visits/edit?id=' + selectedVisit.id)}>Edit</button>
            </div>
          ) : <div className="empty-state"><h3>Select a visit to view details</h3></div>}
        </div>
      </div>
    </div>
  )
}

export function SiteVisitEdit({ editId, onSuccess, onCancel }) {
  const [visitData, setVisitData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (editId) {
      supabase.from('site_visits').select('*').eq('id', editId).single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Supabase fetch error:', error)
            setVisitData(null) 
          } else if (data) {
            setVisitData(data)
          } else {
            setVisitData(null) 
          }
          setLoading(false)
        })
        .catch(err => {
          console.error('Unhandled fetch exception:', err)
          setVisitData(null)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [editId])

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>
  if (!visitData) return <div style={{ padding: '20px' }}>Visit not found. <button onClick={onCancel}>Go back</button></div>

  return <CreateSiteVisit onSuccess={onSuccess} onCancel={onCancel} editMode={true} visitData={visitData} />
}

export function CreateSiteVisit({ onSuccess, onCancel, editMode, visitData: propVisitData }) {
  const [clients, setClients] = useState([])
  const [formData, setFormData] = useState(propVisitData || {
    client_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: '',
    out_time: '',
    engineer_name: '',
    visited_by: '',
    purpose_of_visit: '',
    site_address: '',
    location: '',
    measurements: '',
    discussion_points: '',
    follow_up_date: '',
    next_step: 'Quote to be Sent',
    status: 'Pending'
  })
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState([])
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => { 
    loadClients()
  }, [])

  useEffect(() => {
    if (propVisitData?.id) {
      loadExistingPhotos(propVisitData.id)
      loadExistingDocuments(propVisitData.id)
    }
  }, [propVisitData?.id])

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('client_name')
    setClients(data || [])
  }

  const loadExistingPhotos = async (visitId) => {
    const { data } = await supabase.from('site_visit_photos').select('*').eq('site_visit_id', visitId)
    if (data) setPhotos(data)
  }

  const loadExistingDocuments = async (visitId) => {
    const { data } = await supabase.from('site_visit_documents').select('*').eq('site_visit_id', visitId)
    if (data) setDocuments(data)
  }

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxSize = 1920
          let width = img.width
          let height = img.height
          
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          } else if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
          
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          
          let quality = 0.8
          let dataUrl = canvas.toDataURL('image/jpeg', quality)
          
          while (dataUrl.length > 1500000 && quality > 0.2) {
            quality -= 0.1
            dataUrl = canvas.toDataURL('image/jpeg', quality)
          }
          
          resolve(dataUrl)
        }
      }
    })
  }

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files)
    setUploading(true)
    
    for (const file of files) {
      try {
        let fileData
        
        if (file.size > 1200 * 1024) {
          const compressed = await compressImage(file)
          const base64Data = compressed.split(',')[1]
          fileData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        } else {
          const arrayBuffer = await file.arrayBuffer()
          fileData = new Uint8Array(arrayBuffer)
        }
        
        const fileName = `photo_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        const { data, error } = await supabase.storage
          .from('site-visit-photos')
          .upload(fileName, fileData, { contentType: 'image/jpeg' })
        
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('site-visit-photos').getPublicUrl(fileName)
          setPhotos(prev => [...prev, { photo_url: urlData.publicUrl, description: '' }])
        }
      } catch (err) {
        console.log('Photo upload skipped:', err.message)
      }
    }
    setUploading(false)
  }

  const handleDocumentUpload = async (e) => {
    const files = Array.from(e.target.files)
    setUploading(true)
    
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const fileName = `doc_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        
        const { data, error } = await supabase.storage
          .from('site-visit-documents')
          .upload(fileName, uint8Array, { contentType: file.type })
        
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('site-visit-documents').getPublicUrl(fileName)
          setDocuments(prev => [...prev, { document_name: file.name, document_url: urlData.publicUrl, document_type: file.type }])
        }
      } catch (err) {
        console.log('Document upload skipped:', err.message)
      }
    }
    setUploading(false)
  }

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const removeDocument = (index) => {
    setDocuments(prev => prev.filter((_, i) => i !== index))
  }

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId)
    setFormData({
      ...formData,
      client_id: clientId,
      site_address: client?.address1 || ''
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const dataToSave = {
        client_id: formData.client_id || null,
        visit_date: formData.visit_date,
        visit_time: formData.visit_time || null,
        out_time: formData.out_time || null,
        engineer_name: formData.engineer_name || null,
        visited_by: formData.visited_by || null,
        purpose_of_visit: formData.purpose_of_visit || null,
        site_address: formData.site_address || null,
        location: formData.location || null,
        measurements: formData.measurements || null,
        discussion_points: formData.discussion_points || null,
        follow_up_date: formData.follow_up_date || null,
        next_step: formData.next_step || 'Quote to be Sent',
        status: formData.status || 'Pending'
      }
      
      let visitId = propVisitData?.id || window.visitData?.id
      
      if (editMode && visitId) {
        const { error } = await supabase.from('site_visits').update(dataToSave).eq('id', visitId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('site_visits').insert(dataToSave).select().single()
        if (error) throw error
        visitId = data?.id
      }
      
      if (visitId && photos.length > 0) {
        for (const photo of photos) {
          if (!photo.id && photo.photo_url) {
            await supabase.from('site_visit_photos').insert({
              site_visit_id: visitId,
              photo_url: photo.photo_url,
              description: photo.description || ''
            }).catch(() => {})
          }
        }
      }
      
      if (visitId && documents.length > 0) {
        for (const doc of documents) {
          if (!doc.id && doc.document_url) {
            await supabase.from('site_visit_documents').insert({
              site_visit_id: visitId,
              document_name: doc.document_name,
              document_url: doc.document_url,
              document_type: doc.document_type
            }).catch(() => {})
          }
        }
      }
      
      alert(editMode ? 'Site visit updated successfully!' : 'Site visit saved successfully!')
      onSuccess()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header"><h1 className="page-title">{editMode ? 'Edit Site Visit' : 'New Site Visit'}</h1></div>
      <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Client *</label>
              <select className="form-select" value={formData.client_id || ''} onChange={e => handleClientChange(e.target.value)} required>
                <option value="">Select Client</option>
                {clients.map(c => (<option key={c.id} value={c.id}>{c.client_name}</option>))}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Visit Date *</label><input type="date" className="form-input" value={formData.visit_date || ''} onChange={e => setFormData({...formData, visit_date: e.target.value})} required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">In Time</label><input type="time" className="form-input" value={formData.visit_time || ''} onChange={e => setFormData({...formData, visit_time: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Out Time</label><input type="time" className="form-input" value={formData.out_time || ''} onChange={e => setFormData({...formData, out_time: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Engineer</label><input type="text" className="form-input" value={formData.engineer_name || ''} onChange={e => setFormData({...formData, engineer_name: e.target.value})} placeholder="Engineer name" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Visited By</label><input type="text" className="form-input" value={formData.visited_by || ''} onChange={e => setFormData({...formData, visited_by: e.target.value})} placeholder="Who visited" /></div>
            <div className="form-group"><label className="form-label">Purpose</label><input type="text" className="form-input" value={formData.purpose_of_visit || ''} onChange={e => setFormData({...formData, purpose_of_visit: e.target.value})} placeholder="Reason for visit" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Site Address</label><input type="text" className="form-input" value={formData.site_address || ''} onChange={e => setFormData({...formData, site_address: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-input" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Google Maps link" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Measurements</label><textarea className="form-textarea" value={formData.measurements || ''} onChange={e => setFormData({...formData, measurements: e.target.value})} rows={2} placeholder="Site measurements" /></div>
            <div className="form-group"><label className="form-label">Discussion</label><textarea className="form-textarea" value={formData.discussion_points || ''} onChange={e => setFormData({...formData, discussion_points: e.target.value})} rows={2} placeholder="Discussion with client" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Follow Up</label><input type="date" className="form-input" value={formData.follow_up_date || ''} onChange={e => setFormData({...formData, follow_up_date: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Next Step</label>
              <select className="form-select" value={formData.next_step || 'Quote to be Sent'} onChange={e => setFormData({...formData, next_step: e.target.value})}>
                <option value="Quote to be Sent">Quote to be Sent</option>
                <option value="Offer Submitted">Offer Submitted</option>
                <option value="Follow up Required">Follow up Required</option>
                <option value="Client Approval Pending">Client Approval Pending</option>
                <option value="Order Pending">Order Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-select" value={formData.status || 'Pending'} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Photos</label><input type="file" className="form-input" accept="image/*" multiple onChange={handlePhotoUpload} disabled={uploading} /></div>
            <div className="form-group"><label className="form-label">Documents</label><input type="file" className="form-input" accept=".pdf,.doc,.docx,.xls,.xlsx" multiple onChange={handleDocumentUpload} disabled={uploading} /></div>
          </div>
          {photos.length > 0 && (<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>{photos.map((p, i) => (<div key={i} style={{ position: 'relative', width: '60px', height: '60px' }}><img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} /><button type="button" onClick={() => removePhoto(i)} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer' }}>×</button></div>))}</div>)}
          {documents.length > 0 && (<div style={{ marginBottom: '12px' }}>{documents.map((d, i) => (<div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#f5f5f5', borderRadius: '4px', marginRight: '8px', marginBottom: '4px' }}><span style={{ fontSize: '12px' }}>{d.document_name}</span><button type="button" onClick={() => removeDocument(i)} style={{ background: 'red', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px' }}>×</button></div>))}</div>)}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editMode ? 'Update' : 'Save')}</button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
