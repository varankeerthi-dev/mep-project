import { useState, useEffect } from 'react';
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
import { Plus, Trash2, Edit, Save, X, ChevronDown, ChevronRight, MoreVertical, Eye } from 'lucide-react';

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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
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

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (dropdownOpen) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [dropdownOpen]);

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
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          {/* BOQ Section */}
          {materialList.filter((item: any) => item.is_boq !== false).length > 0 && (
            <>
              <div style={{ padding: '12px 16px', background: '#dbeafe', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>
                BOQ Materials
              </div>
              {/* Table Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 80px 80px 100px 100px 120px 80px', gap: '16px', padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                <div></div>
                <div>Material</div>
                <div>Variant</div>
                <div style={{ textAlign: 'right' }}>Planned Qty</div>
                <div>Unit</div>
                <div style={{ textAlign: 'right' }}>Rate</div>
                <div style={{ textAlign: 'right' }}>Planned Cost</div>
                <div>Remarks</div>
                <div style={{ textAlign: 'center' }}>Actions</div>
              </div>

              {/* BOQ Items */}
              {materialList.filter((item: any) => item.is_boq !== false).map((item: any) => (
                <div key={item.id}>
                  {/* Main Row */}
                  {editingId === item.id ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 80px 80px 100px 100px 120px 80px', gap: '16px', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', alignItems: 'center', fontSize: '14px' }}>
                      <div></div>
                      <div>
                        <select
                          value={formData.item_id}
                          onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px' }}
                          disabled
                        >
                          <option value={item.item_id}>{getMaterialName(item.item_id)}</option>
                        </select>
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '13px' }}>{getVariantName(item.variant_id)}</div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.planned_qty}
                          onChange={(e) => setFormData({ ...formData, planned_qty: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.rate}
                          onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: 500 }}>
                        {((parseFloat(formData.planned_qty) || 0) * (parseFloat(formData.rate) || 0)).toFixed(2)}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={formData.remarks}
                          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleUpdate(item.id)}
                          disabled={updateMutation.isPending}
                          style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                        >
                          <Save size={16} color="#22c55e" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                        >
                          <X size={16} color="#6b7280" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '40px 1fr 100px 80px 80px 100px 100px 120px 80px', 
                        gap: '16px', 
                        padding: '12px 16px', 
                        borderBottom: '1px solid #f3f4f6',
                        alignItems: 'center',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleRow(item.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {expandedRows.has(item.id) ? <ChevronDown size={18} color="#6b7280" /> : <ChevronRight size={18} color="#6b7280" />}
                      </div>
                      <div style={{ fontWeight: 500 }}>{getMaterialName(item.item_id)}</div>
                      <div style={{ color: '#6b7280', fontSize: '13px' }}>{getVariantName(item.variant_id)}</div>
                      <div style={{ textAlign: 'right' }}>{item.planned_qty}</div>
                      <div>{item.unit}</div>
                      <div style={{ textAlign: 'right' }}>{item.rate ? item.rate.toFixed(2) : '-'}</div>
                      <div style={{ textAlign: 'right', fontWeight: 500 }}>{item.rate ? ((item.planned_qty || 0) * item.rate).toFixed(2) : '-'}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.remarks || '-'}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                          style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                          title="Edit"
                        >
                          <Edit size={16} color="#6b7280" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                          title="Delete"
                        >
                          <Trash2 size={16} color="#6b7280" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Row - Material Details */}
                  {expandedRows.has(item.id) && editingId !== item.id && (
                    <div style={{ padding: '16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ marginBottom: '12px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                        Material Details
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', fontSize: '13px' }}>
                        <div>
                          <div style={{ color: '#6b7280', marginBottom: '4px' }}>Material ID</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.item_id}</div>
                        </div>
                        <div>
                          <div style={{ color: '#6b7280', marginBottom: '4px' }}>Variant ID</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.variant_id || '-'}</div>
                        </div>
                        <div>
                          <div style={{ color: '#6b7280', marginBottom: '4px' }}>Created At</div>
                          <div>{new Date(item.created_at).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <div style={{ color: '#6b7280', marginBottom: '4px' }}>Updated At</div>
                          <div>{new Date(item.updated_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Non-BOQ Section */}
          {materialList.filter((item: any) => item.is_boq === false).length > 0 && (
            <>
              <div style={{ padding: '12px 16px', background: '#fef3c7', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: 600, color: '#92400e' }}>
                Non-BOQ Materials
              </div>
              {/* Table Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 80px 80px 100px 100px 120px 80px', gap: '16px', padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                <div></div>
                <div>Material</div>
                <div>Variant</div>
                <div style={{ textAlign: 'right' }}>Planned Qty</div>
                <div>Unit</div>
                <div style={{ textAlign: 'right' }}>Rate</div>
                <div style={{ textAlign: 'right' }}>Planned Cost</div>
                <div>Remarks</div>
                <div style={{ textAlign: 'center' }}>Actions</div>
              </div>

              {/* Non-BOQ Items */}
              {materialList.filter((item: any) => item.is_boq === false).map((item: any) => (
                <div key={item.id}>
                  {/* Main Row */}
                  {editingId === item.id ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 80px 80px 100px 100px 120px 80px', gap: '16px', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', alignItems: 'center', fontSize: '14px' }}>
                      <div></div>
                      <div>
                        <select
                          value={formData.item_id}
                          onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px' }}
                          disabled
                        >
                          <option value={item.item_id}>{getMaterialName(item.item_id)}</option>
                        </select>
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '13px' }}>{getVariantName(item.variant_id)}</div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.planned_qty}
                          onChange={(e) => setFormData({ ...formData, planned_qty: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.rate}
                          onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: 500 }}>
                        {((parseFloat(formData.planned_qty) || 0) * (parseFloat(formData.rate) || 0)).toFixed(2)}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={formData.remarks}
                          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleUpdate(item.id)}
                          disabled={updateMutation.isPending}
                          style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                        >
                          <Save size={16} color="#22c55e" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                        >
                          <X size={16} color="#6b7280" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '40px 1fr 100px 80px 80px 100px 100px 120px 80px', 
                        gap: '16px', 
                        padding: '12px 16px', 
                        borderBottom: '1px solid #f3f4f6',
                        alignItems: 'center',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleRow(item.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {expandedRows.has(item.id) ? <ChevronDown size={18} color="#6b7280" /> : <ChevronRight size={18} color="#6b7280" />}
                      </div>
                      <div style={{ fontWeight: 500 }}>{getMaterialName(item.item_id)}</div>
                      <div style={{ color: '#6b7280', fontSize: '13px' }}>{getVariantName(item.variant_id)}</div>
                      <div style={{ textAlign: 'right' }}>{item.planned_qty}</div>
                      <div>{item.unit}</div>
                      <div style={{ textAlign: 'right' }}>{item.rate ? item.rate.toFixed(2) : '-'}</div>
                      <div style={{ textAlign: 'right', fontWeight: 500 }}>{item.rate ? ((item.planned_qty || 0) * item.rate).toFixed(2) : '-'}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.remarks || '-'}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                          style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                          title="Edit"
                        >
                          <Edit size={16} color="#6b7280" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                          title="Delete"
                        >
                          <Trash2 size={16} color="#6b7280" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Row - Material Details */}
                  {expandedRows.has(item.id) && editingId !== item.id && (
                    <div style={{ padding: '16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ marginBottom: '12px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                        Material Details
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', fontSize: '13px' }}>
                        <div>
                          <div style={{ color: '#6b7280', marginBottom: '4px' }}>Material ID</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.item_id}</div>
                        </div>
                        <div>
                          <div style={{ color: '#6b7280', marginBottom: '4px' }}>Variant ID</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.variant_id || '-'}</div>
                        </div>
                        <div>
                          <div style={{ color: '#6b7280', marginBottom: '4px' }}>Created At</div>
                          <div>{new Date(item.created_at).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <div style={{ color: '#6b7280', marginBottom: '4px' }}>Updated At</div>
                          <div>{new Date(item.updated_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
