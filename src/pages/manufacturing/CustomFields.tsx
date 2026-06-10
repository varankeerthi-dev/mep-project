import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

type CustomFieldsProps = {
  onNavigate: (path: string) => void;
};

type CustomField = {
  id: string;
  field_name: string;
  field_type: string;
  field_options: string[] | null;
  is_required: boolean;
  applies_to: string;
  sort_order: number;
  organisation_id: string;
  created_at: string;
};

const FIELD_TYPES = ['text', 'number', 'dropdown', 'checkbox', 'date'];
const APPLIES_TO = ['all', 'bom', 'job_card', 'production_entry'];
const PAGE_SIZE = 10;

export default function CustomFields({ onNavigate }: CustomFieldsProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editField, setEditField] = useState<CustomField | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    field_name: '',
    field_type: 'text',
    field_options: '',
    is_required: false,
    applies_to: 'all',
    sort_order: '0'
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: fields, isLoading } = useQuery({
    queryKey: ['custom-fields', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as CustomField[];
    },
    enabled: !!organisation?.id
  });

  const totalPages = fields ? Math.ceil(fields.length / PAGE_SIZE) : 1;
  const pagedData = fields?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  const saveField = useMutation({
    mutationFn: async () => {
      if (!organisation?.id) throw new Error('Not authenticated');
      if (!formData.field_name) throw new Error('Field name required');

      const options = formData.field_type === 'dropdown'
        ? formData.field_options.split(',').map(s => s.trim()).filter(Boolean)
        : null;

      const payload = {
        field_name: formData.field_name,
        field_type: formData.field_type,
        field_options: options,
        is_required: formData.is_required,
        applies_to: formData.applies_to,
        sort_order: Number(formData.sort_order) || 0,
        organisation_id: organisation.id
      };

      if (editField) {
        const { error } = await supabase.from('custom_fields').update(payload).eq('id', editField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('custom_fields').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      setShowForm(false);
      setEditField(null);
      setFormData({ field_name: '', field_type: 'text', field_options: '', is_required: false, applies_to: 'all', sort_order: '0' });
    }
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_fields').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
  });

  const openEdit = (field: CustomField) => {
    setEditField(field);
    setFormData({
      field_name: field.field_name,
      field_type: field.field_type,
      field_options: field.field_options?.join(', ') || '',
      is_required: field.is_required,
      applies_to: field.applies_to,
      sort_order: field.sort_order.toString()
    });
    setShowForm(true);
    setOpenMenuId(null);
  };

  const typeColors: Record<string, string> = {
    text: 'bg-blue-100 text-blue-700',
    number: 'bg-green-100 text-green-700',
    dropdown: 'bg-purple-100 text-purple-700',
    checkbox: 'bg-orange-100 text-orange-700',
    date: 'bg-cyan-100 text-cyan-700'
  };

  const appliesToLabels: Record<string, string> = {
    all: 'All Entities',
    bom: 'BOM',
    job_card: 'Job Card',
    production_entry: 'Production Entry'
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Custom Fields</h1>
          <p className="text-zinc-500 mt-1">Add custom data fields to manufacturing entities</p>
        </div>
        <button
          onClick={() => { setEditField(null); setFormData({ field_name: '', field_type: 'text', field_options: '', is_required: false, applies_to: 'all', sort_order: '0' }); setShowForm(true); }}
          className="h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Add Field
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Field Name</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Type</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Applies To</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Required</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Options</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">Order</th>
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
                    No custom fields found. Add your first field to get started.
                  </td>
                </tr>
              ) : (
                pagedData.map((field) => (
                  <tr key={field.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-6 py-4 font-medium text-zinc-900">{field.field_name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${typeColors[field.field_type] || 'bg-zinc-100 text-zinc-600'}`}>
                        {field.field_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-700">{appliesToLabels[field.applies_to] || field.applies_to}</td>
                    <td className="px-6 py-4">
                      {field.is_required ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Required</span>
                      ) : (
                        <span className="text-zinc-400 text-sm">Optional</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-500 text-sm">
                      {field.field_options ? field.field_options.join(', ') : '-'}
                    </td>
                    <td className="px-6 py-4 text-zinc-500 text-sm">{field.sort_order}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block" ref={openMenuId === field.id ? menuRef : undefined}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === field.id ? null : field.id)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="4" r="1.5" />
                            <circle cx="10" cy="10" r="1.5" />
                            <circle cx="10" cy="16" r="1.5" />
                          </svg>
                        </button>
                        {openMenuId === field.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-white border border-zinc-200 rounded-lg shadow-lg z-10 py-1">
                            <button onClick={() => openEdit(field)} className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">Edit</button>
                            <button onClick={() => { deleteField.mutate(field.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {fields && fields.length > 0 && (
          <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, fields.length)} of {fields.length} field{fields.length !== 1 ? 's' : ''}
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
            <h3 className="text-lg font-medium text-zinc-900 mb-4">{editField ? 'Edit Field' : 'Add Custom Field'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Field Name *</label>
                <input type="text" value={formData.field_name} onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                  placeholder="e.g. Color" className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Type</label>
                <select value={formData.field_type} onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500">
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              {formData.field_type === 'dropdown' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Options (comma separated)</label>
                  <input type="text" value={formData.field_options} onChange={(e) => setFormData({ ...formData, field_options: e.target.value })}
                    placeholder="e.g. Red, Blue, Green" className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Applies To</label>
                <select value={formData.applies_to} onChange={(e) => setFormData({ ...formData, applies_to: e.target.value })}
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500">
                  {APPLIES_TO.map(a => <option key={a} value={a}>{a === 'all' ? 'All Entities' : a.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="required" checked={formData.is_required} onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-zinc-300 rounded" />
                <label htmlFor="required" className="text-sm font-medium text-zinc-700">Required field</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Sort Order</label>
                <input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditField(null); }}
                className="flex-1 h-10 px-5 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors">Cancel</button>
              <button onClick={() => saveField.mutate()} disabled={saveField.isPending}
                className="flex-1 h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saveField.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
