// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';

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
      <div className="overflow-x-auto w-full">
        <table className="w-full" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif' }}>
          <thead>
            <tr>
              <th className="h-10 px-2 text-left align-middle text-sm font-medium text-black">Category Name</th>
              <th className="h-10 px-2 text-left align-middle text-sm font-medium text-black">Description</th>
              <th className="h-10 px-2 text-center align-middle text-sm font-medium text-black">Active</th>
              <th className="h-10 px-2 text-right align-middle text-sm font-medium text-black min-w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.map((c, i) => (
              <tr key={c.id} className={`${i < filteredCategories.length - 1 ? 'border-b border-[#E5E5E5]' : ''} hover:bg-[#F5F5F5] transition-colors`} style={{ opacity: c.is_active === false ? 0.5 : 1 }}>
                <td className="p-2 align-middle whitespace-nowrap text-sm font-medium text-black">{c.category_name}</td>
                <td className="p-2 align-middle whitespace-nowrap text-sm text-black">{c.description || '-'}</td>
                <td className="p-2 text-center align-middle">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-2 text-right align-middle">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => editCategory(c)} className="hover:text-[oklch(52%_0.105_223.1)] hover:font-bold" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 500, color: '#000000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                    <button onClick={() => deleteCategory(c.id)} className="hover:text-[oklch(52%_0.105_223.1)] hover:font-bold" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif', fontSize: '14px', fontWeight: 500, color: '#000000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', padding: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
              <h2 style={{ fontFamily: '"Inter", system-ui, sans-serif', fontSize: '16px', fontWeight: 600, color: '#0C0A09', margin: 0 }}>{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#79716B', padding: '4px' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
              <div className="flex flex-col w-full gap-5" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
                <div className="flex flex-col w-full gap-2">
                  <label className="text-[12px] leading-[100%] text-[#0C0A09]">Category Name *</label>
                  <input
                    type="text"
                    value={formData.category_name}
                    onChange={e => setFormData({...formData, category_name: e.target.value})}
                    required
                    className="h-8 w-full min-w-0 px-2.5 py-1 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none"
                    style={{ borderWidth: '0.888889px' }}
                    placeholder="e.g. HVAC"
                  />
                </div>
                <div className="flex flex-col w-full gap-2">
                  <label className="text-[12px] leading-[100%] text-[#0C0A09]">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full min-w-0 px-2.5 py-2 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none resize-none"
                    style={{ borderWidth: '0.888889px', minHeight: '64px' }}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center shrink-0 bg-[oklch(52%_0.105_223.1)] border border-[oklch(52%_0.105_223.1)]" style={{ width: '16px', height: '16px' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData({...formData, is_active: e.target.checked})}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {formData.is_active && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" style={{ overflow: 'clip' }}>
                        <path d="M5 14L8.5 17.5L19 6.5" fill="none" stroke="oklch(98.4% 0.019 200.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <label className="text-[12px] leading-[100%] text-[#0C0A09] cursor-pointer">Active</label>
                </div>
                <div className="flex gap-3 justify-end pt-1">
                  <button type="submit" style={{ height: '32px', padding: '0 16px', fontSize: '12px', fontWeight: 500, background: 'oklch(52% 0.105 223.1)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{editingCategory ? 'Update' : 'Save'}</button>
                  <button type="button" onClick={resetForm} style={{ height: '32px', padding: '0 16px', fontSize: '12px', fontWeight: 500, background: 'transparent', color: '#79716B', border: '1px solid #E7E5E4', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
