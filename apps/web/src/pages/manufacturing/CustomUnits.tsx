import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Table, ColumnDef, RowAction } from '../../components/table';
import { Button } from '../../components/ui/button';

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

const typeColors: Record<string, { bg: string; text: string }> = {
  length: { bg: 'bg-blue-50', text: 'text-blue-700' },
  weight: { bg: 'bg-green-50', text: 'text-green-700' },
  count: { bg: 'bg-purple-50', text: 'text-purple-700' },
  area: { bg: 'bg-orange-50', text: 'text-orange-700' },
  volume: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
  custom: { bg: 'bg-zinc-50', text: 'text-zinc-600' },
};

const columns: ColumnDef<CustomUnit>[] = [
  {
    header: 'Unit Name',
    accessorKey: 'unit_name',
    id: 'unit_name',
    type: 'text',
    cell: ({ row }) => (
      <span className="font-medium text-zinc-900">{row.unit_name}</span>
    ),
  },
  {
    header: 'Symbol',
    accessorKey: 'unit_symbol',
    id: 'unit_symbol',
    type: 'text',
    cell: ({ row }) => (
      <span className="font-mono text-zinc-700">{row.unit_symbol}</span>
    ),
  },
  {
    header: 'Type',
    id: 'unit_type',
    type: 'status',
    statusType: (row) => {
      const map: Record<string, 'blue' | 'success' | 'warning' | 'neutral'> = {
        length: 'blue', weight: 'success', count: 'warning',
        area: 'warning', volume: 'blue', custom: 'neutral'
      };
      return map[row.unit_type] || 'neutral';
    },
    cell: ({ row }) => {
      const colors = typeColors[row.unit_type] || typeColors.custom;
      return (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}>
          {row.unit_type}
        </span>
      );
    },
  },
  {
    header: 'Base Unit',
    accessorKey: 'base_unit',
    id: 'base_unit',
    type: 'text',
    cell: ({ row }) => (
      <span className="text-zinc-700">{row.base_unit || '-'}</span>
    ),
  },
  {
    header: 'Conversion',
    accessorKey: 'conversion_to_base',
    id: 'conversion_to_base',
    type: 'number',
    cell: ({ row }) => (
      <span className="text-zinc-700">{row.conversion_to_base ?? '-'}</span>
    ),
  },
  {
    header: 'Source',
    id: 'source',
    type: 'status',
    statusType: (row) => (row.is_predefined ? 'neutral' : 'success'),
    cell: ({ row }) => (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${row.is_predefined ? 'bg-zinc-100 text-zinc-500' : 'bg-green-50 text-green-700'}`}>
        {row.is_predefined ? 'System' : 'Custom'}
      </span>
    ),
  },
];

export default function CustomUnits({ onNavigate }: CustomUnitsProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editUnit, setEditUnit] = useState<CustomUnit | null>(null);
  const [formData, setFormData] = useState({
    unit_name: '',
    unit_symbol: '',
    unit_type: 'custom',
    conversion_to_base: '',
    base_unit: ''
  });

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

  const pagedData = units?.slice((page - 1) * 12, page * 12) || [];

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
        const { error } = await supabase.from('custom_units').update(payload).eq('id', editUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('custom_units').insert(payload);
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
  };

  const getRowActions = (row: CustomUnit): RowAction[] => {
    if (row.is_predefined) return [];
    return [
      { label: 'Edit', onClick: () => openEdit(row) },
      { label: 'Delete', variant: 'danger', onClick: () => deleteUnit.mutate(row.id) },
    ];
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Custom Units</h1>
          <p className="text-zinc-500 mt-1">Manage measurement units for BOMs and inventory</p>
        </div>
        <Button
          onClick={() => { setEditUnit(null); setFormData({ unit_name: '', unit_symbol: '', unit_type: 'custom', conversion_to_base: '', base_unit: '' }); setShowForm(true); }}
          className="h-10 px-5"
        >
          Add Unit
        </Button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg">
        <Table<CustomUnit>
          data={pagedData}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={12}
          totalRows={units?.length || 0}
          pagination
          onPageChange={setPage}
          rowActions={getRowActions}
          emptyTitle="No custom units found"
          emptySubtitle="Add your first unit to get started."
        />
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
              <Button variant="secondary" className="flex-1" onClick={() => { setShowForm(false); setEditUnit(null); }}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveUnit.mutate()} disabled={saveUnit.isPending} loading={saveUnit.isPending} loadingText="Saving...">
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
