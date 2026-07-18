// @ts-nocheck
import { useState } from 'react';
import { supabase } from '../../../supabase';
import { useWarehouses } from '../../../hooks/useWarehouses';
import { Button } from '../../../components/ui/button';

export function WarehousesTab() {
  const { data: warehouses = [], isLoading: loading } = useWarehouses();
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ warehouse_code: '', warehouse_name: '', location: '', is_default: false, is_active: true });

  const generateWarehouseCode = () => 'WH-' + Date.now().toString(36).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      warehouse_code: formData.warehouse_code || generateWarehouseCode(),
      warehouse_name: formData.warehouse_name,
      location: formData.location || null,
      is_default: formData.is_default,
      is_active: formData.is_active,
    };
    
    if (formData.is_default) {
      await supabase.from('warehouses').update({ is_default: false }).eq('is_default', true);
    }
    
    if (editingWarehouse) {
      await supabase.from('warehouses').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingWarehouse.id);
    } else {
      await supabase.from('warehouses').insert(data);
    }
    resetForm();
  };

  const resetForm = () => { setShowForm(false); setEditingWarehouse(null); setFormData({ warehouse_code: '', warehouse_name: '', location: '', is_default: false, is_active: true }); };

  const editWarehouse = (w) => { setEditingWarehouse(w); setFormData({ warehouse_code: w.warehouse_code || '', warehouse_name: w.warehouse_name, location: w.location || '', is_default: w.is_default || false, is_active: w.is_active !== false }); setShowForm(true); };
  const deleteWarehouse = async (id) => { if (confirm('Delete this warehouse?')) { await supabase.from('warehouses').delete().eq('id', id); }};

  const filteredWarehouses = warehouses.filter(w => w.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase()) || w.warehouse_code?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Warehouses</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Warehouse</button></div>
      <div className="card" style={{ marginBottom: '16px' }}><input type="text" className="form-input" placeholder="Search warehouses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="h-10 pl-4 pr-3 text-left align-middle text-xs font-semibold text-zinc-500">Warehouse Code</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Warehouse Name</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Location</th>
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold text-zinc-500">Default</th>
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold text-zinc-500">Active</th>
                <th className="h-10 pl-3 pr-3 text-right align-middle text-xs font-semibold text-zinc-500 min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredWarehouses.map(w => (
                <tr key={w.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors" style={{ opacity: w.is_active === false ? 0.5 : 1 }}>
                  <td className="pl-4 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{w.warehouse_code}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-semibold text-zinc-700">{w.warehouse_name || w.name}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{w.location || '-'}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${w.is_default ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-400'}`}>
                      {w.is_default ? 'Default' : '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${w.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {w.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="pr-3 py-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-[15px]">
                      <Button size="sm" variant="outline" onClick={() => editWarehouse(w)} className="text-xs">Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteWarehouse(w.id)} className="text-xs">Delete</Button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Warehouse Name *</label><input type="text" className="form-input" value={formData.warehouse_name} onChange={e => setFormData({...formData, warehouse_name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Warehouse Code</label><input type="text" className="form-input" value={formData.warehouse_code} onChange={e => setFormData({...formData, warehouse_code: e.target.value})} placeholder="Auto-generated if empty" /></div>
              </div>
              <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_default} onChange={e => setFormData({...formData, is_default: e.target.checked})} /> Set as Default Warehouse</label></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingWarehouse ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
