// @ts-nocheck
import { useState } from 'react';
import { supabase } from '../../../supabase';
import { useVariants } from '../../../hooks/useVariants';
import { Button } from '../../../components/ui/button';

export function VariantsTab() {
  const { data: variants = [], isLoading: loading } = useVariants();
  const [showForm, setShowForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ variant_name: '', is_active: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingVariant) {
      await supabase.from('company_variants').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editingVariant.id);
    } else {
      await supabase.from('company_variants').insert(formData);
    }
    resetForm();
  };

  const resetForm = () => { setShowForm(false); setEditingVariant(null); setFormData({ variant_name: '', is_active: true }); };

  const editVariant = (v) => { setEditingVariant(v); setFormData({ variant_name: v.variant_name, is_active: v.is_active !== false }); setShowForm(true); };
  const deleteVariant = async (id) => { if (confirm('Delete this category? This may affect existing pricing.')) { await supabase.from('company_variants').delete().eq('id', id); }};

  const filteredVariants = variants.filter(v => v.variant_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Discount Categories</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Category</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <p style={{ color: '#666', marginBottom: '10px' }}>Discount Categories group your items for tiered pricing (e.g., Pipe, Hardware, Electrical). Each item can have different sale/purchase prices per category, and quotations can apply category-specific discounts.</p>
        <input type="text" className="form-input" placeholder="Search categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="h-10 pl-4 pr-3 text-left align-middle text-xs font-semibold text-zinc-500">Category Name</th>
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold text-zinc-500">Active</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Created</th>
                <th className="h-10 pl-3 pr-3 text-right align-middle text-xs font-semibold text-zinc-500 min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredVariants.map(v => (
                <tr key={v.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors" style={{ opacity: v.is_active === false ? 0.5 : 1 }}>
                  <td className="pl-4 py-3 align-middle whitespace-nowrap text-sm font-semibold text-zinc-700">{v.variant_name}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {v.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{v.created_at ? new Date(v.created_at).toLocaleDateString() : '-'}</td>
                  <td className="pr-3 py-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-[15px]">
                      <Button size="sm" variant="outline" onClick={() => editVariant(v)} className="text-xs">Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteVariant(v.id)} className="text-xs">Delete</Button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingVariant ? 'Edit Category' : 'Add Category'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Category Name *</label><input type="text" className="form-input" value={formData.variant_name} onChange={e => setFormData({...formData, variant_name: e.target.value})} placeholder="e.g., Retail, Wholesale, Export" required /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingVariant ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
