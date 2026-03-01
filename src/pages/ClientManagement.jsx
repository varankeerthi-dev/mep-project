import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';

function getCurrentQueryParams() {
  const hashQuery = window.location.hash.split('?')[1];
  const searchQuery = window.location.search.slice(1);
  return new URLSearchParams(hashQuery || searchQuery || '');
}

export function CreateClientEdit({ onSuccess, onCancel }) {
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = getCurrentQueryParams();
    const clientId = params.get('id');
    if (clientId) {
      loadClient(clientId);
    }
  }, []);

  const loadClient = async (id) => {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    setClientData(data);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;

  return <CreateClient editMode={true} clientData={clientData} onSuccess={onSuccess} onCancel={onCancel} />;
}

function ClientPricingControl({ formData, setFormData, isAdmin }) {
  const [profiles, setProfiles] = useState([]);
  const [variantSettings, setVariantSettings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('discount_structures').select('*').eq('is_active', true).order('structure_number');
      setProfiles(data || []);
    };
    fetchProfiles();
  }, []);

  useEffect(() => {
    const fetchVariantSettings = async () => {
      if (!formData.discount_profile_id) {
        setVariantSettings([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('discount_variant_settings')
        .select('*, variant:company_variants(variant_name)')
        .eq('structure_id', formData.discount_profile_id);
      setVariantSettings(data || []);
      setLoading(false);
    };
    fetchVariantSettings();
  }, [formData.discount_profile_id]);

  return (
    <div className="pricing-control">
      <div className="form-group" style={{ maxWidth: '400px' }}>
        <label className="form-label">Assigned Discount Profile</label>
        <select 
          className="form-select" 
          value={formData.discount_profile_id || ''} 
          onChange={e => setFormData({...formData, discount_profile_id: e.target.value || null})}
          disabled={!isAdmin}
        >
          <option value="">No Discount Profile assigned</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.structure_name}</option>
          ))}
        </select>
        {!isAdmin && <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Only administrators can change the discount profile.</p>}
      </div>

      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e293b' }}>Profile Preview</h3>
        {!formData.discount_profile_id ? (
          <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
            <p style={{ color: '#64748b' }}>No Discount Profile assigned.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Default %</th>
                  <th>Min %</th>
                  <th>Max %</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px' }}>Loading settings...</td></tr>
                ) : variantSettings.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px' }}>No variant settings found for this profile.</td></tr>
                ) : (
                  variantSettings.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: '500' }}>{s.variant?.variant_name || 'Unknown'}</td>
                      <td>{s.default_discount_percent}%</td>
                      <td>{s.min_discount_percent}%</td>
                      <td>{s.max_discount_percent}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function CreateClient({ onSuccess, onCancel, editMode, clientData }) {
  const { user, organisation, organisations } = useAuth();
  const isAdmin = organisations?.find(o => o.organisation.id === organisation?.id)?.role?.toLowerCase() === 'admin';
  const [activeTab, setActiveTab] = useState('general');

  const [formData, setFormData] = useState(clientData || { 
    client_name: '', address1: '', address2: '', state: '', city: '', pincode: '',
    gstin: '', contact: '', email: '', vendor_no: '', remarks: '', category: 'Active',
    contact_person: '', contact_designation: '', contact_person_email: '',
    contact_person_2: '', contact_designation_2: '', contact_person_2_contact: '', contact_person_2_email: '',
    purchase_person: '', purchase_designation: '', purchase_contact: '', purchase_email: '',
    about_client: '', discount_profile_id: null
  });
  const [gstError, setGstError] = useState('');
  const [shippingAddresses, setShippingAddresses] = useState([]);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [newShipping, setNewShipping] = useState({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '', is_default: false });

  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
  ];

  const gstStateCodes = {
    '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
    '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
    '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
    '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '25': 'Maharashtra', '26': 'Karnataka', '27': 'Goa', '28': 'Lakshadweep',
    '29': 'Kerala', '30': 'Tamil Nadu', '31': 'Puducherry', '32': 'Andaman and Nicobar Islands',
    '33': 'Telangana', '34': 'Andhra Pradesh', '35': 'Ladakh'
  };

  useEffect(() => {
    if (editMode && clientData?.id) {
      loadShippingAddresses(clientData.id);
    }
  }, [editMode, clientData?.id]);

  const loadShippingAddresses = async (clientId) => {
    const { data } = await supabase.from('client_shipping_addresses').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    setShippingAddresses(data || []);
  };

  const handleGstChange = (e) => {
    const value = e.target.value.toUpperCase();
    if (value.length <= 15) {
      setFormData({ ...formData, gstin: value });
      if (value.length >= 2) {
        const stateCode = value.substring(0, 2);
        const detectedState = gstStateCodes[stateCode];
        if (detectedState) setFormData(prev => ({ ...prev, gstin: value, state: detectedState }));
      }
      if (value.length > 0 && value.length < 15) setGstError('GSTIN must be exactly 15 characters');
      else setGstError('');
    }
  };

  const copyBillingToShipping = () => {
    setNewShipping({
      ...newShipping,
      address_line1: formData.address1 || '',
      address_line2: formData.address2 || '',
      city: formData.city || '',
      state: formData.state || '',
      pincode: formData.pincode || ''
    });
    setShowShippingForm(true);
  };

  const addShippingAddress = async () => {
    if (!editMode || !clientData?.id) {
      alert('Please save client first before adding shipping addresses');
      return;
    }
    const { error } = await supabase.from('client_shipping_addresses').insert({
      client_id: clientData.id,
      ...newShipping
    });
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setNewShipping({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '', is_default: false });
      setShowShippingForm(false);
      loadShippingAddresses(clientData.id);
    }
  };

  const deleteShippingAddress = async (id) => {
    if (!confirm('Delete this shipping address?')) return;
    await supabase.from('client_shipping_addresses').delete().eq('id', id);
    loadShippingAddresses(clientData.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.gstin && formData.gstin.length !== 15) {
      alert('GSTIN must be exactly 15 characters');
      return;
    }
    
    if (editMode && clientData?.id) {
      const { error } = await supabase.from('clients').update(formData).eq('id', clientData.id);
      if (error) {
        alert('Error: ' + error.message);
        return;
      }
      alert('Client updated successfully!');
    } else {
      const clientId = 'CLT-' + Date.now().toString().slice(-6);
      const { error } = await supabase.from('clients').insert({ ...formData, client_id: clientId });
      if (error) {
        alert('Error: ' + error.message);
        return;
      }
      alert('Client saved successfully!');
    }
    onSuccess();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{editMode ? 'Edit Client' : 'Create Client'}</h1>
      </div>

      <div className="item-mini-tabs" style={{ marginBottom: '20px' }}>
        <button 
          className={`item-mini-tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General Information
        </button>
        <button 
          className={`item-mini-tab ${activeTab === 'pricing' ? 'active' : ''}`}
          onClick={() => setActiveTab('pricing')}
        >
          Client Pricing Control
        </button>
      </div>

      <div className="card">
        {activeTab === 'general' ? (
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Client Name *</label><input type="text" className="form-input" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required /></div>
              <div className="form-group"><label className="form-label">Category</label><select className="form-select" value={formData.category || 'Active'} onChange={e => setFormData({...formData, category: e.target.value})}><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Prospect">Prospect</option></select></div>
            </div>
            
            {/* Contact Persons Section */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: '#475569' }}>Contact Person 1</div>
              <div className="form-row" style={{ marginBottom: '8px' }}>
                <div className="form-group"><label className="form-label">Contact Person</label><input type="text" className="form-input" value={formData.contact_person || ''} onChange={e => setFormData({...formData, contact_person: e.target.value})} placeholder="Name" /></div>
                <div className="form-group"><label className="form-label">Designation</label><input type="text" className="form-input" value={formData.contact_designation || ''} onChange={e => setFormData({...formData, contact_designation: e.target.value})} placeholder="e.g. Manager" /></div>
                <div className="form-group"><label className="form-label">Phone</label><input type="text" className="form-input" value={formData.contact || ''} onChange={e => setFormData({...formData, contact: e.target.value})} placeholder="Phone" /></div>
                <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={formData.contact_person_email || ''} onChange={e => setFormData({...formData, contact_person_email: e.target.value})} placeholder="email@example.com" /></div>
              </div>
              <div className="form-row" style={{ marginBottom: '8px' }}>
                <div className="form-group"><input type="text" className="form-input" value={formData.contact_person_2 || ''} onChange={e => setFormData({...formData, contact_person_2: e.target.value})} placeholder="Contact Person 2" /></div>
                <div className="form-group"><input type="text" className="form-input" value={formData.contact_designation_2 || ''} onChange={e => setFormData({...formData, contact_designation_2: e.target.value})} placeholder="Designation" /></div>
                <div className="form-group"><input type="text" className="form-input" value={formData.contact_person_2_contact || ''} onChange={e => setFormData({...formData, contact_person_2_contact: e.target.value})} placeholder="Phone" /></div>
                <div className="form-group"><input type="email" className="form-input" value={formData.contact_person_2_email || ''} onChange={e => setFormData({...formData, contact_person_2_email: e.target.value})} placeholder="Email" /></div>
              </div>
              <div className="form-row" style={{ marginBottom: '0' }}>
                <div className="form-group"><input type="text" className="form-input" value={formData.purchase_person || ''} onChange={e => setFormData({...formData, purchase_person: e.target.value})} placeholder="Contact Person 3" /></div>
                <div className="form-group"><input type="text" className="form-input" value={formData.purchase_designation || ''} onChange={e => setFormData({...formData, purchase_designation: e.target.value})} placeholder="Designation" /></div>
                <div className="form-group"><input type="text" className="form-input" value={formData.purchase_contact || ''} onChange={e => setFormData({...formData, purchase_contact: e.target.value})} placeholder="Phone" /></div>
                <div className="form-group"><input type="email" className="form-input" value={formData.purchase_email || ''} onChange={e => setFormData({...formData, purchase_email: e.target.value})} placeholder="Email" /></div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">GST IN</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.gstin || ''} 
                  onChange={handleGstChange}
                  placeholder="15 characters (e.g., 27AABCU9603R1ZM)"
                  maxLength={15}
                />
                {gstError && <span style={{ color: '#dc3545', fontSize: '12px' }}>{gstError}</span>}
              </div>
              <div className="form-group"><label className="form-label">Vendor No</label><input type="text" className="form-input" value={formData.vendor_no} onChange={e => setFormData({...formData, vendor_no: e.target.value})} /></div>
            </div>
            
            {/* Billing & Shipping Address - Split Screen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* Billing Address */}
              <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontWeight: '600', marginBottom: '8px', color: '#166534' }}>Billing Address</div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Address Line 1</label><input type="text" className="form-input" value={formData.address1} onChange={e => setFormData({...formData, address1: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Address Line 2</label><input type="text" className="form-input" value={formData.address2} onChange={e => setFormData({...formData, address2: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select className="form-select" value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})}>
                      <option value="">Select State</option>
                      {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">City</label><input type="text" className="form-input" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Pincode</label><input type="text" className="form-input" value={formData.pincode || ''} onChange={e => setFormData({...formData, pincode: e.target.value})} /></div>
                </div>
              </div>
              
              {/* Shipping Addresses */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: '600', color: '#475569' }}>Shipping Addresses</div>
                  <button type="button" className="btn btn-secondary" onClick={copyBillingToShipping} style={{ whiteSpace: 'nowrap' }}>Copy Billing</button>
                </div>
                
                {shippingAddresses.length > 0 && (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {shippingAddresses.map(addr => (
                      <div key={addr.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>{addr.address_name || 'Address'} {addr.is_default && <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>Default</span>}</div>
                            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>{addr.address_line1} {addr.address_line2}</div>
                            <div style={{ color: '#64748b', fontSize: '12px' }}>{addr.city}, {addr.state} - {addr.pincode}</div>
                          </div>
                          <button type="button" onClick={() => deleteShippingAddress(addr.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {showShippingForm && (
                  <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: '8px', border: '1px solid #bae6fd', marginTop: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#0369a1' }}>Add Shipping Address</div>
                    <div className="form-row">
                      <div className="form-group"><label className="form-label">Address Name</label><input type="text" className="form-input" value={newShipping.address_name} onChange={e => setNewShipping({...newShipping, address_name: e.target.value})} placeholder="e.g. Main Office" /></div>
                      <div className="form-group"><label className="form-label">Contact Person</label><input type="text" className="form-input" value={newShipping.contact} onChange={e => setNewShipping({...newShipping, contact: e.target.value})} /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label className="form-label">Address Line 1</label><input type="text" className="form-input" value={newShipping.address_line1} onChange={e => setNewShipping({...newShipping, address_line1: e.target.value})} /></div>
                      <div className="form-group"><label className="form-label">Address Line 2</label><input type="text" className="form-input" value={newShipping.address_line2} onChange={e => setNewShipping({...newShipping, address_line2: e.target.value})} /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">State</label>
                        <select className="form-select" value={newShipping.state} onChange={e => setNewShipping({...newShipping, state: e.target.value})}>
                          <option value="">Select State</option>
                          {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                        </select>
                      </div>
                      <div className="form-group"><label className="form-label">City</label><input type="text" className="form-input" value={newShipping.city} onChange={e => setNewShipping({...newShipping, city: e.target.value})} /></div>
                      <div className="form-group"><label className="form-label">Pincode</label><input type="text" className="form-input" value={newShipping.pincode} onChange={e => setNewShipping({...newShipping, pincode: e.target.value})} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button type="button" className="btn btn-primary" onClick={addShippingAddress}>Save Address</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowShippingForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                
                {!showShippingForm && shippingAddresses.length === 0 && (
                  <button type="button" className="btn btn-primary" onClick={() => setShowShippingForm(true)} style={{ marginTop: '8px' }}>+ Add Shipping</button>
                )}
              </div>
            </div>
            
            <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">About Client</label><textarea className="form-textarea" value={formData.about_client || ''} onChange={e => setFormData({...formData, about_client: e.target.value})} placeholder="Additional information about the client..." /></div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-primary">{editMode ? 'Update Client' : 'Submit'}</button>
              <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            </div>
          </form>
        ) : (
          <div>
            <ClientPricingControl formData={formData} setFormData={setFormData} isAdmin={isAdmin} />
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>{editMode ? 'Update Pricing Profile' : 'Submit'}</button>
              <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
