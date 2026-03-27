import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../supabase';

function getCurrentQueryParams() {
  const hashQuery = window.location.hash.split('?')[1];
  const searchQuery = window.location.search.slice(1);
  return new URLSearchParams(hashQuery || searchQuery || '');
}

type NavigateFn = (path: string) => void
type WithNavigate = { onNavigate: NavigateFn }
type CreateSubcontractorProps = {
  onSuccess: () => void
  onCancel: () => void
  editMode?: boolean
  subData?: any
}

export function SubcontractorDashboard({ onNavigate }: WithNavigate) {
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { loadData() }, [filter])

  const loadData = async () => {
    let query = supabase.from('subcontractors').select('*').order('created_at', { ascending: false })
    if (filter === 'active') query = query.eq('status', 'Active')
    else if (filter === 'inactive') query = query.eq('status', 'Inactive')
    const { data } = await query
    setSubcontractors(data || [])
  }

  const filtered = subcontractors.filter(s => s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sub-Contractors</h1>
        <button className="btn btn-primary" onClick={() => onNavigate('/subcontractors/new')}>+ Add Sub-Contractor</button>
      </div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>All</button>
          <button className={`btn ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('active')}>Active</button>
          <button className={`btn ${filter === 'inactive' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('inactive')}>Inactive</button>
          <input type="text" className="form-input" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '200px', marginLeft: 'auto' }} />
        </div>
      </div>
      <div className="card">
        {filtered.length === 0 ? <div className="empty-state"><h3>No Sub-Contractors</h3></div> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Company</th><th>Contact Person</th><th>Phone</th><th>Nature of Work</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map(s => (
                <tr key={s.id}>
                  <td>{s.company_name}</td>
                  <td>{s.contact_person || '-'}</td>
                  <td>{s.phone || '-'}</td>
                  <td>{s.nature_of_work || '-'}</td>
                  <td><span style={{ padding: '4px 8px', borderRadius: '4px', background: s.status === 'Active' ? '#d4edda' : '#f8d7da', fontSize: '12px' }}>{s.status}</span></td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => { window.subToView = s; onNavigate('/subcontractors/view?id=' + s.id) }}>View</button>
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

export function CreateSubcontractor({ onSuccess, onCancel, editMode, subData }: CreateSubcontractorProps) {
  const [formData, setFormData] = useState(subData || {
    company_name: '', contact_person: '', phone: '', email: '', address: '', state: '', gstin: '',
    nature_of_work: '', internal_remarks: '', nda_signed: false, contract_signed: false,
    nda_date: '', contract_date: '', status: 'Active'
  })
  const [saving, setSaving] = useState(false)

  const indianStates = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editMode && subData?.id) {
        await supabase.from('subcontractors').update(formData).eq('id', subData.id)
      } else {
        await supabase.from('subcontractors').insert(formData)
      }
      onSuccess()
    } catch (err) { alert('Error: ' + err.message) }
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header"><h1 className="page-title">{editMode ? 'Edit' : 'Add'} Sub-Contractor</h1></div>
      <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Company Name *</label><input type="text" className="form-input" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} required /></div>
            <div className="form-group"><label className="form-label">Contact Person</label><input type="text" className="form-input" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Phone</label><input type="text" className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">State</label><select className="form-select" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})}><option value="">Select</option>{indianStates.map(st => <option key={st} value={st}>{st}</option>)}</select></div>
            <div className="form-group"><label className="form-label">GSTIN</label><input type="text" className="form-input" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value.toUpperCase()})} maxLength={15} /></div>
          </div>
          <div className="form-group"><label className="form-label">Address</label><textarea className="form-textarea" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} rows={2} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Nature of Work</label><input type="text" className="form-input" value={formData.nature_of_work} onChange={e => setFormData({...formData, nature_of_work: e.target.value})} placeholder="e.g., Electrical, Plumbing, HVAC" /></div>
            <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label"><input type="checkbox" checked={formData.nda_signed} onChange={e => setFormData({...formData, nda_signed: e.target.checked})} /> NDA Signed</label><input type="date" className="form-input" value={formData.nda_date} onChange={e => setFormData({...formData, nda_date: e.target.value})} /></div>
            <div className="form-group"><label className="form-label"><input type="checkbox" checked={formData.contract_signed} onChange={e => setFormData({...formData, contract_signed: e.target.checked})} /> Contract Signed</label><input type="date" className="form-input" value={formData.contract_date} onChange={e => setFormData({...formData, contract_date: e.target.value})} /></div>
          </div>
          <div className="form-group"><label className="form-label">Internal Remarks</label><textarea className="form-textarea" value={formData.internal_remarks} onChange={e => setFormData({...formData, internal_remarks: e.target.value})} rows={2} /></div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editMode ? 'Update' : 'Save')}</button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SubcontractorView({ onNavigate }: WithNavigate) {
  const [sub, setSub] = useState(null)
  const [activeTab, setActiveTab] = useState('details')
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [dailyLogs, setDailyLogs] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => {
    const id = getCurrentQueryParams().get('id')
    if (id) {
      supabase.from('subcontractors').select('*').eq('id', id).single().then(({ data }) => setSub(data))
      supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', id).then(({ data }) => setWorkOrders(data || []))
      supabase.from('subcontractor_attendance').select('*').eq('subcontractor_id', id).order('attendance_date', { ascending: false }).then(({ data }) => setAttendance(data || []))
      supabase.from('subcontractor_daily_logs').select('*').eq('subcontractor_id', id).order('log_date', { ascending: false }).then(({ data }) => setDailyLogs(data || []))
      supabase.from('subcontractor_payments').select('*').eq('subcontractor_id', id).order('payment_date', { ascending: false }).then(({ data }) => setPayments(data || []))
      supabase.from('subcontractor_invoices').select('*').eq('subcontractor_id', id).order('invoice_date', { ascending: false }).then(({ data }) => setInvoices(data || []))
    }
  }, [])

  if (!sub) return <div style={{ padding: '20px' }}>Loading...</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{sub.company_name}</h1>
        <button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>← Back</button>
      </div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className={`btn ${activeTab === 'details' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('details')}>Details</button>
          <button className={`btn ${activeTab === 'workorders' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('workorders')}>Work Orders ({workOrders.length})</button>
          <button className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('attendance')}>Attendance ({attendance.length})</button>
          <button className={`btn ${activeTab === 'dailylogs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('dailylogs')}>Daily Logs ({dailyLogs.length})</button>
          <button className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('payments')}>Payments ({payments.length})</button>
          <button className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('invoices')}>Invoices ({invoices.length})</button>
        </div>
      </div>
      <div className="card">
        {activeTab === 'details' && (
          <div>
            <div className="form-row"><div className="form-group"><label className="form-label">Contact Person</label><div>{sub.contact_person || '-'}</div></div><div className="form-group"><label className="form-label">Phone</label><div>{sub.phone || '-'}</div></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">Email</label><div>{sub.email || '-'}</div></div><div className="form-group"><label className="form-label">GSTIN</label><div>{sub.gstin || '-'}</div></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">Nature of Work</label><div>{sub.nature_of_work || '-'}</div></div><div className="form-group"><label className="form-label">State</label><div>{sub.state || '-'}</div></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">Address</label><div>{sub.address || '-'}</div></div><div className="form-group"><label className="form-label">Status</label><span style={{ padding: '4px 8px', borderRadius: '4px', background: sub.status === 'Active' ? '#d4edda' : '#f8d7da' }}>{sub.status}</span></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">NDA Signed</label><div>{sub.nda_signed ? 'Yes' : 'No'} {sub.nda_date && `(${sub.nda_date})`}</div></div><div className="form-group"><label className="form-label">Contract Signed</label><div>{sub.contract_signed ? 'Yes' : 'No'} {sub.contract_date && `(${sub.contract_date})`}</div></div></div>
            <div className="form-group"><label className="form-label">Internal Remarks</label><div>{sub.internal_remarks || '-'}</div></div>
            <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => { window.subToEdit = sub; onNavigate('/subcontractors/edit?id=' + sub.id) }}>Edit</button>
          </div>
        )}
        {activeTab === 'workorders' && (
          <div>{workOrders.length === 0 ? <p>No Work Orders</p> : <table className="table"><thead><tr><th>WO No</th><th>Description</th><th>Start</th><th>End</th><th>Value</th><th>Status</th></tr></thead><tbody>{workOrders.map(wo => <tr key={wo.id}><td>{wo.work_order_no}</td><td>{wo.work_description}</td><td>{wo.start_date}</td><td>{wo.end_date}</td><td>{wo.contract_value}</td><td>{wo.status}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'attendance' && (
          <div>{attendance.length === 0 ? <p>No Attendance Records</p> : <table className="table"><thead><tr><th>Date</th><th>Workers</th><th>Supervisor</th><th>Remarks</th></tr></thead><tbody>{attendance.map(a => <tr key={a.id}><td>{a.attendance_date}</td><td>{a.workers_count}</td><td>{a.supervisor_name}</td><td>{a.remarks}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'dailylogs' && (
          <div>{dailyLogs.length === 0 ? <p>No Daily Logs</p> : <table className="table"><thead><tr><th>Date</th><th>Work Done</th><th>Delays</th><th>Safety</th></tr></thead><tbody>{dailyLogs.map(l => <tr key={l.id}><td>{l.log_date}</td><td>{l.work_done}</td><td>{l.delays}</td><td>{l.safety_incidents}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'payments' && (
          <div>{payments.length === 0 ? <p>No Payments</p> : <table className="table"><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Ref No</th></tr></thead><tbody>{payments.map(p => <tr key={p.id}><td>{p.payment_date}</td><td>₹{p.amount}</td><td>{p.payment_mode}</td><td>{p.reference_no}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'invoices' && (
          <div>{invoices.length === 0 ? <p>No Invoices</p> : <table className="table"><thead><tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{invoices.map(i => <tr key={i.id}><td>{i.invoice_no}</td><td>{i.invoice_date}</td><td>₹{i.amount}</td><td>{i.status}</td></tr>)}</tbody></table>}</div>
        )}
      </div>
    </div>
  )
}

export function SubcontractorEdit({ onNavigate }: WithNavigate) {
  const [sub, setSub] = useState(null)
  useEffect(() => {
    const id = getCurrentQueryParams().get('id')
    if (id) supabase.from('subcontractors').select('*').eq('id', id).single().then(({ data }) => setSub(data))
  }, [])
  if (!sub) return <div>Loading...</div>
  return <CreateSubcontractor onSuccess={() => onNavigate('/subcontractors')} onCancel={() => onNavigate('/subcontractors')} editMode={true} subData={sub} />
}

export function SubcontractorAttendance({ onNavigate }: WithNavigate) {
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [workers, setWorkers] = useState(1)
  const [supervisor, setSupervisor] = useState('')
  const [remarks, setRemarks] = useState('')
  const [records, setRecords] = useState<any[]>([])

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  const saveAttendance = async () => {
    if (!subId) return alert('Select Sub-Contractor')
    await supabase.from('subcontractor_attendance').insert({ subcontractor_id: subId, attendance_date: date, workers_count: workers, supervisor_name: supervisor, remarks })
    alert('Saved!')
    loadRecords()
  }

  const loadRecords = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_attendance').select('*').eq('subcontractor_id', subId).order('attendance_date', { ascending: false })
      setRecords(data || [])
    }
  }

  useEffect(() => { if (subId) loadRecords() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Daily Attendance</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">No. of Workers</label><input type="number" className="form-input" value={workers} onChange={e => setWorkers(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Supervisor</label><input type="text" className="form-input" value={supervisor} onChange={e => setSupervisor(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={saveAttendance}>Save Attendance</button>
      </div>
      <div className="card">
        <h3>Attendance Records</h3>
        {records.length === 0 ? <p>No records</p> : <table className="table"><thead><tr><th>Date</th><th>Workers</th><th>Supervisor</th><th>Remarks</th></tr></thead><tbody>{records.map(r => <tr key={r.id}><td>{r.attendance_date}</td><td>{r.workers_count}</td><td>{r.supervisor_name}</td><td>{r.remarks}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

export function SubcontractorWorkOrders({ onNavigate }: WithNavigate) {
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [woNo, setWoNo] = useState('')
  const [desc, setDesc] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [value, setValue] = useState('')
  const [workOrders, setWorkOrders] = useState<any[]>([])

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  const saveWO = async () => {
    if (!subId || !woNo) return alert('Required fields missing')
    await supabase.from('subcontractor_work_orders').insert({ subcontractor_id: subId, work_order_no: woNo, work_description: desc, start_date: startDate, end_date: endDate, contract_value: value, status: 'Pending' })
    alert('Saved!')
    loadWOs()
  }

  const loadWOs = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', subId).order('created_at', { ascending: false })
      setWorkOrders(data || [])
    }
  }

  useEffect(() => { if (subId) loadWOs() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Work Orders</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">WO Number *</label><input type="text" className="form-input" value={woNo} onChange={e => setWoNo(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Work Description</label><textarea className="form-textarea" value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Start Date</label><input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">End Date</label><input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Contract Value</label><input type="number" className="form-input" value={value} onChange={e => setValue(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" onClick={saveWO}>Save Work Order</button>
      </div>
      <div className="card">
        {workOrders.length === 0 ? <p>No Work Orders</p> : <table className="table"><thead><tr><th>WO No</th><th>Description</th><th>Start</th><th>End</th><th>Value</th><th>Status</th></tr></thead><tbody>{workOrders.map(wo => <tr key={wo.id}><td>{wo.work_order_no}</td><td>{wo.work_description}</td><td>{wo.start_date}</td><td>{wo.end_date}</td><td>₹{wo.contract_value}</td><td>{wo.status}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

export function SubcontractorDailyLogs({ onNavigate }: WithNavigate) {
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [woId, setWoId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [workDone, setWorkDone] = useState('')
  const [delays, setDelays] = useState('')
  const [safety, setSafety] = useState('')
  const [workers, setWorkers] = useState(1)
  const [remarks, setRemarks] = useState('')
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  useEffect(() => { if (subId) supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', subId).then(({ data }) => setWorkOrders(data || [])) }, [subId])

  const saveLog = async () => {
    if (!subId || !date) return alert('Required')
    await supabase.from('subcontractor_daily_logs').insert({ subcontractor_id: subId, work_order_id: woId || null, log_date: date, work_done: workDone, delays: delays, safety_incidents: safety, workers_count: workers, remarks })
    alert('Saved!')
    loadLogs()
  }

  const loadLogs = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_daily_logs').select('*').eq('subcontractor_id', subId).order('log_date', { ascending: false })
      setLogs(data || [])
    }
  }

  useEffect(() => { if (subId) loadLogs() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Daily Logs</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Work Order</label><select className="form-select" value={woId} onChange={e => setWoId(e.target.value)}><option value="">Select</option>{workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.work_order_no}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Workers Count</label><input type="number" className="form-input" value={workers} onChange={e => setWorkers(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Work Done</label><input type="text" className="form-input" value={workDone} onChange={e => setWorkDone(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Delays/Issues</label><input type="text" className="form-input" value={delays} onChange={e => setDelays(e.target.value)} placeholder="Any delays or issues" /></div>
          <div className="form-group"><label className="form-label">Safety Incidents</label><input type="text" className="form-input" value={safety} onChange={e => setSafety(e.target.value)} placeholder="Any safety incidents" /></div>
        </div>
        <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={saveLog}>Save Log</button>
      </div>
      <div className="card">
        {logs.length === 0 ? <p>No Logs</p> : <table className="table"><thead><tr><th>Date</th><th>Work Done</th><th>Delays</th><th>Safety</th><th>Workers</th></tr></thead><tbody>{logs.map(l => <tr key={l.id}><td>{l.log_date}</td><td>{l.work_done}</td><td>{l.delays}</td><td>{l.safety_incidents}</td><td>{l.workers_count}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

export function SubcontractorPayments({ onNavigate }: WithNavigate) {
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [mode, setMode] = useState('Cash')
  const [refNo, setRefNo] = useState('')
  const [desc, setDesc] = useState('')
  const [payments, setPayments] = useState<any[]>([])

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  const savePayment = async () => {
    if (!subId || !amount) return alert('Required')
    await supabase.from('subcontractor_payments').insert({ subcontractor_id: subId, amount, payment_date: date, payment_mode: mode, reference_no: refNo, description: desc })
    alert('Saved!')
    loadPayments()
  }

  const loadPayments = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_payments').select('*').eq('subcontractor_id', subId).order('payment_date', { ascending: false })
      setPayments(data || [])
    }
  }

  useEffect(() => { if (subId) loadPayments() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Payments</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Amount</label><input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Payment Mode</label><select className="form-select" value={mode} onChange={e => setMode(e.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>UPI</option></select></div>
          <div className="form-group"><label className="form-label">Ref No</label><input type="text" className="form-input" value={refNo} onChange={e => setRefNo(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={savePayment}>Save Payment</button>
      </div>
      <div className="card">
        {payments.length === 0 ? <p>No Payments</p> : <table className="table"><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Ref No</th><th>Description</th></tr></thead><tbody>{payments.map(p => <tr key={p.id}><td>{p.payment_date}</td><td>₹{p.amount}</td><td>{p.payment_mode}</td><td>{p.reference_no}</td><td>{p.description}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

export function SubcontractorInvoices({ onNavigate }: WithNavigate) {
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [woId, setWoId] = useState('')
  const [invNo, setInvNo] = useState('')
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  useEffect(() => { if (subId) supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', subId).then(({ data }) => setWorkOrders(data || [])) }, [subId])

  const saveInvoice = async () => {
    if (!subId || !invNo || !amount) return alert('Required')
    await supabase.from('subcontractor_invoices').insert({ subcontractor_id: subId, work_order_id: woId || null, invoice_no: invNo, invoice_date: invDate, amount, status: 'Pending', remarks })
    alert('Saved!')
    loadInvoices()
  }

  const loadInvoices = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_invoices').select('*').eq('subcontractor_id', subId).order('invoice_date', { ascending: false })
      setInvoices(data || [])
    }
  }

  useEffect(() => { if (subId) loadInvoices() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Invoices</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Invoice No *</label><input type="text" className="form-input" value={invNo} onChange={e => setInvNo(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={invDate} onChange={e => setInvDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Work Order</label><select className="form-select" value={woId} onChange={e => setWoId(e.target.value)}><option value="">Select</option>{workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.work_order_no}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Amount</label><input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={saveInvoice}>Save Invoice</button>
      </div>
      <div className="card">
        {invoices.length === 0 ? <p>No Invoices</p> : <table className="table"><thead><tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{invoices.map(i => <tr key={i.id}><td>{i.invoice_no}</td><td>{i.invoice_date}</td><td>₹{i.amount}</td><td>{i.status}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

export function SubcontractorDocuments({ onNavigate }: WithNavigate) {
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [documents, setDocuments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[]
    if (!subId) return alert('Select Sub-Contractor first')
    setUploading(true)
    
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const fileName = `sub_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        
        const { data, error } = await supabase.storage
          .from('subcontractor-documents')
          .upload(fileName, uint8Array, { contentType: file.type })
        
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('subcontractor-documents').getPublicUrl(fileName)
          await supabase.from('subcontractor_documents').insert({
            subcontractor_id: subId,
            document_name: file.name,
            document_url: urlData.publicUrl,
            document_type: file.type
          })
        }
      } catch (err: any) {
        console.log('Upload error:', err?.message || err)
      }
    }
    setUploading(false)
    loadDocuments()
  }

  const loadDocuments = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_documents').select('*').eq('subcontractor_id', subId).order('created_at', { ascending: false })
      setDocuments(data || [])
    }
  }

  useEffect(() => { if (subId) loadDocuments() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Documents</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-group">
          <label className="form-label">Select Sub-Contractor</label>
          <select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}>
            <option value="">Select</option>
            {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Upload Documents</label>
          <input type="file" className="form-input" multiple onChange={handleUpload} disabled={uploading} />
        </div>
        {uploading && <p>Uploading...</p>}
      </div>
      <div className="card">
        {documents.length === 0 ? <p>No Documents</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {documents.map(doc => (
              <div key={doc.id} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
                <div style={{ fontWeight: '500', marginBottom: '8px', wordBreak: 'break-word' }}>{doc.document_name}</div>
                <a href={doc.document_url} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', fontSize: '13px' }}>View Document</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


