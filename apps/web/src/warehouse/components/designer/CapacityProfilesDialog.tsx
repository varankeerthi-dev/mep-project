import { Button } from '../../../components/ui/button';
// src/warehouse/components/designer/CapacityProfilesDialog.tsx
// Capacity Profile management (G9 — PRD §5.17 / TAD §4.4 "Configure Capacity").
// Create / edit / delete reusable named capacity definitions, and apply one
// to the currently selected layout (fills Max Qty / Bin from the profile).

import { useState } from 'react';
import { Plus, Trash2, Save, X, Loader2, Boxes } from 'lucide-react';
import { useCapacityProfiles, useCreateCapacityProfile, useUpdateCapacityProfile, useDeleteCapacityProfile } from '../../hooks/useWarehouseData';
import type { CapacityProfileRow } from '../../types';

interface Props {
  onClose: () => void;
  /** When set, "Apply to current layout" copies the profile's max qty to the selected layout. */
  onApply?: (profile: CapacityProfileRow) => void;
}

const EMPTY: Partial<CapacityProfileRow> = { name: '', description: '', max_quantity: undefined, max_weight_kg: undefined, max_volume_m3: undefined, max_pallets: undefined };

export default function CapacityProfilesDialog({ onClose, onApply }: Props) {
  const { data: profiles, isLoading } = useCapacityProfiles();
  const createProfile = useCreateCapacityProfile();
  const updateProfile = useUpdateCapacityProfile();
  const deleteProfile = useDeleteCapacityProfile();

  const [form, setForm] = useState<Partial<CapacityProfileRow>>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveForm = async () => {
    if (!form.name?.trim()) {
      setError('Profile name is required');
      return;
    }
    try {
      if (editingId) await updateProfile.mutateAsync({ id: editingId, fields: form });
      else await createProfile.mutateAsync(form);
      setForm(EMPTY);
      setEditingId(null);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    }
  };

  const startEdit = (p: CapacityProfileRow) => {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description ?? '', max_quantity: p.max_quantity ?? undefined, max_weight_kg: p.max_weight_kg ?? undefined, max_volume_m3: p.max_volume_m3 ?? undefined, max_pallets: p.max_pallets ?? undefined });
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Boxes size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-zinc-900 m-0">Capacity Profiles</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"><X size={15} /></Button>
        </div>

        {/* Form */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2">
          <input className={inputCls()} placeholder="Profile name *" value={form.name ?? ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className={inputCls()} placeholder="Description (optional)" value={form.description ?? ''}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Max Qty" value={form.max_quantity} onChange={v => setForm(f => ({ ...f, max_quantity: v }))} />
            <NumField label="Max Weight (kg)" value={form.max_weight_kg} onChange={v => setForm(f => ({ ...f, max_weight_kg: v }))} />
            <NumField label="Max Volume (m³)" value={form.max_volume_m3} onChange={v => setForm(f => ({ ...f, max_volume_m3: v }))} />
            <NumField label="Max Pallets" value={form.max_pallets} onChange={v => setForm(f => ({ ...f, max_pallets: v }))} />
          </div>
          {error && <div className="text-[11px] font-semibold text-red-600">{error}</div>}
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setForm(EMPTY); }}
                className="px-3 py-1.5 rounded-md border border-zinc-200 bg-white text-zinc-600 text-[11px] font-semibold hover:bg-zinc-100 transition-all">
                Cancel
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={saveForm} disabled={createProfile.isPending || updateProfile.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all disabled:opacity-50">
              {createProfile.isPending || updateProfile.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {editingId ? 'Update' : 'Add profile'}
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Saved profiles</div>
          {isLoading && <div className="text-xs text-zinc-400 py-2">Loading…</div>}
          {!isLoading && profiles?.length === 0 && (
            <div className="text-xs text-zinc-400 italic py-2">No profiles yet — create one above, then apply it to a layout.</div>
          )}
          {profiles?.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 p-2.5 hover:border-zinc-300 transition-all">
              <div className="min-w-0">
                <div className="text-xs font-bold text-zinc-800 truncate">{p.name}</div>
                <div className="text-[10.5px] text-zinc-500 truncate">
                  {p.max_quantity ? `${p.max_quantity} qty` : '— qty'}
                  {p.max_weight_kg ? ` · ${p.max_weight_kg} kg` : ''}
                  {p.max_volume_m3 ? ` · ${p.max_volume_m3} m³` : ''}
                  {p.max_pallets ? ` · ${p.max_pallets} pallets` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onApply && (
                  <Button variant="ghost" size="sm" onClick={() => onApply(p)} title="Apply max qty to current layout"
                    className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 hover:bg-blue-100 transition-all">
                    Apply
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => startEdit(p)} title="Edit"
                  className="p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                  <Plus size={12} className="rotate-45" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteProfile.mutate(p.id)} title="Delete"
                  className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all">
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value?: number | null; onChange: (v: number | undefined) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-zinc-500">{label}</span>
      <input type="number" className={inputCls()} value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
    </label>
  );
}

const inputCls = () =>
  `w-full h-8 px-2.5 rounded-md border border-zinc-200 text-xs text-zinc-800 bg-white outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100`;
