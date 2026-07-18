// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';
import { Button } from '../../../components/ui/button';

export function CategoryTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ category_name: '', description: '', is_active: true });

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('item_categories').select('*').order('category_name');
      setCategories(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const { error } = await supabase.from('item_categories').update(formData).eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_categories').insert(formData);
        if (error) throw error;
      }
      resetForm();
      loadCategories();
    } catch (err) {
      alert('Error saving category: ' + err.message);
    }
  };

  const resetForm = () => { setShowForm(false); setEditingCategory(null); setFormData({ category_name: '', description: '', is_active: true }); };

  const editCategory = (cat) => { setEditingCategory(cat); setFormData({ category_name: cat.category_name, description: cat.description || '', is_active: cat.is_active !== false }); setShowForm(true); };
  const deleteCategory = async (id) => { if (confirm('Delete this category?')) { await supabase.from('item_categories').delete().eq('id', id); loadCategories(); }};

  const filteredCategories = categories.filter(c => c.category_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Categories</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Category</button></div>
      <div className="card" style={{ marginBottom: '16px' }}><input type="text" className="form-input" placeholder="Search categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="h-10 pl-4 pr-3 text-left align-middle text-xs font-semibold text-zinc-500">Category Name</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Description</th>
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold text-zinc-500">Active</th>
                <th className="h-10 pl-3 pr-3 text-right align-middle text-xs font-semibold text-zinc-500 min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredCategories.map(c => (
                <tr key={c.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors" style={{ opacity: c.is_active === false ? 0.5 : 1 }}>
                  <td className="pl-4 py-3 align-middle whitespace-nowrap text-sm font-semibold text-zinc-700">{c.category_name}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{c.description || '-'}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="pr-3 py-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-[15px]">
                      <Button size="sm" variant="outline" onClick={() => editCategory(c)} className="text-xs">Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteCategory(c.id)} className="text-xs">Delete</Button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingCategory ? 'Edit Category' : 'Add Category'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Category Name *</label><input type="text" className="form-input" value={formData.category_name} onChange={e => setFormData({...formData, category_name: e.target.value})} required /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingCategory ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
