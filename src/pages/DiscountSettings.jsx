import { useState, useEffect, useMemo } from 'react';
import { supabase, getCurrentUser } from '../supabase';

function StandardTab() {
  const [pricelists, setPricelists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPricelist, setNewPricelist] = useState({ name: '', discount: '' });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => { loadPricelists(); }, []);

  const loadPricelists = async () => {
    setLoading(true);
    const { data } = await supabase.from('standard_discount_pricelists').select('*').order('created_at');
    setPricelists(data || []);
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newPricelist.name) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('standard_discount_pricelists').insert({
        pricelist_name: newPricelist.name,
        discount_percent: parseFloat(newPricelist.discount) || 0
      });
      if (error) throw error;
      setNewPricelist({ name: '', discount: '' });
      loadPricelists();
      setMessage({ type: 'success', text: 'Price list added successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id, field, value) => {
    const { error } = await supabase.from('standard_discount_pricelists').update({ [field]: value }).eq('id', id);
    if (!error) loadPricelists();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this price list?')) return;
    const { error } = await supabase.from('standard_discount_pricelists').delete().eq('id', id);
    if (!error) loadPricelists();
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '16px' }}>Add New Standard Price List</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: 2 }}>
            <label className="form-label">Price List Name</label>
            <input type="text" className="form-input" value={newPricelist.name} onChange={e => setNewPricelist({...newPricelist, name: e.target.value})} placeholder="e.g. Standard 2024" required />
          </div>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label className="form-label">Discount %</label>
            <input type="number" className="form-input" value={newPricelist.discount} onChange={e => setNewPricelist({...newPricelist, discount: e.target.value})} placeholder="0.00" step="0.01" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>Add</button>
        </form>
      </div>

      <div className="card">
        <h3>Standard Price Lists</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Price List Name</th>
              <th style={{ width: '150px' }}>Discount %</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pricelists.map(p => (
              <tr key={p.id}>
                <td>
                  <input type="text" className="form-input" value={p.pricelist_name} onBlur={e => handleUpdate(p.id, 'pricelist_name', e.target.value)} />
                </td>
                <td>
                  <input type="number" className="form-input" value={p.discount_percent} onBlur={e => handleUpdate(p.id, 'discount_percent', parseFloat(e.target.value) || 0)} step="0.01" />
                </td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VariantGrid({ structure, variants, settings, setSettings, updateSetting, handleSave, saving, errors }) {
  return (
    <div className="card">
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px' }}>{structure?.structure_name} Settings</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{structure?.description}</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Variant</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Default %</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Min %</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Max %</th>
            </tr>
          </thead>
          <tbody>
            {variants.map(variant => {
              const setting = settings[structure?.id]?.[variant.id] || {};
              const variantErrors = errors[variant.id] || {};
              return (
                <tr key={variant.id}>
                  <td style={{ fontWeight: 600 }}>{variant.variant_name}</td>
                  <td>
                    <input type="number" className="form-input" style={{ textAlign: 'right' }} value={setting.default_discount_percent || 0} onChange={e => updateSetting(variant.id, 'default_discount_percent', e.target.value)} step="0.01" />
                    {variantErrors.default && <div style={{ color: '#dc2626', fontSize: '10px' }}>{variantErrors.default}</div>}
                  </td>
                  <td>
                    <input type="number" className="form-input" style={{ textAlign: 'right' }} value={setting.min_discount_percent || 0} onChange={e => updateSetting(variant.id, 'min_discount_percent', e.target.value)} step="0.01" />
                    {variantErrors.min && <div style={{ color: '#dc2626', fontSize: '10px' }}>{variantErrors.min}</div>}
                  </td>
                  <td>
                    <input type="number" className="form-input" style={{ textAlign: 'right' }} value={setting.max_discount_percent || 0} onChange={e => updateSetting(variant.id, 'max_discount_percent', e.target.value)} step="0.01" />
                    {variantErrors.max && <div style={{ color: '#dc2626', fontSize: '10px' }}>{variantErrors.max}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DiscountSettings() {
  const [structures, setStructures] = useState([]);
  const [variants, setVariants] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState(1);
  const [errors, setErrors] = useState({});
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    loadData();
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [structuresData, variantsData, settingsData] = await Promise.all([
        supabase.from('discount_structures').select('*').eq('is_active', true).order('structure_number'),
        supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name'),
        supabase.from('discount_variant_settings').select('*')
      ]);

      setStructures(structuresData.data || []);
      setVariants(variantsData.data || []);

      const settingsMap = {};
      (settingsData.data || []).forEach(s => {
        if (!settingsMap[s.structure_id]) settingsMap[s.structure_id] = {};
        settingsMap[s.structure_id][s.variant_id] = s;
      });
      setSettings(settingsMap);
    } catch (err) { console.error('Error loading data:', err); } finally { setLoading(false); }
  };

  const getCurrentStructure = () => structures.find(s => s.structure_number === activeTab);

  const updateSetting = (variantId, field, value) => {
    const structure = getCurrentStructure();
    if (!structure) return;
    setSettings(prev => ({
      ...prev,
      [structure.id]: {
        ...prev[structure.id],
        [variantId]: { ...prev[structure.id]?.[variantId], variant_id: variantId, [field]: value }
      }
    }));
  };

  const handleSave = async () => {
    const structure = getCurrentStructure();
    if (!structure) return;
    setSaving(true);
    try {
      const { user } = await getCurrentUser();
      for (const variant of variants) {
        const setting = settings[structure.id]?.[variant.id];
        if (!setting) continue;
        const data = {
          structure_id: structure.id,
          variant_id: variant.id,
          default_discount_percent: parseFloat(setting.default_discount_percent) || 0,
          min_discount_percent: parseFloat(setting.min_discount_percent) || 0,
          max_discount_percent: parseFloat(setting.max_discount_percent) || 0,
          updated_by_user_id: user?.id,
          updated_at: new Date().toISOString()
        };
        if (setting.id) await supabase.from('discount_variant_settings').update(data).eq('id', setting.id);
        else await supabase.from('discount_variant_settings').insert(data);
      }
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      await loadData();
    } catch (err) { setMessage({ type: 'error', text: 'Error: ' + err.message }); } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Discount Settings</h1>
        <p style={{ color: '#64748b', marginTop: '4px' }}>Configure discount pricelists and variant-specific discount structures.</p>
      </div>

      {message.text && (
        <div style={{ padding: '12px', marginBottom: '16px', borderRadius: '6px', background: message.type === 'success' ? '#dcfce7' : '#fee2e2', color: message.type === 'success' ? '#166534' : '#dc2626' }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px', overflowX: 'auto' }}>
        {structures.map(structure => (
          <button key={structure.id} onClick={() => setActiveTab(structure.structure_number)} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px', background: activeTab === structure.structure_number ? '#3b82f6' : '#f3f4f6', color: activeTab === structure.structure_number ? '#fff' : '#374151', whiteSpace: 'nowrap' }}>
            {structure.structure_number}. {structure.structure_name}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {activeTab === 1 ? (
          <StandardTab />
        ) : (
          <VariantGrid structure={getCurrentStructure()} variants={variants} settings={settings} setSettings={setSettings} updateSetting={updateSetting} handleSave={handleSave} saving={saving} errors={errors} />
        )}
      </div>
    </div>
  );
}
