import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  loadQuickQuoteConfig,
  saveQuickQuoteSettings,
  saveQuickQuoteSizeMappings,
} from '../quotation/quick-quote/api';
import type { QuickQuoteSettings, QuickQuoteSizeMapping } from '../quotation/quick-quote/types';

export default function QuickQuoteSettings() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const orgId = organisation?.id || '';

  const [settingsForm, setSettingsForm] = useState<QuickQuoteSettings | null>(null);
  const [sizeMappings, setSizeMappings] = useState<QuickQuoteSizeMapping[]>([]);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['quickQuoteSettingsPage', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const [config, materialsResult, variantsResult] = await Promise.all([
        loadQuickQuoteConfig(orgId),
        supabase.from('materials').select('id, display_name, name').order('display_name'),
        supabase.from('company_variants').select('id, variant_name').eq('is_active', true).order('variant_name'),
      ]);

      if (materialsResult.error) throw materialsResult.error;
      if (variantsResult.error) throw variantsResult.error;

      const fallbackSettings: QuickQuoteSettings = {
        org_id: orgId,
        default_material: null,
        default_variant: null,
        default_make: null,
        default_spec: null,
        enable_valves: true,
        enable_thread_items: true,
      };

      return {
        config,
        materials: materialsResult.data || [],
        variants: variantsResult.data || [],
        settings: config.settings || fallbackSettings,
        mappings: config.mappings.filter((row) => row.org_id === orgId),
      };
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettingsForm(settingsQuery.data.settings);
    setSizeMappings(settingsQuery.data.mappings.length > 0 ? settingsQuery.data.mappings : [{ org_id: orgId, mm_size: '', inch_size: '' }]);
  }, [settingsQuery.data, orgId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!settingsForm) return;
      await saveQuickQuoteSettings(settingsForm);
      await saveQuickQuoteSizeMappings(orgId, sizeMappings);
    },
    onSuccess: async () => {
      setBanner({ type: 'success', message: 'Quick Quote settings saved.' });
      await queryClient.invalidateQueries({ queryKey: ['quickQuoteSettingsPage', orgId] });
    },
    onError: (error: Error) => {
      setBanner({ type: 'error', message: error.message || 'Failed to save settings.' });
    },
  });

  if (!orgId) return <div style={{ padding: '24px' }}>Organisation not found.</div>;
  if (settingsQuery.isPending || !settingsForm) return <div style={{ padding: '24px' }}>Loading Quick Quote settings...</div>;

  const materials = settingsQuery.data?.materials || [];
  const variants = settingsQuery.data?.variants || [];

  return (
    <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '16px' }}>
      <div className="page-header">
        <h1 className="page-title">Quick Quote Settings</h1>
        <p style={{ color: '#64748b', marginTop: '4px' }}>Configure defaults, toggles, and mm to inch conversion mappings.</p>
      </div>

      {banner && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', background: banner.type === 'success' ? '#dcfce7' : '#fee2e2', color: banner.type === 'success' ? '#166534' : '#b91c1c' }}>
          {banner.message}
        </div>
      )}

      <div className="card" style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Defaults</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: '10px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Default Material</label>
            <select className="form-select" value={settingsForm.default_material || ''} onChange={(e) => setSettingsForm((prev) => prev ? { ...prev, default_material: e.target.value || null } : prev)}>
              <option value="">Select material</option>
              {materials.map((material: any) => (
                <option key={material.id} value={material.id}>{material.display_name || material.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Default Variant</label>
            <select className="form-select" value={settingsForm.default_variant || ''} onChange={(e) => setSettingsForm((prev) => prev ? { ...prev, default_variant: e.target.value || null } : prev)}>
              <option value="">Select variant</option>
              {variants.map((variant: any) => (
                <option key={variant.id} value={variant.id}>{variant.variant_name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Default Make</label>
            <input className="form-input" value={settingsForm.default_make || ''} onChange={(e) => setSettingsForm((prev) => prev ? { ...prev, default_make: e.target.value || null } : prev)} placeholder="e.g. L&T" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Default Spec</label>
            <input className="form-input" value={settingsForm.default_spec || ''} onChange={(e) => setSettingsForm((prev) => prev ? { ...prev, default_spec: e.target.value || null } : prev)} placeholder="e.g. PN16" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={settingsForm.enable_valves} onChange={(e) => setSettingsForm((prev) => prev ? { ...prev, enable_valves: e.target.checked } : prev)} />
            Enable Valves
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={settingsForm.enable_thread_items} onChange={(e) => setSettingsForm((prev) => prev ? { ...prev, enable_thread_items: e.target.checked } : prev)} />
            Enable Thread Items
          </label>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '14px', margin: 0 }}>Size Mapping Editor</h3>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setSizeMappings((prev) => [...prev, { org_id: orgId, mm_size: '', inch_size: '' }])}
          >
            + Add Mapping
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>MM Size</th>
              <th style={{ width: '45%' }}>Inch Size</th>
              <th style={{ width: '10%' }}></th>
            </tr>
          </thead>
          <tbody>
            {sizeMappings.map((mapping, index) => (
              <tr key={`${index}-${mapping.mm_size}-${mapping.inch_size}`}>
                <td>
                  <input
                    className="form-input"
                    value={mapping.mm_size}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSizeMappings((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, mm_size: value } : row)));
                    }}
                    placeholder="e.g. 65"
                  />
                </td>
                <td>
                  <input
                    className="form-input"
                    value={mapping.inch_size}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSizeMappings((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, inch_size: value } : row)));
                    }}
                    placeholder={'e.g. 2.5"'}
                  />
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    onClick={() => setSizeMappings((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Quick Quote Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
