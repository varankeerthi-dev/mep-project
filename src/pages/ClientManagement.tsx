import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';

function getCurrentQueryParams() {
  const hashQuery = window.location.hash.split('?')[1];
  const searchQuery = window.location.search.slice(1);
  return new URLSearchParams(hashQuery || searchQuery || '');
}

type CreateClientEditProps = {
  onSuccess: () => void
  onCancel: () => void
}

type ClientDiscountPortfolioProps = {
  formData: any
  setFormData: (updater: any) => void
  isAdmin: boolean
}

type CreateClientProps = {
  onSuccess: () => void
  onCancel: () => void
  editMode?: boolean
  clientData?: any
}

export function CreateClientEdit({ onSuccess, onCancel }: CreateClientEditProps) {
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

function ClientDiscountPortfolio({ formData, setFormData, isAdmin }: ClientDiscountPortfolioProps) {
  const [customDiscounts, setCustomDiscounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

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

  const handleCustomDiscountChange = (variantId: string | number, value: string) => {
    setCustomDiscounts((prev: any) => ({
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
      
      setFormData((prev: any) => ({ ...prev, custom_discounts: customDiscounts }));
      setSaveMessage({ type: 'success', text: 'Discounts saved successfully!' });
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: 'Error saving discounts: ' + (err?.message || err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pricing-control">
      <div className="card" style={{ maxWidth: '600px', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Discount Portfolio</h3>
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
          <div className="form-group" style={{ marginTop: '8px' }}>
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
      <div className="card" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '14px', margin: 0, fontFamily: 'Inter, sans-serif' }}>Custom Discounts (Per Variant)</h3>
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
            marginBottom: '8px', 
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
        <h3 style={{ fontSize: '14px', marginBottom: '6px', fontFamily: 'Inter, sans-serif' }}>Portfolio Preview</h3>
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

export function CreateClient({ onSuccess, onCancel, editMode, clientData }: CreateClientProps) {
  const { organisation, organisations } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = organisations?.find(o => o.organisation.id === organisation?.id)?.role?.toLowerCase() === 'admin';
  const [activeTab, setActiveTab] = useState('general');

  const [formData, setFormData] = useState<any>({ 
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
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
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

  const handleGstChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (value.length <= 15) {
      setFormData({ ...formData, gstin: value });
      if (value.length >= 2) {
        const stateCode = value.substring(0, 2);
        const detectedState = gstStateCodes[stateCode];
        if (detectedState) setFormData((prev: any) => ({ ...prev, gstin: value, state: detectedState }));
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

  const deleteShippingAddress = async (id: string) => {
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
    } catch (err: any) {
      alert('Error deleting client: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
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
      alert('Error: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-inter">
      <div className="max-w-4xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-800">{editMode ? 'Edit Client' : 'Create Client'}</h1>
          <p className="text-sm text-slate-500">{editMode ? 'Update client information' : 'Add a new client to your organization'}</p>
        </div>

        <div className="flex gap-1 p-1 bg-slate-200/50 rounded-xl mb-5 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'general' ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'pricing' ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
          >
            Pricing
          </button>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-5 md:p-6">
          {activeTab === 'general' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Client Name <span className="text-red-500">*</span></label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Category</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm" value={formData.category || 'Active'} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Prospect">Prospect</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200/50">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Contact Persons</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.contact_person || ''} onChange={e => setFormData({...formData, contact_person: e.target.value})} placeholder="Contact 1" />
                  <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.contact_designation || ''} onChange={e => setFormData({...formData, contact_designation: e.target.value})} placeholder="Designation" />
                  <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.contact || ''} onChange={e => setFormData({...formData, contact: e.target.value})} placeholder="Phone" />
                  <input type="email" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.contact_person_email || ''} onChange={e => setFormData({...formData, contact_person_email: e.target.value})} placeholder="Email" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.contact_person_2 || ''} onChange={e => setFormData({...formData, contact_person_2: e.target.value})} placeholder="Contact 2" />
                  <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.contact_designation_2 || ''} onChange={e => setFormData({...formData, contact_designation_2: e.target.value})} placeholder="Designation" />
                  <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.contact_person_2_contact || ''} onChange={e => setFormData({...formData, contact_person_2_contact: e.target.value})} placeholder="Phone" />
                  <input type="email" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.contact_person_2_email || ''} onChange={e => setFormData({...formData, contact_person_2_email: e.target.value})} placeholder="Email" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.purchase_person || ''} onChange={e => setFormData({...formData, purchase_person: e.target.value})} placeholder="Purchase Person" />
                  <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.purchase_designation || ''} onChange={e => setFormData({...formData, purchase_designation: e.target.value})} placeholder="Designation" />
                  <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.purchase_contact || ''} onChange={e => setFormData({...formData, purchase_contact: e.target.value})} placeholder="Phone" />
                  <input type="email" className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={formData.purchase_email || ''} onChange={e => setFormData({...formData, purchase_email: e.target.value})} placeholder="Email" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">GST IN</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm" value={formData.gstin || ''} onChange={handleGstChange} placeholder="15 characters" maxLength={15} />
                  {gstError && <span className="text-red-500 text-xs">{gstError}</span>}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Vendor No</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm" value={formData.vendor_no || ''} onChange={e => setFormData({...formData, vendor_no: e.target.value})} />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-4 border border-emerald-200/50">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Billing Address</div>
                  </div>
                  <div className="space-y-2">
                    <input type="text" className="w-full px-3 py-2 bg-white/80 border border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm" value={formData.address1 || ''} onChange={e => setFormData({...formData, address1: e.target.value})} placeholder="Address Line 1" />
                    <input type="text" className="w-full px-3 py-2 bg-white/80 border border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm" value={formData.address2 || ''} onChange={e => setFormData({...formData, address2: e.target.value})} placeholder="Address Line 2" />
                    <div className="grid grid-cols-3 gap-2">
                      <select className="px-2 py-2 bg-white/80 border border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-xs" value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})}>
                        <option value="">State</option>
                        {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                      </select>
                      <input type="text" className="px-2 py-2 bg-white/80 border border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-xs" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="City" />
                      <input type="text" className="px-2 py-2 bg-white/80 border border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-xs" value={formData.pincode || ''} onChange={e => setFormData({...formData, pincode: e.target.value})} placeholder="Pincode" />
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                      <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">Shipping Addresses</div>
                    </div>
                    <button type="button" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all" onClick={copyBillingToShipping}>Copy Billing</button>
                  </div>
                  
                  {shippingAddresses.map(addr => (
                    <div key={addr.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{addr.address_name || 'Address'}{addr.is_default && <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">Default</span>}</div>
                          <div className="text-xs text-slate-500 mt-1">{addr.address_line1} {addr.address_line2}</div>
                          <div className="text-xs text-slate-500">{addr.city}, {addr.state} - {addr.pincode}</div>
                        </div>
                        <button type="button" onClick={() => deleteShippingAddress(addr.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {showShippingForm && (
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-4 border border-indigo-200/50">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        <div className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Add Shipping Address</div>
                      </div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" className="px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={newShipping.address_name} onChange={e => setNewShipping({...newShipping, address_name: e.target.value})} placeholder="Address Name" />
                          <input type="text" className="px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={newShipping.contact} onChange={e => setNewShipping({...newShipping, contact: e.target.value})} placeholder="Contact" />
                        </div>
                        <input type="text" className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={newShipping.address_line1} onChange={e => setNewShipping({...newShipping, address_line1: e.target.value})} placeholder="Address Line 1" />
                        <input type="text" className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={newShipping.address_line2} onChange={e => setNewShipping({...newShipping, address_line2: e.target.value})} placeholder="Address Line 2" />
                        <div className="grid grid-cols-3 gap-2">
                          <select className="px-2 py-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={newShipping.state} onChange={e => setNewShipping({...newShipping, state: e.target.value})}>
                            <option value="">State</option>
                            {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                          </select>
                          <input type="text" className="px-2 py-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={newShipping.city} onChange={e => setNewShipping({...newShipping, city: e.target.value})} placeholder="City" />
                          <input type="text" className="px-2 py-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs" value={newShipping.pincode} onChange={e => setNewShipping({...newShipping, pincode: e.target.value})} placeholder="Pincode" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all" onClick={addShippingAddress}>Save</button>
                          <button type="button" className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all" onClick={() => setShowShippingForm(false)}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!showShippingForm && shippingAddresses.length === 0 && (
                    <button type="button" className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all" onClick={() => setShowShippingForm(true)}>
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Add Shipping Address
                      </span>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Remarks</label>
                <textarea className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm" rows={2} value={formData.remarks || ''} onChange={e => setFormData({...formData, remarks: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">About Client</label>
                <textarea className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm" rows={2} value={formData.about_client || ''} onChange={e => setFormData({...formData, about_client: e.target.value})} placeholder="Additional information..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all" disabled={saving}>
                  {editMode ? 'Update Client' : 'Submit'}
                </button>
                {editMode && (
                  <button type="button" className="px-6 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-all" onClick={deleteClient} disabled={saving}>
                    Delete
                  </button>
                )}
                <button type="button" className="px-6 py-2.5 bg-white text-slate-600 border-2 border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all" onClick={onCancel} disabled={saving}>Cancel</button>
              </div>
            </form>
          ) : (
            <div>
              <ClientDiscountPortfolio formData={formData} setFormData={setFormData} isAdmin={isAdmin} />
              <div className="flex gap-3 pt-4 mt-4 border-t border-gray-200">
                <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700" onClick={() => handleSubmit()}>{editMode ? 'Update Pricing' : 'Submit'}</button>
                <button type="button" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200" onClick={onCancel}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

