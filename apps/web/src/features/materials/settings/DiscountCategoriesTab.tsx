// @ts-nocheck
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../../components/ui/button';

export function DiscountCategoriesTab() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const { data: discountCategories = [], isLoading } = useQuery({
    queryKey: ['discountCategories', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase.from('discount_categories').select('*').or(`organisation_id.eq.${organisation.id},organisation_id.is.null`).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', default_discount_percent: 0, min_discount_percent: 0, max_discount_percent: 100, is_active: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      await supabase.from('discount_categories').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('discount_categories').insert({ ...formData, organisation_id: organisation?.id });
    }
    resetForm();
    queryClient.invalidateQueries({ queryKey: ['discountCategories'] });
  };

  const resetForm = () => { setShowForm(false); setEditing(null); setFormData({ name: '', default_discount_percent: 0, min_discount_percent: 0, max_discount_percent: 100, is_active: true }); };

  const editItem = (item) => { setEditing(item); setFormData({ name: item.name, default_discount_percent: item.default_discount_percent ?? 0, min_discount_percent: item.min_discount_percent ?? 0, max_discount_percent: item.max_discount_percent ?? 100, is_active: item.is_active !== false }); setShowForm(true); };
  const deleteItem = async (id) => { if (confirm('Delete this discount category?')) { await supabase.from('discount_categories').delete().eq('id', id); queryClient.invalidateQueries({ queryKey: ['discountCategories'] }); }};

  const filtered = discountCategories.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Discount Categories</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Discount Category</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <p style={{ color: '#666', marginBottom: '10px' }}>Discount categories group items for bulk discounting in quotations. Each category has configurable min/max discount limits.</p>
        <input type="text" className="form-input" placeholder="Search discount categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl" style={{ padding: '24px' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: '#6b7280' }}>Name</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 600, fontSize: '11px', color: '#6b7280' }}>Default Disc %</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 600, fontSize: '11px', color: '#6b7280' }}>Min Disc %</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 600, fontSize: '11px', color: '#6b7280' }}>Max Disc %</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 600, fontSize: '11px', color: '#6b7280' }}>Active</th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontWeight: 600, fontSize: '11px', color: '#6b7280', minWidth: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors" style={{ opacity: c.is_active === false ? 0.5 : 1 }}>
                  <td style={{ padding: '12px 24px', textAlign: 'left', fontWeight: 600, fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 500, fontSize: '12px', color: '#6b7280' }}>{c.default_discount_percent ?? '-'}%</td>
                  <td style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 500, fontSize: '12px', color: '#6b7280' }}>{c.min_discount_percent ?? '-'}%</td>
                  <td style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 500, fontSize: '12px', color: '#6b7280' }}>{c.max_discount_percent ?? '-'}%</td>
                  <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, background: c.is_active ? '#f0fdf4' : '#f4f4f5', color: c.is_active ? '#166534' : '#52525b' }}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '15px' }}>
                      <Button size="sm" variant="outline" onClick={() => editItem(c)} style={{ fontSize: '11px' }}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteItem(c.id)} style={{ fontSize: '11px' }}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editing ? 'Edit Discount Category' : 'Add Discount Category'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Name *</label><input type="text" className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Pipe Discount, Hardware Discount" required /></div>
              <div className="form-group"><label className="form-label">Default Discount %</label><input type="number" className="form-input" value={formData.default_discount_percent} onChange={e => setFormData({...formData, default_discount_percent: parseFloat(e.target.value) || 0})} step="0.01" min="0" max="100" /></div>
              <div className="form-group"><label className="form-label">Min Discount %</label><input type="number" className="form-input" value={formData.min_discount_percent} onChange={e => setFormData({...formData, min_discount_percent: parseFloat(e.target.value) || 0})} step="0.01" min="0" max="100" /></div>
              <div className="form-group"><label className="form-label">Max Discount %</label><input type="number" className="form-input" value={formData.max_discount_percent} onChange={e => setFormData({...formData, max_discount_percent: parseFloat(e.target.value) || 0})} step="0.01" min="0" max="100" /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
