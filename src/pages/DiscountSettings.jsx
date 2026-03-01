import { useState, useEffect, useMemo } from 'react';
import { supabase, getCurrentUser } from '../supabase';

export default function DiscountSettings() {
  const [structures, setStructures] = useState([]);
  const [variants, setVariants] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState(1);
  const [userRole, setUserRole] = useState(null);
  const [errors, setErrors] = useState({});
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    checkUserRole();
    loadData();
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await getCurrentUser();
      if (user) {
        // Check users table for role
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        
        const role = userData?.role || 'Member';
        setUserRole(role);
        console.log('User role:', role);
      }
    } catch (err) {
      console.warn('Could not check user role:', err);
      setUserRole('Member');
    }
  };

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
        if (!settingsMap[s.structure_id]) {
          settingsMap[s.structure_id] = {};
        }
        settingsMap[s.structure_id][s.variant_id] = s;
      });
      setSettings(settingsMap);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStructure = () => structures.find(s => s.structure_number === activeTab);

  const validateRow = (variantId, values) => {
    const rowErrors = {};
    const min = parseFloat(values.min) || 0;
    const def = parseFloat(values.default) || 0;
    const max = parseFloat(values.max) || 0;

    if (min < 0 || def < 0 || max < 0) {
      rowErrors.general = 'Values cannot be negative';
    }
    if (min > 100 || def > 100 || max > 100) {
      rowErrors.general = 'Values cannot exceed 100%';
    }
    if (min > def) {
      rowErrors.min = 'Min cannot exceed Default';
    }
    if (def > max) {
      rowErrors.default = 'Default cannot exceed Max';
    }

    return rowErrors;
  };

  const updateSetting = (variantId, field, value) => {
    const structure = getCurrentStructure();
    if (!structure) return;

    setSettings(prev => ({
      ...prev,
      [structure.id]: {
        ...prev[structure.id],
        [variantId]: {
          ...prev[structure.id]?.[variantId],
          variant_id: variantId,
          [field]: value
        }
      }
    }));

    // Clear error when user edits
    const current = settings[structure.id]?.[variantId] || {};
    const newValues = { ...current, [field]: value };
    const rowErrors = validateRow(variantId, {
      min: newValues.min_discount_percent,
      default: newValues.default_discount_percent,
      max: newValues.max_discount_percent
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`${variantId}-min`];
      delete newErrors[`${variantId}-default`];
      delete newErrors[`${variantId}-max`];
      delete newErrors[variantId];
      return newErrors;
    });
  };

  const handleSave = async () => {
    const structure = getCurrentStructure();
    if (!structure) return;

    // Validate all rows first
    const allErrors = {};
    let hasErrors = false;

    variants.forEach(variant => {
      const setting = settings[structure.id]?.[variant.id] || {};
      const rowErrors = validateRow(variant.id, {
        min: setting.min_discount_percent,
        default: setting.default_discount_percent,
        max: setting.max_discount_percent
      });
      if (Object.keys(rowErrors).length > 0) {
        allErrors[variant.id] = rowErrors;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setErrors(allErrors);
      setMessage({ type: 'error', text: 'Please fix validation errors before saving' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { data: { user } } = await getCurrentUser();

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

        if (setting.id) {
          const { error } = await supabase
            .from('discount_variant_settings')
            .update(data)
            .eq('id', setting.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('discount_variant_settings')
            .insert(data);
          if (error) throw error;
        }
      }

      setMessage({ type: 'success', text: 'Discount settings saved successfully!' });
      await loadData();
    } catch (err) {
      console.error('Error saving:', err);
      setMessage({ type: 'error', text: 'Error saving: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  const currentStructure = getCurrentStructure();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Discount Settings</h1>
        <p style={{ color: '#64748b', marginTop: '4px' }}>
          Configure default, minimum, and maximum discount percentages per variant
        </p>
      </div>

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

      {/* Structure Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '16px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '12px',
        overflowX: 'auto'
      }}>
        {structures.map(structure => (
          <button
            key={structure.id}
            onClick={() => setActiveTab(structure.structure_number)}
            style={{
              padding: isMobile ? '10px 16px' : '10px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              background: activeTab === structure.structure_number ? '#3b82f6' : '#f3f4f6',
              color: activeTab === structure.structure_number ? '#fff' : '#374151',
              whiteSpace: 'nowrap'
            }}
          >
            {structure.structure_number}. {structure.structure_name}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div className="card">
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px' }}>
                Structure {currentStructure?.structure_number}: {currentStructure?.structure_name}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                {currentStructure?.description || 'Configure discount limits for this structure'}
              </p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleSave} 
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {isMobile ? (
            // Mobile: Card layout
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {variants.map(variant => {
                const setting = settings[currentStructure?.id]?.[variant.id] || {};
                const variantErrors = errors[variant.id] || {};
                
                return (
                  <div 
                    key={variant.id} 
                    style={{ 
                      padding: '16px', 
                      background: '#f9fafb', 
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '14px' }}>
                      {variant.variant_name}
                    </div>
                    
                    {variantErrors.general && (
                      <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '8px' }}>
                        {variantErrors.general}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Default %</label>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '100%', minHeight: '44px', textAlign: 'right' }}
                          value={setting.default_discount_percent || 0}
                          onChange={(e) => updateSetting(variant.id, 'default_discount_percent', e.target.value)}
                          min="0"
                          max="100"
                          step="0.01"
                        />
                        {variantErrors.default && (
                          <div style={{ color: '#dc2626', fontSize: '10px', marginTop: '2px' }}>{variantErrors.default}</div>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Min %</label>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '100%', minHeight: '44px', textAlign: 'right' }}
                          value={setting.min_discount_percent || 0}
                          onChange={(e) => updateSetting(variant.id, 'min_discount_percent', e.target.value)}
                          min="0"
                          max="100"
                          step="0.01"
                        />
                        {variantErrors.min && (
                          <div style={{ color: '#dc2626', fontSize: '10px', marginTop: '2px' }}>{variantErrors.min}</div>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Max %</label>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '100%', minHeight: '44px', textAlign: 'right' }}
                          value={setting.max_discount_percent || 0}
                          onChange={(e) => updateSetting(variant.id, 'max_discount_percent', e.target.value)}
                          min="0"
                          max="100"
                          step="0.01"
                        />
                        {variantErrors.max && (
                          <div style={{ color: '#dc2626', fontSize: '10px', marginTop: '2px' }}>{variantErrors.max}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Desktop: Table layout
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '150px' }}>Variant</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Default %</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Min %</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Max %</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map(variant => {
                    const setting = settings[currentStructure?.id]?.[variant.id] || {};
                    const variantErrors = errors[variant.id] || {};
                    
                    return (
                      <tr key={variant.id}>
                        <td style={{ fontWeight: 600 }}>{variant.variant_name}</td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '100%', textAlign: 'right', minHeight: '44px' }}
                            value={setting.default_discount_percent || 0}
                            onChange={(e) => updateSetting(variant.id, 'default_discount_percent', e.target.value)}
                            min="0"
                            max="100"
                            step="0.01"
                          />
                          {variantErrors.default && (
                            <div style={{ color: '#dc2626', fontSize: '10px', marginTop: '2px' }}>{variantErrors.default}</div>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '100%', textAlign: 'right', minHeight: '44px' }}
                            value={setting.min_discount_percent || 0}
                            onChange={(e) => updateSetting(variant.id, 'min_discount_percent', e.target.value)}
                            min="0"
                            max="100"
                            step="0.01"
                          />
                          {variantErrors.min && (
                            <div style={{ color: '#dc2626', fontSize: '10px', marginTop: '2px' }}>{variantErrors.min}</div>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '100%', textAlign: 'right', minHeight: '44px' }}
                            value={setting.max_discount_percent || 0}
                            onChange={(e) => updateSetting(variant.id, 'max_discount_percent', e.target.value)}
                            min="0"
                            max="100"
                            step="0.01"
                          />
                          {variantErrors.max && (
                            <div style={{ color: '#dc2626', fontSize: '10px', marginTop: '2px' }}>{variantErrors.max}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {variants.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              No active variants found. Please create variants first.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
