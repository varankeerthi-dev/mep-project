import { useState, useEffect } from 'react'
import { supabase, getOrganisationMembers, updateUserRole, removeMember, createOrganisation } from '../supabase'

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
    gstin: organisation.gstin || ''
  })
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
