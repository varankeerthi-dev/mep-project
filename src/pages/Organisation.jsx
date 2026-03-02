import { useState, useEffect } from 'react'
import { supabase, getOrganisationMembers, updateUserRole, removeMember, createOrganisation } from '../supabase'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
];

export function OrganisationSettings({ organisation, userId }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [orgDetails, setOrgDetails] = useState({
    name: organisation.name || '',
    address: organisation.address || '',
    phone: organisation.phone || '',
    email: organisation.email || '',
    gstin: organisation.gstin || '',
    pan: organisation.pan || '',
    tan: organisation.tan || '',
    msme_no: organisation.msme_no || '',
    website: organisation.website || '',
    state: organisation.state || 'Maharashtra',
    logo_url: organisation.logo_url || '',
    signatures: organisation.signatures || []
  })
  
  const [newSignature, setNewSignature] = useState({ name: '', url: '' })
  const [uploading, setUploading] = useState(false)

  const uploadImage = async (file, path) => {
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${organisation.id}/${path}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('organisation-assets')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('organisation-assets')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      alert('Error uploading image: ' + error.message)
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (file) {
      const url = await uploadImage(file, 'logos')
      if (url) {
        setOrgDetails(prev => ({ ...prev, logo_url: url }))
      }
    }
  }

  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0]
    if (file) {
      const url = await uploadImage(file, 'signatures')
      if (url) {
        setNewSignature(prev => ({ ...prev, url }))
      }
    }
  }

  const addSignature = () => {
    if (!newSignature.name || !newSignature.url) {
      alert('Please provide a name and upload a signature image')
      return
    }
    const updatedSignatures = [...orgDetails.signatures, { ...newSignature, id: Date.now() }]
    setOrgDetails(prev => ({ ...prev, signatures: updatedSignatures }))
    setNewSignature({ name: '', url: '' })
  }

  const removeSignature = (id) => {
    const updatedSignatures = orgDetails.signatures.filter(s => s.id !== id)
    setOrgDetails(prev => ({ ...prev, signatures: updatedSignatures }))
  }
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    loadMembers()
    checkAdmin()
  }, [organisation.id, userId])

  const checkAdmin = async () => {
    const { data } = await supabase
      .from('org_members')
      .select('role')
      .eq('organisation_id', organisation.id)
      .eq('user_id', userId)
      .single()
    
    setIsAdmin(data?.role === 'admin')
  }

  const loadMembers = async () => {
    setLoading(true)
    const { data, error } = await getOrganisationMembers(organisation.id)
    if (!error) setMembers(data || [])
    setLoading(false)
  }

  const handleUpdateOrg = async () => {
    const { error } = await supabase
      .from('organisations')
      .update(orgDetails)
      .eq('id', organisation.id)
    
    if (!error) {
      alert('Organisation updated successfully!')
    }
  }

  const handleRoleChange = async (memberId, newRole) => {
    await updateUserRole(memberId, newRole)
    loadMembers()
  }

  const handleRemoveMember = async (memberId) => {
    if (confirm('Are you sure you want to remove this member?')) {
      await removeMember(memberId)
      loadMembers()
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Organisation Settings</h1>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Organisation Details</h3>
        
        <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100px', height: '100px', border: '1px dashed #ccc', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
            {orgDetails.logo_url ? (
              <img src={orgDetails.logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '12px', color: '#666' }}>No Logo</span>
            )}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleLogoUpload} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
              disabled={uploading}
            />
          </div>
          <div>
            <button className="btn btn-secondary btn-sm" style={{ position: 'relative' }}>
              {uploading ? 'Uploading...' : 'Upload Logo'}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleLogoUpload} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
                disabled={uploading}
              />
            </button>
            <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>Recommended: PNG/JPG, Square or Horizontal</p>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Organisation Name</label>
            <input
              type="text"
              className="form-input"
              value={orgDetails.name}
              onChange={(e) => setOrgDetails({...orgDetails, name: e.target.value})}
              disabled={!isAdmin}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              type="text"
              className="form-input"
              value={orgDetails.phone}
              onChange={(e) => setOrgDetails({...orgDetails, phone: e.target.value})}
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={orgDetails.email}
              onChange={(e) => setOrgDetails({...orgDetails, email: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">GSTIN</label>
            <input
              type="text"
              className="form-input"
              value={orgDetails.gstin}
              onChange={(e) => setOrgDetails({...orgDetails, gstin: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Organisation State</label>
            <select
              className="form-select"
              value={orgDetails.state}
              onChange={(e) => setOrgDetails({...orgDetails, state: e.target.value})}
              disabled={!isAdmin}
            >
              {INDIAN_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">PAN</label>
            <input
              type="text"
              className="form-input"
              value={orgDetails.pan}
              onChange={(e) => setOrgDetails({...orgDetails, pan: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">TAN</label>
            <input
              type="text"
              className="form-input"
              value={orgDetails.tan}
              onChange={(e) => setOrgDetails({...orgDetails, tan: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">MSME/Udyam No</label>
            <input
              type="text"
              className="form-input"
              value={orgDetails.msme_no}
              onChange={(e) => setOrgDetails({...orgDetails, msme_no: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Website</label>
            <input
              type="text"
              className="form-input"
              value={orgDetails.website}
              onChange={(e) => setOrgDetails({...orgDetails, website: e.target.value})}
            />
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">Address</label>
          <textarea
            className="form-textarea"
            value={orgDetails.address}
            onChange={(e) => setOrgDetails({...orgDetails, address: e.target.value})}
          />
        </div>
        
        {isAdmin && (
          <button onClick={handleUpdateOrg} className="btn btn-primary">
            Save Changes
          </button>
        )}
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3 className="card-title">Authorized Signatories</h3>
        <p style={{ color: '#666', marginBottom: '16px' }}>Add multiple signatures (e.g., CEO, Finance Manager) to choose from when creating documents.</p>
        
        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Signatory Name / Designation</label>
              <input 
                type="text" 
                className="form-input" 
                value={newSignature.name} 
                onChange={(e) => setNewSignature({...newSignature, name: e.target.value})}
                placeholder="e.g. CEO or Sales Engineer"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Signature Image</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" style={{ position: 'relative' }}>
                  {newSignature.url ? 'Change Image' : 'Select Image'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleSignatureUpload} 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  />
                </button>
                {newSignature.url && <span style={{ color: '#10b981', fontSize: '12px' }}>✓ Uploaded</span>}
              </div>
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={addSignature}>Add to List</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgDetails.signatures.map((sig) => (
            <div key={sig.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', background: 'white' }}>
              <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', borderBottom: '1px solid #f3f4f6', pb: '8px' }}>
                <img src={sig.url} alt={sig.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{sig.name}</span>
                <button className="btn btn-sm" style={{ color: '#dc2626', padding: '2px 4px' }} onClick={() => removeSignature(sig.id)}>Remove</button>
              </div>
            </div>
          ))}
          {orgDetails.signatures.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#999', border: '1px dashed #ccc', borderRadius: '8px' }}>
              No signatures added yet.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Team Members</h3>
          {isAdmin && (
            <button onClick={() => setShowInvite(!showInvite)} className="btn btn-primary">
              {showInvite ? 'Cancel' : '+ Invite Member'}
            </button>
          )}
        </div>
        
        {showInvite && (
          <div style={{ padding: '16px', background: '#f8f9fa', marginBottom: '16px' }}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@email.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#666' }}>
              Note: Share this invite manually. The user needs to sign up first, then you can add them from the members list.
            </p>
          </div>
        )}
        
        {loading ? (
          <p>Loading...</p>
        ) : members.length === 0 ? (
          <p>No members found</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: '#3498db',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}>
                          {(member.user?.full_name || member.user?.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{member.user?.full_name || 'Unknown'}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>{member.user?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {isAdmin && member.user_id !== userId ? (
                        <select
                          className="form-select"
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          style={{ width: 'auto' }}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <span style={{ textTransform: 'capitalize' }}>{member.role}</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: member.status === 'active' ? '#d4edda' : '#f8d7da',
                        color: member.status === 'active' ? '#155724' : '#721c24'
                      }}>
                        {member.status}
                      </span>
                    </td>
                    <td>{new Date(member.joined_at).toLocaleDateString()}</td>
                    {isAdmin && (
                      <td>
                        {member.user_id !== userId && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function JoinOrganisation({ userId }) {
  const [orgCode, setOrgCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    setLoading(true)
    setError('')
    
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('id', orgCode)
      .single()
    
    if (!org) {
      setError('Invalid organisation code')
      setLoading(false)
 }
      return
       
    const { error: err } = await supabase
      .from('org_members')
      .insert({
        organisation_id: org.id,
        user_id: userId,
        role: 'member'
      })
    
    if (err) {
      setError(err.message)
    } else {
      alert('Joined organisation successfully!')
    }
    setLoading(false)
  }

  return (
    <div className="card">
      <h3 className="card-title">Join Organisation</h3>
      <p>Enter an organisation code to join an existing team.</p>
      
      {error && <div className="alert alert-error">{error}</div>}
      
      <div className="form-group">
        <label className="form-label">Organisation ID</label>
        <input
          type="text"
          className="form-input"
          value={orgCode}
          onChange={(e) => setOrgCode(e.target.value)}
          placeholder="Enter organisation ID"
        />
      </div>
      
      <button onClick={handleJoin} className="btn btn-primary" disabled={loading}>
        {loading ? 'Joining...' : 'Join Organisation'}
      </button>
    </div>
  )
}
