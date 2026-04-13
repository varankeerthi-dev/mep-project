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

function generateFyOptions(format: string, startMonth: number): string[] {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  
  for (let i = -2; i <= 3; i++) {
    const year = currentYear + i;
    const nextYear = year + 1;
    const yearStr = year.toString();
    const nextYearStr = nextYear.toString().slice(-2);
    
    let fy: string;
    switch (format) {
      case 'FY24-25':
        fy = `FY${yearStr.slice(-2)}-${nextYearStr}`;
        break;
      case 'FY2024-25':
        fy = `FY${yearStr}-${nextYearStr}`;
        break;
      case '2024_25':
        fy = `${yearStr}_${nextYearStr}`;
        break;
      default:
        fy = `${yearStr}-${nextYearStr}`;
    }
    options.push(fy);
  }
  
  return options;
}

function DocumentNumberingSettings() {
  const [settings, setSettings] = useState({
    dc_prefix: 'DC',
    dc_suffix: '',
    dc_padding: '5',
    quotation_prefix: 'QT',
    quotation_suffix: '',
    quotation_padding: '5',
    invoice_prefix: 'INV',
    invoice_suffix: '',
    invoice_padding: '5'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('settings').select('key, value');
      if (data) {
        const settingsMap = {};
        data.forEach(s => { settingsMap[s.key] = s.value; });
        setSettings(prev => ({
          ...prev,
          dc_prefix: settingsMap.dc_prefix || 'DC',
          dc_suffix: settingsMap.dc_suffix || '',
          dc_padding: settingsMap.dc_padding || '5',
          quotation_prefix: settingsMap.quotation_prefix || 'QT',
          quotation_suffix: settingsMap.quotation_suffix || '',
          quotation_padding: settingsMap.quotation_padding || '5',
          invoice_prefix: settingsMap.invoice_prefix || 'INV',
          invoice_suffix: settingsMap.invoice_suffix || '',
          invoice_padding: settingsMap.invoice_padding || '5'
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsToSave = [
        { key: 'dc_prefix', value: settings.dc_prefix },
        { key: 'dc_suffix', value: settings.dc_suffix },
        { key: 'dc_padding', value: settings.dc_padding },
        { key: 'quotation_prefix', value: settings.quotation_prefix },
        { key: 'quotation_suffix', value: settings.quotation_suffix },
        { key: 'quotation_padding', value: settings.quotation_padding },
        { key: 'invoice_prefix', value: settings.invoice_prefix },
        { key: 'invoice_suffix', value: settings.invoice_suffix },
        { key: 'invoice_padding', value: settings.invoice_padding }
      ];

      for (const setting of settingsToSave) {
        await supabase.from('settings').upsert({ key: setting.key, value: setting.value }, { onConflict: 'key' });
      }
      
      alert('Document numbering settings saved!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading settings...</div>;
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {/* DC Settings */}
        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#374151' }}>Delivery Challan</h4>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Prefix</label>
            <input
              type="text"
              className="form-input"
              value={settings.dc_prefix}
              onChange={(e) => setSettings({ ...settings, dc_prefix: e.target.value })}
              placeholder="DC"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Suffix</label>
            <input
              type="text"
              className="form-input"
              value={settings.dc_suffix}
              onChange={(e) => setSettings({ ...settings, dc_suffix: e.target.value })}
              placeholder=""
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Number Padding</label>
            <select
              className="form-select"
              value={settings.dc_padding}
              onChange={(e) => setSettings({ ...settings, dc_padding: e.target.value })}
            >
              <option value="3">3 digits (001)</option>
              <option value="4">4 digits (0001)</option>
              <option value="5">5 digits (00001)</option>
              <option value="6">6 digits (000001)</option>
            </select>
          </div>
        </div>

        {/* Quotation Settings */}
        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#374151' }}>Quotation</h4>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Prefix</label>
            <input
              type="text"
              className="form-input"
              value={settings.quotation_prefix}
              onChange={(e) => setSettings({ ...settings, quotation_prefix: e.target.value })}
              placeholder="QT"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Suffix</label>
            <input
              type="text"
              className="form-input"
              value={settings.quotation_suffix}
              onChange={(e) => setSettings({ ...settings, quotation_suffix: e.target.value })}
              placeholder=""
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Number Padding</label>
            <select
              className="form-select"
              value={settings.quotation_padding}
              onChange={(e) => setSettings({ ...settings, quotation_padding: e.target.value })}
            >
              <option value="3">3 digits (001)</option>
              <option value="4">4 digits (0001)</option>
              <option value="5">5 digits (00001)</option>
              <option value="6">6 digits (000001)</option>
            </select>
          </div>
        </div>

        {/* Invoice Settings */}
        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#374151' }}>Invoice</h4>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Prefix</label>
            <input
              type="text"
              className="form-input"
              value={settings.invoice_prefix}
              onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
              placeholder="INV"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Suffix</label>
            <input
              type="text"
              className="form-input"
              value={settings.invoice_suffix}
              onChange={(e) => setSettings({ ...settings, invoice_suffix: e.target.value })}
              placeholder=""
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Number Padding</label>
            <select
              className="form-select"
              value={settings.invoice_padding}
              onChange={(e) => setSettings({ ...settings, invoice_padding: e.target.value })}
            >
              <option value="3">3 digits (001)</option>
              <option value="4">4 digits (0001)</option>
              <option value="5">5 digits (00001)</option>
              <option value="6">6 digits (000001)</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Numbering Settings'}
        </button>
      </div>
    </div>
  );
}

export function OrganisationSettings({ organisation, userId }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [orgDetails, setOrgDetails] = useState({
    name: organisation?.name || '',
    address: organisation?.address || '',
    phone: organisation?.phone || '',
    email: organisation?.email || '',
    gstin: organisation?.gstin || '',
    pan: organisation?.pan || '',
    tan: organisation?.tan || '',
    msme_no: organisation?.msme_no || '',
    website: organisation?.website || '',
    state: organisation?.state || 'Maharashtra',
    logo_url: organisation?.logo_url || '',
    signatures: organisation?.signatures || [],
    allow_access_requests: organisation?.allow_access_requests ?? true,
    is_listed: organisation?.is_listed ?? false,
    financial_year_format: organisation?.financial_year_format || 'FY24-25',
    financial_year_start_month: organisation?.financial_year_start_month ?? 4,
    current_financial_year: organisation?.current_financial_year || 'FY24-25'
  })

  useEffect(() => {
    if (!organisation) return;
    setOrgDetails({
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
      signatures: organisation.signatures || [],
      allow_access_requests: organisation.allow_access_requests ?? true,
      is_listed: organisation.is_listed ?? false,
      financial_year_format: organisation.financial_year_format || 'FY24-25',
      financial_year_start_month: organisation.financial_year_start_month ?? 4,
      current_financial_year: organisation.current_financial_year || 'FY24-25'
    })
  }, [organisation])
  
  const [newSignature, setNewSignature] = useState({ name: '', url: '' })
  const [uploading, setUploading] = useState(false)

  const uploadImage = async (file, path) => {
    if (!organisation?.id) {
      alert('Organisation not loaded yet');
      return null;
    }
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${organisation.id}/${path}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('organisation-assets')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        // Try creating the bucket first
        const { error: bucketError } = await supabase.storage.createBucket('organisation-assets', {
          public: true,
          fileSizeLimit: 5242880,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
        })
        
        if (!bucketError || bucketError.message.includes('already exists')) {
          // Retry upload
          const { error: retryError } = await supabase.storage
            .from('organisation-assets')
            .upload(filePath, file)
          
          if (retryError) {
            alert('Error uploading image: ' + retryError.message)
            return null
          }
        } else {
          alert('Error creating storage bucket: ' + bucketError.message)
          return null
        }
      }

      const { data: { publicUrl } } = supabase.storage
        .from('organisation-assets')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
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
    if (!organisation?.id || !userId) return;
    loadMembers()
    checkAdmin()
  }, [organisation?.id, userId])

  const checkAdmin = async () => {
    if (!organisation?.id || !userId) return;
    const { data } = await supabase
      .from('org_members')
      .select('role')
      .eq('organisation_id', organisation.id)
      .eq('user_id', userId)
      .single()
    
    setIsAdmin(data?.role === 'admin')
  }

  const loadMembers = async () => {
    if (!organisation?.id) return;
    setLoading(true)
    const { data, error } = await getOrganisationMembers(organisation.id)
    if (!error) setMembers(data || [])
    setLoading(false)
  }

  const handleUpdateOrg = async () => {
    if (!organisation?.id) {
      alert('Organisation not loaded yet');
      return;
    }
    try {
      console.log('Updating organisation with:', orgDetails);
      const { data, error } = await supabase
        .from('organisations')
        .update({
          name: orgDetails.name,
          address: orgDetails.address,
          phone: orgDetails.phone,
          email: orgDetails.email,
          gstin: orgDetails.gstin,
          pan: orgDetails.pan,
          tan: orgDetails.tan,
          msme_no: orgDetails.msme_no,
          website: orgDetails.website,
          state: orgDetails.state,
          logo_url: orgDetails.logo_url,
          signatures: orgDetails.signatures,
          allow_access_requests: orgDetails.allow_access_requests,
          is_listed: orgDetails.is_listed,
          financial_year_format: orgDetails.financial_year_format,
          financial_year_start_month: orgDetails.financial_year_start_month,
          current_financial_year: orgDetails.current_financial_year,
          updated_at: new Date().toISOString()
        })
        .eq('id', organisation.id)
        .select()
      
      console.log('Update response:', { data, error });
       
      if (error) {
        console.error('Update error:', error);
        alert('Error updating organisation: ' + error.message)
      } else {
        alert('Organisation updated successfully!')
        if (data && data[0]) {
          setOrgDetails(data[0])
        }
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error: ' + err.message)
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
              <img src={orgDetails.logo_url} alt="Logo" width={100} height={100} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} fetchPriority="high" />
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

        <div style={{ marginTop: '20px', padding: '14px', border: '1px solid #e5e7eb', borderRadius: '10px', background: '#fafafa' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Access Requests</div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px', lineHeight: 1.5 }}>
            This controls whether employees can request Google-login access. Only emails present in the Employees list can submit a request.
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: isAdmin ? 'pointer' : 'not-allowed', opacity: isAdmin ? 1 : 0.6 }}>
              <input
                type="checkbox"
                checked={Boolean(orgDetails.allow_access_requests)}
                disabled={!isAdmin}
                onChange={(e) => setOrgDetails({ ...orgDetails, allow_access_requests: e.target.checked })}
                style={{ marginTop: '3px' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Allow access requests</div>
                <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.5 }}>
                  Users can request access (admins approve in Settings &rarr; Access Control).
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: isAdmin ? 'pointer' : 'not-allowed', opacity: isAdmin ? 1 : 0.6 }}>
              <input
                type="checkbox"
                checked={Boolean(orgDetails.is_listed)}
                disabled={!isAdmin}
                onChange={(e) => setOrgDetails({ ...orgDetails, is_listed: e.target.checked })}
                style={{ marginTop: '3px' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Show in organisation list</div>
                <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.5 }}>
                  Makes this organisation appear on the Request access page dropdown.
                </div>
              </div>
            </label>
          </div>
        </div>
        
        {isAdmin && (
          <button onClick={handleUpdateOrg} className="btn btn-primary">
            Save Changes
          </button>
        )}
      </div>

      {/* Document Numbering Settings */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h3 className="card-title">Document Numbering</h3>
        <p style={{ color: '#666', marginBottom: '16px' }}>Configure how document numbers are generated automatically.</p>
        
        <DocumentNumberingSettings />
      </div>

      {/* Financial Year Settings */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h3 className="card-title">Financial Year Settings</h3>
        <p style={{ color: '#666', marginBottom: '16px' }}>Configure how financial years are defined for ledger and reporting. This affects opening balance calculations.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">FY Format</label>
            <select
              className="form-select"
              value={orgDetails.financial_year_format}
              onChange={(e) => setOrgDetails({ ...orgDetails, financial_year_format: e.target.value })}
              disabled={!isAdmin}
            >
              <option value="FY24-25">FY24-25 (e.g., FY24-25)</option>
              <option value="FY2024-25">FY2024-25 (e.g., FY2024-25)</option>
              <option value="2024-25">2024-25 (e.g., 2024-25)</option>
              <option value="2024_25">2024_25 (e.g., 2024_25)</option>
            </select>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Format for displaying financial year in reports</p>
          </div>

          <div className="form-group">
            <label className="form-label">FY Start Month</label>
            <select
              className="form-select"
              value={orgDetails.financial_year_start_month}
              onChange={(e) => setOrgDetails({ ...orgDetails, financial_year_start_month: parseInt(e.target.value) })}
              disabled={!isAdmin}
            >
              <option value={1}>January (Calendar Year)</option>
              <option value={4}>April (Indian FY)</option>
            </select>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
              {orgDetails.financial_year_start_month === 1 
                ? 'Jan 2024 - Dec 2024'
                : 'Apr 2024 - Mar 2025'
              }
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Current Financial Year</label>
            <select
              className="form-select"
              value={orgDetails.current_financial_year}
              onChange={(e) => setOrgDetails({ ...orgDetails, current_financial_year: e.target.value })}
              disabled={!isAdmin}
            >
              {generateFyOptions(orgDetails.financial_year_format, orgDetails.financial_year_start_month).map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Active FY used in ledger calculations</p>
          </div>
        </div>

        {isAdmin && (
          <div style={{ marginTop: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
            <p style={{ fontSize: '12px', color: '#0369a1', margin: 0 }}>
              <strong>Note:</strong> Opening balances are calculated based on these settings. Changing FY settings after data entry may affect ledger reports.
            </p>
          </div>
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
              <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', borderBottom: '1px solid #f3f4f6' }}>
                <img src={sig.url} alt={sig.name} width={150} height={60} loading="lazy" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
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


