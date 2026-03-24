import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';

function getCurrentQueryParams() {
  const hashQuery = window.location.hash.split('?')[1];
  const searchQuery = window.location.search.slice(1);
  return new URLSearchParams(hashQuery || searchQuery || '');
}

export function CreateClientEdit({ onSuccess, onCancel }) {
  const params = getCurrentQueryParams();
  const clientId = params.get('id');

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId
  });

  if (clientQuery.isLoading) return <div>Loading...</div>;
  if (clientQuery.isError) return <div>Error loading client.</div>;

  return <CreateClient editMode={true} clientData={clientQuery.data} onSuccess={onSuccess} onCancel={onCancel} />;
}

function ClientDiscountPortfolio({ formData, setFormData, isAdmin }) {
  const [customDiscounts, setCustomDiscounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });

  const pricelistsQuery = useQuery({
    queryKey: ['discountPricelists'],
    queryFn: async () => {
      const { data, error } = await supabase.from('standard_discount_pricelists').select('*').eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000
  });

  const structuresQuery = useQuery({
    queryKey: ['discountStructures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_structures')
        .select('*')
        .eq('is_active', true)
        .neq('structure_name', 'Standard');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000
  });

  const variantsQuery = useQuery({
    queryKey: ['companyVariants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_variants')
        .select('*')
        .eq('is_active', true)
        .order('variant_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000
  });

  const pricelists = pricelistsQuery.data || [];
  const structures = structuresQuery.data || [];
  const variants = variantsQuery.data || [];

  useEffect(() => {
    if (formData.custom_discounts && typeof formData.custom_discounts === 'object') {
      setCustomDiscounts(formData.custom_discounts);
    } else {
      setCustomDiscounts({});
    }
  }, [formData.custom_discounts]);

  const selectedStructureId = useMemo(() => {
    if (formData.discount_type === 'Standard' || !formData.discount_type) return null;
    const struct = structures.find(s => s.structure_name === formData.discount_type);
    return struct?.id || null;
  }, [formData.discount_type, structures]);

  const previewQuery = useQuery({
    queryKey: ['discountVariantSettings', selectedStructureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_variant_settings')
        .select('*, variant:company_variants(variant_name)')
        .eq('structure_id', selectedStructureId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedStructureId
  });

  const previewSettings = previewQuery.data || [];
  const loading = previewQuery.isFetching;

  const handleCustomDiscountChange = (variantId, value) => {
    setCustomDiscounts(prev => ({
      ...prev,
      [variantId]: parseFloat(value) || 0
    }));
  };

  const handleSaveCustomDiscounts = async () => {
    if (!formData.id) {
      setSaveMessage({ type: 'error', text: 'Please save the client first before saving discounts.' });
      return;
    }
    setSaving(true);
    setSaveMessage({ type: '', text: '' });
    try {
      const { error } = await supabase
        .from('clients')
        .update({ custom_discounts: customDiscounts })
        .eq('id', formData.id);
      
      if (error) throw error;
      
      setFormData(prev => ({ ...prev, custom_discounts: customDiscounts }));
      setSaveMessage({ type: 'success', text: 'Discounts saved successfully!' });
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Error saving discounts: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pricing-control">
      <div className="card" style={{ maxWidth: '600px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Discount Portfolio</h3>
        <div className="form-group">
          <label className="form-label">Discount Type *</label>
          <select 
            className="form-select" 
            value={formData.discount_type || 'Special'} 
            onChange={e => setFormData({...formData, discount_type: e.target.value, standard_pricelist_id: e.target.value === 'Standard' ? formData.standard_pricelist_id : null})}
            disabled={!isAdmin}
          >
            <option value="Standard">Standard (Price List Based)</option>
            <option value="Premium">Premium (Variant Based)</option>
            <option value="Bulk">Bulk (Variant Based)</option>
            <option value="Special">Special (Variant Based)</option>
          </select>
        </div>

        {formData.discount_type === 'Standard' && (
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label">Select Standard Price List *</label>
            <select 
              className="form-select" 
              value={formData.standard_pricelist_id || ''} 
              onChange={e => setFormData({...formData, standard_pricelist_id: e.target.value})}
              required
              disabled={!isAdmin}
            >
              <option value="">-- Select Price List --</option>
              {pricelists.map(pl => (
                <option key={pl.id} value={pl.id}>{pl.pricelist_name} ({pl.discount_percent}%)</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Custom Discounts Section */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', margin: 0 }}>Custom Discounts (Per Variant)</h3>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleSaveCustomDiscounts}
            disabled={saving || !formData.id}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            {saving ? 'Saving...' : 'Save Discounts'}
          </button>
        </div>
        
        {saveMessage.text && (
          <div style={{ 
            padding: '8px 12px', 
            marginBottom: '12px', 
            borderRadius: '4px', 
            fontSize: '12px',
            background: saveMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: saveMessage.type === 'success' ? '#166534' : '#dc2626'
          }}>
            {saveMessage.text}
          </div>
        )}

        <div className="table-container" style={{ maxHeight: '200px', overflow: 'auto' }}>
          <table className="table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ width: '60%' }}>Variant</th>
                <th style={{ width: '40%' }}>Discount %</th>
              </tr>
            </thead>
            <tbody>
              {variants.length === 0 ? (
                <tr><td colSpan="2" style={{ textAlign: 'center' }}>No variants found</td></tr>
              ) : (
                variants.map(v => (
                  <tr key={v.id}>
                    <td>{v.variant_name}</td>
                    <td>
                      <input 
                        type="number" 
                        className="form-input" 
                        style={{ width: '80px', textAlign: 'right', padding: '4px 8px', fontSize: '12px' }}
                        value={customDiscounts[v.id] || 0}
                        onChange={(e) => handleCustomDiscountChange(v.id, e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Portfolio Preview</h3>
        {formData.discount_type === 'Standard' ? (
          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
            <p style={{ fontSize: '13px', margin: 0 }}>
              <strong>Standard Discount:</strong> {pricelists.find(pl => pl.id === formData.standard_pricelist_id)?.discount_percent || 0}% flat on all items.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table" style={{ fontSize: '12px' }}>
              <thead><tr><th style={{ width: '40%' }}>Variant</th><th style={{ width: '20%' }}>Default %</th><th style={{ width: '20%' }}>Min %</th><th style={{ width: '20%' }}>Max %</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="4" style={{ textAlign: 'center' }}>Loading...</td></tr> : 
                 previewSettings.length === 0 ? <tr><td colSpan="4" style={{ textAlign: 'center' }}>No settings found.</td></tr> :
                 previewSettings.map(s => (
                  <tr key={s.id}>
                    <td>{s.variant?.variant_name}</td>
                    <td>{s.default_discount_percent}%</td>
                    <td>{s.min_discount_percent}%</td>
                    <td>{s.max_discount_percent}%</td>
                  </tr>
                ))
                }
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
  const queryClient = useQueryClient();
  const isAdmin = organisations?.find(o => o.organisation.id === organisation?.id)?.role?.toLowerCase() === 'admin';
  const [activeTab, setActiveTab] = useState('general');

  const [formData, setFormData] = useState({ 
    client_name: '', address1: '', address2: '', state: '', city: '', pincode: '',
    gstin: '', contact: '', email: '', vendor_no: '', remarks: '', category: 'Active',
    contact_person: '', contact_designation: '', contact_person_email: '',
    contact_person_2: '', contact_designation_2: '', contact_person_2_contact: '', contact_person_2_email: '',
    purchase_person: '', purchase_designation: '', purchase_contact: '', purchase_email: '',
    about_client: '', discount_type: 'Special', standard_pricelist_id: null
  });
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clientData) {
      setFormData(clientData);
      setTimeout(() => setIsDirty(false), 100);
    }
  }, [clientData]);

  useEffect(() => {
    if (formData.client_name) {
      setIsDirty(true);
    }
  }, [formData]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && !saving) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, saving]);

  const [gstError, setGstError] = useState('');
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

  const shippingQuery = useQuery({
    queryKey: ['clientShipping', clientData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_shipping_addresses')
        .select('*')
        .eq('client_id', clientData?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: editMode && !!clientData?.id
  });

  const shippingAddresses = shippingQuery.data || [];

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
      queryClient.invalidateQueries({ queryKey: ['clientShipping', clientData.id] });
    }
  };

  const deleteShippingAddress = async (id) => {
    if (!confirm('Delete this shipping address?')) return;
    await supabase.from('client_shipping_addresses').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['clientShipping', clientData.id] });
  };

  const deleteClient = async () => {
    if (!editMode || !clientData?.id) return;
    if (!confirm(`Are you sure you want to delete client "${formData.client_name}"? This action cannot be undone.`)) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientData.id);
      if (error) throw error;
      alert('Client deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsDirty(false);
      onCancel();
    } catch (err) {
      alert('Error deleting client: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (formData.gstin && formData.gstin.length !== 15) {
      alert('GSTIN must be exactly 15 characters');
      return;
    }
    setSaving(true);
    try {
      if (editMode && clientData?.id) {
        const { error } = await supabase.from('clients').update(formData).eq('id', clientData.id);
        if (error) throw error;
        alert('Client updated successfully!');
      } else {
        const clientId = 'CLT-' + Date.now().toString().slice(-6);
        const { error } = await supabase.from('clients').insert({ ...formData, client_id: clientId });
        if (error) throw error;
        alert('Client saved successfully!');
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsDirty(false);
      onSuccess();
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Header - Shadcn Style */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
            {editMode ? 'Edit Client' : 'Create Client'}
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            {editMode ? 'Update client information and settings' : 'Add a new client to your organization'}
          </p>
        </div>

        {/* Tabs - Shadcn Style */}
        <div style={{ 
          display: 'inline-flex', 
          gap: '4px', 
          padding: '4px',
          background: '#f1f5f9',
          borderRadius: '10px', 
          marginBottom: '24px',
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => setActiveTab('general')}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'general' ? '#ffffff' : 'transparent',
              color: activeTab === 'general' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'general' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            General Information
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'pricing' ? '#ffffff' : 'transparent',
              color: activeTab === 'pricing' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'pricing' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Client Pricing Control
          </button>
        </div>

        {/* Main Card - Shadcn Style */}
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          {activeTab === 'general' ? (
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Client Name *</label><input type="text" className="form-input" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Category</label><select className="form-select" value={formData.category || 'Active'} onChange={e => setFormData({...formData, category: e.target.value})}><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Prospect">Prospect</option></select></div>
              </div>
              
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
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{editMode ? 'Update Client' : 'Submit'}</button>
                {editMode && (
                  <button type="button" className="btn btn-danger" onClick={deleteClient} disabled={saving} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
                    Delete Client
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
              </div>
            </form>
          ) : (
            <div>
              <ClientDiscountPortfolio formData={formData} setFormData={setFormData} isAdmin={isAdmin} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="btn btn-primary" onClick={handleSubmit}>{editMode ? 'Update Pricing Profile' : 'Submit'}</button>
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
