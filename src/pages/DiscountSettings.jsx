import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function DiscountSettings() {
  const [variants, setVariants] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [variantsData, settingsData] = await Promise.all([
        supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name'),
        supabase.from('discount_settings').select('*')
      ]);

      setVariants(variantsData.data || []);
      
      const settingsMap = {};
      (settingsData.data || []).forEach(s => {
        settingsMap[s.variant_id] = s;
      });
      setSettings(settingsMap);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      for (const variant of variants) {
        const setting = settings[variant.id];
        if (!setting) continue;
        
        const data = {
          variant_id: variant.id,
          default_discount_percent: parseFloat(setting.default_discount_percent) || 0,
          min_discount_percent: parseFloat(setting.min_discount_percent) || 0,
          max_discount_percent: parseFloat(setting.max_discount_percent) || 0,
          is_active: setting.is_active !== false,
          updated_at: new Date().toISOString()
        };

        if (setting.id) {
          const { error } = await supabase
            .from('discount_settings')
            .update(data)
            .eq('id', setting.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('discount_settings')
            .insert(data);
          if (error) throw error;
        }
      }
      
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      await loadData();
    } catch (err) {
      console.error('Error saving:', err);
      setMessage({ type: 'error', text: 'Error saving: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (variantId, field, value) => {
    setSettings(prev => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        id: prev[variantId]?.id,
        variant_id: variantId,
        [field]: value
      }
    }));
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Discount Settings</h1>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="card">
          <p style={{ marginBottom: '20px', color: '#64748b' }}>
            Configure default, minimum, and maximum discount percentages per variant. 
            Quotations with discounts exceeding the maximum will require approval.
          </p>

          {message.text && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              borderRadius: '6px',
              background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#166534' : '#dc2626'
            }}>
              {message.text}
            </div>
          )}

          <table className="table">
            <thead>
              <tr>
                <th>Variant</th>
                <th style={{ width: '100px' }}>Default %</th>
                <th style={{ width: '100px' }}>Min %</th>
                <th style={{ width: '100px' }}>Max %</th>
                <th style={{ width: '80px' }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {variants.map(variant => {
                const setting = settings[variant.id] || {};
                return (
                  <tr key={variant.id}>
                    <td style={{ fontWeight: 600 }}>{variant.variant_name}</td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '100%', textAlign: 'right' }}
                        value={setting.default_discount_percent || 0}
                        onChange={(e) => updateSetting(variant.id, 'default_discount_percent', e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '100%', textAlign: 'right' }}
                        value={setting.min_discount_percent || 0}
                        onChange={(e) => updateSetting(variant.id, 'min_discount_percent', e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '100%', textAlign: 'right' }}
                        value={setting.max_discount_percent || 0}
                        onChange={(e) => updateSetting(variant.id, 'max_discount_percent', e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={setting.is_active !== false}
                        onChange={(e) => updateSetting(variant.id, 'is_active', e.target.checked)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {variants.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              No variants found. Please create variants first.
            </div>
          )}

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={loadData}>
              Reset
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
