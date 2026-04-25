import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  getProjectMaterialList, 
  addMaterialToProjectList, 
  updateProjectMaterialList, 
  deleteFromProjectMaterialList 
} from '../material-usage/api';
import { useMaterials } from '../hooks/useMaterials';
import { useVariants } from '../hooks/useVariants';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';

interface ProjectProps {
  projectId: string;
  organisationId: string;
}

export default function ProjectMaterialList({ projectId, organisationId }: ProjectProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: materials } = useMaterials();
  const { data: variants } = useVariants();

  if (!organisationId) {
    return <div className="p-6 text-center text-red-600">Organisation ID is required</div>;
  }
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    item_id: '',
    variant_id: '',
    planned_qty: '',
    unit: '',
    rate: '',
    remarks: ''
  });

  const { data: materialList = [], isLoading } = useQuery({
    queryKey: ['projectMaterialList', projectId],
    queryFn: () => getProjectMaterialList(projectId),
    enabled: !!projectId
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => addMaterialToProjectList({
      ...data,
      project_id: projectId,
      organisation_id: organisationId
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMaterialList', projectId] });
      setShowAddForm(false);
      setFormData({ item_id: '', variant_id: '', planned_qty: '', unit: '', rate: '', remarks: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      updateProjectMaterialList(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMaterialList', projectId] });
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFromProjectMaterialList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMaterialList', projectId] });
    }
  });

  const handleAdd = () => {
    if (!formData.item_id || !formData.planned_qty || !formData.unit || !formData.rate) {
      alert('Please fill in all required fields');
      return;
    }
    addMutation.mutate({
      item_id: formData.item_id,
      variant_id: formData.variant_id || null,
      planned_qty: parseFloat(formData.planned_qty),
      unit: formData.unit,
      rate: parseFloat(formData.rate),
      remarks: formData.remarks || null
    });
  };

  const handleUpdate = (id: string) => {
    if (!formData.planned_qty || !formData.unit || !formData.rate) {
      alert('Please fill in all required fields');
      return;
    }
    updateMutation.mutate({
      id,
      updates: {
        planned_qty: parseFloat(formData.planned_qty),
        unit: formData.unit,
        rate: parseFloat(formData.rate),
        remarks: formData.remarks || null
      }
    });
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      item_id: item.item_id,
      variant_id: item.variant_id || '',
      planned_qty: item.planned_qty.toString(),
      unit: item.unit,
      rate: item.rate.toString(),
      remarks: item.remarks || ''
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this material from the list?')) {
      deleteMutation.mutate(id);
    }
  };

  const getMaterialName = (itemId: string) => {
    const material = materials?.find(m => m.id === itemId);
    return material?.name || 'Unknown';
  };

  const getVariantName = (variantId: string | null) => {
    if (!variantId) return '';
    const variant = variants?.find(v => v.id === variantId);
    return variant?.variant_name || '';
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading material list...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Project Material List</h2>
          <p className="text-sm text-gray-600">Add materials to track planned quantities and rates</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Material
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
          <h3 className="font-medium mb-4">Add New Material</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Material *</label>
              <select
                value={formData.item_id}
                onChange={(e) => {
                  const selectedMaterial = materials?.find(m => m.id === e.target.value);
                  setFormData({ 
                    ...formData, 
                    item_id: e.target.value,
                    unit: selectedMaterial?.unit || ''
                  });
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select material</option>
                {materials?.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Variant</label>
              <select
                value={formData.variant_id}
                onChange={(e) => setFormData({ ...formData, variant_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">No variant</option>
                {variants?.map(v => (
                  <option key={v.id} value={v.id}>{v.variant_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Planned Quantity *</label>
              <input
                type="number"
                step="0.01"
                value={formData.planned_qty}
                onChange={(e) => setFormData({ ...formData, planned_qty: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit *</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="nos, kg, m, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rate *</label>
              <input
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Remarks</label>
              <input
                type="text"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {addMutation.isPending ? 'Adding...' : 'Add Material'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {materialList.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <p className="text-gray-500">No materials added yet. Click "Add Material" to start tracking.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Material</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Variant</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Planned Qty</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Unit</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Rate</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Planned Cost</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Remarks</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {materialList.map((item: any) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  {editingId === item.id ? (
                    <>
                      <td className="px-4 py-3">
                        <select
                          value={formData.item_id}
                          onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                          disabled
                        >
                          <option value={item.item_id}>{getMaterialName(item.item_id)}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm">{getVariantName(item.variant_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.planned_qty}
                          onChange={(e) => setFormData({ ...formData, planned_qty: e.target.value })}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          className="w-20 px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.rate}
                          onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {((parseFloat(formData.planned_qty) || 0) * (parseFloat(formData.rate) || 0)).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={formData.remarks}
                          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleUpdate(item.id)}
                            disabled={updateMutation.isPending}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium">{getMaterialName(item.item_id)}</td>
                      <td className="px-4 py-3 text-sm">{getVariantName(item.variant_id)}</td>
                      <td className="px-4 py-3 text-right">{item.planned_qty}</td>
                      <td className="px-4 py-3">{item.unit}</td>
                      <td className="px-4 py-3 text-right">{item.rate?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-right font-medium">{((item.planned_qty || 0) * (item.rate || 0)).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.remarks || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
