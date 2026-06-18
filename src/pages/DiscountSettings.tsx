import { useState, useEffect, useMemo } from 'react';
import { supabase, getCurrentUser } from '../supabase';
import { useAuth } from '../App';

function StandardTab({ organisationId }) {
  const [pricelists, setPricelists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPricelist, setNewPricelist] = useState({ name: '', discount: '' });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => { loadPricelists(); }, [organisationId]);

  const loadPricelists = async () => {
    if (!organisationId) return;
    setLoading(true);
    const { data } = await supabase.from('standard_discount_pricelists').select('*').eq('organisation_id', organisationId).order('created_at');
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
        discount_percent: parseFloat(newPricelist.discount) || 0,
        organisation_id: organisationId
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

function VariantGrid({ structure, rows, settings, setSettings, updateSetting, handleSave, saving, errors, isDiscountCategory }) {
  return (
    <div className="card">
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px' }}>{structure?.structure_name} Settings</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{structure?.description}</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>

      {rows.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
          {isDiscountCategory ? 'No discount categories configured. Add them in Store → Materials → Discount Categories tab.' : 'No variants configured.'}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Discount Category</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Default %</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Min %</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Max %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const rowId = isDiscountCategory ? row.id : row.id;
                const setting = settings[structure?.id]?.[rowId] || {};
                const rowErrors = errors[rowId] || {};
                const rowName = isDiscountCategory ? row.name : row.variant_name;
                return (
                  <tr key={rowId}>
                    <td style={{ fontWeight: 600 }}>{rowName}</td>
                    <td>
                      <input type="number" className="form-input" style={{ textAlign: 'right' }} value={setting.default_discount_percent || 0} onChange={e => updateSetting(rowId, 'default_discount_percent', e.target.value)} step="0.01" />
                      {rowErrors.default && <div style={{ color: '#dc2626', fontSize: '10px' }}>{rowErrors.default}</div>}
                    </td>
                    <td>
                      <input type="number" className="form-input" style={{ textAlign: 'right' }} value={setting.min_discount_percent || 0} onChange={e => updateSetting(rowId, 'min_discount_percent', e.target.value)} step="0.01" />
                      {rowErrors.min && <div style={{ color: '#dc2626', fontSize: '10px' }}>{rowErrors.min}</div>}
                    </td>
                    <td>
                      <input type="number" className="form-input" style={{ textAlign: 'right' }} value={setting.max_discount_percent || 0} onChange={e => updateSetting(rowId, 'max_discount_percent', e.target.value)} step="0.01" />
                      {rowErrors.max && <div style={{ color: '#dc2626', fontSize: '10px' }}>{rowErrors.max}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DiscountSettings() {
  const { organisation } = useAuth();
  const [structures, setStructures] = useState([]);
  const [variants, setVariants] = useState([]);
  const [discountCategories, setDiscountCategories] = useState([]);
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
  }, [organisation?.id]);

  const loadData = async () => {
    if (!organisation?.id) {
      console.log('No organisation ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      console.log('Loading discount settings for:', organisation.id);
      const [structuresData, variantsData, settingsData, discountCatsData] = await Promise.all([
        supabase.from('discount_structures').select('*').eq('organisation_id', organisation.id).order('structure_number'),
        supabase.from('company_variants').select('*').eq('organisation_id', organisation.id).order('variant_name'),
        supabase.from('discount_variant_settings').select('*').eq('organisation_id', organisation.id),
        supabase.from('discount_categories').select('*').or(`organisation_id.eq.${organisation.id},organisation_id.is.null`).eq('is_active', true).order('name')
      ]);

      const filteredStructures = (structuresData.data || []).filter(
        (s: any) => s.structure_name !== 'Premium' && s.structure_name !== 'Special'
      );
      setStructures(filteredStructures.length ? filteredStructures : [
        { id: '1', structure_number: 1, structure_name: 'Standard', description: 'Default standard discount' },
        { id: '3', structure_number: 3, structure_name: 'Bulk', description: 'Bulk order discount' }
      ]);
      setVariants(variantsData.data?.length ? variantsData.data : []);
      setDiscountCategories(discountCatsData.data?.length ? discountCatsData.data : []);

      const settingsMap = {};
      (settingsData.data || []).forEach(s => {
        if (!settingsMap[s.structure_id]) settingsMap[s.structure_id] = {};
        const key = s.discount_category_id || s.variant_id;
        if (key) settingsMap[s.structure_id][key] = s;
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
      const isDcTab = discountCategories.length > 0;
      const rows = isDcTab ? discountCategories : variants;
      for (const row of rows) {
        const rowId = isDcTab ? row.id : row.id;
        const setting = settings[structure.id]?.[rowId];
        if (!setting) continue;
        const data = {
          structure_id: structure.id,
          [isDcTab ? 'discount_category_id' : 'variant_id']: rowId,
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
        <p style={{ color: '#64748b', marginTop: '4px' }}>Configure discount pricelists and category-specific discount structures.</p>
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
          <StandardTab organisationId={organisation?.id} />
        ) : (
          <VariantGrid structure={getCurrentStructure()} rows={discountCategories} settings={settings} setSettings={setSettings} updateSetting={updateSetting} handleSave={handleSave} saving={saving} errors={errors} isDiscountCategory={true} />
        )}
      </div>
    </div>
  );
}


