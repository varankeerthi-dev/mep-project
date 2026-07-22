// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../supabase';
import { useMaterials } from '../../../hooks/useMaterials';

const UNIT_OPTIONS = ['Nos', 'Mtrs', 'Kgs', 'Sqft', 'Cum', 'Ltr', 'Pcs', 'Job', 'Hour', 'Day'];
const GST_OPTIONS = [0, 5, 12, 18, 28];

function ServiceItemsTab() {
  const { data: allMaterials = [], isLoading: loading } = useMaterials();
  const services = useMemo(() => allMaterials.filter(m => m.item_type === 'service'), [allMaterials]);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    service_code: '', service_name: '', description: '', unit: 'nos',
    sale_price: '', purchase_price: '', hsn_code: '', tax_rate: 18, is_active: true
  });

  const generateServiceCode = () => 'SVC-' + Date.now().toString(36).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      item_code: formData.service_code || generateServiceCode(),
      name: formData.service_name,
      display_name: formData.service_name,
      description: formData.description || null,
      unit: formData.unit,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      hsn_code: formData.hsn_code || null,
      gst_rate: formData.tax_rate ? parseFloat(formData.tax_rate) : null,
      is_active: formData.is_active,
      item_type: 'service',
      uses_variant: false
    };
    try {
      if (editingService) {
        await supabase.from('materials').update(data).eq('id', editingService.id);
      } else {
        await supabase.from('materials').insert(data);
      }
      resetForm();
    } catch (err) {
      alert('Error saving service: ' + err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingService(null);
    setFormData({ service_code: '', service_name: '', description: '', unit: 'nos', sale_price: '', purchase_price: '', hsn_code: '', tax_rate: 18, is_active: true });
  };

  const editService = (service) => {
    setEditingService(service);
    setFormData({
      service_code: service.item_code || '',
      service_name: service.name || '',
      description: service.description || '',
      unit: service.unit || 'nos',
      sale_price: service.sale_price || '',
      purchase_price: service.purchase_price || '',
      hsn_code: service.hsn_code || '',
      tax_rate: service.gst_rate || 18,
      is_active: service.is_active !== false
    });
    setShowForm(true);
  };

  const deleteService = (id) => {
    if (confirm('Delete this service?')) {
      supabase.from('materials').delete().eq('id', id);
    }
  };

  const filteredServices = services.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search services..."
          className="h-8 w-full max-w-[300px] min-w-0 px-2.5 py-1 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none"
          style={{ borderWidth: '0.888889px' }}
        />
        <button
          onClick={() => setShowForm(true)}
          style={{ height: '32px', padding: '0 16px', fontSize: '12px', fontWeight: 500, background: 'oklch(52% 0.105 223.1)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          + Add Service
        </button>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif' }}>
          <thead>
            <tr>
              <th className="h-10 px-2 text-left align-middle text-sm font-medium text-black">Service Code</th>
              <th className="h-10 px-2 text-left align-middle text-sm font-medium text-black">Service Name</th>
              <th className="h-10 px-2 text-left align-middle text-sm font-medium text-black">Unit</th>
              <th className="h-10 px-2 text-right align-middle text-sm font-medium text-black">Sale Price</th>
              <th className="h-10 px-2 text-left align-middle text-sm font-medium text-black">HSN/SAC</th>
              <th className="h-10 px-2 text-center align-middle text-sm font-medium text-black">Active</th>
              <th className="h-10 px-2 text-right align-middle text-sm font-medium text-black min-w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.map((s, i) => (
              <tr key={s.id} className={`${i < filteredServices.length - 1 ? 'border-b border-[#E5E5E5]' : ''} hover:bg-[#F5F5F5] transition-colors`} style={{ opacity: s.is_active === false ? 0.5 : 1 }}>
                <td className="p-2 align-middle whitespace-nowrap text-sm text-black">{s.item_code || '-'}</td>
                <td className="p-2 align-middle whitespace-nowrap text-sm font-medium text-black">{s.name}</td>
                <td className="p-2 align-middle whitespace-nowrap text-sm text-black">{s.unit}</td>
                <td className="p-2 text-right align-middle text-sm text-black">{s.sale_price ? '\u20B9' + Number(s.sale_price).toLocaleString() : '-'}</td>
                <td className="p-2 align-middle whitespace-nowrap text-sm text-black">{s.hsn_code || '-'}</td>
                <td className="p-2 text-center align-middle">
                  {s.is_active ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Active</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">Inactive</span>
                  )}
                </td>
                <td className="p-2 text-right align-middle">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => editService(s)} className="hover:text-[oklch(52%_0.105_223.1)] hover:font-bold" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 500, color: '#000000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                    <button onClick={() => deleteService(s.id)} className="hover:text-[oklch(52%_0.105_223.1)] hover:font-bold" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 500, color: '#000000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', padding: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
              <h2 style={{ fontFamily: '"Inter", system-ui, sans-serif', fontSize: '16px', fontWeight: 600, color: '#0C0A09', margin: 0 }}>{editingService ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#79716B', padding: '4px' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
              <div className="flex flex-col w-full gap-5" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[12px] leading-[100%] text-[#0C0A09]">Service Name *</label>
                    <input type="text" value={formData.service_name} onChange={e => setFormData({...formData, service_name: e.target.value})} required placeholder="e.g. Installation" className="h-8 w-full min-w-0 px-2.5 py-1 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none" style={{ borderWidth: '0.888889px' }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[12px] leading-[100%] text-[#0C0A09]">Service Code</label>
                    <input type="text" value={formData.service_code} onChange={e => setFormData({...formData, service_code: e.target.value})} placeholder="Auto-generated" className="h-8 w-full min-w-0 px-2.5 py-1 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none" style={{ borderWidth: '0.888889px' }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[12px] leading-[100%] text-[#0C0A09]">Unit</label>
                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="h-8 w-full min-w-0 px-2.5 py-1 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none appearance-none bg-white cursor-pointer" style={{ borderWidth: '0.888889px' }}>
                      {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[12px] leading-[100%] text-[#0C0A09]">HSN/SAC</label>
                    <input type="text" value={formData.hsn_code} onChange={e => setFormData({...formData, hsn_code: e.target.value})} placeholder="e.g. 9987" className="h-8 w-full min-w-0 px-2.5 py-1 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none" style={{ borderWidth: '0.888889px' }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[12px] leading-[100%] text-[#0C0A09]">Sale Price</label>
                    <input type="number" value={formData.sale_price} onChange={e => setFormData({...formData, sale_price: e.target.value})} placeholder="0.00" step="0.01" className="h-8 w-full min-w-0 px-2.5 py-1 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none" style={{ borderWidth: '0.888889px' }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[12px] leading-[100%] text-[#0C0A09]">Purchase Price</label>
                    <input type="number" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} placeholder="0.00" step="0.01" className="h-8 w-full min-w-0 px-2.5 py-1 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none" style={{ borderWidth: '0.888889px' }} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[12px] leading-[100%] text-[#0C0A09]">Description</label>
                  <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Optional description" className="w-full min-w-0 px-2.5 py-2 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none resize-none" style={{ borderWidth: '0.888889px', minHeight: '64px' }} />
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center shrink-0 bg-[oklch(52%_0.105_223.1)] border border-[oklch(52%_0.105_223.1)]" style={{ width: '16px', height: '16px' }}>
                    <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="absolute inset-0 opacity-0 cursor-pointer" />
                    {formData.is_active && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" style={{ overflow: 'clip' }}>
                        <path d="M5 14L8.5 17.5L19 6.5" fill="none" stroke="oklch(98.4% 0.019 200.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <label className="text-[12px] leading-[100%] text-[#0C0A09] cursor-pointer">Active</label>
                </div>
                <div className="flex gap-3 justify-end pt-1">
                  <button type="submit" style={{ height: '32px', padding: '0 16px', fontSize: '12px', fontWeight: 500, background: 'oklch(52% 0.105 223.1)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{editingService ? 'Update' : 'Save'}</button>
                  <button type="button" onClick={resetForm} style={{ height: '32px', padding: '0 16px', fontSize: '12px', fontWeight: 500, background: 'transparent', color: '#79716B', border: '1px solid #E7E5E4', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceRatesTab() {
  const { data: materials = [] } = useMaterials();
  const [serviceRates, setServiceRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);

  const [formData, setFormData] = useState({
    item_name: '',
    default_erection_rate: '',
    unit: 'Mtrs',
    gst_rate: 18,
    sac_code: '',
    is_active: true
  });

  useEffect(() => {
    loadServiceRates();
  }, []);

  const loadServiceRates = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('service_rates').select('*').order('item_name');
      setServiceRates(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMaterials = materials.filter(m => m.name?.toLowerCase().includes(materialSearch.toLowerCase()));

  const handleMaterialSelect = (material) => {
    setFormData(prev => ({
      ...prev,
      item_name: material.name,
      unit: material.unit || 'Mtrs',
      gst_rate: material.gst_rate || 18,
      sac_code: material.hsn_code || ''
    }));
    setShowMaterialDropdown(false);
    setMaterialSearch('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      item_name: formData.item_name.trim(),
      default_erection_rate: parseFloat(formData.default_erection_rate) || 0,
      unit: formData.unit,
      gst_rate: parseFloat(formData.gst_rate) || 18,
      sac_code: formData.sac_code || null,
      is_active: formData.is_active
    };
    try {
      if (editingRate) {
        await supabase.from('service_rates').update(data).eq('id', editingRate.id);
      } else {
        await supabase.from('service_rates').insert(data);
      }
      resetForm();
      loadServiceRates();
    } catch (err) {
      alert('Error saving service rate: ' + err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingRate(null);
    setFormData({ item_name: '', default_erection_rate: '', unit: 'Mtrs', gst_rate: 18, sac_code: '', is_active: true });
    setMaterialSearch('');
    setShowMaterialDropdown(false);
  };

  const editRate = (rate) => {
    setEditingRate(rate);
    setFormData({
      item_name: rate.item_name || '',
      default_erection_rate: rate.default_erection_rate || '',
      unit: rate.unit || 'Mtrs',
      gst_rate: rate.gst_rate || 18,
      sac_code: rate.sac_code || '',
      is_active: rate.is_active !== false
    });
    setShowForm(true);
  };

  const deleteRate = (id) => {
    if (confirm('Delete this service rate?')) {
      supabase.from('service_rates').delete().eq('id', id).then(() => loadServiceRates());
    }
  };

  const filteredRates = serviceRates.filter(r => r.item_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="p-8 text-center text-sm text-zinc-400">Loading service rates...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by material name..."
          className="h-8 w-full max-w-[300px] min-w-0 px-2.5 py-1 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none"
          style={{ borderWidth: '0.888889px' }}
        />
        <button
          onClick={() => setShowForm(true)}
          style={{ height: '32px', padding: '0 16px', fontSize: '12px', fontWeight: 500, background: 'oklch(52% 0.105 223.1)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          + Add Service Rate
        </button>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif' }}>
          <thead>
            <tr>
              <th className="h-10 px-2 text-left align-middle text-sm font-medium text-black">Material Name</th>
              <th className="h-10 px-2 text-right align-middle text-sm font-medium text-black">Erection Rate</th>
              <th className="h-10 px-2 text-left align-middle text-sm font-medium text-black">Unit</th>
              <th className="h-10 px-2 text-right align-middle text-sm font-medium text-black">GST %</th>
              <th className="h-10 px-2 text-left align-middle text-sm font-medium text-black">SAC Code</th>
              <th className="h-10 px-2 text-center align-middle text-sm font-medium text-black">Active</th>
              <th className="h-10 px-2 text-right align-middle text-sm font-medium text-black min-w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRates.map((r, i) => (
              <tr key={r.id} className={`${i < filteredRates.length - 1 ? 'border-b border-[#E5E5E5]' : ''} hover:bg-[#F5F5F5] transition-colors`} style={{ opacity: r.is_active === false ? 0.5 : 1 }}>
                <td className="p-2 align-middle whitespace-nowrap text-sm font-medium text-black">{r.item_name}</td>
                <td className="p-2 text-right align-middle text-sm text-black">{'\u20B9' + Number(r.default_erection_rate).toLocaleString()}</td>
                <td className="p-2 align-middle whitespace-nowrap text-sm text-black">{r.unit}</td>
                <td className="p-2 text-right align-middle text-sm text-black">{r.gst_rate}%</td>
                <td className="p-2 align-middle whitespace-nowrap text-sm text-black">{r.sac_code || '-'}</td>
                <td className="p-2 text-center align-middle">
                  {r.is_active ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Active</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">Inactive</span>
                  )}
                </td>
                <td className="p-2 text-right align-middle">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => editRate(r)} className="hover:text-[oklch(52%_0.105_223.1)] hover:font-bold" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 500, color: '#000000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                    <button onClick={() => deleteRate(r.id)} className="hover:text-[oklch(52%_0.105_223.1)] hover:font-bold" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 500, color: '#000000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }} onClick={resetForm}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5',
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#171717',
                margin: 0,
              }}>
                {editingRate ? 'Edit Service Rate' : 'Add Service Rate'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  border: 'none',
                  background: 'transparent',
                  color: '#525252',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    Select from Materials
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={materialSearch}
                      onChange={e => {
                        setMaterialSearch(e.target.value);
                        setShowMaterialDropdown(true);
                      }}
                      onFocus={() => setShowMaterialDropdown(true)}
                      placeholder="Search material or type manually..."
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                        width: '100%',
                      }}
                    />
                    {showMaterialDropdown && filteredMaterials.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#fff',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 10,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}>
                        {filteredMaterials.map(m => (
                          <div
                            key={m.id}
                            onClick={() => handleMaterialSelect(m)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: '#171717',
                              borderBottom: '1px solid #f5f5f5',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                          >
                            <div style={{ fontWeight: 500 }}>{m.name}</div>
                            <div style={{ fontSize: '11px', color: '#737373' }}>
                              Unit: {m.unit || 'N/A'} | GST: {m.gst_rate || 0}%
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    Material Name *
                  </label>
                  <input
                    type="text"
                    value={formData.item_name}
                    onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                    placeholder="e.g., 100NB Pipe, Gate Valve"
                    required
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#171717',
                    }}
                  />
                  <p style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>
                    Must match material name exactly for auto-linking
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Erection Rate *
                    </label>
                    <input
                      type="number"
                      value={formData.default_erection_rate}
                      onChange={e => setFormData({ ...formData, default_erection_rate: e.target.value })}
                      step="0.01"
                      required
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Unit *
                    </label>
                    <select
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    >
                      {UNIT_OPTIONS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      GST % *
                    </label>
                    <select
                      value={formData.gst_rate}
                      onChange={e => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) })}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    >
                      {GST_OPTIONS.map(g => (
                        <option key={g} value={g}>{g}%</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    SAC Code
                  </label>
                  <input
                    type="text"
                    value={formData.sac_code}
                    onChange={e => setFormData({ ...formData, sac_code: e.target.value })}
                    placeholder="e.g., 9954, 9988"
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#171717',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                    }}
                  />
                  <label htmlFor="is_active" style={{
                    fontSize: '13px',
                    color: '#525252',
                    cursor: 'pointer',
                  }}>
                    Active (auto-create erection charges)
                  </label>
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e5e5',
              }}>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#525252',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#185FA5',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#154d8a'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#185FA5'}
                >
                  {editingRate ? 'Update Service Rate' : 'Save Service Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function ServiceTab() {
  const [activeSubTab, setActiveSubTab] = useState('items');

  return (
    <div>
      <div className="bg-[#F3F1F1] rounded-[26px] p-[6px] gap-x-[10px] gap-y-4 inline-flex flex-wrap mb-6">
        <button
          onClick={() => setActiveSubTab('items')}
          className={`px-3 py-1.5 text-sm font-medium transition-all ${activeSubTab === 'items' ? 'bg-white text-[#0C0A09] shadow-sm rounded-full' : 'bg-transparent text-[#0C0A0999] hover:text-[#0C0A09] rounded-[14px]'}`}
        >
          Service Items
        </button>
        <button
          onClick={() => setActiveSubTab('rates')}
          className={`px-3 py-1.5 text-sm font-medium transition-all ${activeSubTab === 'rates' ? 'bg-white text-[#0C0A09] shadow-sm rounded-full' : 'bg-transparent text-[#0C0A0999] hover:text-[#0C0A09] rounded-[14px]'}`}
        >
          Service Rates (Erection)
        </button>
      </div>

      {activeSubTab === 'items' && <ServiceItemsTab />}
      {activeSubTab === 'rates' && <ServiceRatesTab />}
    </div>
  );
}
