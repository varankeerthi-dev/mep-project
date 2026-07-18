// @ts-nocheck
import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { useUnits } from '../../../hooks/useUnits';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/Modal';
import { Checkbox } from '../../../components/ui/checkbox';

export function UnitTab() {
  const { data: units = [], isLoading: loading } = useUnits();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ unit_name: '', unit_code: '', description: '', is_active: true });

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: any) => {
      if (editingUnit) {
        const { error } = await supabase.from('item_units').update(dataToSave).eq('id', editingUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_units').insert(dataToSave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', organisation?.id] });
      resetForm();
    },
    onError: (err: any) => {
      alert('Error saving unit: ' + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('item_units').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', organisation?.id] });
    },
    onError: (err: any) => {
      alert('Error deleting unit: ' + err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData, organisation_id: organisation?.id };
    saveMutation.mutate(dataToSave);
  };

  const resetForm = () => { setShowForm(false); setEditingUnit(null); setFormData({ unit_name: '', unit_code: '', description: '', is_active: true }); };

  const editUnit = (unit: any) => { setEditingUnit(unit); setFormData({ unit_name: unit.unit_name, unit_code: unit.unit_code, description: unit.description || '', is_active: unit.is_active !== false }); setShowForm(true); };
  const deleteUnit = (id: string) => { if (confirm('Delete this unit?')) { deleteMutation.mutate(id); }};

  const filteredUnits = units.filter((u: any) => u.unit_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.unit_code?.toLowerCase().includes(searchTerm.toLowerCase()));

  const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle = { minWidth: '80px', maxWidth: '80px', fontWeight: 600, fontSize: '11px', color: '#374151' };
  const fieldColStyle = { flex: 1 };
  
  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Units</h1><Button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Unit</Button></div>
      <div className="card" style={{ marginBottom: '16px' }}><Input type="text" className="form-input" placeholder="Search units..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="h-10 pl-4 pr-3 text-left align-middle text-xs font-semibold text-zinc-500">Unit Name</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Unit</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Description</th>
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold text-zinc-500">Active</th>
                <th className="h-10 pl-3 pr-3 text-right align-middle text-xs font-semibold text-zinc-500 min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredUnits.map((u: any) => (
                <tr key={u.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors" style={{ opacity: u.is_active === false ? 0.5 : 1 }}>
                  <td className="pl-4 py-3 align-middle whitespace-nowrap text-sm font-semibold text-zinc-700">{u.unit_name}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{u.unit_code}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{u.description || '-'}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="pr-3 py-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-[15px]">
                      <Button size="sm" variant="outline" onClick={() => editUnit(u)} className="text-xs">Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteUnit(u.id)} className="text-xs">Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal 
        isOpen={showForm} 
        onClose={resetForm} 
        title={editingUnit ? 'Edit Unit' : 'Add Unit'} 
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={resetForm} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saveMutation.isPending} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#185FA5', border: '1px solid #185FA5', color: '#fff' }}>{editingUnit ? 'Update' : 'Save'}</Button>
          </>
        }
      >
        <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {renderHeaderField('Unit Name *', <Input value={formData.unit_name} onChange={e => setFormData({...formData, unit_name: e.target.value})} required style={{ padding: '4px 8px', fontSize: '12px' }} />)}
            {renderHeaderField('Unit *', <Input value={formData.unit_code} onChange={e => setFormData({...formData, unit_code: e.target.value})} required style={{ padding: '4px 8px', fontSize: '12px' }} />)}
            {renderHeaderField('Description', <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ padding: '4px 8px', fontSize: '12px' }} />)}
            {renderHeaderField('Status', <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}><Checkbox checked={formData.is_active} onCheckedChange={(checked: boolean) => setFormData({...formData, is_active: checked})} /> Active</label>, true)}
          </div>
        </div>
      </Modal>
    </div>
  );
}
