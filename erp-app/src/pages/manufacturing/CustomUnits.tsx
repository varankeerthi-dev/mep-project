import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

type CustomUnitsProps = {
  onNavigate: (path: string) => void;
};

type CustomUnit = {
  id: string;
  unit_name: string;
  unit_symbol: string;
  unit_type: string;
  conversion_to_base: number | null;
  base_unit: string | null;
  is_predefined: boolean;
  organisation_id: string | null;
  created_at: string;
};

const UNIT_TYPES = ['length', 'weight', 'count', 'area', 'volume', 'custom'];
const PAGE_SIZE = 10;

export default function CustomUnits({ onNavigate }: CustomUnitsProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editUnit, setEditUnit] = useState<CustomUnit | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    unit_name: '',
    unit_symbol: '',
    unit_type: 'custom',
    conversion_to_base: '',
    base_unit: ''
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: units, isLoading } = useQuery({
    queryKey: ['custom-units', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('custom_units')
        .select('*')
        .or(`organisation_id.is.null,organisation_id.eq.${organisation.id}`)
        .order('unit_type')
        .order('unit_name');
      if (error) throw error;
      return (data || []) as CustomUnit[];
    },
    enabled: !!organisation?.id
  });

  const totalPages = units ? Math.ceil(units.length / PAGE_SIZE) : 1;
  const pagedData = units?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  const saveUnit = useMutation({
    mutationFn: async () => {
      if (!organisation?.id) throw new Error('Not authenticated');
      if (!formData.unit_name || !formData.unit_symbol) throw new Error('Name and symbol required');

      const payload = {
        unit_name: formData.unit_name,
        unit_symbol: formData.unit_symbol,
        unit_type: formData.unit_type,
        conversion_to_base: formData.conversion_to_base ? Number(formData.conversion_to_base) : null,
        base_unit: formData.base_unit || null,
        organisation_id: organisation.id
      };

      if (editUnit) {
        const { error } = await supabase
          .from('custom_units')
          .update(payload)
          .eq('id', editUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_units')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-units'] });
      setShowForm(false);
      setEditUnit(null);
      setFormData({ unit_name: '', unit_symbol: '', unit_type: 'custom', conversion_to_base: '', base_unit: '' });
    }
  });

  const deleteUnit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_units').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-units'] })
  });

  const openEdit = (unit: CustomUnit) => {
    setEditUnit(unit);
    setFormData({
      unit_name: unit.unit_name,
      unit_symbol: unit.unit_symbol,
      unit_type: unit.unit_type,
      conversion_to_base: unit.conversion_to_base?.toString() || '',
      base_unit: unit.base_unit || ''
    });
    setShowForm(true);
    setOpenMenuId(null);
  };

  const typeColors: Record<string, string> = {
    length: 'bg-blue-100 text-blue-700',
    weight: 'bg-green-100 text-green-700',
    count: 'bg-purple-100 text-purple-700',
    area: 'bg-orange-100 text-orange-700',
    volume: 'bg-cyan-100 text-cyan-700',
    custom: 'bg-zinc-100 text-zinc-600'
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Custom Units</h1>
          <p className="text-zinc-500 mt-1">Manage measurement units for BOMs and inventory</p>
        </div>
        <button
          onClick={() => { setEditUnit(null); setFormData({ unit_name: '', unit_symbol: '', unit_type: 'custom', conversion_to_base: '', base_unit: '' }); setShowForm(true); }}
          className="h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Add Unit
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Unit Name</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Symbol</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Type</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Base Unit</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Conversion</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Source</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-zinc-500 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="h-4 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : pagedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No custom units found. Add your first unit to get started.
                  </td>
                </tr>
              ) : (
                pagedData.map((unit) => (
                  <tr key={unit.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-6 py-4 font-medium text-zinc-900">{unit.unit_name}</td>
                    <td className="px-6 py-4 text-zinc-700 font-mono">{unit.unit_symbol}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${typeColors[unit.unit_type] || 'bg-zinc-100 text-zinc-600'}`}>
                        {unit.unit_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-700">{unit.base_unit || '-'}</td>
                    <td className="px-6 py-4 text-zinc-700">{unit.conversion_to_base ?? '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${unit.is_predefined ? 'bg-zinc-100 text-zinc-500' : 'bg-green-100 text-green-700'}`}>
                        {unit.is_predefined ? 'System' : 'Custom'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!unit.is_predefined && (
                        <div className="relative inline-block" ref={openMenuId === unit.id ? menuRef : undefined}>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === unit.id ? null : unit.id)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <circle cx="10" cy="4" r="1.5" />
                              <circle cx="10" cy="10" r="1.5" />
                              <circle cx="10" cy="16" r="1.5" />
                            </svg>
                          </button>
                          {openMenuId === unit.id && (
                            <div className="absolute right-0 mt-1 w-40 bg-white border border-zinc-200 rounded-lg shadow-lg z-10 py-1">
                              <button onClick={() => openEdit(unit)} className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                                Edit
                              </button>
                              <button onClick={() => { deleteUnit.mutate(unit.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {units && units.length > 0 && (
          <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, units.length)} of {units.length} unit{units.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 px-3 border border-zinc-200 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded text-sm font-medium ${p === page ? 'bg-blue-600 text-white' : 'text-zinc-700 hover:bg-zinc-50'}`}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="h-8 px-3 border border-zinc-200 rounded text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-zinc-900 mb-4">{editUnit ? 'Edit Unit' : 'Add Custom Unit'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Unit Name *</label>
                <input type="text" value={formData.unit_name} onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                  placeholder="e.g. kilograms" className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Symbol *</label>
                <input type="text" value={formData.unit_symbol} onChange={(e) => setFormData({ ...formData, unit_symbol: e.target.value })}
                  placeholder="e.g. kg" className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Type</label>
                <select value={formData.unit_type} onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500">
                  {UNIT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Conversion to Base</label>
                <input type="number" step="any" value={formData.conversion_to_base} onChange={(e) => setFormData({ ...formData, conversion_to_base: e.target.value })}
                  placeholder="e.g. 1000 (1 kg = 1000 g)" className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Base Unit</label>
                <input type="text" value={formData.base_unit} onChange={(e) => setFormData({ ...formData, base_unit: e.target.value })}
                  placeholder="e.g. g" className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditUnit(null); }}
                className="flex-1 h-10 px-5 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors">Cancel</button>
              <button onClick={() => saveUnit.mutate()} disabled={saveUnit.isPending}
                className="flex-1 h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saveUnit.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
